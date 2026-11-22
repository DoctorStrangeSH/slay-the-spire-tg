const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const constants = readFileSync(join(__dirname, '../js/config/constants.js'), 'utf8');
const gameSource = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const { Game, NODE_TYPES } = vm.runInNewContext(
    constants + '\n' + gameSource + '\n({ Game, NODE_TYPES })',
    { console, Math, Date, JSON, alert() {} }
);

function fixture(type, { visited = false, hasChronicle = true, floor = 2 } = {}) {
    const calls = [];
    const current = { id: 'current', floor: 1, type: NODE_TYPES.START };
    const node = { id: 'next-room', floor, type, visited };
    const game = Object.create(Game.prototype);
    game.currentNodeId = current.id;
    game.floor = 1;
    game.player = { relics: hasChronicle ? ['chronicle'] : [] };
    game.mapGenerator = {
        getAvailableNodes(id) {
            assert.equal(id, current.id);
            return [node];
        },
        findNodeById(id) { return id === current.id ? current : null; },
        visitNode(id) {
            calls.push(['visitNode', id]);
            node.visited = true;
        }
    };
    for (const method of [
        'startBattle', 'rest', 'triggerEvent', 'triggerSecretRoom',
        'openTreasure', 'openShop', 'startBossBattle'
    ]) {
        game[method] = (...args) => calls.push([method, ...args]);
    }
    return { game, node, current, calls };
}

test('each reachable room type dispatches to exactly its own room handler', () => {
    const cases = [
        [NODE_TYPES.BATTLE, ['startBattle', false]],
        [NODE_TYPES.ELITE, ['startBattle', true]],
        [NODE_TYPES.REST, ['rest']],
        [NODE_TYPES.EVENT, ['triggerEvent']],
        [NODE_TYPES.SECRET, ['triggerSecretRoom']],
        [NODE_TYPES.TREASURE, ['openTreasure']],
        [NODE_TYPES.SHOP, ['openShop']],
        [NODE_TYPES.BOSS, ['startBossBattle']]
    ];

    for (const [type, expected] of cases) {
        const { game, node, calls } = fixture(type);
        game.selectMapNode(node);
        assert.deepEqual(calls, [
            ['visitNode', node.id],
            expected
        ], `dispatch for room type ${type}`);
        assert.equal(game.currentNodeId, node.id);
        assert.equal(game.floor, node.floor);
        assert.equal(node.visited, true);
    }
});

test('unavailable, visited and non-forward rooms are rejected without changing the run', () => {
    const cases = [
        { name: 'unavailable', mutate(game) { game.mapGenerator.getAvailableNodes = () => []; } },
        { name: 'already visited', options: { visited: true } },
        { name: 'same floor', options: { floor: 1 } },
        { name: 'past floor', options: { floor: 0 } }
    ];

    for (const scenario of cases) {
        const { game, node, calls } = fixture(NODE_TYPES.BATTLE, scenario.options);
        if (scenario.mutate) scenario.mutate(game);
        game.selectMapNode(node);
        assert.deepEqual(calls, [], scenario.name);
        assert.equal(game.currentNodeId, 'current', scenario.name);
        assert.equal(game.floor, 1, scenario.name);
        assert.equal(node.visited, Boolean(scenario.options?.visited), scenario.name);
    }
});

test('secret room without Chronicle is rejected before marking the room visited', () => {
    const { game, node, calls } = fixture(NODE_TYPES.SECRET, { hasChronicle: false });
    let alertMessage = '';
    const context = { alert(message) { alertMessage = message; } };
    const alertGame = vm.runInNewContext(
        constants + '\n' + gameSource + '\nGame;',
        { console, Math, Date, JSON, alert: context.alert }
    );
    const instance = Object.create(alertGame.prototype);
    Object.assign(instance, game);

    instance.selectMapNode(node);

    assert.match(alertMessage, /Хроника предвидения/);
    assert.deepEqual(calls, []);
    assert.equal(instance.currentNodeId, 'current');
    assert.equal(instance.floor, 1);
    assert.equal(node.visited, false);
});
