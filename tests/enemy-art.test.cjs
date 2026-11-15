const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui/EnemyArt.js'), 'utf8');
const EnemyArt = vm.runInNewContext(source + '\nEnemyArt;');

test('ordinary enemies have four distinct local SVG illustrations', () => {
    const sources = new Set();
    for (const id of ['slime', 'goblin', 'skeleton', 'wolf']) {
        const portrait = EnemyArt.get(id);
        assert.ok(portrait?.alt);
        assert.ok(!sources.has(portrait.src));
        sources.add(portrait.src);
        const svg = fs.readFileSync(path.join(root, portrait.src), 'utf8');
        assert.match(svg, /<svg /);
        assert.match(svg, /<title /);
        assert.doesNotMatch(svg, /<script|onload=|href="https?:/i);
    }
    assert.equal(sources.size, 4);
    assert.equal(EnemyArt.get('unknown'), null);
    assert.equal(EnemyArt.get('__proto__'), null);
});

test('enemy rendering is DOM-safe and falls back to legacy emoji', () => {
    const container = {
        children: [], textContent: '',
        classList: { toggle(name, value) { container.classes[name] = value; } },
        classes: {},
        replaceChildren() { this.children = []; this.textContent = ''; },
        appendChild(child) { this.children.push(child); }
    };
    const doc = { createElement(tag) { assert.equal(tag, 'img'); return {}; } };
    const context = vm.createContext({ document: doc });
    const renderer = vm.runInContext(source + '\nEnemyArt;', context);
    renderer.render(container, { id: 'slime', emoji: '🟢' });
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].src, 'assets/enemies/slime.svg');
    assert.equal(container.classes['enemy-has-portrait'], true);
    renderer.render(container, { id: 'missing', emoji: '👾' });
    assert.equal(container.children.length, 0);
    assert.equal(container.textContent, '👾');
    assert.equal(container.classes['enemy-has-portrait'], false);
});

test('portrait registry loads before battle UI and battle delegates to renderer', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const battle = fs.readFileSync(path.join(root, 'js/ui/BattleUI.js'), 'utf8');
    assert.ok(html.indexOf('js/ui/EnemyArt.js') < html.indexOf('js/ui/BattleUI.js'));
    assert.match(html, /js\/ui\/EnemyArt\.js\?v=2026\.11\.15\.14/);
    assert.match(battle, /EnemyArt\.render\(document\.getElementById\('enemy-sprite'\), enemy\)/);
});

test('all three act bosses have distinct original portraits', () => {
    const bossIds = ['forestBoss', 'caveBoss', 'castleBoss'];
    const portraits = bossIds.map(id => EnemyArt.get(id));
    assert.equal(new Set(portraits.map(p => p.src)).size, 3);
    for (const portrait of portraits) {
        assert.ok(portrait.alt.length > 8);
        const svg = fs.readFileSync(path.join(root, portrait.src), 'utf8');
        assert.match(svg, /<title /);
        assert.match(svg, /<\/svg>$/);
        assert.doesNotMatch(svg, /<script|onload=|href="https?:/i);
    }
    assert.match(source, /enemy-is-boss/);
});
