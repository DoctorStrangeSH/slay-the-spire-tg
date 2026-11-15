// node --test tests/battle-card-energy.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/systems/battle/BattleCards.js'), 'utf8');
const BattleCards = vm.runInNewContext(source + '\nBattleCards;', {
    CARD_TYPES: { ATTACK: 'attack', SKILL: 'skill', POWER: 'power', BUILDING: 'building' }
});

function state(costs, powers = [], energy = 3) {
    return {
        hand: costs.map((cost, i) => ({ id: 'test_' + i, type: 'attack', cost })),
        selectedCards: [], energy, cardsPlayedThisTurn: 0,
        cardsPlayedTypes: { attack: 0, skill: 0, power: 0, building: 0 },
        statusEffects: { player: { strength: 0, weak: 0 }, enemy: { vulnerable: 0 } },
        hasPower(id) { return powers.includes(id); }
    };
}

test('selection reserves cumulative energy for the full batch', () => {
    const cards = new BattleCards();
    const battle = state([2, 2]);
    assert.equal(cards.selectCard(battle, 0).success, true);
    assert.equal(cards.selectCard(battle, 1).success, false);
    assert.deepEqual(Array.from(battle.selectedCards), [0]);
});

test('deselecting a card releases its reserved energy', () => {
    const cards = new BattleCards();
    const battle = state([2, 2, 1]);
    cards.selectCard(battle, 0);
    assert.equal(cards.selectCard(battle, 1).success, false);
    assert.equal(cards.selectCard(battle, 0).action, 'deselected');
    assert.equal(cards.selectCard(battle, 1).success, true);
    assert.equal(cards.selectCard(battle, 2).success, true);
});

test('every third card economy discount is included in batch projection', () => {
    const cards = new BattleCards();
    const battle = state([3, 1, 1], ['economy'], 2);
    for (const index of [0, 1, 2]) assert.equal(cards.selectCard(battle, index).success, true);
    assert.equal(cards.calculateSelectedCost(battle, battle.selectedCards), 2);
});

test('invalid direct card play fails gracefully without spending energy', () => {
    const cards = new BattleCards();
    const battle = state([1]);
    assert.equal(cards.playCard(battle, 99).success, false);
    assert.equal(battle.energy, 3);
});

test('attack discounts never produce a negative energy cost', () => {
    const cards = new BattleCards();
    const battle = state([0, 1], ['titanRage'], 0);
    assert.equal(cards.selectCard(battle, 0).success, true);
    assert.equal(cards.selectCard(battle, 1).success, true);
    assert.equal(cards.calculateSelectedCost(battle, battle.selectedCards), 0);
});
