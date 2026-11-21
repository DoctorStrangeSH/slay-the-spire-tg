// Engineer passive powers and construction trigger timing regressions.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/data/cards/common.js',
    'js/data/cards/engineer.js',
    'js/systems/battle/BattleCore.js',
    'js/systems/battle/BattleBuildings.js',
    'js/systems/battle/BattleEffects.js',
    'js/systems/battle/BattleCards.js',
    'js/systems/battle/BattleTurn.js',
    'js/systems/BattleSystem.js'
].map(file => readFileSync(join(root, file), 'utf8')).join('\n');

function createApi() {
    const math = Object.create(Math);
    math.random = () => 0.99;
    return vm.runInNewContext(source + '\n({ BattleSystem, ENGINEER_CARDS, CARD_TYPES })', { Math: math });
}

function setup() {
    const api = createApi();
    const battle = new api.BattleSystem(
        { heroId: 'engineer', hp: 30, maxHp: 40, deck: [], relics: [] },
        { id: 'dummy', name: 'Манекен', hp: 100, maxHp: 100, damage: 0,
            pattern: ['defend'], patternIndex: 0 }
    );
    battle.energy = 10;
    return { api, battle };
}

function addBuilding(api, battle, id, hp) {
    const result = battle.buildings.placeBuilding(battle, { ...api.ENGINEER_CARDS[id] });
    assert.equal(result.success, true);
    if (hp !== undefined) result.building.hp = hp;
    return result.building;
}

function play(api, battle, id) {
    battle.hand = [{ ...api.ENGINEER_CARDS[id] }];
    battle.energy = 10;
    return battle.playCard(0);
}

test('Living Steel and Calibration improve new constructions at placement', () => {
    const { api, battle } = setup();
    battle.player.relics.push('livingSteel', 'calibration');
    const turret = addBuilding(api, battle, 'smallTurret');
    assert.equal(turret.hp, 11);
    assert.equal(turret.maxHp, 11);
    assert.equal(turret.damage, 4);
    assert.equal(turret.block, 1);
});

test('Overproduction draws exactly one card when a construction is placed', () => {
    const { api, battle } = setup();
    battle.player.relics.push('overproduction');
    battle.drawPile = [{ id: 'test_draw', type: api.CARD_TYPES.SKILL, cost: 0 }];
    addBuilding(api, battle, 'smallTurret');
    assert.equal(battle.hand.length, 1);
    assert.equal(battle.hand[0].id, 'test_draw');
});

test('Modular Construction grants 2 passive block to all constructions without healing them', () => {
    const { api, battle } = setup();
    battle.player.relics.push('modularConstruction');
    const damaged = addBuilding(api, battle, 'smallTurret', 2);
    const barrier = addBuilding(api, battle, 'barrier');

    assert.equal(damaged.hp, 2);
    assert.equal(damaged.block, 4);
    assert.equal(barrier.block, 5);
});

test('Indestructible Fortress grants 3 player block and 3 construction block without restoring HP', () => {
    const { api, battle } = setup();
    battle.player.relics.push('indestructibleFortress');
    const damaged = addBuilding(api, battle, 'smallTurret', 2);

    battle.buildings.triggerStartOfTurn(battle);

    assert.equal(battle.block, 3);
    assert.equal(damaged.hp, 2);
    assert.equal(damaged.block, 3);
});

test('System Overload triggers for every construction removed by Factory Reset', () => {
    const { api, battle } = setup();
    battle.player.relics.push('systemOverload');
    addBuilding(api, battle, 'smallTurret');
    addBuilding(api, battle, 'barrier');
    const beforeEnergy = battle.energy;
    battle.drawPile = [
        { id: 'draw_a', type: api.CARD_TYPES.SKILL, cost: 0 },
        { id: 'draw_b', type: api.CARD_TYPES.SKILL, cost: 0 }
    ];

    play(api, battle, 'factoryReset');

    assert.equal(battle.enemy.hp, 94);
    assert.equal(battle.buildings.getBuildingCount(), 0);
    assert.equal(battle.energy, beforeEnergy);
    assert.equal(battle.hand.length, 2);
});

test('Lubricant doubles both construction trigger phases on the following turn only', () => {
    const { api, battle } = setup();
    addBuilding(api, battle, 'smallTurret');
    addBuilding(api, battle, 'barrier');
    const starts = [];
    const ends = [];
    battle.buildings.triggerBuildingStart = (_battle, building) => starts.push(building.cardId);
    battle.buildings.triggerBuildingEnd = (_battle, building) => ends.push(building.cardId);

    play(api, battle, 'lubricant');
    assert.equal(battle.engineerLubricantNextTurn, true);
    battle.buildings.triggerEndOfTurn(battle);
    assert.equal(ends.length, 2, 'the current turn is not doubled');

    battle.buildings.triggerStartOfTurn(battle);
    assert.equal(starts.length, 4, 'both constructions trigger twice at the next turn start');
    assert.equal(battle.engineerLubricantNextTurn, false);
    assert.equal(battle.engineerLubricantActiveThisTurn, true);

    battle.buildings.triggerEndOfTurn(battle);
    assert.equal(ends.length, 6, 'both constructions trigger twice at the next turn end');
    assert.equal(battle.engineerLubricantActiveThisTurn, false);

    battle.buildings.triggerStartOfTurn(battle);
    battle.buildings.triggerEndOfTurn(battle);
    assert.equal(starts.length, 6, 'the following turn returns to normal start triggers');
    assert.equal(ends.length, 8, 'the following turn returns to normal end triggers');
});

test('Weapons Factory respects the maximum hand size', () => {
    const { api, battle } = setup();
    battle.player.relics.push('weaponsFactory');
    battle.hand = Array.from({ length: 10 }, (_, index) => ({
        id: 'held_' + index, type: api.CARD_TYPES.SKILL, cost: 0
    }));

    battle.buildings.triggerStartOfTurn(battle);

    assert.equal(battle.hand.length, 10);
});
