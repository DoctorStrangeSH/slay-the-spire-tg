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
    const elements = Object.fromEntries(['enemy-area', 'player-area', 'battle-screen'].map(id => [id, {
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
                    tag, removed: false, attrs: {}, children: [],
                    appendChild(child) { this.children.push(child); },
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
    assert.match(html, /js\/ui\/BattleFeedback\.js\?v=2026\.11\.15\.19/);
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

test('card casting effect gives distinct classes and a combination count', () => {
    const { feedback, elements, timers } = setup();
    feedback.cardsPlayed(['skill', 'attack', 'skill']);
    const marker = elements['battle-screen'].children.at(-1);
    assert.match(marker.className, /card-cast-fx--attack/);
    assert.equal(marker.attrs['aria-hidden'], 'true');
    assert.equal(marker.children[0].textContent, '╱');
    assert.equal(marker.children[1].textContent, '×3');
    const first = marker;
    feedback.cardsPlayed(['power']);
    assert.equal(first.removed, true);
    const second = elements['battle-screen'].children.at(-1);
    assert.match(second.className, /card-cast-fx--power/);
    assert.equal(second.children.length, 1);
    assert.equal(timers.size, 1);
    [...timers.values()][0]();
    assert.equal(second.removed, true);
    assert.equal(feedback.cardFxState.node, null);
    assert.equal(feedback.cardFxState.timer, null);
});

test('unknown cards cannot inject style classes and empty batches have no effect', () => {
    const { feedback, elements } = setup();
    feedback.cardsPlayed([]);
    feedback.cardsPlayed(['<img onerror=alert(1)>']);
    assert.equal(elements['battle-screen'].children.length, 0);
    feedback.cardsPlayed(['building']);
    assert.match(elements['battle-screen'].children[0].className, /card-cast-fx--building/);
});

test('cards are captured before play and effects only play for successful card use', () => {
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    const method = game.split('    playSelectedCards() {')[1].split('    endTurn() {')[0];
    assert.ok(method.indexOf('const playedTypes') < method.indexOf('this.currentBattle.playSelectedCards()'));
    assert.ok(method.indexOf('BattleFeedback.cardsPlayed(playedTypes, this.player.heroId, playedCards.map(card => card.id))') > method.indexOf('if (result.success)'));
    const css = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    for (const kind of ['attack', 'skill', 'power', 'building']) assert.ok(css.includes('card-cast-fx--' + kind));
    assert.match(css, /prefers-reduced-motion: reduce/);
});

test('three heroes have class-specific casting signatures', () => {
    for (const [hero, cardId, className, signature] of [
        ['berserk', 'bloodCut', 'card-cast-fx--berserk', 'Кровавая клятва'],
        ['engineer', 'rocket', 'card-cast-fx--engineer', 'Залп'],
        ['psyker', 'psyStrike', 'card-cast-fx--psyker', 'Пси-удар']
    ]) {
        const { feedback, elements } = setup();
        feedback.cardsPlayed(['attack'], hero, [cardId]);
        const marker = elements['battle-screen'].children.at(-1);
        assert.match(marker.className, new RegExp(className));
        assert.equal(marker.children[1].textContent, signature);
    }
});

test('unknown hero or mismatched signature cannot inject styles', () => {
    const { feedback, elements } = setup();
    feedback.cardsPlayed(['skill'], 'evil <img>', ['bloodCut']);
    let marker = elements['battle-screen'].children.at(-1);
    assert.match(marker.className, /card-cast-fx--neutral/);
    assert.equal(marker.children.length, 1);
    feedback.cardsPlayed(['attack'], 'psyker', ['bloodCut']);
    marker = elements['battle-screen'].children.at(-1);
    assert.match(marker.className, /card-cast-fx--psyker/);
    assert.equal(marker.children.length, 1);
});

test('game captures chosen card identities before resolving selected cards', () => {
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    const method = game.split('    playSelectedCards() {')[1].split('    endTurn() {')[0];
    assert.ok(method.indexOf('const playedCards') < method.indexOf('this.currentBattle.playSelectedCards()'));
    assert.match(method, /BattleFeedback\.cardsPlayed\(playedTypes, this\.player\.heroId, playedCards\.map\(card => card\.id\)\)/);
    const css = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    for (const hero of ['berserk', 'engineer', 'psyker']) assert.ok(css.includes('.card-cast-fx--' + hero));
});
