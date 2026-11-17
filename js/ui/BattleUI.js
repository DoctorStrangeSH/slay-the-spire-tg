// UI боевого экрана
const BattleUI = {
    update(game) {
        if (!game.currentBattle) return;
        
        const battle = game.currentBattle;
        
        this.renderEnemy(game, battle);
        this.renderBuildings(game, battle);
        this.renderPlayer(game, battle);
        this.renderHand(game, battle);
        this.updatePreview(game, battle);
        this.renderActionButtons(game, battle);
    },
    
    renderEnemy(game, battle) {
        const enemy = battle.enemy;
        
        const enemyArea = document.getElementById('enemy-area');
        const bossTitles = {
            forestBoss: 'I • ХРАНИТЕЛЬ ЧАЩИ',
            caveBoss: 'II • СЕРДЦЕ СКАЛЫ',
            castleBoss: 'III • ВЛАДЫКА ШПИЛЯ'
        };
        const bossId = enemy.isBoss && Object.prototype.hasOwnProperty.call(bossTitles, enemy.id) ? enemy.id : null;
        enemyArea.classList.toggle('boss-encounter', Boolean(bossId));
        enemyArea.classList.toggle('boss-wounded', Boolean(bossId) && enemy.hp <= enemy.maxHp / 2);
        enemyArea.classList.remove('boss-forest', 'boss-cave', 'boss-castle');
        if (bossId) {
            enemyArea.classList.add({ forestBoss: 'boss-forest', caveBoss: 'boss-cave', castleBoss: 'boss-castle' }[bossId]);
            enemyArea.setAttribute('data-boss-title', bossTitles[bossId]);
        } else {
            enemyArea.removeAttribute('data-boss-title');
        }
        EnemyArt.render(document.getElementById('enemy-sprite'), enemy);
        document.getElementById('enemy-name').textContent = enemy.name;
        
        document.getElementById('enemy-hp-text').innerHTML = 
            `❤️ <span class="hp-current">${Math.floor(enemy.hp)}</span>/${Math.floor(enemy.maxHp)}`;
        
        document.getElementById('enemy-block').textContent = 
            battle.enemyBlock > 0 ? `🛡️ ${battle.enemyBlock}` : '';
        
        const intent = battle.getEnemyIntentInfo();
        const intentEl = document.getElementById('enemy-intent');
        
        // Если враг парализован - показываем это
        let intentLabel;
        if (battle.isEnemyParalyzed()) {
            intentEl.innerHTML = `🔒 <span class="intent-value">Парализован</span>`;
            intentEl.className = 'intent intent-paralysis';
            intentLabel = 'Паралич: враг пропустит ход';
        } else if (intent.type === 'attack') {
            intentEl.innerHTML = `⚔️ <span class="intent-value">${intent.damage}</span><span class="intent-caption">Урон</span>`;
            intentEl.className = 'intent intent-attack';
            intentLabel = `Следующее действие: атака на ${intent.damage} урона`;
        } else {
            intentEl.innerHTML = `🛡️ <span class="intent-value">+${intent.block}</span><span class="intent-caption">Блок</span>`;
            intentEl.className = 'intent intent-defend';
            intentLabel = `Следующее действие: получает ${intent.block} блока`;
        }
        intentEl.setAttribute('aria-label', intentLabel);
        intentEl.title = intentLabel;
        
        const effectsEl = document.getElementById('enemy-effects');
        effectsEl.innerHTML = '';
        
        const effects = [
            { icon: '💪', value: battle.statusEffects.enemy.strength, type: 'buff', key: 'strength', label: 'Сила', name: 'Сила', description: 'Увеличивает урон атак.' },
            { icon: '🔒', value: battle.statusEffects.enemy.paralysis, type: 'debuff', key: 'paralysis', label: 'Паралич', name: 'Паралич', description: 'Враг пропускает свой следующий ход. Уменьшается на 1 после пропуска.' },
            { icon: '🎯', value: battle.statusEffects.enemy.vulnerable, type: 'debuff', key: 'vulnerable', label: 'Уязвимость', name: 'Уязвимость', description: 'Получает на 50% больше урона.' },
            { icon: '📉', value: battle.statusEffects.enemy.weak, type: 'debuff', key: 'weak', label: 'Слабость', name: 'Слабость', description: 'Наносит на 25% меньше урона.' },
            { icon: '🩸', value: battle.statusEffects.enemy.bleed, type: 'debuff', key: 'bleed', label: 'Кровотечение', name: 'Кровотечение', description: 'Получает урон в конце хода.' },
            { icon: '☠️', value: battle.statusEffects.enemy.poison, type: 'debuff', key: 'poison', label: 'Яд', name: 'Яд', description: 'Получает урон в конце хода.' }
        ];
        
        this.renderStatusBadges(effectsEl, effects);
    },
    
    renderBuildings(game, battle) {
        const buildingsArea = document.getElementById('buildings-area');
        
        if (!buildingsArea) return;
        
        if (battle.buildings) {
            buildingsArea.style.display = 'flex';
            buildingsArea.innerHTML = '';
            
            for (let i = 0; i < battle.buildings.maxSlots; i++) {
                const building = battle.buildings.getBuilding(i);
                
                if (building) {
                    const buildingCard = document.createElement('div');
                    buildingCard.className = 'building-card';
                    buildingCard.innerHTML = `
                        <div class="building-emoji">${building.emoji}</div>
                        <div class="building-name">${building.name}</div>
                        <div class="building-hp">❤️ ${building.hp}/${building.maxHp}</div>
                        ${building.damage > 0 ? `<div class="building-effect">⚔️ ${building.damage}</div>` : ''}
                        ${building.block > 0 ? `<div class="building-effect">🛡️ ${building.block}</div>` : ''}
                        ${building.upgraded ? '<div class="building-upgraded">⭐</div>' : ''}
                    `;
                    
                    buildingCard.onclick = () => this.showBuildingOptions(game, battle, building);
                    
                    buildingsArea.appendChild(buildingCard);
                } else {
                    const emptySlot = document.createElement('div');
                    emptySlot.className = 'building-slot-empty';
                    emptySlot.textContent = '⬜';
                    buildingsArea.appendChild(emptySlot);
                }
            }
        } else {
            buildingsArea.style.display = 'none';
        }
    },
    
    showBuildingOptions(game, battle, building) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'building-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${building.emoji} ${building.name}</h3>
                <p>❤️ HP: ${building.hp}/${building.maxHp}</p>
                ${building.damage > 0 ? `<p>⚔️ Урон: ${building.damage}</p>` : ''}
                ${building.block > 0 ? `<p>🛡️ Блок: ${building.block}</p>` : ''}
                ${building.upgraded ? '<p>⭐ Улучшена</p>' : ''}
                <button onclick="game.demolishBuilding(${building.id})">🗑️ Снести</button>
                <button onclick="document.getElementById('building-modal').remove()">Закрыть</button>
            </div>
        `;
        
        document.body.appendChild(modal);
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
        
        const effects = [
            { icon: '💪', value: battle.statusEffects.player.strength, type: 'buff', key: 'strength', label: 'Сила', name: 'Сила', description: 'Увеличивает урон ваших атак.' },
            { icon: '🔁', value: battle.echoStacks, type: 'buff', key: 'echo', label: 'Эхо', name: 'Эхо', description: 'Следующая карта сработает дважды.' },
            { icon: '🎯', value: battle.statusEffects.player.vulnerable, type: 'debuff', key: 'vulnerable', label: 'Уязвимость', name: 'Уязвимость', description: 'Вы получаете на 50% больше урона.' },
            { icon: '📉', value: battle.statusEffects.player.weak, type: 'debuff', key: 'weak', label: 'Слабость', name: 'Слабость', description: 'Вы наносите на 25% меньше урона.' },
            { icon: '🩸', value: battle.statusEffects.player.bleed, type: 'debuff', key: 'bleed', label: 'Кровотечение', name: 'Кровотечение', description: 'Вы получаете урон в конце хода.' },
            { icon: '☠️', value: battle.statusEffects.player.poison, type: 'debuff', key: 'poison', label: 'Яд', name: 'Яд', description: 'Вы получаете урон в конце хода.' },
            { icon: '🌵', value: battle.statusEffects.player.thorns, type: 'buff', key: 'thorns', label: 'Шипы', name: 'Шипы', description: 'Враг получает урон при атаке на вас.' }
        ];
        
        this.renderStatusBadges(effectsEl, effects);
    },
    
    renderStatusBadges(container, effects) {
        // Каждое состояние — собственный визуальный знак и доступная кнопка.
        effects.forEach(effect => {
            if (!Number.isFinite(effect.value) || effect.value <= 0) return;
            const badge = document.createElement('button');
            badge.type = 'button';
            badge.className = `effect-badge ${effect.type} status-${effect.key}`;
            badge.textContent = `${effect.icon} ${effect.value}`;
            badge.title = `${effect.label}: ${effect.value}. ${effect.description}`;
            badge.setAttribute('aria-label', badge.title);
            badge.addEventListener('click', () => this.showStatusModal(effect));
            container.appendChild(badge);
        });
    },

    showStatusModal(effect) {
        document.getElementById('status-modal')?.remove();
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
        // Keep the player's place in a horizontally scrolled hand after selecting a card.
        const scrollLeft = handArea.scrollLeft;
        const focusedCard = document.activeElement?.dataset?.cardIndex;
        handArea.innerHTML = '';

        battle.hand.forEach((card, index) => {
            const cardEl = this.createCardElement(card, index, battle);
            handArea.appendChild(cardEl);
        });
        handArea.scrollLeft = scrollLeft;
        if (focusedCard !== undefined) {
            const card = [...handArea.children].find(el => el.dataset.cardIndex === focusedCard);
            card?.focus({ preventScroll: true });
        }
    },
    
    createCardElement(card, index, battle) {
        const cardDiv = document.createElement('div');
        const rarity = CardArt.rarity(card);
        cardDiv.className = `card card-type-${card.type} card-rarity-${rarity.key}`;
        cardDiv.setAttribute('role', 'button');
        cardDiv.setAttribute('tabindex', '0');
        cardDiv.dataset.cardIndex = String(index);
        cardDiv.setAttribute('aria-pressed', String(battle.selectedCards.includes(index)));
        cardDiv.setAttribute('aria-label', `${card.name}, ${rarity.label}, стоимость ${card.cost}. ${card.description}`);
        
        if (battle.selectedCards.includes(index)) {
            cardDiv.classList.add('selected');
        }
        
        if (card.cost > battle.energy && !battle.selectedCards.includes(index)) {
            cardDiv.classList.add('card-unplayable');
        }
        
        cardDiv.innerHTML = `
            <div class="card-cost">${card.cost}</div>
            <span class="card-rarity-mark" aria-hidden="true">${rarity.sigil}</span>
            <div class="card-art-frame">${CardArt.markup(card)}</div>
            <div class="card-name">${card.name}</div>
            <div class="card-description">${card.description}</div>
        `;
        
        const inspectButton = document.createElement('button');
        inspectButton.type = 'button';
        inspectButton.className = 'card-inspect-button';
        inspectButton.textContent = 'ⓘ';
        inspectButton.setAttribute('aria-label', `Подробнее о карте «${card.name}»`);
        inspectButton.onclick = event => {
            event.stopPropagation();
            this.showCardDetails(card, rarity, inspectButton);
        };
        cardDiv.appendChild(inspectButton);

        cardDiv.onclick = () => game.selectCard(index);
        cardDiv.onkeydown = event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                cardDiv.click();
            }
        };
        return cardDiv;
    },
    
    showCardDetails(card, rarity, returnFocus) {
        document.getElementById('card-details-modal')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'card-details-modal';
        overlay.className = 'modal card-details-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', `Карта ${card.name}`);

        const panel = document.createElement('div');
        panel.className = 'modal-content card-details-panel';
        const heading = document.createElement('h3');
        heading.textContent = card.name;
        const meta = document.createElement('p');
        meta.className = 'card-details-meta';
        meta.textContent = `${rarity.label} · Энергия: ${card.cost}`;
        const artwork = document.createElement('div');
        artwork.className = 'card-details-art';
        artwork.innerHTML = CardArt.markup(card);
        const description = document.createElement('p');
        description.className = 'card-details-description';
        description.textContent = card.description || 'Нет описания.';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'card-details-close';
        closeButton.textContent = 'Закрыть';
        const close = () => {
            document.removeEventListener('keydown', onKeyDown);
            overlay.remove();
            if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
        };
        const onKeyDown = event => { if (event.key === 'Escape') close(); };
        closeButton.onclick = close;
        overlay.onclick = event => { if (event.target === overlay) close(); };
        panel.append(heading, meta, artwork, description, closeButton);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        document.addEventListener('keydown', onKeyDown);
        closeButton.focus();
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
        
        const relicBtn = document.createElement('button');
        relicBtn.className = 'action-btn relic-btn';
        relicBtn.textContent = `💎 Реликвии (${game.player.relics?.length || 0})`;
        relicBtn.onclick = () => game.showRelics();
        buttonsArea.appendChild(relicBtn);

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
    },
    
    // Показать модальное окно с просмотром карт (Scry)
    showScryModal(game, cards) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'scry-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <h3>🔮 Предвидение</h3>
                <p>Верхние карты колоды:</p>
                <div class="pile-cards">
                    ${cards.map((card, index) => `
                        <div class="pile-card">
                            <span>${card.emoji || '🃏'}</span>
                            <span>${card.name}</span>
                            <span>${card.cost}⚡</span>
                        </div>
                    `).join('')}
                </div>
                <button onclick="document.getElementById('scry-modal').remove()">Закрыть</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
};