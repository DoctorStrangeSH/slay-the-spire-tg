// Механики конструкций Инженера
class BattleBuildings {
    constructor() {
        this.buildings = []; // Активные конструкции на поле
    }
    
    // Выложить конструкцию
    placeBuilding(battle, card) {
        const building = {
            id: `building_${Date.now()}_${Math.random()}`,
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
            triggerCount: 1,
            upgraded: false
        };
        
        // Применяем эффекты сил
        if (battle.hasPower('livingSteel')) {
            building.hp += 5;
            building.maxHp += 5;
        }
        
        if (battle.hasPower('calibration')) {
            building.damage += 1;
            building.block += 1;
        }
        
        this.buildings.push(building);
        
        // Перепроизводство - взять карту
        if (battle.hasPower('overproduction')) {
            battle.drawCards(1);
        }
        
        // Модульная конструкция - блок всем конструкциям
        if (battle.hasPower('modularConstruction')) {
            this.buildings.forEach(b => {
                b.hp = Math.min(b.maxHp, b.hp + 2);
            });
        }
        
        return building;
    }
    
    // Срабатывание конструкций в конце хода
    triggerEndOfTurn(battle) {
        let doubleTrigger = battle.hasPower('totalAutomation') || 
                           (battle.hasPower('automation') && Math.random() < 0.5);
        
        // Нексус удваивает срабатывание других конструкций
        const hasNexus = this.buildings.some(b => b.cardId === 'nexus');
        
        this.buildings.forEach(building => {
            let triggers = 1;
            
            if (building.cardId === 'nexus') return; // Нексус не атакует сам
            
            if (battle.hasPower('engineeringNetwork')) triggers += 1;
            if (doubleTrigger && building.cardId !== 'nexus') triggers += 1;
            if (hasNexus && building.cardId !== 'nexus') triggers += 1;
            
            for (let i = 0; i < triggers; i++) {
                this.triggerBuilding(battle, building);
            }
        });
        
        // Фабрика дронов призывает дрона
        const droneFactory = this.buildings.find(b => b.cardId === 'droneFactory');
        if (droneFactory) {
            this.placeBuilding(battle, {
                id: 'drone',
                name: 'Дрон',
                emoji: '🛸',
                hp: 3,
                damage: 2
            });
        }
    }
    
    // Срабатывание конструкций в начале хода
    triggerStartOfTurn(battle) {
        const hasNexus = this.buildings.some(b => b.cardId === 'nexus');
        
        this.buildings.forEach(building => {
            let triggers = 1;
            
            if (building.cardId === 'nexus') return;
            
            if (battle.hasPower('engineeringNetwork')) triggers += 1;
            if (battle.hasPower('totalAutomation') && building.cardId !== 'nexus') triggers += 1;
            if (hasNexus && building.cardId !== 'nexus') triggers += 1;
            
            for (let i = 0; i < triggers; i++) {
                this.triggerBuildingStart(battle, building);
            }
        });
        
        // Энергетическое ядро
        const energyCore = this.buildings.find(b => b.cardId === 'energyCore');
        if (energyCore) {
            battle.energy += this.buildings.length;
        }
        
        // Мастерская
        const workshop = this.buildings.find(b => b.cardId === 'workshop');
        if (workshop && Math.random() < 0.5) {
            const buildingCards = Object.values(ENGINEER_CARDS).filter(c => c.type === 'building');
            const randomBuilding = buildingCards[Math.floor(Math.random() * buildingCards.length)];
            battle.hand.push({ ...randomBuilding });
        }
        
        // Оружейный завод
        if (battle.hasPower('weaponsFactory')) {
            battle.hand.push({ ...ENGINEER_CARDS.smallTurret });
        }
        
        // Несокрушимая крепость
        if (battle.hasPower('indestructibleFortress')) {
            battle.block += 3;
            this.buildings.forEach(b => {
                b.hp = Math.min(b.maxHp, b.hp + 3);
            });
        }
    }
    
    // Срабатывание конкретной конструкции (конец хода)
    triggerBuilding(battle, building) {
        if (building.damage > 0) {
            let damage = building.damage;
            
            if (building.aoe) {
                // Урон всем врагам (у нас один враг)
                battle.enemy.hp -= damage;
                battle.enemy.hp = Math.max(0, battle.enemy.hp);
            } else {
                // Урон случайному врагу (у нас один)
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
    
    // Срабатывание конструкции (начало хода)
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
    
    // Получить урон по конструкции
    damageBuilding(battle, buildingIndex, damage) {
        if (this.buildings[buildingIndex]) {
            this.buildings[buildingIndex].hp -= damage;
            
            if (this.buildings[buildingIndex].hp <= 0) {
                const destroyed = this.buildings.splice(buildingIndex, 1)[0];
                
                // Перегрузка систем - урон врагу при уничтожении
                if (battle.hasPower('systemOverload')) {
                    battle.enemy.hp -= 3;
                    battle.enemy.hp = Math.max(0, battle.enemy.hp);
                }
                
                return { destroyed: true, building: destroyed };
            }
        }
        return { destroyed: false };
    }
    
    // Починить конструкцию
    repairBuilding(battle, buildingIndex, amount) {
        if (this.buildings[buildingIndex]) {
            this.buildings[buildingIndex].hp = Math.min(
                this.buildings[buildingIndex].maxHp,
                this.buildings[buildingIndex].hp + amount
            );
        }
    }
    
    // Уничтожить все конструкции
    destroyAllBuildings() {
        const count = this.buildings.length;
        this.buildings = [];
        return count;
    }
    
    // Получить количество конструкций
    getBuildingCount() {
        return this.buildings.length;
    }
    
    // Получить случайную конструкцию
    getRandomBuilding() {
        if (this.buildings.length === 0) return null;
        return this.buildings[Math.floor(Math.random() * this.buildings.length)];
    }
}