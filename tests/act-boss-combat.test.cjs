// node --test tests/act-boss-combat.test.cjs
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

function createApi(randomValues = []) {
    let index = 0;
    const math = Object.create(Math);
    math.random = () => randomValues[index++] ?? 0.99;
    return vm.runInNewContext(source +
        '\n({ ENEMIES, BOSSES_BY_ACT, getBossForAct, BattleCore, BattleTurn })',
    { Math: math });
}

function makeBattle(enemy, options = {}) {
    const player = {
        hp: options.hp ?? 100,
        maxHp: 100,
        relics: options.relics ?? []
    };
    return {
        player,
        enemy,
        turn: 1,
        block: options.block ?? 0,
        enemyBlock: 0,
        enemyIntent: options.intent ?? 'attack',
        hand: [],
        discardPile: [],
        statusEffects: {
            player: { poison: 0, vulnerable: 0, thorns: 0, weak: 0 },
            enemy: { poison: 0, paralysis: 0, bleed: 0, weak: 0, strength: 0 }
        },
        hasPower(id) { return player.relics.includes(id); },
        isEnemyParalyzed() { return this.statusEffects.enemy.paralysis > 0; },
        takeDamage(amount) { player.hp = Math.max(0, player.hp - amount); }
    };
}

test('each act maps to its own boss with an increasing baseline threat', () => {
    const { BOSSES_BY_ACT, getBossForAct } = createApi();
    assert.deepEqual({ ...BOSSES_BY_ACT }, { 1: 'forestBoss', 2: 'caveBoss', 3: 'castleBoss' });
    const expected = [
        [1, 'forestBoss', 150, 15, 'root_grasp'],
        [2, 'caveBoss', 200, 20, 'rock_armor'],
        [3, 'castleBoss', 250, 25, 'dark_magic']
    ];
    for (const [act, id, hp, damage, ability] of expected) {
        const boss = getBossForAct(act);
        assert.equal(boss.id, id);
        assert.equal(boss.hp, hp);
        assert.equal(boss.maxHp, hp);
        assert.equal(boss.damage, damage);
        assert.equal(boss.specialAbility, ability);
        assert.equal(boss.isBoss, true);
    }
});

test('boss instances are isolated and cannot mutate the shared enemy catalog', () => {
    const { ENEMIES, getBossForAct } = createApi();
    const first = getBossForAct(1);
    const second = getBossForAct(1);
    first.hp = 1;
    first.pattern.push('unexpected');
    assert.equal(second.hp, ENEMIES.forestBoss.hp);
    assert.equal(second.pattern.length, ENEMIES.forestBoss.pattern.length);
    assert.equal(ENEMIES.forestBoss.hp, 150);
});

test('act boss intent patterns cycle deterministically', () => {
    const { getBossForAct, BattleCore } = createApi();
    const expected = [
        [1, ['attack', 'defend', 'attack', 'attack', 'defend']],
        [2, ['defend', 'attack', 'attack', 'attack']],
        [3, ['attack', 'attack', 'defend', 'attack']]
    ];
    for (const [act, pattern] of expected) {
        const enemy = getBossForAct(act);
        const battle = Object.create(BattleCore.prototype);
        battle.enemy = enemy;
        const intents = Array.from({ length: pattern.length * 2 },
            () => BattleCore.prototype.getEnemyIntent.call(battle));
        assert.deepEqual(intents, [...pattern, ...pattern]);
    }
});

test('Ancient Ent applies two poison when it chooses to defend', () => {
    const { getBossForAct, BattleTurn } = createApi();
    const battle = makeBattle(getBossForAct(1));
    new BattleTurn().enemyDefend(battle);
    assert.equal(battle.enemyBlock, 10);
    assert.equal(battle.statusEffects.player.poison, 2);
});

test('Stone Golem gains twenty block when defending', () => {
    const { getBossForAct, BattleTurn } = createApi();
    const battle = makeBattle(getBossForAct(2));
    new BattleTurn().enemyDefend(battle);
    assert.equal(battle.enemyBlock, 20);
    assert.equal(battle.statusEffects.player.poison, 0);
});

test('Dark Lord empowered attack has a 30 percent chance and preview shows its upper bound', () => {
    const boostedApi = createApi([0.1]);
    const normalApi = createApi([0.9]);
    const boosted = makeBattle(boostedApi.getBossForAct(3));
    const normal = makeBattle(normalApi.getBossForAct(3));

    new boostedApi.BattleTurn().enemyAttack(boosted);
    new normalApi.BattleTurn().enemyAttack(normal);
    assert.equal(boosted.player.hp, 63);
    assert.equal(normal.player.hp, 75);

    const previewBattle = makeBattle(boostedApi.getBossForAct(3), { intent: 'attack' });
    const preview = boostedApi.BattleCore.prototype.getEnemyIntentInfo.call(previewBattle);
    assert.equal(preview.damage, 25);
    assert.equal(preview.maxDamage, 37);
    assert.equal(preview.bonusChance, 0.3);
});
