const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const relics = fs.readFileSync(path.join(__dirname, '../js/data/relics.js'), 'utf8');
const { chooseRelic, getAvailableRelics } = vm.runInNewContext(
    relics + '\n({ chooseRelic, getAvailableRelics })'
);

test('class relics are restricted to their own hero', () => {
    for (const [hero, expected] of [
        ['berserk', 'bloodFang'],
        ['engineer', 'ironCog'],
        ['psyker', 'mindEye']
    ]) {
        const offered = getAvailableRelics([], hero);
        assert.equal(offered.length, 6);
        assert.equal(offered.filter(r => r.heroId).length, 1);
        assert.equal(offered.find(r => r.heroId).id, expected);
    }
    assert.equal(getAvailableRelics([]).length, 5);
});

test('hero can obtain the class relic, but never twice', () => {
    const relic = chooseRelic([], () => 0.999999, 'engineer');
    assert.equal(relic.id, 'ironCog');
    assert.equal(getAvailableRelics([relic.id], 'engineer').length, 5);
    assert.equal(chooseRelic(['emberBattery', 'stoneguard', 'chronicle', 'eternityShard', 'bloodPact', 'ironCog'], () => 0.5, 'engineer'), null);
});

const battleSource = fs.readFileSync(path.join(__dirname, '../js/systems/BattleSystem.js'), 'utf8');
const BattleSystem = vm.runInNewContext(battleSource + '\nBattleSystem;', {
    BattleCore: class {
        constructor(player, enemy) {
            this.player = player;
            this.enemy = enemy;
            this.maxEnergy = 3;
            this.drawPile = [1];
            this.statusEffects = { enemy: { paralysis: 0 } };
        }
        hasPower(id) { return this.player.relics.includes(id); }
        drawCards(n) { this.drawn = n; }
        getEnemyIntent() { return 'attack'; }
    },
    BattleEffects: class { applyStartTurnEffects() {} },
    BattleCards: class {},
    BattleTurn: class {},
    BattleBuildings: class { triggerStartOfTurn() {} }
});
function battle(heroId, relics, hp = 50) {
    return new BattleSystem({ heroId, relics, hp, maxHp: 100 }, { hp: 30 });
}

test('berserk relic triggers only when HP is at most half', () => {
    const state = battle('berserk', ['bloodFang'], 51);
    assert.equal(state.block, 0);
    state.player.hp = 50;
    state.startTurn();
    assert.equal(state.block, 5);
    state.player.hp = 60;
    state.startTurn();
    assert.equal(state.block, 0);
});

test('engineer relic stacks with stoneguard and checks hero', () => {
    assert.equal(battle('engineer', ['ironCog', 'stoneguard']).block, 6);
    assert.equal(battle('berserk', ['ironCog', 'stoneguard']).block, 4);
});

test('psyker relic and chronicle add draws together', () => {
    assert.equal(battle('psyker', ['mindEye']).drawn, 6);
    assert.equal(battle('psyker', ['mindEye', 'chronicle']).drawn, 7);
    assert.equal(battle('engineer', ['mindEye']).drawn, 5);
});
