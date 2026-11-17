// node --test tests/treasure.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const root = join(__dirname, '..');
const constants = readFileSync(join(root, 'js/config/constants.js'), 'utf8');
const map = readFileSync(join(root, 'js/systems/MapGenerator.js'), 'utf8');
const gameCode = readFileSync(join(root, 'js/systems/Game.js'), 'utf8');
const engine = vm.runInNewContext(constants + '\n' + map + '\n' + gameCode +
    '\n({ MapGenerator, Game, NODE_TYPES })', {
    Math, console,
    RunSave: class { clear() {} },
    getCardsForHero() {
        return {
            ordinary: { id: 'ordinary', rarity: 'common' },
            rare: { id: 'rare', rarity: 'rare' }
        };
    }
});
const { MapGenerator, Game, NODE_TYPES } = engine;

test('maps place a genuine treasure node, not a disguised shop', () => {
    for (let seed = 0; seed < 40; seed++) {
        const generated = new MapGenerator(1, seed);
        const treasures = generated.allNodes.filter(n => n.type === NODE_TYPES.TREASURE);
        assert.equal(treasures.length, 1);
        assert.equal(treasures[0].floor, generated.floorRestrictions.treasureFloor);
        assert.equal(generated.allNodes.filter(n => n.type === NODE_TYPES.SHOP).length, 2);
    }
});

function createGame() {
    const game = new Game();
    game.player = { heroId: 'psyker', maxHp: 80, hp: 40, gold: 10, deck: [] };
    return game;
}

test('gold reward grants exactly 75 gold', () => {
    const game = createGame();
    assert.equal(game.applyTreasureReward('gold'), true);
    assert.equal(game.player.gold, 85);
});

test('healing is capped at maximum HP', () => {
    const game = createGame();
    game.player.hp = 70;
    assert.equal(game.applyTreasureReward('heal'), true);
    assert.equal(game.player.hp, 80);
});

test('card reward uses rare pool and copies the card into the deck', () => {
    const game = createGame();
    assert.equal(game.applyTreasureReward('card'), true);
    assert.equal(game.player.deck.length, 1);
    assert.equal(game.player.deck[0].id, 'rare');
});

test('unknown reward cannot alter hero resources', () => {
    const game = createGame();
    assert.equal(game.applyTreasureReward('forbidden'), false);
    assert.equal(game.player.gold, 10);
    assert.equal(game.player.deck.length, 0);
});
