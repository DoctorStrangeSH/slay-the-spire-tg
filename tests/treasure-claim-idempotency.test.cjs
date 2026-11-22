// node --test tests/treasure-claim-idempotency.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');

function createDom() {
    const body = { children: [], appendChild(node) { this.children.push(node); } };
    const makeElement = tag => ({
        tag, children: [], textContent: '', removed: false,
        appendChild(node) { this.children.push(node); },
        remove() { this.removed = true; },
        querySelector(selector) {
            if (selector === '.modal-content') return this.content;
            return null;
        }
    });
    const document = {
        body,
        createElement(tag) {
            const node = makeElement(tag);
            if (tag === 'div') {
                node.content = makeElement('div');
                node.querySelector = selector => selector === '.modal-content' ? node.content : null;
            }
            return node;
        }
    };
    return { document, body };
}

function loadGame() {
    const dom = createDom();
    const Game = vm.runInNewContext(source + '\nGame;', {
        document: dom.document,
        getAvailableRelics: () => [],
        getStarterDeckForHero: () => [],
        console
    });
    return { Game, ...dom };
}

test('treasure reward callback grants only one reward on repeated activation', () => {
    const { Game, body } = loadGame();
    const game = Object.create(Game.prototype);
    game.player = { gold: 0, maxHp: 80, hp: 40, deck: [], relics: [], claimedTreasureNodes: [] };
    game.currentNodeId = 'floor_2_node_1';
    let continues = 0;
    let saves = 0;
    let savedSnapshot = null;
    game.continueJourney = () => { continues++; };
    game.runSave = { save(instance) {
        saves++;
        savedSnapshot = JSON.parse(JSON.stringify(instance.player));
        return true;
    } };
    game.applyTreasureReward = type => {
        if (type !== 'gold') return false;
        game.player.gold += 75;
        return true;
    };

    game.openTreasure();
    const modal = body.children[0];
    const goldButton = modal.content.children[0];
    goldButton.onclick();
    goldButton.onclick();

    assert.equal(game.player.gold, 75);
    assert.equal(JSON.stringify(game.player.claimedTreasureNodes), JSON.stringify(['floor_2_node_1']));
    assert.equal(continues, 1);
    assert.equal(saves, 1);
    assert.equal(savedSnapshot.gold, 75);
    assert.deepEqual(savedSnapshot.claimedTreasureNodes, ['floor_2_node_1']);
    assert.equal(modal.removed, true);
});

test('a claimed treasure room cannot grant a second reward after reopening', () => {
    const { Game, body } = loadGame();
    const game = Object.create(Game.prototype);
    game.player = { gold: 75, maxHp: 80, hp: 40, deck: [], relics: [],
        claimedTreasureNodes: ['floor_2_node_1'] };
    game.currentNodeId = 'floor_2_node_1';
    let continues = 0;
    game.continueJourney = () => { continues++; };
    game.applyTreasureReward = () => {
        game.player.gold += 75;
        return true;
    };

    game.openTreasure();
    assert.equal(body.children.length, 0);
    assert.equal(game.player.gold, 75);
    assert.equal(continues, 1);
});

test('fresh runs clear previously claimed treasure room ids', () => {
    const { Game } = loadGame();
    const game = Object.create(Game.prototype);
    game.player = {
        heroId: 'berserk', hp: 40, maxHp: 80, gold: 99, deck: [], relics: [],
        eventHistory: [], journalLog: [], battleWins: 4, eliteWins: 2, bossWins: 1,
        claimedTreasureNodes: ['old-run-room']
    };
    game.runSave = { clear() {} };
    game.generateNewMap = () => {};
    game.showMap = () => {};
    game.startNewGame();
    assert.equal(JSON.stringify(game.player.claimedTreasureNodes), '[]');
});

test('failed treasure checkpoint rolls back the reward and keeps the choice open', () => {
    const { Game, body } = loadGame();
    const game = Object.create(Game.prototype);
    game.player = { gold: 10, maxHp: 80, hp: 40, deck: [], relics: [], claimedTreasureNodes: [] };
    game.currentNodeId = 'floor_3_node_2';
    let continues = 0;
    let saves = 0;
    game.continueJourney = () => { continues++; };
    game.runSave = { save() { saves++; return false; } };
    game.applyTreasureReward = type => {
        if (type !== 'gold') return false;
        game.player.gold += 75;
        return true;
    };

    game.openTreasure();
    const modal = body.children[0];
    const goldButton = modal.content.children[0];
    goldButton.onclick();

    assert.equal(saves, 1);
    assert.equal(game.player.gold, 10);
    assert.deepEqual(game.player.claimedTreasureNodes, []);
    assert.equal(continues, 0);
    assert.equal(modal.removed, false);
});

test('duplicate treasure claim is rejected before applying or saving a reward', () => {
    const { Game } = loadGame();
    const game = Object.create(Game.prototype);
    game.player = { gold: 85, claimedTreasureNodes: ['floor_1_node_2'] };
    game.runSave = { save() { assert.fail('duplicate claim must not checkpoint'); } };
    game.applyTreasureReward = () => assert.fail('duplicate claim must not apply a reward');

    assert.equal(game.commitTreasureClaim('gold', 'floor_1_node_2'), false);
    assert.equal(game.player.gold, 85);
});
