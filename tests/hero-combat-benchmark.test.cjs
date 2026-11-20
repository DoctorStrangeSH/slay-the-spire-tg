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
    'js/systems/BattleSystem.js',
    'js/systems/Game.js'
];
const source = files.map(file => readFileSync(join(root, file), 'utf8')).join('\n');

function simulate(heroId, enemyId, seed, elite = false, maxTurns = 30, build = null) {
    let state = seed >>> 0;
    const seededMath = Object.create(Math);
    seededMath.random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
    const api = vm.runInNewContext(source + '\n({ BattleSystem, HEROES, ENEMIES, getStarterDeckForHero, getRandomRewardCards, chooseRelic, Game })', {
        Math: seededMath
    });
    const hero = api.HEROES[heroId];
    const player = {
        heroId,
        hp: Math.min(
            Number.isFinite(build?.maxHp) ? build.maxHp : hero.maxHp,
            Math.max(1, Number.isFinite(build?.currentHp)
                ? Math.floor(build.currentHp)
                : Math.floor(hero.maxHp * (Number.isFinite(build?.initialHpPercent)
                    ? build.initialHpPercent : 1)))
        ),
        maxHp: Number.isFinite(build?.maxHp) ? build.maxHp : hero.maxHp,
        deck: (build?.deck || api.getStarterDeckForHero(heroId)).map(card => ({ ...card })),
        relics: [...(build?.relics || [])]
    };
    const baseEnemy = build?.enemy || api.ENEMIES[enemyId];
    const enemy = { ...baseEnemy, pattern: [...baseEnemy.pattern] };
    if (elite) {
        enemy.maxHp = Math.floor(enemy.maxHp * 1.5);
        enemy.hp = enemy.maxHp;
        enemy.damage = Math.floor(enemy.damage * 1.3);
    }
    const battle = new api.BattleSystem(player, enemy);
    if (enemy.isSecretBoss && Number(enemy.openingBlock) > 0) {
        battle.enemyBlock += Math.floor(enemy.openingBlock);
    }
    const conditions = build?.conditions ? { ...build.conditions } : null;
    if (conditions && !battle.battleEnded && player.hp > 0) {
        const blessing = Number(conditions.blessingBattles) || 0;
        const curse = Number(conditions.curseBattles) || 0;
        const oath = Number(conditions.oathBattles) || 0;
        const ash = Number(conditions.ashBattles) || 0;
        const exhaustion = Number(conditions.exhaustionBattles) || 0;
        const bloodMark = Number(conditions.bloodMarkBattles) || 0;
        if (blessing > 0) {
            battle.block += 5;
            conditions.blessingBattles = blessing - 1;
        }
        if (curse > 0) {
            battle.energy = Math.max(0, battle.energy - 1);
            conditions.curseBattles = curse - 1;
        }
        if (oath > 0) {
            battle.energy += 1;
            conditions.oathBattles = oath - 1;
        }
        if (ash > 0) {
            battle.statusEffects.player.strength += 2;
            conditions.ashBattles = ash - 1;
        }
        if (exhaustion > 0) {
            battle.statusEffects.player.strength -= 2;
            conditions.exhaustionBattles = exhaustion - 1;
        }
        if (bloodMark > 0) {
            player.hp = Math.max(1, player.hp - 4);
            conditions.bloodMarkBattles = bloodMark - 1;
        }
        if ((curse > 0 || exhaustion > 0 || bloodMark > 0) &&
            player.relics.includes('bloodPact')) {
            battle.statusEffects.player.strength += 2;
        }
    }
    const combatMetrics = {
        enemyAttacks: 0,
        enemyDefends: 0,
        heroTargetAttacks: 0,
        buildingTargetAttacks: 0,
        blockAbsorbed: 0,
        buildingDamage: 0,
        directHeroDamage: 0,
        poisonDamage: 0,
        selfDamage: 0
    };
    let resolvingEnemyAttack = false;
    let resolvingEnemyEndTurn = false;
    const originalTakeDamage = battle.takeDamage.bind(battle);
    battle.takeDamage = amount => {
        const hpBefore = player.hp;
        const result = originalTakeDamage(amount);
        const actualLoss = Math.max(0, hpBefore - player.hp);
        if (resolvingEnemyAttack) combatMetrics.directHeroDamage += actualLoss;
        else if (resolvingEnemyEndTurn) combatMetrics.poisonDamage += actualLoss;
        return result;
    };
    const originalTakeSelfDamage = battle.takeSelfDamage.bind(battle);
    battle.takeSelfDamage = amount => {
        const hpBefore = player.hp;
        const result = originalTakeSelfDamage(amount);
        combatMetrics.selfDamage += Math.max(0, hpBefore - player.hp);
        return result;
    };
    const turnManager = battle.turnManager;
    const originalEndTurn = turnManager.endTurn.bind(turnManager);
    turnManager.endTurn = (currentBattle, effects) => {
        resolvingEnemyEndTurn = true;
        try {
            return originalEndTurn(currentBattle, effects);
        } finally {
            resolvingEnemyEndTurn = false;
        }
    };
    const originalChooseTarget = turnManager.chooseTarget.bind(turnManager);
    turnManager.chooseTarget = currentBattle => {
        const target = originalChooseTarget(currentBattle);
        if (target.type === 'building') combatMetrics.buildingTargetAttacks++;
        else combatMetrics.heroTargetAttacks++;
        return target;
    };
    const originalEnemyAttack = turnManager.enemyAttack.bind(turnManager);
    turnManager.enemyAttack = currentBattle => {
        combatMetrics.enemyAttacks++;
        resolvingEnemyAttack = true;
        try {
            return originalEnemyAttack(currentBattle);
        } finally {
            resolvingEnemyAttack = false;
        }
    };
    const originalEnemyDefend = turnManager.enemyDefend.bind(turnManager);
    turnManager.enemyDefend = currentBattle => {
        combatMetrics.enemyDefends++;
        return originalEnemyDefend(currentBattle);
    };
    const originalAttackPlayer = turnManager.attackPlayer.bind(turnManager);
    turnManager.attackPlayer = (currentBattle, damage) => {
        const blockBefore = currentBattle.block;
        originalAttackPlayer(currentBattle, damage);
        combatMetrics.blockAbsorbed += Math.max(0, blockBefore - currentBattle.block);
    };
    const originalAttackBuilding = turnManager.attackBuilding.bind(turnManager);
    turnManager.attackBuilding = (currentBattle, building, damage) => {
        const hpBefore = Math.max(0, Number(building.hp) || 0);
        originalAttackBuilding(currentBattle, building, damage);
        combatMetrics.buildingDamage += Math.min(hpBefore, Math.max(0, damage));
    };
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
                const incomingDamage = getExpectedIncomingDamage(battle);
                const hits = Math.max(1, Number(card.hits) || 1);
                let score = 0;
                if (card.type === 'building') {
                    score = battle.buildings?.hasFreeSlots()
                        ? 16 + (card.damage || 0) * hits + (card.block || 0)
                        : -10;
                } else if (card.damage > 0) {
                    score = 24 + card.damage * hits * 1.15
                        + ((card.bleed || 0) + (card.poison || 0) + (card.fire || 0) +
                            (card.vulnerable || 0) * 2 + (card.weak || 0) * 2 +
                            (card.paralysis || 0) * 2);
                } else if (card.block > 0) {
                    const usefulBlock = Math.min(card.block, incomingDamage);
                    score = incoming
                        ? 15 + usefulBlock * 1.3 - Math.max(0, card.block - incomingDamage) * 0.25
                        : 5 + card.block * 0.2;
                } else if (card.draw > 0) {
                    score = 18 + card.draw * 4;
                } else if (card.type === 'power') {
                    score = 12 + (card.strength || 0) * 2 + (card.draw || 0) * 3;
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
        enemyHpRemaining: enemy.hp,
        conditions,
        openingState: {
            hp: player.hp,
            block: battle.block,
            energy: battle.energy,
            strength: Number(battle.statusEffects?.player?.strength) || 0,
            enemyBlock: battle.enemyBlock
        },
        damageDealt: Math.max(0, enemy.maxHp - enemy.hp),
        damageTaken: Number(battle.damageTakenThisBattle) || 0,
        combatMetrics
    };
}

