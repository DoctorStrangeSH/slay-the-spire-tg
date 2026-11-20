// node --test tests/battle-terminal-effects.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/BattleSystem.js'), 'utf8');
const BattleSystem = vm.runInNewContext(`
    class BattleCore {}
    ${source}
    BattleSystem;
`, {});

function systemWithTerminalCardResult({ playerHp, enemyHp }) {
    const system = Object.create(BattleSystem.prototype);
    let afterPlayCalls = 0;
    system.player = { hp: playerHp };
    system.enemy = { hp: enemyHp };
    system.hand = [{ id: 'terminal-card' }];
    system.cards = {
        playCard(battle) {
            battle.player.hp = playerHp;
            battle.enemy.hp = enemyHp;
            return { success: true };
        }
    };
    system.effects = {
        applyAfterPlayEffects() { afterPlayCalls++; }
    };
    return { system, getAfterPlayCalls: () => afterPlayCalls };
}

test('after-play effects do not run after lethal self-damage', () => {
    const { system, getAfterPlayCalls } = systemWithTerminalCardResult({ playerHp: 0, enemyHp: 10 });
    assert.equal(system.playCard(0).success, true);
    assert.equal(getAfterPlayCalls(), 0);
});

test('after-play effects do not run after a card defeats the enemy', () => {
    const { system, getAfterPlayCalls } = systemWithTerminalCardResult({ playerHp: 10, enemyHp: 0 });
    assert.equal(system.playCard(0).success, true);
    assert.equal(getAfterPlayCalls(), 0);
});

test('after-play effects still run when both sides remain alive', () => {
    const { system, getAfterPlayCalls } = systemWithTerminalCardResult({ playerHp: 9, enemyHp: 4 });
    assert.equal(system.playCard(0).success, true);
    assert.equal(getAfterPlayCalls(), 1);
});
