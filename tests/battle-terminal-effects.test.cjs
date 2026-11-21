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


const battleCardsSource = readFileSync(join(__dirname, '../js/systems/battle/BattleCards.js'), 'utf8');
const BattleCards = vm.runInNewContext(battleCardsSource + '\\nBattleCards;', {
    CARD_TYPES: { ATTACK: 'attack', SKILL: 'skill', POWER: 'power' }
});

function echoedAttack({ playerHp = 10, enemyHp = 20, cardDamage = 2, selfDamage = 0 }) {
    const battle = {
        hand: [{ id: 'echoed_attack', type: 'attack', cost: 0, damage: cardDamage, selfDamage, bleed: 1 }],
        energy: 3,
        cardsPlayedThisTurn: 0,
        cardsPlayedTypes: { attack: 0, skill: 0, power: 0, building: 0 },
        echoStacks: 2,
        echoSkillStacks: 0,
        enemyBlock: 0,
        player: { hp: playerHp, maxHp: 20 },
        enemy: { hp: enemyHp },
        statusEffects: { player: { strength: 0, weak: 0 }, enemy: { vulnerable: 0, paralysis: 0, bleed: 0 } },
        hasPower() { return false; },
        takeSelfDamage(amount) { this.player.hp = Math.max(0, this.player.hp - amount); },
        drawCards() {}
    };
    const result = new BattleCards().playCard(battle, 0);
    return { battle, result };
}

test('echo repetitions stop immediately after lethal self-damage', () => {
    const { battle, result } = echoedAttack({ playerHp: 1, enemyHp: 20, selfDamage: 1 });

    assert.equal(result.success, true);
    assert.equal(battle.player.hp, 0);
    assert.equal(battle.enemy.hp, 18, 'only the first echo repetition deals damage');
    assert.equal(battle.statusEffects.enemy.bleed, 1, 'the card does not apply its effects repeatedly');
    assert.equal(battle.hand.length, 0);
    assert.equal(battle.discardPile.length, 1);
});

test('echo repetitions stop immediately after lethal enemy damage', () => {
    const { battle, result } = echoedAttack({ playerHp: 10, enemyHp: 1, cardDamage: 2 });

    assert.equal(result.success, true);
    assert.equal(battle.enemy.hp, 0);
    assert.equal(battle.statusEffects.enemy.bleed, 1, 'the dead enemy is not hit by remaining echo repetitions');
    assert.equal(battle.hand.length, 0);
    assert.equal(battle.discardPile.length, 1);
});

test('after-play effects still run when both sides remain alive', () => {
    const { system, getAfterPlayCalls } = systemWithTerminalCardResult({ playerHp: 9, enemyHp: 4 });
    assert.equal(system.playCard(0).success, true);
    assert.equal(getAfterPlayCalls(), 1);
});
