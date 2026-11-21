// Runtime regressions for Engineer's explosive and fire attacks.
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
    return vm.runInNewContext(source + '\n({ BattleSystem, ENGINEER_CARDS })', { Math: math });
}

function setup() {
    const api = createApi();
    const battle = new api.BattleSystem(
        { heroId: 'engineer', hp: 40, maxHp: 40, deck: [], relics: [] },
        { id: 'dummy', name: 'Манекен', hp: 100, maxHp: 100, damage: 0,
            pattern: ['defend'], patternIndex: 0 }
    );
    battle.energy = 10;
    return { api, battle };
}

function addBuilding(api, battle, id, hp) {
    const card = { ...api.ENGINEER_CARDS[id] };
    const result = battle.buildings.placeBuilding(battle, card);
    assert.equal(result.success, true);
    result.building.hp = hp;
    return result.building;
}

function play(api, battle, id) {
    battle.hand = [{ ...api.ENGINEER_CARDS[id] }];
    battle.energy = 10;
    return battle.playCard(0);
}

test('Kamikaze Drone destroys the strongest construction and deals up to 15 of its HP', () => {
    const { api, battle } = setup();
    const target = addBuilding(api, battle, 'nexus', 20);
    const survivor = addBuilding(api, battle, 'barrier', 6);
    const preview = battle.cards.calculateCardPreview(battle, api.ENGINEER_CARDS.kamikazeDrone);

    assert.equal(preview.damage, 15);
    assert.equal(play(api, battle, 'kamikazeDrone').success, true);
    assert.equal(battle.enemy.hp, 85);
    assert.deepEqual(Array.from(battle.buildings.buildings, item => item.id), [survivor.id]);
    assert.equal(battle.buildings.buildings.some(item => item.id === target.id), false);
});

test('Kamikaze Drone activates System Overload when its construction is destroyed', () => {
    const { api, battle } = setup();
    battle.player.relics.push('systemOverload');
    addBuilding(api, battle, 'nexus', 20);
    assert.equal(battle.cards.calculateCardPreview(battle, api.ENGINEER_CARDS.kamikazeDrone).damage, 18);
    play(api, battle, 'kamikazeDrone');
    assert.equal(battle.enemy.hp, 82, '3 direct overload damage plus 15 attack damage');
    assert.equal(battle.buildings.getBuildingCount(), 0);
});

test('Mass Overload destroys every construction and deals six damage per construction', () => {
    const { api, battle } = setup();
    addBuilding(api, battle, 'smallTurret', 6);
    addBuilding(api, battle, 'barrier', 8);
    addBuilding(api, battle, 'generator', 6);
    battle.enemyBlock = 5;
    const preview = battle.cards.calculateCardPreview(battle, api.ENGINEER_CARDS.massOverload);

    assert.equal(preview.damage, 18);
    play(api, battle, 'massOverload');
    assert.equal(battle.buildings.getBuildingCount(), 0);
    assert.equal(battle.enemyBlock, 0);
    assert.equal(battle.enemy.hp, 87, '18 attack damage minus 5 block');
});

test('Mass Overload triggers System Overload once for every demolished construction', () => {
    const { api, battle } = setup();
    battle.player.relics.push('systemOverload');
    addBuilding(api, battle, 'smallTurret', 6);
    addBuilding(api, battle, 'barrier', 8);
    battle.enemyBlock = 4;
    const preview = battle.cards.calculateCardPreview(battle, api.ENGINEER_CARDS.massOverload);

    assert.equal(preview.damage, 12);
    play(api, battle, 'massOverload');
    assert.equal(battle.buildings.getBuildingCount(), 0);
    assert.equal(battle.enemy.hp, 86, '6 direct overload damage plus 8 unblocked attack damage');
});

test('Destroyer removes all enemy block before dealing its 15 damage', () => {
    const { api, battle } = setup();
    battle.enemyBlock = 30;
    const preview = battle.cards.calculateCardPreview(battle, api.ENGINEER_CARDS.destroyer);

    assert.equal(preview.damage, 15);
    play(api, battle, 'destroyer');
    assert.equal(battle.enemyBlock, 0);
    assert.equal(battle.enemy.hp, 85);
});

test('Flamethrower deals its hit and applies a visible two-stack fire effect', () => {
    const { api, battle } = setup();
    battle.enemyBlock = 2;
    const preview = battle.cards.calculateCardPreview(battle, api.ENGINEER_CARDS.flamethrower);

    assert.equal(preview.damage, 5);
    assert.equal(preview.fire, 2);
    play(api, battle, 'flamethrower');
    assert.equal(battle.enemy.hp, 97);
    assert.equal(battle.statusEffects.enemy.fire, 2);
});

test('Fire deals its current intensity at end of enemy turn and then decays by one', () => {
    const turnSource = readFileSync(join(root, 'js/systems/battle/BattleTurn.js'), 'utf8');
    const BattleTurn = vm.runInNewContext(turnSource + '\nBattleTurn;', { Math });
    const player = { hp: 20, maxHp: 20, relics: [] };
    const enemy = { hp: 20, damage: 0 };
    const state = {
        player, enemy, turn: 1, block: 0, enemyBlock: 0,
        enemyIntent: 'defend', hand: [], discardPile: [],
        statusEffects: {
            player: { poison: 0, vulnerable: 0, thorns: 0 },
            enemy: { paralysis: 0, poison: 0, bleed: 0, fire: 2, weak: 0, strength: 0 }
        },
        hasPower() { return false; },
        isEnemyParalyzed() { return false; },
        startTurn() { this.started = true; },
        takeDamage(amount) { this.player.hp = Math.max(0, this.player.hp - amount); }
    };

    const outcome = new BattleTurn().endTurn(state, { decreaseStatusEffects() {} });
    assert.equal(outcome.battleEnded, false);
    assert.equal(state.enemy.hp, 18);
    assert.equal(state.statusEffects.enemy.fire, 1);
});

test('Fire can defeat an enemy before its next turn begins', () => {
    const turnSource = readFileSync(join(root, 'js/systems/battle/BattleTurn.js'), 'utf8');
    const BattleTurn = vm.runInNewContext(turnSource + '\nBattleTurn;', { Math });
    const player = { hp: 20, maxHp: 20, relics: [] };
    const enemy = { hp: 1, damage: 99 };
    const state = {
        player, enemy, turn: 1, block: 0, enemyBlock: 0,
        enemyIntent: 'attack', hand: [], discardPile: [],
        statusEffects: {
            player: { poison: 0, vulnerable: 0, thorns: 0 },
            enemy: { paralysis: 1, poison: 0, bleed: 0, fire: 2, weak: 0, strength: 0 }
        },
        hasPower() { return false; },
        isEnemyParalyzed() { return true; },
        startTurn() { this.started = true; },
        takeDamage(amount) { this.player.hp = Math.max(0, this.player.hp - amount); }
    };

    const outcome = new BattleTurn().endTurn(state, { decreaseStatusEffects() {} });
    assert.equal(outcome.battleEnded, true);
    assert.equal(outcome.victory, true);
    assert.equal(state.enemy.hp, 0);
    assert.equal(state.player.hp, 20);
    assert.equal(state.started, undefined);
});
