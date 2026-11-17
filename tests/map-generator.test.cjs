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

test('new map offers fair routes and correctly placed special rooms', () => {
    for (let seed = 0; seed < 80; seed++) {
        const map = new MapGenerator(1, seed);
        assert.equal(map.paths[0].length, 1);
        assert.ok(map.paths[1].length >= 3 && map.paths[1].length <= 4);
        assert.ok(map.paths[1].every(node => node.type === 'battle'));
        assert.deepEqual(Array.from(map.paths[8], node => node.type), ['treasure']);
        assert.deepEqual(Array.from(map.paths[14], node => node.type), ['rest']);
        assert.deepEqual(Array.from(map.paths[15], node => node.type), ['boss']);
        assert.equal(map.allNodes.filter(node => node.type === 'shop').length, 2);
        assert.equal(map.allNodes.filter(node => node.type === 'elite').length, 2);
        assert.ok(map.allNodes.every(node => node.type !== 'elite' || node.floor >= 5));
        assert.ok(map.allNodes.every(node => node.type !== 'shop' || node.floor >= 4));
        for (let floor = 1; floor < map.floors; floor++) {
            for (const node of map.paths[floor]) {
                assert.ok(map.paths[floor - 1].some(prev => prev.connections.includes(node.id)),
                    'unreachable room ' + node.id + ' at seed ' + seed);
            }
        }
    }
});

test('organic ascent changes horizontal positions without disconnected paths', () => {
    const layouts = new Set();
    for (let seed = 0; seed < 60; seed++) {
        const map = new MapGenerator(1, seed);
        layouts.add(map.paths.slice(1, 7).map(floor => floor.map(node => node.x).join(',')).join('|'));
        assert.ok(map.paths.slice(1, 14).some(floor =>
            floor.length >= 3 && floor.some(node => node.x >= 5)));
        for (const node of map.allNodes) {
            assert.ok(node.x >= 0 && node.x <= 6);
            assert.equal(new Set(node.connections).size, node.connections.length);
        }
    }
    assert.ok(layouts.size >= 40);
    const previous = new MapGenerator(1, 'previous', { legacyBranchingLayout: true });
    assert.equal(previous.paths[1].length, 3);
    assert.notEqual(snapshot(previous), snapshot(new MapGenerator(1, 'previous')));
});

test('legacy map layout remains reproducible for old checkpoints', () => {
    const a = new MapGenerator(1, 'legacy-run', { legacyLayout: true });
    const b = new MapGenerator(1, 'legacy-run', { legacyLayout: true });
    assert.equal(snapshot(a), snapshot(b));
    assert.notEqual(snapshot(a), snapshot(new MapGenerator(1, 'legacy-run')));
});

test('mobile layout sets a fixed-height battle field with a scrollable card hand', () => {
    const css = readFileSync(join(__dirname, '../css/cathedral.css'), 'utf8');
    const mapUI = readFileSync(join(__dirname, '../js/ui/MapUI.js'), 'utf8');
    assert.match(css, /#battle-screen\s*\{[\s\S]*?height:\s*100dvh/);
    assert.match(css, /#hand-area\s*\{[\s\S]*?touch-action:\s*pan-x/);
    assert.match(css, /#action-buttons\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/);
    assert.match(mapUI, /15 - node\.floor/);
    assert.doesNotMatch(mapUI, /addEventListener\('touchend'/);
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
    assert.equal(events.length, 8);
    assert.equal(new Set(events.map(event => game.getEventPresentation(event.name).style )).size, 8);
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
        assert.equal(events.length, 8);
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

test('recent encounters are distinct and survive player snapshot', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        Math: Object.assign(Object.create(Math), { random: () => 0.5 })
    });
    const game = new Game();
    game.player = { eventHistory: [] };
    game.getEligibleRareEvents = () => [];
    game.getEventsForAct = () => [
        { name: 'Фонтан' }, { name: 'Библиотека' }, { name: 'Часовня' }
    ];
    const selected = [];
    game.showEventModal = event => { selected.push(event.name); };
    for (let i = 0; i < 3; i++) game.triggerEvent();
    assert.equal(new Set(selected).size, 3);
    assert.deepEqual(Array.from(game.player.eventHistory), selected);
    game.player = JSON.parse(JSON.stringify(game.player));
    game.triggerEvent();
    assert.notEqual(selected[3], selected[2]);
    assert.notEqual(selected[3], selected[1]);
    assert.equal(game.player.eventHistory.length, 3);
});

test('single eligible event remains available despite history', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        Math: Object.assign(Object.create(Math), { random: () => 0.5 })
    });
    const game = new Game();
    game.player = { eventHistory: ['Единственное событие'] };
    game.getEligibleRareEvents = () => [];
    game.getEventsForAct = () => [{ name: 'Единственное событие' }];
    let selected;
    game.showEventModal = event => { selected = event.name; };
    game.triggerEvent();
    assert.equal(selected, 'Единственное событие');
    assert.deepEqual(Array.from(game.player.eventHistory), [
        'Единственное событие', 'Единственное событие'
    ]);
});

