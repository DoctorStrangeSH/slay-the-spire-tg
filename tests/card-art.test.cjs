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
    assert.match(html, /js\/ui\/CardArt\.js\?v=[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}\.[0-9]+/);
    assert.match(html, /css\/cathedral\.css\?v=[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}\.[0-9]+/);
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

test('rarity descriptors are stable, distinct, and safe for old cards', () => {
    assert.equal(CardArt.rarity({ rarity: 'rare' }).key, 'rare');
    assert.equal(CardArt.rarity({ rarity: 'uncommon' }).label, 'Необычная');
    assert.equal(CardArt.rarity({ rarity: 'common' }).key, 'common');
    assert.equal(CardArt.rarity({ rarity: 'rare' }).sigil, '✦✦');
    assert.equal(CardArt.rarity({ rarity: 'rare<script>' }).key, 'common');
    assert.equal(CardArt.rarity(null).key, 'common');
});

test('rarity is rendered in battle, rewards, and card details', () => {
    const battle = fs.readFileSync(path.join(root, 'js/ui/BattleUI.js'), 'utf8');
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    const styles = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    assert.ok(battle.includes('card-rarity-${rarity.key}'));
    assert.ok(game.includes('reward-card reward-reveal card-rarity-${CardArt.rarity(card).key}'));
    assert.ok(game.includes('reward-card-rarity'));
    assert.ok(styles.includes('.card-rarity-rare'));
    assert.ok(styles.includes('prefers-reduced-motion: reduce'));
});

test('rare signature art distinguishes the three hero identities', () => {
    const cards = {
        beheading: ['beheading.svg', 'attack'],
        totalAutomation: ['total-automation.svg', 'power'],
        psyExplosion: ['psy-explosion.svg', 'attack']
    };
    for (const [id, [filename, type]] of Object.entries(cards)) {
        const art = CardArt.resolve({ id, type, rarity: 'rare' });
        assert.ok(art.src.endsWith(filename));
        assert.match(CardArt.markup({ id, type }), /assets\/cards\//);
        const svg = fs.readFileSync(path.join(root, art.src), 'utf8');
        assert.match(svg, /<title /);
        assert.match(svg, /viewBox="0 0 360 225"/);
        assert.match(svg, /<\/svg>$/);
        assert.doesNotMatch(svg, /<script|onload=|href="https?:/i);
    }
});


test('card inspection keeps description readable and separate from selection', () => {
    const ui = fs.readFileSync(path.join(root, 'js/ui/BattleUI.js'), 'utf8');
    const styles = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    assert.match(ui, /inspectButton\.onclick = event =>/);
    assert.match(ui, /event\.stopPropagation\(\)/);
    assert.match(ui, /showCardDetails\(card, rarity, inspectButton\)/);
    assert.match(ui, /description\.textContent = card\.description/);
    assert.match(ui, /event\.key === 'Escape'/);
    assert.match(styles, /\.card-inspect-button/);
    assert.match(styles, /\.card-details-description/);
});

test('compact mobile hand reserves space for art, card names and effects', () => {
    const css = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
    const mobile = css.slice(css.indexOf('/* Compact card anatomy:'));
    assert.match(mobile, /@media \(max-width: 640px\)/);
    assert.match(mobile, /#hand-area \.card-art-frame[\s\S]*?height: clamp\(34px, var\(--game-viewport-8, 8dvh\), 51px\)/);
    assert.match(mobile, /#hand-area \.card-name[\s\S]*?-webkit-line-clamp: 2/);
    assert.match(mobile, /#hand-area \.card-description[\s\S]*?-webkit-line-clamp: 2/);
    assert.match(mobile, /#hand-area \.card-inspect-button[\s\S]*?28px/);
});

test('card inspection keyboard events never select a card or rely on global game', () => {
    const source = fs.readFileSync(path.join(root, 'js/ui/BattleUI.js'), 'utf8');
    const document = {
        createElement(tag) {
            return {
                tag, dataset: {}, attrs: {}, children: [], classList: { add() {} },
                setAttribute(name, value) { this.attrs[name] = value; },
                appendChild(child) { this.children.push(child); },
                click() { this.onclick(); }
            };
        }
    };
    const context = vm.createContext({ document, CardArt: {
        rarity: () => ({ key: 'common', label: 'Обычная', sigil: '✦' }),
        markup: () => '<img>'
    } });
    const ui = vm.runInContext(source + '\nBattleUI;', context);
    const selections = [];
    const game = { selectCard(index) { selections.push(index); } };
    const card = ui.createCardElement(
        { name: 'Удар', type: 'attack', cost: 1, description: 'Урон' },
        2, { selectedCards: [], energy: 3 }, game
    );
    const inspect = card.children[0];
    let prevented = false;
    card.onkeydown({ key: 'Enter', target: inspect, preventDefault() { prevented = true; } });
    assert.deepEqual(selections, []);
    assert.equal(prevented, false);
    card.onkeydown({ key: 'Enter', target: card, preventDefault() { prevented = true; } });
    assert.deepEqual(selections, [2]);
    assert.equal(prevented, true);
    card.onclick();
    assert.deepEqual(selections, [2, 2]);
});


test('unlocked cosmetic selection is applied to the active battle and the next battle', () => {
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    const history = fs.readFileSync(path.join(root, 'js/systems/RunHistory.js'), 'utf8');
    const styles = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');

    const showBattle = game.slice(game.indexOf('    showBattle() {'), game.indexOf('    showMenu() {'));
    assert.ok(showBattle.includes("battleScreen.dataset.cardSkin = this.runHistory?.rewardForHero(this.player?.heroId)?.skin || '';"));

    const equipHandler = game.slice(game.indexOf("rewardSelect.addEventListener('change'"), game.indexOf('row.appendChild(rewardSelect)'));
    assert.ok(equipHandler.includes('this.runHistory.equipReward(id, rewardSelect.value)'));
    assert.ok(equipHandler.includes('this.runHistory.rewardForHero(id)'));
    assert.ok(equipHandler.includes("document.getElementById('battle-screen').dataset.cardSkin = equipped?.skin || '';"));

    for (const skin of ['berserk', 'engineer', 'psyker', 'flawless']) {
        assert.ok(history.includes("skin: '" + skin + "'"), 'missing ' + skin + ' cosmetic skin');
        assert.ok(styles.includes('#battle-screen[data-card-skin="' + skin + '"] .card'),
            'missing CSS selector for ' + skin + ' cards');
    }
});
