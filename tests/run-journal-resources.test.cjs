// node --test tests/run-journal-resources.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(source + '\nGame;', { Math, Date, JSON });

function gameWith(player) {
    const game = Object.create(Game.prototype);
    game.player = player;
    game.act = 1;
    game.floor = 2;
    return game;
}

test('event journal records relics gained as an immediate outcome', () => {
    const game = gameWith({
        hp: 40, maxHp: 70, gold: 20,
        deck: [{ id: 'strike' }],
        relics: [{ id: 'old-relic', name: 'Old Relic' }],
        journalLog: []
    });
    const before = game.snapshotJournalResources();
    game.player.relics.push({ id: 'new-relic', name: 'New Relic' });

    game.recordEventDecision({ name: 'Seal Keeper' }, { text: 'Accept the seal' }, before);

    assert.match(game.player.journalLog[0].outcome, /реликвий: \+1/);
    assert.equal(game.player.journalLog[0].event, 'Seal Keeper');
});

test('event journal notices deck replacement or upgrade even when deck size is unchanged', () => {
    const game = gameWith({
        hp: 40, maxHp: 70, gold: 20,
        deck: [{ id: 'strike', upgraded: false }],
        relics: [], journalLog: []
    });
    const before = game.snapshotJournalResources();
    game.player.deck[0] = { id: 'strike', upgraded: true };

    game.recordEventDecision({ name: 'Nameless Library' }, { text: 'Improve a card' }, before);

    assert.match(game.player.journalLog[0].outcome, /состав колоды изменён/);
});

test('event journal keeps legacy entries and still reports resource deltas', () => {
    const game = gameWith({
        hp: 40, maxHp: 70, gold: 20,
        deck: [{ id: 'strike' }], relics: [],
        journalLog: [{ event: 'Earlier', choice: 'Leave', outcome: 'Без изменений' }]
    });
    const before = game.snapshotJournalResources();
    game.player.gold += 15;

    game.recordEventDecision({ name: 'Fountain' }, { text: 'Take coins' }, before);

    assert.equal(game.player.journalLog.length, 2);
    assert.match(game.player.journalLog[1].outcome, /золото: \+15/);
});


test('event journal assigns a stable run-scoped id and ignores duplicate decisions', () => {
    const game = gameWith({
        hp: 40, maxHp: 70, gold: 20,
        deck: [{ id: 'strike' }], relics: [], journalLog: []
    });
    game.runId = 'run-test-1';
    const before = game.snapshotJournalResources();
    assert.equal(game.recordEventDecision({ name: 'Fountain' }, { text: 'Drink' }, before), true);
    assert.equal(game.recordEventDecision({ name: 'Fountain' }, { text: 'Drink again' }, before), false);
    assert.equal(game.player.journalLog.length, 1);
    assert.equal(game.player.journalLog[0].id, 'run-test-1:1:3:fountain');
});

test('event journal names relics gained and lost, not only their count', () => {
    const game = gameWith({
        hp: 40, maxHp: 70, gold: 20,
        deck: [{ id: 'strike' }],
        relics: [{ id: 'old-relic', name: 'Old Relic' }],
        journalLog: []
    });
    const before = game.snapshotJournalResources();
    game.player.relics = [{ id: 'new-relic', name: 'New Relic' }];
    game.recordEventDecision({ name: 'Relic Trade' }, { text: 'Trade' }, before);
    assert.match(game.player.journalLog[0].outcome, /получено: New Relic/);
    assert.match(game.player.journalLog[0].outcome, /потеряно: Old Relic/);
});


test('event journal records when a delayed story debt is resolved', () => {
    const game = gameWith({
        hp: 40, maxHp: 70, gold: 20,
        deck: [{ id: 'strike' }], relics: [],
        obeliskDebt: 'owed', journalLog: []
    });
    game.runId = 'story-run';
    const before = game.snapshotJournalResources();
    game.player.obeliskDebt = 'redeemed';
    game.recordEventDecision(
        { name: 'Хранитель Расколотого Обелиска' },
        { text: 'Выкупить силу' },
        before
    );

    assert.match(game.player.journalLog[0].outcome, /сюжет: долг обелиска погашен/);
});

test('event journal records a deferred pilgrim reunion without changing resources', () => {
    const game = gameWith({
        hp: 40, maxHp: 70, gold: 20,
        deck: [{ id: 'strike' }], relics: [],
        pilgrimChoice: 'helped', journalLog: []
    });
    game.runId = 'story-run';
    const before = game.snapshotJournalResources();
    game.player.pilgrimChoice = 'repaid';
    game.recordEventDecision(
        { name: 'Возвращение паломника' },
        { text: 'Принять благодарность' },
        before
    );

    assert.match(game.player.journalLog[0].outcome, /сюжет: долг паломника возвращён/);
});
