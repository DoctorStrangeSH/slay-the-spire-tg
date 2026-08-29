// Данные героев
const HEROES = {
    berserk: {
        id: 'berserk',
        name: 'Берсерк',
        title: 'Риск, Агро, Вампиризм',
        color: '#e94560',
        emoji: '⚔️',
        description: 'HP как ресурс. Раны, кровотечения, самоповреждения.',
        unlocked: true,
        maxHp: 100,
        starterDeck: 'berserk'
    },
    engineer: {
        id: 'engineer',
        name: 'Инженер',
        title: 'Контроль поля, Конструкции',
        color: '#ff8c00',
        emoji: '🔧',
        description: 'Конструкции: турели, дроны, щиты.',
        unlocked: true,
        maxHp: 80,
        starterDeck: 'engineer'
    },
    psyker: {
        id: 'psyker',
        name: 'Псайкер',
        title: 'Комбо, Дроу-движок',
        color: '#a855f7',
        emoji: '🔮',
        description: 'Манипуляция рукой и колодой.',
        unlocked: false,
        maxHp: 70,
        starterDeck: 'psyker'
    },
    plagueDoctor: {
        id: 'plagueDoctor',
        name: 'Чумной Доктор',
        title: 'DoT, Разрушение защиты',
        color: '#22c55e',
        emoji: '☠️',
        description: 'Яд, кислота, огонь. Реакции.',
        unlocked: false,
        maxHp: 75,
        starterDeck: 'plagueDoctor'
    },
    necromancer: {
        id: 'necromancer',
        name: 'Некромант',
        title: 'Жертвы, Зоопарк',
        color: '#6b7280',
        emoji: '💀',
        description: 'Кости, призыв существ.',
        unlocked: false,
        maxHp: 85,
        starterDeck: 'necromancer'
    },
    monk: {
        id: 'monk',
        name: 'Монах',
        title: 'Стойки, Имба для скилловиков',
        color: '#e5e7eb',
        emoji: '🧘',
        description: 'Смена состояний (Stances).',
        unlocked: false,
        maxHp: 90,
        starterDeck: 'monk'
    }
};