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
    }
};

// Получить все карты героя
function getCardsForHero(heroId) {
    if (heroId === 'berserk') {
        return { ...COMMON_CARDS, ...BERSERK_CARDS };
    }
    if (heroId === 'engineer') {
        return { ...COMMON_CARDS, ...ENGINEER_CARDS };
    }
    return COMMON_CARDS;
}

// Получить стартовую колоду героя
function getStarterDeckForHero(heroId) {
    const deck = CARD_REGISTRY[heroId]?.starterDeck;
    if (deck) {
        return deck.map(card => ({...card}));
    }
    return [];
}

// Получить случайные карты для награды
function getRandomRewardCards(heroId, count = 3) {
    const cards = getCardsForHero(heroId);
    const cardIds = Object.keys(cards);
    const rewards = [];
    
    for (let i = 0; i < count; i++) {
        const randomId = cardIds[Math.floor(Math.random() * cardIds.length)];
        rewards.push({ ...cards[randomId] });
    }
    
    return rewards;
}