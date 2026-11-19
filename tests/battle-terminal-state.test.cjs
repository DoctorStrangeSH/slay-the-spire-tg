// node --test tests/battle-terminal-state.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const cardsSource = readFileSync(join(root, 'js/systems/battle/BattleCards.js'), 'utf8');
const BattleCards = vm.runInNewContext(cardsSource + '\nBattleCards;', {});
const systemSource = readFileSync(join(root, 'js/systems/BattleSystem.js'), 'utf8');
const BattleSystem = vm.runInNewContext(
    'class BattleCore {}\n' + systemSource + '\nBattleSystem;',
    {}
);

test('queued cards stop resolving immediately after a lethal self-damage effect', () => {
    const cards = new BattleCards();
    let played = 0;
    const battle = {
        selectedCards: [0, 1],
        hand: [{ id: 'second' }, { id: 'first' }],
        player: { hp: 1 },
        enemy: { hp: 20 },
        playCard(index) {
            played++;
            this.hand.splice(index, 1);
            this.player.hp = 0;
            return { success: true };
        }
    };

    const result = cards.playSelectedCards(battle);

    assert.equal(result.success, true);
    assert.equal(played, 1);
    assert.equal(battle.player.hp, 0);
    assert.deepEqual(Array.from(battle.selectedCards), []);
});

test('already defeated player cannot be rescued by Engineer end-of-turn building damage', () => {
    let buildingTriggers = 0;
    let resolved = false;
    const state = {
        player: { hp: 0 },
        enemy: { hp: 20 },
        buildings: { triggerEndOfTurn() { buildingTriggers++; } },
        turnManager: {
            endTurn(battle) {
                resolved = true;
                return { battleEnded: true, victory: battle.enemy.hp <= 0 };
            }
        },
        effects: {}
    };

    const result = BattleSystem.prototype.endTurn.call(state);

    assert.equal(buildingTriggers, 0);
    assert.equal(resolved, true);
    assert.equal(result.victory, false);
});

test('already defeated enemy cannot receive extra Engineer end-of-turn triggers', () => {
    let buildingTriggers = 0;
    const state = {
        player: { hp: 10 },
        enemy: { hp: 0 },
        buildings: { triggerEndOfTurn() { buildingTriggers++; } },
        turnManager: { endTurn() { return { battleEnded: true, victory: true }; } },
        effects: {}
    };

    const result = BattleSystem.prototype.endTurn.call(state);

    assert.equal(buildingTriggers, 0);
    assert.equal(result.victory, true);
});

test('game routes lethal self-damage to defeat rather than victory', () => {
    const game = readFileSync(join(root, 'js/systems/Game.js'), 'utf8');
    const method = game.split('    playSelectedCards() {')[1].split('    endTurn() {')[0];
    assert.match(method, /else if \(this\.currentBattle\.player\.hp <= 0\)\s*\{\s*this\.endBattle\(false\);/);
});
