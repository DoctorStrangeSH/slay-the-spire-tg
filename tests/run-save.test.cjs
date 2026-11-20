// node --test tests/run-save.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/data/heroes.js',
    'js/data/cards/common.js',
    'js/data/cards/berserk.js',
    'js/data/cards/engineer.js',
    'js/data/cards/psyker.js',
    'js/data/cards/index.js',
    'js/data/relics.js',
    'js/systems/MapGenerator.js',
    'js/systems/RunSave.js'
].map(p => readFileSync(join(root, p), 'utf8')).join('\n');
const context = vm.runInNewContext(source + '\n({ MapGenerator, RunSave, GAME_CONFIG })', {
    Math, Date, JSON, console
});
const { MapGenerator, RunSave } = context;
function storage() {
    const values = new Map();
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }
    };
}
function game() {
    const mapGenerator = new MapGenerator(1, 'checkpoint-seed');
    return {
        player: { heroId: 'berserk', hp: 48, maxHp: 80, gold: 50, deck: [{ id: 'strike' }], relics: [] },
        act: 1, floor: 0, currentNodeId: 'floor_0_node_0', mapGenerator, gameState: 'map'
    };
}

test('checkpoint preserves hero, deck and seeded map after restore', () => {
    const persistence = new RunSave(storage());
    const original = game();
    assert.equal(persistence.save(original), true);
    const next = { player: null };
    assert.equal(persistence.restore(next), true);
    assert.equal(next.player.hp, 48);
    assert.equal(next.player.gold, 50);
    assert.equal(next.player.deck[0].id, 'strike');
    assert.equal(next.mapGenerator.seed, 'checkpoint-seed');
    assert.equal(next.mapGenerator.findNodeById(next.currentNodeId).visited, true);
});

test('checkpoint preserves deferred reward offers so they can resume without rerolling', () => {
    const persistence = new RunSave(storage());
    const original = game();
    original.offeredCards = [{ id: 'strike', name: 'Удар', damage: 6 }];
    assert.equal(persistence.save(original), true);

    const restored = { player: null, offeredCards: [] };
    assert.equal(persistence.restore(restored), true);
    assert.deepEqual(
        JSON.parse(JSON.stringify(restored.offeredCards)),
        JSON.parse(JSON.stringify(original.offeredCards))
    );
});

test('checkpoint rejects unknown deferred reward cards without mutating the target', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    const original = game();
    original.offeredCards = [{ id: 'strike' }];
    assert.equal(persistence.save(original), true);

    const corrupted = JSON.parse(memory.getItem(RunSave.KEY));
    corrupted.offeredCards = [{ id: 'not-a-real-card' }];
    memory.setItem(RunSave.KEY, JSON.stringify(corrupted));

    const target = { player: null, offeredCards: ['untouched'] };
    assert.equal(persistence.restore(target), false);
    assert.equal(target.player, null);
    assert.deepEqual(target.offeredCards, ['untouched']);
});

test('legacy checkpoint without deferred reward offers restores with an empty offer list', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    assert.equal(persistence.save(game()), true);
    const snapshot = JSON.parse(memory.getItem(RunSave.KEY));
    delete snapshot.offeredCards;
    memory.setItem(RunSave.KEY, JSON.stringify(snapshot));

    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.deepEqual(restored.offeredCards, []);
});

test('checkpoint preserves a pending camp choice for recovery after reload', () => {
    const persistence = new RunSave(storage());
    const original = game();
    const startId = original.currentNodeId;
    const target = original.mapGenerator.allNodes.find(node => node.type === 'rest');
    assert.ok(target, 'seed must contain a rest room');

    const queue = [{ id: startId, path: [] }];
    const seen = new Set([startId]);
    let route = null;
    while (queue.length && !route) {
        const current = queue.shift();
        if (current.id === target.id) {
            route = current.path;
            break;
        }
        const node = original.mapGenerator.findNodeById(current.id);
        for (const id of node.connections) {
            if (seen.has(id)) continue;
            seen.add(id);
            queue.push({ id, path: [...current.path, id] });
        }
    }
    assert.ok(route, 'rest room must be reachable');
    for (const id of route) {
        original.mapGenerator.visitNode(id);
        original.currentNodeId = id;
        original.floor = original.mapGenerator.findNodeById(id).floor;
    }
    original.player.pendingRest = true;
    assert.equal(original.mapGenerator.findNodeById(original.currentNodeId).type, 'rest');
    assert.equal(persistence.save(original), true);

    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.equal(restored.player.pendingRest, true);
});

