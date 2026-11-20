// Regression coverage for Berserker power descriptions and their runtime effects.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/systems/battle/BattleCore.js',
    'js/systems/battle/BattleEffects.js',
    'js/systems/battle/BattleCards.js',
    'js/systems/battle/BattleTurn.js',
    'js/systems/BattleSystem.js'
].map(file => readFileSync(join(root, file), 'utf8')).join('\n');

function api() {
    const math = Object.create(Math);
    math.random = () => 0.99;
    return vm.runInNewContext(source + '\n({ BattleSystem, CARD_TYPES })', { Math: math });
}

function createBattle(powers = [], hp = 40, maxHp = 40) {
    const { BattleSystem } = api();
    return new BattleSystem(
        { heroId: 'berserk', hp, maxHp, deck: [], relics: [...powers] },
        { id: 'training_dummy', name: 'Тренировочный манекен', hp: 100, maxHp: 100,
            damage: 0, pattern: ['defend'], patternIndex: 0 }
    );
}

test('Berserker damage-reactive powers trigger with per-turn limits and next-turn block', () => {
    const battle = createBattle(['bloodletting', 'battleMadness', 'beastSkin', 'painIsPower']);
    battle.drawPile = [
        { id: 'draw_a', type: 'skill', cost: 0 },
        { id: 'draw_b', type: 'skill', cost: 0 },
        { id: 'draw_c', type: 'skill', cost: 0 }
    ];

    battle.takeDamage(2);
    battle.takeDamage(2);
    battle.takeDamage(2);

    assert.equal(battle.statusEffects.enemy.bleed, 3, 'Bloodletting applies bleed on every HP-loss event');
    assert.equal(battle.hand.length, 2, 'Battle Madness draws at most twice per turn');
    assert.equal(battle.statusEffects.player.strength, 1, 'Pain Is Power grants strength only once per turn');
    assert.equal(battle.beastSkinBlockNextTurn, 3, 'Beast Skin stores one block per HP-loss event');

    battle.startTurn();
    assert.equal(battle.block, 3, 'Beast Skin block is granted at the next turn start');
    assert.equal(battle.beastSkinBlockNextTurn, 0);
    assert.equal(battle.battleMadnessTriggersThisTurn, 0);
    assert.equal(battle.painIsPowerTriggeredThisTurn, false);
});

test('Bloodthirst and Blood Seal heal only for actual bleed damage dealt', () => {
    const battle = createBattle(['bloodthirst', 'bloodSeal'], 20, 40);
    battle.statusEffects.enemy.bleed = 4;
    battle.enemy.hp = 2;
    battle.enemyIntent = 'defend';

    battle.endTurn();

    assert.equal(battle.enemy.hp, 0);
    assert.equal(battle.player.hp, 23, 'Healing is 3 total and does not scale with overkill');
    assert.equal(battle.statusEffects.enemy.bleed, 3);
});

test('Berserk Mode grants strength and converts remaining hand cards into HP loss', () => {
    const { CARD_TYPES } = api();
    const battle = createBattle(['berserkMode'], 30, 40);
    battle.hand = [{ id: 'berserkMode', type: CARD_TYPES.POWER, cost: 2 }];
    battle.energy = 3;

    const played = battle.playCard(0);
    assert.equal(played.success, true);
    assert.equal(battle.statusEffects.player.strength, 2);

    battle.hand = [
        { id: 'held_a', type: CARD_TYPES.SKILL, cost: 1 },
        { id: 'held_b', type: CARD_TYPES.SKILL, cost: 1 },
        { id: 'held_c', type: CARD_TYPES.SKILL, cost: 1 }
    ];
    battle.enemyIntent = 'defend';
    battle.endTurn();

    assert.equal(battle.player.hp, 27, 'Berserk Mode costs 1 HP per card still in hand');
});

test('Titan Rage costs 2 HP at turn start and discounts attacks by 1 energy', () => {
    const { CARD_TYPES } = api();
    const battle = createBattle(['titanRage'], 30, 40);

    assert.equal(battle.player.hp, 28);
    assert.equal(battle.cards.calculateCardCost(battle,
        { id: 'test_attack', type: CARD_TYPES.ATTACK, cost: 2 }, 1), 1);
});

test('Adrenaline Rush heals and draws once when the enemy is defeated', () => {
    const { CARD_TYPES } = api();
    const battle = createBattle(['adrenalineRush'], 10, 40);
    battle.hand = [{ id: 'finisher', type: CARD_TYPES.ATTACK, cost: 0, damage: 2 }];
    battle.drawPile = [{ id: 'bonus', type: CARD_TYPES.SKILL, cost: 0 }];
    battle.energy = 3;
    battle.enemy.hp = 1;

    const result = battle.playCard(0);
    assert.equal(result.success, true);
    assert.equal(battle.enemy.hp, 0);
    assert.equal(battle.player.hp, 12);
    assert.equal(battle.hand.length, 1);
    assert.equal(battle.hand[0].id, 'bonus');
    assert.equal(battle.adrenalineRushTriggered, true);
});

test('Battle Madness keeps enemy-phase draws for the next player hand', () => {
    const battle = createBattle(['battleMadness'], 30, 40);
    battle.drawPile = [{ id: 'next_turn_draw', type: 'skill', cost: 0 }];
    battle.enemy.damage = 1;
    battle.enemyIntent = 'attack';

    battle.endTurn();

    assert.equal(battle.player.hp, 29);
    assert.equal(battle.hand.length, 1);
    assert.equal(battle.hand[0].id, 'next_turn_draw');
    assert.equal(battle.battleMadnessPendingDraws, 0);
    assert.equal(battle.isResolvingEnemyTurn, false);
});
