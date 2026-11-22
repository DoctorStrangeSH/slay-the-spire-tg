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
        documentElement: {
            attributes: {},
            setAttribute(name, value) { this.attributes[name] = value; },
            style: { setProperty(name, value) { properties[name] = value; } }
        }
    };
    class Game { showMenu() {} }
    vm.runInNewContext(source, { document, window: { Telegram: { WebApp: tg } }, Game });
    ready();
    return { tg, properties, viewportChanged, root: document.documentElement };
}

test('Telegram stable viewport height is applied to game layout', () => {
    const { properties } = bootTelegramApp(720);
    assert.equal(properties['--game-viewport-height'], '720px');
    const expected = { 93: 670, 92: 662, 90: 648, 88: 634, 85: 612, 77: 554,
        75: 540, 73: 526, 52: 374, 47: 338, 34: 245, 31: 223, 29: 209,
        26: 187, 25: 180, 18: 130, 9: 65, 8: 58 };
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
        26: 157, 25: 151, 18: 109, 9: 54, 8: 48 };
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

test('Telegram stable height activates compact layout even when CSS viewport is taller', () => {
    const { root, tg, viewportChanged } = bootTelegramApp(720);
    assert.equal(root.attributes['data-game-viewport-height'], 'normal');
    tg.viewportStableHeight = 604;
    viewportChanged();
    assert.equal(root.attributes['data-game-viewport-height'], 'compact');
    tg.viewportStableHeight = 500;
    viewportChanged();
    assert.equal(root.attributes['data-game-viewport-height'], 'short');
    tg.viewportStableHeight = 680;
    viewportChanged();
    assert.equal(root.attributes['data-game-viewport-height'], 'normal');
});

test('invalid Telegram height preserves the previous compact mode', () => {
    const { root, tg, viewportChanged } = bootTelegramApp(604);
    assert.equal(root.attributes['data-game-viewport-height'], 'compact');
    tg.viewportStableHeight = 0;
    tg.viewportHeight = Number.NaN;
    viewportChanged();
    assert.equal(root.attributes['data-game-viewport-height'], 'compact');
});


test('achievement and cosmetic journal fits Telegram mobile viewport and safe areas', () => {
    const styles = readFileSync(join(__dirname, '../css/cathedral.css'), 'utf8');
    assert.ok(styles.includes('max-height: min(var(--game-viewport-88, 88dvh), 780px); overflow-y: auto;'));
    assert.ok(styles.includes('.run-journal-modal { padding: max(8px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom)); }'));
    assert.ok(styles.includes('.run-journal-content { max-height: var(--game-viewport-93, 93dvh); padding: 16px; }'));
    assert.ok(styles.includes('.cathedral-challenge-group summary { cursor: pointer; padding: 12px 4px; min-height: 44px;'));
    assert.ok(styles.includes('grid-template-columns: minmax(0, 1fr);'));
});

test('mobile battle keeps the enemy, player, hand and controls inside the Telegram viewport', () => {
    const styles = readFileSync(join(__dirname, '../css/cathedral.css'), 'utf8');
    assert.ok(styles.includes('height: var(--game-viewport-height, 100dvh);'));
    assert.ok(styles.includes('overflow: hidden;\n    display: flex;\n    flex-direction: column;'));
    assert.ok(styles.includes('height: clamp(125px, var(--game-viewport-26, 26dvh), 172px);'));
    assert.ok(styles.includes('overflow-x: auto;\n    overflow-y: hidden;\n    touch-action: pan-x;'));
});

test('mobile battle actions use a six-column thumb-friendly grid', () => {
    const styles = readFileSync(join(__dirname, '../css/cathedral.css'), 'utf8');
    assert.ok(styles.includes('display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));'));
    assert.ok(styles.includes('grid-template-columns: repeat(6, minmax(0, 1fr));'));
    assert.ok(styles.includes('#action-buttons .play-btn, #action-buttons .end-btn {\n    grid-column: span 3;'));
    assert.ok(styles.includes('#action-buttons .relic-btn, #action-buttons .deck-btn,\n  #action-buttons .discard-btn {\n    grid-column: span 2;'));
    assert.ok(styles.includes('min-height: 44px;'));
});

test('short Telegram viewports keep battle actions reachable while the battlefield scrolls', () => {
    const styles = readFileSync(join(__dirname, '../css/cathedral.css'), 'utf8');
    assert.ok(styles.includes('@media (max-width: 640px) and (max-height: 520px)'));
    assert.ok(styles.includes('position: sticky;\n    bottom: 0;\n    z-index: 12;'));
    assert.ok(styles.includes('padding: 5px 3px max(5px, env(safe-area-inset-bottom));'));
    assert.ok(styles.includes('overscroll-behavior-y: contain;'));
});
