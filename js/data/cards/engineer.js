// Уникальные карты Инженера (50 карт)
const ENGINEER_CARDS = {
    // ===== АТАКИ (10 карт) =====
    // Обычные (5)
    wrench: {
        id: 'wrench',
        name: 'Гаечный ключ',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 6,
        description: 'Наносит 6 урона. Если есть Конструкция — 9 урона',
        emoji: '🔧'
    },
    overload: {
        id: 'overload',
        name: 'Перегрузка',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 4,
        description: 'Наносит 4 урона. +2 урона за каждую Конструкцию',
        emoji: '⚡'
    },
    discharge: {
        id: 'discharge',
        name: 'Разряд',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 5,
        vulnerable: 1,
        description: 'Наносит 5 урона. Накладывает 1 Уязвимость',
        emoji: '🔌'
    },
    spark: {
        id: 'spark',
        name: 'Искра',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 0,
        damage: 3,
        exhaust: true,
        description: 'Наносит 3 урона. Убирается',
        emoji: '✨'
    },
    bolt: {
        id: 'bolt',
        name: 'Болт',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        damage: 10,
        description: 'Наносит 10 урона. Если есть Конструкция — 13',
        emoji: '🔩'
    },
    
    // Необычные (3)
    rocket: {
        id: 'rocket',
        name: 'Ракета',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 12,
        exhaust: true,
        description: 'Наносит 12 урона. Убирается',
        emoji: '🚀'
    },
    flamethrower: {
        id: 'flamethrower',
        name: 'Огнемёт',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 5,
        aoe: true,
        fire: 2,
        description: 'Наносит 5 урона ВСЕМ. Накладывает 2 Огня',
        emoji: '🔥'
    },
    kamikazeDrone: {
        id: 'kamikazeDrone',
        name: 'Дрон-камикадзе',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'Уничтожьте Конструкцию. Нанесите урон = её HP (макс 15)',
        emoji: '💥'
    },
    
    // Редкие (2)
    destroyer: {
        id: 'destroyer',
        name: 'Разрушитель',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        damage: 15,
        removeBlock: true,
        description: 'Наносит 15 урона. Уничтожает Броню врага',
        emoji: '💣'
    },
    massOverload: {
        id: 'massOverload',
        name: 'Массовая перегрузка',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Уничтожьте все Конструкции. По 6 урона за каждую',
        emoji: '🌩️'
    },
    
    // ===== НАВЫКИ (12 карт) =====
    // Обычные (5)
    repair: {
        id: 'repair',
        name: 'Починка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 5,
        description: 'Даёт 5 Блока. Восстанавливает 3 HP Конструкции',
        emoji: '🔧'
    },
    reinforcement: {
        id: 'reinforcement',
        name: 'Укрепление',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 4,
        description: 'Даёт 4 Блока. Даёт 4 Блока Конструкции',
        emoji: '🛡️'
    },
    blueprints: {
        id: 'blueprints',
        name: 'Чертежи',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        draw: 2,
        description: 'Возьмите 2 карты. Конструкции стоят на 1 меньше',
        emoji: '📋'
    },
    lubricant: {
        id: 'lubricant',
        name: 'Смазка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 3,
        description: 'Даёт 3 Блока. В след. ходу Конструкции срабатывают дважды',
        emoji: '🛢️'
    },
    quickAssembly: {
        id: 'quickAssembly',
        name: 'Быстрая сборка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        draw: 1,
        description: 'Возьмите 1 карту. Если Конструкция — бесплатно',
        emoji: '🏗️'
    },
    
    // Необычные (4)
    energyShield: {
        id: 'energyShield',
        name: 'Энергетический щит',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        block: 6,
        description: 'Даёт 6 Блока. С Конструкцией — 10 Блока',
        emoji: '🔰'
    },
    repairDrone: {
        id: 'repairDrone',
        name: 'Ремонтный дрон',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        block: 3,
        description: 'Восстанавливает 5 HP ВСЕМ Конструкциям. Даёт 3 Блока',
        emoji: '🤖'
    },
    evacuation: {
        id: 'evacuation',
        name: 'Эвакуация',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'Верните Конструкцию в руку. Получите Энергию = её стоимости',
        emoji: '🚁'
    },
    modernization: {
        id: 'modernization',
        name: 'Модернизация',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        exhaust: true,
        description: 'Улучшите все Конструкции (+2 урона или +3 Блока)',
        emoji: '⬆️'
    },
    
    // Редкие (3)
    factoryReset: {
        id: 'factoryReset',
        name: 'Заводской сброс',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Уничтожьте все Конструкции. За каждую: +1 Энергия и 1 карта',
        emoji: '🔄'
    },
    nanobots: {
        id: 'nanobots',
        name: 'Нанороботы',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        block: 8,
        heal: 2,
        description: 'Даёт 8 Блока. Лечит 2 HP. Восстанавливает 2 HP Конструкциям',
        emoji: '🦠'
    },
    engineeringGenius: {
        id: 'engineeringGenius',
        name: 'Инженерный гений',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        draw: 3,
        exhaust: true,
        description: 'Возьмите 3 карты. Конструкции в руке стоят 0',
        emoji: '🧠'
    },
    
    // ===== СИЛЫ (13 карт) =====
    // Обычные (3)
    automation: {
        id: 'automation',
        name: 'Автоматизация',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале хода случайная Конструкция срабатывает дважды',
        emoji: '⚙️'
    },
    calibration: {
        id: 'calibration',
        name: 'Калибровка',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'Конструкции получают +1 урона или +1 Блока',
        emoji: '📐'
    },
    reserve: {
        id: 'reserve',
        name: 'Резерв',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале боя положите "Малую турель" в руку',
        emoji: '📦'
    },
    
    // Необычные (5)
    overproduction: {
        id: 'overproduction',
        name: 'Перепроизводство',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Когда выкладываете Конструкцию — берите 1 карту',
        emoji: '🏭'
    },
    livingSteel: {
        id: 'livingSteel',
        name: 'Живая сталь',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Конструкции получают +5 HP',
        emoji: '🔩'
    },
    weaponsFactory: {
        id: 'weaponsFactory',
        name: 'Оружейный завод',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'В начале хода добавьте "Малую турель" в руку',
        emoji: '🏗️'
    },
    systemOverload: {
        id: 'systemOverload',
        name: 'Перегрузка систем',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'Когда Конструкция уничтожена — 3 урона врагу',
        emoji: '⚡'
    },
    jetpack: {
        id: 'jetpack',
        name: 'Реактивный ранец',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'В начале боя получите 1 Энергию',
        emoji: '🎒'
    },
    
    // Редкие (5)
    engineeringNetwork: {
        id: 'engineeringNetwork',
        name: 'Инженерная сеть',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Конструкции срабатывают на 1 раз больше',
        emoji: '🌐'
    },
    modularConstruction: {
        id: 'modularConstruction',
        name: 'Модульная конструкция',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Выложили Конструкцию — +2 Блока ВСЕМ Конструкциям',
        emoji: '🧩'
    },
    totalAutomation: {
        id: 'totalAutomation',
        name: 'Тотальная автоматизация',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'В начале хода все Конструкции срабатывают дважды',
        emoji: '🤖'
    },
    arsenal: {
        id: 'arsenal',
        name: 'Арсенал',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'Разыграли Атаку — добавьте "Искру" в руку',
        emoji: '🔫'
    },
    indestructibleFortress: {
        id: 'indestructibleFortress',
        name: 'Несокрушимая крепость',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'В начале хода 3 Блока себе и ВСЕМ Конструкциям',
        emoji: '🏰'
    },
    
    // ===== КОНСТРУКЦИИ (15 карт) =====
    // Обычные (5)
    smallTurret: {
        id: 'smallTurret',
        name: 'Малая турель',
        type: 'building',
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        hp: 6,
        damage: 3,
        description: 'HP: 6. В конце хода наносит 3 урона',
        emoji: '🔫'
    },
    barrier: {
        id: 'barrier',
        name: 'Барьер',
        type: 'building',
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        hp: 8,
        block: 3,
        description: 'HP: 8. В начале хода врага даёт 3 Блока',
        emoji: '🚧'
    },
    scoutDrone: {
        id: 'scoutDrone',
        name: 'Дрон-разведчик',
        type: 'building',
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        hp: 4,
        draw: 1,
        description: 'HP: 4. В начале хода берите 1 карту',
        emoji: '🛸'
    },
    firePoint: {
        id: 'firePoint',
        name: 'Огневая точка',
        type: 'building',
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        hp: 10,
        damage: 5,
        description: 'HP: 10. В конце хода наносит 5 урона',
        emoji: '🎯'
    },
    generator: {
        id: 'generator',
        name: 'Генератор',
        type: 'building',
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        hp: 6,
        energy: 1,
        description: 'HP: 6. В начале хода даёт 1 Энергию',
        emoji: '⚡'
    },
    
    // Необычные (5)
    acidSprayer: {
        id: 'acidSprayer',
        name: 'Кислотный распылитель',
        type: 'building',
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        hp: 8,
        poison: 2,
        description: 'HP: 8. В конце хода накладывает 2 Яда',
        emoji: '🧪'
    },
    frostCannon: {
        id: 'frostCannon',
        name: 'Морозная пушка',
        type: 'building',
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        hp: 7,
        weak: 1,
        description: 'HP: 7. В конце хода накладывает 1 Слабость',
        emoji: '❄️'
    },
    powerShield: {
        id: 'powerShield',
        name: 'Силовой щит',
        type: 'building',
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        hp: 12,
        block: 5,
        description: 'HP: 12. В начале хода врага даёт 5 Блока',
        emoji: '🛡️'
    },
    teslaTower: {
        id: 'teslaTower',
        name: 'Тесла-башня',
        type: 'building',
        rarity: CARD_RARITY.UNCOMMON,
        cost: 3,
        hp: 10,
        damage: 4,
        aoe: true,
        description: 'HP: 10. В конце хода наносит 4 урона ВСЕМ',
        emoji: '🗼'
    },
    rocketLauncher: {
        id: 'rocketLauncher',
        name: 'Ракетная установка',
        type: 'building',
        rarity: CARD_RARITY.UNCOMMON,
        cost: 3,
        hp: 8,
        damage: 8,
        description: 'HP: 8. В конце хода наносит 8 урона сильнейшему',
        emoji: '🚀'
    },
    
    // Редкие (5)
    workshop: {
        id: 'workshop',
        name: 'Мастерская',
        type: 'building',
        rarity: CARD_RARITY.RARE,
        cost: 3,
        hp: 10,
        description: 'HP: 10. В начале хода добавьте случайную Конструкцию в руку',
        emoji: '🏭'
    },
    targetDesignator: {
        id: 'targetDesignator',
        name: 'Целеуказатель',
        type: 'building',
        rarity: CARD_RARITY.RARE,
        cost: 2,
        hp: 6,
        vulnerable: 1,
        description: 'HP: 6. В начале хода Уязвимость на всех врагов',
        emoji: '🎯'
    },
    energyCore: {
        id: 'energyCore',
        name: 'Энергетическое ядро',
        type: 'building',
        rarity: CARD_RARITY.RARE,
        cost: 3,
        hp: 15,
        description: 'HP: 15. В начале хода +1 Энергия за каждую Конструкцию',
        emoji: '☢️'
    },
    droneFactory: {
        id: 'droneFactory',
        name: 'Фабрика дронов',
        type: 'building',
        rarity: CARD_RARITY.RARE,
        cost: 3,
        hp: 8,
        description: 'HP: 8. В конце хода призывает Дрона (3 HP, 2 урона)',
        emoji: '🏭'
    },
    nexus: {
        id: 'nexus',
        name: 'Нексус',
        type: 'building',
        rarity: CARD_RARITY.RARE,
        cost: 4,
        hp: 20,
        description: 'HP: 20. В начале хода другие Конструкции срабатывают дважды',
        emoji: '🔮'
    }
};

// Стартовая колода Инженера
const ENGINEER_STARTER_DECK = [
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.defend },
    { ...COMMON_CARDS.defend },
    { ...ENGINEER_CARDS.smallTurret },
    { ...ENGINEER_CARDS.smallTurret },
    { ...ENGINEER_CARDS.repair },
    { ...ENGINEER_CARDS.wrench }
];