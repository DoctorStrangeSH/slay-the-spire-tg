// node --test tests/map-generator.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const constants = readFileSync(join(__dirname, '../js/config/constants.js'), 'utf8');
const source = readFileSync(join(__dirname, '../js/systems/MapGenerator.js'), 'utf8');
const MapGenerator = vm.runInNewContext(constants + '\n' + source + '\nMapGenerator;', { Math });

const snapshot = map => JSON.stringify(map.paths.map(floor =>
    floor.map(node => ({ id: node.id, type: node.type, connections: node.connections }))
));

test('same seed reproduces identical node types and connections', () => {
    assert.equal(snapshot(new MapGenerator(1, 'shared-run')), snapshot(new MapGenerator(1, 'shared-run')));
});

test('different seeds produce different maps', () => {
    assert.notEqual(snapshot(new MapGenerator(1, 'alpha')), snapshot(new MapGenerator(1, 'beta')));
});

test('each generated node except boss has a valid outgoing route', () => {
    for (let seed = 0; seed < 50; seed++) {
        const map = new MapGenerator(1, seed);
        for (const node of map.allNodes) {
            if (node.floor === map.floors - 1) continue;
            assert.ok(node.connections.length > 0, 'missing exit from ' + node.id + ' on seed ' + seed);
            for (const id of node.connections) {
                const next = map.findNodeById(id);
                assert.ok(next, 'missing target ' + id);
                assert.equal(next.floor, node.floor + 1);
            }
        }
    }
});

test('available routes come only from current node, never from visited siblings', () => {
    const map = new MapGenerator(1, 'route-guard');
    const first = map.paths[1];
    assert.ok(first.length >= 2);
    const current = first[0];
    const sibling = first[1];
    // Тесту нужны две независимые цели, независимо от случайного заполнения этажа.
    if (map.paths[2].length < 2) map.createNode(2, 4, 'battle');
    current.connections = [map.paths[2][0].id];
    sibling.connections = [map.paths[2][1].id];
    current.visited = true;
    sibling.visited = true;
    const available = map.getAvailableNodes(current.id);
    assert.deepEqual(Array.from(available, node => node.id), [map.paths[2][0].id]);
});

test('three acts have distinct visual banners while routes remain unchanged', () => {
    const ui = readFileSync(join(__dirname, '../js/ui/MapUI.js'), 'utf8');
    const MapUI = vm.runInNewContext(ui + '\nMapUI;', { window: {} });
    const themes = [1, 2, 3].map(act => MapUI.getActTheme(act));
    assert.equal(new Set(themes.map(theme => theme.style)).size, 3);
    assert.equal(new Set(themes.map(theme => theme.name)).size, 3);
    assert.ok(themes.every(theme => theme.sigil && theme.subtitle));
    assert.equal(MapUI.getActTheme(99).style, 'unknown');
    assert.match(ui, /role="progressbar"/);
    assert.match(ui, /aria-valuenow=/);
    assert.match(ui, /game\.mapGenerator\.getAvailableNodes/);
});

test('act completion displays a transition after saving next map', () => {
    const gameSource = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const uiSource = readFileSync(join(__dirname, '../js/ui/MapUI.js'), 'utf8');
    const element = {
        dataset: {}, attributes: {}, button: { focused: false, handlers: {},
            addEventListener(type, handler) { this.handlers[type] = handler; },
            focus() { this.focused = true; } },
        setAttribute(key, value) { this.attributes[key] = value; },
        querySelector() { return this.button; },
        remove() { this.removed = true; }
    };
    const document = {
        body: { appendChild(node) { this.current = node; } },
        getElementById() { return null; },
        createElement() { return element; }
    };
    const context = { document, window: {}, GAME_CONFIG: { maxActs: 3 },
        RunSave: class { clear() {} }, MapGenerator: class {} };
    const Game = vm.runInNewContext(uiSource + '\n' + gameSource + '\nGame;', context);
    const game = new Game();
    game.act = 1;
    game.floor = 14;
    game.generateNewMap = () => { game.generated = true; };
    game.showMap = () => { assert.ok(game.generated); game.saved = true; };
    game.completeAct();
    assert.equal(game.act, 2);
    assert.equal(game.floor, 0);
    assert.ok(game.saved);
    assert.equal(document.body.current.id, 'cathedral-act-transition');
    assert.equal(document.body.current.dataset.actTheme, 'depths');
    assert.ok(element.button.focused);
    element.button.handlers.click();
    assert.equal(element.removed, true);
});

test('event scenes distinguish all choices and preserve failed bargain outcome', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }
    });
    const game = new Game();
    const events = game.getEventsForAct();
    assert.equal(events.length, 7);
    assert.equal(new Set(events.map(event => game.getEventPresentation(event.name).style )).size, 7);
    assert.ok(events.every(event => event.options.length >= 2));
    assert.ok(events.every(event => event.description.length > 75));
    game.player = { hp: 12, maxHp: 50, gold: 0 };
    assert.equal(game.applyAltarBargain(), false);
    assert.equal(game.player.hp, 12);
    game.player.hp = 30;
    assert.equal(game.applyAltarBargain(), true);
    assert.equal(game.player.hp, 18);
    assert.equal(game.player.maxHp, 58);
});

