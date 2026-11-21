// Regression tests for Psyker control and scry powers.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/data/cards/psyker.js',
    'js/systems/battle/BattleCore.js',
    'js/systems/battle/BattleEffects.js',
    'js/systems/battle/BattleCards.js',
    'js/systems/battle/BattleTurn.js',
    'js/systems/BattleSystem.js',
    'js/systems/Game.js'
].map(file => readFileSync(join(root, file), 'utf8')).join('\n');

function api(overrides = {}, randomValue = 0.99) {
    const math = Object.create(Math);
    math.random = () => randomValue;
    const context = {
        Math: math,
        BattleUI: { update() {} },
        BattleFeedback: { snapshot() { return {}; }, show() {}, bossAttack() {} },
        ...overrides
    };
    return vm.runInNewContext(source + '\n({ BattleSystem, CARD_TYPES, Game })', context);
}

function createBattle(powers = [], hp = 20, deck = [], randomValue = 0.99) {
    const { BattleSystem } = api({}, randomValue);
    return new BattleSystem(
        { heroId: 'psyker', hp, maxHp: 40, deck: deck.map(card => ({ ...card })), relics: [...powers] },
        { id: 'training_dummy', name: 'Тренировочный манекен', hp: 100, maxHp: 100,
            damage: 5, pattern: ['attack'], patternIndex: 0 }
    );
}

test('Absolute Control skips every second enemy turn without consuming paralysis', () => {
    const battle = createBattle(['absoluteControl']);
    battle.enemyIntent = 'attack';

    battle.endTurn();
    assert.equal(battle.player.hp, 15, 'the first enemy turn still resolves');

    battle.enemyIntent = 'attack';
    battle.endTurn();
    assert.equal(battle.player.hp, 15, 'the second enemy turn is skipped');

    battle.enemyIntent = 'attack';
    battle.endTurn();
    assert.equal(battle.player.hp, 10, 'the third enemy turn resolves again');
});

test('Telepathic Link returns the top three cards to the scry UI', () => {
    const { CARD_TYPES } = api();
    const battle = createBattle();
    battle.drawPile = [
        { id: 'bottom', name: 'Нижняя', cost: 1 },
        { id: 'middle', name: 'Средняя', cost: 1 },
        { id: 'top', name: 'Верхняя', cost: 1 }
    ];
    battle.hand = [{ id: 'telepathicLink', type: CARD_TYPES.POWER, cost: 1 }];
    battle.energy = 3;

    const result = battle.playCard(0);
    assert.equal(result.success, true);
    assert.deepEqual(Array.from(result.scryedCards, card => card.id), ['top', 'middle', 'bottom']);
    assert.equal(battle.scryedThisTurn, true);
});

test('Predictor exposes the post-draw top card and allows discarding only that card', () => {
    const deck = Array.from({ length: 10 }, (_, index) => ({
        id: `card_${index}`, name: `Карта ${index}`, type: 'skill', cost: 1
    }));
    const battle = createBattle(['predictor'], 20, deck);
    const pending = battle.pendingScryCards;
    assert.equal(pending.length, 1);
    assert.equal(battle.scryedThisTurn, true);
    assert.equal(battle.drawPile.length, 5);

    const { Game } = api();
    const expectedId = pending[0].id;
    const game = { currentBattle: battle };
    assert.equal(Game.prototype.discardScryedCard.call(game, 0), true);
    assert.equal(battle.discardPile.at(-1).id, expectedId);
    assert.equal(battle.drawPile.length, 4);
    assert.equal(battle.pendingScryCards, null);
});

test('Closing Predictor scry preserves the top card and clears the pending choice', () => {
    const deck = Array.from({ length: 10 }, (_, index) => ({
        id: `card_${index}`, name: `Карта ${index}`, type: 'skill', cost: 1
    }));
    const battle = createBattle(['predictor'], 20, deck);
    const drawCount = battle.drawPile.length;
    const { Game } = api();

    Game.prototype.closeScryModal.call({ currentBattle: battle });

    assert.equal(battle.drawPile.length, drawCount);
    assert.equal(battle.pendingScryCards, null);
});

