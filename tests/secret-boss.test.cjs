// node --test tests/secret-boss.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/data/enemies.js',
    'js/systems/battle/BattleCore.js',
    'js/systems/battle/BattleTurn.js'
].map(path => readFileSync(join(root, path), 'utf8')).join('\n');
const api = vm.runInNewContext(source + '\n({ getVeiledBossForRun, BattleCore, BattleTurn })', { Math });
const { getVeiledBossForRun, BattleCore, BattleTurn } = api;

function makeBattle(enemy, intent = 'attack') {
    const player = { hp: 100, maxHp: 100, relics: [] };
    return {
        player, enemy, turn: 1, block: 0, enemyBlock: 0, enemyIntent: intent,
        hand: [], discardPile: [],
        statusEffects: {
            player: { poison: 0, vulnerable: 0, thorns: 0, weak: 0 },
            enemy: { paralysis: 0, bleed: 0, weak: 0, strength: 0, vulnerable: 0 }
        },
        hasPower() { return false; },
        isEnemyParalyzed() { return this.statusEffects.enemy.paralysis > 0; },
        startTurn() { this.started = true; },
        takeDamage(amount) { this.player.hp = Math.max(0, this.player.hp - amount); }
    };
}
const effects = { decreaseStatusEffects() {} };

test('secret boss profile reflects every merchant outcome', () => {
    const cases = [
        ['owed', 390, 27],
        ['settled', 330, 22],
        ['defaulted', 430, 30],
        ['declined', 360, 25],
        ['purchased', 380, 26]
    ];
    for (const [outcome, hp, damage] of cases) {
        const boss = getVeiledBossForRun({ veiledMerchantDebt: outcome, veiledMerchantDeals: 1 });
        assert.equal(boss.maxHp, hp);
        assert.equal(boss.hp, hp);
        assert.equal(boss.damage, damage);
        assert.equal(boss.merchantConsequence, outcome);
        assert.equal(boss.isSecretBoss, true);
        assert.equal(boss.phase, 1);
    }
});

test('secret boss enters phase two at two thirds health and immediately changes intent', () => {
    const boss = getVeiledBossForRun({ veiledMerchantDebt: 'purchased' });
    boss.hp = Math.floor(boss.maxHp * 0.65);
    const state = makeBattle(boss);
    const result = new BattleTurn().endTurn(state, effects);
    assert.equal(result.battleEnded, false);
    assert.equal(boss.phase, 2);
    assert.equal(boss.damage, boss.baseDamage + boss.phaseDamageBonus);
    assert.deepEqual(Array.from(boss.pattern), ['attack', 'defend', 'attack']);
    assert.equal(state.enemyIntent, 'attack');
    assert.equal(state.enemyBlock, 12);
    assert.equal(state.player.hp, 100 - boss.damage);
});

test('secret boss enters phase three at one third health with strength and a stronger opening guard', () => {
    const boss = getVeiledBossForRun({ veiledMerchantDebt: 'defaulted' });
    boss.phase = 2;
    boss.hp = Math.floor(boss.maxHp * 0.3);
    const state = makeBattle(boss);
    const result = new BattleTurn().endTurn(state, effects);
    assert.equal(result.battleEnded, false);
    assert.equal(boss.phase, 3);
    assert.equal(state.statusEffects.enemy.strength, 2);
    assert.equal(state.enemyBlock, 18);
    assert.equal(boss.damage, boss.baseDamage + boss.phaseDamageBonus * 2);
    assert.equal(state.player.hp, 100 - Math.floor((boss.damage + 2) * 1.25));
});

test('phase-three attack forecast matches the damage actually dealt', () => {
    const boss = getVeiledBossForRun({ veiledMerchantDebt: 'defaulted' });
    boss.phase = 3;
    boss.damage = boss.baseDamage + boss.phaseDamageBonus * 2;
    const state = makeBattle(boss);
    state.statusEffects.enemy.strength = 2;
    const forecast = BattleCore.prototype.getEnemyIntentInfo.call(state);
    assert.equal(forecast.damage, Math.floor((boss.damage + 2) * 1.25));
    assert.equal(forecast.afterBlock, forecast.damage);
    const turn = new BattleTurn();
    turn.enemyAttack(state);
    assert.equal(state.player.hp, 100 - forecast.damage);
});

test('normal enemies do not enter secret boss phases', () => {
    const enemy = { id: 'goblin', hp: 10, maxHp: 40, damage: 5, pattern: ['attack'], patternIndex: 0, isBoss: false };
    const state = makeBattle(enemy);
    new BattleTurn().endTurn(state, effects);
    assert.equal(enemy.phase, undefined);
    assert.equal(enemy.damage, 5);
});

test('secret boss phase transitions only once and updates its attack pattern', () => {
    const boss = getVeiledBossForRun({ veiledMerchantDebt: 'purchased' });
    boss.hp = Math.floor(boss.maxHp * 0.6);
    const state = makeBattle(boss);
    const turn = new BattleTurn();
    turn.advanceSecretBossPhase(state);
    assert.equal(boss.phase, 2);
    const guardAfterFirstTransition = state.enemyBlock;
    turn.advanceSecretBossPhase(state);
    assert.equal(state.enemyBlock, guardAfterFirstTransition);
    assert.equal(boss.phase, 2);
});
