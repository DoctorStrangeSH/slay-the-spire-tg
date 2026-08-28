// Карты Берсерка
const BERSERK_CARDS = {
    // ===== АТАКИ =====
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
        description: 'Наносит 6 урона. Если HP < 50%, наносит 12 урона',
        emoji: '⚡'
    },
    cutWound: {
        id: 'cutWound',
        name: 'Резаная рана',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        damage: 3,
        description: 'Наносит 3 урона. Если у врага Кровотечение, наносит 8 урона',
        emoji: '🗡️'
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
        description: 'Наносит 3 урона 4 раза. +1 урона за удар по врагу с Кровотечением',
        emoji: '🌊'
    },
    
    // Необычные атаки
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
        description: 'Наносит 6 урона 2 раза. Если теряли HP в этот ход, 3 раза',
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
        description: 'Наносит 8 урона. Если HP < 50%, наносит 8 урона ВСЕМ',
        emoji: '🌪️'
    },
    mercyStrike: {
        id: 'mercyStrike',
        name: 'Удар милосердия',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        damage: 4,
        description: 'Наносит 4 урона. Если у врага 10+ Кровотечения, наносит 14',
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
    
    // Редкие атаки
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
    execution: {
        id: 'execution',
        name: 'Добивание',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 10,
        description: 'Наносит 10 урона. Если у врага < 30% HP, наносит 30',
        emoji: '💀'
    },
    beheading: {
        id: 'beheading',
        name: 'Обезглавливание',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        damage: 18,
        description: 'Наносит 18 урона. Если убивает, лечит 8 HP и даёт 1 Энергию',
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
        description: 'Наносит 5 урона ВСЕМ. Накладывает 2 Кровотечения ВСЕМ. Вы получаете 2 урона',
        emoji: '🌀'
    },
    sacrificialBlade: {
        id: 'sacrificialBlade',
        name: 'Жертвенный клинок',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 10,
        selfDamage: 5,
        description: 'Вы теряете 5 HP. Наносит 10 урона + 1 за каждые 5 потерянных HP',
        emoji: '🗡️'
    },
    bloodTide: {
        id: 'bloodTide',
        name: 'Кровавый прилив',
        type: CARD_TYPES.ATTACK,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        damage: 12,
        bleed: 4,
        description: 'Наносит 12 урона. Накладывает 4 Кровотечения. Лечит 2 HP за 5 стаков Кровотечения',
        emoji: '🌊'
    },
    
    // ===== НАВЫКИ =====
    bandage: {
        id: 'bandage',
        name: 'Перевязка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 5,
        heal: 1,
        description: 'Даёт 5 Блока. Лечит 1 HP',
        emoji: '🩹'
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
        description: 'Вы теряете 3 HP. Получите 1 Энергию. Убирается',
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
        description: 'Возьмите 2 карты. Вы получаете 1 урона',
        emoji: '👁️'
    },
    berserkStance: {
        id: 'berserkStance',
        name: 'Стойка берсерка',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        block: 12,
        description: 'Даёт 12 Блока. Если HP < 50%, даёт 20 Блока',
        emoji: '🛡️'
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
    beastRoar: {
        id: 'beastRoar',
        name: 'Звериный рёв',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 0,
        selfDamage: 1,
        vulnerableAll: 1,
        exhaust: true,
        description: 'Вы получаете 1 урона. Накладывает 1 Уязвимость на ВСЕХ. Убирается',
        emoji: '🦁'
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
        description: 'Даёт 6 Блока. Накладывает 2 Кровотечения на случайного врага',
        emoji: '🩸'
    },
    madDash: {
        id: 'madDash',
        name: 'Бешеный рывок',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        block: 5,
        description: 'Даёт 5 Блока. В следующем ходу ваши Атаки стоят на 1 меньше',
        emoji: '🏃'
    },
    
    // Необычные навыки
    freshWound: {
        id: 'freshWound',
        name: 'Свежая рана',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        bleed: 4,
        description: 'Накладывает 4 Кровотечения. Если HP < 50%, накладывает 8',
        emoji: '🩸'
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
        description: 'Накладывает 1 Слабость и 1 Уязвимость. Вы теряете 2 HP',
        emoji: '🌫️'
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
        description: 'Накладывает 3 Кровотечения. Если враг уже истекает кровью, возьмите 1 карту',
        emoji: '🔪'
    },
    bloodSmell: {
        id: 'bloodSmell',
        name: 'Запах крови',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        draw: 2,
        description: 'Возьмите 2 карты. Если в руке есть Атака, она стоит на 1 меньше',
        emoji: '👃'
    },
    spiritFortification: {
        id: 'spiritFortification',
        name: 'Укрепление духа',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        block: 7,
        description: 'Даёт 7 Блока. Если HP < 50%, даёт 14 Блока',
        emoji: '💪'
    },
    
    // Редкие навыки
    lastStand: {
        id: 'lastStand',
        name: 'Последний рубеж',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        block: 15,
        selfDamage: 5,
        description: 'Даёт 15 Блока. Вы получаете 5 урона. Если HP < 25%, даёт 30 Блока без урона',
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
        description: 'Вы теряете 5 HP. Удваивает текущую Силу до конца боя. Убирается',
        emoji: '💉'
    },
    scarletFog: {
        id: 'scarletFog',
        name: 'Алый туман',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        weakAll: 2,
        vulnerableAll: 2,
        selfDamage: 4,
        description: 'Накладывает 2 Слабости и 2 Уязвимости на ВСЕХ. Вы теряете 4 HP',
        emoji: '🌫️'
    },
    bloodRecovery: {
        id: 'bloodRecovery',
        name: 'Кровавое восстановление',
        type: CARD_TYPES.SKILL,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        heal: 5,
        description: 'Лечит 5 HP. Снимает все Кровотечения. +1 HP за 3 стака',
        emoji: '💚'
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
        description: 'Даёт 20 Блока. Вы получаете 3 урона. Если HP < 20%, даёт 35 Блока',
        emoji: '⚔️'
    },
    
    // ===== СИЛЫ =====
    killThirst: {
        id: 'killThirst',
        name: 'Жажда убийства',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'В начале хода, если HP < 50%, получите 1 Силу',
        emoji: '🔥'
    },
    bloodletting: {
        id: 'bloodletting',
        name: 'Кровопускание',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'Когда вы получаете урон, накладывайте 1 Кровотечение на случайного врага',
        emoji: '🩸'
    },
    adrenalineRush: {
        id: 'adrenalineRush',
        name: 'Адреналиновый всплеск',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 1,
        description: 'Когда убиваете врага, лечите 2 HP и возьмите 1 карту',
        emoji: '⚡'
    },
    battlePulse: {
        id: 'battlePulse',
        name: 'Пульс битвы',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.COMMON,
        cost: 2,
        description: 'В начале хода, если HP < 25%, лечите 3 HP',
        emoji: '💓'
    },
    
    // Необычные силы
    painPath: {
        id: 'painPath',
        name: 'Путь боли',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'В начале хода вы теряете 1 HP и получаете 1 Силу',
        emoji: '😈'
    },
    beastSkin: {
        id: 'beastSkin',
        name: 'Звериная шкура',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'Когда получаете урон, даёт 1 Блок в начале следующего хода',
        emoji: '🐻'
    },
    bloodAura: {
        id: 'bloodAura',
        name: 'Кровавая аура',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 2,
        description: 'В начале хода, если HP < 50%, накладывайте 2 Кровотечения на случайного врага',
        emoji: '🩸'
    },
    bloodthirst: {
        id: 'bloodthirst',
        name: 'Кровожадность',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'Когда враг получает урон от Кровотечения, вы лечите 1 HP',
        emoji: '🧛'
    },
    battleMadness: {
        id: 'battleMadness',
        name: 'Безумие боя',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.UNCOMMON,
        cost: 1,
        description: 'Когда вы теряете HP, возьмите 1 карту (максимум 2 раза за ход)',
        emoji: '🤪'
    },
    
    // Редкие силы
    berserkMode: {
        id: 'berserkMode',
        name: 'Берсерк-режим',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Вы получаете 2 Силы. В конце хода теряете 1 HP за каждую карту в руке',
        emoji: '🔴'
    },
    bloodSeal: {
        id: 'bloodSeal',
        name: 'Кровавая печать',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'Когда враг получает урон от Кровотечения, вы лечите 2 HP',
        emoji: '🔯'
    },
    titanRage: {
        id: 'titanRage',
        name: 'Ярость титана',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Все ваши Атаки стоят на 1 меньше. В начале хода вы получаете 2 урона',
        emoji: '💢'
    },
    painIsPower: {
        id: 'painIsPower',
        name: 'Боль — это сила',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 1,
        description: 'Когда вы теряете HP, получите 1 Силу (максимум 1 раз за ход)',
        emoji: '💪'
    },
    scars: {
        id: 'scars',
        name: 'Шрамы',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'В начале боя вы получаете 10 Блока. Когда получаете урон, +1 Блок в начале следующего хода',
        emoji: '🔪'
    },
    invulnerability: {
        id: 'invulnerability',
        name: 'Неуязвимость',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'Когда вы получаете урон, уменьшите его на 2 (минимум 0)',
        emoji: '🛡️'
    },
    bloodCovenant: {
        id: 'bloodCovenant',
        name: 'Кровавый завет',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'В начале хода теряете 2 HP и получаете 1 Силу. Если HP < 50%, теряете 1 HP и получаете 2 Силы',
        emoji: '📜'
    },
    beastRage: {
        id: 'beastRage',
        name: 'Звериная ярость',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'Вы получаете 3 Силы. В конце хода получаете 1 урона за каждую карту в руке',
        emoji: '🐺'
    },
    bloodRiver: {
        id: 'bloodRiver',
        name: 'Кровавая река',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 2,
        description: 'Когда вы разыгрываете Атаку, накладывайте 1 Кровотечение на цель',
        emoji: '🌊'
    },
    painIsWeapon: {
        id: 'painIsWeapon',
        name: 'Боль — это оружие',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 1,
        description: 'Когда вы теряете HP, ваш следующий Удар наносит +2 урона',
        emoji: '🗡️'
    },
    secondLife: {
        id: 'secondLife',
        name: 'Вторая жизнь',
        type: CARD_TYPES.POWER,
        rarity: CARD_RARITY.RARE,
        cost: 3,
        description: 'Когда вы должны умереть, выживаете с 1 HP (один раз). Лечите 10 HP. Убирается',
        emoji: '💖'
    }
};

// Стартовая колода Берсерка
const BERSERK_STARTER_DECK = [
    { ...BERSERK_CARDS.wideStrike },
    { ...BERSERK_CARDS.bloodCut },
    { ...BERSERK_CARDS.bloodCut },
    { ...BERSERK_CARDS.retaliationStrike },
    { ...BERSERK_CARDS.bandage },
    { ...BERSERK_CARDS.bandage },
    { ...BERSERK_CARDS.berserkStance },
    { ...BERSERK_CARDS.berserkStance },
    { ...BERSERK_CARDS.dash },
    { ...BERSERK_CARDS.killThirst }
];