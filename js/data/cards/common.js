// Общие карты (доступны всем героям)
const COMMON_CARDS = {
    // ===== АТАКИ =====
    // Обычные
    strike: {
        id: 'strike',
        name: 'Удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 6,
        description: 'Наносит 6 урона',
        emoji: '⚔️'
    },
    heavyStrike: {
        id: 'heavyStrike',
        name: 'Тяжёлый удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        damage: 12,
        description: 'Наносит 12 урона',
        emoji: '💥'
    },
    powerfulStrike: {
        id: 'powerfulStrike',
        name: 'Мощный удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        damage: 14,
        exhaust: true,
        description: 'Наносит 14 урона. Убирается',
        emoji: '🔥'
    },
    strikeSeries: {
        id: 'strikeSeries',
        name: 'Серия ударов',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 3,
        hits: 2,
        description: 'Наносит 3 урона 2 раза',
        emoji: '👊'
    },
    preciseStrike: {
        id: 'preciseStrike',
        name: 'Точный удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 5,
        vulnerable: 1,
        description: 'Наносит 5 урона. Накладывает 1 Уязвимость',
        emoji: '🎯'
    },
    lunge: {
        id: 'lunge',
        name: 'Выпад',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 7,
        selfDamage: 1,
        description: 'Наносит 7 урона. Вы получаете 1 урона',
        emoji: '🤺'
    },
    blindStrike: {
        id: 'blindStrike',
        name: 'Удар вслепую',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 8,
        randomTarget: true,
        description: 'Наносит 8 урона случайному врагу',
        emoji: '🙈'
    },
    
    // Необычные
    doubleStrike: {
        id: 'doubleStrike',
        name: 'Двойной удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 6,
        hits: 2,
        description: 'Наносит 6 урона 2 раза. Если цель одна — 3 раза',
        emoji: '⚡'
    },
    circularStrike: {
        id: 'circularStrike',
        name: 'Круговой удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 6,
        aoe: true,
        description: 'Наносит 6 урона ВСЕМ врагам',
        emoji: '🔄'
    },
    crushingBlow: {
        id: 'crushingBlow',
        name: 'Сокрушительный удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 3,
        damage: 20,
        exhaust: true,
        description: 'Наносит 20 урона. Убирается',
        emoji: '💀'
    },
    quickStrike: {
        id: 'quickStrike',
        name: 'Быстрый удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 0,
        damage: 3,
        draw: 1,
        description: 'Наносит 3 урона. Возьмите 1 карту',
        emoji: '💨'
    },
    
    // Редкие
    piercingStrike: {
        id: 'piercingStrike',
        name: 'Пробивающий удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 10,
        ignoreBlock: true,
        description: 'Наносит 10 урона. Игнорирует Блок',
        emoji: '🗡️'
    },
    flurryOfBlows: {
        id: 'flurryOfBlows',
        name: 'Шквал ударов',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        damage: 4,
        hits: 5,
        description: 'Наносит 4 урона 5 раз',
        emoji: '🌪️'
    },
    criticalStrike: {
        id: 'criticalStrike',
        name: 'Критический удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 8,
        description: 'Наносит 8 урона. Если разыграли 3 карты — 20 урона',
        emoji: '💢'
    },
    finishingBlow: {
        id: 'finishingBlow',
        name: 'Добивание',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 9,
        description: 'Наносит 9 урона. Если у врага <25% HP — 27 урона',
        emoji: '🔪'
    },
    
    // ===== НАВЫКИ =====
    // Обычные
    defend: {
        id: 'defend',
        name: 'Защита',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 5,
        description: 'Даёт 5 Блока',
        emoji: '🛡️'
    },
    deepDefense: {
        id: 'deepDefense',
        name: 'Глухая защита',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        block: 10,
        description: 'Даёт 10 Блока',
        emoji: '🧱'
    },
    roll: {
        id: 'roll',
        name: 'Перекат',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 4,
        draw: 1,
        description: 'Даёт 4 Блока. Возьмите 1 карту',
        emoji: '🤸'
    },
    stance: {
        id: 'stance',
        name: 'Стойка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        block: 12,
        exhaust: true,
        description: 'Даёт 12 Блока. Убирается',
        emoji: '🧘'
    },
    dash: {
        id: 'dash',
        name: 'Рывок',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 3,
        draw: 1,
        exhaust: true,
        description: 'Даёт 3 Блока. Возьмите 1 карту. Убирается',
        emoji: '💨'
    },
    dodge: {
        id: 'dodge',
        name: 'Уклонение',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 0,
        block: 3,
        exhaust: true,
        description: 'Даёт 3 Блока. Убирается',
        emoji: '🏃'
    },
    firstAid: {
        id: 'firstAid',
        name: 'Аптечка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        heal: 3,
        description: 'Лечит 3 HP',
        emoji: '💊'
    },
    bandage: {
        id: 'bandage',
        name: 'Перевязка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 3,
        heal: 2,
        description: 'Даёт 3 Блока. Лечит 2 HP',
        emoji: '🩹'
    },
    meditation: {
        id: 'meditation',
        name: 'Медитация',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        draw: 2,
        selfDamage: 1,
        description: 'Возьмите 2 карты. Вы получаете 1 урона',
        emoji: '🧘'
    },
    concentration: {
        id: 'concentration',
        name: 'Концентрация',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 0,
        draw: 1,
        exhaust: true,
        description: 'Возьмите 1 карту. Убирается',
        emoji: '🎯'
    },
    
    // Необычные навыки
    deceptiveManeuver: {
        id: 'deceptiveManeuver',
        name: 'Обманный манёвр',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        block: 6,
        weak: 1,
        description: 'Даёт 6 Блока. Накладывает 1 Слабость',
        emoji: '🎭'
    },
    tactics: {
        id: 'tactics',
        name: 'Тактика',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        draw: 3,
        selfDamage: 2,
        description: 'Возьмите 3 карты. Вы получаете 2 урона',
        emoji: '📋'
    },
    fortification: {
        id: 'fortification',
        name: 'Укрепление',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        block: 15,
        exhaust: true,
        description: 'Даёт 15 Блока. Убирается',
        emoji: '🏰'
    },
    repair: {
        id: 'repair',
        name: 'Ремонт',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        heal: 5,
        exhaust: true,
        description: 'Лечит 5 HP. Убирается',
        emoji: '🔧'
    },
    forwardDash: {
        id: 'forwardDash',
        name: 'Рывок вперёд',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        block: 8,
        draw: 2,
        description: 'Даёт 8 Блока. Возьмите 2 карты',
        emoji: '🏃'
    },
    balance: {
        id: 'balance',
        name: 'Баланс',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        block: 5,
        vulnerable: 1,
        description: 'Даёт 5 Блока. Накладывает 1 Уязвимость',
        emoji: '⚖️'
    },
    
    // Редкие навыки
    universalTechnique: {
        id: 'universalTechnique',
        name: 'Универсальный приём',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        block: 10,
        draw: 2,
        vulnerable: 1,
        weak: 1,
        description: 'Даёт 10 Блока. Возьмите 2 карты. Накладывает 1 Уязвимость и 1 Слабость',
        emoji: '🎯'
    },
    fullRecharge: {
        id: 'fullRecharge',
        name: 'Полная перезарядка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        block: 20,
        heal: 5,
        exhaust: true,
        description: 'Даёт 20 Блока. Лечит 5 HP. Убирается',
        emoji: '🔋'
    },
    salvation: {
        id: 'salvation',
        name: 'Спасение',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        heal: 8,
        exhaust: true,
        description: 'Лечит 8 HP. Убирается',
        emoji: '🙏'
    },
    mastery: {
        id: 'mastery',
        name: 'Мастерство',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        block: 12,
        draw: 1,
        exhaust: true,
        description: 'Даёт 12 Блока. Возьмите 1 карту. Убирается',
        emoji: '🎓'
    },
    
    // ===== СИЛЫ =====
    // Обычные
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
    battleStance: {
        id: 'battleStance',
        name: 'Боевая стойка',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        dexterity: 1,
        description: 'Получите 1 Ловкость',
        emoji: '⚔️'
    },
    focus: {
        id: 'focus',
        name: 'Фокус',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале вашего хода возьмите 1 карту',
        emoji: '🎯'
    },
    regeneration: {
        id: 'regeneration',
        name: 'Регенерация',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        description: 'В начале вашего хода лечите 1 HP',
        emoji: '💚'
    },
    confidence: {
        id: 'confidence',
        name: 'Уверенность',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале вашего хода получите 1 Блок',
        emoji: '😤'
    },
    
    // Необычные силы
    adaptation: {
        id: 'adaptation',
        name: 'Адаптация',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Когда разыгрываете Навык — получите 1 Блок',
        emoji: '🔄'
    },
    onslaught: {
        id: 'onslaught',
        name: 'Натиск',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Когда разыгрываете Атаку — получите 1 Силу (1 раз за ход)',
        emoji: '⚡'
    },
    economy: {
        id: 'economy',
        name: 'Экономия',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Каждая 3-я разыгранная карта стоит 0',
        emoji: '💰'
    },
    secondWind: {
        id: 'secondWind',
        name: 'Второе дыхание',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'В начале хода, если нет Блока — получите 3 Блока',
        emoji: '🌬️'
    },
    versatility: {
        id: 'versatility',
        name: 'Универсальность',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Разыграли Атаку, Навык и Силу в один ход — возьмите 1 карту',
        emoji: '🎨'
    },
    
    // Редкие силы
    ironWill: {
        id: 'ironWill',
        name: 'Железная воля',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        strength: 2,
        dexterity: 2,
        description: 'Получите 2 Силы и 2 Ловкости',
        emoji: '🛡️'
    },
    protectionAura: {
        id: 'protectionAura',
        name: 'Аура защиты',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'В начале вашего хода даёт 5 Блока',
        emoji: '✨'
    },
    vampirism: {
        id: 'vampirism',
        name: 'Вампиризм',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Когда наносите урон — лечите 1 HP (максимум 3 раза за ход)',
        emoji: '🧛'
    },
    preparation: {
        id: 'preparation',
        name: 'Подготовка',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'В начале боя возьмите 2 карты',
        emoji: '📦'
    },
    jackOfAllTrades: {
        id: 'jackOfAllTrades',
        name: 'Мастер на все руки',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'Разыграли Атаку/Навык/Силу — получите 1 Блок и +1 к след. атаке',
        emoji: '🎭'
    }
};