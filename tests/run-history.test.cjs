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
    // The first run has left the visible 20-entry history, but must never count twice.
    assert.equal(history.record(summary(true, 9999), 'berserk', 'same'), false);
    assert.equal(history.read().runs, 25);
    assert.ok(history.read().recordedRunIds.includes('same'));
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

test('engineer iron line challenge persists and rejects repeated grants', () => {
    const storage = memory();
    const history = new RunHistory(storage);
    assert.equal(history.unlockChallenge('engineer_iron_line'), true);
    assert.equal(history.unlockChallenge('engineer_iron_line'), false);
    const reopened = new RunHistory(storage);
    assert.equal(reopened.achievements().find(a => a.name === 'Железная линия').unlocked, true);
});

test('psyker mind chain challenge stays unlocked after a new session', () => {
    const storage = memory();
    const history = new RunHistory(storage);
    assert.equal(history.unlockChallenge('psyker_mind_chain'), true);
    assert.equal(history.unlockChallenge('psyker_mind_chain'), false);
    assert.equal(new RunHistory(storage).achievements()
        .find(a => a.name === 'Разрыв сознания').unlocked, true);
});

test('achievement hall categories cover all achievements without duplicates', () => {
    const history = new RunHistory(memory());
    const list = history.achievements();
    assert.equal(list.length, 13);
    const tally = { general: 0, berserk: 0, engineer: 0, psyker: 0 };
    for (const item of list) {
        assert.ok(Object.hasOwn(tally, item.category));
        tally[item.category]++;
    }
    assert.deepEqual(tally, { general: 7, berserk: 2, engineer: 2, psyker: 2 });
});

test('hero title rewards unlock only for their matching challenges', () => {
    const history = new RunHistory(memory());
    assert.equal(history.rewardForHero('berserk'), null);
    assert.equal(history.rewardForHero('unknown'), null);
    history.unlockChallenge('engineer_iron_line');
    assert.equal(history.rewardForHero('berserk'), null);
    assert.equal(history.rewardForHero('engineer').title, 'Мастер механизмов');
    assert.equal(history.rewardForHero('psyker'), null);
    const achievement = history.achievements().find(item => item.name === 'Железная линия');
    assert.equal(achievement.reward, 'Титул «Мастер механизмов» и металлический стиль карт');
    assert.equal(achievement.unlocked, true);
});

test('hero cosmetic card skins are tied to completed trials', () => {
    const history = new RunHistory(memory());
    for (const id of ['berserk', 'engineer', 'psyker']) {
        assert.equal(history.rewardForHero(id), null);
    }
    history.unlockChallenge('berserk_last_breath');
    assert.equal(history.rewardForHero('berserk').skin, 'berserk');
    assert.equal(history.rewardForHero('engineer'), null);
    history.unlockChallenge('engineer_iron_line');
    assert.equal(history.rewardForHero('engineer').skin, 'engineer');
    history.unlockChallenge('psyker_mind_chain');
    assert.equal(history.rewardForHero('psyker').skin, 'psyker');
});


test('flawless elite achievement is permanent and unlocks only once', () => {
    const storage = memory();
    const history = new RunHistory(storage);
    assert.equal(history.unlockChallenge('flawless_elite'), true);
    assert.equal(history.unlockChallenge('flawless_elite'), false);
    const reopened = new RunHistory(storage);
    const achievement = reopened.achievements().find(item => item.name === 'Без единой царапины');
    assert.equal(achievement.unlocked, true);
    assert.equal(achievement.category, 'general');
});

test('achievement hall includes the flawless elite trial without changing legacy totals', () => {
    const history = new RunHistory(memory());
    const achievements = history.achievements();
    assert.equal(achievements.length, 13);
    assert.equal(achievements.find(item => item.name === 'Без единой царапины').unlocked, false);
});


test('flawless elite trial grants a universal title and obsidian card skin', () => {
    const storage = memory();
    const history = new RunHistory(storage);
    assert.equal(history.rewardForHero('berserk'), null);
    assert.equal(history.rewardForHero('engineer'), null);
    assert.equal(history.rewardForHero('psyker'), null);

    history.unlockChallenge('flawless_elite');
    for (const heroId of ['berserk', 'engineer', 'psyker']) {
        const equipped = history.rewardForHero(heroId);
        assert.equal(equipped.title, 'Непоколебимый');
        assert.equal(equipped.sigil, '✧');
        assert.equal(equipped.skin, 'flawless');
    }
    const achievement = history.achievements().find(item => item.name === 'Без единой царапины');
    assert.equal(achievement.reward, 'Титул «Непоколебимый» и обсидиановый стиль карт');
});

test('class mastery reward takes priority over the universal flawless cosmetic', () => {
    const history = new RunHistory(memory());
    history.unlockChallenge('flawless_elite');
    history.unlockChallenge('engineer_iron_line');
    assert.equal(history.rewardForHero('engineer').title, 'Мастер механизмов');
    assert.equal(history.rewardForHero('engineer').skin, 'engineer');
    assert.equal(history.rewardForHero('berserk').skin, 'flawless');
});


test('cosmetic collection lists only rewards actually unlocked for each hero', () => {
    const history = new RunHistory(memory());
    assert.equal(history.availableRewardsForHero('berserk').length, 0);
    history.unlockChallenge('flawless_elite');
    assert.equal(history.availableRewardsForHero('berserk')[0].id, 'flawless_elite');
    history.unlockChallenge('berserk_last_breath');
    const berserkRewards = history.availableRewardsForHero('berserk');
    assert.equal(berserkRewards.length, 2);
    assert.equal(berserkRewards[0].id, 'berserk_last_breath');
    assert.equal(berserkRewards[1].id, 'flawless_elite');
    assert.equal(history.availableRewardsForHero('engineer')[0].id, 'flawless_elite');
});

