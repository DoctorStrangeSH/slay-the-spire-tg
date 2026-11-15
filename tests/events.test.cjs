// node --test tests/events.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const gameSource = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(gameSource + '\nGame;', {
    RunSave: class { clear() {} },
    GAME_CONFIG: { maxActs: 3 },
    alert() {}
});
function game(hp = 30, gold = 0) {
    const state = new Game();
    state.player = { hp, maxHp: 80, gold };
    return state;
}

test('altar permanently increases maximum HP for an HP sacrifice', () => {
    const state = game(30);
    assert.equal(state.applyAltarBargain(), true);
    assert.equal(state.player.hp, 18);
    assert.equal(state.player.maxHp, 88);
});

test('altar refuses lethal sacrifice without modifying the hero', () => {
    for (const hp of [1, 12]) {
        const state = game(hp);
        assert.equal(state.applyAltarBargain(), false);
        assert.equal(state.player.hp, hp);
        assert.equal(state.player.maxHp, 80);
    }
});

test('merchant rejects unaffordable cards without spending gold', () => {
    const state = game(30, 49);
    let offers = 0;
    state.offerCard = () => { offers++; };
    const merchant = state.getEventsForAct().find(x => x.name === 'Странный торговец');
    const outcome = merchant.options[0].action();
    assert.equal(outcome, false);
    assert.equal(state.player.gold, 49);
    assert.equal(offers, 0);
});

test('merchant transfers control to the reward selection after purchase', () => {
    const state = game(30, 50);
    let offers = 0;
    state.offerCard = () => { offers++; };
    const merchant = state.getEventsForAct().find(x => x.name === 'Странный торговец');
    assert.equal(merchant.options[0].action(), 'deferred');
    assert.equal(state.player.gold, 0);
    assert.equal(offers, 1);
});

test('altar appears among normal map events', () => {
    const state = game();
    assert.ok(state.getEventsForAct().some(x => x.name === 'Алтарь Пепельной Клятвы'));
});
