// UI боевого экрана
const BattleUI = {
    update(game) {
        if (!game.currentBattle) return;
        
        const battle = game.currentBattle;
        
        this.renderEnemy(game, battle);
        this.renderPlayer(game, battle);
        this.renderHand(game, battle);
        this.updatePreview(game, battle);
        this.renderActionButtons(game, battle);
    },
    
    renderEnemy(game, battle) {
        const enemy = battle.enemy;
        
        document.getElementById('enemy-sprite').textContent = enemy.emoji;
        document.getElementById('enemy-name').textContent = enemy.name;
        
        document.getElementById('enemy-hp-text').innerHTML = 
            `❤️ <span class="hp-current">${Math.floor(enemy.hp)}</span>/${Math.floor(enemy.maxHp)}`;
        
        document.getElementById('enemy-block').textContent = 
            battle.enemyBlock > 0 ? `🛡️ ${battle.enemyBlock}` : '';
        
        const intent = battle.getEnemyIntentInfo();
        const intentEl = document.getElementById('enemy-intent');
        
        if (intent.type === 'attack') {
            intentEl.innerHTML = `⚔️ <span class="intent-value">${intent.damage}</span>`;
            intentEl.className = 'intent intent-attack';
        } else {
            intentEl.innerHTML = `🛡️ <span class="intent-value">+${intent.block}</span>`;
            intentEl.className = 'intent intent-defend';
        }
        
        const effectsEl = document.getElementById('enemy-effects');
        effectsEl.innerHTML = '';
        
        const effects = this.getEnemyEffects(battle);
        
        effects.forEach(effect => {
            if (effect.value > 0) {
                const badge = document.createElement('span');
                badge.className = `effect-badge ${effect.type}`;
                badge.innerHTML = `${effect.icon} ${effect.value}`;
                badge.title = effect.label;
                badge.onclick = () => this.showStatusModal(effect);
                effectsEl.appendChild(badge);
            }
        });
    },
    
    renderPlayer(game, battle) {
        const player = game.player;
        
        document.getElementById('player-name').textContent = player.name;
        
        document.getElementById('player-hp-text').innerHTML = 
            `❤️ <span class="hp-current">${Math.floor(player.hp)}</span>/${Math.floor(player.maxHp)}`;
        
        document.getElementById('player-energy').innerHTML = 
            `⚡ <span class="energy-current">${battle.energy}</span>/${battle.maxEnergy}`;
        
        document.getElementById('player-block').textContent = 
            battle.block > 0 ? `🛡️ ${battle.block}` : '';
        
        const effectsEl = document.getElementById('player-effects');
        effectsEl.innerHTML = '';
        
        const effects = this.getPlayerEffects(battle);
        
        effects.forEach(effect => {
            if (effect.value > 0) {
                const badge = document.createElement('span');
                badge.className = `effect-badge ${effect.type}`;
                badge.innerHTML = `${effect.icon} ${effect.value}`;
                badge.title = effect.label;
                badge.onclick = () => this.showStatusModal(effect);
                effectsEl.appendChild(badge);
            }
        });
    },
    
    getEnemyEffects(battle) {
        return [
            { 
                icon: '💪', 
                value: battle.statusEffects.enemy.strength, 
                type: 'buff', 
                label: 'Сила',
                name: 'Сила',
                description: 'Увеличивает урон атак на указанное значение.'
            },
            { 
                icon: '🎯', 
                value: battle.statusEffects.enemy.vulnerable, 
                type: 'debuff', 
                label: 'Уязвимость',
                name: 'Уязвимость',
                description: 'Получает на 50% больше урона от атак. Уменьшается на 1 в конце хода.'
            },
            { 
                icon: '📉', 
                value: battle.statusEffects.enemy.weak, 
                type: 'debuff', 
                label: 'Слабость',
                name: 'Слабость',
                description: 'Наносит на 25% меньше урона. Уменьшается на 1 в конце хода.'
            },
            { 
                icon: '🩸', 
                value: battle.statusEffects.enemy.bleed, 
                type: 'debuff', 
                label: 'Кровотечение',
                name: 'Кровотечение',
                description: 'Получает урон в конце своего хода. Уменьшается на 1 каждый ход.'
            },
            { 
                icon: '☠️', 
                value: battle.statusEffects.enemy.poison, 
                type: 'debuff', 
                label: 'Яд',
                name: 'Яд',
                description: 'Получает урон в конце хода. Уменьшается на 1 каждый ход.'
            }
        ];
    },
    
    getPlayerEffects(battle) {
        return [
            { 
                icon: '💪', 
                value: battle.statusEffects.player.strength, 
                type: 'buff', 
                label: 'Сила',
                name: 'Сила',
                description: 'Увеличивает урон ваших атак на указанное значение.'
            },
            { 
                icon: '🎯', 
                value: battle.statusEffects.player.vulnerable, 
                type: 'debuff', 
                label: 'Уязвимость',
                name: 'Уязвимость',
                description: 'Вы получаете на 50% больше урона. Уменьшается на 1 в конце хода.'
            },
            { 
                icon: '📉', 
                value: battle.statusEffects.player.weak, 
                type: 'debuff', 
                label: 'Слабость',
                name: 'Слабость',
                description: 'Вы наносите на 25% меньше урона. Уменьшается на 1 в конце хода.'
            },
            { 
                icon: '🩸', 
                value: battle.statusEffects.player.bleed, 
                type: 'debuff', 
                label: 'Кровотечение',
                name: 'Кровотечение',
                description: 'Вы получаете урон в конце хода. Уменьшается на 1 каждый ход.'
            },
            { 
                icon: '☠️', 
                value: battle.statusEffects.player.poison, 
                type: 'debuff', 
                label: 'Яд',
                name: 'Яд',
                description: 'Вы получаете урон в конце хода. Уменьшается на 1 каждый ход.'
            },
            { 
                icon: '🌵', 
                value: battle.statusEffects.player.thorns, 
                type: 'buff', 
                label: 'Шипы',
                name: 'Шипы',
                description: 'Когда вы получаете урон от атаки, враг получает указанное количество урона.'
            }
        ];
    },
    
    showStatusModal(effect) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'status-modal';
        
        modal.innerHTML = `
            <div class="modal-content status-modal-content">
                <div class="status-modal-header">
                    <span class="status-modal-icon">${effect.icon}</span>
                    <h3>${effect.name}</h3>
                </div>
                <div class="status-modal-value">
                    Текущее значение: <strong>${effect.value}</strong>
                </div>
                <div class="status-modal-description">
                    ${effect.description}
                </div>
                <button onclick="document.getElementById('status-modal').remove()">Закрыть</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    renderHand(game, battle) {
        const handArea = document.getElementById('hand-area');
        handArea.innerHTML = '';
        
        battle.hand.forEach((card, index) => {
            const cardEl = this.createCardElement(card, index, battle);
            handArea.appendChild(cardEl);
        });
    },
    
    createCardElement(card, index, battle) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card card-type-${card.type}`;
        
        if (battle.selectedCards.includes(index)) {
            cardDiv.classList.add('selected');
        }
        
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
        
        const playBtn = document.createElement('button');
        playBtn.className = 'action-btn play-btn';
        playBtn.innerHTML = `⚔️ Разыграть (${battle.selectedCards.length})`;
        playBtn.disabled = battle.selectedCards.length === 0;
        playBtn.onclick = () => game.playSelectedCards();
        buttonsArea.appendChild(playBtn);
        
        const endBtn = document.createElement('button');
        endBtn.className = 'action-btn end-btn';
        endBtn.textContent = '⏭️ Завершить ход';
        endBtn.onclick = () => game.endTurn();
        buttonsArea.appendChild(endBtn);
        
        const deckBtn = document.createElement('button');
        deckBtn.className = 'action-btn deck-btn';
        deckBtn.innerHTML = `🃏 Колода (${battle.drawPile.length})`;
        deckBtn.onclick = () => game.viewDrawPile();
        buttonsArea.appendChild(deckBtn);
        
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