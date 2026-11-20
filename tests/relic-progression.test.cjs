// node --test tests/relic-progression.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gameSource = fs.readFileSync(path.join(__dirname, '../js/systems/Game.js'), 'utf8');

class MockBattleSystem {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.energy = 3;
        this.block = 0;
        this.enemyBlock = 0;
        this.statusEffects = { player: { strength: 0 }, enemy: {} };
    }
}

const context = vm.createContext({ BattleSystem: MockBattleSystem });
const Game = vm.runInContext(gameSource + '\nGame;', context);

function makeGame(player) {
    const game = Object.create(Game.prototype);
    game.player = player;
    game.showBattle = () => { game.battleShown = true; };
    return game;
}

test('eternity shard extends only valid temporary blessings by one battle', () => {
    const game = makeGame({ relics: ['eternityShard'], blessingBattles: 2 });
    assert.equal(game.grantTemporaryBlessing('blessingBattles', 3), 4);
    assert.equal(game.player.blessingBattles, 6);
    assert.equal(game.grantTemporaryBlessing('oathBattles', 1), 2);
    assert.equal(game.player.oathBattles, 2);
    assert.equal(game.grantTemporaryBlessing('ashBattles', 0), 1);
    assert.equal(game.player.ashBattles, 1);
    assert.equal(game.grantTemporaryBlessing('curseBattles', 3), 0);
    assert.equal(game.player.curseBattles, undefined);
});

test('eternity shard respects the 99-battle cap and does not create invalid durations', () => {
    const game = makeGame({ relics: ['eternityShard'], blessingBattles: 98 });
    assert.equal(game.grantTemporaryBlessing('blessingBattles', 5), 1);
    assert.equal(game.player.blessingBattles, 99);
    assert.equal(game.grantTemporaryBlessing('oathBattles', -2), 1);
    assert.equal(game.player.oathBattles, 1);
    assert.equal(game.grantTemporaryBlessing('ashBattles', 1.5), 1);
    assert.equal(game.player.ashBattles, 1);
});

test('blood pact grants strength for each active curse type, including the final charge', () => {
    for (const [curseKey, expectedStrength] of [
        ['curseBattles', 2],
        ['exhaustionBattles', 0],
        ['bloodMarkBattles', 2]
    ]) {
        const player = {
            hp: 30,
            relics: ['bloodPact'],
            [curseKey]: 1
        };
        const game = makeGame(player);
        game.beginEncounter({ id: 'test-enemy' });
        assert.equal(game.currentBattle.statusEffects.player.strength, expectedStrength, curseKey);
        assert.equal(player[curseKey], 0, curseKey);
        assert.equal(game.battleShown, true, curseKey);
    }
});

test('blood pact does not grant strength when no curse is active', () => {
    const game = makeGame({ hp: 30, relics: ['bloodPact'] });
    game.beginEncounter({ id: 'test-enemy' });
    assert.equal(game.currentBattle.statusEffects.player.strength, 0);
});

test('blood pact is inert without the relic while curse penalties still apply', () => {
    const game = makeGame({ hp: 30, relics: [], exhaustionBattles: 1 });
    game.beginEncounter({ id: 'test-enemy' });
    assert.equal(game.currentBattle.statusEffects.player.strength, -2);
    assert.equal(game.player.exhaustionBattles, 0);
});
