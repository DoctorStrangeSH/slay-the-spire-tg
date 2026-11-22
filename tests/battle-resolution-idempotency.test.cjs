// node --test tests/battle-resolution-idempotency.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
let resultCalls = 0;
let relicRoll = null;
const context = {
    document: { getElementById() { return null; } },
    BattleFeedback: { result() { resultCalls++; } },
    chooseRelic() { return relicRoll; },
    Math,
    Date,
    console
};
const Game = vm.runInNewContext(source + '\nGame;', context);

function makeGame() {
    const game = Object.create(Game.prototype);
    game.player = { gold: 0, battleWins: 0, eliteWins: 0, bossWins: 0, relics: [] };
    game.currentBattleIsElite = false;
    game.currentBattle = {
        enemy: { hp: 0, isBoss: false, isSecretBoss: false },
        damageTakenThisBattle: 0
    };
    game.runSave = { clear() {} };
    game.recordCombatChallenge = () => false;
    game.recordFinishedRun = () => true;
    return game;
}

test('victory rewards and counters are granted once even after result modal is gone', () => {
    resultCalls = 0;
    const game = makeGame();
    game.endBattle(true);
    const gold = game.player.gold;
    assert.ok(gold > 0);
    assert.equal(game.player.battleWins, 1);
    assert.equal(resultCalls, 1);

    // Simulate the UI modal being dismissed: a second callback must still be inert.
    game.endBattle(true);
    assert.equal(game.player.gold, gold);
    assert.equal(game.player.battleWins, 1);
    assert.equal(resultCalls, 1);
    assert.equal(game.currentBattle.resultResolved, true);
});

test('defeat history and result presentation are recorded once', () => {
    resultCalls = 0;
    const game = makeGame();
    let records = 0;
    let clears = 0;
    game.recordFinishedRun = () => { records++; return true; };
    game.runSave.clear = () => { clears++; };
    game.endBattle(false);
    game.endBattle(false);
    assert.equal(records, 1);
    assert.equal(clears, 1);
    assert.equal(resultCalls, 1);
    assert.equal(game.currentBattle.resultResolved, true);
});

test('a separate battle can resolve normally after the previous battle ended', () => {
    resultCalls = 0;
    const game = makeGame();
    game.endBattle(true);
    const previousBattle = game.currentBattle;
    game.currentBattle = { enemy: { hp: 0, isBoss: false, isSecretBoss: false } };
    game.endBattle(true);
    assert.equal(previousBattle.resultResolved, true);
    assert.equal(game.currentBattle.resultResolved, true);
    assert.equal(game.player.battleWins, 2);
    assert.equal(resultCalls, 2);
});

test('elite victory grants one relic and one elite reward even if resolved twice', () => {
    resultCalls = 0;
    relicRoll = { id: 'ironCrown', name: 'Железная корона', emoji: '👑', description: 'Тест' };
    const game = makeGame();
    game.currentBattleIsElite = true;

    game.endBattle(true);
    game.endBattle(true);

    assert.equal(game.player.eliteWins, 1);
    assert.equal(game.player.battleWins, 1);
    assert.equal(game.player.relics.length, 1);
    assert.equal(game.player.relics[0], 'ironCrown');
    assert.ok(game.player.gold >= 25);
    assert.equal(resultCalls, 1);
    relicRoll = null;
});

test('elite victory grants fallback gold when the relic pool is exhausted', () => {
    resultCalls = 0;
    relicRoll = null;
    const game = makeGame();
    game.currentBattleIsElite = true;

    game.endBattle(true);

    assert.equal(game.player.eliteWins, 1);
    assert.equal(game.player.relics.length, 0);
    assert.ok(game.player.gold >= 65);
    assert.equal(resultCalls, 1);
});
