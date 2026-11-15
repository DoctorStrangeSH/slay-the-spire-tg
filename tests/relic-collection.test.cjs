const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/systems/Game.js'), 'utf8');

function element(tag = 'div') {
    return {
        tag, children: [], style: {}, textContent: '', className: '', id: '',
        appendChild(child) { this.children.push(child); child.parent = this; },
        insertBefore(child, anchor) { this.children.push(child); child.parent = this; },
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    };
}
function makeGame(relics) {
    const nodes = element();
    const map = element();
    const body = element('body');
    const elements = { 'map-screen': map, 'map-nodes': nodes };
    const doc = {
        body,
        createElement: element,
        getElementById(id) {
            if (id === 'relics-modal') return body.children.find(el => el.id === id) || null;
            if (id === 'map-relics-button') return map.children.find(el => el.id === id) || null;
            return elements[id] || null;
        }
    };
    const Game = vm.runInNewContext(source + '\nGame;', {
        document: doc,
        RELIC_CATALOG: {
            emberBattery: { id: 'emberBattery', emoji: '🔥', name: 'Угольное сердце', description: '+1 энергия.' }
        },
        RunSave: class {},
        GAME_CONFIG: { maxActs: 3 }
    });
    const game = new Game();
    game.player = { relics };
    return { game, doc, body, map };
}

test('collection shows actual owned relic effects', () => {
    const { game, body } = makeGame(['emberBattery']);
    game.showRelics();
    assert.equal(body.children.length, 1);
    const entries = body.children[0].children[0].children;
    assert.equal(entries[1].children[0].textContent, '🔥 Угольное сердце');
    assert.equal(entries[1].children[1].textContent, '+1 энергия.');
});

test('unknown saved relics remain safe and show a fallback', () => {
    const { game, body } = makeGame(['<img src=x onerror=alert(1)>']);
    game.showRelics();
    const entry = body.children[0].children[0].children[1];
    assert.equal(entry.children[0].textContent, '💎 Неизвестная реликвия');
});

test('opening collection twice replaces old modal and closes cleanly', () => {
    const { game, body } = makeGame([]);
    game.showRelics();
    game.showRelics();
    assert.equal(body.children.length, 1);
    const content = body.children[0].children[0];
    assert.match(content.children[1].textContent, /Пока нет реликвий/);
    content.children.at(-1).onclick();
    assert.equal(body.children.length, 0);
});

test('map relic shortcut is reused when map is rerendered', () => {
    const { game, map } = makeGame(['emberBattery']);
    game.renderMapRelicButton();
    game.renderMapRelicButton();
    assert.equal(map.children.length, 1);
    assert.equal(map.children[0].textContent, '💎 Реликвии (1)');
});
