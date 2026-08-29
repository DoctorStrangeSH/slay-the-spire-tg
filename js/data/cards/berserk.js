// Уникальные карты Берсерка (60 карт)
const BERSERK_CARDS = {
    // ===== АТАКИ (20 карт) =====
    // Обычные (8)
    bloodCut: {
        id: 'bloodCut',
        name: 'Кровавый порез',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 4,
        bleed: 2,
        description: 'Наносит 4 урона. Накладывает 2 Кровотечения',
        emoji: '🔪'
    },
    retaliationStrike: {
        id: 'retaliationStrike',
        name: 'Удар возмездия',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 6,
        description: 'Наносит 6 урона. Если HP < 50% — 12 урона',
        emoji: '⚡'
    },
    cutWound: {
        id: 'cutWound',
        name: 'Резаная рана',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 3,
        description: 'Наносит 3 урона. Если у врага Кровотечение — 8 урона',
        emoji: '🗡️'
    },
    boneBreaker: {
        id: 'boneBreaker',
        name: 'Костолом',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 7,
        weak: 1,
        description: 'Наносит 7 урона. Накладывает 1 Слабость',
        emoji: '💢'
    },
    deepWound: {
        id: 'deepWound',
        name: 'Глубокая рана',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 5,
        bleed: 3,
        exhaust: true,
        description: 'Наносит 5 урона. Накладывает 3 Кровотечения. Убирается',
        emoji: '🩸'
    },
    bloodFlurry: {
        id: 'bloodFlurry',
        name: 'Кровавый шквал',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        damage: 3,
        hits: 4,
        description: 'Наносит 3 урона 4 раза',
        emoji: '🌊'
    },
    wideStrike: {
        id: 'wideStrike',
        name: 'Размашистый удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        damage: 10,
        description: 'Наносит 10 урона',
        emoji: '⚔️'
    },
    vulnerableStrike: {
        id: 'vulnerableStrike',
        name: 'Удар в уязвимое место',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 5,
        vulnerable: 1,
        description: 'Наносит 5 урона. Накладывает 1 Уязвимость',
        emoji: '🎯'
    },
    
    // Необычные (7)
    wildLunge: {
        id: 'wildLunge',
        name: 'Дикий выпад',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        damage: 7,
        selfDamage: 1,
        description: 'Наносит 7 урона. Вы получаете 1 урона',
        emoji: '🐺'
    },
    sacrificialStrike: {
        id: 'sacrificialStrike',
        name: 'Жертвенный удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 15,
        selfDamage: 3,
        description: 'Вы теряете 3 HP. Наносит 15 урона',
        emoji: '💉'
    },
    chainStrike: {
        id: 'chainStrike',
        name: 'Цепной удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 6,
        hits: 2,
        description: 'Наносит 6 урона 2 раза',
        emoji: '⛓️'
    },
    cleave: {
        id: 'cleave',
        name: 'Рассечение',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 8,
        aoe: true,
        description: 'Наносит 8 урона ВСЕМ',
        emoji: '🌪️'
    },
    mercyStrike: {
        id: 'mercyStrike',
        name: 'Удар милосердия',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        damage: 4,
        description: 'Наносит 4 урона. Если 10+ Кровотечения — 14 урона',
        emoji: '🙏'
    },
    bloodWave: {
        id: 'bloodWave',
        name: 'Кровавая волна',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 3,
        damage: 6,
        bleed: 5,
        description: 'Наносит 6 урона. Накладывает 5 Кровотечения',
        emoji: '🌊'
    },
    execution: {
        id: 'execution',
        name: 'Добивание',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 10,
        description: 'Наносит 10 урона. Если враг < 30% HP — 30 урона',
        emoji: '💀'
    },
    
    // Редкие (5)
    bloodbath: {
        id: 'bloodbath',
        name: 'Кровавая бойня',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        damage: 8,
        bleed: 3,
        aoe: true,
        description: 'Наносит 8 урона ВСЕМ. Накладывает 3 Кровотечения ВСЕМ',
        emoji: '🩸'
    },
    beheading: {
        id: 'beheading',
        name: 'Обезглавливание',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        damage: 18,
        description: 'Наносит 18 урона. Если убивает — лечит 8 HP',
        emoji: '🪓'
    },
    bloodVortex: {
        id: 'bloodVortex',
        name: 'Кровавый вихрь',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 5,
        bleed: 2,
        aoe: true,
        selfDamage: 2,
        description: 'Наносит 5 урона ВСЕМ. Накладывает 2 Кровотечения',
        emoji: '🌀'
    },
    bloodTide: {
        id: 'bloodTide',
        name: 'Кровавый прилив',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 12,
        bleed: 4,
        description: 'Наносит 12 урона. Накладывает 4 Кровотечения',
        emoji: '🌊'
    },
    sacrificialBlade: {
        id: 'sacrificialBlade',
        name: 'Жертвенный клинок',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 10,
        selfDamage: 5,
        description: 'Теряете 5 HP. Наносит 10 урона',
        emoji: '🗡️'
    },
    
    // ===== НАВЫКИ (20 карт) =====
    // Обычные (8)
    berserkStance: {
        id: 'berserkStance',
        name: 'Стойка берсерка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        block: 12,
        description: 'Даёт 12 Блока. Если HP < 50% — 20 Блока',
        emoji: '🛡️'
    },
    bloodRitual: {
        id: 'bloodRitual',
        name: 'Кровавый ритуал',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 0,
        selfDamage: 3,
        energy: 1,
        exhaust: true,
        description: 'Теряете 3 HP. Получите 1 Энергию. Убирается',
        emoji: '🩸'
    },
    lickWounds: {
        id: 'lickWounds',
        name: 'Облизывание ран',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        heal: 3,
        block: 3,
        description: 'Лечит 3 HP. Даёт 3 Блока',
        emoji: '👅'
    },
    bloodVeil: {
        id: 'bloodVeil',
        name: 'Кровавая пелена',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 6,
        bleed: 2,
        description: 'Даёт 6 Блока. Накладывает 2 Кровотечения',
        emoji: '🩸'
    },
    bestialInstinct: {
        id: 'bestialInstinct',
        name: 'Звериный инстинкт',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        draw: 2,
        selfDamage: 1,
        description: 'Возьмите 2 карты. Получаете 1 урона',
        emoji: '👁️'
    },
    beastRoar: {
        id: 'beastRoar',
        name: 'Звериный рёв',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 0,
        selfDamage: 1,
        vulnerable: 1,
        exhaust: true,
        description: 'Получаете 1 урона. Накладывает 1 Уязвимость. Убирается',
        emoji: '🦁'
    },
    madDash: {
        id: 'madDash',
        name: 'Бешеный рывок',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 5,
        description: 'Даёт 5 Блока. В след. ходу Атаки стоят на 1 меньше',
        emoji: '🏃'
    },
    dash: {
        id: 'dash',
        name: 'Рывок',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 4,
        draw: 1,
        description: 'Даёт 4 Блока. Возьмите 1 карту',
        emoji: '💨'
    },
    
    // Необычные (7)
    freshWound: {
        id: 'freshWound',
        name: 'Свежая рана',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        bleed: 4,
        description: 'Накладывает 4 Кровотечения. Если HP < 50% — 8',
        emoji: '🩸'
    },
    vampirism: {
        id: 'vampirism',
        name: 'Вампиризм',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 6,
        heal: 6,
        exhaust: true,
        description: 'Наносит 6 урона. Лечит 6 HP. Убирается',
        emoji: '🧛'
    },
    skinning: {
        id: 'skinning',
        name: 'Свежевание',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        bleed: 3,
        draw: 1,
        description: 'Накладывает 3 Кровотечения. Возьмите 1 карту',
        emoji: '🔪'
    },
    scarletVeil: {
        id: 'scarletVeil',
        name: 'Алая пелена',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        weak: 1,
        vulnerable: 1,
        selfDamage: 2,
        description: 'Накладывает 1 Слабость и 1 Уязвимость',
        emoji: '🌫️'
    },
    bloodSmell: {
        id: 'bloodSmell',
        name: 'Запах крови',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        draw: 2,
        description: 'Возьмите 2 карты. Если есть Атака — стоит на 1 меньше',
        emoji: '👃'
    },
    spiritFortification: {
        id: 'spiritFortification',
        name: 'Укрепление духа',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        block: 7,
        description: 'Даёт 7 Блока. Если HP < 50% — 14 Блока',
        emoji: '💪'
    },
    bandage: {
        id: 'bandage',
        name: 'Перевязка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        block: 5,
        heal: 1,
        description: 'Даёт 5 Блока. Лечит 1 HP',
        emoji: '🩹'
    },
    
    // Редкие (5)
    lastStand: {
        id: 'lastStand',
        name: 'Последний рубеж',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        block: 15,
        selfDamage: 5,
        description: 'Даёт 15 Блока. Если HP < 25% — 30 Блока',
        emoji: '🛡️'
    },
    bloodSacrifice: {
        id: 'bloodSacrifice',
        name: 'Кровавая жертва',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 1,
        selfDamage: 5,
        exhaust: true,
        description: 'Теряете 5 HP. Удваивает Силу. Убирается',
        emoji: '💉'
    },
    bloodRecovery: {
        id: 'bloodRecovery',
        name: 'Кровавое восстановление',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        heal: 5,
        description: 'Лечит 5 HP. Снимает Кровотечение',
        emoji: '💚'
    },
    scarletFog: {
        id: 'scarletFog',
        name: 'Алый туман',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        weak: 2,
        vulnerable: 2,
        selfDamage: 4,
        description: 'Накладывает 2 Слабости и 2 Уязвимости',
        emoji: '🌫️'
    },
    finalBattle: {
        id: 'finalBattle',
        name: 'Последний бой',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        block: 20,
        selfDamage: 3,
        exhaust: true,
        description: 'Даёт 20 Блока. Если HP < 20% — 35 Блока',
        emoji: '⚔️'
    },
    
    // ===== СИЛЫ (20 карт) =====
    // Обычные (8)
    killThirst: {
        id: 'killThirst',
        name: 'Жажда убийства',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале хода, если HP < 50% — 1 Сила',
        emoji: '🔥'
    },
    bloodletting: {
        id: 'bloodletting',
        name: 'Кровопускание',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'Когда получаете урон — 1 Кровотечение врагу',
        emoji: '🩸'
    },
    adrenalineRush: {
        id: 'adrenalineRush',
        name: 'Адреналиновый всплеск',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'При убийстве — лечите 2 HP и берёте 1 карту',
        emoji: '⚡'
    },
    battlePulse: {
        id: 'battlePulse',
        name: 'Пульс битвы',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        description: 'В начале хода, если HP < 25% — лечите 3 HP',
        emoji: '💓'
    },
    warmup: {
        id: 'warmup',
        name: 'Разминка',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        strength: 1,
        description: 'Получите 1 Силу',
        emoji: '💪'
    },
    confidence: {
        id: 'confidence',
        name: 'Уверенность',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале хода — 1 Блок',
        emoji: '😤'
    },
    focus: {
        id: 'focus',
        name: 'Фокус',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале хода — берите 1 карту',
        emoji: '🎯'
    },
    regeneration: {
        id: 'regeneration',
        name: 'Регенерация',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        description: 'В начале хода — лечите 1 HP',
        emoji: '💚'
    },
    
    // Необычные (7)
    painPath: {
        id: 'painPath',
        name: 'Путь боли',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'В начале хода: -1 HP, +1 Сила',
        emoji: '😈'
    },
    bloodthirst: {
        id: 'bloodthirst',
        name: 'Кровожадность',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'Урон от Кровотечения лечит 1 HP',
        emoji: '🧛'
    },
    bloodAura: {
        id: 'bloodAura',
        name: 'Кровавая аура',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Начало хода при HP<50%: 2 Кровотечения врагу',
        emoji: '🩸'
    },
    battleMadness: {
        id: 'battleMadness',
        name: 'Безумие боя',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'При потере HP — берите 1 карту (2 раза/ход)',
        emoji: '🤪'
    },
    beastSkin: {
        id: 'beastSkin',
        name: 'Звериная шкура',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'При получении урона — 1 Блок в след. ходу',
        emoji: '🐻'
    },
    adaptation: {
        id: 'adaptation',
        name: 'Адаптация',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Навык даёт 1 Блок',
        emoji: '🔄'
    },
    secondWind: {
        id: 'secondWind',
        name: 'Второе дыхание',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Нет Блока в начале хода — получите 3 Блока',
        emoji: '🌬️'
    },
    
    // Редкие (5)
    berserkMode: {
        id: 'berserkMode',
        name: 'Берсерк-режим',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: '+2 Силы. В конце хода -1 HP за карту в руке',
        emoji: '🔴'
    },
    bloodSeal: {
        id: 'bloodSeal',
        name: 'Кровавая печать',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'Урон от Кровотечения лечит 2 HP',
        emoji: '🔯'
    },
    titanRage: {
        id: 'titanRage',
        name: 'Ярость титана',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Атаки стоят на 1 меньше. В начале хода -2 HP',
        emoji: '💢'
    },
    painIsPower: {
        id: 'painIsPower',
        name: 'Боль — это сила',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 1,
        description: 'При потере HP — +1 Сила (1 раз/ход)',
        emoji: '💪'
    },
    secondLife: {
        id: 'secondLife',
        name: 'Вторая жизнь',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'При смерти выживаете с 10 HP (один раз)',
        emoji: '💖'
    }
};

// Стартовая колода Берсерка
const BERSERK_STARTER_DECK = [
    // Общие карты
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.defend },
    { ...COMMON_CARDS.defend },
    { ...COMMON_CARDS.defend },
    // Уникальные карты Берсерка
    { ...BERSERK_CARDS.bloodCut },
    { ...BERSERK_CARDS.bloodCut },
    { ...BERSERK_CARDS.retaliationStrike },
    { ...BERSERK_CARDS.berserkStance }
];