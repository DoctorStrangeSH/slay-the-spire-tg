const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const helperSource = source.slice(0, source.indexOf('// Основная игровая логика'));

function createHarness() {
    const listeners = new Map();
    const document = {
        activeElement: null,
        addEventListener(name, callback) {
            const set = listeners.get(name) || new Set();
            set.add(callback);
            listeners.set(name, set);
        },
        removeEventListener(name, callback) {
            listeners.get(name)?.delete(callback);
        },
        dispatch(event) {
            for (const callback of [...(listeners.get(event.type) || [])]) callback(event);
        },
        listenerCount(name) { return listeners.get(name)?.size || 0; }
    };
    const context = { document };
    const bind = vm.runInNewContext(helperSource + '\nbindGameModalAccessibility;', context);
    function element(name) {
        return {
            name,
            isConnected: true,
            hidden: false,
            attributes: {},
            focusCalls: [],
            setAttribute(key, value) { this.attributes[key] = value; },
            getAttribute(key) { return this.attributes[key] ?? null; },
            focus(options) {
                this.focusCalls.push(options);
                document.activeElement = this;
            }
        };
    }
    function modal(name, controls) {
        const root = element(name);
        root.controls = controls;
        root.querySelectorAll = () => root.controls;
        root.contains = target => target === root || root.controls.includes(target);
        return root;
    }
    function key(keyName, shiftKey = false) {
        let prevented = false;
        document.dispatch({
            type: 'keydown',
            key: keyName,
            shiftKey,
            preventDefault() { prevented = true; }
        });
        return prevented;
    }
    return { bind, document, element, modal, key };
}

test('modal receives dialog semantics, label and initial focus', () => {
    const h = createHarness();
    const opener = h.element('opener');
    const first = h.element('first');
    const dialog = h.modal('dialog', [first]);
    h.document.activeElement = opener;

    const access = h.bind(dialog, { label: 'Настройки', initialFocus: first });
    assert.equal(dialog.attributes.role, 'dialog');
    assert.equal(dialog.attributes['aria-modal'], 'true');
    assert.equal(dialog.attributes['aria-label'], 'Настройки');
    assert.equal(h.document.activeElement, first);
    access.cleanup(false);
});

test('Tab and Shift+Tab wrap focus inside the active dialog', () => {
    const h = createHarness();
    const first = h.element('first');
    const last = h.element('last');
    const dialog = h.modal('dialog', [first, last]);
    h.bind(dialog, { initialFocus: first });

    h.document.activeElement = last;
    assert.equal(h.key('Tab'), true);
    assert.equal(h.document.activeElement, first);

    h.document.activeElement = first;
    assert.equal(h.key('Tab', true), true);
    assert.equal(h.document.activeElement, last);
    dialog.__gameModalCleanup(false);
});

test('nested dialogs suspend parent keyboard handling until the child closes', () => {
    const h = createHarness();
    const parentButton = h.element('parent-button');
    const childButton = h.element('child-button');
    const parent = h.modal('parent', [parentButton]);
    const child = h.modal('child', [childButton]);
    let parentEscape = 0;
    let childEscape = 0;
    const parentAccess = h.bind(parent, { onEscape: () => parentEscape++ });
    const childAccess = h.bind(child, { onEscape: () => childEscape++ });

    assert.equal(h.key('Escape'), true);
    assert.equal(parentEscape, 0);
    assert.equal(childEscape, 1);

    childAccess.cleanup(false);
    assert.equal(h.key('Escape'), true);
    assert.equal(parentEscape, 1);
    parentAccess.cleanup(false);
});

test('cleanup removes key listener and restores focus to the connected opener', () => {
    const h = createHarness();
    const opener = h.element('opener');
    const close = h.element('close');
    const dialog = h.modal('dialog', [close]);
    h.document.activeElement = opener;
    const access = h.bind(dialog, { initialFocus: close });

    assert.equal(h.document.listenerCount('keydown'), 1);
    access.cleanup();
    assert.equal(h.document.listenerCount('keydown'), 0);
    assert.equal(h.document.activeElement, opener);
    assert.deepEqual(opener.focusCalls[0], { preventScroll: true });
});

test('dialog without focusable controls keeps Tab focus on the dialog itself', () => {
    const h = createHarness();
    const dialog = h.modal('empty-dialog', []);
    h.bind(dialog);
    assert.equal(h.key('Tab'), true);
    assert.equal(h.document.activeElement, dialog);
    dialog.__gameModalCleanup(false);
});
