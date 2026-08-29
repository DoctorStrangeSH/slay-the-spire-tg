// Ходы и завершение
class BattleTurn {
    endTurn(battle, effects) {
        // Ход врага
        if (battle.enemyIntent === 'attack') {
            this.enemyAttack(battle);
        } else if (battle.enemyIntent === 'defend') {
            this.enemyDefend(battle);
        }
        
        // Кровотечение врага
        if (battle.statusEffects.enemy.bleed > 0) {
            battle.enemy.hp -= Math.floor(battle.statusEffects.enemy.bleed);
            battle.enemy.hp = Math.max(0, Math.floor(battle.enemy.hp));
            
            if (battle.hasPower('bloodthirst')) {
                battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + 1);
            }
            if (battle.hasPower('bloodSeal')) {
                battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + 2);
            }
            
            battle.statusEffects.enemy.bleed--;
        }
        
        // Яд игрока
        if (battle.statusEffects.player.poison > 0) {
            battle.player.hp -= Math.floor(battle.statusEffects.player.poison);
            battle.player.hp = Math.max(0, Math.floor(battle.player.hp));
            battle.statusEffects.player.poison--;
        }
        
        // Сброс руки
        battle.discardPile.push(...battle.hand);
        battle.hand = [];
        
        effects.decreaseStatusEffects(battle);
        
        // Проверка конца боя
        if (battle.enemy.hp <= 0) return { battleEnded: true, victory: true };
        if (battle.player.hp <= 0) {
            if (battle.hasPower('secondLife')) {
                battle.player.hp = 10;
                battle.player.relics = battle.player.relics.filter(r => r !== 'secondLife');
            } else {
                return { battleEnded: true, victory: false };
            }
        }
        
        battle.turn++;
        battle.startTurn();
        
        return { battleEnded: false };
    }
    
    enemyAttack(battle) {
        let damage = Math.floor(battle.enemy.damage + (battle.statusEffects.enemy.strength || 0));
        
        if (battle.enemy.specialAbility === 'dark_magic' && Math.random() < 0.3) {
            damage = Math.floor(damage * 1.5);
        }
        
        if (battle.statusEffects.player.vulnerable > 0) damage = Math.floor(damage * 1.5);
        if (battle.statusEffects.enemy.weak > 0) damage = Math.floor(damage * 0.75);
        
        if (battle.hasPower('invulnerability')) damage = Math.max(0, damage - 2);
        
        // ВЫБОР ЦЕЛИ: конструкция или игрок
        const target = this.chooseTarget(battle);
        
        if (target.type === 'building') {
            // Атака по конструкции
            this.attackBuilding(battle, target.building, damage);
        } else {
            // Атака по игроку
            this.attackPlayer(battle, damage);
        }
    }
    
    chooseTarget(battle) {
        // Если есть конструкции - шанс атаковать их
        if (battle.buildings && battle.buildings.getBuildingCount() > 0) {
            const buildingCount = battle.buildings.getBuildingCount();
            
            // Шанс атаковать конструкцию зависит от количества конструкций
            // 30% + 15% за каждую конструкцию (максимум 75%)
            let buildingChance = 0.30 + (buildingCount * 0.15);
            buildingChance = Math.min(0.75, buildingChance);
            
            if (Math.random() < buildingChance) {
                // Выбираем случайную конструкцию
                const building = battle.buildings.getRandomBuilding();
                if (building) {
                    return { type: 'building', building };
                }
            }
        }
        
        return { type: 'player' };
    }
    
    attackBuilding(battle, building, damage) {
        building.hp -= damage;
        
        // Проверяем уничтожение
        if (building.hp <= 0) {
            const index = battle.buildings.buildings.findIndex(b => b.id === building.id);
            if (index !== -1) {
                battle.buildings.buildings.splice(index, 1);
                
                // Перегрузка систем - урон врагу
                if (battle.hasPower('systemOverload')) {
                    battle.enemy.hp -= 3;
                    battle.enemy.hp = Math.max(0, battle.enemy.hp);
                }
            }
        }
    }
    
    attackPlayer(battle, damage) {
        if (battle.block > 0) {
            const blocked = Math.min(battle.block, damage);
            battle.block -= blocked;
            damage -= blocked;
        }
        
        damage = Math.max(0, Math.floor(damage));
        battle.player.hp -= damage;
        battle.player.hp = Math.max(0, Math.floor(battle.player.hp));
        
        // Шипы игрока
        if (battle.statusEffects.player.thorns > 0 && damage > 0) {
            battle.enemy.hp -= Math.floor(battle.statusEffects.player.thorns);
            battle.enemy.hp = Math.max(0, Math.floor(battle.enemy.hp));
        }
        
        // Кровопускание Берсерка
        if (battle.hasPower('bloodletting') && damage > 0) {
            battle.statusEffects.enemy.bleed = (battle.statusEffects.enemy.bleed || 0) + 1;
        }
    }
    
    enemyDefend(battle) {
        let blockAmount = 10;
        if (battle.enemy.specialAbility === 'rock_armor') blockAmount = 20;
        battle.enemyBlock += blockAmount;
        
        if (battle.enemy.specialAbility === 'root_grasp') {
            battle.statusEffects.player.poison = (battle.statusEffects.player.poison || 0) + 2;
        }
    }
}