test('route benchmark consumes temporary event conditions with the same opening effects as Game.beginEncounter', () => {
    const baseline = simulate('berserk', 'slime', 1103, false, 0, {
        currentHp: 40, maxHp: 80, relics: []
    });
    const conditioned = simulate('berserk', 'slime', 1103, false, 0, {
        currentHp: 40,
        maxHp: 80,
        relics: ['bloodPact'],
        conditions: {
            blessingBattles: 1,
            curseBattles: 1,
            oathBattles: 1,
            ashBattles: 1,
            exhaustionBattles: 1,
            bloodMarkBattles: 1
        }
    });
    assert.equal(conditioned.openingState.hp, baseline.openingState.hp - 4);
    assert.equal(conditioned.openingState.block, baseline.openingState.block + 5);
    assert.equal(conditioned.openingState.energy, baseline.openingState.energy);
    assert.equal(conditioned.openingState.strength, baseline.openingState.strength + 2);
    assert.deepEqual(conditioned.conditions, {
        blessingBattles: 0, curseBattles: 0, oathBattles: 0,
        ashBattles: 0, exhaustionBattles: 0, bloodMarkBattles: 0
    });
});

test('route benchmark uses the actual debt-collector boss profile and opening block', () => {
    const api = createRouteApi(createRunRandom(1109));
    const boss = api.getVeiledBossForRun({
        veiledMerchantDebt: 'settled',
        veiledMerchantDeals: 1
    });
    const result = simulate('berserk', 'darkLord', 1109, false, 0, {
        currentHp: 40, maxHp: 80, enemy: boss
    });
    assert.equal(boss.isSecretBoss, true);
    assert.equal(boss.maxHp, 330);
    assert.equal(result.openingState.enemyBlock, 8);
    assert.equal(result.enemyHpRemaining, 330);
});

function getExpectedIncomingDamage(battle) {
    if (battle.enemyIntent !== 'attack') return 0;
    const intent = battle.getEnemyIntentInfo();
    const damageToHero = Math.max(0, Number(intent.afterBlock) || 0);
    const buildingTargetChance = Math.max(0, Math.min(1, Number(intent.buildingTargetChance) || 0));
    return damageToHero * (1 - buildingTargetChance);
}

