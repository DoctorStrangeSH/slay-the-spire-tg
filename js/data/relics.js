// Независимый реестр реликвий: данные можно расширять без правок UI.
const RELIC_CATALOG = Object.freeze({
    emberBattery: {
        id: 'emberBattery',
        name: 'Угольное сердце',
        emoji: '🔥',
        description: '+1 энергия в каждом ходу боя.'
    },
    stoneguard: {
        id: 'stoneguard',
        name: 'Каменная печать',
        emoji: '🛡️',
        description: 'В начале каждого хода получаете 4 блока.'
    },
    chronicle: {
        id: 'chronicle',
        name: 'Хроника предвидения',
        emoji: '📜',
        description: 'В начале каждого хода берёте дополнительную карту.'
    },
    eternityShard: {
        id: 'eternityShard',
        name: 'Осколок вечности',
        emoji: '💎',
        description: 'Каждое новое благословение длится на один бой дольше (до 99 боёв).'
    },
    bloodPact: {
        id: 'bloodPact',
        name: 'Кровавый договор',
        emoji: '🩸',
        description: '+2 силы на весь бой, если к его началу действует проклятие. Проклятие сохраняет свой штраф.'
    },
    bloodFang: {
        id: 'bloodFang',
        heroId: 'berserk',
        name: 'Клык последней ярости',
        emoji: '🩸',
        description: 'Если здоровья не больше половины, получаете 5 блока в начале каждого хода.'
    },
    ironCog: {
        id: 'ironCog',
        heroId: 'engineer',
        name: 'Заводная броня',
        emoji: '⚙️',
        description: 'В начале каждого хода получаете 2 дополнительных блока.'
    },
    mindEye: {
        id: 'mindEye',
        heroId: 'psyker',
        name: 'Око безмолвия',
        emoji: '🔮',
        description: 'В начале каждого хода берёте 1 дополнительную карту.'
    }
});

function getAvailableRelics(owned = [], heroId = null) {
    const known = new Set(Array.isArray(owned) ? owned : []);
    return Object.values(RELIC_CATALOG).filter(relic => !known.has(relic.id) &&
        (!relic.heroId || relic.heroId === heroId));
}

function chooseRelic(owned = [], random = Math.random, heroId = null) {
    const available = getAvailableRelics(owned, heroId);
    if (!available.length) return null;
    const roll = Math.min(0.999999999, Math.max(0, Number(random()) || 0));
    return available[Math.floor(roll * available.length)];
}
