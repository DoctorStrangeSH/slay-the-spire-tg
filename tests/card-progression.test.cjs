// node --test tests/card-progression.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const rewardSource = fs.readFileSync(path.join(root, 'js/data/cards/index.js'), 'utf8');
const rewardApi = vm.runInNewContext(rewardSource + '\n({ getRandomRewardCards })', {
    CARD_RARITY: { COMMON: 'common', UNCOMMON: 'uncommon', RARE: 'rare' },
    COMMON_CARDS: {
        commonA: { id: 'commonA', rarity: 'common' },
        commonB: { id: 'commonB', rarity: 'common' },
        uncommonA: { id: 'uncommonA', rarity: 'uncommon' },
        rareA: { id: 'rareA', rarity: 'rare' }
    },
    BERSERK_CARDS: { rareB: { id: 'rareB', rarity: 'rare' } },
    ENGINEER_CARDS: {},
    PSYKER_CARDS: {},
    BERSERK_STARTER_DECK: [],
    ENGINEER_STARTER_DECK: [],
    PSYKER_STARTER_DECK: []
});

function rewardAt(rarityRoll) {
    const rolls = [rarityRoll, 0];
    return rewardApi.getRandomRewardCards('berserk', 1, () => rolls.shift())[0];
}

test('card reward rarity boundaries match the configured 70/25/5 weights', () => {
    assert.equal(rewardAt(0).rarity, 'common');
    assert.equal(rewardAt(0.699999).rarity, 'common');
    assert.equal(rewardAt(0.70).rarity, 'uncommon');
    assert.equal(rewardAt(0.949999).rarity, 'uncommon');
    assert.equal(rewardAt(0.95).rarity, 'rare');
    assert.equal(rewardAt(0.999999).rarity, 'rare');
});

test('reward generation removes each chosen card before the next offer', () => {
    const rolls = [0, 0, 0, 0, 0, 0];
    const offered = rewardApi.getRandomRewardCards('berserk', 3, () => rolls.shift());
    assert.equal(offered.length, 3);
    assert.equal(new Set(offered.map(card => card.id)).size, 3);
});

test('rarity weights are renormalized when a rarity tier is exhausted', () => {
    // Consume both rare cards first. With no rare cards left, a roll in the
    // remaining 25-weight uncommon tier must still resolve to an uncommon card.
    const rolls = [0.95, 0.99, 0.95, 0.99, 0.99, 0];
    const offered = rewardApi.getRandomRewardCards('berserk', 3, () => rolls.shift());
    assert.equal(offered[0].rarity, 'rare');
    assert.equal(offered[1].rarity, 'rare');
    assert.equal(offered[2].rarity, 'uncommon');
});

const gameSource = fs.readFileSync(path.join(root, 'js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(gameSource + '\nGame;');
const game = Object.create(Game.prototype);

test('damage, block and healing cards receive the documented upgrade increments', () => {
    const damage = { id: 'strike', name: 'Удар', description: 'Наносит урон.', damage: 6 };
    const block = { id: 'guard', name: 'Защита', description: 'Даёт блок.', block: 5 };
    const heal = { id: 'mend', name: 'Лечение', description: 'Восстанавливает здоровье.', heal: 4 };

    assert.deepEqual({ ...game.getCardUpgrade(damage) }, { stat: 'damage', bonus: 3, label: 'Урон', current: 6, next: 9 });
    assert.deepEqual({ ...game.getCardUpgrade(block) }, { stat: 'block', bonus: 3, label: 'Блок', current: 5, next: 8 });
    assert.deepEqual({ ...game.getCardUpgrade(heal) }, { stat: 'heal', bonus: 2, label: 'Лечение', current: 4, next: 6 });

    assert.equal(game.upgradeCard(damage), true);
    assert.equal(damage.damage, 9);
    assert.equal(damage.upgraded, true);
    assert.equal(damage.name, 'Удар+');
    assert.match(damage.description, /Урон: 9/);
    assert.equal(game.upgradeCard(block), true);
    assert.equal(block.block, 8);
    assert.equal(game.upgradeCard(heal), true);
    assert.equal(heal.heal, 6);
});

test('upgrading is idempotent and cards without an eligible stat remain unchanged', () => {
    const upgraded = { id: 'strike', name: 'Удар', damage: 6, description: 'Атака.' };
    assert.equal(game.upgradeCard(upgraded), true);
    const snapshot = { ...upgraded };
    assert.equal(game.upgradeCard(upgraded), false);
    assert.deepEqual({ ...upgraded }, snapshot);

    for (const card of [
        { id: 'telekinesis', name: 'Телекинез', damage: 6, description: 'Особая карта.' },
        { id: 'mindStrike', name: 'Удар разума', damage: 6, description: 'Особая карта.' },
        { id: 'telepathicStrike', name: 'Телепатический удар', damage: 6, description: 'Особая карта.' },
        { id: 'utility', name: 'Тактика', cost: 1, description: 'Без числового улучшения.' },
        null,
        undefined
    ]) {
        const before = card && { ...card };
        assert.equal(game.upgradeCard(card), false);
        if (card) assert.deepEqual({ ...card }, before);
    }
});
