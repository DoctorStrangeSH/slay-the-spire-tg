// node --test tests/events.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const gameSource = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(gameSource + '\nGame;', {
    RunSave: class { clear() {} },
    GAME_CONFIG: { maxActs: 3 },
    alert() {}
});
function game(hp = 30, gold = 0) {
    const state = new Game();
    state.player = { hp, maxHp: 80, gold };
    return state;
}

test('altar permanently increases maximum HP for an HP sacrifice', () => {
    const state = game(30);
    assert.equal(state.applyAltarBargain(), true);
    assert.equal(state.player.hp, 18);
    assert.equal(state.player.maxHp, 88);
});

test('altar refuses lethal sacrifice without modifying the hero', () => {
    for (const hp of [1, 12]) {
        const state = game(hp);
        assert.equal(state.applyAltarBargain(), false);
        assert.equal(state.player.hp, hp);
        assert.equal(state.player.maxHp, 80);
    }
});

test('merchant rejects unaffordable cards without spending gold', () => {
    const state = game(30, 49);
    let offers = 0;
    state.offerCard = () => { offers++; };
    const merchant = state.getEventsForAct().find(x => x.name === 'Странный торговец');
    const outcome = merchant.options[0].action();
    assert.equal(outcome, false);
    assert.equal(state.player.gold, 49);
    assert.equal(offers, 0);
});

test('merchant transfers control to the reward selection after purchase', () => {
    const state = game(30, 50);
    let offers = 0;
    state.offerCard = () => { offers++; };
    const merchant = state.getEventsForAct().find(x => x.name === 'Странный торговец');
    assert.equal(merchant.options[0].action(), 'deferred');
    assert.equal(state.player.gold, 0);
    assert.equal(offers, 1);
});

test('altar appears among normal map events', () => {
    const state = game();
    assert.ok(state.getEventsForAct().some(x => x.name === 'Алтарь Пепельной Клятвы'));
});

test('forbidden archive upgrades a real deck card and spends exactly 7 HP', () => {
    const state = game(28, 9);
    state.player.deck = [
        { id: 'strike', name: 'Удар', damage: 6 },
        { id: 'spell', name: 'Сила', strength: 2 }
    ];
    const event = state.getEventsForAct().find(x => x.name === 'Архив Несказанных Имен');
    assert.ok(event);
    assert.equal(event.options[0].action(), true);
    assert.equal(state.player.hp, 21);
    assert.equal(state.player.deck[0].damage, 9);
    assert.equal(state.player.deck[0].upgraded, true);
    assert.equal(state.player.gold, 9);
});

test('forbidden archive does not charge for a lethal or impossible upgrade', () => {
    const state = game(7);
    state.player.deck = [{ name: 'Закалена', damage: 10, upgraded: true }];
    const event = state.getEventsForAct().find(x => x.name === 'Архив Несказанных Имен');
    assert.equal(event.options[0].action(), false);
    assert.equal(state.player.hp, 7);
    state.player.hp = 20;
    assert.equal(event.options[0].action(), false);
    assert.equal(state.player.hp, 20);
});

test('obelisk costs max HP, caps current HP and pays a fixed amount', () => {
    const state = game(80, 10);
    const event = state.getEventsForAct().find(x => x.name === 'Расколотый Обелиск');
    assert.ok(event);
    assert.equal(event.options[0].action(), true);
    assert.equal(state.player.maxHp, 76);
    assert.equal(state.player.hp, 76);
    assert.equal(state.player.gold, 95);
});

test('obelisk refuses to reduce a critically low maximum HP', () => {
    const state = game(8, 12);
    state.player.maxHp = 10;
    const event = state.getEventsForAct().find(x => x.name === 'Расколотый Обелиск');
    assert.equal(event.options[0].action(), false);
    assert.equal(state.player.hp, 8);
    assert.equal(state.player.maxHp, 10);
    assert.equal(state.player.gold, 12);
});

test('obelisk collector is deferred until a later floor and remembers the bargain', () => {
    const state = game(60, 0);
    state.act = 1;
    state.floor = 3;
    assert.equal(state.applyObeliskBargain(), true);
    assert.equal(state.player.obeliskDebt, 'owed');
    assert.equal(state.getEventsForAct().some(event => event.name === 'Хранитель Расколотого Обелиска'), false);
    state.floor = 4;
    assert.equal(state.canEncounterObeliskCollector(), true);
    const collector = state.getEventsForAct().find(event => event.name === 'Хранитель Расколотого Обелиска');
    assert.ok(collector);
    assert.equal(collector.options[0].action(), true);
    assert.equal(state.player.maxHp, 80);
    assert.equal(state.player.gold, 25);
    assert.equal(state.player.obeliskDebt, 'redeemed');
    assert.equal(state.getEventsForAct().some(event => event.name === 'Хранитель Расколотого Обелиска'), false);
});

