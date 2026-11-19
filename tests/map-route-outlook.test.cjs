const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const constants = readFileSync(join(__dirname, '../js/config/constants.js'), 'utf8');
const source = readFileSync(join(__dirname, '../js/ui/MapUI.js'), 'utf8');
const MapUI = vm.runInNewContext(constants + '\n' + source + '\nMapUI;', { window: {} });

function mapOf(rooms) {
    const byId = new Map(rooms.map(room => [room.id, room]));
    return { findNodeById: id => byId.get(id) };
}

test('two-move outlook only lists genuinely reachable special rooms', () => {
    const rooms = [
        { id: 'chosen', connections: ['left'] },
        { id: 'left', connections: ['rest', 'battle'] },
        { id: 'rest', type: 'rest' },
        { id: 'battle', type: 'battle' },
        { id: 'unreachable', type: 'elite' }
    ];
    const result = MapUI.getRouteOutlook(rooms[0], mapOf(rooms));
    assert.match(result, /Через 2 перехода возможны/);
    assert.match(result, /Отдых/);
    assert.doesNotMatch(result, /Элита|неизбежно/);
});

test('two-move outlook recognises a guaranteed room across multiple paths', () => {
    const rooms = [
        { id: 'chosen', connections: ['left', 'right'] },
        { id: 'left', connections: ['rest1'] },
        { id: 'right', connections: ['rest2'] },
        { id: 'rest1', type: 'rest' },
        { id: 'rest2', type: 'rest' }
    ];
    assert.match(MapUI.getRouteOutlook(rooms[0], mapOf(rooms)), /Отдых — неизбежно/);
});

test('two-move outlook handles converging paths and no future milestone', () => {
    const rooms = [
        { id: 'chosen', connections: ['left', 'right'] },
        { id: 'left', connections: ['same'] },
        { id: 'right', connections: ['same'] },
        { id: 'same', type: 'shop' }
    ];
    assert.match(MapUI.getRouteOutlook(rooms[0], mapOf(rooms)), /Магазин — неизбежно/);
    assert.equal(MapUI.getRouteOutlook({ connections: ['missing'] }, mapOf(rooms)), '');
    assert.equal(MapUI.getRouteOutlook({ connections: [] }, mapOf(rooms)), '');
    assert.equal(MapUI.getRouteOutlook({ connections: ['left'] },
        mapOf([{ id: 'left', connections: ['fight'] }, { id: 'fight', type: 'battle' }])), '');
});
