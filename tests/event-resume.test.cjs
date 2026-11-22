const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(source + '\nGame;', {
    console, Math, Date, getStarterDeckForHero: () => []
});
function makeGame() {
    const event = { name: 'Испытание памяти', rare: false, description: 'Проверка сохранения события', options: [{ text: 'Принять', action: () => true }] };
    const game = Object.create(Game.prototype);
    game.player = { eventHistory: [], journalLog: [], pendingEvent: null };
    game.runId = 'test-run'; game.act = 1; game.floor = 2; game.currentNodeId = 'floor_2_node_1';
    game.runSave = { saves: 0, save() { this.saves++; return true; } };
    game.getEligibleRareEvents = () => []; game.getRareEventChance = () => 0;
    game.getEventsForAct = () => [event]; game.continueJourney = () => {};
    return { game, event };
}
test('selected event is checkpointed before modal is shown', () => {
    const { game, event } = makeGame(); let shown = null;
    game.showEventModal = (selected, id) => { shown = { selected, id }; };
    game.triggerEvent();
    assert.equal(game.player.pendingEvent.name, event.name);
    assert.equal(game.player.pendingEvent.nodeId, game.currentNodeId);
    assert.equal(game.player.pendingEvent.id, 'test-run:1:3:испытание-памяти');
    assert.equal(shown.selected, event); assert.equal(shown.id, game.player.pendingEvent.id);
    assert.equal(game.runSave.saves, 1);
});
test('pending event resumes by stable identity instead of rerolling', () => {
    const { game, event } = makeGame();
    game.player.pendingEvent = { id: 'test-run:1:3:испытание-памяти', name: event.name, rare: false, nodeId: game.currentNodeId };
    let shown = null; game.showEventModal = (selected, id) => { shown = { selected, id }; };
    assert.equal(game.resumePendingEvent(), true);
    assert.equal(shown.selected, event); assert.equal(shown.id, game.player.pendingEvent.id);
});
test('pending event cannot resume from a different room', () => {
    const { game } = makeGame();
    game.player.pendingEvent = { id: 'test-run:1:3:испытание-памяти', name: 'Испытание памяти', rare: false, nodeId: 'floor_2_node_1' };
    let shown = false; game.showEventModal = () => { shown = true; };
    game.currentNodeId = 'floor_3_node_0';
    assert.equal(game.resumePendingEvent(), false); assert.equal(shown, false);
});
test('new run clears any unresolved event decision', () => {
    const { game } = makeGame();
    game.player.maxHp = 60; game.player.heroId = 'berserk';
    game.player.pendingEvent = { id: 'stale', name: 'Старое событие', nodeId: 'old-room' };
    game.runSave.clear = () => {}; game.generateNewMap = () => {}; game.showMap = () => {};
    game.startNewGame(); assert.equal(game.player.pendingEvent, null);
});

test('event pool does not repeat any eligible event within the same act until exhausted', () => {
    const { game } = makeGame();
    const events = ['Событие A', 'Событие B', 'Событие C', 'Событие D']
        .map(name => ({ name, rare: false, options: [{ text: 'Уйти', action: () => true }] }));
    game.getEventsForAct = () => events;
    game.showEventModal = () => {};
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        for (const expected of ['Событие A', 'Событие B', 'Событие C', 'Событие D']) {
            game.triggerEvent();
            assert.equal(game.player.pendingEvent.name, expected);
            game.player.pendingEvent = null;
        }
        assert.deepEqual(Array.from(game.player.eventHistory), events.map(event => event.name));
        game.triggerEvent();
        assert.equal(game.player.pendingEvent.name, 'Событие A',
            'once every eligible event was seen, the pool may repeat rather than softlock');
    } finally {
        Math.random = originalRandom;
    }
});

test('event history resets automatically when a new act begins', () => {
    const { game } = makeGame();
    game.player.eventHistory = ['Событие старого акта', 'Событие A'];
    game.player.eventHistoryAct = 1;
    game.act = 2;
    const event = { name: 'Событие A', rare: false, options: [{ text: 'Уйти', action: () => true }] };
    game.getEventsForAct = () => [event];
    game.showEventModal = () => {};
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        game.triggerEvent();
    } finally {
        Math.random = originalRandom;
    }
    assert.equal(game.player.pendingEvent.name, 'Событие A');
    assert.equal(game.player.eventHistoryAct, 2);
    assert.deepEqual(Array.from(game.player.eventHistory), ['Событие A']);
});
