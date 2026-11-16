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
        this.renderMapRelicButton();
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
        document.getElementById('enemy-area')?.classList.remove('fx-defeated');
        document.getElementById('player-area')?.classList.remove('fx-defeated');
        document.getElementById('battle-result-modal')?.remove();
        BattleUI.update(this);
        BattleFeedback.enter('enemy-area', this.currentBattle?.enemy);
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
            <button onclick="game.showRelics()">💎 Мои реликвии</button>
        ` : '';
    }

    // Коллекция доступна между комнатами и во время боя; не меняет состояние забега.
    renderMapRelicButton() {
        const map = document.getElementById('map-screen');
        if (!map || !this.player) return;
        let button = document.getElementById('map-relics-button');
        if (!button) {
            button = document.createElement('button');
            button.id = 'map-relics-button';
            button.className = 'relic-collection-button';
            button.onclick = () => this.showRelics();
            map.insertBefore(button, document.getElementById('map-nodes'));
        }
        button.textContent = `💎 Реликвии (${this.player.relics?.length || 0})`;
    }

    showRelics() {
        if (!this.player) return;
        document.getElementById('relics-modal')?.remove();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'relics-modal';

        const content = document.createElement('div');
        content.className = 'modal-content relics-modal-content';
        const title = document.createElement('h3');
        title.textContent = '💎 Коллекция реликвий';
        content.appendChild(title);

        const owned = Array.isArray(this.player.relics) ? this.player.relics : [];
        if (!owned.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Пока нет реликвий. Ищите их в сокровищницах.';
            content.appendChild(empty);
        }

        // textContent защищает от разметки из повреждённых/старых сохранений.
        for (const id of owned) {
            const relic = Object.prototype.hasOwnProperty.call(RELIC_CATALOG, id)
                ? RELIC_CATALOG[id] : null;
            const entry = document.createElement('div');
            entry.className = `relic-entry relic-entry--${relic?.heroId || 'shared'}`;
            const name = document.createElement('strong');
            name.textContent = relic ? `${relic.emoji} ${relic.name}` : '💎 Неизвестная реликвия';
            const description = document.createElement('span');
            description.textContent = relic ? relic.description : 'Эффект не найден в текущей версии игры.';
            entry.appendChild(name);
            entry.appendChild(description);
            content.appendChild(entry);
        }

        const close = document.createElement('button');
        close.textContent = 'Закрыть';
        close.onclick = () => modal.remove();
        content.appendChild(close);
        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    startBattle(isElite = false) {
        const enemy = getRandomEnemy();
        if (isElite) {
            enemy.maxHp = Math.floor(enemy.maxHp * 1.5);
            enemy.hp = Math.floor(enemy.hp * 1.5);
            enemy.damage = Math.floor(enemy.damage * 1.3);
        }

        this.beginEncounter(enemy);
    }

    startBossBattle() {
        const boss = getBossForAct(this.act);
        this.beginEncounter(boss);
    }

    beginEncounter(enemy) {
        this.currentBattle = new BattleSystem(this.player, enemy);
        // Благословение срабатывает только в первый ход боя, до появления экрана.
        const charges = Number(this.player?.blessingBattles) || 0;
        if (Number.isInteger(charges) && charges > 0) {
            this.currentBattle.block += 5;
            this.player.blessingBattles = charges - 1;
        }
        const curseCharges = Number(this.player?.curseBattles) || 0;
        if (Number.isInteger(curseCharges) && curseCharges > 0) {
            this.currentBattle.energy = Math.max(0, this.currentBattle.energy - 1);
            this.player.curseBattles = curseCharges - 1;
        }
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

        const before = BattleFeedback.snapshot(this.currentBattle);
        const playedCards = this.currentBattle.selectedCards
            .map(index => this.currentBattle.hand[index])
            .filter(Boolean);
        const playedTypes = playedCards.map(card => card.type);
        const result = this.currentBattle.playSelectedCards();

        if (result.success) {
            BattleUI.update(this);
            BattleFeedback.show(before, this.currentBattle);
            BattleFeedback.cardsPlayed(playedTypes, this.player.heroId, playedCards.map(card => card.id));
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

        const before = BattleFeedback.snapshot(this.currentBattle);
        const enemyWasAttacking = this.currentBattle.enemyIntent === 'attack'
            && !this.currentBattle.isEnemyParalyzed()
            && this.currentBattle.enemy.hp > 0;
        const bossId = this.currentBattle.enemy.isBoss ? this.currentBattle.enemy.id : null;
        const result = this.currentBattle.endTurn();
        BattleUI.update(this);
        BattleFeedback.show(before, this.currentBattle);
        if (enemyWasAttacking && this.currentBattle.enemy.hp > 0) {
            BattleFeedback.bossAttack(bossId);
        }

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
        // Только один экран исхода: повторные события не начислят золото второй раз.
        if (document.getElementById('battle-result-modal')) return;
        if (victory) {
            const goldReward = Math.floor(Math.random() * 20) + 10;
            this.player.gold += goldReward;
            BattleFeedback.result({
                victory: true,
                gold: goldReward,
                onContinue: () => {
                    if (Math.random() < 0.7) this.offerCard();
                    else this.continueJourney();
                }
            });
        } else {
            this.runSave.clear();
            BattleFeedback.result({
                victory: false,
                onContinue: () => this.showMenu()
            });
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
                        <div class="reward-card reward-reveal card-rarity-${CardArt.rarity(card).key}" style="--reveal-order: ${index}" onclick="game.showCardModalFromReward(${index})">
                            <div class="reward-card-art">${CardArt.markup(card, 'reward-art-image')}</div>
                            <div class="reward-card-name">${card.name}</div>
                            <div class="reward-card-rarity"><span aria-hidden="true">${CardArt.rarity(card).sigil}</span> ${CardArt.rarity(card).label}</div>
                            ${CardArt.rarity(card).key === 'rare' ? '<span class="reward-rare-crest" aria-hidden="true">✧</span>' : ''}
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
                <div class="card-detail card-rarity-${CardArt.rarity(card).key}">
                    <div class="card-detail-header">
                        <span class="card-detail-art">${CardArt.markup(card, 'detail-art-image')}</span>
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

    // Единая галерея колоды и сброса: одинаковая редкость и иллюстрации.
    pileSummary(cards) {
        const counts = { attack: 0, skill: 0, power: 0, building: 0 };
        cards.forEach(card => {
            if (Object.prototype.hasOwnProperty.call(counts, card.type)) counts[card.type]++;
        });
        return [
            ['attack', 'Атаки'],
            ['skill', 'Навыки'],
            ['power', 'Силы'],
            ['building', 'Конструкции']
        ].filter(([type]) => counts[type] > 0)
         .map(([type, label]) => `<span class="pile-summary-chip">${label}: ${counts[type]}</span>`).join('');
    }

    showPile(pileType) {
        if (!this.currentBattle) return;
        const isDraw = pileType === 'draw';
        const cards = isDraw ? this.currentBattle.viewDrawPile() : this.currentBattle.viewDiscardPile();
        if (cards.length === 0) {
            alert(isDraw ? 'Колода пуста' : 'Сброс пуст');
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content pile-gallery-modal">
                <h3>${isDraw ? 'Колода' : 'Сброс'} (${cards.length} карт)</h3>
                <div class="pile-summary" aria-label="Состав карт">${this.pileSummary(cards)}</div>
                <div class="pile-cards">
                    ${cards.map((card, index) => `
                        <button type="button" class="pile-card card-rarity-${CardArt.rarity(card).key}" onclick="game.showCardModalFromPile('${pileType}', ${index})">
                            <span class="pile-card-art">${CardArt.markup(card, 'pile-art-image')}</span>
                            <span class="pile-card-copy">
                                <strong class="pile-card-name">${card.name}</strong>
                                <small class="pile-card-rarity">${CardArt.rarity(card).sigil} ${CardArt.rarity(card).label}</small>
                            </span>
                            <span class="pile-card-cost">${card.cost}⚡</span>
                        </button>
                    `).join('')}
                </div>
                <button onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    viewDrawPile() {
        this.showPile('draw');
    }

    viewDiscardPile() {
        this.showPile('discard');
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
        const rareEvents = this.getRareEventsForAct();
        const isRare = rareEvents.length > 0 && Math.random() < 0.12;
        const events = isRare ? rareEvents : this.getEventsForAct();
        const event = events[Math.floor(Math.random() * events.length)];
        this.showEventModal(event);
    }

    getRareEventsForAct() {
        return [{
            name: 'Монета Забытого Долга',
            description: 'У сломанного трона лежит тяжёлая монета с лицом безымянного короля. Она обещает золото сейчас, но заберёт часть твоих сил в двух грядущих схватках.',
            rare: true,
            options: [
                {
                    text: 'Взять монету (+75 золота, −1 энергия в начале 2 следующих боёв)',
                    action: () => {
                        this.player.gold += 75;
                        this.player.curseBattles = Math.min(99, Math.max(0, Number(this.player.curseBattles) || 0) + 2);
                        return true;
                    }
                },
                { text: 'Оставить проклятие нетронутым', action: () => true }
            ]
        }, {
            name: 'Оракул Золотого Пламени',
            description: 'За полупрозрачной завесой горит пламя, которое не обжигает. Оракул обещает защиту в двух грядущих схватках, если ты оставишь дар у подножия чаши.',
            rare: true,
            options: [
                {
                    text: 'Принести 30 золота (+5 блока в начале 2 следующих боёв)',
                    action: () => {
                        if (this.player.gold < 30) { alert('Недостаточно золота!'); return false; }
                        this.player.gold -= 30;
                        this.player.blessingBattles = (Math.max(0, Number(this.player.blessingBattles) || 0)) + 2;
                        return true;
                    }
                },
                { text: 'Не принимать благословение', action: () => true }
            ]
        }, {
            name: 'Договор с Хранителем Печатей',
            description: 'В тайном приделе собора сидит безликий хранитель. Он протягивает печать, в которой заключена сила прошлых паломников. За дар он требует твою кровь.',
            rare: true,
            options: [
                {
                    text: 'Подписать договор (−15 HP, случайная реликвия)',
                    action: () => {
                        if (this.player.hp <= 15) {
                            alert('Недостаточно здоровья для договора!');
                            return false;
                        }
                        // Не взимать плату, если все реликвии уже получены.
                        if (!getAvailableRelics(this.player.relics, this.player.heroId).length) {
                            alert('Хранителю больше нечего предложить!');
                            return false;
                        }
                        if (!this.applyTreasureReward('relic')) return false;
                        this.player.hp -= 15;
                        return true;
                    }
                },
                { text: 'Отвергнуть печать', action: () => true }
            ]
        }];
    }

    applyAltarBargain() {
        // Нельзя заплатить жизнью: сделка должна оставлять героя в живых.
        if (!this.player || this.player.hp <= 12) return false;
        this.player.hp -= 12;
        this.player.maxHp += 8;
        return true;
    }

    getEventsForAct() {
        const commonEvents = [
            {
                name: 'Загадочный фонтан',
                description: 'В треснувшей купели дрожит серебряная вода. На дне мерцают монеты давно погибших путников. Кажется, эта вода ещё помнит, как исцелять раны.',
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
                description: 'Под погасшим фонарём стоит незнакомец в бархатной маске. Он показывает древние карты, но за каждое откровение назначает свою цену.',
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
                name: 'Библиотека Безымянных',
                description: 'Пыльные фолианты хранят последние мысли тех, кто никогда не покинул шпиль. Среди стеллажей одна книга сама раскрывается на нужной странице.',
                options: [
                    {
                        text: 'Выкупить тайное знание (35 золота, выбрать карту)',
                        action: () => {
                            if (this.player.gold < 35) { alert('Недостаточно золота!'); return false; }
                            this.player.gold -= 35;
                            this.offerCard();
                            return 'deferred';
                        }
                    },
                    {
                        text: 'Прочесть молитву (+8 HP)',
                        action: () => {
                            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);
                            return true;
                        }
                    },
                    { text: 'Уйти', action: () => true }
                ]
            },
            {
                name: 'Часовня Последнего Света',
                description: 'В полуразрушенной часовне одна свеча всё ещё горит вопреки сквознякам. Перед алтарём лежат монеты тех, кто надеялся пережить ночь.',
                options: [
                    {
                        text: 'Помолиться (+18 HP)',
                        action: () => {
                            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 18);
                            return true;
                        }
                    },
                    {
                        text: 'Пожертвовать 25 золота (+3 к максимуму HP)',
                        action: () => {
                            if (this.player.gold < 25) { alert('Недостаточно золота!'); return false; }
                            this.player.gold -= 25;
                            this.player.maxHp += 3;
                            this.player.hp += 3;
                            return true;
                        }
                    },
                    { text: 'Уйти', action: () => true }
                ]
            },
            {
                name: 'Запечатанная Сокровищница',
                description: 'За дверью с выцветшим гербом звенят забытые монеты. Но на пороге проступает надпись: богатство достанется лишь тому, кто заплатит болью.',
                options: [
                    {
                        text: 'Вскрыть печать (−9 HP, +60 золота)',
                        action: () => {
                            if (this.player.hp <= 9) { alert('Слишком мало здоровья для печати!'); return false; }
                            this.player.hp -= 9;
                            this.player.gold += 60;
                            return true;
                        }
                    },
                    { text: 'Не трогать печать', action: () => true }
                ]
            },
            {
                name: 'Алтарь Пепельной Клятвы',
                description: 'Среди остывших свечей возвышается алтарь из чёрного камня. Руны обещают новую силу, но требуют крови того, кто осмелится произнести клятву.',
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
        const actEvents = {
            1: {
                name: 'Сердце Терновника',
                description: 'В глубине заброшенных садов бьётся сердце из колючих лоз. Его шипы блестят от росы, а под корнями темнеют кошельки прежних искателей.',
                options: [
                    {
                        text: 'Пройти сквозь шипы (−6 HP, +45 золота)',
                        action: () => {
                            if (this.player.hp <= 6) { alert('Вы слишком слабы для терновника!'); return false; }
                            this.player.hp -= 6;
                            this.player.gold += 45;
                            return true;
                        }
                    },
                    {
                        text: 'Прилечь у корней (+10 HP)',
                        action: () => {
                            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 10);
                            return true;
                        }
                    },
                    { text: 'Уйти', action: () => true }
                ]
            },
            2: {
                name: 'Кузница Погасших Звёзд',
                description: 'Под пепельными сводами до сих пор дышит древняя кузница. Слепой мастер предлагает укрепить твоё тело раскалённым клеймом.',
                options: [
                    {
                        text: 'Заплатить кузнецу (40 золота, +5 к максимуму HP)',
                        action: () => {
                            if (this.player.gold < 40) { alert('Недостаточно золота!'); return false; }
                            this.player.gold -= 40;
                            this.player.maxHp += 5;
                            this.player.hp += 5;
                            return true;
                        }
                    },
                    { text: 'Отказаться от клейма', action: () => true }
                ]
            },
            3: {
                name: 'Зеркало Забытой Короны',
                description: 'В цитадели стоит зеркало, которое не отражает лицо. Вместо него ты видишь себя на троне, но каждое видение высасывает жизненную силу.',
                options: [
                    {
                        text: 'Принять отражение (−10 HP, +7 к максимуму HP)',
                        action: () => {
                            if (this.player.hp <= 10) { alert('Отражение заберёт последнюю жизнь!'); return false; }
                            this.player.hp -= 10;
                            this.player.maxHp += 7;
                            return true;
                        }
                    },
                    { text: 'Разбить отражение (+20 золота)',
                      action: () => { this.player.gold += 20; return true; } },
                    { text: 'Уйти', action: () => true }
                ]
            }
        };
        return actEvents[this.act] ? [...commonEvents, actEvents[this.act]] : commonEvents;
    }

    getEventPresentation(name) {
        const scenes = {
            'Загадочный фонтан': { style: 'fountain', sigil: '♒', caption: 'ЗАБЫТАЯ КУПЕЛЬ', hint: 'Пить из древней воды или оставить её нетронутой?' },
            'Странный торговец': { style: 'merchant', sigil: '◇', caption: 'СДЕЛКА В ТЕНИ', hint: 'У каждой тайны есть цена.' },
            'Алтарь Пепельной Клятвы': { style: 'altar', sigil: '✥', caption: 'ОБЕТ КРОВИ', hint: 'Сила требует жертвы. Решение за тобой.' },
            'Библиотека Безымянных': { style: 'library', sigil: '✣', caption: 'ШЁПОТ СТРАНИЦ', hint: 'Знание бывает дороже золота.' },
            'Часовня Последнего Света': { style: 'chapel', sigil: '✟', caption: 'ПОСЛЕДНЯЯ МОЛИТВА', hint: 'Свет не погас, пока есть надежда.' },
            'Запечатанная Сокровищница': { style: 'vault', sigil: '◈', caption: 'ПЕЧАТЬ ЗАБЫТЫХ', hint: 'Богатство и боль часто идут рядом.' },
            'Сердце Терновника': { style: 'thorns', sigil: '❦', caption: 'ШЁПОТ САДОВ', hint: 'Не всякое сокровище достаётся без боли.' },
            'Кузница Погасших Звёзд': { style: 'forge', sigil: '⚒', caption: 'ЗАКАЛКА В ПЕПЛЕ', hint: 'Пламя куёт новую судьбу.' },
            'Зеркало Забытой Короны': { style: 'mirror', sigil: '◉', caption: 'ГРАНЬ ВЛАСТИ', hint: 'Какую цену ты заплатишь за власть?' },
            'Договор с Хранителем Печатей': { style: 'covenant', sigil: '✺', caption: 'РЕДКАЯ ВСТРЕЧА · КРОВАВАЯ ПЕЧАТЬ', hint: 'Чужое наследие не достаётся бесплатно.' },
            'Оракул Золотого Пламени': { style: 'oracle', sigil: '☼', caption: 'РЕДКАЯ ВСТРЕЧА · ЗОЛОТОЕ ПЛАМЯ', hint: 'Этот огонь защитит тебя, когда придёт час.' },
            'Монета Забытого Долга': { style: 'curse', sigil: '☷', caption: 'РЕДКАЯ ВСТРЕЧА · ДОЛГ КОРОНЫ', hint: 'Каждая монета требует расплаты.' }
        };
        return scenes[name] || { style: 'mystery', sigil: '✦', caption: 'НЕИЗВЕСТНАЯ ВСТРЕЧА', hint: 'Выбери свой путь.' };
    }

    showEventModal(event) {
        const scene = this.getEventPresentation(event.name);
        const modal = document.createElement('div');
        modal.className = 'modal cathedral-event-modal';
        modal.dataset.eventScene = scene.style;
        if (event.rare) modal.classList.add('cathedral-event--rare');
        modal.innerHTML = `
            <div class="modal-content cathedral-event-content">
                <p class="cathedral-event-kicker">${scene.caption}</p>
                <div class="cathedral-event-art" aria-hidden="true">
                    <div class="cathedral-event-halo"></div>
                    <span class="cathedral-event-sigil">${scene.sigil}</span>
                </div>
                <h3>${event.name}</h3>
                <p class="cathedral-event-story">${event.description}</p>
                <p class="cathedral-event-hint">${scene.hint}</p>
                <div class="cathedral-event-choices"></div>
            </div>
        `;

        let resolved = false;
        event.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'cathedral-event-choice';
            const isExit = /^(Уйти|Не принимать клятву|Не трогать печать|Отказаться от клейма|Отвергнуть печать|Не принимать благословение|Оставить проклятие нетронутым)$/.test(option.text);
            if (isExit) button.classList.add('cathedral-event-choice--exit');
            const number = document.createElement('span');
            number.className = 'cathedral-event-choice-number';
            number.textContent = String(index + 1).padStart(2, '0');
            const copy = document.createElement('span');
            copy.textContent = option.text;
            button.appendChild(number);
            button.appendChild(copy);
            button.onclick = () => {
                if (resolved) return;
                const result = option.action();
                if (result === false) return; // Невозможная покупка/сделка не завершает событие.
                resolved = true;
                modal.remove();
                if (result !== 'deferred') this.continueJourney();
            };
            modal.querySelector('.cathedral-event-choices').appendChild(button);
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
            const relic = chooseRelic(this.player.relics, Math.random, this.player.heroId);
            if (!relic) return false;
            this.player.relics.push(relic.id);
            if (typeof BattleFeedback !== 'undefined' && BattleFeedback.relicAcquired) {
                BattleFeedback.relicAcquired(relic);
            } else {
                alert(`${relic.emoji} Получена реликвия «${relic.name}»! ${relic.description}`);
            }
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
        if (getAvailableRelics(this.player.relics, this.player.heroId).length) {
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
        const completedAct = this.act;
        if (this.act < this.maxActs) {
            this.act++;
            this.floor = 0;
            this.generateNewMap();
            // Сохраняем новый акт до показа заставки: повторный вход не переигрывает босса.
            this.showMap();
            this.showActTransition(completedAct, false);
        } else {
            this.runSave.clear();
            this.showMenu();
            this.showActTransition(completedAct, true);
        }
    }

    showActTransition(completedAct, isVictory) {
        document.getElementById('cathedral-act-transition')?.remove();
        const theme = isVictory
            ? { name: 'Шпиль покорён', subtitle: 'Сквозь тьму ты пронёс свою судьбу', sigil: '✦', style: 'victory' }
            : MapUI.getActTheme(this.act);
        const overlay = document.createElement('div');
        overlay.id = 'cathedral-act-transition';
        overlay.className = 'cathedral-act-transition';
        overlay.dataset.actTheme = theme.style;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', isVictory ? 'Победа в забеге' : 'Новая глава');
        overlay.innerHTML = `
            <div class="cathedral-transition-panel">
                <div class="cathedral-transition-ornament" aria-hidden="true">✧ ─── ✦ ─── ✧</div>
                <p class="cathedral-transition-kicker">${isVictory ? 'ВОСХОЖДЕНИЕ ЗАВЕРШЕНО' : 'ГЛАВА ЗАВЕРШЕНА · АКТ ' + completedAct}</p>
                <div class="cathedral-transition-sigil" aria-hidden="true">${theme.sigil}</div>
                <h2>${theme.name}</h2>
                <p class="cathedral-transition-subtitle">${theme.subtitle}</p>
                <p class="cathedral-transition-epilogue">${isVictory ? 'Собор помнит тех, кто достиг вершины.' : 'Новый путь ждёт за порогом.'}</p>
                <button type="button" class="cathedral-transition-continue">${isVictory ? 'Вернуться в главное меню' : 'Продолжить восхождение'} →</button>
            </div>
        `;
        const continueButton = overlay.querySelector('.cathedral-transition-continue');
        continueButton.addEventListener('click', () => overlay.remove(), { once: true });
        document.body.appendChild(overlay);
        continueButton.focus();
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