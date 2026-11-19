// Данные врагов
const ENEMIES = {
    // Обычные враги
    slime: {
        id: 'slime',
        name: 'Слизень',
        emoji: '🟢',
        maxHp: 30,
        hp: 30,
        damage: 5,
        pattern: ['attack', 'attack', 'defend'],
        patternIndex: 0,
        isBoss: false
    },
    goblin: {
        id: 'goblin',
        name: 'Гоблин',
        emoji: '👺',
        maxHp: 40,
        hp: 40,
        damage: 7,
        pattern: ['attack', 'attack', 'attack'],
        patternIndex: 0,
        isBoss: false
    },
    skeleton: {
        id: 'skeleton',
        name: 'Скелет',
        emoji: '💀',
        maxHp: 50,
        hp: 50,
        damage: 8,
        pattern: ['defend', 'attack', 'attack'],
        patternIndex: 0,
        isBoss: false
    },
    wolf: {
        id: 'wolf',
        name: 'Волк',
        emoji: '🐺',
        maxHp: 45,
        hp: 45,
        damage: 9,
        pattern: ['attack', 'attack'],
        patternIndex: 0,
        isBoss: false
    },
    
    // Боссы актов
    forestBoss: {
        id: 'forestBoss',
        name: 'Древний Энт',
        emoji: '🌳',
        maxHp: 150,
        hp: 150,
        damage: 15,
        pattern: ['attack', 'defend', 'attack', 'attack', 'defend'],
        patternIndex: 0,
        isBoss: true,
        specialAbility: 'root_grasp'
    },
    caveBoss: {
        id: 'caveBoss',
        name: 'Каменный Голем',
        emoji: '🗿',
        maxHp: 200,
        hp: 200,
        damage: 20,
        pattern: ['defend', 'attack', 'attack', 'attack'],
        patternIndex: 0,
        isBoss: true,
        specialAbility: 'rock_armor'
    },
    castleBoss: {
        id: 'castleBoss',
        name: 'Тёмный Лорд',
        emoji: '🧙',
        maxHp: 250,
        hp: 250,
        damage: 25,
        pattern: ['attack', 'attack', 'defend', 'attack'],
        patternIndex: 0,
        isBoss: true,
        specialAbility: 'dark_magic'
    }
};

// Боссы по актам
const BOSSES_BY_ACT = {
    1: 'forestBoss',
    2: 'caveBoss',
    3: 'castleBoss'
};

// Получить босса для акта
function getBossForAct(act) {
    const bossId = BOSSES_BY_ACT[act] || 'castleBoss';
    return { ...ENEMIES[bossId] };
}

// Тайный босс появляется только после контакта с Безликим Торговцем.
// Его исходные параметры отражают выбор игрока, а фазы развиваются в бою.
function getVeiledBossForRun(player = {}) {
    const consequence = ['owed', 'settled', 'defaulted', 'declined', 'purchased']
        .includes(player.veiledMerchantDebt) ? player.veiledMerchantDebt : 'purchased';
    const profiles = {
        owed: { hp: 390, damage: 27, phaseBonus: 4, openingBlock: 0 },
        settled: { hp: 330, damage: 22, phaseBonus: 2, openingBlock: 8 },
        defaulted: { hp: 430, damage: 30, phaseBonus: 5, openingBlock: 0 },
        declined: { hp: 360, damage: 25, phaseBonus: 3, openingBlock: 0 },
        purchased: { hp: 380, damage: 26, phaseBonus: 4, openingBlock: 0 }
    };
    const profile = profiles[consequence];
    return {
        id: 'veiledCollector',
        name: 'Сборщик Последнего Долга',
        emoji: '⚖️',
        maxHp: profile.hp,
        hp: profile.hp,
        damage: profile.damage,
        baseDamage: profile.damage,
        pattern: ['attack', 'defend', 'attack', 'attack'],
        patternIndex: 0,
        isBoss: true,
        isSecretBoss: true,
        specialAbility: 'debt_collector',
        phase: 1,
        phaseDamageBonus: profile.phaseBonus,
        openingBlock: profile.openingBlock,
        merchantConsequence: consequence,
        merchantDeals: Math.max(0, Number(player.veiledMerchantDeals) || 0)
    };
}

// Получить случайного врага
function getRandomEnemy() {
    const regularEnemies = Object.values(ENEMIES).filter(e => !e.isBoss);
    const randomEnemy = regularEnemies[Math.floor(Math.random() * regularEnemies.length)];
    return { ...randomEnemy };
}