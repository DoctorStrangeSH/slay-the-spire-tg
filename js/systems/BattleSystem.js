// Боевая система
class BattleSystem {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.turn = 1;
        this.energy = GAME_CONFIG.baseEnergy;
        this.maxEnergy = GAME_CONFIG.maxEnergy;
        this.block = 0;
        this.enemyBlock = 0;
        this.hand = [];
        this.drawPile = [];
        this.discardPile = [];
        this.exhaustPile = [];
        this.selectedCards = []; // Выбранные карты для розыгрыша
        
        // Механики Берсерка
        this.damageTakenThisTurn = 0;
        this.cardsPlayedThisTurn = 0;
        this.damageTakenLastTurn = 0;
        
        this.statusEffects = {
            player: { 
                strength: 0, 
                vulnerable: 0, 
                weak: 0,
                poison: 0,
                thorns: 0,
                bleed: 0
            },
            enemy: { 
                strength: 0, 
                vulnerable: 0, 
                weak: 0,
                poison: 0,
                thorns: 0,
                bleed: 0
            }
        };
        
        this.initializeDeck();
        this.startTurn();
    }
    
    initializeDeck() {
        this.drawPile = this.player.deck.map(card => ({...card}));
        this.shuffle(this.drawPile);
        this.discardPile = [];
        this.hand = [];
        this.exhaustPile = [];
    }
    
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    startTurn() {
        this.energy = this.maxEnergy;
        this.block = 0;
        this.damageTakenThisTurn = 0;
        this.cardsPlayedThisTurn = 0;
        this.drawCards(5);
        this.enemyIntent = this.getEnemyIntent();
        
        // Эффекты Берсерка в начале хода
        this.applyBerserkStartTurnEffects();
    }
    
    applyBerserkStartTurnEffects() {
        // Жажда убийства - если HP < 50%, получите 1 Силу
        if (this.hasPower('killThirst') && this.isBerserkWounded()) {
            this.statusEffects.player.strength += 1;
        }
        
        // Путь боли - теряете 1 HP, получаете 1 Силу
        if (this.hasPower('painPath')) {
            this.player.hp -= 1;
            this.player.hp = Math.max(0, Math.floor(this.player.hp));
            this.statusEffects.player.strength += 1;
        }
        
        // Пульс битвы - если HP < 25%, лечите 3 HP
        if (this.hasPower('battlePulse') && this.player.hp < this.player.maxHp * 0.25) {
            this.player.hp = Math.min(this.player.maxHp, Math.floor(this.player.hp + 3));
        }
        
        // Кровавая аура - если HP < 50%, накладывает 2 Кровотечения
        if (this.hasPower('bloodAura') && this.isBerserkWounded()) {
            this.statusEffects.enemy.bleed += 2;
        }
        
        // Кровавый завет
        if (this.hasPower('bloodCovenant')) {
            if (this.isBerserkWounded()) {
                this.player.hp -= 1;
                this.statusEffects.player.strength += 2;
            } else {
                this.player.hp -= 2;
                this.statusEffects.player.strength += 1;
            }
            this.player.hp = Math.max(0, Math.floor(this.player.hp));
        }
        
        // Ярость титана - получаете 2 урона
        if (this.hasPower('titanRage')) {
            this.player.hp -= 2;
            this.player.hp = Math.max(0, Math.floor(this.player.hp));
        }
        
        // Звериная шкура - блок от урона в прошлом ходу
        if (this.hasPower('beastSkin') && this.damageTakenLastTurn > 0) {
            this.block += this.damageTakenLastTurn;
        }
        
        // Шрамы - блок от урона
        if (this.hasPower('scars') && this.damageTakenLastTurn > 0) {
            this.block += 1;
        }
    }
    
    hasPower(powerId) {
        return this.player.relics?.includes(powerId) || false;
    }
    
    isBerserkWounded() {
        return this.player.hp < this.player.maxHp / 2;
    }
    
    drawCards(count) {
        for (let i = 0; i < count; i++) {
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) break;
                this.drawPile = [...this.discardPile];
                this.discardPile = [];
                this.shuffle(this.drawPile);
            }
            
            if (this.hand.length >= GAME_CONFIG.maxHandSize) break;
            
            const card = this.drawPile.pop();
            this.hand.push(card);
        }
    }
    
    getEnemyIntent() {
        const pattern = this.enemy.pattern;
        const intent = pattern[this.enemy.patternIndex % pattern.length];
        this.enemy.patternIndex++;
        return intent;
    }
    
    // Выбор карты
    selectCard(cardIndex) {
        const card = this.hand[cardIndex];
        if (!card) return { success: false, message: 'Карта не найдена' };
        
        // Проверяем, не выбрана ли уже карта
        const selectedIndex = this.selectedCards.indexOf(cardIndex);
        if (selectedIndex !== -1) {
            // Отменяем выбор
            this.selectedCards.splice(selectedIndex, 1);
            const totalPreview = this.calculateTotalPreview();
            return { success: true, action: 'deselected', preview: totalPreview };
        }
        
        // Проверяем энергию
        if (card.cost > this.energy) {
            return { success: false, message: 'Недостаточно энергии!' };
        }
        
        // Проверяем общую стоимость выбранных карт + эту карту
        const totalCost = this.selectedCards.reduce((sum, idx) => sum + this.hand[idx].cost, 0) + card.cost;
        if (totalCost > this.energy) {
            return { success: false, message: 'Недостаточно энергии для всех выбранных карт!' };
        }
        
        // Добавляем в выбранные
        this.selectedCards.push(cardIndex);
        
        // Рассчитываем суммарное превью
        const totalPreview = this.calculateTotalPreview();
        
        return { 
            success: true, 
            action: 'selected',
            preview: totalPreview
        };
    }
    
    // Суммарное превью всех выбранных карт
    calculateTotalPreview() {
        const total = {
            damage: 0,
            block: 0,
            heal: 0,
            selfDamage: 0,
            bleed: 0,
            vulnerable: 0,
            weak: 0,
            draw: 0,
            energy: 0,
            strength: 0,
            thorns: 0,
            description: ''
        };
        
        // Суммируем эффекты всех выбранных карт
        this.selectedCards.forEach(cardIndex => {
            const card = this.hand[cardIndex];
            if (!card) return;
            
            const preview = this.calculateCardPreview(card);
            
            total.damage += preview.damage || 0;
            total.block += preview.block || 0;
            total.heal += preview.heal || 0;
            total.selfDamage += preview.selfDamage || 0;
            total.bleed += preview.bleed || 0;
            total.vulnerable += preview.vulnerable || 0;
            total.weak += preview.weak || 0;
            total.draw += preview.draw || 0;
            total.energy += preview.energy || 0;
            total.strength += preview.strength || 0;
            total.thorns += preview.thorns || 0;
        });
        
        // Формируем описание
        const parts = [];
        if (total.damage > 0) parts.push(`⚔️ Урон: ${total.damage}`);
        if (total.block > 0) parts.push(`🛡️ Блок: ${total.block}`);
        if (total.heal > 0) parts.push(`💚 Лечение: ${total.heal}`);
        if (total.selfDamage > 0) parts.push(`💔 Самоповреждение: ${total.selfDamage}`);
        if (total.bleed > 0) parts.push(`🩸 Кровотечение: ${total.bleed}`);
        if (total.vulnerable > 0) parts.push(`🎯 Уязвимость: ${total.vulnerable}`);
        if (total.weak > 0) parts.push(`📉 Слабость: ${total.weak}`);
        if (total.draw > 0) parts.push(`🃏 Добор: ${total.draw}`);
        if (total.energy > 0) parts.push(`⚡ Энергия: +${total.energy}`);
        if (total.strength > 0) parts.push(`💪 Сила: +${total.strength}`);
        if (total.thorns > 0) parts.push(`🌵 Шипы: +${total.thorns}`);
        
        total.description = parts.join(' | ');
        
        return total;
    }
    
    // Расчёт превью эффекта одной карты
    calculateCardPreview(card) {
        const preview = {
            damage: 0,
            block: 0,
            heal: 0,
            selfDamage: 0,
            bleed: 0,
            vulnerable: 0,
            weak: 0,
            draw: 0,
            energy: 0,
            strength: 0,
            thorns: 0
        };
        
        // Расчёт урона
        if (card.damage) {
            let damage = card.damage + this.statusEffects.player.strength;
            
            // Специальные условия карт
            switch(card.id) {
                case 'retaliationStrike':
                    if (this.isBerserkWounded()) damage = 12;
                    break;
                case 'cutWound':
                    if (this.statusEffects.enemy.bleed > 0) damage = 8;
                    break;
                case 'mercyStrike':
                    if (this.statusEffects.enemy.bleed >= 10) damage = 14;
                    break;
                case 'execution':
                    if (this.enemy.hp < this.enemy.maxHp * 0.3) damage = 30;
                    break;
            }
            
            // Уязвимость врага
            if (this.statusEffects.enemy.vulnerable > 0) {
                damage = Math.floor(damage * 1.5);
            }
            
            // Слабость игрока
            if (this.statusEffects.player.weak > 0) {
                damage = Math.floor(damage * 0.75);
            }
            
            // Несколько ударов
            if (card.hits) {
                damage = damage * card.hits;
            }
            
            preview.damage = damage;
        }
        
        // Расчёт блока
        if (card.block) {
            let block = card.block;
            
            switch(card.id) {
                case 'berserkStance':
                    if (this.isBerserkWounded()) block = 20;
                    break;
                case 'spiritFortification':
                    if (this.isBerserkWounded()) block = 14;
                    break;
                case 'lastStand':
                    if (this.player.hp < this.player.maxHp * 0.25) {
                        block = 30;
                    } else {
                        block = 15;
                    }
                    break;
                case 'finalBattle':
                    if (this.player.hp < this.player.maxHp * 0.2) {
                        block = 35;
                    } else {
                        block = 20;
                    }
                    break;
            }
            
            preview.block = block;
        }
        
        // Самоповреждение
        if (card.selfDamage) {
            let selfDamage = card.selfDamage;
            
            // Последний рубеж - нет урона если HP < 25%
            if (card.id === 'lastStand' && this.player.hp < this.player.maxHp * 0.25) {
                selfDamage = 0;
            }
            
            // Последний бой - нет урона если HP < 20%
            if (card.id === 'finalBattle' && this.player.hp < this.player.maxHp * 0.2) {
                selfDamage = 0;
            }
            
            preview.selfDamage = selfDamage;
        }
        
        // Лечение
        if (card.heal) {
            preview.heal = card.heal;
        }
        
        // Кровотечение
        if (card.bleed) {
            let bleed = card.bleed;
            
            // Свежая рана - если HP < 50%, накладывает 8
            if (card.id === 'freshWound' && this.isBerserkWounded()) {
                bleed = 8;
            }
            
            preview.bleed = bleed;
        }
        
        // Уязвимость
        if (card.vulnerable) {
            preview.vulnerable = card.vulnerable;
        }
        
        // Слабость
        if (card.weak) {
            preview.weak = card.weak;
        }
        
        // Добор карт
        if (card.draw) {
            preview.draw = card.draw;
        }
        
        // Энергия
        if (card.energy) {
            preview.energy = card.energy;
        }
        
        // Сила
        if (card.strength) {
            preview.strength = card.strength;
        }
        
        // Шипы
        if (card.thorns) {
            preview.thorns = card.thorns;
        }
        
        return preview;
    }
    
    // Розыгрыш выбранных карт
    playSelectedCards() {
        if (this.selectedCards.length === 0) return { success: false, message: 'Выберите карты!' };
        
        // Сортируем индексы в обратном порядке для правильного удаления
        const sortedIndices = [...this.selectedCards].sort((a, b) => b - a);
        
        sortedIndices.forEach(cardIndex => {
            const card = this.hand[cardIndex];
            if (card) {
                this.playCard(cardIndex);
            }
        });
        
        // Очищаем выбранные карты
        this.selectedCards = [];
        
        return { success: true };
    }
    
    // Розыгрыш одной карты
    playCard(cardIndex) {
        const card = this.hand[cardIndex];
        
        if (card.cost > this.energy) {
            return { success: false, message: 'Недостаточно энергии!' };
        }
        
        this.energy -= card.cost;
        this.cardsPlayedThisTurn++;
        
        switch (card.type) {
            case CARD_TYPES.ATTACK:
                this.dealDamage(card);
                break;
            case CARD_TYPES.SKILL:
                this.applySkill(card);
                break;
            case CARD_TYPES.POWER:
                this.applyPower(card);
                break;
        }
        
        const playedCard = this.hand.splice(cardIndex, 1)[0];
        
        if (playedCard.exhaust) {
            this.exhaustPile.push(playedCard);
        } else {
            this.discardPile.push(playedCard);
        }
        
        return { success: true };
    }
    
    dealDamage(card) {
        let damage = Math.floor(card.damage + this.statusEffects.player.strength);
        
        // Специальные условия карт
        switch(card.id) {
            case 'retaliationStrike':
                if (this.isBerserkWounded()) damage = 12;
                break;
            case 'cutWound':
                if (this.statusEffects.enemy.bleed > 0) damage = 8;
                break;
            case 'mercyStrike':
                if (this.statusEffects.enemy.bleed >= 10) damage = 14;
                break;
            case 'execution':
                if (this.enemy.hp < this.enemy.maxHp * 0.3) damage = 30;
                break;
        }
        
        // Уязвимость врага
        if (this.statusEffects.enemy.vulnerable > 0) {
            damage = Math.floor(damage * 1.5);
        }
        
        // Слабость игрока
        if (this.statusEffects.player.weak > 0) {
            damage = Math.floor(damage * 0.75);
        }
        
        // Несколько ударов
        let hits = card.hits || 1;
        let totalDamage = 0;
        
        for (let i = 0; i < hits; i++) {
            totalDamage += damage;
        }
        
        // Блок врага
        if (this.enemyBlock > 0) {
            const blocked = Math.min(this.enemyBlock, totalDamage);
            this.enemyBlock -= blocked;
            totalDamage -= blocked;
        }
        
        totalDamage = Math.max(0, Math.floor(totalDamage));
        this.enemy.hp -= totalDamage;
        this.enemy.hp = Math.max(0, Math.floor(this.enemy.hp));
        
        // Кровотечение от карты
        if (card.bleed) {
            let bleedAmount = card.bleed;
            if (card.id === 'freshWound' && this.isBerserkWounded()) {
                bleedAmount = 8;
            }
            this.statusEffects.enemy.bleed += bleedAmount;
        }
        
        // Уязвимость от карты
        if (card.vulnerable) {
            this.statusEffects.enemy.vulnerable += card.vulnerable;
        }
        
        // Слабость от карты
        if (card.weak) {
            this.statusEffects.enemy.weak += card.weak;
        }
        
        // Самоурон
        if (card.selfDamage) {
            let selfDamage = card.selfDamage;
            if (card.id === 'lastStand' && this.player.hp < this.player.maxHp * 0.25) {
                selfDamage = 0;
            }
            if (card.id === 'finalBattle' && this.player.hp < this.player.maxHp * 0.2) {
                selfDamage = 0;
            }
            this.takeSelfDamage(selfDamage);
        }
        
        // Лечение от карты (вампиризм)
        if (card.heal) {
            this.player.hp = Math.min(this.player.maxHp, Math.floor(this.player.hp + card.heal));
        }
        
        // Кровавая река - при розыгрыше Атаки накладывает Кровотечение
        if (this.hasPower('bloodRiver')) {
            this.statusEffects.enemy.bleed += 1;
        }
    }
    
    takeSelfDamage(damage) {
        this.player.hp -= damage;
        this.player.hp = Math.max(0, Math.floor(this.player.hp));
        this.damageTakenThisTurn += damage;
        
        // Боль - это сила
        if (this.hasPower('painIsPower')) {
            this.statusEffects.player.strength += 1;
        }
        
        // Безумие боя
        if (this.hasPower('battleMadness') && this.damageTakenThisTurn <= damage * 2) {
            this.drawCards(1);
        }
        
        // Кровопускание
        if (this.hasPower('bloodletting')) {
            this.statusEffects.enemy.bleed += 1;
        }
    }
    
    applySkill(card) {
        if (card.block) {
            let blockAmount = card.block;
            
            switch(card.id) {
                case 'berserkStance':
                    if (this.isBerserkWounded()) blockAmount = 20;
                    break;
                case 'spiritFortification':
                    if (this.isBerserkWounded()) blockAmount = 14;
                    break;
                case 'lastStand':
                    if (this.player.hp < this.player.maxHp * 0.25) {
                        blockAmount = 30;
                    } else {
                        blockAmount = 15;
                    }
                    break;
                case 'finalBattle':
                    if (this.player.hp < this.player.maxHp * 0.2) {
                        blockAmount = 35;
                    } else {
                        blockAmount = 20;
                    }
                    break;
            }
            
            this.block += Math.floor(blockAmount);
        }
        
        if (card.heal) {
            this.player.hp = Math.min(this.player.maxHp, Math.floor(this.player.hp + card.heal));
        }
        
        if (card.draw) {
            this.drawCards(card.draw);
        }
        
        if (card.bleed) {
            let bleedAmount = card.bleed;
            if (card.id === 'freshWound' && this.isBerserkWounded()) {
                bleedAmount = 8;
            }
            this.statusEffects.enemy.bleed += bleedAmount;
        }
        
        if (card.selfDamage) {
            let selfDamage = card.selfDamage;
            if (card.id === 'lastStand' && this.player.hp < this.player.maxHp * 0.25) {
                selfDamage = 0;
            }
            if (card.id === 'finalBattle' && this.player.hp < this.player.maxHp * 0.2) {
                selfDamage = 0;
            }
            this.takeSelfDamage(selfDamage);
        }
        
        if (card.energy) {
            this.energy += card.energy;
        }
        
        if (card.weak) {
            this.statusEffects.enemy.weak += card.weak;
        }
        
        if (card.vulnerable) {
            this.statusEffects.enemy.vulnerable += card.vulnerable;
        }
    }
    
    applyPower(card) {
        if (card.strength) {
            this.statusEffects.player.strength += Math.floor(card.strength);
        }
        if (card.thorns) {
            this.statusEffects.player.thorns += Math.floor(card.thorns);
        }
        
        if (!this.player.relics) {
            this.player.relics = [];
        }
        if (!this.player.relics.includes(card.id)) {
            this.player.relics.push(card.id);
        }
    }
    
    endTurn() {
        // Ход врага
        if (this.enemyIntent === 'attack') {
            let damage = Math.floor(this.enemy.damage + this.statusEffects.enemy.strength);
            
            if (this.enemy.specialAbility === 'dark_magic' && Math.random() < 0.3) {
                damage = Math.floor(damage * 1.5);
            }
            
            if (this.statusEffects.player.vulnerable > 0) {
                damage = Math.floor(damage * 1.5);
            }
            
            if (this.statusEffects.enemy.weak > 0) {
                damage = Math.floor(damage * 0.75);
            }
            
            // Неуязвимость
            if (this.hasPower('invulnerability')) {
                damage = Math.max(0, damage - 2);
            }
            
            if (this.block > 0) {
                const blocked = Math.min(this.block, damage);
                this.block -= blocked;
                damage -= blocked;
            }
            
            damage = Math.max(0, Math.floor(damage));
            this.player.hp -= damage;
            this.player.hp = Math.max(0, Math.floor(this.player.hp));
            this.damageTakenLastTurn = damage;
            
            if (this.statusEffects.player.thorns > 0 && damage > 0) {
                const thornDamage = Math.floor(this.statusEffects.player.thorns);
                this.enemy.hp -= thornDamage;
                this.enemy.hp = Math.max(0, Math.floor(this.enemy.hp));
            }
        } else if (this.enemyIntent === 'defend') {
            let blockAmount = Math.floor(10);
            
            if (this.enemy.specialAbility === 'rock_armor') {
                blockAmount = Math.floor(blockAmount * 2);
            }
            
            this.enemyBlock += blockAmount;
            
            if (this.enemy.specialAbility === 'root_grasp') {
                this.statusEffects.player.poison += 2;
            }
            this.damageTakenLastTurn = 0;
        }
        
        // Кровотечение врага
        if (this.statusEffects.enemy.bleed > 0) {
            const bleedDamage = Math.floor(this.statusEffects.enemy.bleed);
            this.enemy.hp -= bleedDamage;
            this.enemy.hp = Math.max(0, Math.floor(this.enemy.hp));
            
            if (this.hasPower('bloodthirst')) {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
            }
            
            if (this.hasPower('bloodSeal')) {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
            }
            
            this.statusEffects.enemy.bleed--;
        }
        
        // Яд для игрока
        if (this.statusEffects.player.poison > 0) {
            const poisonDamage = Math.floor(this.statusEffects.player.poison);
            this.player.hp -= poisonDamage;
            this.player.hp = Math.max(0, Math.floor(this.player.hp));
            this.statusEffects.player.poison--;
        }
        
        // Берсерк-режим
        if (this.hasPower('berserkMode')) {
            const hpLoss = this.hand.length;
            this.player.hp -= hpLoss;
            this.player.hp = Math.max(0, Math.floor(this.player.hp));
        }
        
        // Звериная ярость
        if (this.hasPower('beastRage')) {
            const hpLoss = this.hand.length;
            this.player.hp -= hpLoss;
            this.player.hp = Math.max(0, Math.floor(this.player.hp));
        }
        
        // Сброс руки
        this.discardPile.push(...this.hand);
        this.hand = [];
        
        this.decreaseStatusEffects();
        
        if (this.enemy.hp <= 0) {
            return { battleEnded: true, victory: true };
        }
        if (this.player.hp <= 0) {
            if (this.hasPower('secondLife')) {
                this.player.hp = 10;
                this.player.relics = this.player.relics.filter(r => r !== 'secondLife');
                alert('Вторая жизнь спасла вас!');
            } else {
                return { battleEnded: true, victory: false };
            }
        }
        
        this.turn++;
        this.startTurn();
        
        return { battleEnded: false };
    }
    
    decreaseStatusEffects() {
        const playerEffects = this.statusEffects.player;
        const enemyEffects = this.statusEffects.enemy;
        
        if (playerEffects.vulnerable > 0) playerEffects.vulnerable--;
        if (playerEffects.weak > 0) playerEffects.weak--;
        if (enemyEffects.vulnerable > 0) enemyEffects.vulnerable--;
        if (enemyEffects.weak > 0) enemyEffects.weak--;
    }
    
    getEnemyIntentInfo() {
        if (this.enemyIntent === 'attack') {
            let damage = Math.floor(this.enemy.damage + this.statusEffects.enemy.strength);
            
            if (this.enemy.specialAbility === 'dark_magic' && Math.random() < 0.3) {
                damage = Math.floor(damage * 1.5);
            }
            
            if (this.statusEffects.player.vulnerable > 0) {
                damage = Math.floor(damage * 1.5);
            }
            
            if (this.statusEffects.enemy.weak > 0) {
                damage = Math.floor(damage * 0.75);
            }
            
            return {
                type: 'attack',
                damage: damage
            };
        } else {
            let blockAmount = 10;
            
            if (this.enemy.specialAbility === 'rock_armor') {
                blockAmount = 20;
            }
            
            return {
                type: 'defend',
                block: blockAmount
            };
        }
    }
    
    getDeckInfo() {
        return {
            drawPile: this.drawPile.length,
            hand: this.hand.length,
            discardPile: this.discardPile.length,
            exhaustPile: this.exhaustPile.length
        };
    }
    
    viewDrawPile() {
        return this.drawPile.map(card => ({
            name: card.name,
            type: card.type,
            cost: card.cost,
            description: card.description,
            emoji: card.emoji
        }));
    }
    
    viewDiscardPile() {
        return this.discardPile.map(card => ({
            name: card.name,
            type: card.type,
            cost: card.cost,
            description: card.description,
            emoji: card.emoji
        }));
    }
}