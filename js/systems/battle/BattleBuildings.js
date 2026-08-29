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
            battle.drawCards(1);
        }
        
        if (battle.hasPower('modularConstruction')) {
            this.buildings.forEach(b => {
                b.hp = Math.min(b.maxHp, b.hp + 2);
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
        this.buildings.forEach((building, index) => {
            // Яд на конструкции
            if (building.statusEffects.poison > 0) {
                building.hp -= building.statusEffects.poison;
                building.statusEffects.poison--;
                
                if (building.hp <= 0) {
                    this.buildings.splice(index, 1);
                    if (battle.hasPower('systemOverload')) {
                        battle.enemy.hp -= 3;
                        battle.enemy.hp = Math.max(0, battle.enemy.hp);
                    }
                    return;
                }
            }
            
            // Кровотечение на конструкции
            if (building.statusEffects.bleed > 0) {
                building.hp -= building.statusEffects.bleed;
                building.statusEffects.bleed--;
                
                if (building.hp <= 0) {
                    this.buildings.splice(index, 1);
                    if (battle.hasPower('systemOverload')) {
                        battle.enemy.hp -= 3;
                        battle.enemy.hp = Math.max(0, battle.enemy.hp);
                    }
                }
            }
        });
    }
    
    triggerEndOfTurn(battle) {
        const hasNexus = this.buildings.some(b => b.cardId === 'nexus');
        const doubleTrigger = battle.hasPower('totalAutomation');
        
        // Сначала статусы на конструкциях
        this.triggerStatusEffects(battle);
        
        this.buildings.forEach(building => {
            if (building.cardId === 'nexus') return;
            
            let triggers = 1;
            if (battle.hasPower('engineeringNetwork')) triggers += 1;
            if (doubleTrigger) triggers += 1;
            if (hasNexus) triggers += 1;
            
            for (let i = 0; i < triggers; i++) {
                this.triggerBuildingEnd(battle, building);
            }
        });
        
        // Фабрика дронов
        const droneFactory = this.buildings.find(b => b.cardId === 'droneFactory');
        if (droneFactory && this.hasFreeSlots()) {
            this.placeBuilding(battle, {
                id: 'drone',
                name: 'Дрон',
                emoji: '🛸',
                hp: 3,
                damage: 2
            });
        }
    }
    
    triggerStartOfTurn(battle) {
        const hasNexus = this.buildings.some(b => b.cardId === 'nexus');
        
        this.buildings.forEach(building => {
            if (building.cardId === 'nexus') return;
            
            let triggers = 1;
            if (battle.hasPower('engineeringNetwork')) triggers += 1;
            if (battle.hasPower('totalAutomation')) triggers += 1;
            if (hasNexus) triggers += 1;
            
            for (let i = 0; i < triggers; i++) {
                this.triggerBuildingStart(battle, building);
            }
        });
        
        const energyCore = this.buildings.find(b => b.cardId === 'energyCore');
        if (energyCore) {
            battle.energy += this.buildings.length;
        }
        
        const workshop = this.buildings.find(b => b.cardId === 'workshop');
        if (workshop && Math.random() < 0.5) {
            const buildingCards = Object.values(ENGINEER_CARDS).filter(c => c.type === CARD_TYPES.BUILDING);
            const randomBuilding = buildingCards[Math.floor(Math.random() * buildingCards.length)];
            battle.hand.push({ ...randomBuilding });
        }
        
        if (battle.hasPower('weaponsFactory')) {
            battle.hand.push({ ...ENGINEER_CARDS.smallTurret });
        }
        
        if (battle.hasPower('indestructibleFortress')) {
            battle.block += 3;
            this.buildings.forEach(b => {
                b.hp = Math.min(b.maxHp, b.hp + 3);
            });
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
        
        if (building.poison > 0) {
            battle.statusEffects.enemy.poison = (battle.statusEffects.enemy.poison || 0) + building.poison;
        }
        
        if (building.weak > 0) {
            battle.statusEffects.enemy.weak = (battle.statusEffects.enemy.weak || 0) + building.weak;
        }
        
        if (building.vulnerable > 0) {
            battle.statusEffects.enemy.vulnerable = (battle.statusEffects.enemy.vulnerable || 0) + building.vulnerable;
        }
    }
    
    triggerBuildingStart(battle, building) {
        if (building.block > 0) {
            battle.block += building.block;
        }
        
        if (building.draw > 0) {
            battle.drawCards(building.draw);
        }
        
        if (building.energy > 0) {
            battle.energy += building.energy;
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