// Эффекты и статусы
class BattleEffects {
    applyStartTurnEffects(battle) {
        // Фокус
        if (battle.hasPower('focus')) battle.drawCards(1);
        
        // Регенерация
        if (battle.hasPower('regeneration')) {
            battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + 1);
        }
        
        // Уверенность
        if (battle.hasPower('confidence')) battle.block += 1;
        
        // Аура защиты
        if (battle.hasPower('protectionAura')) battle.block += 5;
        
        // Второе дыхание
        if (battle.hasPower('secondWind') && battle.block === 0) battle.block += 3;
        
        // Подготовка
        if (battle.hasPower('preparation') && battle.turn === 1) battle.drawCards(2);
        
        // Эффекты Берсерка
        this.applyBerserkStartTurnEffects(battle);
    }
    
    applyBerserkStartTurnEffects(battle) {
        if (battle.hasPower('killThirst') && battle.isBerserkWounded()) {
            battle.statusEffects.player.strength = (battle.statusEffects.player.strength || 0) + 1;
        }
        
        if (battle.hasPower('painPath')) {
            battle.player.hp -= 1;
            battle.statusEffects.player.strength = (battle.statusEffects.player.strength || 0) + 1;
        }
        
        if (battle.hasPower('battlePulse') && battle.player.hp < battle.player.maxHp * 0.25) {
            battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + 3);
        }
        
        if (battle.hasPower('bloodAura') && battle.isBerserkWounded()) {
            battle.statusEffects.enemy.bleed = (battle.statusEffects.enemy.bleed || 0) + 2;
        }
    }
    
    applyAfterPlayEffects(battle, card) {
        // Адаптация
        if (card.type === CARD_TYPES.SKILL && battle.hasPower('adaptation')) {
            battle.block += 1;
        }
        
        // Натиск
        if (card.type === CARD_TYPES.ATTACK && battle.hasPower('onslaught') && 
            battle.cardsPlayedTypes.attack === 1) {
            battle.statusEffects.player.strength = (battle.statusEffects.player.strength || 0) + 1;
        }
        
        // Универсальность
        if (battle.hasPower('versatility') && 
            battle.cardsPlayedTypes.attack > 0 && 
            battle.cardsPlayedTypes.skill > 0 && 
            battle.cardsPlayedTypes.power > 0) {
            battle.drawCards(1);
            battle.cardsPlayedTypes = { attack: 0, skill: 0, power: 0 };
        }
        
        // Мастер на все руки
        if (battle.hasPower('jackOfAllTrades')) {
            battle.block += 1;
            battle.statusEffects.player.strength = (battle.statusEffects.player.strength || 0) + 1;
        }
    }
    
    decreaseStatusEffects(battle) {
        const pe = battle.statusEffects.player;
        const ee = battle.statusEffects.enemy;
        
        if (pe.vulnerable > 0) pe.vulnerable--;
        if (pe.weak > 0) pe.weak--;
        if (ee.vulnerable > 0) ee.vulnerable--;
        if (ee.weak > 0) ee.weak--;
    }
}