test('checkpoint rejects a pending rest flag on a non-rest room', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    const original = game();
    original.player.pendingRest = true;
    assert.equal(persistence.save(original), true);

    const target = { player: null };
    assert.equal(persistence.restore(target), false);
    assert.equal(target.player, null);
});

test('checkpoint rejects malformed pending rest flags', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    assert.equal(persistence.save(game()), true);
    const corrupted = JSON.parse(memory.getItem(RunSave.KEY));
    corrupted.player.pendingRest = 'yes';
    memory.setItem(RunSave.KEY, JSON.stringify(corrupted));

    const target = { player: null };
    assert.equal(persistence.restore(target), false);
    assert.equal(target.player, null);
});

test('battle state is never saved as an unsafe partial checkpoint', () => {
    const persistence = new RunSave(storage());
    const current = game();
    current.gameState = 'battle';
    assert.equal(persistence.save(current), false);
    assert.equal(persistence.read(), null);
});

test('invalid and future-format saves are rejected without mutating game', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    persistence.save(game());
    const corrupted = JSON.parse(memory.getItem(RunSave.KEY));
    corrupted.version = 999;
    memory.setItem(RunSave.KEY, JSON.stringify(corrupted));
    const next = { player: null };
    assert.equal(persistence.restore(next), false);
    assert.equal(next.player, null);
    memory.setItem(RunSave.KEY, '{not json');
    assert.equal(persistence.restore(next), false);
});

test('checkpoint rejects unknown or locked heroes and cards without mutating game', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    const original = game();
    assert.equal(persistence.save(original), true);
    const baseline = JSON.parse(memory.getItem(RunSave.KEY));
    const target = { player: null, act: 77 };

    const lockedHero = structuredClone(baseline);
    lockedHero.player.heroId = 'plagueDoctor';
    memory.setItem(RunSave.KEY, JSON.stringify(lockedHero));
    assert.equal(persistence.restore(target), false);

    const unknownCard = structuredClone(baseline);
    unknownCard.player.deck[0].id = 'not-a-real-card';
    memory.setItem(RunSave.KEY, JSON.stringify(unknownCard));
    assert.equal(persistence.restore(target), false);

    assert.equal(target.player, null);
    assert.equal(target.act, 77);
});

test('checkpoint rejects unknown and duplicate relic identifiers', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    const original = game();
    original.player.relics = ['emberBattery'];
    assert.equal(persistence.save(original), true);
    const baseline = JSON.parse(memory.getItem(RunSave.KEY));
    const target = { player: null };

    const unknownRelic = structuredClone(baseline);
    unknownRelic.player.relics = ['not-a-relic'];
    memory.setItem(RunSave.KEY, JSON.stringify(unknownRelic));
    assert.equal(persistence.restore(target), false);

    const duplicateRelics = structuredClone(baseline);
    duplicateRelics.player.relics = ['emberBattery', 'emberBattery'];
    memory.setItem(RunSave.KEY, JSON.stringify(duplicateRelics));
    assert.equal(persistence.restore(target), false);

    assert.equal(target.player, null);
});

test('map tampering or incompatible generator version rejects checkpoint', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    persistence.save(game());
    const corrupted = JSON.parse(memory.getItem(RunSave.KEY));
    corrupted.map.signature = 'outdated-algorithm';
    memory.setItem(RunSave.KEY, JSON.stringify(corrupted));
    assert.equal(persistence.restore({ player: null }), false);
});

