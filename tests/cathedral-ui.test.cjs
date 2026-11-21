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
    assert.match(css, /html\[data-game-viewport-height="compact"\] #action-buttons \.relic-btn,[\s\S]*?min-height: 44px/);
    assert.match(css, /#action-buttons \.relic-btn, #action-buttons \.deck-btn,[\s\S]*?#action-buttons \.discard-btn \{[^}]*min-height: 44px/);
    assert.match(css, /#action-buttons \.relic-btn, #action-buttons \.deck-btn,[\s\S]*?#action-buttons \.discard-btn \{ min-height: 44px; \}/);
    assert.match(css, /#hand-area \{[^}]*overflow-x: auto/);
    assert.match(css, /#map-screen #map-nodes \{[^}]*max-height: min/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
});


test('mobile event and reward dialogs respect safe viewport and touch targets', () => {
    const mainMobile = css.slice(css.lastIndexOf('/* Mobile dialog ergonomics:'));
    const baseCss = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
    assert.match(mainMobile, /\.cathedral-event-modal,[\s\S]*?#reward-modal\s*\{[^}]*env\(safe-area-inset-top\)[^}]*env\(safe-area-inset-bottom\)/);
    assert.match(mainMobile, /\.cathedral-event-modal \.cathedral-event-content\s*\{[^}]*box-sizing:\s*border-box/);
    assert.match(mainMobile, /\.cathedral-event-modal \.cathedral-event-content\s*\{[^}]*max-height:\s*calc\(var\(--game-viewport-height/);
    assert.match(mainMobile, /\.cathedral-event-modal \.cathedral-event-choice\s*\{[^}]*min-height:\s*48px/);
    assert.match(mainMobile, /#reward-modal \.modal-content\s*\{[^}]*box-sizing:\s*border-box/);
    assert.match(mainMobile, /#reward-modal \.modal-content\s*\{[^}]*overflow-y:\s*auto/);
    assert.match(mainMobile, /#reward-modal \.reward-card button\s*\{\s*min-height:\s*44px/);
    assert.match(baseCss, /#map-nodes\s*\{[^}]*overflow-y:\s*auto/);
    assert.match(css, /\.spire-next-card\s*\{[^}]*min-height:\s*77px/);
});


test('reduced-motion disables infinite loops and smooth scrolling globally', () => {
    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/);
    assert.ok(reduced, 'missing global reduced-motion contract');
    assert.match(reduced[0], /animation-duration:\s*\.01ms\s*!important/);
    assert.match(reduced[0], /animation-iteration-count:\s*1\s*!important/);
    assert.match(reduced[0], /transition-duration:\s*\.01ms\s*!important/);
    assert.match(reduced[0], /scroll-behavior:\s*auto\s*!important/);
});


test('relic, condition and event dialogs provide keyboard focus management', () => {
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    assert.match(game, /function bindGameModalAccessibility\(modal, options = \{\}\)/);
    assert.match(game, /modal\.setAttribute\('role', 'dialog'\)/);
    assert.match(game, /modal\.setAttribute\('aria-modal', 'true'\)/);
    assert.match(game, /event\.key === 'Escape'/);
    assert.match(game, /event\.key !== 'Tab'/);
    assert.match(game, /event\.shiftKey && \(document\.activeElement === first/);
    assert.ok(game.includes("document.removeEventListener?.('keydown', onKeyDown)"));
    assert.match(game, /label: 'Коллекция реликвий', returnFocus/);
    assert.match(game, /label: 'Состояния героя', returnFocus/);
    assert.match(game, /label: `Событие: \$\{event\.name\}`, returnFocus, initialFocus: firstChoice/);
    assert.match(game, /accessibility\?\.cleanup\(false\)/);
    assert.match(game, /existingModal\?\.__gameModalCleanup\?\.\(false\)/);
});


test('journal, reward, card detail and pile dialogs preserve keyboard focus', () => {
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    assert.ok(game.includes("label: 'История восхождений', returnFocus"));
    assert.ok(game.includes("label: 'Журнал текущего забега', returnFocus"));
    assert.ok(game.includes("label: 'Выбор награды', returnFocus"));
    assert.ok(game.includes("label: isDraw ? 'Колода' : 'Сброс', returnFocus"));
    assert.ok(game.includes("onEscape: () => this.closeCardModal()"));
    assert.ok(game.includes("modal?.__gameModalCleanup?.(restoreFocus)"));
    assert.ok(game.includes('role="group" tabindex="0" aria-label="Посмотреть карту:'));
    assert.ok(game.includes("modal?.__gameModalCleanup?.(false)"));
});


test('merchant, campfire and result screens use managed accessible dialogs', () => {
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    assert.ok(game.includes("label: 'Магазин странствующего торговца', returnFocus"));
    assert.ok(game.includes("initialFocus: leave"));
    assert.ok(game.includes("label: 'Привал у костра', returnFocus"));
    assert.ok(game.includes("initialFocus: healButton.disabled ?"));
    assert.ok(game.includes("label: victory ? 'Итоги победы' : 'Итоги поражения', returnFocus"));
    assert.ok(game.includes("label: isVictory ? 'Победа в забеге' : 'Новая глава', returnFocus"));
    assert.ok(game.includes("const gameModalAccessibilityStack = []"));
    assert.ok(game.includes("gameModalAccessibilityStack[gameModalAccessibilityStack.length - 1] !== entry"));
});

test('building, scry and battle card detail dialogs manage keyboard focus', () => {
    const battleUI = fs.readFileSync(path.join(root, 'js/ui/BattleUI.js'), 'utf8');
    assert.ok(battleUI.includes("label: `${building.name}: управление постройкой`, returnFocus"));
    assert.ok(battleUI.includes("label: 'Предвидение', returnFocus"));
    assert.ok(battleUI.includes("label: `Карта ${card.name}`, returnFocus"));
    assert.ok(battleUI.includes("onEscape: () => closeButton?.click()"));
    assert.ok(battleUI.includes("modal.__gameModalCleanup?.(false)"));
});


test('treasure reward choice is an accessible mandatory dialog', () => {
    const game = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
    const start = game.indexOf('    openTreasure() {');
    const end = game.indexOf('    getShopPrice(card)', start);
    const method = game.slice(start, end);
    assert.ok(method.includes("modal.id = 'treasure-modal'"));
    assert.ok(method.includes("modal.setAttribute?.('aria-modal', 'true')"));
    assert.ok(method.includes("label: 'Древняя сокровищница', returnFocus"));
    assert.ok(method.includes("modal.__gameModalCleanup?.(false)"));
    assert.doesNotMatch(method, /onEscape:/);
});


test('mobile atlas room targets remain large enough for reliable touch selection', () => {
    const baseCss = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
    const mapUI = fs.readFileSync(path.join(root, 'js/ui/MapUI.js'), 'utf8');
    const start = mapUI.indexOf('    createNodeElement(');
    const end = mapUI.indexOf('\n    },', start);
    const method = mapUI.slice(start, end);
    assert.match(method, /hitTarget\.setAttribute\('r', Math\.max\(radius, 30\)\)/);
    assert.match(method, /hitTarget\.setAttribute\('pointer-events', 'all'\)/);
    assert.match(method, /group\.setAttribute\('role', 'button'\)/);
    assert.match(method, /group\.setAttribute\('tabindex', '0'\)/);
    assert.match(css, /#map-nodes svg\s*\{[^}]*touch-action:\s*pan-y/);
    assert.match(baseCss, /#map-nodes\s*\{[^}]*overflow-y:\s*auto/);
});
