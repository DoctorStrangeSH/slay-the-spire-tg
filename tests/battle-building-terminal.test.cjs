// Regression coverage for terminal outcomes during Engineer building ticks.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/battle/BattleBuildings.js'), 'utf8');
const BattleBuildings = vm.runInNewContext(source + '\nBattleBuildings;', { Math });

function battle(enemyHp, powers = []) {
    return {
        enemy: { hp: enemyHp },
        statusEffects: { enemy: { poison: 0, weak: 0, vulnerable: 0 } },
        hand: [],
        hasPower(id) { return powers.includes(id); },
        drawCards() {}
    };
}

function building(id, options = {}) {
    return {
        id,
        cardId: options.cardId || 'turret',
        hp: options.hp || 5,
        damage: options.damage || 0,
        poison: options.poison || 0,
        weak: options.weak || 0,
        vulnerable: options.vulnerable || 0,
        aoe: false,
        statusEffects: { poison: 0, bleed: 0, strength: 0, weak: 0 }
    };
}

test('end-of-turn building triggers stop after the first lethal structure attack', () => {
    const system = new BattleBuildings();
    const lethal = building(1, { damage: 5 });
    const later = building(2, { damage: 1, poison: 3, weak: 2 });
    system.buildings = [lethal, later];
    const state = battle(4);

    system.triggerEndOfTurn(state);

    assert.equal(state.enemy.hp, 0);
    assert.equal(state.statusEffects.enemy.poison, 0, 'later buildings do not apply poison after lethal damage');
    assert.equal(state.statusEffects.enemy.weak, 0, 'later buildings do not apply debuffs after lethal damage');
});

test('a lethal building hit does not apply its own poison or weakness afterward', () => {
    const system = new BattleBuildings();
    const lethal = building(1, { damage: 5, poison: 3, weak: 2 });
    const state = battle(4);

    system.triggerBuildingEnd(state, lethal);

    assert.equal(state.enemy.hp, 0);
    assert.equal(state.statusEffects.enemy.poison, 0);
    assert.equal(state.statusEffects.enemy.weak, 0);
});

test('building status ticks stop after System Overload defeats the enemy', () => {
    const system = new BattleBuildings();
    const earlier = building(1, { hp: 1 });
    earlier.statusEffects.poison = 1;
    const lethal = building(2, { hp: 1 });
    lethal.statusEffects.poison = 1;
    system.buildings = [earlier, lethal];
    const state = battle(2, ['systemOverload']);

    system.triggerStatusEffects(state);

    assert.equal(state.enemy.hp, 0);
    assert.equal(system.buildings.length, 1, 'remaining structures are not processed after the lethal overload');
    assert.equal(earlier.hp, 1);
    assert.equal(earlier.statusEffects.poison, 1);
});

test('Drone Factory does not create a drone after another building ends the battle', () => {
    const system = new BattleBuildings();
    system.buildings = [
        building(1, { damage: 5 }),
        building(2, { cardId: 'droneFactory', hp: 5 })
    ];
    const state = battle(3);

    system.triggerEndOfTurn(state);

    assert.equal(state.enemy.hp, 0);
    assert.equal(system.buildings.length, 2);
    assert.equal(system.buildings.some(item => item.cardId === 'drone'), false);
});
