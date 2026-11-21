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
        
        // Бронируем энергию для всей пачки, с учётом порядка розыгрыша
        // и скидок на каждую третью карту.
        const pendingIndices = [...battle.selectedCards, cardIndex];
        if (this.calculateSelectedCost(battle, pendingIndices) > battle.energy) {
            return { success: false, message: 'Недостаточно энергии для выбранных карт!' };
        }

        battle.selectedCards.push(cardIndex);
        const totalPreview = this.calculateTotalPreview(battle);
        
        return { success: true, action: 'selected', preview: totalPreview };
    }
    
    calculateCardCost(battle, card, playNumber) {
        let cost = Math.max(0, Number(card.cost) || 0);
        if (battle.hasPower('economy') && playNumber % 3 === 0) cost = 0;
        if (battle.hasPower('titanRage') && card.type === CARD_TYPES.ATTACK) {
            cost = Math.max(0, cost - 1);
        }
        if (card.id === 'bloodSmell' &&
            battle.hand.some(held => held !== card && held.type === CARD_TYPES.ATTACK)) {
            cost = Math.max(0, cost - 1);
        }
        if (battle.berserkAttackDiscountActive && card.type === CARD_TYPES.ATTACK) {
            cost = Math.max(0, cost - 1);
        }
        return cost;
    }

    drawCardsForPlayedCard(battle, card, count) {
        const cardIndex = battle.hand.indexOf(card);
        if (cardIndex === -1) {
            const before = battle.hand.length;
            battle.drawCards(count);
            return battle.hand.slice(before);
        }

        // Resolve the hand-cap check as if the played card had already left
        // the hand, then restore it at its original index for playCard cleanup.
        const [playedCard] = battle.hand.splice(cardIndex, 1);
        const before = battle.hand.length;
        battle.drawCards(count);
        const drawn = battle.hand.slice(before);
        battle.hand.splice(cardIndex, 0, playedCard);
        return drawn;
    }

    calculateSelectedCost(battle, indices) {
        // playSelectedCards разыгрывает индексы по убыванию, чтобы splice
        // не сдвигал ещё не разыгранные позиции.
        return [...indices].sort((a, b) => b - a).reduce((sum, index, offset) => {
            const card = battle.hand[index];
            if (!card) return sum;
            return sum + this.calculateCardCost(battle, card, battle.cardsPlayedThisTurn + offset + 1);
        }, 0);
    }

    calculateTotalPreview(battle) {
        const total = {
            damage: 0, block: 0, heal: 0, selfDamage: 0,
            bleed: 0, vulnerable: 0, weak: 0, draw: 0, fire: 0,
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
            total.fire += preview.fire;
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
        if (total.fire > 0) parts.push(`🔥 Огонь: ${total.fire}`);
        if (total.paralysis > 0) parts.push(`🔒 Паралич: ${total.paralysis}`);
        if (total.echo > 0) parts.push(`🔁 Эхо: ${total.echo}`);
        
        total.description = parts.join(' | ');
        return total;
    }
    
    calculateCardPreview(battle, card) {
        const preview = {
            damage: 0, block: 0, heal: 0, selfDamage: 0,
            bleed: 0, vulnerable: 0, weak: 0, draw: 0,
            strength: 0, paralysis: 0, echo: 0, fire: 0
        };

        const buildingCount = battle.buildings?.getBuildingCount?.() || 0;
        let baseDamage = Number(card.damage) || 0;
        let directBonus = 0;
        if (card.id === 'kamikazeDrone') {
            const target = battle.buildings?.buildings?.slice()
                .sort((a, b) => b.hp - a.hp)[0];
            baseDamage = target ? Math.min(15, Math.max(0, target.hp)) : 0;
            if (target && battle.hasPower('systemOverload')) directBonus += 3;
        }
        if (card.id === 'massOverload') {
            baseDamage = buildingCount * 6;
            if (battle.hasPower('systemOverload')) directBonus += buildingCount * 3;
        }

        if (directBonus >= Math.max(0, Number(battle.enemy?.hp) || 0)) {
            baseDamage = 0;
        }
        if (baseDamage > 0) {
            let damage = baseDamage + (battle.statusEffects.player.strength || 0);

            // Engineer attacks scale with the number of active constructions.
            if ((card.id === 'wrench' || card.id === 'bolt') && buildingCount > 0) damage += 3;
            if (card.id === 'overload') damage += buildingCount * 2;

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
            preview.damage = damage + directBonus;
        } else if (directBonus > 0) {
            preview.damage = directBonus;
        }
        
        if (card.block) {
            preview.block = card.block + (battle.statusEffects.player.dexterity || 0);
            if (card.id === 'energyShield' && battle.buildings?.getBuildingCount?.() > 0) {
                preview.block += 4;
            }
        }
        
        if (card.heal) preview.heal = card.heal;
        if (card.selfDamage) preview.selfDamage = card.selfDamage;
        if (card.bleed) preview.bleed = card.bleed;
        if (card.vulnerable) preview.vulnerable = card.vulnerable;
        if (card.weak) preview.weak = card.weak;
        if (card.fire) preview.fire = card.fire;
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
        
        // Route every card through BattleSystem.playCard, including its
        // after-play effects (adaptation, onslaught, versatility and relics).
        let scryedCards = null;
        for (const cardIndex of sortedIndices) {
            if (!battle.hand[cardIndex]) continue;
            const result = battle.playCard(cardIndex);
            if (result.scryedCards) scryedCards = result.scryedCards;
            if (!result.success) {
                battle.selectedCards = [];
                return result;
            }
            // Stop resolving queued cards as soon as either side is defeated.
            if ((battle.player && battle.player.hp <= 0) || (battle.enemy && battle.enemy.hp <= 0)) break;
        }

        battle.selectedCards = [];
        return { success: true, scryedCards };
    }
    
    playCard(battle, cardIndex) {
        const card = battle.hand[cardIndex];
        if (!card) return { success: false, message: 'Карта не найдена' };

        const cardCost = this.calculateCardCost(battle, card, battle.cardsPlayedThisTurn + 1);

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
        
        // Разыгрываем карту playCount раз. Повторения прекращаются сразу,
        // когда одно из срабатываний завершает бой.
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
            if (battle.player.hp <= 0 || battle.enemy.hp <= 0) break;
        }

        let battleStillActive = battle.player.hp > 0 && battle.enemy.hp > 0;
        // Пси-резонанс - навык наносит урон. Этот урон тоже может завершить бой.
        if (battleStillActive && card.type === CARD_TYPES.SKILL && battle.hasPower('psyResonance')) {
            battle.enemy.hp -= 1;
            battle.enemy.hp = Math.max(0, battle.enemy.hp);
        }
        battleStillActive = battle.player.hp > 0 && battle.enemy.hp > 0;

        let scryedCards = null;
        // Дополнительные эффекты карты не должны менять состояние после исхода боя.
        if (battleStillActive) {

            // Устанавливаем эхо от карты
            if (card.echo) {
                battle.echoStacks += card.echo;
            }
            if (card.echoSkill) {
                battle.echoSkillStacks += card.echoSkill;
            }

            // Предвидение activates only when the card is actually played.
            scryedCards = card.scry
                ? battle.scry(card.scry)
                : card.id === 'telepathicLink' ? battle.scry(3) : null;

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
                battle.stealEnemyCard(card);
            }
        }
        
        const playedCard = battle.hand.splice(cardIndex, 1)[0];
        
        if (playedCard.exhaust) {
            battle.exhaustPile.push(playedCard);
        } else {
            battle.discardPile.push(playedCard);
        }
        
        return { success: true, scryedCards };
    }
    
    dealDamage(battle, card) {
        const buildingCount = battle.buildings?.getBuildingCount?.() || 0;
        let baseDamage = Number(card.damage) || 0;

        // Berserker conditional attacks use the exact same live state as their
        // card text: health thresholds and current enemy bleed/health.
        if (card.id === 'retaliationStrike' && battle.isBerserkWounded()) baseDamage = 12;
        if (card.id === 'cutWound' && (battle.statusEffects.enemy.bleed || 0) > 0) baseDamage = 8;
        if (card.id === 'mercyStrike' && (battle.statusEffects.enemy.bleed || 0) >= 10) baseDamage = 14;
        if (card.id === 'execution' &&
            battle.enemy.hp < battle.enemy.maxHp * 0.30) baseDamage = 30;

        if (card.id === 'kamikazeDrone' && buildingCount > 0) {
            const target = battle.buildings.buildings.slice().sort((a, b) => b.hp - a.hp)[0];
            baseDamage = Math.min(15, Math.max(0, Number(target.hp) || 0));
            battle.buildings.demolishBuilding(battle, target.id);
        } else if (card.id === 'massOverload' && buildingCount > 0) {
            const destroyed = battle.buildings.demolishAll(battle);
            baseDamage = destroyed * 6;
        }

        // Destroyer strips the enemy's entire block before dealing its hit.
        if (card.id === 'destroyer') battle.enemyBlock = 0;

        // A construction's overload can end the encounter before the attack resolves.
        if (battle.enemy.hp <= 0) return;

        let damage = Math.floor(baseDamage + (battle.statusEffects.player.strength || 0));

        // Keep runtime damage identical to the card preview for Engineer synergies.
        if ((card.id === 'wrench' || card.id === 'bolt') && buildingCount > 0) damage += 3;
        if (card.id === 'overload') damage += buildingCount * 2;

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
        const enemyHpBefore = Math.max(0, Number(battle.enemy.hp) || 0);
        const actualDamage = Math.min(enemyHpBefore, totalDamage);
        battle.enemy.hp -= totalDamage;
        battle.enemy.hp = Math.max(0, Math.floor(battle.enemy.hp));

        if (card.id === 'beheading' && enemyHpBefore > 0 && battle.enemy.hp <= 0) {
            battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + 8);
        }

        if (actualDamage > 0 && battle.hasPower('vampirism') &&
            battle.vampirismTriggersThisTurn < 3) {
            battle.vampirismTriggersThisTurn++;
            battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + 1);
        }
        
        // Паралич от карты
        if (card.paralysis) {
            battle.statusEffects.enemy.paralysis = (battle.statusEffects.enemy.paralysis || 0) + card.paralysis;
        }
        
        // Астральный клинок - даёт эхо
        if (card.id === 'astralBlade') {
            battle.echoStacks += 1;
        }
        
        if (card.bleed) battle.statusEffects.enemy.bleed = (battle.statusEffects.enemy.bleed || 0) + card.bleed;
        if (card.fire && battle.enemy.hp > 0) {
            battle.statusEffects.enemy.fire = (battle.statusEffects.enemy.fire || 0) + card.fire;
        }
        if (card.vulnerable) battle.statusEffects.enemy.vulnerable = (battle.statusEffects.enemy.vulnerable || 0) + card.vulnerable;
        if (card.weak) battle.statusEffects.enemy.weak = (battle.statusEffects.enemy.weak || 0) + card.weak;
        if (card.selfDamage) battle.takeSelfDamage(card.selfDamage);
        if (card.heal) battle.player.hp = Math.min(battle.player.maxHp, Math.floor(battle.player.hp + card.heal));
        if (card.draw) this.drawCardsForPlayedCard(battle, card, card.draw);
    }
    
    applySkill(battle, card) {
        if (card.id === 'madDash') battle.berserkAttackDiscountNextTurn = true;
        if (card.block) {
            let baseBlock = Number(card.block) || 0;
            if (card.id === 'berserkStance' && battle.isBerserkWounded()) baseBlock = 20;
            if (card.id === 'spiritFortification' && battle.isBerserkWounded()) baseBlock = 14;
            if (card.id === 'lastStand' && battle.player.hp < battle.player.maxHp * 0.25) baseBlock = 30;
            if (card.id === 'finalBattle' && battle.player.hp < battle.player.maxHp * 0.20) baseBlock = 35;
            let blockAmount = baseBlock + (battle.statusEffects.player.dexterity || 0);
            if (card.id === 'energyShield' && battle.buildings?.getBuildingCount() > 0) {
                blockAmount += 4;
            }
            battle.block += Math.floor(blockAmount);
        }

        const buildings = battle.buildings;
        if (card.id === 'lubricant') battle.engineerLubricantNextTurn = true;
        const mostDamaged = () => buildings?.buildings
            .slice()
            .sort((a, b) => (a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp)))[0] || null;

        // Engineer skill effects operate on the active construction field.
        if (card.id === 'repair') {
            const target = mostDamaged();
            if (target) target.hp = Math.min(target.maxHp, target.hp + 3);
        }
        if (card.id === 'reinforcement') {
            const target = mostDamaged();
            if (target) target.block += 4;
        }
        if (card.id === 'blueprints') {
            this.drawCardsForPlayedCard(battle, card, 2);
            for (const held of battle.hand) {
                if (held.type === CARD_TYPES.BUILDING) held.cost = Math.max(0, (Number(held.cost) || 0) - 1);
            }
        }
        if (card.id === 'quickAssembly') {
            const drawn = this.drawCardsForPlayedCard(battle, card, 1);
            for (const held of drawn) {
                if (held.type === CARD_TYPES.BUILDING) held.cost = 0;
            }
        }
        if (card.id === 'repairDrone' || card.id === 'nanobots') {
            const repairAmount = card.id === 'repairDrone' ? 5 : 2;
            for (const building of buildings?.buildings || []) {
                building.hp = Math.min(building.maxHp, building.hp + repairAmount);
            }
        }
        if (card.id === 'evacuation' && buildings?.buildings.length > 0 &&
            battle.hand.length <= GAME_CONFIG.maxHandSize) {
            const target = mostDamaged();
            const index = buildings.buildings.indexOf(target);
            if (index !== -1) {
                buildings.buildings.splice(index, 1);
                const original = ENGINEER_CARDS[target.cardId];
                battle.hand.push(original ? { ...original } : {
                    id: target.cardId, name: target.name, type: CARD_TYPES.BUILDING,
                    cost: target.cost, hp: target.maxHp, damage: target.damage,
                    block: target.block, emoji: target.emoji
                });
                battle.energy += Math.max(0, Number(target.cost) || 0);
            }
        }
        if (card.id === 'modernization') {
            for (const building of buildings?.buildings || []) {
                if (building.damage > 0) building.damage += 2;
                else building.block += 3;
                building.upgraded = true;
            }
        }
        if (card.id === 'factoryReset' && buildings) {
            const demolished = buildings.demolishAll(battle);
            if (battle.enemy.hp <= 0) return;
            battle.energy += demolished;
            this.drawCardsForPlayedCard(battle, card, demolished);
        }
        if (card.id === 'engineeringGenius') {
            this.drawCardsForPlayedCard(battle, card, 3);
            for (const held of battle.hand) {
                if (held.type === CARD_TYPES.BUILDING) held.cost = 0;
            }
        }

        // Паралич от навыка
        if (card.paralysis) {
            battle.statusEffects.enemy.paralysis = (battle.statusEffects.enemy.paralysis || 0) + card.paralysis;
        }

        if (card.heal) battle.player.hp = Math.min(battle.player.maxHp, Math.floor(battle.player.hp + card.heal));
        if (card.draw && !['quickAssembly', 'engineeringGenius', 'blueprints'].includes(card.id)) {
            this.drawCardsForPlayedCard(battle, card, card.draw);
        }
        if (card.bleed) {
            const bleedAmount = card.id === 'freshWound' && battle.isBerserkWounded()
                ? 8
                : card.bleed;
            battle.statusEffects.enemy.bleed = (battle.statusEffects.enemy.bleed || 0) + bleedAmount;
        }
        if (card.selfDamage) battle.takeSelfDamage(card.selfDamage);
        if (card.id === 'bloodSacrifice' && battle.player.hp > 0) {
            battle.statusEffects.player.strength = (battle.statusEffects.player.strength || 0) * 2;
        }
        if (card.weak) battle.statusEffects.enemy.weak = (battle.statusEffects.enemy.weak || 0) + card.weak;
        if (card.vulnerable) battle.statusEffects.enemy.vulnerable = (battle.statusEffects.enemy.vulnerable || 0) + card.vulnerable;
    }
    
    applyPower(battle, card) {
        if (card.id === 'reserve' && typeof ENGINEER_CARDS !== 'undefined' &&
            ENGINEER_CARDS.smallTurret && battle.hand.length <= GAME_CONFIG.maxHandSize) {
            battle.hand.push({ ...ENGINEER_CARDS.smallTurret });
        }
        if (card.id === 'jetpack') battle.energy += 1;
        if (card.id === 'berserkMode') {
            battle.statusEffects.player.strength = (battle.statusEffects.player.strength || 0) + 2;
        }
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