const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const feedbackSource = fs.readFileSync(path.join(root, 'js/ui/BattleFeedback.js'), 'utf8');

function fixture() {
    const nodes = new Map();
    function element(tag) {
        const item = {
            tag, children: [], attrs: {}, disabled: false, textContent: '',
            classList: { values: new Set(), add(value) { this.values.add(value); } },
            setAttribute(name, value) { this.attrs[name] = value; },
            append(...items) { this.children.push(...items); },
            appendChild(item) { this.children.push(item); },
            focus() { this.focused = true; },
            addEventListener(name, handler) { this.handler = handler; },
            remove() { nodes.delete(this.id); this.removed = true; }
        };
        return item;
    }
    const enemy = element('div');
    const player = element('div');
    nodes.set('enemy-area', enemy);
    nodes.set('player-area', player);
    const document = {
        getElementById(id) { return nodes.get(id) || null; },
        createElement: element,
        body: { appendChild(node) { nodes.set(node.id, node); } }
    };
    const feedback = vm.runInNewContext(feedbackSource + '\nBattleFeedback;', { document, setTimeout, clearTimeout });
    return { feedback, nodes, enemy, player };
}

test('victory finale renders reward and continues only once', () => {
    const { feedback, nodes, enemy } = fixture();
    let continued = 0;
    feedback.result({ victory: true, gold: 17, onContinue: () => continued++ });
    assert.ok(enemy.classList.values.has('fx-defeated'));
    const modal = nodes.get('battle-result-modal');
    assert.equal(modal.attrs['role'], 'dialog');
    const content = modal.children[0];
    assert.equal(content.children[1].textContent, 'Победа');
    assert.equal(content.children[3].textContent, '✦ +17 золота');
    const button = content.children[4];
    feedback.result({ victory: true, gold: 90, onContinue: () => continued += 100 });
    assert.equal(nodes.get('battle-result-modal'), modal);
    button.handler();
    button.handler();
    assert.equal(continued, 1);
    assert.equal(nodes.has('battle-result-modal'), false);
});

test('defeat finale has no reward and returns through callback', () => {
    const { feedback, nodes, player } = fixture();
    let returned = false;
    feedback.result({ victory: false, onContinue: () => { returned = true; } });
    assert.ok(player.classList.values.has('fx-defeated'));
    const content = nodes.get('battle-result-modal').children[0];
    assert.equal(content.children[1].textContent, 'Поражение');
    assert.equal(content.children.length, 4);
    content.children[3].handler();
    assert.equal(returned, true);
});

test('game replaces battle-end alerts but preserves gold and save semantics', () => {
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    const battleEnd = game.split('    endBattle(victory) {')[1].split('    offerCard() {')[0];
    assert.match(battleEnd, /this\.player\.gold \+= goldReward/);
    assert.match(battleEnd, /this\.runSave\.clear\(\)/);
    assert.match(battleEnd, /BattleFeedback\.result/);
    assert.doesNotMatch(battleEnd, /alert\(/);
    const css = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    assert.match(css, /cathedral-fall/);
    assert.match(css, /battle-result-content/);
    assert.match(css, /prefers-reduced-motion: reduce/);
});
