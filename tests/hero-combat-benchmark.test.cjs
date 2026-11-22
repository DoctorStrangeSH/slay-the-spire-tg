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

function scoreStrategicRouteNode(node, player) {
    const maxHp = Math.max(1, Number(player.maxHp) || 1);
    const hp = Math.max(0, Math.min(maxHp, Number(player.hp) || 0));
    const hpRatio = hp / maxHp;
    const missingHp = maxHp - hp;
    const hasUpgrade = (player.deck || []).some(card => {
        const upgraded = card?.upgraded || card?.upgrade;
        return !upgraded && (card?.upgradeDamage || card?.upgradeBlock ||
            card?.upgradeDraw || card?.upgradeCost !== undefined);
    });

    switch (node.type) {
        case 'battle':
            return 5 - maxHp * 0.08 * (hpRatio < 0.4 ? 1.8 : hpRatio < 0.65 ? 1.3 : 1);
        case 'elite':
            return 24 - maxHp * 0.16 * (hpRatio < 0.4 ? 1.8 : hpRatio < 0.65 ? 1.3 : 1);
        case 'rest':
            return 5 + Math.min(missingHp, maxHp * 0.3) * 0.75 + (hasUpgrade ? 4 : 0);
        case 'shop': {
            const affordableOptions = Number(player.gold) >= 75 ? 3
                : Number(player.gold) >= 35 ? 2
                    : Number(player.gold) >= 30 ? 1 : 0;
            return 2 + Math.min(120, Math.max(0, Number(player.gold) || 0)) * 0.1
                + affordableOptions * 1.5;
        }
        case 'event':
            return 7 + (player.pendingEvent ? 0 : 1);
        case 'treasure':
            return 12 + Math.min(missingHp, maxHp * 0.35) * 0.35;
        case 'secret':
            return hpRatio >= 0.6 ? 12 : 7;
        case 'boss':
        case 'start':
        default:
            return 0;
    }
}

