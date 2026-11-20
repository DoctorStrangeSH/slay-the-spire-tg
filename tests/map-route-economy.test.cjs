const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const constants = readFileSync(join(__dirname, '../js/config/constants.js'), 'utf8');
const source = readFileSync(join(__dirname, '../js/systems/MapGenerator.js'), 'utf8');
const MapGenerator = vm.runInNewContext(
    constants + '\\n' + source + '\\nMapGenerator;',
    { Math }
);

const ROOM_TYPES = ['battle', 'rest', 'shop', 'elite', 'event', 'treasure', 'secret', 'boss'];

function summarizeRoutes(map) {
    const byId = new Map(map.allNodes.map(node => [node.id, node]));
    const memo = new Map();

    function visit(node) {
        if (memo.has(node.id)) return memo.get(node.id);
        const children = node.connections.map(id => byId.get(id)).filter(Boolean);
        const own = Object.fromEntries(ROOM_TYPES.map(type => [type, node.type === type ? 1 : 0]));

        if (children.length === 0) {
            const leaf = {
                paths: 1,
                min: { ...own },
                max: { ...own },
                totals: { ...own },
                pathsWithoutRest: own.rest === 0 ? 1 : 0
            };
            memo.set(node.id, leaf);
            return leaf;
        }

        const childStats = children.map(visit);
        const paths = childStats.reduce((sum, item) => sum + item.paths, 0);
        const min = {};
        const max = {};
        const totals = {};
        for (const type of ROOM_TYPES) {
            min[type] = own[type] + Math.min(...childStats.map(item => item.min[type]));
            max[type] = own[type] + Math.max(...childStats.map(item => item.max[type]));
            totals[type] = own[type] * paths
                + childStats.reduce((sum, item) => sum + item.totals[type], 0);
        }
        const result = {
            paths,
            min,
            max,
            totals,
            pathsWithoutRest: own.rest > 0 ? 0
                : childStats.reduce((sum, item) => sum + item.pathsWithoutRest, 0)
        };
        memo.set(node.id, result);
        return result;
    }

    const start = map.paths[0][0];
    return visit(start);
}

test('measure actual room supply and route economy across all acts', () => {
    const report = [];
    for (const act of [1, 2, 3]) {
        const samples = [];
        for (let seed = 0; seed < 250; seed++) {
            const map = new MapGenerator(act, `route-economy-act-${act}-seed-${seed}`);
            const routes = summarizeRoutes(map);
            assert.ok(routes.paths > 0, `no complete route for act ${act}, seed ${seed}`);
            assert.equal(routes.min.boss, 1);
            assert.equal(routes.max.boss, 1);
            assert.ok(routes.min.rest >= 1,
                `a route reaches the boss without a rest in act ${act}, seed ${seed}`);
            assert.equal(map.paths[14][0].type, 'rest');

            const count = type => map.allNodes.filter(node => node.type === type).length;
            samples.push({
                routeCount: routes.paths,
                roomCounts: Object.fromEntries(ROOM_TYPES.map(type => [type, count(type)])),
                averagePerRoute: Object.fromEntries(ROOM_TYPES.map(type => [
                    type, routes.totals[type] / routes.paths
                ])),
                minPerRoute: routes.min,
                maxPerRoute: routes.max,
                routesWithoutRest: routes.pathsWithoutRest
            });
        }

        const average = selector => samples.reduce((sum, item) => sum + selector(item), 0) / samples.length;
        const types = Object.fromEntries(ROOM_TYPES.map(type => [type, {
            averageRoomsOnMap: Number(average(item => item.roomCounts[type]).toFixed(2)),
            averageRoomsPerRoute: Number(average(item => item.averagePerRoute[type]).toFixed(2)),
            minimumRoomsPerRoute: Math.min(...samples.map(item => item.minPerRoute[type])),
            maximumRoomsPerRoute: Math.max(...samples.map(item => item.maxPerRoute[type]))
        }]));
        report.push({
            act,
            maps: samples.length,
            averageCompleteRoutesPerMap: Number(average(item => item.routeCount).toFixed(2)),
            mapsWithAnyRouteWithoutRest: samples.filter(item => item.routesWithoutRest > 0).length,
            rooms: types
        });
    }
    console.log('ACT_ROUTE_ECONOMY_DIAGNOSTIC ' + JSON.stringify(report));
});