test('benchmark values block using expected hero damage when attacks can be redirected to buildings', () => {
    const cases = [
        [0, 10],
        [1, 5.5],
        [2, 4],
        [3, 2.5],
        [4, 2.5]
    ];
    for (const [buildingCount, expected] of cases) {
        let calls = 0;
        const battle = {
            enemyIntent: 'attack',
            getEnemyIntentInfo() {
                calls++;
                return {
                    afterBlock: 10,
                    buildingTargetChance: buildingCount === 0 ? 0 :
                        Math.round(Math.min(0.75, 0.30 + buildingCount * 0.15) * 100) / 100
                };
            }
        };
        assert.equal(getExpectedIncomingDamage(battle), expected);
        assert.equal(calls, 1);
    }
    assert.equal(getExpectedIncomingDamage({ enemyIntent: 'defend' }), 0);
});

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
                timeouts: results.filter(result => result.outcome === 'timeout').length,
                averageTurns: Number((results.reduce((sum, result) => sum + result.turns, 0) / results.length).toFixed(2)),
                averageHpRemaining: Number((results.reduce((sum, result) => sum + result.hpRemaining, 0) / results.length).toFixed(2))
            });
        }
    }
    console.log('ACT_BOSS_STARTER_DECK_BENCHMARK ' + JSON.stringify(report));
});


// Controlled act-ready snapshots use the game's real reward/relic registries and
// upgrade rules. The acquisition budget approximates a route with ~3 card rewards,
// one elite relic and one rest-site upgrade per completed act; it is not a claim
// that every generated map guarantees those exact rewards.
function buildActSnapshot(heroId, seed, targetAct) {
    let state = seed >>> 0;
    const random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
    const api = vm.runInNewContext(source + String.fromCharCode(10) +
        '({ getStarterDeckForHero, getRandomRewardCards, chooseRelic, Game })',
        { Math: Object.assign(Object.create(Math), { random }) });
    const deck = api.getStarterDeckForHero(heroId);
    const relics = [];
    const chooseCardScore = card =>
        (card.damage || 0) * (card.hits || 1) +
        (card.block || 0) * 0.8 +
        (card.draw || 0) * 5 +
        (card.heal || 0) * 2 +
        (card.bleed || 0) * 2 +
        (card.poison || 0) * 2 +
        (card.paralysis || 0) * 2 +
        (card.strength || 0) * 3 +
        (card.type === 'building' ? 8 : 0) -
        (card.selfDamage || 0) * 2 -
        (card.cost || 0) * 1.5;

    for (let act = 1; act <= targetAct; act++) {
        for (let reward = 0; reward < 3; reward++) {
            const offers = api.getRandomRewardCards(heroId, 3, random);
            if (!offers.length) continue;
            const chosen = offers.reduce((best, card) =>
                chooseCardScore(card) > chooseCardScore(best) ? card : best);
            deck.push({ ...chosen });
        }

        const relic = api.chooseRelic(relics, random, heroId);
        if (relic) relics.push(relic.id);

        // Apply the exact current Game upgrade implementation to the highest
        // value eligible card, once per act (rest-site budget).
        const upgradeTarget = [...deck]
            .filter(card => api.Game.prototype.getCardUpgrade.call({}, card))
            .sort((a, b) => chooseCardScore(b) - chooseCardScore(a))[0];
        if (upgradeTarget) {
            const gameMethods = {
                getCardUpgrade: api.Game.prototype.getCardUpgrade
            };
            api.Game.prototype.upgradeCard.call(gameMethods, upgradeTarget);
        }
    }

    return { deck, relics };
}

test('act-ready deck progression benchmark compares all heroes under the same acquisition budget', () => {
    const report = [];
    for (const heroId of HERO_IDS) {
        for (let act = 1; act <= 3; act++) {
            const results = [];
            const deckSizes = [];
            const relicCounts = [];
            for (let seed = 1; seed <= 20; seed++) {
                const build = buildActSnapshot(heroId, seed * 65537, act);
                const result = simulate(heroId, ACT_BOSS_IDS[act - 1], seed * 130363,
                    false, 80, build);
                assert.ok(['win', 'loss', 'timeout'].includes(result.outcome),
                    `${heroId} vs act ${act} boss returned an invalid outcome: ${JSON.stringify(result)}`);
                assert.ok(result.hpRemaining >= 0 && Number.isFinite(result.hpRemaining));
                assert.ok(result.enemyHpRemaining >= 0 && Number.isFinite(result.enemyHpRemaining));
                assert.ok(result.combatMetrics.enemyAttacks >= result.combatMetrics.heroTargetAttacks +
                    result.combatMetrics.buildingTargetAttacks - 0.000001);
                assert.ok(result.combatMetrics.enemyDefends <= result.turns);
                assert.ok(result.combatMetrics.blockAbsorbed >= 0);
                assert.ok(result.combatMetrics.buildingDamage >= 0);
                assert.ok(result.combatMetrics.directHeroDamage >= 0);
                assert.ok(result.combatMetrics.poisonDamage >= 0);
                assert.ok(result.combatMetrics.selfDamage >= 0);
                assert.equal(build.deck.length, apiStarterDeckSize(heroId) + act * 3,
                    'snapshot should add exactly three reward cards per completed act');
                deckSizes.push(build.deck.length);
                relicCounts.push(build.relics.length);
                results.push(result);
            }
            report.push({
                heroId,
                act,
                bossId: ACT_BOSS_IDS[act - 1],
                wins: results.filter(result => result.outcome === 'win').length,
                losses: results.filter(result => result.outcome === 'loss').length,
                timeouts: results.filter(result => result.outcome === 'timeout').length,
                averageTurns: Number((results.reduce((sum, result) => sum + result.turns, 0) / results.length).toFixed(2)),
                averageHpRemaining: Number((results.reduce((sum, result) => sum + result.hpRemaining, 0) / results.length).toFixed(2)),
                averageDamageDealt: Number((results.reduce((sum, result) => sum + result.damageDealt, 0) / results.length).toFixed(2)),
                averageDamageTaken: Number((results.reduce((sum, result) => sum + result.damageTaken, 0) / results.length).toFixed(2)),
                averageDamagePerTurn: Number((results.reduce((sum, result) => sum + result.damageDealt / Math.max(1, result.turns), 0) / results.length).toFixed(2)),
                averageEnemyAttacks: Number((results.reduce((sum, result) => sum + result.combatMetrics.enemyAttacks, 0) / results.length).toFixed(2)),
                averageEnemyDefends: Number((results.reduce((sum, result) => sum + result.combatMetrics.enemyDefends, 0) / results.length).toFixed(2)),
                averageAttacksTargetingHero: Number((results.reduce((sum, result) => sum + result.combatMetrics.heroTargetAttacks, 0) / results.length).toFixed(2)),
                averageAttacksTargetingBuildings: Number((results.reduce((sum, result) => sum + result.combatMetrics.buildingTargetAttacks, 0) / results.length).toFixed(2)),
                averageBlockAbsorbed: Number((results.reduce((sum, result) => sum + result.combatMetrics.blockAbsorbed, 0) / results.length).toFixed(2)),
                averageBuildingDamage: Number((results.reduce((sum, result) => sum + result.combatMetrics.buildingDamage, 0) / results.length).toFixed(2)),
                averageDirectHeroDamage: Number((results.reduce((sum, result) => sum + result.combatMetrics.directHeroDamage, 0) / results.length).toFixed(2)),
                averagePoisonDamage: Number((results.reduce((sum, result) => sum + result.combatMetrics.poisonDamage, 0) / results.length).toFixed(2)),
                averageSelfDamage: Number((results.reduce((sum, result) => sum + result.combatMetrics.selfDamage, 0) / results.length).toFixed(2)),
                deckSize: deckSizes[0],
                relics: relicCounts[0]
            });
        }
    }
    console.log('ACT_READY_DECK_PROGRESSION_BENCHMARK ' + JSON.stringify(report));
});