test('storage failures do not break gameplay', () => {
    const denied = {
        getItem() { throw Error('blocked'); },
        setItem() { throw Error('blocked'); },
        removeItem() { throw Error('blocked'); }
    };
    const persistence = new RunSave(denied);
    assert.equal(persistence.save(game()), false);
    assert.equal(persistence.restore({}), false);
    assert.doesNotThrow(() => persistence.clear());
});

test('non-serializable checkpoint state fails safely without interrupting gameplay', () => {
    const persistence = new RunSave(storage());
    const current = game();
    current.player.circularReference = current.player;

    assert.doesNotThrow(() => {
        assert.equal(persistence.save(current), false);
    });
    assert.equal(persistence.read(), null);
});


test('legacy treasure-as-shop map checkpoint still restores', () => {
    const persistence = new RunSave(storage());
    const previous = game();
    previous.mapGenerator = new MapGenerator(1, 'checkpoint-seed', { legacyTreasureShop: true });
    assert.equal(persistence.save(previous), true);
    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.equal(restored.mapGenerator.legacyTreasureShop, true);
});

test('checkpoint preserves unresolved obelisk bargain for a later event', () => {
    const persistence = new RunSave(storage());
    const original = game();
    original.player.obeliskDebt = 'owed';
    original.player.obeliskDebtAct = 1;
    original.player.obeliskDebtFloor = 0;
    assert.equal(persistence.save(original), true);
    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.equal(restored.player.obeliskDebt, 'owed');
    assert.equal(restored.player.obeliskDebtAct, 1);
    assert.equal(restored.player.obeliskDebtFloor, 0);
});

test('checkpoint remembers outstanding archive debt across a restore', () => {
    const persistence = new RunSave(storage());
    const original = game();
    original.player.archiveDebt = 'owed';
    original.player.archiveDebtAct = 1;
    original.player.archiveDebtFloor = 0;
    assert.equal(persistence.save(original), true);
    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.equal(restored.player.archiveDebt, 'owed');
    assert.equal(restored.player.archiveDebtAct, 1);
    assert.equal(restored.player.archiveDebtFloor, 0);
});

test('run checkpoint persists the chronological journal without losing decisions', () => {
    const persistence = new RunSave(storage());
    const current = game();
    current.player.pilgrimChoice = 'helped';
    current.player.obeliskDebt = 'owed';
    current.player.archiveDebt = 'owed';
    current.player.journalLog = [{
        id: 'run-checkpoint:1:3:palomnik',
        runId: 'run-checkpoint',
        act: 1, floor: 3, event: 'Паломник', choice: 'Помочь',
        outcome: 'золото: -20 · сюжет: помощь паломнику'
    }];
    assert.equal(persistence.save(current), true);
    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.equal(restored.player.journalLog.length, 1);
    assert.equal(restored.player.journalLog[0].choice, 'Помочь');
    assert.equal(restored.player.journalLog[0].id, 'run-checkpoint:1:3:palomnik');
    assert.equal(restored.player.pilgrimChoice, 'helped');
    assert.equal(restored.player.obeliskDebt, 'owed');
    assert.equal(restored.player.archiveDebt, 'owed');
});

test('run checkpoint retains battle wins, elite wins and boss wins', () => {
    const persistence = new RunSave(storage());
    const current = game();
    Object.assign(current.player, { battleWins: 6, eliteWins: 2, bossWins: 1 });
    assert.equal(persistence.save(current), true);
    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.equal(restored.player.battleWins, 6);
    assert.equal(restored.player.eliteWins, 2);
    assert.equal(restored.player.bossWins, 1);
});

test('checkpoint persists claimed treasure rooms to prevent reward duplication after reload', () => {
    const persistence = new RunSave(storage());
    const original = game();
    original.player.claimedTreasureNodes = ['floor_1_node_0', 'floor_2_node_1'];
    assert.equal(persistence.save(original), true);
    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.equal(JSON.stringify(restored.player.claimedTreasureNodes),
        JSON.stringify(['floor_1_node_0', 'floor_2_node_1']));
});

