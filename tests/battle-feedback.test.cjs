const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui/BattleFeedback.js'), 'utf8');

function setup() {
    const effects = new Map();
    let timerId = 0;
    const timers = new Map();
    const elements = Object.fromEntries(['enemy-area', 'player-area'].map(id => [id, {
        classes: new Set(),
        classList: {
            add(name) { elements[id].classes.add(name); },
            remove(...names) { names.forEach(name => elements[id].classes.delete(name)); }
        },
        offsetWidth: 320,
        children: [],
        appendChild(child) { this.children.push(child); }
    }]));
    const context = vm.createContext({
        document: {
            getElementById(id) { return elements[id] || null; },
            createElement(tag) {
                return {
                    tag, removed: false, attrs: {},
                    setAttribute(key, value) { this.attrs[key] = value; },
                    remove() { this.removed = true; }
                };
            }
        },
        setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); }
    });
    return { feedback: vm.runInContext(source + '\nBattleFeedback;', context), elements, timers };
}

test('damage and shield feedback reflect health and block deltas without mutation', () => {
    const { feedback, elements } = setup();
    const battle = { enemy: { hp: 20 }, enemyBlock: 0, player: { hp: 40 }, block: 0 };
    const before = feedback.snapshot(battle);
    battle.enemy.hp = 15;
    battle.block = 5;
    feedback.show(before, battle);
    assert.ok(elements['enemy-area'].classes.has('fx-damage'));
    assert.ok(elements['player-area'].classes.has('fx-shield'));
    assert.equal(battle.enemy.hp, 15);
    assert.equal(battle.block, 5);
});

test('enemy shield and hero hit show corresponding responses', () => {
    const { feedback, elements } = setup();
    const battle = { enemy: { hp: 20 }, enemyBlock: 0, player: { hp: 40 }, block: 0 };
    const before = feedback.snapshot(battle);
    battle.enemyBlock = 12;
    battle.player.hp = 31;
    feedback.show(before, battle);
    assert.ok(elements['enemy-area'].classes.has('fx-shield'));
    assert.ok(elements['player-area'].classes.has('fx-damage'));
});

test('rapid repeated damage restarts animation and timers clean up', () => {
    const { feedback, elements, timers } = setup();
    feedback.flash('enemy-area', 'fx-damage');
    feedback.flash('enemy-area', 'fx-damage');
    assert.equal(timers.size, 1);
    assert.ok(elements['enemy-area'].classes.has('fx-damage'));
    [...timers.values()][0]();
    assert.ok(!elements['enemy-area'].classes.has('fx-damage'));
    feedback.show(null, null);
});

test('game loads feedback before controllers and invokes it after moves', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    assert.match(html, /js\/ui\/BattleFeedback\.js\?v=2026\.11\.15\.16/);
    assert.match(game, /BattleFeedback\.snapshot\(this\.currentBattle\)/);
    assert.match(game, /BattleFeedback\.show\(before, this\.currentBattle\)/);
    assert.match(css, /prefers-reduced-motion: reduce/);
});

test('enemy arrival replays without stacking timers or changing combat values', () => {
    const { feedback, elements, timers } = setup();
    const battle = { enemy: { hp: 19 }, enemyBlock: 0, player: { hp: 40 }, block: 0 };
    const before = feedback.snapshot(battle);
    feedback.enter('enemy-area');
    feedback.enter('enemy-area');
    assert.equal(timers.size, 1);
    assert.ok(elements['enemy-area'].classes.has('fx-enter'));
    [...timers.values()][0]();
    assert.ok(!elements['enemy-area'].classes.has('fx-enter'));
    assert.equal(battle.enemy.hp, before.enemyHp);
    feedback.enter('unknown-area');
});

test('enemy intent includes readable captions and accessible descriptive labels', () => {
    const ui = fs.readFileSync(path.join(root, 'js/ui/BattleUI.js'), 'utf8');
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    assert.match(ui, /intentEl\.setAttribute\('aria-label', intentLabel\)/);
    assert.match(ui, /intent-caption/);
    assert.match(ui, /Следующее действие: атака/);
    assert.match(ui, /Следующее действие: получает/);
    assert.match(ui, /Паралич: враг пропустит ход/);
    assert.match(game, /BattleFeedback\.enter\('enemy-area'\)/);
    assert.match(css, /cathedral-enemy-arrival/);
    assert.match(css, /prefers-reduced-motion: reduce/);
});

test('floating combat numbers report real damage/block and ignore invalid values', () => {
    const { feedback, elements } = setup();
    const battle = { enemy: { hp: 18 }, enemyBlock: 0, player: { hp: 30 }, block: 0 };
    const before = feedback.snapshot(battle);
    battle.enemy.hp = 11;
    battle.block = 4;
    feedback.show(before, battle);
    const enemyMarker = elements['enemy-area'].children.at(-1);
    const playerMarker = elements['player-area'].children.at(-1);
    assert.equal(enemyMarker.textContent, '−7');
    assert.match(enemyMarker.className, /battle-float--damage/);
    assert.equal(playerMarker.textContent, '+4 🛡');
    assert.equal(enemyMarker.attrs['aria-hidden'], 'true');
    assert.equal(battle.enemy.hp, 11);
    const count = elements['enemy-area'].children.length;
    feedback.float('enemy-area', NaN, 'damage');
    feedback.float('enemy-area', 0, 'damage');
    assert.equal(elements['enemy-area'].children.length, count);
});

test('repeated floating hits replace the previous marker and clear stale timer', () => {
    const { feedback, elements, timers } = setup();
    feedback.float('enemy-area', 3, 'damage');
    const first = elements['enemy-area'].children.at(-1);
    feedback.float('enemy-area', 8, 'damage');
    const second = elements['enemy-area'].children.at(-1);
    assert.equal(first.removed, true);
    assert.equal(second.removed, false);
    assert.equal(second.textContent, '−8');
    assert.equal(timers.size, 1);
    [...timers.values()][0]();
    assert.equal(second.removed, true);
    assert.equal(feedback.floatNodes.size, 0);
    assert.equal(feedback.floatTimers.size, 0);
});

test('floating numbers respect reduced motion', () => {
    const css = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    assert.match(css, /cathedral-float-number/);
    assert.match(css, /\.battle-float--damage/);
    assert.match(css, /\.battle-float--shield/);
    assert.match(css, /prefers-reduced-motion: reduce/);
});
