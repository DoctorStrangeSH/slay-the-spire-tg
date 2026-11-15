// node --test tests/card-rewards.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/data/cards/index.js'), 'utf8');
const context = vm.runInNewContext(source + '\n({ getRandomRewardCards, getCardsForHero })', {
    CARD_RARITY: { COMMON: 'common', UNCOMMON: 'uncommon', RARE: 'rare' },
    COMMON_CARDS: {
        a: { id: 'a', rarity: 'common' },
        b: { id: 'b', rarity: 'common' },
        c: { id: 'c', rarity: 'uncommon' },
        d: { id: 'd', rarity: 'rare' }
    },
    BERSERK_CARDS: { e: { id: 'e', rarity: 'rare' } },
    ENGINEER_CARDS: {},
    PSYKER_CARDS: { p: { id: 'p', rarity: 'rare' } },
    BERSERK_STARTER_DECK: [], ENGINEER_STARTER_DECK: [], PSYKER_STARTER_DECK: []
});
const { getRandomRewardCards, getCardsForHero } = context;

test('three offered cards have unique IDs', () => {
    for (const roll of [0, 0.15, 0.5, 0.99]) {
        const cards = getRandomRewardCards('berserk', 3, () => roll);
        assert.equal(cards.length, 3);
        assert.equal(new Set(Array.from(cards, c => c.id)).size, 3);
    }
});
test('rare rarity can be selected and class cards are in the reward pool', () => {
    assert.ok(Object.values(getCardsForHero('psyker')).some(c => c.id === 'p'));
    const cards = getRandomRewardCards('berserk', 1, () => 0.99);
    assert.equal(cards[0].rarity, 'rare');
});
test('asking for more cards than available does not introduce duplicates', () => {
    const cards = getRandomRewardCards('unknown', 100, () => 0);
    assert.equal(cards.length, 4);
    assert.equal(new Set(Array.from(cards, c => c.id)).size, 4);
});
test('reward choices are copies, not shared registry objects', () => {
    const cards = getRandomRewardCards('unknown', 1, () => 0);
    cards[0].id = 'modified';
    assert.equal(getCardsForHero('unknown').a.id, 'a');
});

test('card reward reveal uses finite stagger and honors reduced motion', () => {
    const game = fs.readFileSync(path.join(__dirname, '../js/systems/Game.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '../css/cathedral.css'), 'utf8');
    assert.ok(game.includes('reward-card reward-reveal card-rarity-'));
    assert.ok(game.includes('style="--reveal-order: ${index}"'));
    assert.ok(game.includes('reward-rare-crest'));
    assert.ok(css.includes('cathedral-reward-rare-arrival'));
    assert.ok(css.includes('prefers-reduced-motion: reduce'));
    assert.ok(css.includes('animation: none !important'));
});

test('deck and discard use accessible illustrated rarity gallery', () => {
    const game = fs.readFileSync(path.join(__dirname, '../js/systems/Game.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '../css/cathedral.css'), 'utf8');
    assert.ok(game.includes("this.showPile('draw')"));
    assert.ok(game.includes("this.showPile('discard')"));
    assert.ok(game.includes('CardArt.markup(card, \'pile-art-image\')'));
    assert.ok(game.includes('class="pile-card card-rarity-'));
    assert.ok(game.includes('class="pile-summary"'));
    assert.ok(game.includes('type="button" class="pile-card'));
    assert.ok(css.includes('.pile-gallery-modal .pile-card:focus-visible'));
});
