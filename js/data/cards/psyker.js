// Уникальные карты Псайкера (50 карт)
const PSYKER_CARDS = {
    // ===== АТАКИ (15 карт) =====
    // Обычные (5)
    psyStrike: {
        id: 'psyStrike',
        name: 'Пси-удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 4,
        paralysis: 1,
        description: 'Наносит 4 урона. Накладывает 1 Паралич',
        emoji: '🔮'
    },
    mentalStrike: {
        id: 'mentalStrike',
        name: 'Ментальный удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 5,
        ignoreBlock: true,
        description: 'Наносит 5 урона. Игнорирует Блок',
        emoji: '🧠'
    },
    telekinesis: {
        id: 'telekinesis',
        name: 'Телекинез',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        damage: 8,
        description: 'Наносит 8 урона. Если враг парализован — 12 урона',
        emoji: '🖐️'
    },
    psyWave: {
        id: 'psyWave',
        name: 'Пси-волна',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 3,
        aoe: true,
        description: 'Наносит 3 урона ВСЕМ врагам',
        emoji: '🌊'
    },
    mindStrike: {
        id: 'mindStrike',
        name: 'Удар разума',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 6,
        description: 'Наносит 6 урона. Если смотрели колоду — 9 урона',
        emoji: '👁️'
    },
    
    // Необычные (5)
    psychoShock: {
        id: 'psychoShock',
        name: 'Психошок',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 10,
        ignoreBlock: true,
        description: 'Наносит 10 урона. Игнорирует Блок',
        emoji: '⚡'
    },
    mentalRift: {
        id: 'mentalRift',
        name: 'Ментальный разлом',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 7,
        paralysis: 2,
        description: 'Наносит 7 урона. Накладывает 2 Паралича',
        emoji: '💥'
    },
    telekineticThrow: {
        id: 'telekineticThrow',
        name: 'Телекинетический бросок',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        damage: 5,
        draw: 1,
        description: 'Наносит 5 урона. Возьмите 1 карту',
        emoji: '🪨'
    },
    terrorWave: {
        id: 'terrorWave',
        name: 'Волна ужаса',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        damage: 4,
        aoe: true,
        paralysis: 1,
        description: 'Наносит 4 урона ВСЕМ. Накладывает 1 Паралич ВСЕМ',
        emoji: '😱'
    },
    mentalAssault: {
        id: 'mentalAssault',
        name: 'Ментальный штурм',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 3,
        damage: 6,
        hits: 3,
        ignoreBlock: true,
        description: 'Наносит 6 урона 3 раза. Игнорирует Блок',
        emoji: '🌪️'
    },
    
    // Редкие (5)
    mindDestruction: {
        id: 'mindDestruction',
        name: 'Разрушение разума',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        damage: 15,
        ignoreBlock: true,
        paralysis: 2,
        description: 'Наносит 15 урона. Игнорирует Блок. 2 Паралича',
        emoji: '💀'
    },
    psyExplosion: {
        id: 'psyExplosion',
        name: 'Пси-взрыв',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        damage: 8,
        aoe: true,
        ignoreBlock: true,
        description: 'Наносит 8 урона ВСЕМ. Игнорирует Блок',
        emoji: '💥'
    },
    telepathicStrike: {
        id: 'telepathicStrike',
        name: 'Телепатический удар',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 9,
        description: 'Наносит 9 урона. Если враг парализован — 18 урона',
        emoji: '📡'
    },
    mentalBomb: {
        id: 'mentalBomb',
        name: 'Ментальная бомба',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 5,
        description: 'Наносит 5 урона. Удваивается за каждый Паралич',
        emoji: '💣'
    },
    astralBlade: {
        id: 'astralBlade',
        name: 'Астральный клинок',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 11,
        echo: 1,
        description: 'Наносит 11 урона. Следующая карта срабатывает дважды',
        emoji: '🗡️'
    },
    
    // ===== НАВЫКИ (20 карт) =====
    // Обычные (10)
    mentalShield: {
        id: 'mentalShield',
        name: 'Ментальный щит',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 5,
        description: 'Даёт 5 Блока',
        emoji: '🛡️'
    },
    concentration: {
        id: 'concentration',
        name: 'Концентрация',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        draw: 2,
        description: 'Возьмите 2 карты',
        emoji: '🧘'
    },
    foresight: {
        id: 'foresight',
        name: 'Предвидение',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 0,
        scry: 3,
        exhaust: true,
        description: 'Посмотрите верхние 3 карты. Убирается',
        emoji: '🔮'
    },
    psyBarrier: {
        id: 'psyBarrier',
        name: 'Пси-барьер',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 4,
        paralysis: 1,
        description: 'Даёт 4 Блока. Накладывает 1 Паралич',
        emoji: '🛡️'
    },
    teleportation: {
        id: 'teleportation',
        name: 'Телепортация',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 3,
        draw: 1,
        description: 'Даёт 3 Блока. Возьмите 1 карту',
        emoji: '🌀'
    },
    mentalDefense: {
        id: 'mentalDefense',
        name: 'Ментальная защита',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        block: 10,
        description: 'Даёт 10 Блока',
        emoji: '🧠'
    },
    mindsEye: {
        id: 'mindsEye',
        name: 'Око разума',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        scry: 5,
        description: 'Посмотрите верхние 5 карт. Верните в любом порядке',
        emoji: '👁️'
    },
    psyBreath: {
        id: 'psyBreath',
        name: 'Пси-дыхание',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 0,
        draw: 1,
        exhaust: true,
        description: 'Возьмите 1 карту. Убирается',
        emoji: '🌬️'
    },
    meditation: {
        id: 'meditation',
        name: 'Медитация',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 3,
        draw: 1,
        description: 'Даёт 3 Блока. Возьмите 1 карту',
        emoji: '🧘'
    },
    telepathy: {
        id: 'telepathy',
        name: 'Телепатия',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        draw: 1,
        description: 'Посмотрите намерение врага. Возьмите 1 карту',
        emoji: '📡'
    },
    
    // Необычные (7)
    brainwash: {
        id: 'brainwash',
        name: 'Промывка мозгов',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        paralysis: 2,
        description: 'Накладывает 2 Паралича',
        emoji: '🧠'
    },
    echoMind: {
        id: 'echoMind',
        name: 'Эхо разума',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        echo: 1,
        description: 'Следующая карта срабатывает дважды',
        emoji: '🔁'
    },
    copy: {
        id: 'copy',
        name: 'Копия',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        copy: 1,
        description: 'Добавьте в руку копию выбранной карты',
        emoji: '📋'
    },
    reflection: {
        id: 'reflection',
        name: 'Отражение',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        echoSkill: 1,
        description: 'Следующий Навык срабатывает дважды',
        emoji: '🪞'
    },
    rewind: {
        id: 'rewind',
        name: 'Перемотка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'Сбросьте руку. Возьмите столько же карт',
        emoji: '⏪'
    },
    mentalShift: {
        id: 'mentalShift',
        name: 'Ментальный сдвиг',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        block: 5,
        weak: 1,
        description: 'Даёт 5 Блока. Накладывает 1 Слабость',
        emoji: '🔄'
    },
    psyTrap: {
        id: 'psyTrap',
        name: 'Пси-ловушка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        paralysis: 1,
        vulnerable: 1,
        description: 'Накладывает 1 Паралич + 1 Уязвимость',
        emoji: '🪤'
    },
    
    // Редкие (3)
    mentalCapture: {
        id: 'mentalCapture',
        name: 'Ментальный захват',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        steal: 1,
        description: 'Украдите 1 карту из руки врага',
        emoji: '🤏'
    },
    fullControl: {
        id: 'fullControl',
        name: 'Полный контроль',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        paralysis: 1,
        draw: 3,
        description: 'Враг пропускает ход. Возьмите 3 карты',
        emoji: '🎛️'
    },
    mentalProjection: {
        id: 'mentalProjection',
        name: 'Ментальная проекция',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        echo: 2,
        exhaust: true,
        description: 'Следующие 2 карты срабатывают дважды. Убирается',
        emoji: '👻'
    },
    
    // ===== СИЛЫ (15 карт) =====
    // Обычные (4)
    mentalFocus: {
        id: 'mentalFocus',
        name: 'Ментальный фокус',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале хода возьмите 1 карту',
        emoji: '🎯'
    },
    psyAura: {
        id: 'psyAura',
        name: 'Пси-аура',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'Ваши атаки игнорируют 2 Блока',
        emoji: '✨'
    },
    telepathicLink: {
        id: 'telepathicLink',
        name: 'Телепатическая связь',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале боя посмотрите верхние 3 карты',
        emoji: '🔗'
    },
    psyResonance: {
        id: 'psyResonance',
        name: 'Пси-резонанс',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        description: 'Разыграли Навык — 1 урона врагу',
        emoji: '📳'
    },
    
    // Необычные (5)
    mentalBlockade: {
        id: 'mentalBlockade',
        name: 'Ментальная блокада',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'В начале хода врага: 1 Паралич (50%)',
        emoji: '🚫'
    },
    echoChamber: {
        id: 'echoChamber',
        name: 'Эхо-камера',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Каждая 3-я карта срабатывает дважды',
        emoji: '🔊'
    },
    mindAmplification: {
        id: 'mindAmplification',
        name: 'Усиление разума',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Все Атаки наносят +3 урона',
        emoji: '📈'
    },
    psyVampirism: {
        id: 'psyVampirism',
        name: 'Пси-вампиризм',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Враг парализован — лечите 2 HP в начале хода',
        emoji: '🧛'
    },
    predictor: {
        id: 'predictor',
        name: 'Предсказатель',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'В начале хода посмотрите верхнюю карту. Можно сбросить',
        emoji: '🔮'
    },
    
    // Редкие (6)
    mentalStorm: {
        id: 'mentalStorm',
        name: 'Ментальный шторм',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'В начале хода наносите 3 урона ВСЕМ врагам',
        emoji: '⛈️'
    },
    absoluteControl: {
        id: 'absoluteControl',
        name: 'Абсолютный контроль',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'Враг пропускает каждый 2-й ход',
        emoji: '👑'
    },
    multiplier: {
        id: 'multiplier',
        name: 'Множитель',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Карты с двойным срабатыванием срабатывают трижды',
        emoji: '✖️'
    },
    telepathicDomination: {
        id: 'telepathicDomination',
        name: 'Телепатическое доминирование',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'В начале боя украдите 1 карту врага',
        emoji: '🎭'
    },
    psyReflection: {
        id: 'psyReflection',
        name: 'Пси-отражение',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Когда враг атакует — 3 урона в ответ',
        emoji: '🪞'
    },
    mentalImmortality: {
        id: 'mentalImmortality',
        name: 'Ментальное бессмертие',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'При смерти выживаете с 1 HP и парализуете врагов (1 раз)',
        emoji: '💫'
    }
};

// Стартовая колода Псайкера
const PSYKER_STARTER_DECK = [
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.strike },
    { ...COMMON_CARDS.defend },
    { ...COMMON_CARDS.defend },
    { ...PSYKER_CARDS.psyStrike },
    { ...PSYKER_CARDS.mentalShield },
    { ...PSYKER_CARDS.concentration },
    { ...PSYKER_CARDS.foresight }
];