test('obelisk collector cannot charge without enough gold and can be refused', () => {
    const state = game(44, 0);
    state.floor = 2;
    state.applyObeliskBargain();
    state.floor = 3;
    const collector = state.getEventsForAct().find(event => event.name === 'Хранитель Расколотого Обелиска');
    state.player.gold = 59;
    const beforeHp = state.player.hp;
    assert.equal(collector.options[0].action(), false);
    assert.equal(state.player.gold, 59);
    assert.equal(state.player.hp, beforeHp);
    assert.equal(state.player.obeliskDebt, 'owed');
    assert.equal(collector.options[1].action(), true);
    assert.equal(state.player.obeliskDebt, 'forgone');
});

test('archive blood bargain unlocks a future scribe but not an immediate encounter', () => {
    const state = game(55, 0);
    state.act = 1;
    state.floor = 2;
    state.player.deck = [{ id: 'strike', name: 'Удар', damage: 6 }];
    assert.equal(state.applyForbiddenManuscript(), true);
    assert.equal(state.player.archiveDebt, 'owed');
    assert.equal(state.getEventsForAct().some(event => event.name === 'Чернильный Сборщик'), false);
    state.floor = 3;
    assert.equal(state.canEncounterArchiveScribe(), true);
    const scribe = state.getEventsForAct().find(event => event.name === 'Чернильный Сборщик');
    assert.ok(scribe);
    assert.equal(scribe.options[1].action(), true);
    assert.equal(state.player.gold, 40);
    assert.equal(state.player.bloodMarkBattles, 1);
    assert.equal(state.player.archiveDebt, 'sold');
    assert.equal(state.getEventsForAct().some(event => event.name === 'Чернильный Сборщик'), false);
});

test('scribe does not charge on failed healing and can close debt by burning', () => {
    const state = game(20, 0);
    state.player.archiveDebt = 'owed';
    state.player.archiveDebtAct = 1;
    state.player.archiveDebtFloor = 0;
    state.floor = 1;
    const scribe = state.getEventsForAct().find(event => event.name === 'Чернильный Сборщик');
    assert.equal(scribe.options[0].action(), false);
    assert.equal(state.player.gold, 0);
    assert.equal(state.player.hp, 20);
    assert.equal(state.player.archiveDebt, 'owed');
    assert.equal(scribe.options[2].action(), true);
    assert.equal(state.player.archiveDebt, 'burned');
});

test('run journal summarizes open and resolved stories without mutating run state', () => {
    const state = game(32, 50);
    state.player.pilgrimChoice = 'helped';
    state.player.obeliskDebt = 'redeemed';
    state.player.archiveDebt = 'owed';
    state.player.bloodMarkBattles = 2;
    const snapshot = JSON.stringify(state.player);
    const entries = state.getRunJournalEntries();
    assert.equal(entries.length, 4);
    assert.ok(entries.some(item => item.title === 'Паломник' && item.status === 'Ожидает продолжения'));
    assert.ok(entries.some(item => item.title === 'Долг обелиска' && item.status === 'Завершено'));
    assert.ok(entries.some(item => item.title === 'Запретный архив' && item.status === 'Ожидает продолжения'));
    assert.ok(entries.some(item => item.title === 'Кровавая метка' && item.description.includes('2 боёв')));
    assert.equal(JSON.stringify(state.player), snapshot);
});

test('run journal remains empty and safe for a legacy player without story flags', () => {
    const state = game();
    assert.equal(state.getRunJournalEntries().length, 0);
});

test('event chronicle records the decision, act, floor and resource changes', () => {
    const state = game(30, 10);
    state.act = 2;
    state.floor = 4;
    const before = state.snapshotJournalResources();
    state.player.hp -= 7;
    state.player.gold += 85;
    state.recordEventDecision({ name: 'Расколотый Обелиск' }, { text: 'Принять сделку' }, before);
    const [entry] = state.player.journalLog;
    assert.equal(entry.act, 2);
    assert.equal(entry.floor, 5);
    assert.equal(entry.event, 'Расколотый Обелиск');
    assert.equal(entry.choice, 'Принять сделку');
    assert.match(entry.outcome, /HP: -7/);
    assert.match(entry.outcome, /золото: \+85/);
});

test('event chronicle keeps last 50 decisions and accepts legacy player fields', () => {
    const state = game();
    for (let i = 0; i < 55; i++) {
        state.recordEventDecision({ name: `Событие ${i}` }, { text: 'Пройти дальше' }, state.snapshotJournalResources());
    }
    assert.equal(state.player.journalLog.length, 50);
    assert.equal(state.player.journalLog[0].event, 'Событие 5');
    assert.equal(state.player.journalLog.at(-1).outcome, 'Без немедленных изменений');
});