test('pilgrim choice unlocks a single follow-up encounter across saved player data', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
        alert() {}
    });
    const game = new Game();
    game.player = { gold: 15, hp: 40, maxHp: 80, eventHistory: [] };
    const first = game.getEventsForAct().find(event => event.name === 'Паломник у развилки');
    assert.ok(first);
    assert.equal(first.options[0].action(), false);
    assert.equal(game.player.pilgrimChoice, undefined);
    game.player.gold = 25;
    assert.equal(first.options[0].action(), true);
    assert.equal(game.player.gold, 5);
    assert.equal(game.getEventsForAct().some(event => event.name === 'Паломник у развилки'), false);
    game.player = JSON.parse(JSON.stringify(game.player));
    const reunion = game.getEventsForAct().find(event => event.name === 'Возвращение паломника');
    assert.ok(reunion);
    assert.equal(reunion.options[0].action(), true);
    assert.equal(game.player.gold, 55);
    assert.equal(game.player.pilgrimChoice, 'repaid');
    assert.equal(game.getEventsForAct().some(event => event.name === 'Возвращение паломника'), false);
});

test('ignoring the pilgrim closes the quest without a later reward', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }
    });
    const game = new Game();
    game.player = { gold: 0 };
    const first = game.getEventsForAct().find(event => event.name === 'Паломник у развилки');
    assert.equal(first.options[1].action(), true);
    assert.equal(game.player.pilgrimChoice, 'ignored');
    assert.equal(game.getEventsForAct().some(event => /паломник/i.test(event.name)), false);
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

test('forge converts only an active curse, preserving charges and avoiding double payment', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }, alert() {}
    });
    const game = new Game();
    const forge = game.getRareEventsForAct().find(event => event.name === 'Кузница Судеб');
    assert.equal(forge.rare, true);
    game.player = { gold: 50, hp: 30, curseBattles: 0, blessingBattles: 1, ashBattles: 1 };
    assert.equal(forge.options[0].action(), false);
    assert.equal(forge.options[1].action(), false);
    assert.equal(game.player.gold, 50);
    assert.equal(game.player.hp, 30);
    game.player.curseBattles = 2;
    game.player.gold = 29;
    assert.equal(forge.options[0].action(), false);
    assert.equal(game.player.curseBattles, 2);
    game.player.gold = 50;
    assert.equal(forge.options[0].action(), true);
    assert.equal(game.player.gold, 20);
    assert.equal(game.player.curseBattles, 0);
    assert.equal(game.player.blessingBattles, 3);
    assert.equal(forge.options[0].action(), false);
    assert.equal(game.player.gold, 20);
    game.player.curseBattles = 3;
    game.player.hp = 8;
    assert.equal(forge.options[1].action(), false);
    assert.equal(game.player.curseBattles, 3);
    game.player.hp = 30;
    assert.equal(forge.options[1].action(), true);
    assert.equal(game.player.hp, 22);
    assert.equal(game.player.ashBattles, 4);
    assert.equal(game.player.curseBattles, 0);
    assert.equal(forge.options[1].action(), false);
    assert.equal(game.player.hp, 22);
});