test('new event risks have defined prices and never kill the player', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        alert() {}
    });
    const game = new Game();
    game.player = { hp: 9, maxHp: 60, gold: 15 };
    const get = name => game.getEventsForAct().find(event => event.name === name);
    const vault = get('Запечатанная Сокровищница');
    assert.equal(vault.options[0].action(), false);
    assert.equal(game.player.hp, 9);
    assert.equal(game.player.gold, 15);
    game.player.hp = 20;
    assert.equal(vault.options[0].action(), true);
    assert.equal(game.player.hp, 11);
    assert.equal(game.player.gold, 75);
    const chapel = get('Часовня Последнего Света');
    assert.equal(chapel.options[1].action(), true);
    assert.equal(game.player.maxHp, 63);
    assert.equal(game.player.hp, 14);
    assert.equal(game.player.gold, 50);
    game.player.gold = 0;
    assert.equal(chapel.options[1].action(), false);
    assert.equal(game.player.maxHp, 63);
    game.player.hp = 60;
    assert.equal(get('Библиотека Безымянных').options[1].action(), true);
    assert.equal(game.player.hp, 63);
});

test('each act has its own encounter and risky choices cannot be lethal', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }, alert() {}
    });
    const game = new Game();
    const names = ['Сердце Терновника', 'Кузница Погасших Звёзд', 'Зеркало Забытой Короны'];
    for (let act = 1; act <= 3; act++) {
        game.act = act;
        const events = game.getEventsForAct();
        assert.equal(events.length, 7);
        assert.ok(events.some(event => event.name === names[act - 1]));
        assert.ok(events.every(event => !names.some(name => name !== names[act - 1] && event.name === name)));
    }
    game.player = { hp: 6, maxHp: 40, gold: 0 };
    game.act = 1;
    assert.equal(game.getEventsForAct().find(e => e.name === names[0]).options[0].action(), false);
    assert.equal(game.player.hp, 6);
    game.act = 2;
    assert.equal(game.getEventsForAct().find(e => e.name === names[1]).options[0].action(), false);
    assert.equal(game.player.gold, 0);
    game.act = 3;
    assert.equal(game.getEventsForAct().find(e => e.name === names[2]).options[0].action(), false);
    assert.equal(game.player.hp, 6);
});

test('rare relic contract never charges an impossible or lethal bargain', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    let available = [{ id: 'stoneguard' }];
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }, alert() {},
        getAvailableRelics: () => available
    });
    const game = new Game();
    const event = game.getRareEventsForAct().find(item => item.name === 'Договор с Хранителем Печатей');
    assert.equal(event.rare, true);
    assert.equal(game.getEventPresentation(event.name).style, 'covenant');
    game.player = { hp: 15, maxHp: 50, gold: 0, relics: [], heroId: 'berserk' };
    assert.equal(event.options[0].action(), false);
    assert.equal(game.player.hp, 15);
    game.player.hp = 30;
    available = [];
    assert.equal(event.options[0].action(), false);
    assert.equal(game.player.hp, 30);
    available = [{ id: 'stoneguard' }];
    game.applyTreasureReward = () => { game.player.relics.push('stoneguard'); return true; };
    assert.equal(event.options[0].action(), true);
    assert.equal(game.player.hp, 15);
    assert.deepEqual(Array.from(game.player.relics), ['stoneguard']);
});
test('rare room selection uses a twelve-percent independent roll', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    let value = 0;
    const random = () => value;
    const context = { GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        Math: Object.assign(Object.create(Math), { random }) };
    const Game = vm.runInNewContext(source + '\nGame;', context);
    const game = new Game();
    let selected = null;
    game.showEventModal = event => { selected = event; };
    value = 0.05;
    game.triggerEvent();
    assert.equal(selected.rare, true);
    value = 0.50;
    game.triggerEvent();
    assert.notEqual(selected.rare, true);
});

test('oracle blessing persists on player and expires after two battle openings', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const context = { GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        BattleSystem: class { constructor() { this.block = 0; } }, alert() {} };
    const Game = vm.runInNewContext(source + '\nGame;', context);
    const game = new Game();
    const oracle = game.getRareEventsForAct().find(event => event.name === 'Оракул Золотого Пламени');
    game.player = { gold: 20, blessingBattles: 0 };
    assert.equal(oracle.options[0].action(), false);
    assert.equal(game.player.gold, 20);
    game.player.gold = 50;
    assert.equal(oracle.options[0].action(), true);
    assert.equal(game.player.gold, 20);
    assert.equal(game.player.blessingBattles, 2);
    game.showBattle = () => {};
    game.beginEncounter({});
    assert.equal(game.currentBattle.block, 5);
    assert.equal(game.player.blessingBattles, 1);
    game.beginEncounter({});
    assert.equal(game.currentBattle.block, 5);
    assert.equal(game.player.blessingBattles, 0);
    game.beginEncounter({});
    assert.equal(game.currentBattle.block, 0);
});

