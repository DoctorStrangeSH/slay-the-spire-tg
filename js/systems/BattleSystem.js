// Боевая система (главный класс)
class BattleSystem extends BattleCore {
    constructor(player, enemy) {
        super(player, enemy);
        
        this.effects = new BattleEffects();
        this.cards = new BattleCards();
        this.turnManager = new BattleTurn();
        this.pendingScryCards = null;

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
        this.battleMadnessTriggersThisTurn = 0;
        this.painIsPowerTriggeredThisTurn = false;
        this.vampirismTriggersThisTurn = 0;
        if (this.beastSkinBlockNextTurn > 0) {
            this.block += this.beastSkinBlockNextTurn;
            this.beastSkinBlockNextTurn = 0;
        }
        this.cardsPlayedThisTurn = 0;
        this.cardsPlayedTypes = { attack: 0, skill: 0, power: 0, building: 0 };
        this.scryedThisTurn = false;
        
        this.effects.applyStartTurnEffects(this);
        // Start-of-turn relics can be lethal. Do not let a dead hero draw,
        // trigger buildings, or receive an enemy intent for a turn they cannot take.
        if (this.player.hp <= 0) {
            this.battleEnded = true;
            this.enemyIntent = null;
            return;
        }

        if (this.battleMadnessPendingDraws > 0) {
            const pendingDraws = this.battleMadnessPendingDraws;
            this.battleMadnessPendingDraws = 0;
            this.drawCards(pendingDraws);
        }
        
        // Конструкции срабатывают в начале хода
        if (this.buildings) {
            this.buildings.triggerStartOfTurn(this);
        }
        
        // Ментальный фокус - взять карту
        if (this.hasPower('mentalFocus')) {
            this.drawCards(1);
        }
        
        // Пси-вампиризм - лечение при параличе врага
        if (this.hasPower('psyVampirism') && this.isEnemyParalyzed()) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
        }
        
        const bonusDraw = (this.hasPower('chronicle') ? 1 : 0)
            + (this.player.heroId === 'psyker' && this.hasPower('mindEye') ? 1 : 0);
        this.drawCards(5 + bonusDraw);

        // Предсказатель: после обычного добора покажите верхнюю карту и
        // разрешите сбросить именно её, не меняя порядок остальных карт.
        this.pendingScryCards = this.hasPower('predictor') && this.drawPile.length > 0
            ? this.scry(1)
            : null;

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
        if (result.success && this.enemy.hp <= 0) this.triggerAdrenalineRush?.();
        if (result.success && card?.type === 'attack' &&
            this.hasPower('arsenal') && this.player.hp > 0 && this.enemy.hp > 0 &&
            this.hand.length < GAME_CONFIG.maxHandSize &&
            typeof ENGINEER_CARDS !== 'undefined' && ENGINEER_CARDS.spark) {
            this.hand.push({ ...ENGINEER_CARDS.spark });
        }
        
        // A lethal card ends resolution immediately: no relic/after-play effects
        // may mutate a run after either side has reached a terminal HP state.
        if (result.success && card && this.player.hp > 0 && this.enemy.hp > 0) {
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