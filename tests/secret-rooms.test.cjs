// node --test tests/secret-rooms.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/data/enemies.js',
    'js/data/relics.js',
    'js/systems/Game.js'
].map(path => readFileSync(join(root, path), 'utf8')).join('\n');

function createGame() {
    const context = {
        GAME_CONFIG: { maxActs: 3 },
        RunSave: class { clear() {} },
        getStarterDeckForHero: () => [],
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


test('Veiled Merchant contract pays an advance and records the debt origin', () => {
    const game = createGame();
    game.act = 1;
    game.floor = 4;
    game.player = { heroId: 'berserk', hp: 40, maxHp: 60, gold: 10, relics: [], veiledMerchantDebt: null };
    const event = game.getRareEventsForAct().find(item => item.name === 'Безликий Торговец');
    assert.ok(event);
    assert.equal(event.options[0].action(), true);
    assert.equal(game.player.gold, 90);
    assert.equal(game.player.veiledMerchantDebt, 'owed');
    assert.equal(game.player.veiledMerchantAct, 1);
    assert.equal(game.player.veiledMerchantFloor, 4);
    assert.equal(game.canEncounterVeiledMerchantCollector(), false);
});

test('Veiled Merchant collector appears only after a later floor and can settle the contract', () => {
    const game = createGame();
    game.act = 1;
    game.floor = 4;
    game.player = { heroId: 'berserk', hp: 40, maxHp: 60, gold: 120, relics: [], veiledMerchantDebt: 'owed', veiledMerchantAct: 1, veiledMerchantFloor: 4 };
    assert.equal(game.canEncounterVeiledMerchantCollector(), false);
    game.floor = 5;
    assert.equal(game.canEncounterVeiledMerchantCollector(), true);
    const events = game.getEventsForAct();
    const collector = events.find(item => item.name === 'Сборщик Долгов');
    assert.ok(collector);
    assert.equal(collector.options[0].action(), true);
    assert.equal(game.player.gold, 20);
    assert.equal(game.player.veiledMerchantDebt, 'settled');
    assert.equal(game.canEncounterVeiledMerchantCollector(), false);
});

test('defaulting on the Veiled Merchant contract is recorded as a lasting consequence', () => {
    const game = createGame();
    game.act = 2;
    game.floor = 2;
    game.player = { heroId: 'engineer', hp: 40, maxHp: 60, gold: 0, relics: [], veiledMerchantDebt: 'owed', veiledMerchantAct: 1, veiledMerchantFloor: 8 };
    const collector = game.getEventsForAct().find(item => item.name === 'Сборщик Долгов');
    assert.ok(collector);
    assert.equal(collector.options[1].action(), true);
    assert.equal(game.player.veiledMerchantDebt, 'defaulted');
    assert.equal(game.canEncounterVeiledMerchantCollector(), false);
});

test('Veiled Merchant refuses duplicate contracts and journals all outcomes', () => {
    const game = createGame();
    game.act = 1;
    game.floor = 3;
    game.player = { heroId: 'psyker', hp: 40, maxHp: 60, gold: 200, relics: [], veiledMerchantDebt: 'owed', veiledMerchantAct: 1, veiledMerchantFloor: 1 };
    const event = game.getRareEventsForAct().find(item => item.name === 'Безликий Торговец');
    assert.equal(event.options[0].action(), false);
    game.player.veiledMerchantDebt = 'defaulted';
    assert.equal(event.options[0].action(), false);
    for (const state of ['owed', 'settled', 'defaulted', 'declined']) {
        game.player.veiledMerchantDebt = state;
        const expectedTitle = state === 'declined' ? 'Безликий Торговец' : 'Договор с Безликим Торговцем';
        assert.ok(game.getRunJournalEntries().some(entry => entry.title === expectedTitle));
    }
});


test('new runs clear Veiled Merchant debt and deal history', () => {
    const game = createGame();
    game.player = {
        heroId: 'berserk', hp: 30, maxHp: 60, gold: 90, deck: [], relics: [],
        veiledMerchantDebt: 'defaulted', veiledMerchantAct: 1,
        veiledMerchantFloor: 5, veiledMerchantDeals: 2
    };
    game.generateNewMap = () => {};
    game.showMap = () => {};
    game.startNewGame();
    assert.equal(game.player.veiledMerchantDebt, null);
    assert.equal(game.player.veiledMerchantAct, null);
    assert.equal(game.player.veiledMerchantFloor, null);
    assert.equal(game.player.veiledMerchantDeals, 0);
});

test('merchant encounter scenes and follow-up are registered in the event presentation', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const styles = readFileSync(join(__dirname, '../css/cathedral.css'), 'utf8');
    assert.ok(source.includes("'Безликий Торговец': { style: 'veiled-merchant'"));
    assert.ok(source.includes("'Сборщик Долгов': { style: 'debt-collector'"));
    assert.ok(styles.includes('data-event-scene="veiled-merchant"'));
    assert.ok(styles.includes('data-event-scene="debt-collector"'));
});


test('merchant purchase and refusal both leave a trace that unlocks the secret final boss', () => {
    for (const choice of ['purchase', 'decline']) {
        const game = createGame();
        game.player = { heroId: 'berserk', hp: 40, maxHp: 60, gold: 100, relics: [], veiledMerchantDebt: null, veiledMerchantDeals: 0 };
        game.act = 1;
        const event = game.getRareEventsForAct().find(item => item.name === 'Безликий Торговец');
        const option = choice === 'purchase' ? event.options[1] : event.options[2];
        assert.equal(option.action(), true);
        assert.ok(game.player.veiledMerchantDeals > 0);
        if (choice === 'purchase') assert.equal(game.player.veiledMerchantDebt, 'purchased');
        else assert.equal(game.player.veiledMerchantDebt, 'declined');
        game.act = 3;
        let selected = null;
        game.beginEncounter = enemy => { selected = enemy; };
        game.startBossBattle();
        assert.equal(selected.id, 'veiledCollector');
        assert.equal(selected.merchantConsequence, game.player.veiledMerchantDebt);
    }
});

test('settled and defaulted contracts produce different secret boss profiles', () => {
    const settled = getVeiledBossForRun({ veiledMerchantDebt: 'settled', veiledMerchantDeals: 1 });
    const defaulted = getVeiledBossForRun({ veiledMerchantDebt: 'defaulted', veiledMerchantDeals: 1 });
    assert.ok(defaulted.maxHp > settled.maxHp);
    assert.ok(defaulted.damage > settled.damage);
    assert.ok(settled.openingBlock > defaulted.openingBlock);
    assert.equal(defaulted.merchantConsequence, 'defaulted');
});
