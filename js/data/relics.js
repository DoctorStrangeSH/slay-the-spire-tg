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
    }
});

function getAvailableRelics(owned = []) {
    const known = new Set(Array.isArray(owned) ? owned : []);
    return Object.values(RELIC_CATALOG).filter(relic => !known.has(relic.id));
}

function chooseRelic(owned = [], random = Math.random) {
    const available = getAvailableRelics(owned);
    if (!available.length) return null;
    const roll = Math.min(0.999999999, Math.max(0, Number(random()) || 0));
    return available[Math.floor(roll * available.length)];
}