test('checkpoint preserves shop stock, purchases and visit completion', () => {
    const persistence = new RunSave(storage());
    const original = game();
    original.player.shopVisits = {
        floor_2_node_1: {
            offerCardIds: ['strike', 'guard'],
            purchased: ['card:strike', 'heal'],
            closed: false
        }
    };
    assert.equal(persistence.save(original), true);
    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.equal(JSON.stringify(restored.player.shopVisits), JSON.stringify(original.player.shopVisits));
    original.player.shopVisits.floor_2_node_1.closed = true;
    assert.equal(persistence.save(original), true);
    const resumed = { player: null };
    assert.equal(persistence.restore(resumed), true);
    assert.equal(resumed.player.shopVisits.floor_2_node_1.closed, true);
});

test('checkpoint retains the run id so outcomes are counted only once', () => {
    const persistence = new RunSave(storage());
    const original = game();
    original.runId = 'stable-run-id';
    assert.equal(persistence.save(original), true);
    const restored = persistence.read();
    assert.equal(restored.runId, 'stable-run-id');
});


test('checkpoint from pre-fix organic map restores without changing its routes', () => {
    const persistence = new RunSave(storage());
    const previous = game();
    previous.mapGenerator = new MapGenerator(1, 0, { legacyCrossingLayout: true });
    const oldSignature = persistence.mapSignature(previous.mapGenerator);
    assert.notEqual(oldSignature, persistence.mapSignature(new MapGenerator(1, 0)));
    assert.equal(persistence.save(previous), true);
    const restored = { player: null };
    assert.equal(persistence.restore(restored), true);
    assert.equal(restored.mapGenerator.legacyCrossingLayout, true);
    assert.equal(persistence.mapSignature(restored.mapGenerator), oldSignature);
});


test('checkpoint rejects disconnected visited rooms without mutating game', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    const original = game();
    const first = original.mapGenerator.getAvailableNodes(original.currentNodeId)[0];
    assert.ok(first);
    original.mapGenerator.visitNode(first.id);
    original.currentNodeId = first.id;
    original.floor = first.floor;
    assert.equal(persistence.save(original), true);

    const corrupted = JSON.parse(memory.getItem(RunSave.KEY));
    const disconnected = original.mapGenerator.allNodes.find(node =>
        node.floor > first.floor && !first.connections.includes(node.id));
    assert.ok(disconnected);
    corrupted.map.visited.push(disconnected.id);
    memory.setItem(RunSave.KEY, JSON.stringify(corrupted));

    const target = { player: null, act: 99, floor: 99 };
    assert.equal(persistence.restore(target), false);
    assert.equal(target.player, null);
    assert.equal(target.act, 99);
    assert.equal(target.floor, 99);
});

test('checkpoint rejects duplicate, future-floor and same-floor visited nodes', () => {
    const memory = storage();
    const persistence = new RunSave(memory);
    const original = game();
    const first = original.mapGenerator.getAvailableNodes(original.currentNodeId)[0];
    original.mapGenerator.visitNode(first.id);
    original.currentNodeId = first.id;
    original.floor = first.floor;
    assert.equal(persistence.save(original), true);

    const baseline = JSON.parse(memory.getItem(RunSave.KEY));
    const target = { player: null };
    const duplicate = structuredClone(baseline);
    duplicate.map.visited.push(first.id);
    memory.setItem(RunSave.KEY, JSON.stringify(duplicate));
    assert.equal(persistence.restore(target), false);

    const future = structuredClone(baseline);
    const later = original.mapGenerator.allNodes.find(node => node.floor > first.floor);
    assert.ok(later);
    future.map.visited.push(later.id);
    memory.setItem(RunSave.KEY, JSON.stringify(future));
    assert.equal(persistence.restore(target), false);

    const sibling = original.mapGenerator.paths[first.floor].find(node => node.id !== first.id);
    if (sibling) {
        const sameFloor = structuredClone(baseline);
        sameFloor.map.visited.push(sibling.id);
        memory.setItem(RunSave.KEY, JSON.stringify(sameFloor));
        assert.equal(persistence.restore(target), false);
    }
    assert.equal(target.player, null);
});