function apiStarterDeckSize(heroId) {
    const api = vm.runInNewContext(source + String.fromCharCode(10) + '({ getStarterDeckForHero })', { Math });
    return api.getStarterDeckForHero(heroId).length;
}


test('act boss benchmark measures sensitivity to health carried into the boss room', () => {
    const report = [];
    const startingHealth = [1, 0.7, 0.4];
    for (const heroId of HERO_IDS) {
        for (let act = 1; act <= 3; act++) {
            for (const initialHpPercent of startingHealth) {
                const results = [];
                for (let seed = 1; seed <= 20; seed++) {
                    const build = buildActSnapshot(heroId, seed * 65537, act);
                    build.initialHpPercent = initialHpPercent;
                    const result = simulate(heroId, ACT_BOSS_IDS[act - 1],
                        seed * 130363, false, 80, build);
                    assert.ok(['win', 'loss', 'timeout'].includes(result.outcome));
                    assert.ok(result.hpRemaining >= 0 && Number.isFinite(result.hpRemaining));
                    assert.ok(result.enemyHpRemaining >= 0 && Number.isFinite(result.enemyHpRemaining));
                    results.push(result);
                }
                report.push({
                    heroId,
                    act,
                    bossId: ACT_BOSS_IDS[act - 1],
                    startingHpPercent: Math.round(initialHpPercent * 100),
                    wins: results.filter(result => result.outcome === 'win').length,
                    losses: results.filter(result => result.outcome === 'loss').length,
                    timeouts: results.filter(result => result.outcome === 'timeout').length,
                    averageTurns: Number((results.reduce((sum, result) => sum + result.turns, 0) / results.length).toFixed(2)),
                    averageDamageTaken: Number((results.reduce((sum, result) => sum + result.damageTaken, 0) / results.length).toFixed(2))
                });
            }
        }
    }
    console.log('ACT_BOSS_STARTING_HEALTH_SENSITIVITY ' + JSON.stringify(report));
});


// Route-aware campaign diagnostics use the active organic map generator and
// carry HP, cards and relics between rooms and acts. This remains a deterministic
// policy benchmark, not an optimal-player simulation.
const mapSource = source + '\n' + readFileSync(join(root, 'js/systems/MapGenerator.js'), 'utf8');

function createRouteApi(random = Math.random) {
    const seededMath = Object.create(Math);
    seededMath.random = random;
    return vm.runInNewContext(mapSource + '\n({ MapGenerator, HEROES, getStarterDeckForHero, getRandomRewardCards, chooseRelic, getCardsForHero, getAvailableRelics, getVeiledBossForRun, Game })', {
        Math: seededMath,
        alert: () => {}
    });
}

function createRunRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function chooseCompleteRoute(map, random) {
    const byId = new Map(map.allNodes.map(node => [node.id, node]));
    const memo = new Map();
    const countRoutes = node => {
        if (memo.has(node.id)) return memo.get(node.id);
        const children = node.connections.map(id => byId.get(id)).filter(Boolean);
        const count = children.length
            ? children.reduce((sum, child) => sum + countRoutes(child), 0)
            : 1;
        memo.set(node.id, count);
        return count;
    };
    let node = map.paths[0][0];
    countRoutes(node);
    const route = [];
    while (node) {
        route.push(node);
        const children = node.connections.map(id => byId.get(id)).filter(Boolean);
        if (!children.length) break;
        let ticket = random() * children.reduce((sum, child) => sum + countRoutes(child), 0);
        let chosen = children[children.length - 1];
        for (const child of children) {
            ticket -= countRoutes(child);
            if (ticket < 0) {
                chosen = child;
                break;
            }
        }
        node = chosen;
    }
    return route;
}

