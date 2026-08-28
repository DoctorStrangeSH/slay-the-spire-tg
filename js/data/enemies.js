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

// Получить случайного врага
function getRandomEnemy() {
    const regularEnemies = Object.values(ENEMIES).filter(e => !e.isBoss);
    const randomEnemy = regularEnemies[Math.floor(Math.random() * regularEnemies.length)];
    return { ...randomEnemy };
}