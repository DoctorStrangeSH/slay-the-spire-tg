const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(source + '\nGame;', {
    console, Math, Date, JSON,
    RunSave: class { clear() {} },
    GAME_CONFIG: { maxActs: 3 },
    alert() {}
});

function fixture(saveResult = true) {
    const game = Object.create(Game.prototype);
    game.player = {
        hp: 30, maxHp: 80, gold: 40,
        deck: [{ id: 'strike', damage: 6 }],
        relics: [], journalLog: [],
        pendingEvent: { id: 'run:1:3:тестовое-событие', name: 'Тестовое событие', nodeId: 'room-1' }
    };
    game.runId = 'run'; game.act = 1; game.floor = 2; game.currentNodeId = 'room-1';
    game.offeredCards = [];
    game.runSave = { saves: 0, save() { this.saves++; return saveResult; } };
    return game;
}

const event = { name: 'Тестовое событие' };

test('event choice commits its effects, journal entry and pending-event clear together', () => {
    const game = fixture(true);
    const option = {
        text: 'Принять награду',
        action() { game.player.gold += 25; return true; }
    };

    assert.equal(game.commitEventDecision(event, option, game.player.pendingEvent.id), true);
    assert.equal(game.player.gold, 65);
    assert.equal(game.player.pendingEvent, null);
    assert.equal(game.player.journalLog.length, 1);
    assert.match(game.player.journalLog[0].outcome, /золото: \+25/);
    assert.equal(game.runSave.saves, 1);
});

test('failed checkpoint rolls back resources, journal and pending decision', () => {
    const game = fixture(false);
    const option = {
        text: 'Принять награду',
        action() { game.player.gold += 25; game.player.hp -= 5; return true; }
    };
    const pendingBefore = { ...game.player.pendingEvent };

    assert.equal(game.commitEventDecision(event, option, pendingBefore.id), false);
    assert.equal(game.player.gold, 40);
    assert.equal(game.player.hp, 30);
    assert.deepEqual(game.player.journalLog, []);
    assert.deepEqual(game.player.pendingEvent, pendingBefore);
    assert.equal(game.runSave.saves, 1);
});

test('an action that declines after partial mutation is rolled back', () => {
    const game = fixture(true);
    const option = {
        text: 'Отказ',
        action() { game.player.gold -= 20; game.player.hp -= 3; return false; }
    };

    assert.equal(game.commitEventDecision(event, option, game.player.pendingEvent.id), false);
    assert.equal(game.player.gold, 40);
    assert.equal(game.player.hp, 30);
    assert.deepEqual(game.player.journalLog, []);
    assert.equal(game.runSave.saves, 0);
});

test('thrown event action is rolled back without recording a decision', () => {
    const game = fixture(true);
    const option = {
        text: 'Сломанное действие',
        action() { game.player.maxHp = 1; throw new Error('simulated failure'); }
    };

    assert.equal(game.commitEventDecision(event, option, game.player.pendingEvent.id), false);
    assert.equal(game.player.maxHp, 80);
    assert.deepEqual(game.player.journalLog, []);
    assert.equal(game.runSave.saves, 0);
});

test('deferred event rewards are committed only after event checkpoint succeeds', () => {
    const game = fixture(true);
    const offered = [{ id: 'reward-card' }];
    const option = {
        text: 'Выбрать награду позже',
        action() { game.offeredCards = offered; game.player.gold -= 10; return 'deferred'; }
    };

    assert.equal(game.commitEventDecision(event, option, game.player.pendingEvent.id), 'deferred');
    assert.equal(game.player.gold, 30);
    assert.equal(game.offeredCards[0].id, 'reward-card');
    assert.equal(game.player.pendingEvent, null);
    assert.equal(game.player.journalLog.length, 1);
});

test('duplicate event journal identity is rejected without applying a second reward', () => {
    const game = fixture(true);
    const option = {
        text: 'Повтор',
        action() { game.player.gold += 99; return true; }
    };
    const id = game.getPendingEventDecisionId(event);
    game.player.journalLog.push({ id });

    assert.equal(game.commitEventDecision(event, option, id), false);
    assert.equal(game.player.gold, 40);
    assert.equal(game.player.journalLog.length, 1);
    assert.equal(game.runSave.saves, 0);
});
