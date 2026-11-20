// node --test tests/battle-start-turn-terminal.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const effectsSource = readFileSync(join(root, 'js/systems/battle/BattleEffects.js'), 'utf8');
const BattleEffects = vm.runInNewContext(effectsSource + '\nBattleEffects;', {
    CARD_TYPES: { SKILL: 'skill', ATTACK: 'attack', POWER: 'power' }
});

test('pain path cannot trigger a later relic heal after lethal self-damage', () => {
    const battle = {
        player: { hp: 1, maxHp: 40 },
        statusEffects: { player: { strength: 0 }, enemy: { bleed: 0 } },
        hasPower(id) { return ['painPath', 'battlePulse', 'bloodAura'].includes(id); },
        isBerserkWounded() { return this.player.hp < this.player.maxHp / 2; },
        takeDamage(amount) { this.player.hp = Math.max(0, this.player.hp - amount); }
    };
    new BattleEffects().applyBerserkStartTurnEffects(battle);
    assert.equal(battle.player.hp, 0);
    assert.equal(battle.player.hp, 0);
    assert.equal(battle.statusEffects.player.strength, 0);
    assert.equal(battle.statusEffects.enemy.bleed, 0);
});

test('lethal start-turn effects stop the rest of the turn setup', () => {
    const source = readFileSync(join(root, 'js/systems/BattleSystem.js'), 'utf8');
    const BattleSystem = vm.runInNewContext(`
        class BattleCore {}
        ${source}
        BattleSystem;
    `, {});
    const battle = Object.create(BattleSystem.prototype);
    let buildingTriggers = 0;
    let draws = 0;
    let intents = 0;
    battle.player = { hp: 0, heroId: 'berserk', maxHp: 40 };
    battle.enemy = { hp: 20 };
    battle.maxEnergy = 3;
    battle.hasPower = () => false;
    battle.effects = { applyStartTurnEffects() { battle.player.hp = 0; } };
    battle.buildings = { triggerStartOfTurn() { buildingTriggers++; } };
    battle.drawCards = () => { draws++; };
    battle.getEnemyIntent = () => { intents++; return 'attack'; };
    battle.startTurn();
    assert.equal(battle.battleEnded, true);
    assert.equal(battle.enemyIntent, null);
    assert.equal(buildingTriggers, 0);
    assert.equal(draws, 0);
    assert.equal(intents, 0);
});

