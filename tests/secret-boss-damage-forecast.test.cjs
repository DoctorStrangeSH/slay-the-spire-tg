// Verify the Secret Boss attack forecast stays identical to actual phase damage.
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
].map(file => readFileSync(join(root, file), 'utf8')).join('\n');

function api() {
    const math = Object.create(Math);
    math.random = () => 0.99;
    return vm.runInNewContext(source + '\n({ getVeiledBossForRun, BattleCore, BattleTurn })', { Math: math });
}

function createBattle(profile = 'defaulted') {
    const { getVeiledBossForRun, BattleCore } = api();
    const enemy = getVeiledBossForRun({ veiledMerchantDebt: profile });
    const battle = new BattleCore(
        { heroId: 'psyker', hp: 100, maxHp: 100, deck: [], relics: ['invulnerability'] },
        enemy
    );
    battle.enemyIntent = 'attack';
    battle.block = 7;
    battle.statusEffects.player.vulnerable = 1;
    battle.statusEffects.enemy.weak = 1;
    return battle;
}

test('Secret Collector phase 2 forecast matches the actual attack after all modifiers', () => {
    const { BattleTurn } = api();
    const battle = createBattle('owed');
    battle.enemy.phase = 2;
    battle.enemy.damage = battle.enemy.baseDamage + battle.enemy.phaseDamageBonus;
    battle.statusEffects.enemy.strength = 1;

    const forecast = battle.getEnemyIntentInfo();
    const hpBefore = battle.player.hp;
    new BattleTurn().enemyAttack(battle);

    assert.equal(hpBefore - battle.player.hp, forecast.afterBlock);
    assert.equal(forecast.maxDamage, forecast.damage);
});

test('Secret Collector phase 3 forecast includes phase strength and the 25 percent attack bonus', () => {
    const { BattleTurn } = api();
    const battle = createBattle('defaulted');
    battle.enemy.phase = 2;
    battle.enemy.hp = Math.floor(battle.enemy.maxHp / 3);
    battle.enemy.damage = battle.enemy.baseDamage + battle.enemy.phaseDamageBonus;
    const turn = new BattleTurn();

    assert.equal(turn.advanceSecretBossPhase(battle), true);
    assert.equal(battle.enemy.phase, 3);
    assert.equal(battle.enemy.damage, battle.enemy.baseDamage + battle.enemy.phaseDamageBonus * 2);
    assert.equal(battle.statusEffects.enemy.strength, 2);

    const forecast = battle.getEnemyIntentInfo();
    const hpBefore = battle.player.hp;
    turn.enemyAttack(battle);

    assert.equal(hpBefore - battle.player.hp, forecast.afterBlock);
    assert.ok(forecast.damage > 0);
    assert.equal(forecast.maxDamage, forecast.damage);
});

test('Secret Collector phase 3 forecast remains exact with different merchant consequences', () => {
    const { BattleTurn } = api();
    for (const consequence of ['owed', 'settled', 'defaulted', 'declined', 'purchased']) {
        const battle = createBattle(consequence);
        battle.enemy.phase = 3;
        battle.enemy.damage = battle.enemy.baseDamage + battle.enemy.phaseDamageBonus * 2;
        battle.statusEffects.enemy.strength = 2;
        const forecast = battle.getEnemyIntentInfo();
        const hpBefore = battle.player.hp;

        new BattleTurn().enemyAttack(battle);

        assert.equal(hpBefore - battle.player.hp, forecast.afterBlock, consequence);
    }
});
