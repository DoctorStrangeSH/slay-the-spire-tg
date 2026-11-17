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

test('forbidden archive upgrades a real deck card and spends exactly 7 HP', () => {
    const state = game(28, 9);
    state.player.deck = [
        { id: 'strike', name: 'Удар', damage: 6 },
        { id: 'spell', name: 'Сила', strength: 2 }
    ];
    const event = state.getEventsForAct().find(x => x.name === 'Архив Несказанных Имен');
    assert.ok(event);
    assert.equal(event.options[0].action(), true);
    assert.equal(state.player.hp, 21);
    assert.equal(state.player.deck[0].damage, 9);
    assert.equal(state.player.deck[0].upgraded, true);
    assert.equal(state.player.gold, 9);
});

test('forbidden archive does not charge for a lethal or impossible upgrade', () => {
    const state = game(7);
    state.player.deck = [{ name: 'Закалена', damage: 10, upgraded: true }];
    const event = state.getEventsForAct().find(x => x.name === 'Архив Несказанных Имен');
    assert.equal(event.options[0].action(), false);
    assert.equal(state.player.hp, 7);
    state.player.hp = 20;
    assert.equal(event.options[0].action(), false);
    assert.equal(state.player.hp, 20);
});

test('obelisk costs max HP, caps current HP and pays a fixed amount', () => {
    const state = game(80, 10);
    const event = state.getEventsForAct().find(x => x.name === 'Расколотый Обелиск');
    assert.ok(event);
    assert.equal(event.options[0].action(), true);
    assert.equal(state.player.maxHp, 76);
    assert.equal(state.player.hp, 76);
    assert.equal(state.player.gold, 95);
});

test('obelisk refuses to reduce a critically low maximum HP', () => {
    const state = game(8, 12);
    state.player.maxHp = 10;
    const event = state.getEventsForAct().find(x => x.name === 'Расколотый Обелиск');
    assert.equal(event.options[0].action(), false);
    assert.equal(state.player.hp, 8);
    assert.equal(state.player.maxHp, 10);
    assert.equal(state.player.gold, 12);
});
