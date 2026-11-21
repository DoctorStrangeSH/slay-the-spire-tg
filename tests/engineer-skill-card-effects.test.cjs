// Engineer skill-card behavior and construction targeting regressions.
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
    return vm.runInNewContext(source + '\n({ BattleSystem, CARD_TYPES, ENGINEER_CARDS })', { Math: math });
}

function setup() {
    const api = createApi();
    const battle = new api.BattleSystem(
        { heroId: 'engineer', hp: 30, maxHp: 40, deck: [], relics: [] },
        { id: 'dummy', name: 'Манекен', hp: 200, maxHp: 200, damage: 0,
            pattern: ['defend'], patternIndex: 0 }
    );
    battle.energy = 10;
    return { api, battle };
}

function addBuilding(api, battle, id = 'smallTurret', hp) {
    const result = battle.buildings.placeBuilding(battle, api.ENGINEER_CARDS[id]);
    assert.equal(result.success, true);
    if (hp !== undefined) result.building.hp = hp;
    return result.building;
}

function play(api, battle, id, extraHand = []) {
    battle.hand = [{ ...api.ENGINEER_CARDS[id] }, ...extraHand];
    battle.energy = 10;
    const result = battle.playCard(0);
    assert.equal(result.success, true);
    return result;
}

test('Repair restores 3 HP to the most damaged construction', () => {
    const { api, battle } = setup();
    const healthy = addBuilding(api, battle, 'smallTurret', 5);
    const damaged = addBuilding(api, battle, 'barrier', 2);
    play(api, battle, 'repair');
    assert.equal(healthy.hp, 5);
    assert.equal(damaged.hp, 5);
});

test('Reinforcement adds 4 passive block to the most damaged construction', () => {
    const { api, battle } = setup();
    const damaged = addBuilding(api, battle, 'barrier', 3);
    play(api, battle, 'reinforcement');
    assert.equal(damaged.block, 7);
});

test('Blueprints draws two cards and reduces all held construction costs by one', () => {
    const { api, battle } = setup();
    battle.hand = [{ ...api.ENGINEER_CARDS.blueprints }, { ...api.ENGINEER_CARDS.smallTurret }];
    battle.drawPile = [{ ...api.ENGINEER_CARDS.generator }, { ...api.ENGINEER_CARDS.barrier }];
    battle.energy = 10;
    assert.equal(battle.playCard(0).success, true);
    assert.equal(battle.hand.length, 3);
    const costs = Object.fromEntries(battle.hand.map(card => [card.id, card.cost]));
    assert.equal(costs.smallTurret, 0);
    assert.equal(costs.barrier, 0);
    assert.equal(costs.generator, 1, 'the 2-cost Generator receives a one-energy discount');
});

test('Quick Assembly makes the construction it draws free', () => {
    const { api, battle } = setup();
    battle.hand = [{ ...api.ENGINEER_CARDS.quickAssembly }];
    battle.drawPile = [{ ...api.ENGINEER_CARDS.generator }];
    assert.equal(battle.playCard(0).success, true);
    assert.equal(battle.hand[0].id, 'generator');
    assert.equal(battle.hand[0].cost, 0);
});

test('Energy Shield grants 10 block when a construction is active and 6 otherwise', () => {
    const { api, battle } = setup();
    battle.block = 0;
    play(api, battle, 'energyShield');
    assert.equal(battle.block, 6);

    const second = setup();
    addBuilding(second.api, second.battle);
    play(second.api, second.battle, 'energyShield');
    assert.equal(second.battle.block, 10);
});

test('Repair Drone restores 5 HP and Nanobots restore 2 HP to every construction', () => {
    const { api, battle } = setup();
    const first = addBuilding(api, battle, 'smallTurret', 1);
    const second = addBuilding(api, battle, 'barrier', 2);
    play(api, battle, 'repairDrone');
    assert.equal(first.hp, 6);
    assert.equal(second.hp, 7);

    first.hp = 2;
    second.hp = 3;
    play(api, battle, 'nanobots');
    assert.equal(first.hp, 4);
    assert.equal(second.hp, 5);
    assert.equal(battle.player.hp, 32);
});

