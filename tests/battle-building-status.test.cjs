// node --test tests/battle-building-status.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/battle/BattleBuildings.js'), 'utf8');
const BattleBuildings = vm.runInNewContext(source + '\nBattleBuildings;', { Math });

function structure(id, statusEffects = {}) {
    return {
        id, cardId: 'turret', hp: 2, maxHp: 5, damage: 1,
        statusEffects: { poison: 0, bleed: 0, vulnerable: 0, weak: 0, strength: 0, ...statusEffects }
    };
}

function battle(overload = false) {
    return {
        enemy: { hp: 30 },
        hasPower(id) { return overload && id === 'systemOverload'; }
    };
}

test('all poisoned buildings are processed when multiple structures die together', () => {
    const system = new BattleBuildings();
    system.buildings = [
        structure(1, { poison: 2 }),
        structure(2, { poison: 2 }),
        structure(3, { poison: 2 })
    ];
    const state = battle(true);

    system.triggerStatusEffects(state);

    assert.equal(system.buildings.length, 0);
    assert.equal(state.enemy.hp, 21);
});

test('destroyed building is removed once and surviving neighbours still receive their status tick', () => {
    const system = new BattleBuildings();
    const survivor = structure(2, { poison: 1, bleed: 1 });
    survivor.hp = 3;
    system.buildings = [
        structure(1, { poison: 3 }),
        survivor,
        structure(3, { bleed: 1 })
    ];

    system.triggerStatusEffects(battle());

    assert.deepEqual(Array.from(system.buildings, item => item.id), [2, 3]);
    assert.equal(survivor.hp, 1);
    assert.equal(survivor.statusEffects.poison, 0);
    assert.equal(survivor.statusEffects.bleed, 0);
    assert.equal(system.buildings[1].hp, 1);
    assert.equal(system.buildings[1].statusEffects.bleed, 0);
});

test('building status tick is safe with an empty field', () => {
    const system = new BattleBuildings();
    assert.doesNotThrow(() => system.triggerStatusEffects(battle(true)));
    assert.equal(system.buildings.length, 0);
});


test('construction field never exceeds four slots and rejected placement does not allocate an id', () => {
    const system = new BattleBuildings();
    const state = battle();
    for (let index = 0; index < 4; index++) {
        const result = system.placeBuilding(state, {
            id: 'building_' + index, name: 'Тест', hp: 5, damage: 0
        });
        assert.equal(result.success, true);
    }

    const rejected = system.placeBuilding(state, {
        id: 'overflow', name: 'Лишняя постройка', hp: 5, damage: 0
    });

    assert.equal(rejected.success, false);
    assert.equal(rejected.message, 'Нет свободных слотов!');
    assert.equal(system.getBuildingCount(), 4);
    assert.equal(system.getFreeSlots(), 0);
    assert.equal(system.nextId, 5);
});
