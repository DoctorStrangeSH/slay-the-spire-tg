// Runtime regression coverage for Berserker conditional card text.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/data/cards/common.js',
    'js/data/cards/berserk.js',
    'js/data/cards/engineer.js',
    'js/systems/battle/BattleCore.js',
    'js/systems/battle/BattleBuildings.js',
    'js/systems/battle/BattleEffects.js',
    'js/systems/battle/BattleCards.js',
    'js/systems/battle/BattleTurn.js',
    'js/systems/BattleSystem.js'
].map(file => readFileSync(join(root, file), 'utf8')).join('\n');

function api() {
    const math = Object.create(Math);
    math.random = () => 0.99;
    return vm.runInNewContext(source + '\n({ BattleSystem, BERSERK_CARDS })', { Math: math });
}

function battle({ hp = 50, maxHp = 100, enemyHp = 100, enemyMaxHp = 100, bleed = 0, strength = 0 } = {}) {
    const { BattleSystem } = api();
    const instance = new BattleSystem(
        { heroId: 'berserk', hp, maxHp, deck: [], relics: [] },
        { id: 'dummy', name: 'Манекен', hp: enemyHp, maxHp: enemyMaxHp,
            damage: 0, pattern: ['defend'], patternIndex: 0 }
    );
    instance.statusEffects.enemy.bleed = bleed;
    instance.statusEffects.player.strength = strength;
    instance.energy = 10;
    return instance;
}

function play(instance, cardId, overrides = {}) {
    const { BERSERK_CARDS } = api();
    instance.hand = [{ ...BERSERK_CARDS[cardId], ...overrides }];
    instance.energy = 10;
    return instance.playCard(0);
}

test('Retaliation Strike doubles damage only below half health', () => {
    const wounded = battle({ hp: 49 });
    play(wounded, 'retaliationStrike');
    assert.equal(wounded.enemy.hp, 88);

    const healthy = battle({ hp: 50 });
    play(healthy, 'retaliationStrike');
    assert.equal(healthy.enemy.hp, 94);
});

test('Cut Wound and Mercy Strike use the current bleed threshold', () => {
    const cut = battle({ bleed: 1 });
    play(cut, 'cutWound');
    assert.equal(cut.enemy.hp, 92);

    const mercy = battle({ bleed: 10 });
    play(mercy, 'mercyStrike');
    assert.equal(mercy.enemy.hp, 86);

    const below = battle({ bleed: 9 });
    play(below, 'mercyStrike');
    assert.equal(below.enemy.hp, 96);
});

test('Execution uses the strict below-30-percent enemy health threshold', () => {
    const below = battle({ enemyHp: 29, enemyMaxHp: 100 });
    play(below, 'execution');
    assert.equal(below.enemy.hp, 0);

    const boundary = battle({ enemyHp: 30, enemyMaxHp: 100 });
    play(boundary, 'execution');
    assert.equal(boundary.enemy.hp, 20);
});

test('Beheading heals eight HP only when its attack kills the enemy', () => {
    const lethal = battle({ hp: 20, enemyHp: 18 });
    play(lethal, 'beheading');
    assert.equal(lethal.player.hp, 28);

    const nonlethal = battle({ hp: 20, enemyHp: 19 });
    play(nonlethal, 'beheading');
    assert.equal(nonlethal.player.hp, 20);
});

test('Berserker block skills apply their documented low-health bonuses', () => {
    const stance = battle({ hp: 49 });
    play(stance, 'berserkStance');
    assert.equal(stance.block, 20);

    const fortification = battle({ hp: 49 });
    play(fortification, 'spiritFortification');
    assert.equal(fortification.block, 14);

    const lastStand = battle({ hp: 24 });
    play(lastStand, 'lastStand');
    assert.equal(lastStand.block, 30);

    const lastStandBoundary = battle({ hp: 25 });
    play(lastStandBoundary, 'lastStand');
    assert.equal(lastStandBoundary.block, 15);

    const finalBattle = battle({ hp: 19 });
    play(finalBattle, 'finalBattle');
    assert.equal(finalBattle.block, 35);
});

