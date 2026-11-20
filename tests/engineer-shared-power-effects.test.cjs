// Runtime regression coverage for Engineer and shared power cards.
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

function api() {
    const math = Object.create(Math);
    math.random = () => 0.99;
    return vm.runInNewContext(source + '\n({ BattleSystem, CARD_TYPES, ENGINEER_CARDS })', { Math: math });
}

function createBattle(powers = [], hp = 20, maxHp = 40) {
    const { BattleSystem } = api();
    return new BattleSystem(
        { heroId: 'engineer', hp, maxHp, deck: [], relics: [...powers] },
        { id: 'training_dummy', name: 'Тренировочный манекен', hp: 100, maxHp: 100,
            damage: 0, pattern: ['defend'], patternIndex: 0 }
    );
}

test('Engineer Automation triggers exactly one random building twice at start of turn', () => {
    const battle = createBattle(['automation']);
    const { ENGINEER_CARDS } = api();
    battle.buildings.placeBuilding(battle, ENGINEER_CARDS.smallTurret);
    battle.buildings.placeBuilding(battle, ENGINEER_CARDS.generator);
    const counts = new Map();
    battle.buildings.triggerBuildingStart = (_battle, building) => {
        counts.set(building.cardId, (counts.get(building.cardId) || 0) + 1);
    };

    battle.buildings.triggerStartOfTurn(battle);

    assert.equal(counts.get('smallTurret'), 1);
    assert.equal(counts.get('generator'), 2, 'seeded RNG selects the second building');
});

test('Reserve adds a Small Turret and Jetpack grants one energy when played', () => {
    const { CARD_TYPES, ENGINEER_CARDS } = api();
    const reserveBattle = createBattle();
    reserveBattle.hand = [{ id: 'reserve', type: CARD_TYPES.POWER, cost: 1 }];
    reserveBattle.energy = 2;
    assert.equal(reserveBattle.playCard(0).success, true);
    assert.equal(reserveBattle.hand.length, 1);
    assert.equal(reserveBattle.hand[0].id, 'smallTurret');

    const jetpackBattle = createBattle();
    jetpackBattle.hand = [{ id: 'jetpack', type: CARD_TYPES.POWER, cost: 1 }];
    jetpackBattle.energy = 1;
    assert.equal(jetpackBattle.playCard(0).success, true);
    assert.equal(jetpackBattle.energy, 1, 'the power refunds one energy after paying its cost');
});

test('Arsenal adds a Spark to hand after each non-lethal attack', () => {
    const { CARD_TYPES } = api();
    const battle = createBattle(['arsenal']);
    battle.hand = [{ id: 'test_attack', type: CARD_TYPES.ATTACK, cost: 0, damage: 1 }];
    battle.energy = 3;

    assert.equal(battle.playCard(0).success, true);
    assert.equal(battle.hand.length, 1);
    assert.equal(battle.hand[0].id, 'spark');
});

test('Vampirism heals at most three times per turn and only for unblocked HP damage', () => {
    const { CARD_TYPES } = api();
    const battle = createBattle(['vampirism'], 10, 40);
    for (let i = 0; i < 4; i++) {
        battle.hand.push({ id: `attack_${i}`, type: CARD_TYPES.ATTACK, cost: 0, damage: 1 });
    }
    battle.energy = 4;

    for (let i = 0; i < 4; i++) assert.equal(battle.playCard(0).success, true);
    assert.equal(battle.player.hp, 13);
    assert.equal(battle.vampirismTriggersThisTurn, 3);

    battle.startTurn();
    battle.player.hp = 10;
    battle.enemyBlock = 5;
    battle.hand = [{ id: 'blocked_attack', type: CARD_TYPES.ATTACK, cost: 0, damage: 1 }];
    battle.energy = 3;
    battle.playCard(0);
    assert.equal(battle.player.hp, 10, 'fully blocked damage does not trigger healing');
    assert.equal(battle.vampirismTriggersThisTurn, 0);
});
