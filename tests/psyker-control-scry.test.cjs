// Regression tests for Psyker control and scry powers.
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
    'js/systems/BattleSystem.js',
    'js/systems/Game.js'
].map(file => readFileSync(join(root, file), 'utf8')).join('\n');

function api() {
    const math = Object.create(Math);
    math.random = () => 0.99;
    const context = { Math: math, BattleUI: { update() {} } };
    return vm.runInNewContext(source + '\n({ BattleSystem, CARD_TYPES, Game })', context);
}

function createBattle(powers = [], hp = 20, deck = []) {
    const { BattleSystem } = api();
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
