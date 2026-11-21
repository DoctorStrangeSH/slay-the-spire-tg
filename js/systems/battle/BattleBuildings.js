// Механики конструкций Инженера (4 слота, статусы)
class BattleBuildings {
    constructor() {
        this.buildings = [];
        this.maxSlots = 4;
        this.nextId = 1;
    }
    
    getFreeSlots() {
        return this.maxSlots - this.buildings.length;
    }
    
    hasFreeSlots() {
        return this.buildings.length < this.maxSlots;
    }
    
    placeBuilding(battle, card) {
        if (!this.hasFreeSlots()) {
            return { success: false, message: 'Нет свободных слотов!' };
        }
        
        const building = {
            id: this.nextId++,
            cardId: card.id,
            name: card.name,
            emoji: card.emoji,
            hp: card.hp || 5,
            maxHp: card.hp || 5,
            damage: card.damage || 0,
            block: card.block || 0,
            draw: card.draw || 0,
            energy: card.energy || 0,
            poison: card.poison || 0,
            weak: card.weak || 0,
            vulnerable: card.vulnerable || 0,
            aoe: card.aoe || false,
            upgraded: false,
            cost: card.cost || 0,
            // Статусы на конструкции
            statusEffects: {
                poison: 0,
                bleed: 0,
                vulnerable: 0,
                weak: 0,
                strength: 0
            }
        };
        
        if (battle.hasPower('livingSteel')) {
            building.hp += 5;
            building.maxHp += 5;
        }
        
        if (battle.hasPower('calibration')) {
            building.damage += 1;
            building.block += 1;
        }
        
        this.buildings.push(building);
        
        if (battle.hasPower('overproduction')) {
            if (battle.cards?.drawCardsForPlayedCard) {
                battle.cards.drawCardsForPlayedCard(battle, card, 1);
            } else {
                battle.drawCards(1);
            }
        }
        
        if (battle.hasPower('modularConstruction')) {
            this.buildings.forEach(b => {
                b.block += 2;
            });
        }
        
        return { success: true, building };
    }
    
    upgradeExisting(battle, card) {
        if (this.buildings.length === 0) return { success: false, message: 'Нет конструкций' };
        
        const existing = this.buildings.find(b => b.cardId === card.id);
        
        if (existing) {
            existing.maxHp += Math.floor(card.hp * 0.5);
            existing.hp = Math.min(existing.maxHp, existing.hp + Math.floor(card.hp * 0.5));
            existing.damage += card.damage ? 2 : 0;
            existing.block += card.block ? 2 : 0;
            existing.upgraded = true;
            return { success: true, action: 'upgraded', building: existing };
        }
        
        const randomBuilding = this.getRandomBuilding();
        if (randomBuilding) {
            randomBuilding.maxHp += 3;
            randomBuilding.hp = Math.min(randomBuilding.maxHp, randomBuilding.hp + 3);
            randomBuilding.damage += 1;
            randomBuilding.upgraded = true;
            return { success: true, action: 'upgraded', building: randomBuilding };
        }
        
        return { success: false, message: 'Нечего улучшать' };
    }
    
    demolishBuilding(battle, buildingId) {
        const index = this.buildings.findIndex(b => b.id === buildingId);
        if (index !== -1) {
            const destroyed = this.buildings.splice(index, 1)[0];
            
            if (battle.hasPower('systemOverload')) {
                battle.enemy.hp -= 3;
                battle.enemy.hp = Math.max(0, battle.enemy.hp);
            }
            
            return { success: true, destroyed };
        }
        return { success: false, message: 'Конструкция не найдена' };
    }
    
    demolishAll(battle) {
        const count = this.buildings.length;
        this.buildings = [];
        if (count > 0 && battle.hasPower('systemOverload')) {
            battle.enemy.hp = Math.max(0, battle.enemy.hp - (count * 3));
        }
        return count;
    }
    
    // Применение статусов на конструкцию
    applyStatusToBuilding(battle, buildingId, statusType, value) {
        const building = this.buildings.find(b => b.id === buildingId);
        if (building) {
            building.statusEffects[statusType] = (building.statusEffects[statusType] || 0) + value;
        }
    }
    
    // Срабатывание статусов на конструкциях в конце хода
    triggerStatusEffects(battle) {
        // A destroyed enemy ends the battle immediately; later structure ticks
        // must not mutate a terminal encounter or trigger additional overloads.
        if (battle.enemy.hp <= 0) return;

        // Iterate backwards: removing a destroyed building must not skip the next
        // building when multiple structures expire during the same end-of-turn tick.
        for (let index = this.buildings.length - 1; index >= 0; index--) {
            if (battle.enemy.hp <= 0) return;
            const building = this.buildings[index];

            if (building.statusEffects.poison > 0) {
                building.hp -= building.statusEffects.poison;
                building.statusEffects.poison--;

                if (building.hp <= 0) {
                    this.buildings.splice(index, 1);
                    if (battle.hasPower('systemOverload')) {
                        battle.enemy.hp -= 3;
                        battle.enemy.hp = Math.max(0, battle.enemy.hp);
                    }
                    if (battle.enemy.hp <= 0) return;
                    continue;
                }
            }

            if (building.statusEffects.bleed > 0) {
                building.hp -= building.statusEffects.bleed;
                building.statusEffects.bleed--;

                if (building.hp <= 0) {
                    this.buildings.splice(index, 1);
                    if (battle.hasPower('systemOverload')) {
                        battle.enemy.hp -= 3;
                        battle.enemy.hp = Math.max(0, battle.enemy.hp);
                    }
                    if (battle.enemy.hp <= 0) return;
                }
            }
        }
    }