test('run summary reports combat, deck and story progress with deterministic score', () => {
    const state = game(45, 60);
    state.act = 3;
    state.floor = 8;
    state.player.name = 'Берсерк';
    state.player.deck = [{ name: 'Удар' }, { name: 'Защита' }];
    state.player.relics = ['relic'];
    state.player.journalLog = [{ event: 'Обелиск' }];
    state.player.battleWins = 12;
    state.player.eliteWins = 3;
    state.player.bossWins = 2;
    const summary = state.getRunSummary(true);
    assert.equal(summary.act, 3);
    assert.equal(summary.floor, 9);
    assert.equal(summary.wins, 12);
    assert.equal(summary.cards, 2);
    assert.equal(summary.relics, 1);
    assert.equal(summary.decisions, 1);
    assert.equal(summary.score, 1425);
    assert.equal(summary.rank, 'Легенда шпиля');
    assert.equal(state.getRunSummary(false).score, 925);
});

test('run summary supports old saves without any progress counters', () => {
    const state = game();
    const summary = state.getRunSummary(false);
    assert.equal(summary.wins, 0);
    assert.equal(summary.decisions, 0);
    assert.equal(summary.score, 0);
    assert.equal(summary.rank, 'Искатель судьбы');
});

test('berserk low HP boss victory unlocks only on the valid battle', () => {
    const state = game(16);
    state.player.heroId = 'berserk';
    let unlocked = 0;
    state.runHistory = { unlockChallenge: id => { assert.equal(id, 'berserk_last_breath'); unlocked++; return true; } };
    state.currentBattle = { enemy: { isBoss: true } };
    assert.equal(state.recordCombatChallenge(true), true);
    assert.equal(unlocked, 1);
    state.player.hp = 17;
    assert.equal(state.recordCombatChallenge(true), false);
    state.player.hp = 16;
    state.currentBattle.enemy.isBoss = false;
    assert.equal(state.recordCombatChallenge(true), false);
    state.currentBattle.enemy.isBoss = true;
    state.player.heroId = 'engineer';
    assert.equal(state.recordCombatChallenge(true), false);
    assert.equal(state.recordCombatChallenge(false), false);
    assert.equal(unlocked, 1);
});

test('engineer elite victory needs two surviving buildings', () => {
    const state = game(40);
    state.player.heroId = 'engineer';
    state.currentBattleIsElite = true;
    state.currentBattle = { enemy: { isBoss: false }, buildings: { buildings: [{ hp: 5 }, { hp: 0 }] } };
    const achievements = [];
    state.runHistory = { unlockChallenge: id => { achievements.push(id); return true; } };
    assert.equal(state.recordCombatChallenge(true), false);
    state.currentBattle.buildings.buildings[1].hp = 1;
    assert.equal(state.recordCombatChallenge(true), true);
    assert.equal(achievements[0], 'engineer_iron_line');
    state.currentBattleIsElite = false;
    assert.equal(state.recordCombatChallenge(true), false);
    state.currentBattleIsElite = true;
    assert.equal(state.recordCombatChallenge(false), false);
    state.player.heroId = 'psyker';
    assert.equal(state.recordCombatChallenge(true), false);
    assert.equal(achievements.length, 1);
});

test('psyker mind chain requires elite victory with active paralysis and three cards in the turn', () => {
    const state = game(40);
    state.player.heroId = 'psyker';
    state.currentBattleIsElite = true;
    state.currentBattle = {
        cardsPlayedThisTurn: 2,
        statusEffects: { enemy: { paralysis: 1 } }
    };
    const unlocks = [];
    state.runHistory = { unlockChallenge: id => { unlocks.push(id); return true; } };
    assert.equal(state.recordCombatChallenge(true), false);
    state.currentBattle.cardsPlayedThisTurn = 3;
    state.currentBattle.statusEffects.enemy.paralysis = 0;
    assert.equal(state.recordCombatChallenge(true), false);
    state.currentBattle.statusEffects.enemy.paralysis = 1;
    assert.equal(state.recordCombatChallenge(false), false);
    assert.equal(state.recordCombatChallenge(true), true);
    assert.equal(unlocks[0], 'psyker_mind_chain');
    state.currentBattleIsElite = false;
    assert.equal(state.recordCombatChallenge(true), false);
    state.player.heroId = 'berserk';
    assert.equal(state.recordCombatChallenge(true), false);
    assert.equal(unlocks.length, 1);
});
