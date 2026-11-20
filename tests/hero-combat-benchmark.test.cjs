// Deterministic starter-deck benchmark. This is a QA heuristic, not a substitute
// for human playtesting or a claim that the bot represents optimal play.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const files = [
    'js/config/constants.js',
    'js/data/heroes.js',
    'js/data/cards/common.js',
    'js/data/cards/berserk.js',
    'js/data/cards/engineer.js',
    'js/data/cards/psyker.js',
    'js/data/cards/index.js',
    'js/data/enemies.js',
    'js/data/relics.js',
    'js/systems/battle/BattleCore.js',
    'js/systems/battle/BattleEffects.js',
    'js/systems/battle/BattleBuildings.js',
    'js/systems/battle/BattleCards.js',
    'js/systems/battle/BattleTurn.js',
    'js/systems/BattleSystem.js'
];
const source = files.map(file => readFileSync(join(root, file), 'utf8')).join('\n');

function simulate(heroId, enemyId, seed, elite = false, maxTurns = 30) {
    let state = seed >>> 0;
    const seededMath = Object.create(Math);
    seededMath.random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
    const api = vm.runInNewContext(source + '\n({ BattleSystem, HEROES, ENEMIES, getStarterDeckForHero })', {
        Math: seededMath
    });
    const hero = api.HEROES[heroId];
    const player = {
        heroId,
        hp: hero.maxHp,
        maxHp: hero.maxHp,
        deck: api.getStarterDeckForHero(heroId),
        relics: []
    };
    const enemy = { ...api.ENEMIES[enemyId], pattern: [...api.ENEMIES[enemyId].pattern] };
    if (elite) {
        enemy.maxHp = Math.floor(enemy.maxHp * 1.5);
        enemy.hp = enemy.maxHp;
        enemy.damage = Math.floor(enemy.damage * 1.3);
    }
    const battle = new api.BattleSystem(player, enemy);
    let turns = 0;

    while (player.hp > 0 && enemy.hp > 0 && turns < maxTurns) {
        let plays = 0;
        while (player.hp > 0 && enemy.hp > 0 && plays < 20) {
            let bestIndex = -1;
            let bestScore = -Infinity;
            for (let index = 0; index < battle.hand.length; index++) {
                const card = battle.hand[index];
                const cost = battle.cards.calculateCardCost(battle, card, battle.cardsPlayedThisTurn + 1);
                if (cost > battle.energy) continue;
                const incoming = battle.enemyIntent === 'attack';
                let score = 0;
                if (card.type === 'building') {
                    score = battle.buildings?.hasFreeSlots() ? 18 + (card.damage || 0) + (card.block || 0) : -10;
                } else if (card.damage > 0) {
                    score = 20 + card.damage * (incoming ? 0.9 : 1);
                } else if (card.block > 0) {
                    score = (incoming ? 35 : 8) + card.block;
                } else if (card.draw > 0) {
                    score = 12 + card.draw;
                } else {
                    score = 1;
                }
                if (card.selfDamage) score -= card.selfDamage * 2;
                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = index;
                }
            }
            if (bestIndex < 0) break;
            const result = battle.playCard(bestIndex);
            if (!result.success) break;
            plays++;
        }
        if (player.hp <= 0 || enemy.hp <= 0) break;
        const result = battle.endTurn();
        turns++;
        if (result?.battleEnded) break;
    }

    return {
        outcome: player.hp <= 0 ? 'loss' : enemy.hp <= 0 ? 'win' : 'timeout',
        turns,
        hpRemaining: player.hp,
        enemyHpRemaining: enemy.hp
    };
}

const HERO_IDS = ['berserk', 'engineer', 'psyker'];
const ENEMY_IDS = ['slime', 'goblin', 'skeleton', 'wolf'];

test('starter decks complete deterministic regular and elite combat benchmarks without invalid state', () => {
    const report = [];
    for (const heroId of HERO_IDS) {
        for (const enemyId of ENEMY_IDS) {
            for (const elite of [false, true]) {
                const results = [];
                for (let seed = 1; seed <= 5; seed++) {
                    const result = simulate(heroId, enemyId, seed * 7919, elite);
                    assert.ok(['win', 'loss'].includes(result.outcome),
                        `${heroId} vs ${enemyId} (elite=${elite}) did not resolve: ${JSON.stringify(result)}`);
                    assert.ok(Number.isFinite(result.hpRemaining) && result.hpRemaining >= 0);
                    assert.ok(Number.isFinite(result.enemyHpRemaining) && result.enemyHpRemaining >= 0);
                    assert.ok(result.turns <= 30);
                    results.push(result);
                }
                report.push({
                    heroId,
                    enemyId,
                    encounter: elite ? 'elite' : 'regular',
                    wins: results.filter(result => result.outcome === 'win').length,
                    averageTurns: Number((results.reduce((sum, result) => sum + result.turns, 0) / results.length).toFixed(2)),
                    averageHpRemaining: Number((results.reduce((sum, result) => sum + result.hpRemaining, 0) / results.length).toFixed(2))
                });
            }
        }
    }
    console.log('STARTER_DECK_COMBAT_BENCHMARK ' + JSON.stringify(report));
});

test('benchmark is reproducible for a fixed hero, enemy, encounter type and seed', () => {
    for (const heroId of HERO_IDS) {
        for (const enemyId of ENEMY_IDS) {
            assert.deepEqual(
                simulate(heroId, enemyId, 20261120, false),
                simulate(heroId, enemyId, 20261120, false)
            );
        }
    }
});


const ACT_BOSS_IDS = ['forestBoss', 'caveBoss', 'castleBoss'];

test('act bosses resolve deterministic starter-deck benchmark encounters for all heroes', () => {
    const report = [];
    for (const heroId of HERO_IDS) {
        for (const enemyId of ACT_BOSS_IDS) {
            const results = [];
            for (let seed = 1; seed <= 5; seed++) {
                const result = simulate(heroId, enemyId, seed * 104729, false, 80);
                assert.ok(['win', 'loss'].includes(result.outcome),
                    `${heroId} vs ${enemyId} did not resolve within 80 turns: ${JSON.stringify(result)}`);
                assert.ok(Number.isFinite(result.hpRemaining) && result.hpRemaining >= 0);
                assert.ok(Number.isFinite(result.enemyHpRemaining) && result.enemyHpRemaining >= 0);
                results.push(result);
            }
            report.push({
                heroId,
                bossId: enemyId,
                wins: results.filter(result => result.outcome === 'win').length,
                losses: results.filter(result => result.outcome === 'loss').length,
                averageTurns: Number((results.reduce((sum, result) => sum + result.turns, 0) / results.length).toFixed(2)),
                averageHpRemaining: Number((results.reduce((sum, result) => sum + result.hpRemaining, 0) / results.length).toFixed(2))
            });
        }
    }
    console.log('ACT_BOSS_STARTER_DECK_BENCHMARK ' + JSON.stringify(report));
});
