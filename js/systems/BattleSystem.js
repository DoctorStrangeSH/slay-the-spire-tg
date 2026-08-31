// Боевая система (главный класс)
class BattleSystem extends BattleCore {
    constructor(player, enemy) {
        super(player, enemy);
        
        this.effects = new BattleEffects();
        this.cards = new BattleCards();
        this.turnManager = new BattleTurn();
        
        // Конструкции для Инженера
        if (player.heroId === 'engineer') {
            this.buildings = new BattleBuildings();
        } else {
            this.buildings = null;
        }
        
        this.startTurn();
    }
    
    startTurn() {
        this.energy = this.maxEnergy;
        this.block = 0;
        this.damageTakenThisTurn = 0;
        this.cardsPlayedThisTurn = 0;
        this.cardsPlayedTypes = { attack: 0, skill: 0, power: 0, building: 0 };
        this.scryedThisTurn = false;
        
        this.effects.applyStartTurnEffects(this);
        
        // Конструкции срабатывают в начале хода
        if (this.buildings) {
            this.buildings.triggerStartOfTurn(this);
        }
        
        // Ментальный фокус - взять карту
        if (this.hasPower('mentalFocus')) {
            this.drawCards(1);
        }
        
        // Предсказатель - посмотреть верхнюю карту
        if (this.hasPower('predictor') && this.drawPile.length > 0) {
            this.scryedThisTurn = true;
        }
        
        // Пси-вампиризм - лечение при параличе врага
        if (this.hasPower('psyVampirism') && this.isEnemyParalyzed()) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
        }
        
        this.drawCards(5);
        this.enemyIntent = this.getEnemyIntent();
    }
    
    selectCard(cardIndex) {
        return this.cards.selectCard(this, cardIndex);
    }
    
    calculateTotalPreview() {
        return this.cards.calculateTotalPreview(this);
    }
    
    playSelectedCards() {
        return this.cards.playSelectedCards(this);
    }
    
    playCard(cardIndex) {
        const card = this.hand[cardIndex];
        const result = this.cards.playCard(this, cardIndex);
        
        if (result.success && card) {
            this.effects.applyAfterPlayEffects(this, card);
        }
        
        return result;
    }
    
    endTurn() {
        // Конструкции срабатывают в конце хода
        if (this.buildings) {
            this.buildings.triggerEndOfTurn(this);
        }
        
        return this.turnManager.endTurn(this, this.effects);
    }
}