// Основная игровая логика
class Game {
    constructor() {
        this.player = null;
        this.currentBattle = null;
        this.gameState = 'menu';
        this.act = 1;
        this.maxActs = GAME_CONFIG.maxActs;
        this.mapGenerator = null;
        this.currentNodeId = 'floor_0_node_0';
        this.floor = 0;
        this.currentEvent = null;
        this.offeredCards = [];
        this.currentRewardIndex = -1;
    }

    selectHero(heroId) {
        const hero = HEROES[heroId];
        if (!hero || !hero.unlocked) return;

        this.player = {
            name: hero.name,
            heroId: hero.id,
            maxHp: hero.maxHp,
            hp: hero.maxHp,
            gold: 0,
            deck: getStarterDeckForHero(heroId),
            relics: []
        };

        this.startNewGame();
    }

    startNewGame() {
        if (!this.player) return;

        this.player.hp = this.player.maxHp;
        this.player.gold = 0;
        this.player.deck = getStarterDeckForHero(this.player.heroId);
        this.player.relics = [];
        this.act = 1;
        this.floor = 0;

        this.generateNewMap();
        this.showMap();
    }

    generateNewMap() {
        this.mapGenerator = new MapGenerator(this.act);
        this.currentNodeId = 'floor_0_node_0';
        this.mapGenerator.visitNode(this.currentNodeId);
    }

    showMap() {
        this.gameState = 'map';
        hideAllScreens();
        document.getElementById('map-screen').style.display = 'block';
        window._currentMapPaths = this.mapGenerator.paths;
        MapUI.render(this);
    }

    showBattle() {
        this.gameState = 'battle';
        hideAllScreens();
        document.getElementById('battle-screen').style.display = 'block';
        BattleUI.update(this);
    }

    showMenu() {
        this.gameState = 'menu';
        hideAllScreens();
        document.getElementById('main-menu').style.display = 'block';

        document.getElementById('player-stats').innerHTML = this.player ? `
            <p>❤️ HP: ${this.player.hp}/${this.player.maxHp}</p>
            <p>💰 Золото: ${this.player.gold}</p>
            <p>🃏 Карт в колоде: ${this.player.deck.length}</p>
        ` : '';
    }

    startBattle(isElite = false) {
        const enemy = getRandomEnemy();
        if (isElite) {
            enemy.maxHp = Math.floor(enemy.maxHp * 1.5);
            enemy.hp = Math.floor(enemy.hp * 1.5);
            enemy.damage = Math.floor(enemy.damage * 1.3);
        }

        this.currentBattle = new BattleSystem(this.player, enemy);
        this.showBattle();
    }

    startBossBattle() {
        const boss = getBossForAct(this.act);
        this.currentBattle = new BattleSystem(this.player, boss);
        this.showBattle();
    }

    selectMapNode(node) {
        if (!node || node.visited) return;

        const availableNodes = this.mapGenerator.getAvailableNodes(this.currentNodeId);
        if (!availableNodes.includes(node)) return;

        const currentNode = this.mapGenerator.findNodeById(this.currentNodeId);
        if (currentNode && node.floor <= currentNode.floor) return;

        this.mapGenerator.visitNode(node.id);
        this.currentNodeId = node.id;
        this.floor = node.floor;

        switch (node.type) {
            case NODE_TYPES.BATTLE:
                this.startBattle(false);
                break;
            case NODE_TYPES.ELITE:
                this.startBattle(true);
                break;
            case NODE_TYPES.REST:
                this.rest();
                break;
            case NODE_TYPES.EVENT:
                this.triggerEvent();
                break;
            case NODE_TYPES.SHOP:
                this.openShop();
                break;
            case NODE_TYPES.BOSS:
                this.startBossBattle();
                break;
        }
    }

    selectCard(index) {
        if (!this.currentBattle) return;

        const result = this.currentBattle.selectCard(index);

        if (result.success) {
            BattleUI.update(this);

            if (result.preview && result.preview.description) {
                BattleUI.showPreview(result.preview.description);
            } else {
                BattleUI.hidePreview();
            }
        } else {
            alert(result.message);
        }
    }

    playSelectedCards() {
        if (!this.currentBattle) return;

        const result = this.currentBattle.playSelectedCards();

        if (result.success) {
            BattleUI.update(this);
            BattleUI.hidePreview();

            if (this.currentBattle.enemy.hp <= 0) {
                this.endBattle(true);
            }
        } else {
            alert(result.message);
        }
    }

    endTurn() {
        if (!this.currentBattle) return;

        const result = this.currentBattle.endTurn();
        BattleUI.update(this);

        if (result.battleEnded) {
            this.endBattle(result.victory);
        }
    }