test('Evacuation returns the most damaged construction and refunds its energy cost', () => {
    const { api, battle } = setup();
    const healthy = addBuilding(api, battle, 'smallTurret', 5);
    const damaged = addBuilding(api, battle, 'barrier', 1);
    const beforeEnergy = battle.energy;
    play(api, battle, 'evacuation');
    assert.deepEqual(Array.from(battle.buildings.buildings, item => item.id), [healthy.id]);
    assert.equal(battle.hand[0].id, 'barrier');
    assert.equal(battle.energy, beforeEnergy - 1 + 1);
    assert.equal(damaged.hp, 1);
});

test('Modernization improves damage or block on every active construction', () => {
    const { api, battle } = setup();
    const turret = addBuilding(api, battle, 'smallTurret');
    const barrier = addBuilding(api, battle, 'barrier');
    play(api, battle, 'modernization');
    assert.equal(turret.damage, 5);
    assert.equal(barrier.block, 6);
    assert.equal(turret.upgraded, true);
    assert.equal(barrier.upgraded, true);
});

test('Factory Reset demolishes all constructions and grants one energy and card per construction', () => {
    const { api, battle } = setup();
    addBuilding(api, battle, 'smallTurret');
    addBuilding(api, battle, 'barrier');
    battle.drawPile = [{ ...api.ENGINEER_CARDS.generator }, { ...api.ENGINEER_CARDS.scoutDrone }];
    const beforeEnergy = battle.energy;
    play(api, battle, 'factoryReset');
    assert.equal(battle.buildings.getBuildingCount(), 0);
    assert.equal(battle.energy, beforeEnergy - 2 + 2);
    assert.equal(battle.hand.length, 2);
});

test('Blueprints uses the played card slot when drawing from a full hand', () => {
    const { api, battle } = setup();
    battle.hand = [
        { ...api.ENGINEER_CARDS.blueprints },
        ...Array.from({ length: 9 }, (_, index) => ({ ...api.ENGINEER_CARDS.smallTurret, id: 'turret_' + index }))
    ];
    battle.drawPile = [{ ...api.ENGINEER_CARDS.generator }, { ...api.ENGINEER_CARDS.barrier }];
    assert.equal(battle.playCard(0).success, true);
    assert.equal(battle.hand.length, 10);
    assert.ok(battle.hand.some(card => card.id === 'generator'));
    assert.ok(battle.hand.every(card => card.type !== api.CARD_TYPES.BUILDING || card.cost === 0));
});

test('Quick Assembly draws and discounts a construction when the hand was full', () => {
    const { api, battle } = setup();
    battle.hand = [
        { ...api.ENGINEER_CARDS.quickAssembly },
        ...Array.from({ length: 9 }, (_, index) => ({ ...api.ENGINEER_CARDS.smallTurret, id: 'turret_' + index }))
    ];
    battle.drawPile = [{ ...api.ENGINEER_CARDS.generator }];
    assert.equal(battle.playCard(0).success, true);
    assert.equal(battle.hand.length, 10);
    assert.equal(battle.hand.find(card => card.id === 'generator').cost, 0);
});

test('Factory Reset draws up to the available post-play hand capacity', () => {
    const { api, battle } = setup();
    addBuilding(api, battle, 'smallTurret');
    addBuilding(api, battle, 'barrier');
    battle.hand = [
        { ...api.ENGINEER_CARDS.factoryReset },
        ...Array.from({ length: 9 }, (_, index) => ({ id: 'held_' + index, type: api.CARD_TYPES.SKILL, cost: 0 }))
    ];
    battle.drawPile = [
        { ...api.ENGINEER_CARDS.generator },
        { ...api.ENGINEER_CARDS.scoutDrone }
    ];
    assert.equal(battle.playCard(0).success, true);
    assert.equal(battle.hand.length, 10);
    assert.equal(battle.hand.filter(card => card.type === api.CARD_TYPES.BUILDING).length, 1);
});

test('Engineering Genius draws three and makes all constructions currently in hand free', () => {
    const { api, battle } = setup();
    battle.hand = [{ ...api.ENGINEER_CARDS.engineeringGenius }, { ...api.ENGINEER_CARDS.smallTurret }];
    battle.drawPile = [
        { ...api.ENGINEER_CARDS.generator },
        { ...api.ENGINEER_CARDS.barrier },
        { ...api.ENGINEER_CARDS.scoutDrone }
    ];
    assert.equal(battle.playCard(0).success, true);
    assert.equal(battle.hand.length, 4);
    assert.ok(battle.hand.every(card => card.type !== api.CARD_TYPES.BUILDING || card.cost === 0));
});
