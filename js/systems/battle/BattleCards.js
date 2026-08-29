// Розыгрыш карт (обновлённый с конструкциями)
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
        
        // Ярость титана - атаки стоят на 1 меньше
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
            strength: 0, description: ''
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
        });
        
        const parts = [];
        if (total.damage > 0) parts.push(`⚔️ Урон: ${total.damage}`);
        if (total.block > 0) parts.push(`🛡️ Блок: ${total.block}`);
        if (total.heal > 0) parts.push(`💚 Лечение: ${total.heal}`);
        if (total.selfDamage > 0) parts.push(`💔 Самоурон: ${total.selfDamage}`);
        if (total.bleed > 0) parts.push(`🩸 Кровотечение: ${total.bleed}`);
        if (total.draw > 0) parts.push(`🃏 Добор: ${total.draw}`);
        
        total.description = parts.join(' | ');
        return total;
    }
    
    calculateCardPreview(battle, card) {
        const preview = {
            damage: 0, block: 0, heal: 0, selfDamage: 0,
            bleed: 0, vulnerable: 0, weak: 0, draw: 0, strength: 0
        };
        
        if (card.damage) {
            let damage = card.damage + (battle.statusEffects.player.strength || 0);
            
            // Гаечный ключ - с конструкцией больше урона
            if (card.id === 'wrench' && battle.buildings?.getBuildingCount() > 0) {
                damage = 9;
            }
            
            // Перегрузка - урон за каждую конструкцию
            if (card.id === 'overload' && battle.buildings) {
                damage = 4 + battle.buildings.getBuildingCount() * 2;
            }
            
            // Болт - с конструкцией больше
            if (card.id === 'bolt' && battle.buildings?.getBuildingCount() > 0) {
                damage = 13;
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
        
        // Конструкция - выкладываем на поле
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
        
        // Механики Инженера
        if (card.id === 'wrench' && battle.buildings?.getBuildingCount() > 0) damage = 9;
        if (card.id === 'overload' && battle.buildings) damage = 4 + battle.buildings.getBuildingCount() * 2;
        if (card.id === 'bolt' && battle.buildings?.getBuildingCount() > 0) damage = 13;
        
        // Дрон-камикадзе
        if (card.id === 'kamikazeDrone' && battle.buildings) {
            const building = battle.buildings.getRandomBuilding();
            if (building) {
                damage = Math.min(15, building.hp);
                battle.buildings.destroyAllBuildings();
            } else {
                damage = 0;
            }
        }
        
        // Массовая перегрузка
        if (card.id === 'massOverload' && battle.buildings) {
            const count = battle.buildings.destroyAllBuildings();
            damage = count * 6;
        }
        
        // Разрушитель - убирает блок
        if (card.id === 'destroyer') {
            battle.enemyBlock = 0;
        }
        
        if (battle.statusEffects.enemy.vulnerable > 0) damage = Math.floor(damage * 1.5);
        if (battle.statusEffects.player.weak > 0) damage = Math.floor(damage * 0.75);
        
        let hits = card.hits || 1;
        let totalDamage = 0;
        for (let i = 0; i < hits; i++) totalDamage += damage;
        
        if (card.ignoreBlock) {
            // Игнорируем блок
        } else if (battle.enemyBlock > 0) {
            const blocked = Math.min(battle.enemyBlock, totalDamage);
            battle.enemyBlock -= blocked;
            totalDamage -= blocked;
        }
        
        totalDamage = Math.max(0, Math.floor(totalDamage));
        battle.enemy.hp -= totalDamage;
        battle.enemy.hp = Math.max(0, Math.floor(battle.enemy.hp));
        
        // Арсенал - добавить Искру при розыгрыше Атаки
        if (battle.hasPower('arsenal') && card.type === CARD_TYPES.ATTACK) {
            battle.hand.push({ ...ENGINEER_CARDS.spark });
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
            
            // Энергетический щит - больше блока с конструкцией
            if (card.id === 'energyShield' && battle.buildings?.getBuildingCount() > 0) {
                blockAmount = 10;
            }
            
            battle.block += Math.floor(blockAmount);
        }
        
        // Починка - восстановить конструкцию
        if (card.id === 'repair' && battle.buildings) {
            const building = battle.buildings.getRandomBuilding();
            if (building) {
                battle.buildings.repairBuilding(battle, 0, 3);
            }
        }
        
        // Ремонтный дрон - восстановить все конструкции
        if (card.id === 'repairDrone' && battle.buildings) {
            battle.buildings.buildings.forEach((b, i) => {
                battle.buildings.repairBuilding(battle, i, 5);
            });
        }
        
        // Модернизация - улучшить все конструкции
        if (card.id === 'modernization' && battle.buildings) {
            battle.buildings.buildings.forEach(b => {
                b.damage += 2;
                b.block += 3;
                b.upgraded = true;
            });
        }
        
        // Заводской сброс
        if (card.id === 'factoryReset' && battle.buildings) {
            const count = battle.buildings.destroyAllBuildings();
            battle.energy += count;
            battle.drawCards(count);
        }
        
        // Нанороботы
        if (card.id === 'nanobots' && battle.buildings) {
            battle.buildings.buildings.forEach((b, i) => {
                battle.buildings.repairBuilding(battle, i, 2);
            });
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
        
        // Реактивный ранец - +1 энергия в начале боя
        if (card.id === 'jetpack') {
            battle.energy += 1;
        }
        
        // Резерв - добавить Малую турель в руку
        if (card.id === 'reserve') {
            battle.hand.push({ ...ENGINEER_CARDS.smallTurret });
        }
        
        if (!battle.player.relics) battle.player.relics = [];
        if (!battle.player.relics.includes(card.id)) {
            battle.player.relics.push(card.id);
        }
    }
}