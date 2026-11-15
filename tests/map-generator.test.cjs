// node --test tests/map-generator.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const constants = readFileSync(join(__dirname, '../js/config/constants.js'), 'utf8');
const source = readFileSync(join(__dirname, '../js/systems/MapGenerator.js'), 'utf8');
const MapGenerator = vm.runInNewContext(constants + '\n' + source + '\nMapGenerator;', { Math });

const snapshot = map => JSON.stringify(map.paths.map(floor =>
    floor.map(node => ({ id: node.id, type: node.type, connections: node.connections }))
));

test('same seed reproduces identical node types and connections', () => {
    assert.equal(snapshot(new MapGenerator(1, 'shared-run')), snapshot(new MapGenerator(1, 'shared-run')));
});

test('different seeds produce different maps', () => {
    assert.notEqual(snapshot(new MapGenerator(1, 'alpha')), snapshot(new MapGenerator(1, 'beta')));
});

test('each generated node except boss has a valid outgoing route', () => {
    for (let seed = 0; seed < 50; seed++) {
        const map = new MapGenerator(1, seed);
        for (const node of map.allNodes) {
            if (node.floor === map.floors - 1) continue;
            assert.ok(node.connections.length > 0, 'missing exit from ' + node.id + ' on seed ' + seed);
            for (const id of node.connections) {
                const next = map.findNodeById(id);
                assert.ok(next, 'missing target ' + id);
                assert.equal(next.floor, node.floor + 1);
            }
        }
    }
});

test('available routes come only from current node, never from visited siblings', () => {
    const map = new MapGenerator(1, 'route-guard');
    const first = map.paths[1];
    assert.ok(first.length >= 2);
    const current = first[0];
    const sibling = first[1];
    // Тесту нужны две независимые цели, независимо от случайного заполнения этажа.
    if (map.paths[2].length < 2) map.createNode(2, 4, 'battle');
    current.connections = [map.paths[2][0].id];
    sibling.connections = [map.paths[2][1].id];
    current.visited = true;
    sibling.visited = true;
    const available = map.getAvailableNodes(current.id);
    assert.deepEqual(Array.from(available, node => node.id), [map.paths[2][0].id]);
});
