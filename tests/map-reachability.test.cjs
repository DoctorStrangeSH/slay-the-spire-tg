// node --test tests/map-reachability.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const constants = readFileSync(join(__dirname, '../js/config/constants.js'), 'utf8');
const source = readFileSync(join(__dirname, '../js/systems/MapGenerator.js'), 'utf8');
const MapGenerator = vm.runInNewContext(
    constants + '\n' + source + '\nMapGenerator;',
    { Math }
);

function reachableFromStart(map) {
    const start = map.paths[0][0];
    const visited = new Set();
    const queue = [start];
    while (queue.length) {
        const node = queue.shift();
        if (!node || visited.has(node.id)) continue;
        visited.add(node.id);
        for (const id of node.connections) {
            queue.push(map.findNodeById(id));
        }
    }
    return visited;
}

test('every modern organic room, including the boss, is reachable from the start', () => {
    for (let seed = 0; seed < 1000; seed++) {
        const map = new MapGenerator(1, seed);
        const reachable = reachableFromStart(map);
        for (const node of map.allNodes) {
            assert.ok(reachable.has(node.id),
                `unreachable ${node.type} at ${node.id} for seed ${seed}`);
        }
        assert.ok(reachable.has(map.paths[15][0].id),
            `boss is unreachable for seed ${seed}`);
    }
});

test('organic map preserves its intended strategic room contract across seeded runs', () => {
    for (let seed = 0; seed < 1000; seed++) {
        const map = new MapGenerator(1, seed);
        const count = type => map.allNodes.filter(node => node.type === type).length;

        assert.equal(count('shop'), 2, `shop quota for seed ${seed}`);
        assert.equal(count('elite'), 2, `elite quota for seed ${seed}`);
        assert.equal(count('treasure'), 1, `treasure quota for seed ${seed}`);
        assert.equal(count('boss'), 1, `boss quota for seed ${seed}`);
        assert.equal(count('start'), 1, `start quota for seed ${seed}`);
        assert.deepEqual(map.paths[1].map(node => node.type), map.paths[1].map(() => 'battle'));
        assert.ok(map.allNodes.every(node => node.type !== 'shop' || node.floor >= 4));
        assert.ok(map.allNodes.every(node => node.type !== 'elite' || node.floor >= 6));
        assert.equal(map.paths[8][0].type, 'treasure');
        assert.equal(map.paths[14][0].type, 'rest');
        assert.equal(map.paths[15][0].type, 'boss');
    }
});

test('legacy organic checkpoints keep their previous strategic room layout', () => {
    const seed = 'legacy-organic-room-contract';
    const oldA = new MapGenerator(1, seed, { legacyOrganicLayout: true });
    const oldB = new MapGenerator(1, seed, { legacyOrganicLayout: true });
    assert.deepEqual(
        oldA.paths.map(floor => floor.map(node => [node.id, node.type, node.connections])),
        oldB.paths.map(floor => floor.map(node => [node.id, node.type, node.connections]))
    );
    assert.equal(oldA.paths[4].filter(node => node.type === 'shop').length, 1);
    assert.equal(oldA.paths[6].filter(node => node.type === 'elite').length, 1);
});


test('all three acts preserve route reachability and strategic room guarantees across seeds', () => {
    for (const act of [1, 2, 3]) {
        for (let seed = 0; seed < 100; seed++) {
            const map = new MapGenerator(act, `act-${act}-seed-${seed}`);
            const reachable = reachableFromStart(map);
            assert.equal(map.floors, 16, `floor count for act ${act}, seed ${seed}`);
            assert.ok(reachable.has(map.paths[15][0].id), `boss unreachable in act ${act}, seed ${seed}`);
            assert.equal(map.paths[8][0].type, 'treasure');
            assert.equal(map.paths[14][0].type, 'rest');
            assert.equal(map.paths[15][0].type, 'boss');
            assert.equal(map.allNodes.filter(node => node.type === 'shop').length, 2);
            assert.equal(map.allNodes.filter(node => node.type === 'elite').length, 2);
            assert.ok(map.allNodes.every(node => reachable.has(node.id)),
                `unreachable node in act ${act}, seed ${seed}`);
        }
    }
});