test('lethal Psy Resonance does not trigger delayed echo, scry or steal effects', () => {
    const { CARD_TYPES } = api();
    const battle = createBattle(['psyResonance']);
    battle.enemy.hp = 1;
    battle.drawPile = [
        { id: 'top', name: 'Верхняя', cost: 1 },
        { id: 'bottom', name: 'Нижняя', cost: 1 }
    ];
    battle.hand = [{
        id: 'resonant_skill',
        type: CARD_TYPES.SKILL,
        cost: 0,
        echo: 1,
        scry: 2,
        steal: 1
    }];
    battle.energy = 3;

    const result = battle.playCard(0);

    assert.equal(result.success, true);
    assert.equal(battle.enemy.hp, 0, 'Psy Resonance deals the lethal point of damage');
    assert.equal(result.scryedCards, null, 'scry must not open after the lethal resonance');
    assert.equal(battle.scryedThisTurn, false);
    assert.equal(battle.echoStacks, 0, 'the dead enemy cannot receive a delayed follow-up');
    assert.equal(battle.hand.length, 0, 'the steal effect must not add an enemy card');
    assert.equal(battle.discardPile.length, 1);
});

test('Game does not show an enemy attack animation on an Absolute Control skip turn', () => {
    let bossAttackFeedback = 0;
    const { Game } = api({
        BattleFeedback: {
            snapshot() { return {}; },
            show() {},
            bossAttack() { bossAttackFeedback++; }
        }
    });
    const battle = {
        enemyIntent: 'attack',
        isEnemyParalyzed() { return false; },
        hasPower(id) { return id === 'absoluteControl'; },
        turn: 2,
        enemy: { hp: 100, isBoss: true, id: 'test_boss' },
        pendingScryCards: null,
        endTurn() { return { battleEnded: false }; }
    };

    Game.prototype.endTurn.call({ currentBattle: battle });

    assert.equal(bossAttackFeedback, 0);
});

test('Mental Blockade applies paralysis only on its 50 percent roll', () => {
    const triggered = createBattle(['mentalBlockade'], 20, [], 0.1);
    triggered.enemyIntent = 'defend';
    triggered.endTurn();
    assert.equal(triggered.statusEffects.enemy.paralysis, 1);

    const missed = createBattle(['mentalBlockade'], 20, [], 0.9);
    missed.enemyIntent = 'defend';
    missed.endTurn();
    assert.equal(missed.statusEffects.enemy.paralysis, 0);
});

test('Mental Storm can finish an enemy after its announced action', () => {
    const battle = createBattle(['mentalStorm']);
    battle.enemy.hp = 3;
    battle.enemyIntent = 'defend';

    const result = battle.endTurn();

    assert.equal(result.battleEnded, true);
    assert.equal(result.victory, true);
    assert.equal(battle.enemy.hp, 0);
});

test('Psy Reflection kills the attacker before its hit can reach the hero', () => {
    const battle = createBattle(['psyReflection'], 20);
    battle.enemy.hp = 3;
    battle.enemyIntent = 'attack';

    const result = battle.endTurn();

    assert.equal(result.battleEnded, true);
    assert.equal(result.victory, true);
    assert.equal(battle.player.hp, 20);
    assert.equal(battle.enemy.hp, 0);
});

test('Psy Vampirism heals at the start of a turn while the enemy is paralyzed', () => {
    const battle = createBattle(['psyVampirism'], 10);
    battle.statusEffects.enemy.paralysis = 1;

    battle.startTurn();

    assert.equal(battle.player.hp, 12);
});

test('Mental Capture can replace its own slot in a full hand without exceeding the cap', () => {
    const { CARD_TYPES, PSYKER_CARDS } = api();
    const battle = createBattle();
    battle.hand = Array.from({ length: 10 }, (_, index) => ({
        id: `held_${index}`, name: `Карта ${index}`, type: CARD_TYPES.SKILL, cost: 0
    }));
    battle.hand[0] = { ...PSYKER_CARDS.mentalCapture };
    battle.energy = 3;

    const result = battle.playCard(0);

    assert.equal(result.success, true);
    assert.equal(battle.hand.length, 10);
    assert.equal(battle.hand.some(card => card.id === 'stolen_attack' || card.id === 'stolen_defend'), true);
});

test('direct enemy-card theft is rejected when the hand is already full', () => {
    const battle = createBattle();
    battle.hand = Array.from({ length: 10 }, (_, index) => ({ id: `held_${index}` }));

    const result = battle.stealEnemyCard();

    assert.equal(result.success, false);
    assert.equal(battle.hand.length, 10);
});