test('equipped cosmetic choice persists across history instances and controls the active skin', () => {
    const storage = memory();
    const history = new RunHistory(storage);
    history.unlockChallenge('flawless_elite');
    history.unlockChallenge('berserk_last_breath');
    assert.equal(history.rewardForHero('berserk').skin, 'berserk');
    assert.equal(history.equipReward('berserk', 'flawless_elite'), true);

    const reopened = new RunHistory(storage);
    assert.equal(reopened.rewardForHero('berserk').title, 'Непоколебимый');
    assert.equal(reopened.rewardForHero('berserk').skin, 'flawless');
    assert.equal(reopened.rewardForHero('engineer').skin, 'flawless');
});

test('cosmetic collection rejects locked rewards and invalid hero ids', () => {
    const history = new RunHistory(memory());
    assert.equal(history.equipReward('berserk', 'flawless_elite'), false);
    assert.equal(history.equipReward('unknown', 'flawless_elite'), false);
    history.unlockChallenge('flawless_elite');
    assert.equal(history.equipReward('unknown', 'flawless_elite'), false);
    assert.equal(history.equipReward('berserk', 'not-a-reward'), false);
    assert.equal(history.rewardForHero('berserk').skin, 'flawless');
});

test('legacy history without cosmetic selections keeps its default reward priority', () => {
    const storage = memory();
    const legacy = {
        version: 1, runs: 0, victories: 0, defeats: 0, bestScore: 0,
        bestAct: 0, totalBattles: 0, heroes: {}, heroVictories: {},
        challenges: { berserk_last_breath: true, flawless_elite: true }, recent: []
    };
    storage.setItem(RunHistory.KEY, JSON.stringify(legacy));
    const history = new RunHistory(storage);
    assert.equal(history.rewardForHero('berserk').skin, 'berserk');
    assert.equal(JSON.stringify(history.read().selectedRewards), '{}');
});


test('cosmetic gallery reveals every reward, its condition and unlock state', () => {
    const history = new RunHistory(memory());
    const initial = history.cosmeticCollection();
    assert.equal(initial.length, 4);
    assert.equal(initial.filter(item => item.unlocked).length, 0);
    assert.equal(initial.find(item => item.id === 'flawless_elite').requirement,
        'Победить элиту, не потеряв HP за весь бой');

    history.unlockChallenge('flawless_elite');
    const unlocked = history.cosmeticCollection();
    const flawless = unlocked.find(item => item.id === 'flawless_elite');
    assert.equal(flawless.unlocked, true);
    assert.equal(flawless.equipped, true);
    assert.equal(unlocked.find(item => item.id === 'berserk_last_breath').unlocked, false);
});

test('cosmetic gallery marks the selected class reward as equipped', () => {
    const history = new RunHistory(memory());
    history.unlockChallenge('flawless_elite');
    history.unlockChallenge('engineer_iron_line');
    assert.equal(history.equipReward('engineer', 'engineer_iron_line'), true);
    const gallery = history.cosmeticCollection();
    assert.equal(gallery.find(item => item.id === 'engineer_iron_line').equipped, true);
    assert.equal(gallery.find(item => item.id === 'flawless_elite').equipped, true);
    assert.equal(gallery.find(item => item.id === 'psyker_mind_chain').unlocked, false);
});


test('malformed persisted counters and profile maps are normalized before recording', () => {
    const storage = memory();
    storage.setItem(RunHistory.KEY, JSON.stringify({
        version: 1,
        runs: 'not-a-number',
        victories: '7',
        defeats: -4,
        bestScore: null,
        bestAct: {},
        totalBattles: '12',
        heroes: { berserk: '3', engineer: 'broken' },
        heroVictories: { berserk: true, engineer: 2 },
        challenges: { berserk_last_breath: 'yes', unknown_challenge: true },
        selectedRewards: { berserk: 'not-a-reward', engineer: 'engineer_iron_line', unknown: 'flawless_elite' },
        recent: [null, 'bad-entry', { id: 'legacy-run', victory: 1, hero: 42, score: 'bad' }]
    }));
    const history = new RunHistory(storage);
    const before = history.read();
    assert.equal(before.runs, 0);
    assert.equal(before.victories, 7);
    assert.equal(before.defeats, 0);
    assert.equal(before.bestScore, 0);
    assert.equal(before.totalBattles, 12);
    assert.equal(before.heroes.berserk, 3);
    assert.equal(before.heroes.engineer, 0);
    assert.equal(before.heroVictories.berserk, 1);
    assert.equal(before.challenges.berserk_last_breath, undefined);
    assert.equal(before.challenges.unknown_challenge, undefined);
    assert.equal(before.selectedRewards.berserk, undefined);
    assert.equal(before.selectedRewards.engineer, 'engineer_iron_line');
    assert.equal(before.recent.length, 1);
    assert.equal(before.recent[0].victory, false);
    assert.equal(before.recent[0].hero, 'Герой');

    assert.equal(history.record(summary(false, 100), 'berserk', 'after-corruption'), true);
    const after = history.read();
    assert.equal(after.runs, 1);
    assert.equal(after.victories, 7);
    assert.equal(after.defeats, 1);
    assert.equal(after.totalBattles, 20);
});

test('history, challenge and cosmetic writes fail safely when storage becomes unavailable', () => {
    const denied = {
        getItem() { return null; },
        setItem() { throw new Error('quota exceeded'); }
    };
    const history = new RunHistory(denied);
    assert.equal(history.record(summary(true), 'berserk', 'cannot-save'), false);
    assert.equal(history.unlockChallenge('berserk_last_breath'), false);
    assert.equal(history.equipReward('berserk', 'berserk_last_breath'), false);
    assert.equal(history.read().runs, 0);
});