function chooseBestReward(api, heroId, rewardRandom) {
    const offers = api.getRandomRewardCards(heroId, 3, rewardRandom);
    if (!offers.length) return null;
    const score = card =>
        (card.damage || 0) * (card.hits || 1) +
        (card.block || 0) * 0.8 +
        (card.draw || 0) * 5 +
        (card.heal || 0) * 2 +
        (card.bleed || 0) * 2 +
        (card.poison || 0) * 2 +
        (card.paralysis || 0) * 2 +
        (card.strength || 0) * 3 +
        (card.type === 'building' ? 8 : 0) -
        (card.selfDamage || 0) * 2 -
        (card.cost || 0) * 1.5;
    return { ...offers.reduce((best, card) => score(card) > score(best) ? card : best) };
}

function scoreRouteCard(card) {
    return (card.damage || 0) * (card.hits || 1) +
        (card.block || 0) * 0.8 +
        (card.draw || 0) * 5 +
        (card.heal || 0) * 2 +
        (card.bleed || 0) * 2 +
        (card.poison || 0) * 2 +
        (card.paralysis || 0) * 2 +
        (card.strength || 0) * 3 +
        (card.type === 'building' ? 8 : 0) -
        (card.selfDamage || 0) * 2 -
        (card.cost || 0) * 1.5;
}

function scoreRouteEventOption(option, player) {
    const label = String(option?.text || '');
    const hpGain = Number(label.match(/\+\s*(\d+)\s*HP/i)?.[1] || 0);
    const hpLoss = Number(label.match(/[−-]\s*(\d+)\s*HP/i)?.[1] || 0);
    const goldGain = Number(label.match(/\+\s*(\d+)\s*золота/i)?.[1] || 0);
    const goldCost = Number(label.match(/[−-]\s*(\d+)\s*золота/i)?.[1] || 0);
    const maxHpGain = Number(label.match(/\+\s*(\d+)\s*(?:к максимуму HP|максимальных HP|к макс\. HP)/i)?.[1] || 0);
    if (hpLoss && player.hp <= hpLoss) return -Infinity;
    if (goldCost && player.gold < goldCost) return -Infinity;
    let score = Math.min(hpGain, player.maxHp - player.hp) * 1.35;
    score += goldGain * 0.28;
    score += maxHpGain * 2.5;
    score -= hpLoss * 1.7;
    score -= goldCost * 0.28;
    if (/реликви/i.test(label)) score += 32;
    if (/карт/i.test(label)) score += 18;
    if (/улучшить|закалить|перековать/i.test(label)) score += 17;
    if (/проклятие|долг|усилится|метка|истощения|заберёт часть твоих сил/i.test(label)) score -= 18;
    if (/уйти|отказаться|отвернуться|оставить|не трогать|пройти мимо|покинуть/i.test(label)) score = Math.max(score, 0);
    return score;
}

function simulateRouteEvent(api, player, act, floor, seed, stats) {
    const eventRandom = createRunRandom(seed);
    const game = Object.create(api.Game.prototype);
    game.player = player;
    game.act = act;
    game.floor = floor;
    game.runId = `benchmark:${player.heroId}:${act}:${floor}`;
    game.currentNodeId = game.runId;
    game.offeredCards = [];
    game.runSave = { save: () => true };
    game.offerCard = () => {
        game.offeredCards = api.getRandomRewardCards(player.heroId, 3);
    };

    const rareEvents = game.getEligibleRareEvents();
    const isRare = rareEvents.length > 0 && eventRandom() < game.getRareEventChance();
    const events = isRare ? rareEvents : game.getEventsForAct();
    const history = Array.isArray(player.eventHistory) ? player.eventHistory.slice(-2) : [];
    const freshEvents = events.filter(event => !history.includes(event.name));
    const available = freshEvents.length ? freshEvents : events;
    let event = available[Math.floor(eventRandom() * available.length)];
    if (!isRare) {
        const followUpNames = [
            'Возвращение паломника', 'Хранитель Расколотого Обелиска',
            'Чернильный Сборщик', 'Сборщик Долгов'
        ];
        const followUps = available.filter(candidate => followUpNames.includes(candidate.name));
        if (followUps.length && eventRandom() < 0.55) {
            event = followUps[Math.floor(eventRandom() * followUps.length)];
        }
    }
    if (!event?.options?.length) return player;

    player.eventHistory = [...(Array.isArray(player.eventHistory) ? player.eventHistory.slice(-19) : []), event.name];
    const eventId = game.getPendingEventDecisionId(event);
    player.pendingEvent = { id: eventId, name: event.name, rare: Boolean(event.rare), nodeId: game.currentNodeId };
    const before = {
        hp: player.hp, maxHp: player.maxHp, gold: player.gold,
        cards: player.deck.length, relics: player.relics.length
    };
    const options = [...event.options].sort((a, b) =>
        scoreRouteEventOption(b, player) - scoreRouteEventOption(a, player));
    let committed = false;
    let selectedResult = false;
    for (const option of options) {
        if (scoreRouteEventOption(option, player) === -Infinity) continue;
        const result = game.commitEventDecision(event, option, eventId);
        if (result !== false) {
            committed = true;
            selectedResult = result;
            stats.eventDecisions++;
            break;
        }
        // commitEventDecision restores the player's snapshot by replacing the
        // reference; keep subsequent room processing on that committed state.
        player = game.player;
    }
    if (!committed) return player;
    if (selectedResult === 'deferred' && game.offeredCards.length) {
        const card = chooseBestReward(api, player.heroId, createRunRandom(seed ^ 0x7f4a7c15));
        if (card) {
            player.deck.push(card);
            stats.eventCardRewards++;
        }
    }
    stats.eventGoldDelta += player.gold - before.gold;
    stats.eventHpDelta += player.hp - before.hp;
    stats.eventRelicRewards += Math.max(0, player.relics.length - before.relics);
    stats.eventMaxHpDelta += player.maxHp - before.maxHp;
    return player;
}

