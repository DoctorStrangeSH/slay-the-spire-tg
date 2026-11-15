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
        this.runSave = new RunSave();
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
        this.runSave.clear();

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
        this.runSave.save(this);
    }

    continueSavedGame() {
        if (!this.runSave.restore(this)) return false;
        this.showMap();
        return true;
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
            <p>💎 Реликвий: ${this.player.relics.length}</p>
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
            case NODE_TYPES.TREASURE:
                this.openTreasure();
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

            // Если карта с scry - показываем модальное окно
            const card = this.currentBattle.hand[index];
            if (card && card.scry) {
                const topCards = this.currentBattle.scry(card.scry);
                BattleUI.showScryModal(this, topCards);
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
            this.runSave.clear();
            this.showMenu();
        }
    }

    offerCard() {
        this.offeredCards = getRandomRewardCards(this.player.heroId, 3);

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
                <button onclick="game.skipCardReward()">Пропустить</button>
            </div>
        `;

        document.body.appendChild(modal);
    }

    skipCardReward() {
        if (!this.offeredCards.length) return;
        this.offeredCards = [];
        document.getElementById('reward-modal')?.remove();
        this.closeCardModal();
        this.continueJourney();
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
            this.offeredCards = []; // Защита от повторной выдачи при двойном клике.
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

    applyAltarBargain() {
        // Нельзя заплатить жизнью: сделка должна оставлять героя в живых.
        if (!this.player || this.player.hp <= 12) return false;
        this.player.hp -= 12;
        this.player.maxHp += 8;
        return true;
    }

    getEventsForAct() {
        return [
            {
                name: 'Загадочный фонтан',
                description: 'Вы нашли древний фонтан.',
                options: [
                    {
                        text: 'Испить (Восстановить 25 HP)', action: () => {
                            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
                            alert('Вы чувствуете прилив сил!');
                        }
                    },
                    { text: 'Уйти', action: () => { } }
                ]
            },
            {
                name: 'Странный торговец',
                description: 'Торговец предлагает карты.',
                options: [
                    {
                        text: 'Купить карту (50 золота)', action: () => {
                            if (this.player.gold >= 50) {
                                this.player.gold -= 50;
                                this.offerCard();
                                return 'deferred';
                            } else {
                                alert('Недостаточно золота!');
                                return false;
                            }
                        }
                    },
                    { text: 'Уйти', action: () => { } }
                ]
            },
            {
                name: 'Алтарь Пепельной Клятвы',
                description: 'Древний камень обещает укрепить тело в обмен на вашу кровь.',
                options: [
                    {
                        text: 'Принести 12 HP в жертву (+8 к максимуму HP)',
                        action: () => {
                            if (!this.applyAltarBargain()) {
                                alert('Недостаточно здоровья для ритуала!');
                                return false;
                            }
                            return true;
                        }
                    },
                    { text: 'Не принимать клятву', action: () => true }
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

        let resolved = false;
        event.options.forEach((option) => {
            const button = document.createElement('button');
            button.textContent = option.text;
            button.onclick = () => {
                if (resolved) return;
                const result = option.action();
                if (result === false) return; // Невозможная покупка/сделка не завершает событие.
                resolved = true;
                modal.remove();
                if (result !== 'deferred') this.continueJourney();
            };
            modal.querySelector('.modal-content').appendChild(button);
        });

        document.body.appendChild(modal);
        this.currentEvent = event;
    }

    // Каждая сокровищница предлагает осмысленный выбор одного из трёх ресурсов.
    applyTreasureReward(type) {
        if (type === 'gold') {
            this.player.gold += 75;
            return true;
        }
        if (type === 'heal') {
            const restored = Math.max(1, Math.floor(this.player.maxHp * 0.35));
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + restored);
            return true;
        }
        if (type === 'relic') {
            const relic = chooseRelic(this.player.relics);
            if (!relic) return false;
            this.player.relics.push(relic.id);
            alert(`${relic.emoji} Получена реликвия «${relic.name}»! ${relic.description}`);
            return true;
        }
        if (type === 'card') {
            const cards = Object.values(getCardsForHero(this.player.heroId));
            const rareCards = cards.filter(card => card.rarity === CARD_RARITY.RARE);
            const pool = rareCards.length ? rareCards : cards;
            if (!pool.length) return false;
            this.player.deck.push({ ...pool[Math.floor(Math.random() * pool.length)] });
            return true;
        }
        return false;
    }

    openTreasure() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `<div class="modal-content">
            <h3>🎁 Древняя сокровищница</h3>
            <p>Магические печати позволяют забрать только одну награду.</p>
        </div>`;
        const choices = [
            { type: 'gold', text: '💰 75 золота' },
            { type: 'heal', text: '❤️ Восстановить 35% здоровья' },
            { type: 'card', text: '🃏 Получить редкую карту' }
        ];
        if (getAvailableRelics(this.player.relics).length) {
            choices.push({ type: 'relic', text: '💎 Получить новую реликвию' });
        }
        let claimed = false;
        choices.forEach(choice => {
            const button = document.createElement('button');
            button.textContent = choice.text;
            button.onclick = () => {
                if (claimed || !this.applyTreasureReward(choice.type)) return;
                claimed = true;
                modal.remove();
                this.continueJourney();
            };
            modal.querySelector('.modal-content').appendChild(button);
        });
        document.body.appendChild(modal);
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
            this.runSave.clear();
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