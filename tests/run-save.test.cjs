// node --test tests/run-save.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = [
    'js/config/constants.js',
    'js/systems/MapGenerator.js',
    'js/systems/RunSave.js'
].map(p => readFileSync(join(root, p), 'utf8')).join('\n');
const context = vm.runInNewContext(source + '\n({ MapGenerator, RunSave, GAME_CONFIG })', {
    Math, Date, JSON, console,
    HEROES: { berserk: { id: 'berserk' } }
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
        player: { heroId: 'berserk', hp: 48, maxHp: 80, gold: 50, deck: [{ id: 'attack' }], relics: [] },
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
    assert.equal(next.player.deck[0].id, 'attack');
    assert.equal(next.mapGenerator.seed, 'checkpoint-seed');
    assert.equal(next.mapGenerator.findNodeById(next.currentNodeId).visited, true);
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