function chooseStrategicRoute(map, player, random = Math.random) {
    const byId = new Map(map.allNodes.map(node => [node.id, node]));
    const memo = new Map();
    const bestFrom = node => {
        if (memo.has(node.id)) return memo.get(node.id);
        const children = node.connections.map(id => byId.get(id)).filter(Boolean);
        const ownScore = scoreStrategicRouteNode(node, player);
        if (!children.length) {
            const result = { score: ownScore, nodes: [node] };
            memo.set(node.id, result);
            return result;
        }
        const candidates = children.map(child => {
            const tail = bestFrom(child);
            return { score: ownScore + tail.score, nodes: [node, ...tail.nodes] };
        });
        const bestScore = Math.max(...candidates.map(candidate => candidate.score));
        const best = candidates.filter(candidate => Math.abs(candidate.score - bestScore) < 1e-9);
        const selected = best[Math.min(best.length - 1, Math.floor(random() * best.length))];
        memo.set(node.id, selected);
        return selected;
    };
    const start = map.paths?.[0]?.[0] || map.allNodes.find(node => node.type === 'start');
    if (!start) return { nodes: [], score: 0 };
    return bestFrom(start);
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

function scoreRouteEventOutcome(before, after, result, deferredCard = null) {
    const maxHp = Math.max(1, Number(before.maxHp) || 1);
    const hpRatio = Math.max(0, Math.min(1, Number(before.hp) / maxHp));
    const hpDelta = Number(after.hp) - Number(before.hp);
    const maxHpDelta = Number(after.maxHp) - Number(before.maxHp);
    const goldDelta = Number(after.gold) - Number(before.gold);
    const deckBefore = Array.isArray(before.deck) ? before.deck : [];
    const deckAfter = Array.isArray(after.deck) ? after.deck : [];
    const relicBefore = Array.isArray(before.relics) ? before.relics : [];
    const relicAfter = Array.isArray(after.relics) ? after.relics : [];
    const hpWeight = hpDelta >= 0 && hpRatio < 0.55 ? 1.25 : 0.72;
    let score = hpDelta * hpWeight + maxHpDelta * 2.6 + goldDelta * 0.22;
    const addedCards = deckAfter.filter(card => !deckBefore.some(item => item.id === card.id));
    const removedCards = deckBefore.filter(card => !deckAfter.some(item => item.id === card.id));
    score += addedCards.reduce((sum, card) => sum + Math.max(0, scoreRouteCard(card)) * 0.32, 0);
    score -= removedCards.reduce((sum, card) => sum + Math.max(0, scoreRouteCard(card)) * 0.18, 0);
    score += relicAfter.filter(id => !relicBefore.includes(id)).length * 24;
    score -= relicBefore.filter(id => !relicAfter.includes(id)).length * 24;
    if (deferredCard) score += Math.max(0, scoreRouteCard(deferredCard)) * 0.32;

    const conditions = [
        ['blessingBattles', 4], ['ashBattles', 5], ['oathBattles', 4],
        ['curseBattles', -7], ['exhaustionBattles', -7], ['bloodMarkBattles', -6]
    ];
    for (const [key, weight] of conditions) {
        score += ((Number(after[key]) || 0) - (Number(before[key]) || 0)) * weight;
    }
    const debtKeys = [
        'veiledMerchantDebt', 'classEventDebt', 'archiveDebt', 'obeliskDebt'
    ];
    for (const key of debtKeys) {
        if (!before[key] && after[key]) score -= 12;
        else if (before[key] && !after[key]) score += 12;
    }
    if (result === 'deferred' && !deferredCard) score -= 8;
    return score;
}

function evaluateRouteEventOption(api, player, act, floor, seed, event, optionIndex) {
    const trialPlayer = JSON.parse(JSON.stringify(player));
    const trialGame = Object.create(api.Game.prototype);
    trialGame.player = trialPlayer;
    trialGame.act = act;
    trialGame.floor = floor;
    trialGame.runId = `benchmark:${player.heroId}:${act}:${floor}`;
    trialGame.currentNodeId = trialGame.runId;
    trialGame.offeredCards = [];
    trialGame.runSave = { save: () => true };
    trialGame.offerCard = () => {
        trialGame.offeredCards = api.getRandomRewardCards(
            player.heroId, 3, createRunRandom(seed ^ 0x6d2b79f5)
        );
    };
    const eventPool = event.rare
        ? trialGame.getEligibleRareEvents()
        : trialGame.getEventsForAct();
    const trialEvent = eventPool.find(candidate => candidate.name === event.name);
    const option = trialEvent?.options?.[optionIndex];
    if (!option) return null;
    const eventId = trialGame.getPendingEventDecisionId(trialEvent);
    trialPlayer.pendingEvent = {
        id: eventId, name: trialEvent.name,
        rare: Boolean(trialEvent.rare), nodeId: trialGame.currentNodeId
    };
    const before = JSON.parse(JSON.stringify(trialPlayer));
    const result = trialGame.commitEventDecision(trialEvent, option, eventId);
    if (result === false) return null;
    const deferredCard = result === 'deferred' && trialGame.offeredCards.length
        ? trialGame.offeredCards.reduce((best, card) =>
            scoreRouteCard(card) > scoreRouteCard(best) ? card : best)
        : null;
    return {
        score: scoreRouteEventOutcome(before, trialGame.player, result, deferredCard),
        result,
        deferredCard: deferredCard ? { ...deferredCard } : null
    };
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
    const evaluations = event.options.map((option, index) => ({
        option,
        index,
        evaluation: evaluateRouteEventOption(api, player, act, floor, seed, event, index)
    })).filter(item => item.evaluation);
    evaluations.sort((a, b) => b.evaluation.score - a.evaluation.score);
    const selected = evaluations[0];
    if (!selected) return player;
    const selectedResult = game.commitEventDecision(event, selected.option, eventId);
    if (selectedResult === false) return game.player;
    stats.eventDecisions++;
    if (selectedResult === 'deferred' && selected.evaluation.deferredCard) {
        player.deck.push({ ...selected.evaluation.deferredCard });
        stats.eventCardRewards++;
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
    const candidates = [];

    const healPrice = 35;
    const healAmount = Math.max(1, Math.floor(player.maxHp * 0.2));
    const effectiveHeal = Math.min(healAmount, player.maxHp - player.hp);
    const hpRatio = player.hp / Math.max(1, player.maxHp);
    if (effectiveHeal > 0 && player.gold >= healPrice && hpRatio <= 0.65) {
        const urgency = hpRatio <= 0.4 ? 1.55 : hpRatio <= 0.55 ? 1.3 : 1.05;
        candidates.push({
            id: 'heal', price: healPrice, utility: effectiveHeal * urgency,
            run: () => {
                const before = player.hp;
                if (buy('heal', healPrice,
                    () => { player.hp = Math.min(player.maxHp, player.hp + healAmount); return player.hp > before; },
                    () => { player.hp = before; })) stats.shopHeals++;
            }
        });
    }

    const eligible = player.deck.map(card => ({
        card,
        change: api.Game.prototype.getCardUpgrade.call(game, card)
    })).filter(item => item.change);
    const bestUpgrade = eligible.map(item => {
        const upgraded = { ...item.card, [item.change.stat]: item.change.next, upgraded: true };
        return { ...item, gain: scoreRouteCard(upgraded) - scoreRouteCard(item.card) };
    }).sort((a, b) => b.gain - a.gain)[0];
    const upgradePrice = 75;
    if (bestUpgrade && bestUpgrade.gain >= 1.5 && player.gold >= upgradePrice) {
        candidates.push({
            id: 'upgrade-card', price: upgradePrice, utility: bestUpgrade.gain * 2.5,
            run: () => {
                const target = bestUpgrade.card;
                const before = { ...target };
                if (buy('upgrade-card', upgradePrice,
                    () => api.Game.prototype.upgradeCard.call(game, target),
                    () => {
                        Object.keys(target).forEach(key => delete target[key]);
                        Object.assign(target, before);
                    })) stats.shopUpgrades++;
            }
        });
    }

    const offers = visit.offerCardIds.map(id => cards.find(card => card.id === id)).filter(Boolean);
    const deckAverage = player.deck.length
        ? player.deck.reduce((sum, card) => sum + scoreRouteCard(card), 0) / player.deck.length
        : 0;
    const cardPrice = card => api.Game.prototype.getShopPrice.call(game, card);
    const bestCard = offers.map(card => ({
        card,
        price: cardPrice(card),
        utility: scoreRouteCard(card) - deckAverage * 0.65 -
            Math.max(0, player.deck.length - 8) * 2
    })).filter(item => item.utility >= 4 && player.gold >= item.price)
        .sort((a, b) => b.utility / b.price - a.utility / a.price)[0];
    if (bestCard) {
        candidates.push({
            id: `card:${bestCard.card.id}`, price: bestCard.price, utility: bestCard.utility,
            run: () => {
                const purchased = { ...bestCard.card };
                if (buy(`card:${bestCard.card.id}`, bestCard.price,
                    () => { player.deck.push(purchased); return true; },
                    () => {
                        const index = player.deck.indexOf(purchased);
                        if (index >= 0) player.deck.splice(index, 1);
                    })) stats.shopCards++;
            }
        });
    }

    if (player.gold >= 65 && player.deck.length > 8 && player.deck.length > 5) {
        const weakest = player.deck.reduce((best, card) =>
            scoreRouteCard(card) < scoreRouteCard(best) ? card : best, player.deck[0]);
        const weakestScore = scoreRouteCard(weakest);
        const removalUtility = Math.max(0, deckAverage - weakestScore) * 0.8 +
            Math.max(0, player.deck.length - 8) * 2;
        if (weakestScore <= deckAverage * 0.55 || player.deck.length >= 11) {
            candidates.push({
                id: 'remove-card', price: 65, utility: removalUtility,
                run: () => {
                    const index = player.deck.indexOf(weakest);
                    if (index < 0) return;
                    if (buy('remove-card', 65,
                        () => player.deck.splice(index, 1).length === 1,
                        () => player.deck.splice(index, 0, weakest))) stats.shopRemovals++;
                }
            });
        }
    }

    // Spend on the strongest marginal improvement first; keep a small reserve
    // once the run has enough gold to support future event choices.
    candidates.sort((a, b) => b.utility / b.price - a.utility / a.price);
    for (const candidate of candidates) {
        const reserve = player.gold >= 100 && candidate.id !== 'heal' ? 20 : 0;
        if (player.gold - candidate.price < reserve) continue;
        if (candidate.utility / candidate.price < 0.1) continue;
        candidate.run();
    }

    stats.shopGoldSpent += visit.purchased.reduce((sum, id) => {
        if (id === 'heal') return sum + 35;
        if (id === 'upgrade-card') return sum + 75;
        if (id === 'remove-card') return sum + 65;
        const card = cards.find(item => id === `card:${item.id}`);
        return sum + (card ? cardPrice(card) : 0);
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

function simulateRouteCampaign(heroId, seed, policy = 'heal-when-useful', routePolicy = 'random') {
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
        const routeChoice = routePolicy === 'risk-aware'
            ? chooseStrategicRoute(map, player, routeRandom)
            : { nodes: chooseCompleteRoute(map, routeRandom), score: null };
        const route = routeChoice.nodes;
        const routeScore = routeChoice.score ?? route
            .reduce((sum, node) => sum + scoreStrategicRouteNode(node, player), 0);
        const stats = {
            act, routePolicy, routeScore: Number(routeScore.toFixed(2)), routeRooms: route.length - 2,
            plannedRests: route.filter(node => node.type === 'rest').length,
            plannedBattles: route.filter(node => node.type === 'battle').length,
            plannedElites: route.filter(node => node.type === 'elite').length,
            plannedShops: route.filter(node => node.type === 'shop').length,
            plannedEvents: route.filter(node => node.type === 'event').length,
            battles: 0, elites: 0, combatAttempts: 0, combatWins: 0,
            regularAttempts: 0, regularWins: 0, eliteAttempts: 0, eliteWins: 0,
            rests: 0, restHeals: 0, restUpgrades: 0, cardRewards: 0,
            relicRewards: 0, goldEarned: 0, shopVisits: 0, shopPurchases: 0,
            shopCards: 0, shopHeals: 0, shopUpgrades: 0, shopRemovals: 0, shopGoldSpent: 0,
            eventRooms: 0, eventDecisions: 0, eventGoldDelta: 0, eventHpDelta: 0,
            eventMaxHpDelta: 0, eventCardRewards: 0, eventRelicRewards: 0,
            bossReached: false, bossWon: false, bossAttempts: 0,
            hpBeforeBoss: null, hpAfterAct: null, deckSizeBeforeBoss: null,
            relicCountBeforeBoss: null, firstFailedEncounter: null
        };

        for (const node of route.slice(1)) {
            if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
                const isElite = node.type === 'elite';
                const isBoss = node.type === 'boss';
                const enemyId = isBoss
                    ? ACT_BOSS_IDS[act - 1]
                    : regularEnemies[Math.floor(combatRandom() * regularEnemies.length)];
                stats.combatAttempts++;
                if (isBoss) {
                    stats.bossReached = true;
                    stats.bossAttempts++;
                    stats.hpBeforeBoss = player.hp;
                    stats.deckSizeBeforeBoss = player.deck.length;
                    stats.relicCountBeforeBoss = player.relics.length;
                } else if (isElite) {
                    stats.eliteAttempts++;
                } else {
                    stats.regularAttempts++;
                }
                const encounterHpBefore = player.hp;
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
                    stats.combatWins++;
                    if (isBoss) stats.bossWon = true;
                    else if (isElite) stats.eliteWins++;
                    else stats.regularWins++;
                } else if (!stats.firstFailedEncounter) {
                    stats.firstFailedEncounter = {
                        type: isBoss ? 'boss' : isElite ? 'elite' : 'battle',
                        enemyId,
                        floor: node.floor ?? node.y ?? null,
                        outcome: result.outcome,
                        turns: result.turns,
                        hpBefore: encounterHpBefore,
                        hpAfter: result.hpRemaining,
                        enemyHpRemaining: result.enemyHpRemaining,
                        deckSize: player.deck.length,
                        relicCount: player.relics.length
                    };
                }
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
            // Shops and events are simulated above with value-ranked purchases
            // and isolated trial execution of the real event option actions.
        }

        stats.hpAfterAct = player.hp;
        report.push(stats);
        if (!alive) break;
    }
    return {
        heroId, seed, policy, routePolicy, acts: report,
        finalHp: player.hp, finalMaxHp: player.maxHp, finalGold: player.gold,
        deckSize: player.deck.length, relicCount: player.relics.length,
        completed: report.length === 3 && report[2].bossWon
    };
}

test('shop policy prioritizes critical healing over low-value purchases', () => {
    const api = createRouteApi(createRunRandom(2203));
    const hero = api.HEROES.berserk;
    const player = {
        heroId: 'berserk', hp: 20, maxHp: hero.maxHp, gold: 35,
        deck: api.getStarterDeckForHero('berserk').map(card => ({ ...card })),
        relics: []
    };
    const stats = { shopHeals: 0, shopUpgrades: 0, shopCards: 0, shopRemovals: 0,
        shopGoldSpent: 0, shopPurchases: 0 };
    const visit = simulateRouteShop(api, player, 2203, stats);
    assert.equal(stats.shopHeals, 1);
    assert.equal(visit.purchased[0], 'heal');
    assert.equal(stats.shopGoldSpent, 35);
    assert.equal(player.gold, 0);
    assert.ok(player.hp > 20);
});

test('event option evaluator executes real event actions and values healing at low HP', () => {
    const api = createRouteApi(createRunRandom(1907));
    const player = {
        heroId: 'berserk', hp: 35, maxHp: 80, gold: 0,
        deck: api.getStarterDeckForHero('berserk').map(card => ({ ...card })),
        relics: [], journalLog: [], eventHistory: [],
        pendingEvent: null, storyFlags: {}
    };
    const game = Object.create(api.Game.prototype);
    game.player = player;
    game.act = 1;
    const fountain = game.getEventsForAct().find(event => event.name === 'Загадочный фонтан');
    assert.ok(fountain);
    const heal = evaluateRouteEventOption(api, player, 1, 3, 1907, fountain, 0);
    const leave = evaluateRouteEventOption(api, player, 1, 3, 1907, fountain, 1);
    assert.ok(heal && leave);
    assert.ok(heal.score > leave.score);
    assert.equal(heal.result, undefined);
    assert.equal(player.hp, 35, 'trial evaluation must not mutate the live player');
});

test('risk-aware route selection chooses elite at high HP and rest at critical HP', () => {
    const map = {
        paths: [[{ id: 'start', type: 'start', connections: ['elite', 'rest'] }]],
        allNodes: [
            { id: 'start', type: 'start', connections: ['elite', 'rest'] },
            { id: 'elite', type: 'elite', connections: ['boss'] },
            { id: 'rest', type: 'rest', connections: ['boss'] },
            { id: 'boss', type: 'boss', connections: [] }
        ]
    };
    const healthy = chooseStrategicRoute(map, { hp: 80, maxHp: 80, gold: 0, deck: [] }, () => 0);
    const critical = chooseStrategicRoute(map, { hp: 20, maxHp: 80, gold: 0, deck: [] }, () => 0);
    assert.deepEqual(healthy.nodes.map(node => node.id), ['start', 'elite', 'boss']);
    assert.deepEqual(critical.nodes.map(node => node.id), ['start', 'rest', 'boss']);
});

test('risk-aware route selection values a shop only when current gold makes it useful', () => {
    const map = {
        paths: [[{ id: 'start', type: 'start', connections: ['shop', 'event'] }]],
        allNodes: [
            { id: 'start', type: 'start', connections: ['shop', 'event'] },
            { id: 'shop', type: 'shop', connections: ['boss'] },
            { id: 'event', type: 'event', connections: ['boss'] },
            { id: 'boss', type: 'boss', connections: [] }
        ]
    };
    const poor = chooseStrategicRoute(map, { hp: 80, maxHp: 80, gold: 0, deck: [] }, () => 0);
    const wealthy = chooseStrategicRoute(map, { hp: 80, maxHp: 80, gold: 120, deck: [] }, () => 0);
    assert.deepEqual(poor.nodes.map(node => node.id), ['start', 'event', 'boss']);
    assert.deepEqual(wealthy.nodes.map(node => node.id), ['start', 'shop', 'boss']);
});

test('risk-aware route selection is deterministic and only follows connected nodes', () => {
    const map = {
        paths: [[{ id: 'start', type: 'start', connections: ['left', 'right'] }]],
        allNodes: [
            { id: 'start', type: 'start', connections: ['left', 'right'] },
            { id: 'left', type: 'event', connections: ['boss'] },
            { id: 'right', type: 'treasure', connections: ['boss'] },
            { id: 'unreachable', type: 'elite', connections: ['boss'] },
            { id: 'boss', type: 'boss', connections: [] }
        ]
    };
    const randomA = createRunRandom(9137);
    const randomB = createRunRandom(9137);
    const a = chooseStrategicRoute(map, { hp: 80, maxHp: 80, gold: 0, deck: [] }, randomA);
    const b = chooseStrategicRoute(map, { hp: 80, maxHp: 80, gold: 0, deck: [] }, randomB);
    assert.deepEqual(a.nodes.map(node => node.id), b.nodes.map(node => node.id));
    assert.ok(a.nodes.every(node => node.id !== 'unreachable'));
    assert.equal(a.score, b.score);
});

test('route-aware boss benchmark compares campfire policies while carrying route rewards and HP across acts', () => {
    const report = [];
    const policies = ['heal-when-useful', 'upgrade-unless-critical'];
    const routePolicies = ['random', 'risk-aware'];
    for (const heroId of HERO_IDS) {
        const policyReports = [];
        for (const policy of policies) {
            for (const routePolicy of routePolicies) {
            const campaigns = [];
            for (let seed = 1; seed <= 50; seed++) {
                const campaign = simulateRouteCampaign(heroId, seed * 104729, policy, routePolicy);
                campaigns.push(campaign);
                assert.ok(campaign.acts.length >= 1 && campaign.acts.length <= 3);
                assert.ok(campaign.finalHp >= 0 && campaign.finalHp <= campaign.finalMaxHp);
                assert.ok(campaign.finalMaxHp >= apiMaxHp(heroId));
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
                    assert.equal(act.combatAttempts, act.combatWins +
                        (act.firstFailedEncounter ? 1 : 0),
                        'each act stops at the first failed combat after counting every completed win');
                    assert.equal(act.regularAttempts, act.regularWins +
                        (act.firstFailedEncounter?.type === 'battle' ? 1 : 0));
                    assert.equal(act.eliteAttempts, act.eliteWins +
                        (act.firstFailedEncounter?.type === 'elite' ? 1 : 0));
                    assert.equal(act.bossAttempts, act.bossWon ? 1 :
                        (act.firstFailedEncounter?.type === 'boss' ? 1 : 0));
                    if (act.firstFailedEncounter) {
                        assert.ok(['battle', 'elite', 'boss'].includes(act.firstFailedEncounter.type));
                        assert.ok(act.firstFailedEncounter.hpBefore > 0);
                        assert.ok(act.firstFailedEncounter.hpAfter >= 0);
                        assert.ok(act.firstFailedEncounter.deckSize >= apiStarterDeckSize(heroId));
                    }
                    if (act.bossReached) {
                        assert.ok(act.hpBeforeBoss > 0);
                        assert.ok(act.deckSizeBeforeBoss >= apiStarterDeckSize(heroId));
                        assert.ok(act.relicCountBeforeBoss >= 0);
                    }
                }
            }
            policyReports.push({
                policy,
                routePolicy,
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
                        regularAttempts: rows.reduce((sum, item) => sum + item.regularAttempts, 0),
                        regularWins: rows.reduce((sum, item) => sum + item.regularWins, 0),
                        eliteAttempts: rows.reduce((sum, item) => sum + item.eliteAttempts, 0),
                        eliteWins: rows.reduce((sum, item) => sum + item.eliteWins, 0),
                        combatAttempts: rows.reduce((sum, item) => sum + item.combatAttempts, 0),
                        combatWins: rows.reduce((sum, item) => sum + item.combatWins, 0),
                        firstFailureByEncounter: rows.reduce((summary, item) => {
                            const failure = item.firstFailedEncounter;
                            if (!failure) return summary;
                            const key = `${failure.type}:${failure.enemyId}:floor-${failure.floor ?? 'unknown'}`;
                            const entry = summary[key] || {
                                count: 0, totalHpBefore: 0, totalEnemyHpRemaining: 0,
                                totalTurns: 0, maxEnemyHpRemaining: 0
                            };
                            entry.count++;
                            entry.totalHpBefore += failure.hpBefore;
                            entry.totalEnemyHpRemaining += failure.enemyHpRemaining;
                            entry.totalTurns += failure.turns || 0;
                            entry.maxEnemyHpRemaining = Math.max(
                                entry.maxEnemyHpRemaining, failure.enemyHpRemaining);
                            summary[key] = entry;
                            return summary;
                        }, {}),
                        firstFailureTotals: rows.reduce((summary, item) => {
                            const failure = item.firstFailedEncounter;
                            if (!failure) return summary;
                            summary.count++;
                            summary.hpBefore += failure.hpBefore;
                            summary.enemyHpRemaining += failure.enemyHpRemaining;
                            summary.turns += failure.turns || 0;
                            return summary;
                        }, { count: 0, hpBefore: 0, enemyHpRemaining: 0, turns: 0 }),
                        firstFailureSamples: rows.filter(item => item.firstFailedEncounter)
                            .slice(0, 3).map(item => ({
                                type: item.firstFailedEncounter.type,
                                enemyId: item.firstFailedEncounter.enemyId,
                                floor: item.firstFailedEncounter.floor,
                                hpBefore: item.firstFailedEncounter.hpBefore,
                                enemyHpRemaining: item.firstFailedEncounter.enemyHpRemaining
                            })),
                        averageRouteScore: Number((rows.reduce((sum, item) => sum + item.routeScore, 0)
                            / Math.max(1, rows.length)).toFixed(2)),
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
        }
        report.push({ heroId, policies: policyReports });
    }
    console.log('ROUTE_AWARE_BOSS_CAMPAIGN_BENCHMARK ' + JSON.stringify(report));
});
function apiMaxHp(heroId) {
    const api = vm.runInNewContext(source + String.fromCharCode(10) + '({ HEROES })', { Math });
    return api.HEROES[heroId].maxHp;
}