function simulateRouteShop(api, player, seed, stats) {
    const random = createRunRandom(seed);
    const cards = Object.values(api.getCardsForHero(player.heroId));
    const pool = [...cards];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const visit = { offerCardIds: pool.slice(0, 4).map(card => card.id), purchased: [], closed: false };
    const game = Object.create(api.Game.prototype);
    game.player = player;
    game.runSave = { save: () => true };
    const buy = (id, price, apply, rollback) =>
        api.Game.prototype.commitShopPurchase.call(game, visit, id, price, apply, rollback);

    // Policy: recover dangerous HP loss first, then improve the strongest eligible
    // card, buy the best affordable offer, and thin oversized decks.
    if (player.gold >= 35 && player.hp <= player.maxHp * 0.70) {
        const before = player.hp;
        const amount = Math.max(1, Math.floor(player.maxHp * 0.2));
        if (buy('heal', 35,
            () => { player.hp = Math.min(player.maxHp, player.hp + amount); return player.hp > before; },
            () => { player.hp = before; })) stats.shopHeals++;
    }

    const eligible = player.deck.filter(card =>
        api.Game.prototype.getCardUpgrade.call(game, card));
    if (player.gold >= 75 && eligible.length) {
        const target = [...eligible].sort((a, b) => scoreRouteCard(b) - scoreRouteCard(a))[0];
        const before = { ...target };
        if (buy('upgrade-card', 75,
            () => api.Game.prototype.upgradeCard.call(game, target),
            () => {
                Object.keys(target).forEach(key => delete target[key]);
                Object.assign(target, before);
            })) stats.shopUpgrades++;
    }

    const offers = visit.offerCardIds.map(id => cards.find(card => card.id === id)).filter(Boolean);
    const affordable = offers.filter(card =>
        player.gold >= api.Game.prototype.getShopPrice.call(game, card));
    if (affordable.length) {
        const card = affordable.sort((a, b) => scoreRouteCard(b) - scoreRouteCard(a))[0];
        const price = api.Game.prototype.getShopPrice.call(game, card);
        const purchased = { ...card };
        if (buy(`card:${card.id}`, price,
            () => { player.deck.push(purchased); return true; },
            () => {
                const index = player.deck.indexOf(purchased);
                if (index >= 0) player.deck.splice(index, 1);
            })) stats.shopCards++;
    }

    if (player.gold >= 65 && player.deck.length > 8) {
        const weakest = player.deck.reduce((best, card) =>
            scoreRouteCard(card) < scoreRouteCard(best) ? card : best, player.deck[0]);
        const index = player.deck.indexOf(weakest);
        const removed = player.deck[index];
        if (buy('remove-card', 65,
            () => player.deck.splice(index, 1).length === 1,
            () => player.deck.splice(index, 0, removed))) stats.shopRemovals++;
    }

    stats.shopGoldSpent += visit.purchased.reduce((sum, id) => {
        if (id === 'heal') return sum + 35;
        if (id === 'upgrade-card') return sum + 75;
        if (id === 'remove-card') return sum + 65;
        const card = cards.find(item => id === `card:${item.id}`);
        return sum + (card ? api.Game.prototype.getShopPrice.call(game, card) : 0);
    }, 0);
    stats.shopPurchases += visit.purchased.length;
    return visit;
}

function applyRouteRest(api, player, policy) {
    const healAmount = Math.max(1, Math.floor(player.maxHp * 0.3));
    const actualHeal = Math.min(healAmount, player.maxHp - player.hp);
    // Explicit policy: heal when the campfire can restore at least 15% max HP;
    // otherwise upgrade the highest-scoring eligible card.
    const shouldHeal = policy === 'heal-when-useful'
        ? actualHeal >= player.maxHp * 0.15
        : player.hp <= player.maxHp * 0.55 && actualHeal > 0;
    if (shouldHeal) {
        player.hp += actualHeal;
        return 'heal';
    }
    const eligible = player.deck
        .filter(card => api.Game.prototype.getCardUpgrade.call({}, card))
        .sort((a, b) => {
            const score = card => (card.damage || 0) * (card.hits || 1)
                + (card.block || 0) * 0.8 + (card.draw || 0) * 5
                + (card.heal || 0) * 2 + (card.strength || 0) * 3;
            return score(b) - score(a);
        });
    if (eligible.length) {
        const methods = { getCardUpgrade: api.Game.prototype.getCardUpgrade };
        api.Game.prototype.upgradeCard.call(methods, eligible[0]);
        return 'upgrade';
    }
    if (actualHeal > 0) {
        player.hp += actualHeal;
        return 'heal-fallback';
    }
    return 'skip';
}

