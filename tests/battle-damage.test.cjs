// node --test tests/battle-damage.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/battle/BattleCore.js'), 'utf8');
const BattleCore = vm.runInNewContext(source + '\nBattleCore;', {
    GAME_CONFIG: { baseEnergy: 3, maxEnergy: 3, maxHandSize: 10 },
    Math
});

function battleWithHp(hp = 40) {
    return new BattleCore({ hp, maxHp: 70, deck: [], relics: [] }, {
        hp: 50, maxHp: 50, pattern: [], patternIndex: 0
    });
}

test('battle tracks actual cumulative hp loss separately from per-turn damage', () => {
    const battle = battleWithHp(40);
    assert.equal(battle.takeDamage(7), 7);
    assert.equal(battle.player.hp, 33);
    assert.equal(battle.damageTakenThisTurn, 7);
    assert.equal(battle.damageTakenThisBattle, 7);
});

test('healing does not erase hp loss already taken during the battle', () => {
    const battle = battleWithHp(40);
    battle.takeDamage(9);
    battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + 9);
    assert.equal(battle.player.hp, 40);
    assert.equal(battle.damageTakenThisBattle, 9);
});

test('damage tracker counts only hp actually lost and safely clamps lethal damage', () => {
    const battle = battleWithHp(5);
    assert.equal(battle.takeDamage(12), 5);
    assert.equal(battle.player.hp, 0);
    assert.equal(battle.damageTakenThisBattle, 5);
});

test('self-damage uses the same cumulative tracker as incoming damage', () => {
    const battle = battleWithHp(30);
    battle.takeSelfDamage(2);
    battle.takeDamage(3);
    assert.equal(battle.damageTakenThisBattle, 5);
    assert.equal(battle.damageTakenThisTurn, 5);
});


const turnSource = readFileSync(join(__dirname, '../js/systems/battle/BattleTurn.js'), 'utf8');
const BattleTurn = vm.runInNewContext(turnSource + '\nBattleTurn;', { Math });

test('enemy attack records only health damage after block is absorbed', () => {
    const battle = {
        player: { hp: 30 },
        enemy: { hp: 40 },
        block: 6,
        statusEffects: { player: { thorns: 0 } },
        damageTakenThisTurn: 0,
        damageTakenThisBattle: 0,
        takeDamage(amount) {
            const lost = Math.min(this.player.hp, Math.max(0, Math.floor(amount)));
            this.player.hp -= lost;
            this.damageTakenThisTurn += lost;
            this.damageTakenThisBattle += lost;
        }
    };

    new BattleTurn().attackPlayer(battle, 10);

    assert.equal(battle.block, 0);
    assert.equal(battle.player.hp, 26);
    assert.equal(battle.damageTakenThisBattle, 4);
});

test('fully blocked enemy attack does not disqualify a flawless battle', () => {
    const battle = {
        player: { hp: 30 },
        enemy: { hp: 40 },
        block: 12,
        statusEffects: { player: { thorns: 0 } },
        damageTakenThisTurn: 0,
        damageTakenThisBattle: 0,
        takeDamage(amount) {
            const lost = Math.min(this.player.hp, Math.max(0, Math.floor(amount)));
            this.player.hp -= lost;
            this.damageTakenThisTurn += lost;
            this.damageTakenThisBattle += lost;
        }
    };

    new BattleTurn().attackPlayer(battle, 10);

    assert.equal(battle.player.hp, 30);
    assert.equal(battle.damageTakenThisBattle, 0);
});
