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
});

test('Telegram viewport changes update the game layout height', () => {
    const { tg, properties, viewportChanged } = bootTelegramApp(720);
    tg.viewportStableHeight = 604;
    viewportChanged();
    assert.equal(properties['--game-viewport-height'], '604px');
});

test('invalid Telegram viewport height does not overwrite the last valid value', () => {
    const { tg, properties, viewportChanged } = bootTelegramApp(720);
    tg.viewportStableHeight = 0;
    tg.viewportHeight = Number.NaN;
    viewportChanged();
    assert.equal(properties['--game-viewport-height'], '720px');
});
