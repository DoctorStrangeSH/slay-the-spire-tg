// node --test tests/run-completion.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(source + '\nGame;', { console, Math, Date });

function makeGame(act = 3) {
    const game = Object.create(Game.prototype);
    game.act = act;
    game.maxActs = 3;
    game.floor = 15;
    game.actTransitionPending = false;
    game.runCompleted = false;
    game.calls = [];
    game.recordFinishedRun = victory => {
        game.calls.push(['recordFinishedRun', victory]);
        return true;
    };
    game.runSave = {
        clear() { game.calls.push(['clearCheckpoint']); }
    };
    game.showMenu = () => game.calls.push(['showMenu']);
    game.showActTransition = (completedAct, victory) =>
        game.calls.push(['showActTransition', completedAct, victory]);
    game.generateNewMap = () => game.calls.push(['generateNewMap', game.act]);
    game.showMap = () => game.calls.push(['showMap']);
    return game;
}

test('final act completion records one victory, clears checkpoint and shows the final result', () => {
    const game = makeGame(3);

    assert.equal(game.completeAct(), true);
    assert.equal(game.runCompleted, true);
    assert.deepEqual(game.calls, [
        ['recordFinishedRun', true],
        ['clearCheckpoint'],
        ['showMenu'],
        ['showActTransition', 3, true]
    ]);

    assert.equal(game.completeAct(), false);
    assert.equal(game.calls.length, 4, 'a completed run must not be recorded or presented twice');
});

test('intermediate act completion advances the campaign without recording a final victory', () => {
    const game = makeGame(1);

    assert.equal(game.completeAct(), true);
    assert.equal(game.act, 2);
    assert.equal(game.floor, 0);
    assert.equal(game.runCompleted, false);
    assert.equal(game.actTransitionPending, true);
    assert.deepEqual(game.calls, [
        ['generateNewMap', 2],
        ['showMap'],
        ['showActTransition', 1, false]
    ]);
    assert.equal(game.completeAct(), false, 'the same act transition cannot be started twice');
    assert.equal(game.calls.length, 3);
});

test('a completed run or an active act transition rejects duplicate completion callbacks', () => {
    const completed = makeGame(3);
    completed.runCompleted = true;
    assert.equal(completed.completeAct(), false);
    assert.deepEqual(completed.calls, []);

    const transitioning = makeGame(2);
    transitioning.actTransitionPending = true;
    assert.equal(transitioning.completeAct(), false);
    assert.deepEqual(transitioning.calls, []);
});
