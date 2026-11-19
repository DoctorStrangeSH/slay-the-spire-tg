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
