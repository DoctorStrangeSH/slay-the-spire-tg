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
            consequence: player.veiledMerchantDebt
        }),
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
