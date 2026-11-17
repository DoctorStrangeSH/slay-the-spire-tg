// node --test tests/run-history.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/RunHistory.js'), 'utf8');
const RunHistory = vm.runInNewContext(source + '\nRunHistory;', { Date, JSON, console });

function memory() {
    const values = new Map();
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); }
    };
}
function summary(victory = false, score = 250) {
    return { victory, score, hero: 'Берсерк', act: 2, floor: 5, wins: 8 };
}

test('history keeps totals and best score across separate instances', () => {
    const storage = memory();
    const history = new RunHistory(storage);
    assert.equal(history.record(summary(false, 300), 'berserk', 'run-1'), true);
    assert.equal(history.record(summary(true, 1300), 'berserk', 'run-2'), true);
    const next = new RunHistory(storage).read();
    assert.equal(next.runs, 2);
    assert.equal(next.victories, 1);
    assert.equal(next.defeats, 1);
    assert.equal(next.bestScore, 1300);
    assert.equal(next.totalBattles, 16);
    assert.equal(next.heroes.berserk, 2);
});

test('history ignores duplicate run ids and retains last 20', () => {
    const history = new RunHistory(memory());
    assert.equal(history.record(summary(), 'berserk', 'same'), true);
    assert.equal(history.record(summary(true), 'berserk', 'same'), false);
    for (let i = 0; i < 24; i++) history.record(summary(), 'berserk', 'run-' + i);
    const data = history.read();
    assert.equal(data.runs, 25);
    assert.equal(data.recent.length, 20);
    assert.equal(data.recent[0].id, 'run-4');
    assert.equal(data.recent.at(-1).id, 'run-23');
});

test('achievements are derived from permanent totals', () => {
    const history = new RunHistory(memory());
    assert.equal(history.achievements().filter(a => a.unlocked).length, 0);
    history.record(summary(true, 1300), 'berserk', 'winner');
    const names = history.achievements().filter(a => a.unlocked).map(a => a.name);
    assert.ok(names.includes('Первый шаг'));
    assert.ok(names.includes('Покоритель шпиля'));
    assert.ok(names.includes('Легенда'));
});

test('unavailable storage does not prevent the game from ending', () => {
    const history = new RunHistory(null);
    assert.equal(history.record(summary(), 'berserk', 'a'), false);
    assert.equal(history.read().runs, 0);
});

test('hero achievements require actual victories and survive reopening the profile', () => {
    const storage = memory();
    const history = new RunHistory(storage);
    history.record(summary(false, 100), 'berserk', 'lost');
    assert.equal(history.achievements().find(a => a.name === 'Кровавый триумф').unlocked, false);
    history.record(summary(true, 500), 'berserk', 'won-berserk');
    history.record(summary(true, 500), 'engineer', 'won-engineer');
    history.record(summary(true, 500), 'psyker', 'won-psyker');
    const reopened = new RunHistory(storage);
    const data = reopened.read();
    assert.equal(data.heroes.berserk, 2);
    assert.equal(data.heroVictories.berserk, 1);
    assert.equal(data.heroVictories.engineer, 1);
    assert.equal(data.heroVictories.psyker, 1);
    assert.equal(reopened.achievements().find(a => a.name === 'Три судьбы').unlocked, true);
});

test('legacy history without per-hero victories keeps generic achievements', () => {
    const values = memory();
    values.setItem(RunHistory.KEY, JSON.stringify({
        version: 1, runs: 3, victories: 1, defeats: 2,
        bestScore: 700, bestAct: 3, totalBattles: 12,
        heroes: { berserk: 3 }, recent: []
    }));
    const history = new RunHistory(values);
    assert.equal(history.read().victories, 1);
    assert.equal(history.read().heroVictories.berserk, undefined);
    assert.equal(history.achievements().find(a => a.name === 'Кровавый триумф').unlocked, false);
});

test('berserk boss challenge is persistent and idempotent', () => {
    const storage = memory();
    const history = new RunHistory(storage);
    assert.equal(history.unlockChallenge('unknown'), false);
    assert.equal(history.unlockChallenge('berserk_last_breath'), true);
    assert.equal(history.unlockChallenge('berserk_last_breath'), false);
    const reopened = new RunHistory(storage);
    assert.equal(reopened.achievements().find(a => a.name === 'На последнем дыхании').unlocked, true);
});
