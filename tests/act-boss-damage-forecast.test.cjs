// node --test tests/act-boss-damage-forecast.test.cjs
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

function createApi(randomValue) {
    const math = Object.create(Math);
    math.random = () => randomValue;
    return vm.runInNewContext(source +
        '\n({ getBossForAct, BattleCore, BattleTurn })', { Math: math });
}

function makeBattle(enemy, randomValue, block = 9) {
    const player = { hp: 100, maxHp: 100, relics: ['invulnerability'] };
    return {
        player,
        enemy,
        turn: 1,
        block,
        enemyBlock: 0,
        enemyIntent: 'attack',
        statusEffects: {
            player: { poison: 0, vulnerable: 1, thorns: 0, weak: 0 },
            enemy: { paralysis: 0, bleed: 0, weak: 1, strength: 2 }
        },
        hasPower(id) { return player.relics.includes(id); },
        isEnemyParalyzed() { return this.statusEffects.enemy.paralysis > 0; },
        takeDamage(amount) { player.hp = Math.max(0, player.hp - amount); }
    };
}

test('act boss attack forecast matches actual damage with strength, statuses, relic mitigation and block', () => {
    for (let act = 1; act <= 3; act++) {
        for (const roll of [0.9, 0.1]) {
            const api = createApi(roll);
            const battle = makeBattle(api.getBossForAct(act), roll);
            const forecast = api.BattleCore.prototype.getEnemyIntentInfo.call(battle);
            const expectedDamage = battle.enemy.specialAbility === 'dark_magic' && roll < 0.3
                ? forecast.maxAfterBlock
                : forecast.afterBlock;

            new api.BattleTurn().enemyAttack(battle);
            const actualDamage = 100 - battle.player.hp;

            assert.equal(actualDamage, expectedDamage,
                `act ${act}, random roll ${roll}: forecast ${expectedDamage}, actual ${actualDamage}`);
            assert.ok(forecast.damage >= 0);
            assert.ok(forecast.maxDamage >= forecast.damage);
            assert.equal(forecast.bonusChance,
                battle.enemy.specialAbility === 'dark_magic' ? 0.3 : 0);
        }
    }
});

test('Dark Lord forecast always exposes the boosted upper bound without consuming randomness', () => {
    const api = createApi(0.9);
    const battle = makeBattle(api.getBossForAct(3), 0.9, 0);
    const first = api.BattleCore.prototype.getEnemyIntentInfo.call(battle);
    const second = api.BattleCore.prototype.getEnemyIntentInfo.call(battle);
    assert.deepEqual(first, second);
    assert.equal(first.damage, 25);
    assert.equal(first.maxDamage, 37);
    assert.equal(first.bonusChance, 0.3);
});
