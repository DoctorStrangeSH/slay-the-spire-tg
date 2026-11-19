// node --test tests/secret-rooms.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/data/relics.js',
    'js/systems/Game.js'
].map(path => readFileSync(join(root, path), 'utf8')).join('\n');

function createGame() {
    const context = {
        GAME_CONFIG: { maxActs: 3 },
        RunSave: class { clear() {} },
        alert() {},
        Math: Object.assign(Object.create(Math), { random: () => 0 })
    };
    const Game = vm.runInNewContext(source + '\nGame;', context);
    return new Game();
}

test('secret room is inaccessible until the Chronicle of Foresight is owned', () => {
    const game = createGame();
    game.player = { heroId: 'berserk', hp: 40, maxHp: 60, gold: 0, relics: [] };
    let shown = false;
    game.showEventModal = () => { shown = true; };
    game.triggerSecretRoom();
    assert.equal(shown, false);
    assert.equal(game.player.secretRoomsFound, undefined);
});

test('secret room creates a different class encounter for every hero', () => {
    const cases = [
        ['berserk', 'Кровавая сокровищница'],
        ['engineer', 'Забытый арсенал'],
        ['psyker', 'Звёздная крипта']
    ];
    for (const [heroId, expected] of cases) {
        const game = createGame();
        game.player = { heroId, hp: 40, maxHp: 60, gold: 100, relics: ['chronicle'], deck: [{ id: 'strike' }] };
        let event = null;
        game.showEventModal = value => { event = value; };
        game.triggerSecretRoom();
        assert.equal(event.name, expected);
        assert.equal(game.player.secretRoomsFound, 1);
        assert.equal(event.options.length, 2);
    }
});

test('secret room rewards are applied only after a valid choice', () => {
    const game = createGame();
    game.player = { heroId: 'berserk', hp: 20, maxHp: 60, gold: 0, relics: ['chronicle'] };
    let event;
    game.showEventModal = value => { event = value; };
    game.triggerSecretRoom();
    assert.equal(event.options[0].action(), true);
    assert.equal(game.player.hp, 12);
    assert.equal(game.player.relics.length, 2);
    assert.equal(game.player.secretRoomChoices, 1);
});

test('secret room can be declined in favor of its safer treasure option', () => {
    const game = createGame();
    game.player = { heroId: 'engineer', hp: 50, maxHp: 60, gold: 10, relics: ['chronicle'] };
    let event;
    game.showEventModal = value => { event = value; };
    game.triggerSecretRoom();
    assert.equal(event.options[1].action(), true);
    assert.equal(game.player.gold, 60);
    assert.equal(game.player.secretRoomChoices, 1);
});

test('psyker secret inscription uses the forbidden manuscript upgrade mechanic', () => {
    const game = createGame();
    game.player = { heroId: 'psyker', hp: 30, maxHp: 60, gold: 0, relics: ['chronicle'] };
    game.applyForbiddenManuscript = () => true;
    let event;
    game.showEventModal = value => { event = value; };
    game.triggerSecretRoom();
    assert.equal(event.options[0].action(), true);
    assert.equal(game.player.secretRoomChoices, 1);
});