function simulateRouteCampaign(heroId, seed, policy = 'heal-when-useful') {
    const apiRandom = createRunRandom(seed ^ 0x27d4eb2f);
    const api = createRouteApi(apiRandom);
    const routeRandom = createRunRandom(seed ^ 0x5f3759df);
    const rewardRandom = createRunRandom(seed ^ 0x6c8e9cf5);
    const combatRandom = createRunRandom(seed ^ 0x1b873593);
    const hero = api.HEROES[heroId];
    let player = {
        heroId,
        hp: hero.maxHp,
        maxHp: hero.maxHp,
        deck: api.getStarterDeckForHero(heroId).map(card => ({ ...card })),
        relics: [],
        gold: 0,
        eventHistory: [],
        journalLog: [],
        curseBattles: 0,
        bloodMarkBattles: 0,
        exhaustionBattles: 0,
        blessingBattles: 0,
        ashBattles: 0,
        oathBattles: 0,
        veiledMerchantDebt: null,
        classEventDebt: null,
        archiveDebt: null,
        obeliskDebt: null
    };
    const report = [];
    const cardRewardChance = 0.7;
    const regularEnemies = ENEMY_IDS;
    let alive = true;

    for (let act = 1; act <= 3 && alive; act++) {
        const map = new api.MapGenerator(act, `route-aware-${heroId}-${seed}-act-${act}`);
        const route = chooseCompleteRoute(map, routeRandom);
        const stats = {
            act, routeRooms: route.length - 2,
            plannedRests: route.filter(node => node.type === 'rest').length,
            plannedBattles: route.filter(node => node.type === 'battle').length,
            plannedElites: route.filter(node => node.type === 'elite').length,
            plannedShops: route.filter(node => node.type === 'shop').length,
            plannedEvents: route.filter(node => node.type === 'event').length,
            battles: 0, elites: 0, rests: 0, restHeals: 0, restUpgrades: 0, cardRewards: 0,
            relicRewards: 0, goldEarned: 0, shopVisits: 0, shopPurchases: 0,
            shopCards: 0, shopHeals: 0, shopUpgrades: 0, shopRemovals: 0, shopGoldSpent: 0,
            eventRooms: 0, eventDecisions: 0, eventGoldDelta: 0, eventHpDelta: 0,
            eventMaxHpDelta: 0, eventCardRewards: 0, eventRelicRewards: 0,
            bossReached: false, bossWon: false,
            hpBeforeBoss: null, hpAfterAct: null, deckSizeBeforeBoss: null,
            relicCountBeforeBoss: null
        };

        for (const node of route.slice(1)) {
            if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
                const isElite = node.type === 'elite';
                const isBoss = node.type === 'boss';
                const enemyId = isBoss
                    ? ACT_BOSS_IDS[act - 1]
                    : regularEnemies[Math.floor(combatRandom() * regularEnemies.length)];
                if (isBoss) {
                    stats.bossReached = true;
                    stats.hpBeforeBoss = player.hp;
                    stats.deckSizeBeforeBoss = player.deck.length;
                    stats.relicCountBeforeBoss = player.relics.length;
                }
                const combatSeed = Math.floor(combatRandom() * 0xffffffff) >>> 0;
                const merchantTouched = (Number(player.veiledMerchantDeals) || 0) > 0 ||
                    ['owed', 'settled', 'defaulted', 'declined', 'purchased'].includes(player.veiledMerchantDebt);
                const enemyOverride = isBoss && act === 3 && merchantTouched
                    ? api.getVeiledBossForRun(player) : null;
                const result = simulate(heroId, enemyId, combatSeed, isElite, 80, {
                    currentHp: player.hp,
                    maxHp: player.maxHp,
                    deck: player.deck,
                    relics: player.relics,
                    enemy: enemyOverride,
                    conditions: {
                        blessingBattles: player.blessingBattles,
                        curseBattles: player.curseBattles,
                        oathBattles: player.oathBattles,
                        ashBattles: player.ashBattles,
                        exhaustionBattles: player.exhaustionBattles,
                        bloodMarkBattles: player.bloodMarkBattles
                    }
                });
                player.hp = result.hpRemaining;
                if (result.conditions) Object.assign(player, result.conditions);
                if (result.outcome === 'win') {
                    const relicAvailable = isElite
                        ? api.chooseRelic(player.relics, rewardRandom, heroId)
                        : null;
                    if (relicAvailable) {
                        player.relics.push(relicAvailable.id);
                        stats.relicRewards++;
                    }
                    const goldReward = Math.floor(rewardRandom() * 20) +
                        (isElite ? 25 : 10) + (isElite && !relicAvailable ? 40 : 0) +
                        (enemyOverride?.isSecretBoss ? 80 : 0);
                    player.gold += goldReward;
                    stats.goldEarned += goldReward;
                }
                if (isBoss) {
                    stats.bossWon = result.outcome === 'win';
                    if (stats.bossWon && rewardRandom() < cardRewardChance) {
                        const card = chooseBestReward(api, heroId, rewardRandom);
                        if (card) {
                            player.deck.push(card);
                            stats.cardRewards++;
                        }
                    }
                    alive = stats.bossWon;
                    break;
                }
                if (result.outcome !== 'win') {
                    alive = false;
                    break;
                }
                if (isElite) {
                    stats.elites++;
                } else {
                    stats.battles++;
                }
                if (rewardRandom() < cardRewardChance) {
                    const card = chooseBestReward(api, heroId, rewardRandom);
                    if (card) {
                        player.deck.push(card);
                        stats.cardRewards++;
                    }
                }
            } else if (node.type === 'event') {
                stats.eventRooms++;
                player = simulateRouteEvent(api, player, act, node.floor ?? node.y ?? stats.eventRooms,
                    seed ^ (act * 131071) ^ (stats.eventRooms * 32771), stats);
            } else if (node.type === 'shop') {
                stats.shopVisits++;
                simulateRouteShop(api, player, seed ^ (act * 65537) ^ (stats.shopVisits * 8191), stats);
            } else if (node.type === 'rest') {
                stats.rests++;
                const decision = applyRouteRest(api, player, policy);
                if (decision === 'heal' || decision === 'heal-fallback') stats.restHeals++;
                if (decision === 'upgrade') stats.restUpgrades++;
            } else if (node.type === 'treasure') {
                // The treasure room offers gold, healing, or a rare card. The
                // policy heals below 70% HP and otherwise takes the rare card.
                if (player.hp <= player.maxHp * 0.7) {
                    player.hp = Math.min(player.maxHp,
                        player.hp + Math.max(1, Math.floor(player.maxHp * 0.35)));
                } else {
                    const cards = Object.values(api.getCardsForHero(heroId));
                    const rare = cards.filter(card => card.rarity === 'rare');
                    const pool = rare.length ? rare : cards;
                    if (pool.length) {
                        player.deck.push({ ...pool[Math.floor(rewardRandom() * pool.length)] });
                        stats.cardRewards++;
                    }
                }
            }
            // Shop/event choices are intentionally not fabricated. Their rooms
            // remain on the route, but their economic effects are outside this
            // first route-aware combat model.
        }

        stats.hpAfterAct = player.hp;
        report.push(stats);
        if (!alive) break;
    }
    return {
        heroId, seed, policy, acts: report, finalHp: player.hp, finalGold: player.gold,
        deckSize: player.deck.length, relicCount: player.relics.length,
        completed: report.length === 3 && report[2].bossWon
    };
}

