const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
const Game = vm.runInNewContext(source + '\nGame;', {
    console,
    document: { getElementById() { return null; } }
});

function fixture(save = () => true) {
    const game = Object.create(Game.prototype);
    game.gameState = 'battle';
    game.player = { deck: [{ id: 'strike' }] };
    game.offeredCards = [];
    game.rewardCheckpointPending = false;
    game.runSave = { save };
    return game;
}

const choices = [{ id: 'guard', name: 'Защита' }, { id: 'bash', name: 'Сокрушение' }];

test('card reward choices are checkpointed in map state before they can be selected', () => {
    let saved = null;
    const game = fixture(instance => {
        saved = {
            gameState: instance.gameState,
            offeredCards: instance.offeredCards.map(card => card.id)
        };
        return true;
    });

    assert.equal(game.checkpointRewardOffer(choices), true);
    assert.deepEqual(saved, { gameState: 'map', offeredCards: ['guard', 'bash'] });
    assert.equal(game.rewardCheckpointPending, false);
});

test('failed reward-offer checkpoint blocks the choice until retry', () => {
    let attempts = 0;
    const game = fixture(() => ++attempts > 1);

    assert.equal(game.checkpointRewardOffer(choices), false);
    assert.equal(game.rewardCheckpointPending, true);
    assert.deepEqual(game.offeredCards.map(card => card.id), ['guard', 'bash']);
    assert.equal(game.gameState, 'map');

    assert.equal(game.runSave.save(game), true);
    game.rewardCheckpointPending = false;
    assert.equal(game.rewardCheckpointPending, false);
});

test('taking a card commits deck and clears the pending offer in one checkpoint', () => {
    let snapshot = null;
    const game = fixture(instance => {
        snapshot = {
            deck: instance.player.deck.map(card => card.id),
            offers: instance.offeredCards.length,
            state: instance.gameState
        };
        return true;
    });
    game.gameState = 'map';
    game.offeredCards = choices.map(card => ({ ...card }));

    assert.equal(game.commitCardReward(1), true);
    assert.deepEqual(snapshot, { deck: ['strike', 'bash'], offers: 0, state: 'map' });
    assert.deepEqual(game.player.deck.map(card => card.id), ['strike', 'bash']);
    assert.equal(game.offeredCards.length, 0);
    assert.equal(game.commitCardReward(1), false);
});

test('skipping a card reward is checkpointed before the pending offer is cleared', () => {
    let snapshot = null;
    const game = fixture(instance => {
        snapshot = {
            deck: instance.player.deck.map(card => card.id),
            offers: instance.offeredCards.length
        };
        return true;
    });
    game.gameState = 'map';
    game.offeredCards = choices.map(card => ({ ...card }));

    assert.equal(game.commitCardReward(), true);
    assert.deepEqual(snapshot, { deck: ['strike'], offers: 0 });
    assert.deepEqual(game.player.deck.map(card => card.id), ['strike']);
    assert.equal(game.offeredCards.length, 0);
});

test('failed card selection checkpoint rolls back the deck and keeps the offer available', () => {
    const game = fixture(() => false);
    game.gameState = 'map';
    game.offeredCards = choices.map(card => ({ ...card }));

    assert.equal(game.commitCardReward(0), false);
    assert.deepEqual(game.player.deck.map(card => card.id), ['strike']);
    assert.deepEqual(game.offeredCards.map(card => card.id), ['guard', 'bash']);
    assert.equal(game.gameState, 'map');
});

test('failed skip checkpoint does not discard the pending reward', () => {
    const game = fixture(() => false);
    game.gameState = 'map';
    game.offeredCards = choices.map(card => ({ ...card }));

    assert.equal(game.commitCardReward(), false);
    assert.deepEqual(game.offeredCards.map(card => card.id), ['guard', 'bash']);
    assert.deepEqual(game.player.deck.map(card => card.id), ['strike']);
});

test('invalid reward index cannot alter the deck or checkpoint', () => {
    let saves = 0;
    const game = fixture(() => { saves++; return true; });
    game.gameState = 'map';
    game.offeredCards = choices.map(card => ({ ...card }));

    assert.equal(game.commitCardReward(9), false);
    assert.equal(saves, 0);
    assert.deepEqual(game.player.deck.map(card => card.id), ['strike']);
});
