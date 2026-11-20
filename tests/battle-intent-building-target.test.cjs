// node --test tests/battle-intent-building-target.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const coreSource = readFileSync(join(root, 'js/systems/battle/BattleCore.js'), 'utf8');
const uiSource = readFileSync(join(root, 'js/ui/BattleUI.js'), 'utf8');

const BattleCore = vm.runInNewContext(coreSource + '\nBattleCore;', {
    GAME_CONFIG: { baseEnergy: 3, maxEnergy: 3, maxHandSize: 10 },
    Math
});

function createBattle(buildingCount) {
    const battle = new BattleCore(
        { hp: 80, maxHp: 80, deck: [], relics: [] },
        { id: 'goblin', name: 'Гоблин', hp: 40, maxHp: 40, damage: 7, pattern: ['attack'], patternIndex: 0 }
    );
    battle.enemyIntent = 'attack';
    battle.buildings = { getBuildingCount: () => buildingCount };
    return battle;
}

test('attack forecast reports the exact deterministic building redirection chance', () => {
    const cases = [[0, 0], [1, 0.45], [2, 0.60], [3, 0.75], [4, 0.75], [8, 0.75]];
    for (const [count, expected] of cases) {
        const battle = createBattle(count);
        const first = battle.getEnemyIntentInfo();
        const second = battle.getEnemyIntentInfo();
        assert.equal(first.buildingCount, count);
        assert.equal(first.buildingTargetChance, expected);
        assert.deepEqual(first, second, 'forecast must not consume randomness or mutate battle state');
    }
});

test('intent UI tells the player that displayed post-block damage applies only if the hero is targeted', () => {
    const nodes = new Map();
    const makeNode = () => ({
        attrs: {},
        className: '',
        classList: { toggle() {}, remove() {}, add() {} },
        setAttribute(key, value) { this.attrs[key] = value; },
        removeAttribute(key) { delete this.attrs[key]; }
    });
    const document = {
        getElementById(id) {
            if (!nodes.has(id)) nodes.set(id, makeNode());
            return nodes.get(id);
        }
    };
    const ui = vm.runInNewContext(uiSource + '\nBattleUI;', {
        document, EnemyArt: { render() {} }, Object, Math
    });
    ui.renderStatusBadges = () => {};

    const battle = {
        enemy: { id: 'goblin', name: 'Гоблин', hp: 40, maxHp: 40, isBoss: false, isSecretBoss: false },
        enemyBlock: 0,
        block: 4,
        statusEffects: { enemy: { strength: 0, paralysis: 0, vulnerable: 0, weak: 0, bleed: 0, poison: 0 } },
        buildings: { getBuildingCount: () => 2 },
        isEnemyParalyzed: () => false,
        getEnemyIntentInfo: () => ({
            type: 'attack', damage: 7, maxDamage: 7, afterBlock: 3, maxAfterBlock: 3,
            bonusChance: 0, buildingCount: 2, buildingTargetChance: 0.6
        })
    };

    ui.renderEnemy({}, battle);
    const intent = nodes.get('enemy-intent');
    assert.match(intent.innerHTML, /Герою после блока: 3/);
    assert.match(intent.innerHTML, /постройка: 60%/);
    assert.match(intent.attrs['aria-label'], /Шанс выбора постройки целью: 60% \(2 шт\.\)/);
});
