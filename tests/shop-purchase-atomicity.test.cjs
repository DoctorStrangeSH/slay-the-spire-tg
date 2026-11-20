// node --test tests/shop-purchase-atomicity.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const gameSource = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(gameSource + '\nGame;');
const game = Object.create(Game.prototype);

function fixture(saveResult = true) {
    const player = { gold: 120, hp: 40, maxHp: 100, deck: [{ id: 'strike' }] };
    const visit = { purchased: [] };
    const instance = Object.create(Game.prototype);
    instance.player = player;
    instance.runSave = { save: () => saveResult };
    return { instance, player, visit };
}

test('shop purchase commits resource and reward only after checkpoint succeeds', () => {
    const { instance, player, visit } = fixture(true);
    const card = { id: 'guard' };
    const result = instance.commitShopPurchase(visit, 'card:guard', 30,
        () => { player.deck.push(card); return true; },
        () => { player.deck.splice(player.deck.indexOf(card), 1); });

    assert.equal(result, true);
    assert.equal(player.gold, 90);
    assert.deepEqual(player.deck.map(item => item.id), ['strike', 'guard']);
    assert.deepEqual(visit.purchased, ['card:guard']);
});

test('failed checkpoint rolls back gold, deck mutation and purchase marker', () => {
    const { instance, player, visit } = fixture(false);
    const card = { id: 'guard' };
    const result = instance.commitShopPurchase(visit, 'card:guard', 30,
        () => { player.deck.push(card); return true; },
        () => { player.deck.splice(player.deck.indexOf(card), 1); });

    assert.equal(result, false);
    assert.equal(player.gold, 120);
    assert.deepEqual(player.deck.map(item => item.id), ['strike']);
    assert.deepEqual(visit.purchased, []);
});

test('failed apply is rolled back and does not spend gold', () => {
    const { instance, player, visit } = fixture(true);
    const result = instance.commitShopPurchase(visit, 'heal', 35,
        () => { player.hp = 55; return false; },
        () => { player.hp = 40; });

    assert.equal(result, false);
    assert.equal(player.hp, 40);
    assert.equal(player.gold, 120);
    assert.deepEqual(visit.purchased, []);
});

test('duplicate purchase and insufficient balance are rejected before mutation', () => {
    const { instance, player, visit } = fixture(true);
    visit.purchased.push('heal');
    let applied = false;
    assert.equal(instance.commitShopPurchase(visit, 'heal', 10,
        () => { applied = true; return true; }, () => {}), false);
    assert.equal(instance.commitShopPurchase(visit, 'expensive', 999,
        () => { applied = true; return true; }, () => {}), false);
    assert.equal(applied, false);
    assert.equal(player.gold, 120);
});

test('all four shop operations use the shared atomic purchase path', () => {
    const shopSource = gameSource.slice(gameSource.indexOf('    openShop() {'),
        gameSource.indexOf('    continueJourney()', gameSource.indexOf('    openShop() {')));
    assert.equal((shopSource.match(/commitShopPurchase\(/g) || []).length, 4);
    assert.doesNotMatch(shopSource, /recordPurchase/);
    assert.match(shopSource, /cardBefore/);
    assert.match(shopSource, /hpBefore/);
    assert.match(shopSource, /removedCard/);
});
