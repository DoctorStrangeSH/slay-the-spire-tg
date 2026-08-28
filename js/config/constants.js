// Константы игры
const GAME_CONFIG = {
    maxActs: 3,
    floorsPerAct: 15,
    maxHandSize: 10,
    baseEnergy: 3,
    maxEnergy: 3
};

const CARD_TYPES = {
    ATTACK: 'attack',
    SKILL: 'skill',
    POWER: 'power'
};

const CARD_RARITY = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare'
};

const NODE_TYPES = {
    START: 'start',
    BATTLE: 'battle',
    ELITE: 'elite',
    REST: 'rest',
    EVENT: 'event',
    SHOP: 'shop',
    BOSS: 'boss'
};