test('eternity shard adds exactly one battle to newly gained blessings, not existing charges', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }, alert() {}
    });
    const game = new Game();
    game.player = { hp: 50, gold: 50, relics: ['eternityShard'],
        blessingBattles: 1, ashBattles: 0, oathBattles: 0, curseBattles: 2 };
    const oracle = game.getRareEventsForAct().find(e => e.name === 'Оракул Золотого Пламени');
    assert.equal(oracle.options[0].action(), true);
    assert.equal(game.player.blessingBattles, 4);
    const forge = game.getRareEventsForAct().find(e => e.name === 'Кузница Судеб');
    assert.equal(forge.options[1].action(), true);
    assert.equal(game.player.hp, 42);
    assert.equal(game.player.curseBattles, 0);
    assert.equal(game.player.ashBattles, 3);
    assert.equal(game.grantTemporaryBlessing('oathBattles', 2), 3);
    game.player.blessingBattles = 98;
    assert.equal(game.grantTemporaryBlessing('blessingBattles', 2), 1);
    assert.equal(game.player.blessingBattles, 99);
    assert.equal(game.grantTemporaryBlessing('curseBattles', 2), 0);
    game.player.relics = [];
    assert.equal(game.grantTemporaryBlessing('oathBattles', 2), 2);
});

test('blood pact gives strength in each cursed battle, including final charge, and never otherwise', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        BattleSystem: class {
            constructor() { this.energy = 3; this.block = 0; this.statusEffects = { player: { strength: 1 } }; }
        }
    });
    const game = new Game();
    game.showBattle = () => {};
    game.player = { relics: ['bloodPact'], curseBattles: 2, ashBattles: 0 };
    game.beginEncounter({});
    assert.equal(game.currentBattle.energy, 2);
    assert.equal(game.currentBattle.statusEffects.player.strength, 3);
    assert.equal(game.player.curseBattles, 1);
    game.beginEncounter({});
    assert.equal(game.currentBattle.statusEffects.player.strength, 3);
    assert.equal(game.player.curseBattles, 0);
    game.beginEncounter({});
    assert.equal(game.currentBattle.energy, 3);
    assert.equal(game.currentBattle.statusEffects.player.strength, 1);
    game.player.curseBattles = 1;
    game.player.relics = [];
    game.beginEncounter({});
    assert.equal(game.currentBattle.statusEffects.player.strength, 1);
    game.player.relics = ['bloodPact'];
    game.player.curseBattles = 1;
    game.player.ashBattles = 1;
    game.beginEncounter({});
    assert.equal(game.currentBattle.statusEffects.player.strength, 5);
});

test('exhaustion curse stacks with coin, powers blood pact and can be cleansed or forged', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} }, alert() {},
        BattleSystem: class {
            constructor() { this.energy = 3; this.block = 0; this.statusEffects = { player: { strength: 0 } }; }
        }
    });
    const game = new Game();
    game.showBattle = () => {};
    game.player = { hp: 40, gold: 0, relics: ['bloodPact'],
        curseBattles: 0, exhaustionBattles: 0, blessingBattles: 0, ashBattles: 0 };
    const bowl = game.getRareEventsForAct().find(e => e.name === 'Чаша Истощения');
    assert.equal(bowl.options[0].action(), true);
    assert.equal(game.player.gold, 65);
    assert.equal(game.player.exhaustionBattles, 2);
    game.beginEncounter({});
    assert.equal(game.currentBattle.statusEffects.player.strength, 0);
    assert.equal(game.currentBattle.energy, 3);
    assert.equal(game.player.exhaustionBattles, 1);
    game.player.curseBattles = 2;
    assert.equal(game.getTotalCurseBattles(), 3);
    const forge = game.getRareEventsForAct().find(e => e.name === 'Кузница Судеб');
    assert.equal(forge.options[0].action(), true);
    assert.equal(game.player.gold, 35);
    assert.equal(game.player.blessingBattles, 3);
    assert.equal(game.getTotalCurseBattles(), 0);
    game.beginEncounter({});
    assert.equal(game.currentBattle.statusEffects.player.strength, 0);
    game.player.exhaustionBattles = 2;
    const chapel = game.getEventsForAct().find(e => e.name === 'Часовня Последнего Света');
    const cleanse = chapel.options.find(o => o.text.includes('Очистить проклятие'));
    assert.equal(cleanse.action(), true);
    assert.equal(game.player.gold, 15);
    assert.equal(game.player.exhaustionBattles, 0);
    assert.equal(cleanse.action(), false);
    assert.equal(game.player.gold, 15);
});