test('route-aware boss benchmark compares campfire policies while carrying route rewards and HP across acts', () => {
    const report = [];
    const policies = ['heal-when-useful', 'upgrade-unless-critical'];
    for (const heroId of HERO_IDS) {
        const policyReports = [];
        for (const policy of policies) {
            const campaigns = [];
            for (let seed = 1; seed <= 12; seed++) {
                const campaign = simulateRouteCampaign(heroId, seed * 104729, policy);
                campaigns.push(campaign);
                assert.ok(campaign.acts.length >= 1 && campaign.acts.length <= 3);
                assert.ok(campaign.finalHp >= 0 && campaign.finalHp <= apiMaxHp(heroId));
                assert.ok(campaign.finalGold >= 0);
                for (const act of campaign.acts) {
                    assert.ok(act.plannedRests >= 1,
                        'every generated route must include the pre-boss rest');
                    assert.ok(act.battles <= act.plannedBattles && act.elites <= act.plannedElites);
                    assert.ok(act.shopVisits <= act.plannedShops);
                    assert.ok(act.shopPurchases <= act.shopVisits * 4);
                    assert.ok(act.shopGoldSpent >= 0 && act.goldEarned >= 0);
                    assert.ok(act.eventRooms <= act.plannedEvents);
                    assert.equal(act.eventDecisions, act.eventRooms,
                        'every visited event room must commit exactly one decision');
                    assert.ok(act.restHeals + act.restUpgrades <= act.rests);
                    if (act.bossReached) {
                        assert.ok(act.hpBeforeBoss > 0);
                        assert.ok(act.deckSizeBeforeBoss >= apiStarterDeckSize(heroId));
                        assert.ok(act.relicCountBeforeBoss >= 0);
                    }
                }
            }
            policyReports.push({
                policy,
                campaigns: campaigns.length,
                fullRunWins: campaigns.filter(item => item.completed).length,
                reachedBosses: campaigns.reduce((sum, item) =>
                    sum + item.acts.filter(act => act.bossReached).length, 0),
                acts: [1, 2, 3].map(act => {
                    const rows = campaigns.map(item => item.acts.find(entry => entry.act === act)).filter(Boolean);
                    const bossRows = rows.filter(item => item.bossReached);
                    return {
                        act,
                        bossAttempts: bossRows.length,
                        bossWins: bossRows.filter(item => item.bossWon).length,
                        averageHpBeforeBoss: bossRows.length
                            ? Number((bossRows.reduce((sum, item) => sum + item.hpBeforeBoss, 0)
                                / bossRows.length).toFixed(2)) : null,
                        averageCardRewards: Number((rows.reduce((sum, item) => sum + item.cardRewards, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageEliteRelics: Number((rows.reduce((sum, item) => sum + item.relicRewards, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageRestHeals: Number((rows.reduce((sum, item) => sum + item.restHeals, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageRestUpgrades: Number((rows.reduce((sum, item) => sum + item.restUpgrades, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageGoldEarned: Number((rows.reduce((sum, item) => sum + item.goldEarned, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageShopVisits: Number((rows.reduce((sum, item) => sum + item.shopVisits, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageShopPurchases: Number((rows.reduce((sum, item) => sum + item.shopPurchases, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageShopGoldSpent: Number((rows.reduce((sum, item) => sum + item.shopGoldSpent, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageEventRooms: Number((rows.reduce((sum, item) => sum + item.eventRooms, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageEventDecisions: Number((rows.reduce((sum, item) => sum + item.eventDecisions, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageEventGoldDelta: Number((rows.reduce((sum, item) => sum + item.eventGoldDelta, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageEventHpDelta: Number((rows.reduce((sum, item) => sum + item.eventHpDelta, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
                        averageEventCardRewards: Number((rows.reduce((sum, item) => sum + item.eventCardRewards, 0)
                            / Math.max(1, rows.length)).toFixed(2))
                    };
                })
            });
        }
        report.push({ heroId, policies: policyReports });
    }
    console.log('ROUTE_AWARE_BOSS_CAMPAIGN_BENCHMARK ' + JSON.stringify(report));
});
function apiMaxHp(heroId) {
    const api = vm.runInNewContext(source + String.fromCharCode(10) + '({ HEROES })', { Math });
    return api.HEROES[heroId].maxHp;
}