    triggerEndOfTurn(battle) {
        const lubricantActive = Boolean(battle.engineerLubricantActiveThisTurn);
        
        // Сначала статусы на конструкциях
        this.triggerStatusEffects(battle);
        if (battle.enemy.hp <= 0) return;

        // Snapshot prevents newly summoned drones from triggering immediately.
        for (const building of [...this.buildings]) {
            if (battle.enemy.hp <= 0) break;
            if (building.cardId === 'nexus') continue;

            let triggers = 1;
            if (battle.hasPower('engineeringNetwork')) triggers += 1;
            if (lubricantActive) triggers += 1;

            for (let i = 0; i < triggers; i++) {
                this.triggerBuildingEnd(battle, building);
                if (battle.enemy.hp <= 0) break;
            }
        }

        // A lethal building trigger must not create drones after the encounter ends.
        if (battle.enemy.hp <= 0) return;

        if (lubricantActive) battle.engineerLubricantActiveThisTurn = false;
    }
    
    triggerStartOfTurn(battle) {
        if (battle.engineerLubricantNextTurn) {
            battle.engineerLubricantNextTurn = false;
            battle.engineerLubricantActiveThisTurn = true;
        }
        const lubricantActive = Boolean(battle.engineerLubricantActiveThisTurn);
        const hasNexus = this.buildings.some(b => b.cardId === 'nexus');
        const automationTarget = battle.hasPower('automation') && this.buildings.length > 0
            ? this.buildings[Math.floor(Math.random() * this.buildings.length)]
            : null;
        
        this.buildings.forEach(building => {
            if (building.cardId === 'nexus') return;
            
            let triggers = 1;
            if (battle.hasPower('engineeringNetwork')) triggers += 1;
            if (battle.hasPower('totalAutomation')) triggers += 1;
            if (hasNexus) triggers += 1;
            if (automationTarget === building) triggers += 1;
            if (lubricantActive) triggers += 1;
            
            for (let i = 0; i < triggers; i++) {
                this.triggerBuildingStart(battle, building);
            }
        });
        
        if (battle.hasPower('weaponsFactory') && battle.hand.length < GAME_CONFIG.maxHandSize) {
            battle.hand.push({ ...ENGINEER_CARDS.smallTurret });
        }
        
        if (battle.hasPower('indestructibleFortress')) {
            // Temporary block: 3 for the hero and 3 contributed by each
            // active construction. Do not permanently inflate building stats.
            battle.block += 3 + (this.buildings.length * 3);
        }
    }
    
    triggerBuildingEnd(battle, building) {
        // Учитываем силу конструкции
        let damage = building.damage + (building.statusEffects.strength || 0);
        
        // Уязвимость на конструкции снижает урон
        if (building.statusEffects.weak > 0) {
            damage = Math.floor(damage * 0.75);
        }
        
        if (damage > 0) {
            if (building.aoe) {
                battle.enemy.hp -= damage;
                battle.enemy.hp = Math.max(0, battle.enemy.hp);
            } else {
                battle.enemy.hp -= damage;
                battle.enemy.hp = Math.max(0, battle.enemy.hp);
            }
        }
        if (battle.enemy.hp <= 0) return;

        if (building.poison > 0) {
            battle.statusEffects.enemy.poison = (battle.statusEffects.enemy.poison || 0) + building.poison;
        }
        
        if (building.weak > 0) {
            battle.statusEffects.enemy.weak = (battle.statusEffects.enemy.weak || 0) + building.weak;
        }

        // Drone Factory is a normal end-of-turn trigger and therefore respects
        // Engineering Network, Total Automation, Nexus and Lubricant.
        if (battle.enemy.hp > 0 && building.cardId === 'droneFactory' && this.hasFreeSlots()) {
            this.placeBuilding(battle, {
                id: 'drone',
                name: 'Дрон',
                emoji: '🛸',
                hp: 3,
                damage: 2
            });
        }
    }
    
    triggerBuildingStart(battle, building) {
        if (building.block > 0) {
            battle.block += building.block;
        }
        if (building.vulnerable > 0) {
            battle.statusEffects.enemy.vulnerable =
                (battle.statusEffects.enemy.vulnerable || 0) + building.vulnerable;
        }
        
        if (building.draw > 0) {
            battle.drawCards(building.draw);
        }
        
        if (building.energy > 0) {
            battle.energy += building.energy;
        }

        // Special buildings resolve inside their trigger so every multiplier
        // applies consistently to them as well.
        if (building.cardId === 'energyCore') {
            battle.energy += this.buildings.length;
        }
        if (building.cardId === 'workshop' &&
            battle.hand.length < GAME_CONFIG.maxHandSize && Math.random() < 0.5) {
            const buildingCards = Object.values(ENGINEER_CARDS).filter(c => c.type === CARD_TYPES.BUILDING);
            const randomBuilding = buildingCards[Math.floor(Math.random() * buildingCards.length)];
            if (randomBuilding) battle.hand.push({ ...randomBuilding });
        }
    }
    
    getRandomBuilding() {
        if (this.buildings.length === 0) return null;
        return this.buildings[Math.floor(Math.random() * this.buildings.length)];
    }
    
    getBuildingCount() {
        return this.buildings.length;
    }
    
    getBuilding(index) {
        return this.buildings[index] || null;
    }
}