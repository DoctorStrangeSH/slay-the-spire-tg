const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const gameSource = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const historySource = readFileSync(join(__dirname, '../js/systems/RunHistory.js'), 'utf8');

function memory() {
    const values = new Map();
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }
    };
}

const storage = memory();
const RunHistory = vm.runInNewContext(historySource + '\nRunHistory;', { Date, JSON, console });
const history = new RunHistory(storage);

let resultCalls = 0;
const Game = vm.runInNewContext(gameSource + '\nGame;', {
    console,
    Date,
    Math,
    document: { getElementById() { return null; } },
    BattleFeedback: { result() { resultCalls++; } }
});

function makePlayer(heroId = 'berserk') {
    return {
        heroId,
        name: heroId === 'berserk' ? 'Берсерк' : heroId,
        hp: 30,
        maxHp: 50,
        gold: 120,
        battleWins: 8,
        eliteWins: 2,
        bossWins: 1,
        deck: [{ id: 'strike' }, { id: 'defend' }],
        relics: ['ironCrown'],
        journalLog: [{}]
    };
}

function makeGame(runId, heroId = 'berserk') {
    const game = Object.create(Game.prototype);
    game.player = makePlayer(heroId);
    game.runId = runId;
    game.act = 3;
    game.floor = 15;
    game.maxActs = 3;
    game.runHistory = history;
    game.actTransitionPending = false;
    game.runCompleted = false;
    game.runSave = { clear() {} };
    game.showMenu = () => {};
    game.showActTransition = () => {};
    return game;
}

test('defeat battle writes one durable history entry through the real game lifecycle', () => {
    storage.removeItem(RunHistory.KEY);
    resultCalls = 0;
    const game = makeGame('defeat-integration');
    game.currentBattleIsElite = false;
    game.currentBattle = {
        enemy: { hp: 10, isBoss: false, isSecretBoss: false },
        damageTakenThisBattle: 12
    };
    game.runSave.clear = () => {};

    assert.equal(game.endBattle(false), undefined);
    assert.equal(game.endBattle(false), false);
    const data = history.read();
    assert.equal(data.runs, 1);
    assert.equal(data.defeats, 1);
    assert.equal(data.victories, 0);
    assert.equal(data.recent[0].id, 'defeat-integration');
    assert.equal(data.recent[0].heroId, 'berserk');
    assert.equal(resultCalls, 1);
});

test('final act victory writes one durable victory and unlocks the correct hero achievement', () => {
    storage.removeItem(RunHistory.KEY);
    const game = makeGame('victory-integration', 'engineer');

    assert.equal(game.completeAct(), true);
    assert.equal(game.runCompleted, true);
    assert.equal(game.completeAct(), false);

    const data = history.read();
    assert.equal(data.runs, 1);
    assert.equal(data.victories, 1);
    assert.equal(data.defeats, 0);
    assert.equal(data.heroVictories.engineer, 1);
    assert.equal(history.achievements(data).find(item => item.name === 'Стальной разум').unlocked, true);
    assert.equal(data.recent[0].id, 'victory-integration');
});

test('a generated legacy run id stays stable and prevents duplicate history entries', () => {
    storage.removeItem(RunHistory.KEY);
    const game = makeGame(null);
    const first = game.recordFinishedRun(false);
    const generatedId = game.runId;
    const second = game.recordFinishedRun(false);

    assert.equal(first, true);
    assert.equal(typeof generatedId, 'string');
    assert.ok(generatedId.startsWith('legacy-'));
    assert.equal(second, false);
    assert.equal(game.runId, generatedId);
    assert.equal(history.read().runs, 1);
    assert.equal(history.read().recent[0].id, generatedId);
});

test('combat cosmetic challenges unlock only from the matching real encounter state', () => {
    storage.removeItem(RunHistory.KEY);
    const game = makeGame('cosmetic-challenge-integration', 'engineer');
    game.currentBattleIsElite = true;
    game.currentBattle = {
        enemy: { isBoss: false, isSecretBoss: false },
        damageTakenThisBattle: 0,
        buildings: { buildings: [{ hp: 10 }, { hp: 5 }] }
    };

    assert.equal(game.recordCombatChallenge(true), true);
    assert.equal(game.recordCombatChallenge(true), false);
    const data = history.read();
    assert.equal(data.challenges.flawless_elite, true);
    assert.equal(data.challenges.engineer_iron_line, true);
    assert.equal(history.availableRewardsForHero('engineer', data).some(item => item.id === 'engineer_iron_line'), true);
    assert.equal(history.availableRewardsForHero('berserk', data).some(item => item.id === 'flawless_elite'), true);
});

test('defeats and non-elite victories cannot unlock flawless-elite cosmetics', () => {
    storage.removeItem(RunHistory.KEY);
    const game = makeGame('no-cosmetic-unlock', 'psyker');
    game.currentBattleIsElite = false;
    game.currentBattle = {
        enemy: { isBoss: false, isSecretBoss: false },
        damageTakenThisBattle: 0,
        cardsPlayedThisTurn: 5,
        statusEffects: { enemy: { paralysis: 2 } }
    };

    assert.equal(game.recordCombatChallenge(false), false);
    assert.equal(game.recordCombatChallenge(true), false);
    assert.equal(history.read().challenges.flawless_elite, undefined);
    assert.equal(history.read().challenges.psyker_mind_chain, undefined);
});
