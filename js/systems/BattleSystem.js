// Боевая система (главный класс)
class BattleSystem extends BattleCore {
    constructor(player, enemy) {
        super(player, enemy);
        
        this.effects = new BattleEffects();
        this.cards = new BattleCards();
        this.turnManager = new BattleTurn();

        if (this.hasPower('emberBattery')) this.maxEnergy += 1;
        
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
        this.block = (this.hasPower('stoneguard') ? 4 : 0)
            + (this.player.heroId === 'engineer' && this.hasPower('ironCog') ? 2 : 0)
            + (this.player.heroId === 'berserk' && this.hasPower('bloodFang') &&
                Number.isFinite(this.player.hp) && Number.isFinite(this.player.maxHp) &&
                this.player.hp <= this.player.maxHp / 2 ? 5 : 0);
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
        
        const bonusDraw = (this.hasPower('chronicle') ? 1 : 0)
            + (this.player.heroId === 'psyker' && this.hasPower('mindEye') ? 1 : 0);
        this.drawCards(5 + bonusDraw);
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
        // A card or external effect may already have ended the battle.
        // Resolve the terminal outcome before any Engineer building can act.
        if (this.player.hp <= 0 || this.enemy.hp <= 0) {
            return this.turnManager.endTurn(this, this.effects);
        }

        // Конструкции срабатывают в конце хода
        if (this.buildings) {
            this.buildings.triggerEndOfTurn(this);
        }
        
        return this.turnManager.endTurn(this, this.effects);
    }
}