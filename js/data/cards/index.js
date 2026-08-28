// Реестр карт
const CARD_REGISTRY = {
    berserk: {
        cards: BERSERK_CARDS,
        starterDeck: BERSERK_STARTER_DECK
    }
    // Другие герои будут добавлены позже
};

// Получить карты героя
function getCardsForHero(heroId) {
    return CARD_REGISTRY[heroId]?.cards || BERSERK_CARDS;
}

// Получить стартовую колоду героя
function getStarterDeckForHero(heroId) {
    const deck = CARD_REGISTRY[heroId]?.starterDeck || BERSERK_STARTER_DECK;
    return deck.map(card => ({...card}));
}