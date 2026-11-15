// Реестр карт
const CARD_REGISTRY = {
    common: {
        cards: COMMON_CARDS,
        starterDeck: null
    },
    berserk: {
        cards: { ...COMMON_CARDS, ...BERSERK_CARDS },
        starterDeck: BERSERK_STARTER_DECK
    },
    engineer: {
        cards: { ...COMMON_CARDS, ...ENGINEER_CARDS },
        starterDeck: ENGINEER_STARTER_DECK
    },
    psyker: {
        cards: { ...COMMON_CARDS, ...PSYKER_CARDS },
        starterDeck: PSYKER_STARTER_DECK
    },
};

// Получить все карты героя
function getCardsForHero(heroId) {
    if (heroId === 'berserk') {
        return { ...COMMON_CARDS, ...BERSERK_CARDS };
    }
    if (heroId === 'engineer') {
        return { ...COMMON_CARDS, ...ENGINEER_CARDS };
    }
    if (heroId === 'psyker') {
        return { ...COMMON_CARDS, ...PSYKER_CARDS };
    }
    return COMMON_CARDS;
}

// Получить стартовую колоду героя
function getStarterDeckForHero(heroId) {
    const deck = CARD_REGISTRY[heroId]?.starterDeck;
    if (deck) {
        return deck.map(card => ({ ...card }));
    }
    return [];
}

// Взвешенная выдача без повторений: редкость выбирается перед конкретной картой.
// Инъекция random позволяет воспроизводить и тестировать расклад наград.
function getRandomRewardCards(heroId, count = 3, random = Math.random) {
    const available = Object.values(getCardsForHero(heroId)).filter(card => card && card.id);
    const result = [];
    const weights = [
        { rarity: CARD_RARITY.COMMON, chance: 70 },
        { rarity: CARD_RARITY.UNCOMMON, chance: 25 },
        { rarity: CARD_RARITY.RARE, chance: 5 }
    ];

    while (available.length > 0 && result.length < Math.max(0, count)) {
        const tiers = weights.filter(tier => available.some(card => card.rarity === tier.rarity));
        const sum = tiers.reduce((total, tier) => total + tier.chance, 0);
        let roll = random() * sum;
        let rarity = tiers[tiers.length - 1]?.rarity;
        for (const tier of tiers) {
            roll -= tier.chance;
            if (roll < 0) { rarity = tier.rarity; break; }
        }
        // Карты без известной редкости остаются доступными как резервный вариант.
        const pool = available.filter(card => card.rarity === rarity);
        const candidates = pool.length ? pool : available;
        const chosen = candidates[Math.floor(random() * candidates.length)];
        result.push({ ...chosen });
        // Убираем ID из пула: в одной награде повторения недопустимы.
        for (let index = available.length - 1; index >= 0; index--) {
            if (available[index].id === chosen.id) available.splice(index, 1);
        }
    }
    return result;
}
