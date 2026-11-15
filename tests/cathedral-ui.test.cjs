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