test('cursed coin grants gold now and reduces first-turn energy in two battles', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const context = {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        BattleSystem: class { constructor() { this.block = 0; this.energy = 3; } }
    };
    const Game = vm.runInNewContext(source + '\nGame;', context);
    const game = new Game();
    const coin = game.getRareEventsForAct().find(e => e.name === 'Монета Забытого Долга');
    assert.equal(coin.rare, true);
    game.player = { gold: 10, curseBattles: 0, blessingBattles: 0 };
    assert.equal(coin.options[0].action(), true);
    assert.equal(game.player.gold, 85);
    assert.equal(game.player.curseBattles, 2);
    game.showBattle = () => {};
    game.beginEncounter({});
    assert.equal(game.currentBattle.energy, 2);
    assert.equal(game.player.curseBattles, 1);
    game.beginEncounter({});
    assert.equal(game.currentBattle.energy, 2);
    assert.equal(game.player.curseBattles, 0);
    game.beginEncounter({});
    assert.equal(game.currentBattle.energy, 3);
    game.player.curseBattles = 1;
    game.player.blessingBattles = 1;
    game.beginEncounter({});
    assert.equal(game.currentBattle.block, 5);
    assert.equal(game.currentBattle.energy, 2);
});

test('chapel only charges for cleansing an active curse and preserves blessing', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }, alert() {}
    });
    const game = new Game();
    game.player = { gold: 50, blessingBattles: 2, curseBattles: 0 };
    const chapel = game.getEventsForAct().find(event => event.name === 'Часовня Последнего Света');
    const cleanse = chapel.options.find(option => option.text.includes('Очистить проклятие'));
    assert.equal(cleanse.action(), false);
    assert.equal(game.player.gold, 50);
    game.player.curseBattles = 2;
    game.player.gold = 19;
    assert.equal(cleanse.action(), false);
    assert.equal(game.player.curseBattles, 2);
    game.player.gold = 50;
    assert.equal(cleanse.action(), true);
    assert.equal(game.player.gold, 30);
    assert.equal(game.player.curseBattles, 0);
    assert.equal(game.player.blessingBattles, 2);
    assert.deepEqual(Array.from(game.getTemporaryConditions().map(effect => effect.kind)), ['blessing']);
    assert.equal(cleanse.action(), false);
    assert.equal(game.player.gold, 30);
});

test('lunar oath trades health for two first-turn energy bonuses and stacks with curse', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }, alert() {},
        BattleSystem: class { constructor() { this.block = 0; this.energy = 3; } }
    });
    const game = new Game();
    const oath = game.getRareEventsForAct().find(event => event.name === 'Лунная Клятва');
    assert.equal(oath.rare, true);
    game.player = { hp: 12, oathBattles: 0, curseBattles: 0 };
    assert.equal(oath.options[0].action(), false);
    assert.equal(game.player.hp, 12);
    game.player.hp = 30;
    assert.equal(oath.options[0].action(), true);
    assert.equal(game.player.hp, 18);
    assert.equal(game.player.oathBattles, 2);
    assert.deepEqual(Array.from(game.getTemporaryConditions().map(effect => effect.name)), ['Лунная клятва']);
    game.showBattle = () => {};
    game.player.curseBattles = 1;
    game.beginEncounter({});
    assert.equal(game.currentBattle.energy, 3);
    assert.equal(game.player.oathBattles, 1);
    game.beginEncounter({});
    assert.equal(game.currentBattle.energy, 4);
    assert.equal(game.player.oathBattles, 0);
    game.beginEncounter({});
    assert.equal(game.currentBattle.energy, 3);
});

test('ash seal trades health for two encounters of strength, without changing other buffs', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }, alert() {},
        BattleSystem: class {
            constructor() { this.block = 0; this.energy = 3; this.statusEffects = { player: { strength: 1 } }; }
        }
    });
    const game = new Game();
    const seal = game.getRareEventsForAct().find(event => event.name === 'Пепельная Печать');
    game.player = { hp: 10, ashBattles: 0, oathBattles: 1 };
    assert.equal(seal.options[0].action(), false);
    assert.equal(game.player.hp, 10);
    game.player.hp = 30;
    assert.equal(seal.options[0].action(), true);
    assert.equal(game.player.hp, 20);
    assert.equal(game.player.ashBattles, 2);
    assert.deepEqual(Array.from(game.getTemporaryConditions().map(effect => effect.name)),
        ['Пепельная печать', 'Лунная клятва']);
    game.showBattle = () => {};
    game.beginEncounter({});
    assert.equal(game.currentBattle.statusEffects.player.strength, 3);
    assert.equal(game.currentBattle.energy, 4);
    assert.equal(game.player.ashBattles, 1);
    game.beginEncounter({});
    assert.equal(game.currentBattle.statusEffects.player.strength, 3);
    assert.equal(game.currentBattle.energy, 3);
    assert.equal(game.player.ashBattles, 0);
    game.beginEncounter({});
    assert.equal(game.currentBattle.statusEffects.player.strength, 1);
});
