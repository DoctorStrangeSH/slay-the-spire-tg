const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/ui/MapUI.js'), 'utf8');
const NODE_TYPES = {
    START: 'start',
    BATTLE: 'battle',
    ELITE: 'elite',
    REST: 'rest',
    EVENT: 'event',
    SECRET: 'secret',
    TREASURE: 'treasure',
    SHOP: 'shop',
    BOSS: 'boss'
};

function createElement(tag) {
    return {
        tag,
        attributes: {},
        children: [],
        listeners: {},
        style: {},
        setAttribute(name, value) { this.attributes[name] = String(value); },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(name, callback) { this.listeners[name] = callback; }
    };
}

function setup() {
    const node = { id: 'battle-2-0', type: NODE_TYPES.BATTLE, floor: 2, x: 0, visited: false };
    const selected = [];
    const document = { createElementNS: (_namespace, tag) => createElement(tag) };
    const window = { _currentMapPaths: [[], [], [node]], _currentMapOrganicLayout: false };
    const context = {
        NODE_TYPES,
        document,
        window,
        Math,
        console
    };
    const MapUI = vm.runInNewContext(source + '\nMapUI;', context);
    const game = { player: { relics: [] }, selectMapNode: target => selected.push(target.id) };
    const group = MapUI.createNodeElement(node, 2, 'svg', 320, 20, 10, 40, [node], 1, game);
    return { MapUI, node, selected, group };
}

test('available map rooms expose an accessible button and descriptive label', () => {
    const { group } = setup();
    assert.equal(group.attributes.role, 'button');
    assert.equal(group.attributes.tabindex, '0');
    assert.match(group.attributes['aria-label'], /Обычный бой/);
    assert.match(group.attributes['aria-label'], /доступно/);
    assert.ok(group.children.some(child => child.attributes.class === 'spire-room-hit-target'));
});

test('Enter and Space activate an available map room exactly once', () => {
    const { group, selected, node } = setup();
    for (const key of ['Enter', ' ']) {
        let prevented = false;
        let stopped = false;
        group.listeners.keydown({
            key,
            preventDefault() { prevented = true; },
            stopPropagation() { stopped = true; }
        });
        assert.equal(prevented, true, key);
        assert.equal(stopped, true, key);
        assert.equal(selected.at(-1), node.id);
    }
    assert.equal(selected.length, 2);
});

test('unavailable map rooms are not exposed as keyboard buttons', () => {
    const { MapUI, node } = setup();
    const document = { createElementNS: (_namespace, tag) => createElement(tag) };
    const context = { NODE_TYPES, document, window: { _currentMapPaths: [[], [], [node]] }, Math, console };
    const isolated = vm.runInNewContext(source + '\nMapUI;', context);
    const game = { player: { relics: [] }, selectMapNode() { assert.fail('unavailable room must not activate'); } };
    const group = isolated.createNodeElement(node, 2, 'svg', 320, 20, 10, 40, [], 1, game);
    assert.equal(group.attributes.role, undefined);
    assert.equal(group.attributes.tabindex, undefined);
    assert.equal(group.listeners.keydown, undefined);
});