    demolishBuilding(buildingId) {
        if (!this.currentBattle || !this.currentBattle.buildings) return;

        const result = this.currentBattle.buildings.demolishBuilding(this.currentBattle, buildingId);

        const modal = document.getElementById('building-modal');
        if (modal) modal.remove();

        if (result.success) {
            BattleUI.update(this);
        } else {
            alert(result.message);
        }
    }

    endBattle(victory) {
        if (victory) {
            const goldReward = Math.floor(Math.random() * 20) + 10;
            this.player.gold += goldReward;
            alert(`Победа! Получено ${goldReward} золота!`);

            if (Math.random() < 0.7) {
                this.offerCard();
            } else {
                this.continueJourney();
            }
        } else {
            alert('Поражение...');
            this.showMenu();
        }
    }

    offerCard() {
        const cards = getCardsForHero(this.player.heroId);
        const cardIds = Object.keys(cards);
        this.offeredCards = [];

        for (let i = 0; i < 3; i++) {
            const randomId = cardIds[Math.floor(Math.random() * cardIds.length)];
            this.offeredCards.push({ ...cards[randomId] });
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'reward-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Выберите карту:</h3>
                <div class="reward-cards">
                    ${this.offeredCards.map((card, index) => `
                        <div class="reward-card" onclick="game.showCardModalFromReward(${index})">
                            <div class="reward-card-emoji">${card.emoji}</div>
                            <div class="reward-card-name">${card.name}</div>
                            <div class="reward-card-cost">${card.cost}⚡</div>
                            <button onclick="event.stopPropagation(); game.takeCardFromReward(${index})">Взять</button>
                        </div>
                    `).join('')}
                </div>
                <button onclick="document.getElementById('reward-modal').remove(); game.continueJourney();">Пропустить</button>
            </div>
        `;

        document.body.appendChild(modal);
    }

    showCardModalFromReward(index) {
        const card = this.offeredCards[index];
        if (card) {
            this.currentRewardIndex = index;
            this.showCardModal(card, 'reward');
        }
    }

    takeCardFromReward(index) {
        const card = this.offeredCards[index];
        if (card) {
            this.player.deck.push({ ...card });
            const modal = document.getElementById('reward-modal');
            if (modal) modal.remove();
            this.closeCardModal();
            alert(`Карта "${card.name}" добавлена!`);
            this.continueJourney();
        }
    }

    showCardModal(card, context = 'view') {
        this.closeCardModal();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'card-modal';

        modal.innerHTML = `
            <div class="modal-content card-modal-content">
                <div class="card-detail">
                    <div class="card-detail-header">
                        <span class="card-detail-emoji">${card.emoji || '🃏'}</span>
                        <h3>${card.name}</h3>
                    </div>
                    <div class="card-detail-cost">Стоимость: ${card.cost}⚡</div>
                    <div class="card-detail-type">Тип: ${this.getCardTypeName(card.type)}</div>
                    <div class="card-detail-description">${card.description}</div>
                    ${card.rarity ? `<div class="card-detail-rarity">Редкость: ${this.getRarityName(card.rarity)}</div>` : ''}
                </div>
                <div class="card-modal-buttons">
                    ${context === 'reward' ? `<button onclick="game.takeCardFromReward(${this.currentRewardIndex})">Взять</button>` : ''}
                    <button onclick="game.closeCardModal()">Закрыть</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    closeCardModal() {
        const modal = document.getElementById('card-modal');
        if (modal) modal.remove();
    }

    getCardTypeName(type) {
        switch (type) {
            case CARD_TYPES.ATTACK: return 'Атака';
            case CARD_TYPES.SKILL: return 'Навык';
            case CARD_TYPES.POWER: return 'Сила';
            case CARD_TYPES.BUILDING: return 'Конструкция';
            default: return 'Неизвестно';
        }
    }

    getRarityName(rarity) {
        switch (rarity) {
            case CARD_RARITY.COMMON: return 'Обычная';
            case CARD_RARITY.UNCOMMON: return 'Необычная';
            case CARD_RARITY.RARE: return 'Редкая';
            default: return 'Обычная';
        }
    }

    viewDrawPile() {
        if (!this.currentBattle) return;

        const cards = this.currentBattle.viewDrawPile();
        if (cards.length === 0) {
            alert('Колода пуста');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Колода (${cards.length} карт)</h3>
                <div class="pile-cards">
                    ${cards.map((card, index) => `
                        <div class="pile-card" onclick="game.showCardModalFromPile('draw', ${index})">
                            <span>${card.emoji || '🃏'}</span>
                            <span>${card.name}</span>
                            <span>${card.cost}⚡</span>
                        </div>
                    `).join('')}
                </div>
                <button onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    viewDiscardPile() {
        if (!this.currentBattle) return;

        const cards = this.currentBattle.viewDiscardPile();
        if (cards.length === 0) {
            alert('Сброс пуст');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Сброс (${cards.length} карт)</h3>
                <div class="pile-cards">
                    ${cards.map((card, index) => `
                        <div class="pile-card" onclick="game.showCardModalFromPile('discard', ${index})">
                            <span>${card.emoji || '🃏'}</span>
                            <span>${card.name}</span>
                            <span>${card.cost}⚡</span>
                        </div>
                    `).join('')}
                </div>
                <button onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showCardModalFromPile(pileType, index) {
        if (!this.currentBattle) return;

        let card = null;
        if (pileType === 'draw') {
            const cards = this.currentBattle.viewDrawPile();
            card = cards[index];
        } else if (pileType === 'discard') {
            const cards = this.currentBattle.viewDiscardPile();
            card = cards[index];
        }

        if (card) {
            this.showCardModal(card, 'view');
        }
    }

    triggerEvent() {
        const events = this.getEventsForAct();
        const event = events[Math.floor(Math.random() * events.length)];
        this.showEventModal(event);
    }

    getEventsForAct() {
        return [
            {
                name: 'Загадочный фонтан',
                description: 'Вы нашли древний фонтан.',
                options: [
                    { text: 'Испить (Восстановить 25 HP)', action: () => {
                        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
                        alert('Вы чувствуете прилив сил!');
                    }},
                    { text: 'Уйти', action: () => {} }
                ]
            },
            {
                name: 'Странный торговец',
                description: 'Торговец предлагает карты.',
                options: [
                    { text: 'Купить карту (50 золота)', action: () => {
                        if (this.player.gold >= 50) {
                            this.player.gold -= 50;
                            this.offerCard();
                        } else {
                            alert('Недостаточно золота!');
                        }
                    }},
                    { text: 'Уйти', action: () => {} }
                ]
            }
        ];
    }

    showEventModal(event) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${event.name}</h3>
                <p>${event.description}</p>
            </div>
        `;

        event.options.forEach((option) => {
            const button = document.createElement('button');
            button.textContent = option.text;
            button.onclick = () => {
                option.action();
                document.body.removeChild(modal);
                this.continueJourney();
            };
            modal.querySelector('.modal-content').appendChild(button);
        });

        document.body.appendChild(modal);
        this.currentEvent = event;
    }

    openShop() {
        const cards = getCardsForHero(this.player.heroId);
        const cardIds = Object.keys(cards);
        const shopCards = [];

        for (let i = 0; i < 3; i++) {
            const randomId = cardIds[Math.floor(Math.random() * cardIds.length)];
            shopCards.push({ ...cards[randomId] });
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>💰 Магазин</h3>
                <p>У вас ${this.player.gold} золота</p>
            </div>
        `;

        shopCards.forEach((card) => {
            const shopItem = document.createElement('div');
            shopItem.className = 'shop-item';
            shopItem.innerHTML = `
                <span>${card.emoji} ${card.name} (${card.cost}⚡)</span>
                <span>Цена: 30 золота</span>
            `;
            const buyBtn = document.createElement('button');
            buyBtn.textContent = 'Купить';
            buyBtn.onclick = () => {
                if (this.player.gold >= 30) {
                    this.player.gold -= 30;
                    this.player.deck.push(card);
                    alert('Карта куплена!');
                    document.body.removeChild(modal);
                    this.continueJourney();
                } else {
                    alert('Недостаточно золота!');
                }
            };
            shopItem.appendChild(buyBtn);
            modal.querySelector('.modal-content').appendChild(shopItem);
        });

        const leaveBtn = document.createElement('button');
        leaveBtn.textContent = 'Уйти';
        leaveBtn.onclick = () => {
            document.body.removeChild(modal);
            this.continueJourney();
        };
        modal.querySelector('.modal-content').appendChild(leaveBtn);

        document.body.appendChild(modal);
    }

    continueJourney() {
        if (this.floor >= this.mapGenerator.floors - 1) {
            this.completeAct();
        } else {
            this.showMap();
        }
    }

    completeAct() {
        if (this.act < this.maxActs) {
            this.act++;
            alert(`Акт ${this.act - 1} пройден!`);
            this.generateNewMap();
            this.showMap();
        } else {
            alert('Поздравляем! Вы прошли игру!');
            this.showMenu();
        }
    }

    rest() {
        const healAmount = Math.floor(this.player.maxHp * 0.3);
        this.player.hp = Math.min(this.player.maxHp, Math.floor(this.player.hp + healAmount));

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>🏕️ Отдых</h3>
                <p>Вы восстановили ${healAmount} HP</p>
                <button id="rest-continue-btn">Продолжить</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('rest-continue-btn').onclick = () => {
            document.body.removeChild(modal);
            this.continueJourney();
        };
    }
}

function hideAllScreens() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hero-select').style.display = 'none';
    document.getElementById('battle-screen').style.display = 'none';
    document.getElementById('map-screen').style.display = 'none';
}