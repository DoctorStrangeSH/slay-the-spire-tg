const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(source + '\nGame;', { console, JSON });

function fixture(saveResult = true) {
    const game = Object.create(Game.prototype);
    game.player = {
        hp: 30, maxHp: 80, gold: 10,
        deck: [{ id: 'strike', damage: 6 }],
        pendingRest: true
    };
    game.runSave = { saves: 0, save() { this.saves++; return saveResult; } };
    return game;
}

test('rest choice commits its effect and clears pending rest in one checkpoint', () => {
    const game = fixture(true);
    assert.equal(game.commitRestDecision(() => {
        game.player.hp += 20;
        return true;
    }), true);
    assert.equal(game.player.hp, 50);
    assert.equal(game.player.pendingRest, false);
    assert.equal(game.runSave.saves, 1);
});

test('successful forge choice commits the upgraded card and clears pending rest', () => {
    const game = fixture(true);
    assert.equal(game.commitRestDecision(() => {
        game.player.deck[0].damage = 9;
        game.player.deck[0].upgraded = true;
        return true;
    }), true);
    assert.equal(game.player.deck[0].damage, 9);
    assert.equal(game.player.deck[0].upgraded, true);
    assert.equal(game.player.pendingRest, false);
    assert.equal(game.runSave.saves, 1);
});

test('failed rest checkpoint rolls back healing and keeps the rest pending', () => {
    const game = fixture(false);
    assert.equal(game.commitRestDecision(() => {
        game.player.hp += 20;
        return true;
    }), false);
    assert.equal(game.player.hp, 30);
    assert.equal(game.player.pendingRest, true);
    assert.equal(game.runSave.saves, 1);
});

test('failed card upgrade at rest rolls back partial deck mutation', () => {
    const game = fixture(true);
    assert.equal(game.commitRestDecision(() => {
        game.player.deck[0].damage = 99;
        game.player.gold = 0;
        return false;
    }), false);
    assert.equal(game.player.deck[0].damage, 6);
    assert.equal(game.player.gold, 10);
    assert.equal(game.player.pendingRest, true);
    assert.equal(game.runSave.saves, 0);
});

test('exception during rest action rolls back player state', () => {
    const game = fixture(true);
    assert.equal(game.commitRestDecision(() => {
        game.player.maxHp = 1;
        throw new Error('simulated forge failure');
    }), false);
    assert.equal(game.player.maxHp, 80);
    assert.equal(game.player.pendingRest, true);
    assert.equal(game.runSave.saves, 0);
});

test('rest recovery is resumed before other room handlers after loading', () => {
    const start = source.indexOf('    continueSavedGame() {');
    const end = source.indexOf('    showBattle() {', start);
    const method = source.slice(start, end);
    assert.match(method, /if \(this\.player\.pendingRest === true\)\s*\{\s*this\.rest\(\);/);
    assert.ok(source.includes('this.player.pendingRest = true;'));
    assert.ok(source.includes('if (!this.commitRestDecision(action)) return false;'));
});
