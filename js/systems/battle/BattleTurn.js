// Ходы и завершение (с Параличом)
class BattleTurn {
    endTurn(battle, effects) {
        // Эффекты карт и построек могут завершить бой до хода противника.
        if (battle.player.hp <= 0) return { battleEnded: true, victory: false };
        if (battle.enemy.hp <= 0) return { battleEnded: true, victory: true };

        this.advanceSecretBossPhase(battle);

        // ПРОВЕРЯЕМ ПАРАЛИЧ
        const isParalyzed = battle.isEnemyParalyzed();
        
        if (isParalyzed) {
            // Враг пропускает ход
            battle.statusEffects.enemy.paralysis--;
            
            // Пси-вампиризм - лечение при параличе
            // (сработает в начале следующего хода)
        } else {
            // Ход врага
            if (battle.enemyIntent === 'attack') {
                this.enemyAttack(battle);
            } else if (battle.enemyIntent === 'defend') {
                this.enemyDefend(battle);
            }
        }
        
        // Ментальная блокада - шанс паралича
        if (battle.hasPower('mentalBlockade') && Math.random() < 0.5) {
            battle.statusEffects.enemy.paralysis = (battle.statusEffects.enemy.paralysis || 0) + 1;
        }
        
        // Абсолютный контроль - враг пропускает каждый 2-й ход
        if (battle.hasPower('absoluteControl') && battle.turn % 2 === 1) {
            // Уже парализован
        }
        
        // Ментальный шторм - урон всем врагам
        if (battle.hasPower('mentalStorm')) {
            battle.enemy.hp -= 3;
            battle.enemy.hp = Math.max(0, battle.enemy.hp);
        }
        
        // Кровотечение врага
        if (battle.statusEffects.enemy.bleed > 0) {
            battle.enemy.hp -= Math.floor(battle.statusEffects.enemy.bleed);
            battle.enemy.hp = Math.max(0, Math.floor(battle.enemy.hp));
            battle.statusEffects.enemy.bleed--;
        }
        
        // Яд игрока
        if (battle.statusEffects.player.poison > 0) {
            battle.takeDamage(Math.floor(battle.statusEffects.player.poison));
            battle.statusEffects.player.poison--;
        }
        
        // Сброс руки
        battle.discardPile.push(...battle.hand);
        battle.hand = [];
        
        effects.decreaseStatusEffects(battle);
        
        // Сначала разрешаем спасение игрока: одновременная гибель не даёт
        // победу мёртвому герою без срабатывания защитных эффектов.
        if (battle.player.hp <= 0) {
            // Ментальное бессмертие
            if (battle.hasPower('mentalImmortality')) {
                battle.player.hp = 1;
                battle.statusEffects.enemy.paralysis = (battle.statusEffects.enemy.paralysis || 0) + 1;
                battle.player.relics = battle.player.relics.filter(r => r !== 'mentalImmortality');
            } else if (battle.hasPower('secondLife')) {
                battle.player.hp = 10;
                battle.player.relics = battle.player.relics.filter(r => r !== 'secondLife');
            } else {
                return { battleEnded: true, victory: false };
            }
        }
        
        if (battle.enemy.hp <= 0) return { battleEnded: true, victory: true };

        battle.turn++;
        battle.startTurn();
        
        return { battleEnded: false };
    }
    
    advanceSecretBossPhase(battle) {
        const enemy = battle.enemy;
        if (!enemy?.isSecretBoss || enemy.hp <= 0) return false;
        const ratio = enemy.hp / Math.max(1, enemy.maxHp);
        const nextPhase = ratio <= 1 / 3 ? 3 : ratio <= 2 / 3 ? 2 : 1;
        if (nextPhase <= (Number(enemy.phase) || 1)) return false;

        enemy.phase = nextPhase;
        enemy.damage = (Number(enemy.baseDamage) || enemy.damage) +
            ((nextPhase - 1) * (Number(enemy.phaseDamageBonus) || 0));
        enemy.pattern = nextPhase === 2
            ? ['attack', 'defend', 'attack']
            : ['attack', 'attack', 'defend', 'attack'];
        enemy.patternIndex = 0;

        if (nextPhase === 2) {
            battle.enemyBlock += 12;
        } else {
            battle.statusEffects.enemy.strength =
                (Number(battle.statusEffects.enemy.strength) || 0) + 2;
            battle.enemyBlock += 18;
        }
        return true;
    }

    enemyAttack(battle) {
        let damage = Math.floor(battle.enemy.damage + (battle.statusEffects.enemy.strength || 0));
        if (battle.enemy.specialAbility === 'debt_collector' && battle.enemy.phase >= 3) {
            damage = Math.floor(damage * 1.25);
        }

        if (battle.enemy.specialAbility === 'dark_magic' && Math.random() < 0.3) {
            damage = Math.floor(damage * 1.5);
        }
        
        if (battle.statusEffects.player.vulnerable > 0) damage = Math.floor(damage * 1.5);
        if (battle.statusEffects.enemy.weak > 0) damage = Math.floor(damage * 0.75);
        if (battle.hasPower('invulnerability')) damage = Math.max(0, damage - 2);
        
        // Пси-отражение
        if (battle.hasPower('psyReflection') && damage > 0) {
            battle.enemy.hp -= 3;
            battle.enemy.hp = Math.max(0, battle.enemy.hp);
        }
        
        // Отражение может убить атакующего раньше попадания.
        if (battle.enemy.hp <= 0) return;

        const target = this.chooseTarget(battle);
        
        if (target.type === 'building') {
            this.attackBuilding(battle, target.building, damage);
        } else {
            this.attackPlayer(battle, damage);
        }
    }
    
    chooseTarget(battle) {
        if (battle.buildings && battle.buildings.getBuildingCount() > 0) {
            const buildingCount = battle.buildings.getBuildingCount();
            let buildingChance = 0.30 + (buildingCount * 0.15);
            buildingChance = Math.min(0.75, buildingChance);
            
            if (Math.random() < buildingChance) {
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
        if (building.hp <= 0) {
            const index = battle.buildings.buildings.findIndex(b => b.id === building.id);
            if (index !== -1) {
                battle.buildings.buildings.splice(index, 1);
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
        battle.takeDamage(damage);
        
        if (battle.statusEffects.player.thorns > 0 && damage > 0) {
            battle.enemy.hp -= Math.floor(battle.statusEffects.player.thorns);
            battle.enemy.hp = Math.max(0, Math.floor(battle.enemy.hp));
        }
    }
    
    enemyDefend(battle) {
        let blockAmount = 10;
        if (battle.enemy.specialAbility === 'rock_armor') blockAmount = 20;
        if (battle.enemy.specialAbility === 'debt_collector') {
            blockAmount = battle.enemy.phase >= 3 ? 20 : 15;
        }
        battle.enemyBlock += blockAmount;
        
        if (battle.enemy.specialAbility === 'root_grasp') {
            battle.statusEffects.player.poison = (battle.statusEffects.player.poison || 0) + 2;
        }
        if (battle.enemy.specialAbility === 'debt_collector') {
            battle.statusEffects.player.poison = (battle.statusEffects.player.poison || 0) +
                (battle.enemy.phase >= 3 ? 2 : 1);
        }
    }
}