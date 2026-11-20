const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/main.js'), 'utf8');

function bootTelegramApp(initialHeight = 720) {
    let ready;
    let viewportChanged;
    const properties = {};
    const elements = {
        'app-version': { textContent: '' },
        'loading-screen': { style: {} },
        'main-menu': { style: {} }
    };
    const tg = {
        viewportStableHeight: initialHeight,
        viewportHeight: initialHeight + 20,
        backgroundColor: '#000',
        textColor: '#fff',
        ready() {},
        expand() {},
        onEvent(name, callback) {
            if (name === 'viewportChanged') viewportChanged = callback;
        }
    };
    const document = {
        addEventListener(name, callback) { if (name === 'DOMContentLoaded') ready = callback; },
        querySelector() { return { content: 'test-build' }; },
        getElementById(id) { return elements[id] || null; },
        body: { style: {} },
        documentElement: { style: { setProperty(name, value) { properties[name] = value; } } }
    };
    class Game { showMenu() {} }
    vm.runInNewContext(source, { document, window: { Telegram: { WebApp: tg } }, Game });
    ready();
    return { tg, properties, viewportChanged };
}

test('Telegram stable viewport height is applied to game layout', () => {
    const { properties } = bootTelegramApp(720);
    assert.equal(properties['--game-viewport-height'], '720px');
    const expected = { 93: 670, 92: 662, 90: 648, 88: 634, 85: 612, 77: 554,
        75: 540, 73: 526, 52: 374, 47: 338, 34: 245, 31: 223, 29: 209,
        26: 187, 25: 180, 18: 130, 9: 65 };
    for (const [fraction, pixels] of Object.entries(expected)) {
        assert.equal(properties[`--game-viewport-${fraction}`], `${pixels}px`);
    }
});

test('Telegram viewport changes update the game layout height', () => {
    const { tg, properties, viewportChanged } = bootTelegramApp(720);
    tg.viewportStableHeight = 604;
    viewportChanged();
    assert.equal(properties['--game-viewport-height'], '604px');
    const expected = { 93: 562, 92: 556, 90: 544, 88: 532, 85: 513, 77: 465,
        75: 453, 73: 441, 52: 314, 47: 284, 34: 205, 31: 187, 29: 175,
        26: 157, 25: 151, 18: 109, 9: 54 };
    for (const [fraction, pixels] of Object.entries(expected)) {
        assert.equal(properties[`--game-viewport-${fraction}`], `${pixels}px`);
    }
});

test('viewportHeight is used when stable height is unavailable', () => {
    const { tg, properties, viewportChanged } = bootTelegramApp(720);
    tg.viewportStableHeight = undefined;
    tg.viewportHeight = 680;
    viewportChanged();
    assert.equal(properties['--game-viewport-height'], '680px');
});

test('invalid Telegram viewport height does not overwrite the last valid value', () => {
    const { tg, properties, viewportChanged } = bootTelegramApp(720);
    tg.viewportStableHeight = 0;
    tg.viewportHeight = Number.NaN;
    viewportChanged();
    assert.equal(properties['--game-viewport-height'], '720px');
});
