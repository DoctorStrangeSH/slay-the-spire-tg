// node --test tests/secret-boss-entry.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');

function loadGame(overrides = {}) {
    const context = {
        console,
        Date,
        Math: Object.assign(Object.create(Math), { random: () => 0 }),
        document: { getElementById: () => null },
        BattleFeedback: { result: result => { context.results.push(result); } },
        getBossForAct: act => ({ id: 'act-' + act, isBoss: true }),
        getVeiledBossForRun: player => ({
            id: 'last-debt-collector',
            isBoss: true,
            isSecretBoss: true,
            consequence: player.veiledMerchantDebt,
            openingBlock: player.veiledMerchantDebt === 'settled' ? 8 : 0
        }),
        BattleSystem: class {
            constructor(player, enemy) {
                this.player = player;
                this.enemy = enemy;
                this.enemyBlock = 0;
                this.block = 0;
                this.energy = 3;
                this.statusEffects = { player: { strength: 0 } };
            }
        },
        results: [],
        ...overrides
    };
    context.BattleFeedback = context.BattleFeedback || {
        result: result => { context.results.push(result); }
    };
    return { Game: vm.runInNewContext(source + '\nGame;', context), context };
}

test('act three opens the secret boss only after a recorded merchant interaction', () => {
    const { Game } = loadGame();
    const cases = ['owed', 'settled', 'defaulted', 'declined', 'purchased'];

    for (const outcome of cases) {
        const game = Object.create(Game.prototype);
        game.act = 3;
        game.player = { veiledMerchantDebt: outcome, veiledMerchantDeals: 0 };
        let encountered = null;
        game.beginEncounter = enemy => { encountered = enemy; };
        game.startBossBattle();
        assert.equal(encountered.id, 'last-debt-collector', outcome);
        assert.equal(encountered.isSecretBoss, true);
    }

    const untouched = Object.create(Game.prototype);
    untouched.act = 3;
    untouched.player = { veiledMerchantDebt: null, veiledMerchantDeals: 0 };
    let normalBoss = null;
    untouched.beginEncounter = enemy => { normalBoss = enemy; };
    untouched.startBossBattle();
    assert.equal(normalBoss.id, 'act-3');
    assert.equal(normalBoss.isSecretBoss, undefined);
});

test('merchant contact counter opens the secret boss even when no debt outcome was stored', () => {
    const { Game } = loadGame();
    const game = Object.create(Game.prototype);
    game.act = 3;
    game.player = { veiledMerchantDebt: null, veiledMerchantDeals: 1 };
    let encountered = null;
    game.beginEncounter = enemy => { encountered = enemy; };
    game.startBossBattle();
    assert.equal(encountered.isSecretBoss, true);
});

test('secret boss victory records its flag and one-time reward exactly once', () => {
    const { Game, context } = loadGame();
    const game = Object.create(Game.prototype);
    game.player = {
        heroId: 'berserk',
        hp: 45,
        gold: 20,
        battleWins: 2,
        eliteWins: 0,
        bossWins: 2,
        relics: [],
        secretBossDefeated: false
    };
    game.currentBattle = {
        resultResolved: false,
        enemy: { id: 'last-debt-collector', isBoss: true, isSecretBoss: true }
    };
    game.currentBattleIsElite = false;

    assert.equal(game.endBattle(true), undefined);
    assert.equal(game.player.secretBossDefeated, true);
    assert.equal(game.player.battleWins, 3);
    assert.equal(game.player.bossWins, 3);
    assert.equal(game.player.gold, 110);
    assert.equal(context.results.length, 1);
    assert.equal(context.results[0].victory, true);
    assert.equal(context.results[0].gold, 90);

    assert.equal(game.endBattle(true), false);
    assert.equal(game.player.battleWins, 3);
    assert.equal(game.player.bossWins, 3);
    assert.equal(game.player.gold, 110);
    assert.equal(context.results.length, 1);
});

