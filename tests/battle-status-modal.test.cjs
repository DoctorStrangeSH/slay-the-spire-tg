// node --test tests/battle-status-modal.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function boot() {
    const elements = new Map();
    const documentListeners = new Map();
    const document = {
        activeElement: null,
        body: null,
        createElement(tag) {
            const listeners = new Map();
            const element = {
                tagName: tag.toUpperCase(),
                children: [],
                attributes: {},
                style: {},
                dataset: {},
                isConnected: false,
                className: '',
                textContent: '',
                setAttribute(name, value) { this.attributes[name] = String(value); },
                appendChild(child) {
                    this.children.push(child);
                    child.isConnected = true;
                    return child;
                },
                append(...children) { children.forEach(child => this.appendChild(child)); },
                addEventListener(name, callback) {
                    if (!listeners.has(name)) listeners.set(name, []);
                    listeners.get(name).push(callback);
                },
                dispatch(name, event = {}) {
                    for (const callback of listeners.get(name) || []) callback({
                        target: this,
                        preventDefault() { this.defaultPrevented = true; },
                        ...event
                    });
                },
                focus() { document.activeElement = this; },
                remove() {
                    this.isConnected = false;
                    if (this.id) elements.delete(this.id);
                }
            };
            Object.defineProperty(element, 'id', {
                get() { return this._id || ''; },
                set(value) { this._id = value; elements.set(value, this); }
            });
            return element;
        },
        getElementById(id) { return elements.get(id) || null; },
        addEventListener(name, callback) {
            if (!documentListeners.has(name)) documentListeners.set(name, []);
            documentListeners.get(name).push(callback);
        },
        removeEventListener(name, callback) {
            documentListeners.set(name, (documentListeners.get(name) || []).filter(item => item !== callback));
        },
        dispatch(name, event = {}) {
            for (const callback of documentListeners.get(name) || []) callback(event);
        },
        listenerCount(name) { return (documentListeners.get(name) || []).length; }
    };
    document.body = document.createElement('body');
    const source = readFileSync(join(__dirname, '../js/ui/BattleUI.js'), 'utf8');
    const BattleUI = vm.runInNewContext(source + '\nBattleUI;', { document, console });
    const trigger = document.createElement('button');
    trigger.isConnected = true;
    document.activeElement = trigger;
    return { BattleUI, document, trigger };
}

test('status details expose dialog semantics and close with Escape, restoring focus', () => {
    const { BattleUI, document, trigger } = boot();
    BattleUI.showStatusModal({
        icon: '☠️',
        name: 'Яд',
        value: 3,
        description: 'Урон в конце хода.'
    }, trigger);

    const modal = document.getElementById('status-modal');
    assert.equal(modal.attributes.role, 'dialog');
    assert.equal(modal.attributes['aria-modal'], 'true');
    assert.equal(modal.attributes['aria-label'], 'Состояние: Яд');
    assert.equal(document.activeElement.textContent, 'Закрыть');
    assert.equal(document.listenerCount('keydown'), 1);

    let prevented = false;
    document.dispatch('keydown', {
        key: 'Escape',
        preventDefault() { prevented = true; }
    });
    assert.equal(prevented, true);
    assert.equal(document.getElementById('status-modal'), null);
    assert.equal(document.listenerCount('keydown'), 0);
    assert.equal(document.activeElement, trigger);
});

test('status dialog close button and backdrop restore focus without leaking listeners', () => {
    const { BattleUI, document, trigger } = boot();
    BattleUI.showStatusModal({
        icon: '🛡️', name: 'Блок', value: 12, description: 'Поглощает урон.'
    }, trigger);
    const modal = document.getElementById('status-modal');
    const panel = modal.children[0];
    const closeButton = panel.children[3];
    closeButton.dispatch('click');
    assert.equal(document.getElementById('status-modal'), null);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.listenerCount('keydown'), 0);

    BattleUI.showStatusModal({
        icon: '🛡️', name: 'Блок', value: 12, description: 'Поглощает урон.'
    }, trigger);
    const second = document.getElementById('status-modal');
    second.dispatch('click', { target: second });
    assert.equal(document.getElementById('status-modal'), null);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.listenerCount('keydown'), 0);
});

test('opening a second status dialog cleans up the first dialog and its Escape listener', () => {
    const { BattleUI, document, trigger } = boot();
    BattleUI.showStatusModal({
        icon: '☠️', name: 'Яд', value: 3, description: 'Урон.'
    }, trigger);
    const first = document.getElementById('status-modal');

    BattleUI.showStatusModal({
        icon: '💪', name: 'Сила', value: 2, description: 'Урон атак.'
    }, trigger);
    const second = document.getElementById('status-modal');

    assert.notEqual(first, second);
    assert.equal(first.isConnected, false);
    assert.equal(second.attributes['aria-label'], 'Состояние: Сила');
    assert.equal(document.listenerCount('keydown'), 1);
});
