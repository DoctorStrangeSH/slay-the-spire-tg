const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/cathedral.css'), 'utf8');
const crest = fs.readFileSync(path.join(root, 'assets/cathedral-crest.svg'), 'utf8');

test('cathedral theme loads after base CSS and has a custom crest', () => {
    assert.ok(html.indexOf('css/cathedral.css') > html.indexOf('css/style.css'));
    assert.match(html, /assets\/cathedral-crest\.svg/);
    assert.match(crest, /<svg /);
    assert.match(crest, /<title/);
    assert.doesNotMatch(crest, /<script|onload=|href="https?:/i);
});

test('theme contains complete game surfaces and small mobile breakpoint', () => {
    for (const selector of [
        '#main-menu', '#hero-select', '.hero-card', '#battle-screen',
        '.card-type-attack', '.card-type-skill', '.card-type-power',
        '.card-type-building', '#map-screen', '.modal-content', '.action-btn'
    ]) assert.ok(css.includes(selector), 'missing game surface: ' + selector);
    assert.match(css, /@media \(max-width: 360px\)/);
    assert.match(css, /prefers-reduced-motion/);
});

test('class selection remains usable with keyboard and retains themed accents', () => {
    const cardElements = [];
    const list = { innerHTML: '', appendChild(el) { cardElements.push(el); } };
    const document = {
        getElementById() { return list; },
        createElement() {
            return {
                style: { setProperty(name, value) { this[name] = value; } },
                attrs: {},
                setAttribute(key, value) { this.attrs[key] = value; }
            };
        }
    };
    let selected = null;
    const HeroSelect = vm.runInNewContext(
        fs.readFileSync(path.join(root, 'js/ui/HeroSelect.js'), 'utf8') + '\nHeroSelect;',
        { HEROES: { berserk: { id: 'berserk', unlocked: true, color: '#a12', name: 'Берсерк', emoji: '⚔', title: '', description: '', maxHp: 100 } },
          document, game: { selectHero(id) { selected = id; } } }
    );
    HeroSelect.render();
    assert.equal(cardElements.length, 1);
    assert.equal(cardElements[0].attrs.tabindex, '0');
    assert.equal(cardElements[0].style['--hero-accent'], '#a12');
    let prevented = false;
    cardElements[0].onkeydown({ key: 'Enter', preventDefault() { prevented = true; } });
    assert.equal(selected, 'berserk');
    assert.equal(prevented, true);
});

test('menu provides a route back from hero selection', () => {
    assert.match(html, /id="hero-back-button"/);
    assert.match(html, /onclick="game\.showMenu\(\)"/);
});


test('short mobile viewports retain scrollable combat and visible touch actions', () => {
    const compact = css.slice(css.lastIndexOf('/* Compact landscape and small Telegram WebViews:'));
    assert.match(compact, /@media \(max-width: 640px\) and \(max-height: 520px\)/);
    assert.match(compact, /#battle-screen\s*\{[^}]*overflow-y:\s*auto/);
    assert.match(compact, /#action-buttons\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0/);
    assert.match(compact, /#hand-area\s*\{[^}]*height:\s*112px/);
    assert.match(compact, /env\(safe-area-inset-bottom\)/);
    assert.match(compact, /\.play-btn, #action-buttons \.end-btn\s*\{\s*min-height:\s*44px/);
});


test('atlas uses distinct illustrated materials for each act', () => {
    const sections = ['garden', 'depths', 'citadel'].map(act => {
        const selector = '#map-screen[data-act-theme="' + act + '"] #map-nodes';
        const start = css.lastIndexOf(selector);
        assert.ok(start >= 0, 'missing themed atlas: ' + act);
        const rule = css.slice(start, css.indexOf('}', start));
        assert.match(rule, /background:/);
        assert.match(rule, /border-color:/);
        return rule;
    });
    assert.equal(new Set(sections).size, 3);
});

test('target mobile viewport profiles keep battle controls touch-accessible', () => {
    const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
    const profiles = [
        { width: 320, height: 568, expected: 'compact' },
        { width: 360, height: 640, expected: 'compact' },
        { width: 390, height: 844, expected: 'normal' }
    ];
    const classify = height => height <= 520 ? 'short' : height <= 640 ? 'compact' : 'normal';

    for (const viewport of profiles) {
        assert.equal(classify(viewport.height), viewport.expected);
        assert.ok(viewport.width <= 640, 'target must use mobile layout');
        if (viewport.width <= 360) assert.match(css, /@media \(max-width: 360px\)/);
        if (viewport.width <= 420) assert.match(css, /@media \(max-width: 420px\)/);
    }

    assert.match(main, /height <= 520 \? 'short' : height <= 640 \? 'compact' : 'normal'/);
    assert.match(css, /html\[data-game-viewport-height="compact"\] #action-buttons \.play-btn,[\s\S]*?min-height: 44px/);
    assert.match(css, /html\[data-game-viewport-height="compact"\] #action-buttons \.relic-btn,[\s\S]*?min-height: 36px/);
    assert.match(css, /#hand-area \{[^}]*overflow-x: auto/);
    assert.match(css, /#map-screen #map-nodes \{[^}]*max-height: min/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
});
