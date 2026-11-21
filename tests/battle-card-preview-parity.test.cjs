// node --test tests/battle-card-preview-parity.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/battle/BattleCards.js'), 'utf8');
const BattleCards = vm.runInNewContext(source + '\\nBattleCards;', {
    CARD_TYPES: { ATTACK: 'attack', SKILL: 'skill', POWER: 'power', BUILDING: 'building' }
});

function state(card, overrides = {}) {
    const battle = {
        hand: [card],
        enemyBlock: 0,
        player: { hp: 15, maxHp: 40, relics: [] },
        enemy: { hp: 20, maxHp: 100 },
        statusEffects: {
            player: { strength: 0, weak: 0 },
            enemy: { vulnerable: 0, bleed: 0, paralysis: 0 }
        },
        buildings: null,
        hasPower() { return false; },
        isBerserkWounded() { return this.player.hp < this.player.maxHp / 2; },
        isEnemyParalyzed() { return this.statusEffects.enemy.paralysis > 0; },
        takeSelfDamage(amount) { this.player.hp = Math.max(0, this.player.hp - amount); },
        drawCards() {}
    };
    return Object.assign(battle, overrides);
}

const cases = [
    {
        name: 'Retaliation Strike uses wounded-health condition and upgrade bonus',
        card: { id: 'retaliationStrike', type: 'attack', damage: 4, upgraded: true },
        expected: 15
    },
    {
        name: 'Cut Wound uses existing bleed and upgrade bonus',
        card: { id: 'cutWound', type: 'attack', damage: 3, upgraded: true },
        overrides: { statusEffects: {
            player: { strength: 0, weak: 0 },
            enemy: { vulnerable: 0, bleed: 1, paralysis: 0 }
        } },
        expected: 11
    },
    {
        name: 'Mercy Strike uses ten bleed threshold and upgrade bonus',
        card: { id: 'mercyStrike', type: 'attack', damage: 5, upgraded: true },
        overrides: { statusEffects: {
            player: { strength: 0, weak: 0 },
            enemy: { vulnerable: 0, bleed: 10, paralysis: 0 }
        } },
        expected: 17
    },
    {
        name: 'Execution uses low-enemy-health condition and upgrade bonus',
        card: { id: 'execution', type: 'attack', damage: 6, upgraded: true },
        overrides: { enemy: { hp: 20, maxHp: 100 } },
        expected: 33
    }
];

for (const scenario of cases) {
    test('preview matches runtime damage: ' + scenario.name, () => {
        const battle = state(scenario.card, scenario.overrides || {});
        const cards = new BattleCards();
        const preview = cards.calculateCardPreview(battle, scenario.card);

        assert.equal(preview.damage, scenario.expected);

        const hpBefore = battle.enemy.hp;
        cards.dealDamage(battle, scenario.card);
        const actualDamage = hpBefore - battle.enemy.hp;
        assert.equal(actualDamage, Math.min(hpBefore, preview.damage));
    });
}

test('conditional Berserker cards preview base damage when their condition is not met', () => {
    const scenarios = [
        [{ id: 'retaliationStrike', type: 'attack', damage: 4 }, { player: { hp: 25, maxHp: 40, relics: [] } }],
        [{ id: 'cutWound', type: 'attack', damage: 3 }, { statusEffects: {
            player: { strength: 0, weak: 0 },
            enemy: { vulnerable: 0, bleed: 0, paralysis: 0 }
        } }],
        [{ id: 'mercyStrike', type: 'attack', damage: 5 }, { statusEffects: {
            player: { strength: 0, weak: 0 },
            enemy: { vulnerable: 0, bleed: 9, paralysis: 0 }
        } }],
        [{ id: 'execution', type: 'attack', damage: 6 }, { enemy: { hp: 40, maxHp: 100 } }]
    ];

    for (const [card, overrides] of scenarios) {
        const battle = state(card, overrides);
        assert.equal(new BattleCards().calculateCardPreview(battle, card).damage, card.damage, card.id);
    }
});