test('merchant debt collector appears only after the deal floor and settles the debt once', () => {
    const { Game } = loadGame({ alert: () => {} });
    const game = Object.create(Game.prototype);
    game.act = 1;
    game.floor = 4;
    game.player = {
        heroId: 'berserk', hp: 60, maxHp: 80, gold: 80, deck: [], relics: [],
        veiledMerchantDebt: 'owed', veiledMerchantAct: 1, veiledMerchantFloor: 4,
        veiledMerchantDeals: 1
    };

    assert.equal(game.canEncounterVeiledMerchantCollector(), false,
        'collector must not appear on the same floor as the loan');
    assert.equal(game.getEventsForAct().some(event => event.name === 'Сборщик Долгов'), false);

    game.floor = 5;
    assert.equal(game.canEncounterVeiledMerchantCollector(), true);
    const collector = game.getEventsForAct().find(event => event.name === 'Сборщик Долгов');
    assert.ok(collector, 'collector event should be added after the loan floor');

    const settle = collector.options.find(option => option.text.includes('Закрыть договор'));
    assert.ok(settle);
    assert.equal(settle.action(), false, '80 gold is not enough to settle a 100-gold debt');
    assert.equal(game.player.gold, 80);
    assert.equal(game.player.veiledMerchantDebt, 'owed');

    game.player.gold = 100;
    assert.equal(settle.action(), true);
    assert.equal(game.player.gold, 0);
    assert.equal(game.player.veiledMerchantDebt, 'settled');
    assert.equal(game.canEncounterVeiledMerchantCollector(), false,
        'settled debt must not schedule another collector');
    assert.equal(game.getEventsForAct().some(event => event.name === 'Сборщик Долгов'), false);
});

test('merchant default is recorded as a permanent outcome for the secret boss', () => {
    const { Game } = loadGame({ alert: () => {} });
    const game = Object.create(Game.prototype);
    game.act = 2;
    game.floor = 7;
    game.player = {
        heroId: 'engineer', hp: 55, maxHp: 80, gold: 80, deck: [], relics: [],
        veiledMerchantDebt: 'owed', veiledMerchantAct: 1, veiledMerchantFloor: 12,
        veiledMerchantDeals: 1
    };

    const collector = game.getEventsForAct().find(event => event.name === 'Сборщик Долгов');
    assert.ok(collector);
    const decline = collector.options.find(option => option.text.includes('Отказаться платить'));
    assert.ok(decline);
    assert.equal(decline.action(), true);
    assert.equal(game.player.veiledMerchantDebt, 'defaulted');
    assert.equal(game.canEncounterVeiledMerchantCollector(), false);
    let encountered = null;
    game.act = 3;
    game.beginEncounter = enemy => { encountered = enemy; };
    game.startBossBattle();
    assert.equal(encountered.isSecretBoss, true);
    assert.equal(encountered.consequence, 'defaulted');
});


test('secret boss opening guard is applied only for the settled merchant outcome', () => {
    const { Game } = loadGame();
    const cases = [
        ['owed', 0],
        ['settled', 8],
        ['defaulted', 0],
        ['declined', 0],
        ['purchased', 0]
    ];

    for (const [outcome, expectedBlock] of cases) {
        const game = Object.create(Game.prototype);
        game.player = {
            hp: 60,
            maxHp: 80,
            deck: [],
            relics: [],
            veiledMerchantDebt: outcome,
            blessingBattles: 0,
            curseBattles: 0,
            oathBattles: 0,
            ashBattles: 0,
            exhaustionBattles: 0,
            bloodMarkBattles: 0
        };
        game.showBattle = () => {};
        const enemy = {
            id: 'last-debt-collector',
            isBoss: true,
            isSecretBoss: true,
            openingBlock: outcome === 'settled' ? 8 : 0
        };

        game.beginEncounter(enemy);
        assert.equal(game.currentBattle.enemyBlock, expectedBlock, outcome);
    }
});
