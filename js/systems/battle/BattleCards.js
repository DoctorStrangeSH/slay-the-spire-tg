// Розыгрыш карт (обновлённый с Псайкером)
class BattleCards {
    selectCard(battle, cardIndex) {
        const card = battle.hand[cardIndex];
        if (!card) return { success: false, message: 'Карта не найдена' };
        
        const selectedIndex = battle.selectedCards.indexOf(cardIndex);
        if (selectedIndex !== -1) {
            battle.selectedCards.splice(selectedIndex, 1);
            const totalPreview = this.calculateTotalPreview(battle);
            return { success: true, action: 'deselected', preview: totalPreview };
        }
        
        let cardCost = card.cost;
        if (battle.hasPower('economy') && (battle.cardsPlayedThisTurn + battle.selectedCards.length + 1) % 3 === 0) {
            cardCost = 0;
        }
        if (battle.hasPower('titanRage') && card.type === CARD_TYPES.ATTACK) {
            cardCost = Math.max(0, cardCost - 1);
        }
        
        if (cardCost > battle.energy) {
            return { success: false, message: 'Недостаточно энергии!' };
        }
        
        battle.selectedCards.push(cardIndex);
        const totalPreview = this.calculateTotalPreview(battle);
        
        return { success: true, action: 'selected', preview: totalPreview };
    }
    
    calculateTotalPreview(battle) {
        const total = {
            damage: 0, block: 0, heal: 0, selfDamage: 0,
            bleed: 0, vulnerable: 0, weak: 0, draw: 0,
            strength: 0, paralysis: 0, echo: 0, description: ''
        };
        
        battle.selectedCards.forEach(cardIndex => {
            const card = battle.hand[cardIndex];
            if (!card) return;
            
            const preview = this.calculateCardPreview(battle, card);
            total.damage += preview.damage;
            total.block += preview.block;
            total.heal += preview.heal;
            total.selfDamage += preview.selfDamage;
            total.bleed += preview.bleed;
            total.vulnerable += preview.vulnerable;
            total.weak += preview.weak;
            total.draw += preview.draw;
            total.strength += preview.strength;
            total.paralysis += preview.paralysis;
            total.echo += preview.echo;
        });
        
        // Учитываем эхо
        if (battle.echoStacks > 0 && total.damage > 0) {
            total.damage *= 2;
        }
        
        const parts = [];
        if (total.damage > 0) parts.push(`⚔️ Урон: ${total.damage}`);
        if (total.block > 0) parts.push(`🛡️ Блок: ${total.block}`);
        if (total.heal > 0) parts.push(`💚 Лечение: ${total.heal}`);
        if (total.selfDamage > 0) parts.push(`💔 Самоурон: ${total.selfDamage}`);
        if (total.bleed > 0) parts.push(`🩸 Кровотечение: ${total.bleed}`);
        if (total.vulnerable > 0) parts.push(`🎯 Уязвимость: ${total.vulnerable}`);
        if (total.weak > 0) parts.push(`📉 Слабость: ${total.weak}`);
        if (total.draw > 0) parts.push(`🃏 Добор: ${total.draw}`);
        if (total.paralysis > 0) parts.push(`🔒 Паралич: ${total.paralysis}`);
        if (total.echo > 0) parts.push(`🔁 Эхо: ${total.echo}`);
        
        total.description = parts.join(' | ');
        return total;
    }
    
    calculateCardPreview(battle, card) {
        const preview = {
            damage: 0, block: 0, heal: 0, selfDamage: 0,
            bleed: 0, vulnerable: 0, weak: 0, draw: 0,
            strength: 0, paralysis: 0, echo: 0
        };
        
        if (card.damage) {
            let damage = card.damage + (battle.statusEffects.player.strength || 0);
            
            // Усиление разума
            if (battle.hasPower('mindAmplification')) damage += 3;
            
            // Телекинез - если враг парализован
            if (card.id === 'telekinesis' && battle.isEnemyParalyzed()) damage = 12;
            
            // Удар разума - если смотрели колоду
            if (card.id === 'mindStrike' && battle.scryedThisTurn) damage = 9;
            
            // Телепатический удар - если парализован
            if (card.id === 'telepathicStrike' && battle.isEnemyParalyzed()) damage = 18;
            
            // Ментальная бомба - удваивается за паралич
            if (card.id === 'mentalBomb') {
                const paralysis = battle.statusEffects.enemy.paralysis || 0;
                damage = damage * Math.pow(2, paralysis);
            }
            
            if (battle.statusEffects.enemy.vulnerable > 0) damage = Math.floor(damage * 1.5);
            if (battle.statusEffects.player.weak > 0) damage = Math.floor(damage * 0.75);
            
            if (card.hits) damage *= card.hits;
            preview.damage = damage;
        }
        
        if (card.block) {
            preview.block = card.block + (battle.statusEffects.player.dexterity || 0);
        }
        
        if (card.heal) preview.heal = card.heal;
        if (card.selfDamage) preview.selfDamage = card.selfDamage;
        if (card.bleed) preview.bleed = card.bleed;
        if (card.vulnerable) preview.vulnerable = card.vulnerable;
        if (card.weak) preview.weak = card.weak;
        if (card.draw) preview.draw = card.draw;
        if (card.strength) preview.strength = card.strength;
        if (card.paralysis) preview.paralysis = card.paralysis;
        if (card.echo) preview.echo = card.echo;
        
        return preview;
    }
    
