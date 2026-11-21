// Runtime/preview parity for Engineer attacks that scale with constructions.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/data/cards/common.js',
    'js/data/cards/engineer.js',
    'js/systems/battle/BattleCore.js',
    'js/systems/battle/BattleBuildings.js',
    'js/systems/battle/BattleEffects.js',
    'js/systems/battle/BattleCards.js',
    'js/systems/battle/BattleTurn.js',
    'js/systems/BattleSystem.js'
].map(file => readFileSync(join(root, file), 'utf8')).join('\n');

function createApi() {
    const math = Object.create(Math);
    math.random = () => 0.99;
    return vm.runInNewContext(source + '\n({ BattleSystem, ENGINEER_CARDS })', { Math: math });
}

function makeBattle(api, cardId, buildingCount) {
    const battle = new api.BattleSystem(
        { heroId: 'engineer', hp: 50, maxHp: 50, deck: [], relics: [] },
        { id: 'dummy', name: 'Манекен', hp: 100, maxHp: 100, damage: 0,
            pattern: ['defend'], patternIndex: 0 }
    );
    for (let i = 0; i < buildingCount; i++) {
        battle.buildings.placeBuilding(battle, { id: 'test_' + i, name: 'Тест', hp: 5, damage: 0 });
    }
    const card = { ...api.ENGINEER_CARDS[cardId] };
    battle.hand = [card];
    battle.energy = 5;
    return { battle, card };
}

for (const [cardId, count, expected] of [
    ['wrench', 1, 9],
    ['wrench', 0, 6],
    ['bolt', 1, 13],
    ['bolt', 0, 10],
    ['overload', 2, 8],
    ['overload', 0, 4]
]) {
    test(cardId + ' preview and actual damage agree with ' + count + ' constructions', () => {
        const api = createApi();
        const { battle, card } = makeBattle(api, cardId, count);
        const preview = battle.cards.calculateCardPreview(battle, card);

        assert.equal(preview.damage, expected);
        assert.equal(battle.playCard(0).success, true);
        assert.equal(100 - battle.enemy.hp, expected);
    });
}