test('blood mark takes health on each battle, cannot kill, and powers curse relic on last charge', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        BattleSystem: class {
            constructor() { this.energy = 3; this.block = 0; this.statusEffects = { player: { strength: 0 } }; }
        }
    });
    const game = new Game();
    game.showBattle = () => {};
    game.player = { hp: 7, gold: 0, relics: ['bloodPact'], bloodMarkBattles: 0 };
    const altar = game.getRareEventsForAct().find(e => e.name === 'Кровавый Алтарь');
    assert.equal(altar.options[0].action(), true);
    assert.equal(game.player.gold, 70);
    assert.equal(game.player.bloodMarkBattles, 2);
    game.beginEncounter({});
    assert.equal(game.player.hp, 3);
    assert.equal(game.currentBattle.statusEffects.player.strength, 2);
    game.beginEncounter({});
    assert.equal(game.player.hp, 1);
    assert.equal(game.currentBattle.statusEffects.player.strength, 2);
    game.beginEncounter({});
    assert.equal(game.player.hp, 1);
    assert.equal(game.currentBattle.statusEffects.player.strength, 0);
    game.player.bloodMarkBattles = 2;
    game.player.curseBattles = 1;
    assert.equal(game.getTotalCurseBattles(), 3);
    const forge = game.getRareEventsForAct().find(e => e.name === 'Кузница Судеб');
    assert.equal(forge.options[0].action(), true);
    assert.equal(game.player.blessingBattles, 3);
    assert.equal(game.player.bloodMarkBattles, 0);
    assert.equal(game.player.curseBattles, 0);
    game.player.bloodMarkBattles = 1;
    const chapel = game.getEventsForAct().find(e => e.name === 'Часовня Последнего Света');
    const cleanse = chapel.options.find(o => o.text.includes('Очистить проклятие'));
    assert.equal(cleanse.action(), true);
    assert.equal(game.player.bloodMarkBattles, 0);
    assert.equal(game.player.gold, 20);
});

test('rare events scale by act and never offer the forge without a curse', () => {
    const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');
    const rolls = [0.05, 0.30];
    const random = () => rolls.shift();
    const Game = vm.runInNewContext(source + '\nGame;', {
        GAME_CONFIG: { maxActs: 3 }, RunSave: class { clear() {} },
        Math: Object.assign(Object.create(Math), { random })
    });
    const game = new Game();
    game.player = { curseBattles: 0, exhaustionBattles: 0, bloodMarkBattles: 0 };
    assert.equal(game.getEligibleRareEvents().some(e => e.name === 'Кузница Судеб'), false);
    let selected;
    game.showEventModal = event => { selected = event; };
    game.triggerEvent();
    assert.equal(selected.rare, true);
    assert.notEqual(selected.name, 'Кузница Судеб');
    game.player.exhaustionBattles = 1;
    assert.equal(game.getEligibleRareEvents().some(e => e.name === 'Кузница Судеб'), true);
    rolls.push(0.05, 0.30);
    game.triggerEvent();
    assert.equal(selected.name, 'Кузница Судеб');
    game.act = 1;
    assert.equal(game.getRareEventChance(), 0.12);
    game.act = 2;
    assert.equal(game.getRareEventChance(), 0.16);
    game.act = 3;
    assert.equal(game.getRareEventChance(), 0.20);
    rolls.push(0.15, 0.1);
    game.act = 2;
    game.triggerEvent();
    assert.equal(selected.rare, true);
    rolls.push(0.18, 0.1);
    game.act = 3;
    game.triggerEvent();
    assert.equal(selected.rare, true);
});
