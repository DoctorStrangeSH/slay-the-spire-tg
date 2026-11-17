// node --test tests/battle-turn.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/battle/BattleTurn.js'), 'utf8');
const BattleTurn = vm.runInNewContext(source + '\nBattleTurn;', { Math });

function battle(overrides = {}) {
    const player = { hp: 20, maxHp: 20, relics: [], ...overrides.player };
    const enemy = { hp: 20, damage: 8, ...overrides.enemy };
    const state = {
        player, enemy, turn: 1, block: 0, enemyBlock: 0,
        enemyIntent: 'attack', hand: [{ id: 'strike' }], discardPile: [],
        statusEffects: {
            player: { poison: 0, vulnerable: 0, thorns: 0 },
            enemy: { paralysis: 0, bleed: 0, weak: 0, strength: 0 }
        },
        hasPower(id) { return player.relics.includes(id); },
        isEnemyParalyzed() { return this.statusEffects.enemy.paralysis > 0; },
        startTurn() { this.started = true; },
        ...overrides,
        player, enemy
    };
    return state;
}
const effects = { decreaseStatusEffects() {} };

test('defeated enemy does not attack after lethal card/building effects', () => {
    const state = battle({ enemy: { hp: 0, damage: 99 } });
    const outcome = new BattleTurn().endTurn(state, effects);
    assert.equal(outcome.victory, true);
    assert.equal(state.player.hp, 20);
    assert.equal(state.started, undefined);
});

test('reflection kills attacker before damage is inflicted', () => {
    const state = battle({ enemy: { hp: 3 }, player: { relics: ['psyReflection'] } });
    const outcome = new BattleTurn().endTurn(state, effects);
    assert.equal(outcome.victory, true);
    assert.equal(state.player.hp, 20);
});

test('simultaneous lethal damage does not award victory to defeated hero', () => {
    const state = battle({
        player: { hp: 2 },
        enemy: { hp: 2 },
        statusEffects: {
            player: { poison: 0, vulnerable: 0, thorns: 3 },
            enemy: { paralysis: 0, bleed: 0, weak: 0, strength: 0 }
        }
    });
    const outcome = new BattleTurn().endTurn(state, effects);
    assert.equal(outcome.battleEnded, true);
    assert.equal(outcome.victory, false);
});

test('second life resolves before a victory after mutual lethal damage', () => {
    const state = battle({
        player: { hp: 2, relics: ['secondLife'] },
        enemy: { hp: 2 },
        statusEffects: {
            player: { poison: 0, vulnerable: 0, thorns: 3 },
            enemy: { paralysis: 0, bleed: 0, weak: 0, strength: 0 }
        }
    });
    const outcome = new BattleTurn().endTurn(state, effects);
    assert.equal(outcome.victory, true);
    assert.equal(state.player.hp, 10);
    assert.equal(state.player.relics.includes('secondLife'), false);
});


test('enemy attack forecast matches weakness, vulnerability and invulnerability', () => {
    const coreSource = readFileSync(join(__dirname, '../js/systems/battle/BattleCore.js'), 'utf8');
    const BattleCore = vm.runInNewContext(coreSource + '\nBattleCore;', { Math });
    const state = battle({ enemy: { damage: 10, specialAbility: null } });
    state.block = 7;
    state.statusEffects.player.vulnerable = 1;
    state.statusEffects.enemy.weak = 1;
    state.player.relics.push('invulnerability');
    const info = BattleCore.prototype.getEnemyIntentInfo.call(state);
    assert.equal(info.damage, 9); // floor(floor(10 * 1.5) * .75) - 2
    assert.equal(info.afterBlock, 2);
    assert.equal(info.maxDamage, 9);
});

test('dark magic forecast shows real 30 percent risk and root grasp poison', () => {
    const coreSource = readFileSync(join(__dirname, '../js/systems/battle/BattleCore.js'), 'utf8');
    const BattleCore = vm.runInNewContext(coreSource + '\nBattleCore;', { Math });
    const state = battle({ enemy: { damage: 10, specialAbility: 'dark_magic' } });
    const info = BattleCore.prototype.getEnemyIntentInfo.call(state);
    assert.equal(info.damage, 10);
    assert.equal(info.maxDamage, 15);
    assert.equal(info.bonusChance, 0.3);
    state.enemyIntent = 'defend';
    state.enemy.specialAbility = 'root_grasp';
    const defend = BattleCore.prototype.getEnemyIntentInfo.call(state);
    assert.equal(defend.block, 10);
    assert.equal(defend.poison, 2);
});