test('Fresh Wound doubles bleed below half health', () => {
    const wounded = battle({ hp: 49 });
    play(wounded, 'freshWound');
    assert.equal(wounded.statusEffects.enemy.bleed, 8);

    const healthy = battle({ hp: 50 });
    play(healthy, 'freshWound');
    assert.equal(healthy.statusEffects.enemy.bleed, 4);
});

test('upgraded Berserker cards retain their upgrade bonus in conditional branches', () => {
    const attack = battle({ hp: 49 });
    play(attack, 'retaliationStrike', { upgraded: true, damage: 9 });
    assert.equal(attack.enemy.hp, 85, 'upgraded low-health damage is 15');

    const bleedAttack = battle({ bleed: 1 });
    play(bleedAttack, 'cutWound', { upgraded: true, damage: 6 });
    assert.equal(bleedAttack.enemy.hp, 89, 'upgraded bleed condition deals 11');

    const defense = battle({ hp: 24 });
    play(defense, 'lastStand', { upgraded: true, block: 18 });
    assert.equal(defense.block, 33, 'upgraded low-health block is 33');
});

test('Blood Smell costs one less while another attack is in hand', () => {
    const instance = battle();
    const { BERSERK_CARDS } = api();
    const bloodSmell = { ...BERSERK_CARDS.bloodSmell };
    instance.hand = [bloodSmell, { id: 'held_attack', type: 'attack', cost: 1 }];

    assert.equal(instance.cards.calculateCardCost(instance, bloodSmell, 1), 0);
    instance.hand.pop();
    assert.equal(instance.cards.calculateCardCost(instance, bloodSmell, 1), 1);
});

test('Mad Dash discounts attacks by one energy on the next turn only', () => {
    const instance = battle();
    play(instance, 'madDash');
    assert.equal(instance.berserkAttackDiscountNextTurn, true);
    assert.equal(instance.berserkAttackDiscountActive, false);

    instance.startTurn();
    assert.equal(instance.berserkAttackDiscountActive, true);
    instance.hand = [{ id: 'test_attack', type: 'attack', cost: 2, damage: 1 }];
    instance.energy = 1;
    assert.equal(instance.playCard(0).success, true, 'the next-turn attack costs one less');

    instance.startTurn();
    assert.equal(instance.berserkAttackDiscountActive, false);
    assert.equal(instance.berserkAttackDiscountNextTurn, false);
});

test('Blood Sacrifice doubles existing strength after its self-damage', () => {
    const instance = battle({ hp: 30, strength: 3 });
    play(instance, 'bloodSacrifice');
    assert.equal(instance.player.hp, 25);
    assert.equal(instance.statusEffects.player.strength, 6);
    assert.equal(instance.exhaustPile.length, 1);
});


test('every Berserker card that costs HP discloses the exact self-damage in its description', () => {
    const { BERSERK_CARDS } = api();
    const expectedCosts = {
        wildLunge: '1 урона',
        sacrificialStrike: '3 HP',
        bloodVortex: '2 HP',
        sacrificialBlade: '5 HP',
        bloodRitual: '3 HP',
        bestialInstinct: '1 урона',
        beastRoar: '1 урона',
        scarletVeil: '2 HP',
        lastStand: '5 HP',
        bloodSacrifice: '5 HP',
        scarletFog: '4 HP',
        finalBattle: '3 HP'
    };

    for (const [cardId, costText] of Object.entries(expectedCosts)) {
        assert.ok(BERSERK_CARDS[cardId].description.includes(costText),
            cardId + ' must disclose its self-damage');
    }
    assert.deepEqual(
        Object.keys(BERSERK_CARDS).filter(cardId => BERSERK_CARDS[cardId].selfDamage).sort(),
        Object.keys(expectedCosts).sort(),
        'the coverage list must include every self-damaging Berserker card'
    );
});