    playSelectedCards(battle) {
        if (battle.selectedCards.length === 0) {
            return { success: false, message: 'Выберите карты!' };
        }
        
        const sortedIndices = [...battle.selectedCards].sort((a, b) => b - a);
        
        sortedIndices.forEach(cardIndex => {
            if (battle.hand[cardIndex]) {
                this.playCard(battle, cardIndex);
            }
        });
        
        battle.selectedCards = [];
        return { success: true };
    }
    
    playCard(battle, cardIndex) {
        const card = battle.hand[cardIndex];
        
        let cardCost = card.cost;
        if (battle.hasPower('economy') && (battle.cardsPlayedThisTurn + 1) % 3 === 0) {
            cardCost = 0;
        }
        if (battle.hasPower('titanRage') && card.type === CARD_TYPES.ATTACK) {
            cardCost = Math.max(0, cardCost - 1);
        }
        
        if (cardCost > battle.energy) {
            return { success: false, message: 'Недостаточно энергии!' };
        }
        
        battle.energy -= cardCost;
        battle.cardsPlayedThisTurn++;
        
        if (battle.cardsPlayedTypes[card.type] !== undefined) {
            battle.cardsPlayedTypes[card.type]++;
        }
        
        // ОПРЕДЕЛЯЕМ СКОЛЬКО РАЗ СРАБОТАЕТ КАРТА
        let playCount = 1;
        
        // Эхо - следующая карта дважды
        if (battle.echoStacks > 0) {
            playCount += battle.echoStacks;
            battle.echoStacks = 0;
        }
        
        // Эхо для навыков
        if (battle.echoSkillStacks > 0 && card.type === CARD_TYPES.SKILL) {
            playCount += battle.echoSkillStacks;
            battle.echoSkillStacks = 0;
        }
        
        // Эхо-камера - каждая 3-я карта
        if (battle.hasPower('echoChamber') && battle.cardsPlayedThisTurn % 3 === 0) {
            playCount += 1;
        }
        
        // Множитель - карты с эхо срабатывают трижды
        if (battle.hasPower('multiplier') && playCount > 1) {
            playCount += 1;
        }
        
        // Разыгрываем карту playCount раз
        for (let i = 0; i < playCount; i++) {
            if (card.type === 'building') {
                battle.buildings.placeBuilding(battle, card);
            } else {
                switch (card.type) {
                    case CARD_TYPES.ATTACK:
                        this.dealDamage(battle, card);
                        break;
                    case CARD_TYPES.SKILL:
                        this.applySkill(battle, card);
                        break;
                    case CARD_TYPES.POWER:
                        this.applyPower(battle, card);
                        break;
                }
            }
        }
        
        // Пси-резонанс - навык наносит урон
        if (card.type === CARD_TYPES.SKILL && battle.hasPower('psyResonance')) {
            battle.enemy.hp -= 1;
            battle.enemy.hp = Math.max(0, battle.enemy.hp);
        }
        
        // Устанавливаем эхо от карты
        if (card.echo) {
            battle.echoStacks += card.echo;
        }
        if (card.echoSkill) {
            battle.echoSkillStacks += card.echoSkill;
        }
        
        // Предвидение
        if (card.scry) {
            battle.scry(card.scry);
        }
        
        // Перемотка
        if (card.id === 'rewind') {
            battle.rewindHand();
        }
        
        // Копия
        if (card.id === 'copy' && cardIndex < battle.hand.length) {
            battle.copyCard(cardIndex);
        }
        
        // Кража
        if (card.steal) {
            battle.stealEnemyCard();
        }
        
        const playedCard = battle.hand.splice(cardIndex, 1)[0];
        
        if (playedCard.exhaust) {
            battle.exhaustPile.push(playedCard);
        } else {
            battle.discardPile.push(playedCard);
        }
        
        return { success: true };
    }
    
