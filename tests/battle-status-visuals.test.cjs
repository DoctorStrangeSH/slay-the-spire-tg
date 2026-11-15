const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui/BattleUI.js'), 'utf8');

function fixture() {
    const nodes = [];
    const document = {
        createElement(tag) {
            assert.equal(tag, 'button');
            const el = {
                attrs: {}, tag,
                setAttribute(key, value) { this.attrs[key] = value; },
                addEventListener(type, handler) { this.handler = handler; }
            };
            nodes.push(el);
            return el;
        }
    };
    const ui = vm.runInNewContext(source + '\nBattleUI;', { document });
    const container = { children: [], appendChild(el) { this.children.push(el); } };
    return { ui, container };
}

test('statuses have distinct semantic, keyboard-accessible buttons and correct values', () => {
    const { ui, container } = fixture();
    let opened;
    ui.showStatusModal = effect => { opened = effect; };
    const effects = [
        { key: 'poison', icon: '☠️', value: 3, type: 'debuff', label: 'Яд', description: 'Урон в конце хода.' },
        { key: 'bleed', icon: '🩸', value: 2, type: 'debuff', label: 'Кровотечение', description: 'Урон в конце хода.' },
        { key: 'strength', icon: '💪', value: 1, type: 'buff', label: 'Сила', description: 'Больше урона.' },
        { key: 'weak', icon: '📉', value: 0, type: 'debuff', label: 'Слабость', description: 'Меньше урона.' }
    ];
    ui.renderStatusBadges(container, effects);
    assert.equal(container.children.length, 3);
    const [poison, bleed, strength] = container.children;
    assert.equal(poison.tag, 'button');
    assert.equal(poison.type, 'button');
    assert.match(poison.className, /status-poison/);
    assert.match(bleed.className, /status-bleed/);
    assert.match(strength.className, /status-strength/);
    assert.equal(poison.textContent, '☠️ 3');
    assert.match(poison.attrs['aria-label'], /Яд: 3/);
    poison.handler();
    assert.equal(opened, effects[0]);
});

test('invalid and inactive statuses do not render', () => {
    const { ui, container } = fixture();
    ui.renderStatusBadges(container, [
        { key: 'poison', value: NaN }, { key: 'poison', value: Infinity },
        { key: 'bleed', value: -1 }, { key: 'weak', value: 0 }
    ]);
    assert.equal(container.children.length, 0);
});

test('both combatants use the unified status renderer and CSS has motion fallback', () => {
    assert.equal(source.split('this.renderStatusBadges(effectsEl, effects)').length - 1, 2);
    assert.match(source, /document.getElementById\('status-modal'\)\?\.remove\(\)/);
    for (const id of ['strength', 'weak', 'vulnerable', 'bleed', 'poison', 'paralysis', 'echo', 'thorns']) {
        assert.match(source, new RegExp("key: '" + id + "'"));
    }
    const css = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    for (const id of ['poison', 'bleed', 'paralysis', 'vulnerable', 'weak', 'strength']) {
        assert.ok(css.includes('.effect-badge.status-' + id));
    }
    assert.match(css, /prefers-reduced-motion: reduce/);
});
