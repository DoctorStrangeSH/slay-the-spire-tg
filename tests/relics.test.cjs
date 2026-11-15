// node --test tests/relics.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const relicSource = fs.readFileSync(path.join(__dirname, '../js/data/relics.js'), 'utf8');
const battleSource = fs.readFileSync(path.join(__dirname, '../js/systems/BattleSystem.js'), 'utf8');

const { chooseRelic, getAvailableRelics } = vmRelics();
function vmRelics() {
    return require('node:vm').runInNewContext(relicSource +
        '\n({ chooseRelic, getAvailableRelics })');
}

test('three relics are unique and never offered twice', () => {
    const owned = [];
    for (let i = 0; i < 3; i++) {
        const relic = chooseRelic(owned, () => 0);
        assert.ok(relic);
        owned.push(relic.id);
    }
    assert.equal(new Set(owned).size, 3);
    assert.equal(chooseRelic(owned, () => 0), null);
    assert.equal(getAvailableRelics(owned).length, 0);
});

test('relic selection can reach the last available item', () => {
    const relic = chooseRelic([], () => 0.999);
    assert.equal(relic.id, 'chronicle');
});

const vm = require('node:vm');
const BattleSystem = vm.runInNewContext(battleSource + '\nBattleSystem;', {
    BattleCore: class {
        constructor(player, enemy) {
            this.player = player; this.enemy = enemy; this.maxEnergy = 3;
            this.drawPile = [1]; this.statusEffects = { enemy: { paralysis: 0 } };
        }
        hasPower(id) { return this.player.relics.includes(id); }
        drawCards(n) { this.drawn = n; }
        getEnemyIntent() { return 'attack'; }
    },
    BattleEffects: class { applyStartTurnEffects() {} },
    BattleCards: class {},
    BattleTurn: class {},
    BattleBuildings: class {}
});
function battle(relics) {
    return new BattleSystem({ heroId: 'berserk', relics }, { hp: 30 });
}
test('ember battery grants one extra energy each turn', () => {
    const state = battle(['emberBattery']);
    assert.equal(state.maxEnergy, 4);
    assert.equal(state.energy, 4);
    state.startTurn();
    assert.equal(state.energy, 4);
});
test('stoneguard grants four block each turn', () => {
    const state = battle(['stoneguard']);
    assert.equal(state.block, 4);
    state.block = 0;
    state.startTurn();
    assert.equal(state.block, 4);
});
test('chronicle draws six cards instead of five', () => {
    assert.equal(battle([]).drawn, 5);
    assert.equal(battle(['chronicle']).drawn, 6);
});
