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


test('locked secret node cannot be entered without the Chronicle', () => {
    const game = createGame();
    game.player = { heroId: 'berserk', hp: 40, maxHp: 60, gold: 0, relics: [] };
    const secret = { id: 'secret-node', floor: 4, type: 'secret', visited: false };
    let visited = false;
    game.mapGenerator = {
        getAvailableNodes: () => [secret],
        findNodeById: () => ({ floor: 3 }),
        visitNode: () => { visited = true; }
    };
    game.currentNodeId = 'previous';
    game.floor = 3;
    game.selectMapNode(secret);
    assert.equal(visited, false);
    assert.equal(game.currentNodeId, 'previous');
});

test('secret-room risk checks reject lethal blood and manuscript payments', () => {
    const game = createGame();
    game.player = { heroId: 'berserk', hp: 8, maxHp: 60, gold: 0, relics: ['chronicle'] };
    let event;
    game.showEventModal = value => { event = value; };
    game.triggerSecretRoom();
    assert.equal(event.options[0].action(), false);
    assert.equal(game.player.hp, 8);
    game.player.heroId = 'psyker';
    game.player.hp = 7;
    game.applyForbiddenManuscript = () => false;
    game.triggerSecretRoom();
    assert.equal(event.options[0].action(), false);
    assert.equal(game.player.hp, 7);
});


test('map UI visibly seals the room and disables its route choice without the relic', () => {
    const ui = readFileSync(join(__dirname, '../js/ui/MapUI.js'), 'utf8');
    const styles = readFileSync(join(__dirname, '../css/cathedral.css'), 'utf8');
    assert.ok(ui.includes('const isSecretLocked = node.type === NODE_TYPES.SECRET && !hasChronicle'));
    assert.ok(ui.includes('button.disabled = secretLocked'));
    assert.ok(ui.includes("hint = 'Запечатано · нужна Хроника предвидения'"));
    assert.ok(styles.includes('.spire-room.is-sealed'));
    assert.ok(styles.includes('.spire-next-card--secret'));
});

test('Chronicle of Foresight advertises its hidden-room discovery effect', () => {
    const relics = readFileSync(join(__dirname, '../js/data/relics.js'), 'utf8');
    assert.match(relics, /Хроника предвидения[\s\S]*?позволяет находить запечатанные тайные комнаты/);
});


test('secret chamber events have their own visual scenes', () => {
    const gameSource = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const styles = readFileSync(join(__dirname, '../css/cathedral.css'), 'utf8');
    for (const [name, scene] of [
        ['Кровавая сокровищница', 'secret-blood-vault'],
        ['Забытый арсенал', 'secret-arsenal'],
        ['Звёздная крипта', 'secret-astral-crypt']
    ]) {
        assert.ok(gameSource.includes(name));
        assert.ok(gameSource.includes(`style: '${scene}'`));
        assert.ok(styles.includes(`data-event-scene="${scene}"`));
    }
});
