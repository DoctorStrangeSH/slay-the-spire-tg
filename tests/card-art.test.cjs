const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const CardArt = vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js/ui/CardArt.js'), 'utf8') + '\nCardArt;'
);

test('four card archetypes have original local illustrations', () => {
    const artworks = new Set();
    for (const type of ['attack', 'skill', 'power', 'building']) {
        const art = CardArt.get(type);
        assert.ok(art);
        assert.ok(!artworks.has(art.src));
        artworks.add(art.src);
        const file = fs.readFileSync(path.join(root, art.src), 'utf8');
        assert.match(file, /<svg /);
        assert.match(file, /<title /);
        assert.match(file, /<\/svg>$/);
        assert.doesNotMatch(file, /<script|onload=|href="https?:/i);
    }
    assert.equal(artworks.size, 4);
});

test('rendering known card types is safe and unknown old types fall back', () => {
    assert.match(CardArt.markup({ type: 'attack' }), /assets\/cards\/attack\.svg/);
    assert.match(CardArt.markup({ type: 'power' }, 'detail-art-image'), /class="detail-art-image"/);
    assert.match(CardArt.markup({ type: '<img>' }), /card-art-fallback/);
    assert.doesNotMatch(CardArt.markup({ type: '<img>' }), /<img/);
});

test('CardArt loads before BattleUI and all asset manifests are versioned', () => {
    assert.ok(html.indexOf('js/ui/CardArt.js') < html.indexOf('js/ui/BattleUI.js'));
    assert.match(html, /js\/ui\/CardArt\.js\?v=2026\.11\.15\.17/);
    assert.match(html, /css\/cathedral\.css\?v=2026\.11\.15\.17/);
});

test('combat and rewards use illustration registry consistently', () => {
    const battle = fs.readFileSync(path.join(root, 'js/ui/BattleUI.js'), 'utf8');
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    assert.match(battle, /CardArt\.markup\(card\)/);
    assert.match(game, /CardArt\.markup\(card, 'reward-art-image'\)/);
    assert.match(game, /CardArt\.markup\(card, 'detail-art-image'\)/);
});

test('three Berserk signature cards have distinct artwork in battle, rewards and details', () => {
    for (const [id, filename] of Object.entries({
        bloodCut: 'blood-cut.svg',
        retaliationStrike: 'retaliation-strike.svg',
        berserkStance: 'berserk-stance.svg'
    })) {
        const card = { id, type: id === 'berserkStance' ? 'skill' : 'attack' };
        const art = CardArt.resolve(card);
        assert.equal(art.src, 'assets/cards/' + filename);
        assert.match(CardArt.markup(card, 'detail-art-image'), /detail-art-image/);
        assert.match(CardArt.markup(card), new RegExp(filename.replace('.', '\\.'), 'i'));
        const svg = fs.readFileSync(path.join(root, art.src), 'utf8');
        assert.match(svg, /<title /);
        assert.doesNotMatch(svg, /<script|onload=|href="https?:/i);
    }
    assert.ok(CardArt.markup({ id: 'unpainted', type: 'attack' }).includes('assets/cards/attack.svg'));
    assert.ok(CardArt.markup({ id: 'bloodCut', type: 'power' }).includes('blood-cut.svg'));
});