    dealDamage(battle, card) {
        let damage = Math.floor(card.damage + (battle.statusEffects.player.strength || 0));
        
        // Усиление разума
        if (battle.hasPower('mindAmplification')) damage += 3;
        
        // Специальные условия Псайкера
        if (card.id === 'telekinesis' && battle.isEnemyParalyzed()) damage = 12;
        if (card.id === 'mindStrike' && battle.scryedThisTurn) damage = 9;
        if (card.id === 'telepathicStrike' && battle.isEnemyParalyzed()) damage = 18;
        if (card.id === 'mentalBomb') {
            const paralysis = battle.statusEffects.enemy.paralysis || 0;
            damage = damage * Math.pow(2, paralysis);
        }
        
        if (battle.statusEffects.enemy.vulnerable > 0) damage = Math.floor(damage * 1.5);
        if (battle.statusEffects.player.weak > 0) damage = Math.floor(damage * 0.75);
        
        // Пси-аура - игнорирует 2 блока
        let ignoreBlockAmount = 0;
        if (battle.hasPower('psyAura')) ignoreBlockAmount = 2;
        
        let hits = card.hits || 1;
        let totalDamage = 0;
        for (let i = 0; i < hits; i++) totalDamage += damage;
        
        // Игнорирование блока
        if (card.ignoreBlock) {
            // Полностью игнорируем блок
        } else if (battle.enemyBlock > 0) {
            const effectiveBlock = Math.max(0, battle.enemyBlock - ignoreBlockAmount);
            const blocked = Math.min(effectiveBlock, totalDamage);
            battle.enemyBlock -= blocked;
            totalDamage -= blocked;
        }
        
        totalDamage = Math.max(0, Math.floor(totalDamage));
        battle.enemy.hp -= totalDamage;
        battle.enemy.hp = Math.max(0, Math.floor(battle.enemy.hp));
        
        // Паралич от карты
        if (card.paralysis) {
            battle.statusEffects.enemy.paralysis = (battle.statusEffects.enemy.paralysis || 0) + card.paralysis;
        }
        
        // Астральный клинок - даёт эхо
        if (card.id === 'astralBlade') {
            battle.echoStacks += 1;
        }
        
        if (card.bleed) battle.statusEffects.enemy.bleed = (battle.statusEffects.enemy.bleed || 0) + card.bleed;
        if (card.vulnerable) battle.statusEffects.enemy.vulnerable = (battle.statusEffects.enemy.vulnerable || 0) + card.vulnerable;
        if (card.weak) battle.statusEffects.enemy.weak = (battle.statusEffects.enemy.weak || 0) + card.weak;
        if (card.selfDamage) battle.takeSelfDamage(card.selfDamage);
        if (card.heal) battle.player.hp = Math.min(battle.player.maxHp, Math.floor(battle.player.hp + card.heal));
        if (card.draw) battle.drawCards(card.draw);
    }
    
    applySkill(battle, card) {
        if (card.block) {
            let blockAmount = card.block + (battle.statusEffects.player.dexterity || 0);
            battle.block += Math.floor(blockAmount);
        }
        
        // Паралич от навыка
        if (card.paralysis) {
            battle.statusEffects.enemy.paralysis = (battle.statusEffects.enemy.paralysis || 0) + card.paralysis;
        }
        
        if (card.heal) battle.player.hp = Math.min(battle.player.maxHp, Math.floor(battle.player.hp + card.heal));
        if (card.draw) battle.drawCards(card.draw);
        if (card.bleed) battle.statusEffects.enemy.bleed = (battle.statusEffects.enemy.bleed || 0) + card.bleed;
        if (card.selfDamage) battle.takeSelfDamage(card.selfDamage);
        if (card.weak) battle.statusEffects.enemy.weak = (battle.statusEffects.enemy.weak || 0) + card.weak;
        if (card.vulnerable) battle.statusEffects.enemy.vulnerable = (battle.statusEffects.enemy.vulnerable || 0) + card.vulnerable;
    }
    
    applyPower(battle, card) {
        if (card.strength) {
            battle.statusEffects.player.strength = (battle.statusEffects.player.strength || 0) + card.strength;
        }
        if (card.dexterity) {
            battle.statusEffects.player.dexterity = (battle.statusEffects.player.dexterity || 0) + card.dexterity;
        }
        if (card.thorns) {
            battle.statusEffects.player.thorns = (battle.statusEffects.player.thorns || 0) + card.thorns;
        }
        
        // Телепатическая связь - посмотреть 3 карты
        if (card.id === 'telepathicLink') {
            battle.scryedThisTurn = true;
        }
        
        // Телепатическое доминирование - украсть карту
        if (card.id === 'telepathicDomination') {
            battle.stealEnemyCard();
        }
        
        if (!battle.player.relics) battle.player.relics = [];
        if (!battle.player.relics.includes(card.id)) {
            battle.player.relics.push(card.id);
        }
    }
}