// UI боевого экрана
const BattleUI = {
    update(game) {
        if (!game.currentBattle) return;
        
        const battle = game.currentBattle;
        
        // ===== ВРАГ =====
        this.renderEnemy(game, battle);
        
        // ===== ИГРОК =====
        this.renderPlayer(game, battle);
        
        // ===== КАРТЫ В РУКЕ =====
        this.renderHand(game, battle);
        
        // ===== ПРЕВЬЮ =====
        this.updatePreview(game, battle);
        
        // ===== КНОПКИ =====
        this.renderActionButtons(game, battle);
    },
    
    renderEnemy(game, battle) {
        const enemy = battle.enemy;
        
        document.getElementById('enemy-sprite').textContent = enemy.emoji;
        document.getElementById('enemy-name').textContent = enemy.name;
        
        // HP
        document.getElementById('enemy-hp-fill').style.width = 
            `${(enemy.hp / enemy.maxHp) * 100}%`;
        document.getElementById('enemy-hp-text').textContent = 
            `${Math.floor(enemy.hp)}/${Math.floor(enemy.maxHp)}`;
        
        // Блок
        document.getElementById('enemy-block').textContent = 
            battle.enemyBlock > 0 ? `🛡️ ${battle.enemyBlock}` : '';
        
        // Намерение врага
        const intent = battle.getEnemyIntentInfo();
        const intentEl = document.getElementById('enemy-intent');
        
        if (intent.type === 'attack') {
            intentEl.innerHTML = `<span class="intent-attack">⚔️ ${intent.damage}</span>`;
            intentEl.className = 'intent intent-attack';
        } else {
            intentEl.innerHTML = `<span class="intent-defend">🛡️ +${intent.block}</span>`;
            intentEl.className = 'intent intent-defend';
        }
        
        // Эффекты врага
        const effectsEl = document.getElementById('enemy-effects');
        effectsEl.innerHTML = '';
        
        const effects = [
            { key: 'strength', icon: '💪', label: 'Сила', value: battle.statusEffects.enemy.strength, type: 'buff' },
            { key: 'vulnerable', icon: '🎯', label: 'Уязвимость', value: battle.statusEffects.enemy.vulnerable, type: 'debuff' },
            { key: 'weak', icon: '📉', label: 'Слабость', value: battle.statusEffects.enemy.weak, type: 'debuff' },
            { key: 'bleed', icon: '🩸', label: 'Кровотечение', value: battle.statusEffects.enemy.bleed, type: 'debuff' },
            { key: 'poison', icon: '☠️', label: 'Яд', value: battle.statusEffects.enemy.poison, type: 'debuff' }
        ];
        
        effects.forEach(effect => {
            if (effect.value > 0) {
                const badge = document.createElement('span');
                badge.className = `effect-badge ${effect.type}`;
                badge.innerHTML = `${effect.icon} ${effect.value}`;
                badge.title = effect.label;
                effectsEl.appendChild(badge);
            }
        });
    },
    
    renderPlayer(game, battle) {
        const player = game.player;
        
        document.getElementById('player-name').textContent = player.name;
        
        // HP
        document.getElementById('player-hp-fill').style.width = 
            `${(player.hp / player.maxHp) * 100}%`;
        document.getElementById('player-hp-text').textContent = 
            `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
        
        // Энергия
        document.getElementById('player-energy').innerHTML = 
            `⚡ ${battle.energy}/${battle.maxEnergy}`;
        
        // Блок
        document.getElementById('player-block').textContent = 
            battle.block > 0 ? `🛡️ ${battle.block}` : '';
        
        // Эффекты игрока
        const effectsEl = document.getElementById('player-effects');
        effectsEl.innerHTML = '';
        
        const effects = [
            { key: 'strength', icon: '💪', label: 'Сила', value: battle.statusEffects.player.strength, type: 'buff' },
            { key: 'vulnerable', icon: '🎯', label: 'Уязвимость', value: battle.statusEffects.player.vulnerable, type: 'debuff' },
            { key: 'weak', icon: '📉', label: 'Слабость', value: battle.statusEffects.player.weak, type: 'debuff' },
            { key: 'bleed', icon: '🩸', label: 'Кровотечение', value: battle.statusEffects.player.bleed, type: 'debuff' },
            { key: 'poison', icon: '☠️', label: 'Яд', value: battle.statusEffects.player.poison, type: 'debuff' },
            { key: 'thorns', icon: '🌵', label: 'Шипы', value: battle.statusEffects.player.thorns, type: 'buff' }
        ];
        
        effects.forEach(effect => {
            if (effect.value > 0) {
                const badge = document.createElement('span');
                badge.className = `effect-badge ${effect.type}`;
                badge.innerHTML = `${effect.icon} ${effect.value}`;
                badge.title = effect.label;
                effectsEl.appendChild(badge);
            }
        });
    },
    
    renderHand(game, battle) {
        const handArea = document.getElementById('hand-area');
        handArea.innerHTML = '';
        
        battle.hand.forEach((card, index) => {
            const cardEl = this.createCardElement(card, index, battle);
            handArea.appendChild(cardEl);
        });
        
        // Обновляем счётчики колод
        document.getElementById('draw-count').textContent = battle.drawPile.length;
        document.getElementById('discard-count').textContent = battle.discardPile.length;
    },
    
    createCardElement(card, index, battle) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card card-type-${card.type}`;
        
        if (battle.selectedCards.includes(index)) {
            cardDiv.classList.add('selected');
        }
        
        // Подсветка если не хватает энергии
        if (card.cost > battle.energy && !battle.selectedCards.includes(index)) {
            cardDiv.classList.add('card-unplayable');
        }
        
        cardDiv.innerHTML = `
            <div class="card-cost">${card.cost}</div>
            <div class="card-emoji">${card.emoji || '🃏'}</div>
            <div class="card-name">${card.name}</div>
            <div class="card-description">${card.description}</div>
        `;
        
        cardDiv.onclick = () => game.selectCard(index);
        return cardDiv;
    },
    
    updatePreview(game, battle) {
        const previewEl = document.getElementById('battle-preview');
        
        if (!previewEl) return;
        
        if (battle.selectedCards.length === 0) {
            previewEl.style.display = 'none';
            return;
        }
        
        const totalPreview = battle.calculateTotalPreview();
        
        if (totalPreview.description) {
            previewEl.style.display = 'block';
            previewEl.innerHTML = `
                <div class="preview-content">
                    <span class="preview-title">Эффекты:</span>
                    <span class="preview-text">${totalPreview.description}</span>
                </div>
            `;
        } else {
            previewEl.style.display = 'none';
        }
    },
    
    renderActionButtons(game, battle) {
        const buttonsArea = document.getElementById('action-buttons');
        buttonsArea.innerHTML = '';
        
        // Кнопка "Разыграть"
        const playBtn = document.createElement('button');
        playBtn.className = 'action-btn play-btn';
        playBtn.innerHTML = `⚔️ Разыграть (${battle.selectedCards.length})`;
        playBtn.disabled = battle.selectedCards.length === 0;
        playBtn.onclick = () => game.playSelectedCards();
        buttonsArea.appendChild(playBtn);
        
        // Кнопка "Завершить ход"
        const endBtn = document.createElement('button');
        endBtn.className = 'action-btn end-btn';
        endBtn.textContent = '⏭️ Завершить ход';
        endBtn.onclick = () => game.endTurn();
        buttonsArea.appendChild(endBtn);
        
        // Кнопка "Колода"
        const deckBtn = document.createElement('button');
        deckBtn.className = 'action-btn deck-btn';
        deckBtn.innerHTML = `🃏 Колода (${battle.drawPile.length})`;
        deckBtn.onclick = () => game.viewDrawPile();
        buttonsArea.appendChild(deckBtn);
        
        // Кнопка "Сброс"
        const discardBtn = document.createElement('button');
        discardBtn.className = 'action-btn discard-btn';
        discardBtn.innerHTML = `🗑️ Сброс (${battle.discardPile.length})`;
        discardBtn.onclick = () => game.viewDiscardPile();
        buttonsArea.appendChild(discardBtn);
    },
    
    showPreview(description) {
        const previewEl = document.getElementById('battle-preview');
        if (previewEl && description) {
            previewEl.style.display = 'block';
            previewEl.innerHTML = `
                <div class="preview-content">
                    <span class="preview-title">Эффекты:</span>
                    <span class="preview-text">${description}</span>
                </div>
            `;
        }
    },
    
    hidePreview() {
        const previewEl = document.getElementById('battle-preview');
        if (previewEl) {
            previewEl.style.display = 'none';
        }
    }
};