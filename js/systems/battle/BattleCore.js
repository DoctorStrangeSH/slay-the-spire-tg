// Ядро боевой системы
class BattleCore {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.turn = 1;
        this.energy = GAME_CONFIG.baseEnergy;
        this.maxEnergy = GAME_CONFIG.maxEnergy;
        this.block = 0;
        this.enemyBlock = 0;
        this.hand = [];
        this.drawPile = [];
        this.discardPile = [];
        this.exhaustPile = [];
        this.selectedCards = [];
        this.cardsPlayedThisTurn = 0;
        this.damageTakenThisTurn = 0;
        this.cardsPlayedTypes = { attack: 0, skill: 0, power: 0, building: 0 };
        
        // Механики Псайкера
        this.echoStacks = 0; // Эхо - следующая карта сработает дважды
        this.echoSkillStacks = 0; // Эхо для навыков
        this.scryedThisTurn = false; // Смотрел ли колоду в этот ход
        this.stolenCards = []; // Украденные карты
        this.paralysisApplied = false; // Был ли паралич применён
        
        this.statusEffects = {
            player: { 
                strength: 0, dexterity: 0, vulnerable: 0, weak: 0,
                poison: 0, thorns: 0, bleed: 0,
                paralysis: 0 // Паралич на игроке (если враг наложит)
            },
            enemy: { 
                strength: 0, vulnerable: 0, weak: 0,
                poison: 0, thorns: 0, bleed: 0,
                paralysis: 0 // Паралич на враге
            }
        };
        
        this.initializeDeck();
    }
    
    initializeDeck() {
        this.drawPile = this.player.deck.map(card => ({...card}));
        this.shuffle(this.drawPile);
        this.discardPile = [];
        this.hand = [];
        this.exhaustPile = [];
    }
    
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    hasPower(powerId) {
        return this.player.relics?.includes(powerId) || false;
    }
    
    isBerserkWounded() {
        return this.player.hp < this.player.maxHp / 2;
    }
    
    // Проверка: враг парализован?
    isEnemyParalyzed() {
        return (this.statusEffects.enemy.paralysis || 0) > 0;
    }
    
    drawCards(count) {
        for (let i = 0; i < count; i++) {
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) break;
                this.drawPile = [...this.discardPile];
                this.discardPile = [];
                this.shuffle(this.drawPile);
            }
            if (this.hand.length >= GAME_CONFIG.maxHandSize) break;
            this.hand.push(this.drawPile.pop());
        }
    }
    
    // Предвидение (Scry) - посмотреть верх карты
    scry(count) {
        this.scryedThisTurn = true;
        const topCards = [];
        const cardsToScry = Math.min(count, this.drawPile.length);
        
        for (let i = 0; i < cardsToScry; i++) {
            topCards.push({ ...this.drawPile[this.drawPile.length - 1 - i] });
        }
        
        return topCards;
    }
    
    // Сбросить карту из колоды (для Предсказателя)
    discardTopCard() {
        if (this.drawPile.length > 0) {
            const card = this.drawPile.pop();
            this.discardPile.push(card);
            return card;
        }
        return null;
    }
    
    // Перемотка - сбросить руку и взять столько же
    rewindHand() {
        const count = this.hand.length;
        this.discardPile.push(...this.hand);
        this.hand = [];
        this.drawCards(count);
    }
    
    // Копирование карты
    copyCard(cardIndex) {
        const card = this.hand[cardIndex];
        if (card && this.hand.length < GAME_CONFIG.maxHandSize) {
            const copy = { ...card };
            this.hand.push(copy);
            return { success: true, card: copy };
        }
        return { success: false, message: 'Рука полна или карта не найдена' };
    }
    
    // Кража карты врага
    stealEnemyCard() {
        // У нас один враг, крадём его "намерение"
        const intent = this.getEnemyIntentInfo();
        
        if (intent.type === 'attack') {
            const stolenCard = {
                id: 'stolen_attack',
                name: 'Украденная атака',
                type: CARD_TYPES.ATTACK,
                cost: 1,
                damage: Math.floor(intent.damage / 2),
                description: `Украденная атака: ${Math.floor(intent.damage / 2)} урона`,
                emoji: '🎭'
            };
            this.hand.push(stolenCard);
            return { success: true, card: stolenCard };
        } else {
            const stolenCard = {
                id: 'stolen_defend',
                name: 'Украденная защита',
                type: CARD_TYPES.SKILL,
                cost: 1,
                block: Math.floor(intent.block / 2),
                description: `Украденная защита: ${Math.floor(intent.block / 2)} блока`,
                emoji: '🎭'
            };
            this.hand.push(stolenCard);
            return { success: true, card: stolenCard };
        }
    }
    
    getEnemyIntent() {
        const pattern = this.enemy.pattern;
        const intent = pattern[this.enemy.patternIndex % pattern.length];
        this.enemy.patternIndex++;
        return intent;
    }
    
    takeSelfDamage(damage) {
        this.player.hp -= damage;
        this.player.hp = Math.max(0, Math.floor(this.player.hp));
        this.damageTakenThisTurn += damage;
    }
    
    getEnemyIntentInfo() {
        if (this.enemyIntent === 'attack') {
            let damage = Math.floor(this.enemy.damage + (this.statusEffects.enemy.strength || 0));
            if (this.statusEffects.player.vulnerable > 0) damage = Math.floor(damage * 1.5);
            if (this.statusEffects.enemy.weak > 0) damage = Math.floor(damage * 0.75);
            return { type: 'attack', damage };
        } else {
            let blockAmount = 10;
            if (this.enemy.specialAbility === 'rock_armor') blockAmount = 20;
            return { type: 'defend', block: blockAmount };
        }
    }
    
    getDeckInfo() {
        return {
            drawPile: this.drawPile.length,
            hand: this.hand.length,
            discardPile: this.discardPile.length,
            exhaustPile: this.exhaustPile.length
        };
    }
    
    viewDrawPile() {
        return this.drawPile.map(card => ({
            name: card.name, type: card.type, cost: card.cost,
            description: card.description, emoji: card.emoji
        }));
    }
    
    viewDiscardPile() {
        return this.discardPile.map(card => ({
            name: card.name, type: card.type, cost: card.cost,
            description: card.description, emoji: card.emoji
        }));
    }
}