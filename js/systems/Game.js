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

    // Выбор карты
    selectCard(index) {
        if (!this.currentBattle) return;

        const result = this.currentBattle.selectCard(index);

        if (result.success) {
            BattleUI.update(this);

            // Если есть превью - показываем
            if (result.preview && result.preview.description) {
                BattleUI.showPreview(result.preview.description);
            } else {
                BattleUI.hidePreview();
            }
        } else {
            alert(result.message);
        }
    }

    // Розыгрыш выбранных карт
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
        const offeredCards = [];

        for (let i = 0; i < 3; i++) {
            const randomId = cardIds[Math.floor(Math.random() * cardIds.length)];
            offeredCards.push({ ...cards[randomId] });
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Выберите карту:</h3>
            </div>
        `;

        offeredCards.forEach(card => {
            const cardBtn = document.createElement('button');
            cardBtn.textContent = `${card.emoji} ${card.name} (${card.cost}⚡)`;
            cardBtn.onclick = () => {
                this.player.deck.push(card);
                document.body.removeChild(modal);
                this.continueJourney();
            };
            modal.querySelector('.modal-content').appendChild(cardBtn);
        });

        const skipBtn = document.createElement('button');
        skipBtn.textContent = 'Пропустить';
        skipBtn.onclick = () => {
            document.body.removeChild(modal);
            this.continueJourney();
        };
        modal.querySelector('.modal-content').appendChild(skipBtn);

        document.body.appendChild(modal);
    }

    triggerEvent() {
        const events = this.getEventsForAct();
        const event = events[Math.floor(Math.random() * events.length)];
        this.showEventModal(event);
    }

    getEventsForAct() {
        const commonEvents = [
            {
                name: 'Загадочный фонтан',
                description: 'Вы нашли древний фонтан с светящейся водой.',
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
                description: 'Торговец предлагает редкие карты.',
                options: [
                    {
                        text: 'Купить карту (50 золота)', action: () => {
                            if (this.player.gold >= 50) {
                                this.player.gold -= 50;
                                this.offerCard();
                            } else {
                                alert('Недостаточно золота!');
                            }
                        }
                    },
                    { text: 'Уйти', action: () => { } }
                ]
            }
        ];

        return commonEvents;
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
            alert(`Акт ${this.act - 1} пройден! Переход к акту ${this.act}`);
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

    viewDrawPile() {
        if (!this.currentBattle) return;

        const cards = this.currentBattle.viewDrawPile();
        if (cards.length === 0) {
            alert('Колода пуста');
            return;
        }

        let cardList = cards.map(card =>
            `${card.emoji || ''} ${card.name} (${card.cost}⚡) - ${card.description}`
        ).join('\n');

        alert(`Колода (${cards.length} карт):\n\n${cardList}`);
    }

    viewDiscardPile() {
        if (!this.currentBattle) return;

        const cards = this.currentBattle.viewDiscardPile();
        if (cards.length === 0) {
            alert('Сброс пуст');
            return;
        }

        let cardList = cards.map(card =>
            `${card.emoji || ''} ${card.name} (${card.cost}⚡) - ${card.description}`
        ).join('\n');

        alert(`Сброс (${cards.length} карт):\n\n${cardList}`);
    }
}

function hideAllScreens() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hero-select').style.display = 'none';
    document.getElementById('battle-screen').style.display = 'none';
    document.getElementById('map-screen').style.display = 'none';
}