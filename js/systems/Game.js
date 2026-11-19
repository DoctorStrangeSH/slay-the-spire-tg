// Основная игровая логика
class Game {
    constructor() {
        this.player = null;
        this.currentBattle = null;
        this.currentBattleIsElite = false;
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
        this.runHistory = typeof RunHistory === 'function' ? new RunHistory() : null;
        this.runId = null;
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
            relics: [],
            eventHistory: [],
            journalLog: [],
            battleWins: 0,
            eliteWins: 0,
            bossWins: 0,
            pilgrimChoice: null,
            obeliskDebt: null,
            archiveDebt: null
        };

        this.startNewGame();
    }

    startNewGame() {
        if (!this.player) return;
        this.runSave.clear();
        this.runId = `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        this.player.hp = this.player.maxHp;
        this.player.gold = 0;
        this.player.deck = getStarterDeckForHero(this.player.heroId);
        this.player.relics = [];
        this.player.eventHistory = [];
        this.player.journalLog = [];
        this.player.battleWins = 0;
        this.player.eliteWins = 0;
        this.player.bossWins = 0;
        this.player.pilgrimChoice = null;
        this.player.obeliskDebt = null;
        this.player.obeliskDebtAct = null;
        this.player.obeliskDebtFloor = null;
        this.player.archiveDebt = null;
        this.player.archiveDebtAct = null;
        this.player.archiveDebtFloor = null;
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
        this.renderMapJournalButton();
        this.runSave.save(this);
    }

    continueSavedGame() {
        if (!this.runSave.restore(this)) return false;
        this.runId = this.runSave.read()?.runId || `legacy-${this.act}-${this.floor}-${Date.now()}`;
        this.showMap();
        return true;
    }

    showBattle() {
        this.gameState = 'battle';
        hideAllScreens();
        const battleScreen = document.getElementById('battle-screen');
        battleScreen.style.display = 'flex';
        battleScreen.dataset.cardSkin = this.runHistory?.rewardForHero(this.player?.heroId)?.skin || '';
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

    recordFinishedRun(victory) {
        if (!this.player) return false;
        if (!this.runId) this.runId = `legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return this.runHistory?.record(this.getRunSummary(victory), this.player.heroId, this.runId) || false;
    }

    showRunHistory() {
        document.getElementById('cathedral-history-modal')?.remove();
        const data = this.runHistory.read();
        const modal = document.createElement('div');
        modal.id = 'cathedral-history-modal';
        modal.className = 'modal run-journal-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'История восхождений');
        const panel = document.createElement('div');
        panel.className = 'modal-content run-journal-content';
        const title = document.createElement('h3');
        title.textContent = '🏆 История восхождений';
        const summary = document.createElement('p');
        summary.className = 'run-journal-place';
        summary.textContent = `Забегов: ${data.runs} · Побед: ${data.victories} · Лучший счёт: ${data.bestScore}`;
        panel.append(title, summary);
        const heroTitle = document.createElement('h4');
        heroTitle.textContent = 'Герои';
        panel.appendChild(heroTitle);
        const heroes = [
            ['berserk', '⚔️ Берсерк'], ['engineer', '🔧 Инженер'], ['psyker', '🔮 Псайкер']
        ];
        for (const [id, label] of heroes) {
            const row = document.createElement('article');
            row.className = 'run-journal-entry cathedral-history-hero';
            const name = document.createElement('strong');
            name.textContent = label;
            const detail = document.createElement('small');
            const cosmetic = this.runHistory.rewardForHero(id, data);
            detail.textContent = `Забегов: ${Number(data.heroes[id]) || 0} · Побед: ${Number(data.heroVictories[id]) || 0}`
                + (cosmetic ? ` · ${cosmetic.sigil} ${cosmetic.title}` : '');
            row.append(name, detail);
            const availableRewards = this.runHistory.availableRewardsForHero(id, data);
            const rewardSelect = document.createElement('select');
            rewardSelect.className = 'cathedral-cosmetic-select';
            rewardSelect.setAttribute('aria-label', `Награда для героя: ${label}`);
            if (!availableRewards.length) {
                const locked = document.createElement('option');
                locked.value = '';
                locked.textContent = 'Награды пока закрыты';
                rewardSelect.appendChild(locked);
                rewardSelect.disabled = true;
            } else {
                for (const reward of availableRewards) {
                    const option = document.createElement('option');
                    option.value = reward.id;
                    option.textContent = `${reward.sigil} ${reward.title}`;
                    rewardSelect.appendChild(option);
                }
                rewardSelect.value = data.selectedRewards?.[id] || cosmetic?.id || availableRewards[0].id;
                rewardSelect.addEventListener('change', () => {
                    if (!this.runHistory.equipReward(id, rewardSelect.value)) return;
                    const equipped = this.runHistory.rewardForHero(id);
                    detail.textContent = `Забегов: ${Number(data.heroes[id]) || 0} · Побед: ${Number(data.heroVictories[id]) || 0}`
                        + (equipped ? ` · ${equipped.sigil} ${equipped.title}` : '');
                    if (this.player?.heroId === id && this.gameState === 'battle') {
                        document.getElementById('battle-screen').dataset.cardSkin = equipped?.skin || '';
                    }
                    const equippedIds = new Set(this.runHistory.cosmeticCollection()
                        .filter(item => item.equipped).map(item => item.id));
                    panel.querySelectorAll('.cathedral-cosmetic-card').forEach(card => {
                        card.querySelector('.cathedral-cosmetic-equipped')?.remove();
                        if (!equippedIds.has(card.dataset.cosmeticId)) return;
                        const badge = document.createElement('span');
                        badge.className = 'cathedral-cosmetic-equipped';
                        badge.textContent = 'Надето';
                        card.appendChild(badge);
                    });
                });
            }
            row.appendChild(rewardSelect);
            panel.appendChild(row);
        }

        const collection = this.runHistory.cosmeticCollection(data);
        const collectionSection = document.createElement('section');
        collectionSection.className = 'cathedral-cosmetic-gallery';
        const collectionTitle = document.createElement('h4');
        collectionTitle.textContent = '✧ Коллекция обликов';
        const collectionProgress = document.createElement('p');
        collectionProgress.className = 'cathedral-challenge-progress-label';
        const unlockedCosmetics = collection.filter(item => item.unlocked).length;
        collectionProgress.textContent = `Открыто ${unlockedCosmetics} из ${collection.length}`;
        collectionSection.append(collectionTitle, collectionProgress);
        for (const cosmetic of collection) {
            const card = document.createElement('article');
            card.className = 'cathedral-cosmetic-card';
            card.dataset.cosmeticId = cosmetic.id;
            card.classList.toggle('cathedral-cosmetic-card--locked', !cosmetic.unlocked);
            const heading = document.createElement('strong');
            heading.textContent = `${cosmetic.unlocked ? cosmetic.sigil : '🔒'} ${cosmetic.unlocked ? cosmetic.title : '???'}`;
            const owner = document.createElement('small');
            owner.textContent = cosmetic.hero;
            const requirement = document.createElement('p');
            requirement.textContent = cosmetic.unlocked ? 'Открыто · можно экипировать в разделе героя' : `Условие: ${cosmetic.requirement}`;
            card.append(heading, owner, requirement);
            if (cosmetic.equipped) {
                const equipped = document.createElement('span');
                equipped.className = 'cathedral-cosmetic-equipped';
                equipped.textContent = 'Надето';
                card.appendChild(equipped);
            }
            collectionSection.appendChild(card);
        }
        panel.appendChild(collectionSection);

        const achievements = this.runHistory.achievements(data);
        const unlocked = achievements.filter(item => item.unlocked).length;
        const hall = document.createElement('section');
        hall.className = 'cathedral-challenge-hall';
        const hallTitle = document.createElement('h4');
        hallTitle.textContent = '✦ Зал испытаний';
        const progress = document.createElement('p');
        progress.className = 'cathedral-challenge-progress-label';
        progress.textContent = `Открыто ${unlocked} из ${achievements.length}`;
        const track = document.createElement('div');
        track.className = 'cathedral-challenge-progress';
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-label', 'Прогресс достижений');
        track.setAttribute('aria-valuenow', String(unlocked));
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', String(achievements.length));
        const fill = document.createElement('div');
        fill.className = 'cathedral-challenge-progress-fill';
        fill.style.width = `${achievements.length ? Math.round(unlocked / achievements.length * 100) : 0}%`;
        track.appendChild(fill);
        hall.append(hallTitle, progress, track);

        const categories = [
            ['general', '✦ Общие достижения'],
            ['berserk', '⚔️ Испытания Берсерка'],
            ['engineer', '🔧 Испытания Инженера'],
            ['psyker', '🔮 Испытания Псайкера']
        ];
        for (const [id, label] of categories) {
            const entries = achievements.filter(item => item.category === id);
            const complete = entries.filter(item => item.unlocked).length;
            const group = document.createElement('details');
            group.className = 'cathedral-challenge-group';
            group.open = id === 'general';
            const header = document.createElement('summary');
            header.textContent = `${label} · ${complete}/${entries.length}`;
            group.appendChild(header);
            for (const achievement of entries) {
                const row = document.createElement('article');
                row.className = 'run-journal-entry cathedral-achievement';
                const name = document.createElement('strong');
                name.textContent = `${achievement.unlocked ? '✦' : '◇'} ${achievement.name}`;
                const description = document.createElement('p');
                description.textContent = achievement.description;
                row.classList.toggle('cathedral-achievement--locked', !achievement.unlocked);
                row.append(name, description);
                if (achievement.reward) {
                    const prize = document.createElement('small');
                    prize.className = 'cathedral-achievement-reward';
                    prize.textContent = `${achievement.unlocked ? '✦ Получено' : '◆ Награда'}: ${achievement.reward}`;
                    row.appendChild(prize);
                }
                group.appendChild(row);
            }
            hall.appendChild(group);
        }
        panel.appendChild(hall);
        const recentTitle = document.createElement('h4');
        recentTitle.textContent = 'Последние забеги';
        panel.appendChild(recentTitle);
        if (!data.recent.length) {
            const empty = document.createElement('p');
            empty.className = 'run-journal-empty';
            empty.textContent = 'Ещё нет завершённых путешествий.';
            panel.appendChild(empty);
        }
        for (const run of [...data.recent].reverse()) {
            const row = document.createElement('article');
            row.className = 'run-journal-entry';
            const name = document.createElement('strong');
            name.textContent = `${run.victory ? '🏆 Победа' : '☽ Поражение'} · ${run.hero}`;
            const detail = document.createElement('p');
            detail.textContent = `Акт ${run.act}, этаж ${run.floor} · ${run.score} очков`;
            row.append(name, detail);
            panel.appendChild(row);
        }
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'run-journal-close';
        close.textContent = 'Закрыть';
        close.onclick = () => modal.remove();
        panel.appendChild(close);
        modal.appendChild(panel);
        document.body.appendChild(modal);
        close.focus();
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

    renderMapJournalButton() {
        const map = document.getElementById('map-screen');
        if (!map || !this.player) return;
        let button = document.getElementById('map-journal-button');
        if (!button) {
            button = document.createElement('button');
            button.id = 'map-journal-button';
            button.className = 'relic-collection-button run-journal-button';
            button.onclick = () => this.showRunJournal();
            map.insertBefore(button, document.getElementById('map-nodes'));
        }
        button.textContent = '📜 Журнал забега';
    }

    getRunJournalEntries() {
        if (!this.player) return [];
        const player = this.player;
        const entries = [];
        const add = (title, status, description) => entries.push({ title, status, description });
        if (player.pilgrimChoice === 'helped') add('Паломник', 'Ожидает продолжения', 'Вы помогли страннику. Возможно, ваши пути снова пересекутся.');
        else if (player.pilgrimChoice === 'repaid') add('Паломник', 'Завершено', 'Паломник вернулся и отблагодарил вас.');
        else if (player.pilgrimChoice === 'ignored') add('Паломник', 'Завершено', 'Вы прошли мимо нуждающегося странника.');
        if (player.obeliskDebt === 'owed') add('Долг обелиска', 'Ожидает продолжения', 'Вы обменяли 4 максимальных HP на 85 золота. Хранитель может предложить вернуть силу.');
        else if (player.obeliskDebt === 'redeemed') add('Долг обелиска', 'Завершено', 'Вы выкупили утраченную силу.');
        else if (player.obeliskDebt === 'forgone') add('Долг обелиска', 'Завершено', 'Вы отказались от выкупа навсегда.');
        if (player.archiveDebt === 'owed') add('Запретный архив', 'Ожидает продолжения', 'Кровь уже отдана за усиление карты. Чернильный Сборщик помнит этот долг.');
        else if (player.archiveDebt === 'healed') add('Запретный архив', 'Завершено', 'Чернильный Сборщик залечил ваш шрам.');
        else if (player.archiveDebt === 'sold') add('Запретный архив', 'Завершено', 'Вы продали страницу за золото и приняли кровавую метку.');
        else if (player.archiveDebt === 'burned') add('Запретный архив', 'Завершено', 'Вы сожгли книгу и оборвали историю.');
        const mark = Number(player.bloodMarkBattles) || 0;
        if (mark > 0) add('Кровавая метка', 'Действует', `Потеря 4 HP в начале следующих ${mark} боёв.`);
        const exhaustion = Number(player.exhaustionBattles) || 0;
        if (exhaustion > 0) add('Истощение', 'Действует', `Ослабление силы ещё на ${exhaustion} боёв.`);
        return entries;
    }

    snapshotJournalResources() {
        const player = this.player || {};
        const identity = item => String(item?.id || item?.name || item?.cardId || 'unknown');
        return {
            hp: Number(player.hp) || 0,
            maxHp: Number(player.maxHp) || 0,
            gold: Number(player.gold) || 0,
            cards: Array.isArray(player.deck) ? player.deck.length : 0,
            deckSignature: Array.isArray(player.deck)
                ? player.deck.map(card => `${identity(card)}:${card?.upgraded ? 1 : 0}`).sort().join('|')
                : '',
            relics: Array.isArray(player.relics)
                ? player.relics.map(item => String(item?.name || item?.id || item?.relicId || 'unknown')).sort()
                : [],
            storyFlags: {
                pilgrimChoice: player.pilgrimChoice || null,
                obeliskDebt: player.obeliskDebt || null,
                archiveDebt: player.archiveDebt || null
            }
        };
    }

    recordEventDecision(event, option, before) {
        if (!this.player) return;
        const after = this.snapshotJournalResources();
        const eventKey = String(event?.id || event?.name || 'unknown-event')
            .normalize('NFKD').replace(/[^a-zA-Z0-9а-яА-Я_-]+/g, '-').toLowerCase();
        const entryId = [
            this.runId || 'legacy-run',
            this.act,
            this.floor + 1,
            eventKey
        ].join(':');
        const previous = Array.isArray(this.player.journalLog) ? this.player.journalLog : [];
        // A room decision is recorded once even if its UI callback is invoked again.
        if (previous.some(entry => entry?.id === entryId)) return false;

        const deltas = [
            ['HP', after.hp - before.hp],
            ['макс. HP', after.maxHp - before.maxHp],
            ['золото', after.gold - before.gold],
            ['карт в колоде', after.cards - before.cards],
            ['реликвий', after.relics.length - (before.relics?.length || 0)]
        ].filter(([, delta]) => delta !== 0)
            .map(([label, delta]) => `${label}: ${delta > 0 ? '+' : ''}${delta}`);
        const addedRelics = after.relics.filter(id => !before.relics.includes(id));
        const removedRelics = before.relics.filter(id => !after.relics.includes(id));
        if (addedRelics.length) deltas.push(`получено: ${addedRelics.join(', ')}`);
        if (removedRelics.length) deltas.push(`потеряно: ${removedRelics.join(', ')}`);
        if (before.deckSignature !== after.deckSignature && after.cards === before.cards) {
            deltas.push('состав колоды изменён');
        }
        const storyLabels = {
            pilgrimChoice: { helped: 'помощь паломнику', ignored: 'отказ помочь паломнику', repaid: 'долг паломника возвращён' },
            obeliskDebt: { owed: 'долг обелиска принят', redeemed: 'долг обелиска погашен', forgone: 'выкуп силы отклонён' },
            archiveDebt: { owed: 'долг запретного архива принят', healed: 'долг архива закрыт исцелением', sold: 'страница продана, принята кровавая метка', burned: 'запретный архив уничтожен' }
        };
        for (const [key, labels] of Object.entries(storyLabels)) {
            const previousState = before.storyFlags?.[key] || null;
            const nextState = after.storyFlags?.[key] || null;
            if (previousState !== nextState && nextState && labels[nextState]) {
                deltas.push(`сюжет: ${labels[nextState]}`);
            }
        }
        this.player.journalLog = [...previous.slice(-49), {
            id: entryId,
            runId: this.runId || null,
            act: this.act,
            floor: this.floor + 1,
            event: event.name,
            choice: option.text,
            outcome: deltas.join(' · ') || 'Без немедленных изменений'
        }];
        return true;
    }

    showRunJournal() {
        if (!this.player) return;
        document.getElementById('run-journal-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'run-journal-modal';
        modal.className = 'modal run-journal-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Журнал текущего забега');
        const panel = document.createElement('div');
        panel.className = 'modal-content run-journal-content';
        const title = document.createElement('h3');
        title.textContent = '📜 Журнал забега';
        const place = document.createElement('p');
        place.className = 'run-journal-place';
        place.textContent = `Акт ${this.act} · Этаж ${this.floor + 1}`;
        panel.append(title, place);
        const section = (heading, lines, emptyMessage) => {
            const label = document.createElement('h4');
            label.textContent = heading;
            panel.appendChild(label);
            if (!lines.length) {
                const empty = document.createElement('p');
                empty.className = 'run-journal-empty';
                empty.textContent = emptyMessage;
                panel.appendChild(empty);
            }
            lines.forEach(line => {
                const row = document.createElement('article');
                row.className = 'run-journal-entry';
                const name = document.createElement('strong');
                name.textContent = line.title;
                const status = document.createElement('small');
                status.textContent = line.status;
                const description = document.createElement('p');
                description.textContent = line.description;
                row.append(name, status, description);
                panel.appendChild(row);
            });
        };
        section('Нити судьбы', this.getRunJournalEntries(), 'Пока нет открытых сюжетных линий.');
        const decisions = Array.isArray(this.player.journalLog)
            ? this.player.journalLog.slice(-20).reverse().filter(entry => entry && typeof entry === 'object')
            : [];
        section('Хроника решений', decisions.map(entry => ({
            title: String(entry.event || 'Неизвестная встреча'),
            status: `Акт ${entry.act || '?'} · Этаж ${entry.floor || '?'}`,
            description: `${String(entry.choice || 'Неизвестный выбор')}\n${String(entry.outcome || '')}`
        })), 'Ваши решения появятся здесь после первой встречи.');
        const recent = Array.isArray(this.player.eventHistory)
            ? this.player.eventHistory.filter(name => typeof name === 'string').slice(-10).reverse()
            : [];
        section('Последние встречи', recent.map(name => ({ title: name, status: 'Встреча', description: '' })),
            'Вы ещё не встречали случайных событий.');
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'run-journal-close';
        close.textContent = 'Вернуться к карте';
        close.onclick = () => modal.remove();
        panel.appendChild(close);
        modal.appendChild(panel);
        document.body.appendChild(modal);
        close.focus();
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

    grantTemporaryBlessing(key, battles) {
        if (!this.player || !['blessingBattles', 'oathBattles', 'ashBattles'].includes(key)) return 0;
        const current = Number(this.player[key]);
        const existing = Number.isInteger(current) && current > 0 ? current : 0;
        const extra = Array.isArray(this.player.relics) && this.player.relics.includes('eternityShard') ? 1 : 0;
        const awarded = Math.max(0, Number.isInteger(battles) ? battles : 0) + extra;
        this.player[key] = Math.min(99, existing + awarded);
        return this.player[key] - existing;
    }

    getTotalCurseBattles() {
        if (!this.player) return 0;
        return ['curseBattles', 'exhaustionBattles', 'bloodMarkBattles'].reduce((total, key) => {
            const value = Number(this.player[key]);
            return total + (Number.isInteger(value) && value > 0 ? value : 0);
        }, 0);
    }

    clearTemporaryCurses() {
        this.player.curseBattles = 0;
        this.player.exhaustionBattles = 0;
        this.player.bloodMarkBattles = 0;
    }

    getTemporaryConditions() {
        if (!this.player) return [];
        const effects = [
            { key: 'blessingBattles', kind: 'blessing', icon: '☼',
              name: 'Золотое пламя', description: '+5 блока в начале первого хода каждого следующего боя.' },
            { key: 'ashBattles', kind: 'blessing', icon: '✹',
              name: 'Пепельная печать', description: '+2 силы на всё время каждого следующего боя.' },
            { key: 'oathBattles', kind: 'blessing', icon: '☾',
              name: 'Лунная клятва', description: '+1 энергия в начале первого хода каждого следующего боя.' },
            { key: 'bloodMarkBattles', kind: 'curse', icon: '♥',
              name: 'Кровавая метка', description: '−4 HP в начале каждого следующего боя (но не ниже 1 HP).' },
            { key: 'exhaustionBattles', kind: 'curse', icon: '♜',
              name: 'Истощение', description: '−2 силы на всё время каждого следующего боя.' },
            { key: 'curseBattles', kind: 'curse', icon: '☷',
              name: 'Монета Забытого Долга', description: '−1 энергия в начале первого хода каждого следующего боя.' }
        ];
        return effects.map(effect => ({
            ...effect,
            remaining: Number.isInteger(this.player[effect.key]) && this.player[effect.key] > 0
                ? this.player[effect.key] : 0
        })).filter(effect => effect.remaining > 0);
    }

    showConditions() {
        document.getElementById('conditions-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'conditions-modal';
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Состояния героя');
        const content = document.createElement('div');
        content.className = 'modal-content cathedral-conditions-content';
        const title = document.createElement('h3');
        title.textContent = '✦ Состояния героя';
        content.appendChild(title);
        const conditions = this.getTemporaryConditions();
        if (!conditions.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Пока нет благословений и проклятий.';
            content.appendChild(empty);
        }
        for (const condition of conditions) {
            const entry = document.createElement('div');
            entry.className = `cathedral-condition-entry cathedral-condition-entry--${condition.kind}`;
            const name = document.createElement('strong');
            name.textContent = `${condition.icon} ${condition.name}`;
            const description = document.createElement('span');
            description.textContent = condition.description;
            const duration = document.createElement('small');
            duration.textContent = `Осталось боёв: ${condition.remaining}`;
            entry.appendChild(name);
            entry.appendChild(description);
            entry.appendChild(duration);
            content.appendChild(entry);
        }
        const close = document.createElement('button');
        close.textContent = 'Закрыть';
        close.onclick = () => modal.remove();
        content.appendChild(close);
        modal.appendChild(content);
        document.body.appendChild(modal);
        close.focus();
    }

    startBattle(isElite = false) {
        this.currentBattleIsElite = isElite;
        const enemy = getRandomEnemy();
        if (isElite) {
            enemy.maxHp = Math.floor(enemy.maxHp * 1.5);
            enemy.hp = Math.floor(enemy.hp * 1.5);
            enemy.damage = Math.floor(enemy.damage * 1.3);
        }

        this.beginEncounter(enemy);
    }

    startBossBattle() {
        this.currentBattleIsElite = false;
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
        const oathCharges = Number(this.player?.oathBattles) || 0;
        if (Number.isInteger(oathCharges) && oathCharges > 0) {
            this.currentBattle.energy += 1;
            this.player.oathBattles = oathCharges - 1;
        }
        const ashCharges = Number(this.player?.ashBattles) || 0;
        if (Number.isInteger(ashCharges) && ashCharges > 0) {
            this.currentBattle.statusEffects.player.strength += 2;
            this.player.ashBattles = ashCharges - 1;
        }
        const exhaustionCharges = Number(this.player?.exhaustionBattles) || 0;
        if (Number.isInteger(exhaustionCharges) && exhaustionCharges > 0) {
            this.currentBattle.statusEffects.player.strength -= 2;
            this.player.exhaustionBattles = exhaustionCharges - 1;
        }
        const bloodMarkCharges = Number(this.player?.bloodMarkBattles) || 0;
        if (Number.isInteger(bloodMarkCharges) && bloodMarkCharges > 0) {
            this.player.hp = Math.max(1, this.player.hp - 4);
            this.player.bloodMarkBattles = bloodMarkCharges - 1;
        }
        // Условие проверяется до завершения боевого заряда: последний бой тоже усилен.
        if (((Number.isInteger(curseCharges) && curseCharges > 0) ||
             (Number.isInteger(exhaustionCharges) && exhaustionCharges > 0) ||
             (Number.isInteger(bloodMarkCharges) && bloodMarkCharges > 0)) &&
            Array.isArray(this.player.relics) && this.player.relics.includes('bloodPact')) {
            this.currentBattle.statusEffects.player.strength += 2;
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
            if (result.scryedCards) {
                BattleUI.showScryModal(this, result.scryedCards);
            }

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

    recordCombatChallenge(victory) {
        if (!victory || !this.player || !this.runHistory) return false;
        let unlocked = false;
        const eliteVictory = this.currentBattleIsElite === true;

        // Count actual HP lost during the fight, not the final HP delta (healing cannot erase damage).
        if (eliteVictory && Number(this.currentBattle?.damageTakenThisBattle) === 0) {
            unlocked = this.runHistory.unlockChallenge('flawless_elite') || unlocked;
        }
        if (this.player.heroId === 'berserk' && this.currentBattle?.enemy?.isBoss === true) {
            const hp = Number(this.player.hp);
            const maxHp = Number(this.player.maxHp);
            if (Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0
                && hp > 0 && hp <= maxHp * 0.2) {
                unlocked = this.runHistory.unlockChallenge('berserk_last_breath') || unlocked;
            }
        }
        if (this.player.heroId === 'engineer' && eliteVictory) {
            const active = this.currentBattle?.buildings?.buildings;
            if (Array.isArray(active) && active.filter(building =>
                building && Number.isFinite(Number(building.hp)) && Number(building.hp) > 0).length >= 2) {
                unlocked = this.runHistory.unlockChallenge('engineer_iron_line') || unlocked;
            }
        }
        if (this.player.heroId === 'psyker' && eliteVictory
            && (Number(this.currentBattle?.cardsPlayedThisTurn) || 0) >= 3
            && (Number(this.currentBattle?.statusEffects?.enemy?.paralysis) || 0) > 0) {
            unlocked = this.runHistory.unlockChallenge('psyker_mind_chain') || unlocked;
        }
        return unlocked;
    }

    endBattle(victory) {
        // Только один экран исхода: повторные события не начислят золото второй раз.
        if (document.getElementById('battle-result-modal')) return;
        if (victory) {
            if (typeof this.recordCombatChallenge === 'function') this.recordCombatChallenge(true);
            const elite = this.currentBattleIsElite === true;
            const boss = this.currentBattle?.enemy?.isBoss === true;
            this.player.battleWins = (Number(this.player.battleWins) || 0) + 1;
            if (elite) this.player.eliteWins = (Number(this.player.eliteWins) || 0) + 1;
            if (boss) this.player.bossWins = (Number(this.player.bossWins) || 0) + 1;
            let goldReward = Math.floor(Math.random() * 20) + (elite ? 25 : 10);
            let relic = null;
            if (elite) {
                relic = chooseRelic(this.player.relics, Math.random, this.player.heroId);
                if (relic) this.player.relics.push(relic.id);
                else goldReward += 40; // Exhausted relic pool never leaves an elite unrewarded.
            }
            this.currentBattleIsElite = false;
            this.player.gold += goldReward;
            BattleFeedback.result({
                victory: true,
                gold: goldReward,
                relic,
                onContinue: () => {
                    if (Math.random() < 0.7) this.offerCard();
                    else this.continueJourney();
                }
            });
        } else {
            this.recordFinishedRun(false);
            this.runSave.clear();
            BattleFeedback.result({
                victory: false,
                onContinue: () => {
                    this.showMenu();
                    this.showRunResult(false);
                }
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

    getRareEventChance() {
        const act = Number.isInteger(this.act) ? this.act : 1;
        return Math.min(0.20, 0.12 + 0.04 * Math.max(0, act - 1));
    }

    getEligibleRareEvents() {
        return this.getRareEventsForAct().filter(event =>
            !event.requiresCurse || this.getTotalCurseBattles() > 0);
    }

    triggerEvent() {
        const rareEvents = this.getEligibleRareEvents();
        const isRare = rareEvents.length > 0 && Math.random() < this.getRareEventChance();
        const events = isRare ? rareEvents : this.getEventsForAct();
        const history = Array.isArray(this.player?.eventHistory)
            ? this.player.eventHistory.filter(name => typeof name === 'string').slice(-2)
            : [];
        const freshEvents = events.filter(event => !history.includes(event.name));
        // Если весь пул уже встречался, событие всё равно должно состояться.
        const availableEvents = freshEvents.length ? freshEvents : events;
        let event = availableEvents[Math.floor(Math.random() * availableEvents.length)];
        // Deferred encounters compete fairly: one old decision cannot hide another.
        if (!isRare) {
            const followUpNames = [
                'Возвращение паломника',
                'Хранитель Расколотого Обелиска',
                'Чернильный Сборщик'
            ];
            const followUps = availableEvents.filter(candidate => followUpNames.includes(candidate.name));
            if (followUps.length && Math.random() < 0.55) {
                event = followUps[Math.floor(Math.random() * followUps.length)];
            }
        }
        if (!event) return;
        if (this.player) {
            const previous = Array.isArray(this.player.eventHistory) ? this.player.eventHistory : [];
            this.player.eventHistory = [...previous.slice(-19), event.name];
        }
        this.showEventModal(event);
    }

    getRareEventsForAct() {
        return [{
            name: 'Кровавый Алтарь',
            description: 'На алтаре стоит золотая чаша, полная тёмно-красного света. Она отдаст сокровища сейчас, но потребует кровь в начале двух будущих битв.',
            rare: true,
            options: [
                {
                    text: 'Принять метку (+70 золота, −4 HP в начале 2 боёв)',
                    action: () => {
                        this.player.gold += 70;
                        this.player.bloodMarkBattles = Math.min(99,
                            Math.max(0, Number(this.player.bloodMarkBattles) || 0) + 2);
                        return true;
                    }
                },
                { text: 'Отвернуться от алтаря', action: () => true }
            ]
        }, {
            name: 'Чаша Истощения',
            description: 'В пустой часовне стоит чаша с серебристой пылью. Она обещает богатство, но на два следующих боя заберёт часть твоей силы.',
            rare: true,
            options: [
                {
                    text: 'Вдохнуть пепел (+65 золота, −2 силы на 2 боя)',
                    action: () => {
                        this.player.gold += 65;
                        this.player.exhaustionBattles = Math.min(99,
                            Math.max(0, Number(this.player.exhaustionBattles) || 0) + 2);
                        return true;
                    }
                },
                { text: 'Отойти от чаши', action: () => true }
            ]
        }, {
            name: 'Кузница Судеб',
            requiresCurse: true,
            description: 'В глубине собора кузнец без лица предлагает переплавить бремя проклятия в дар. Золотая сталь принесёт защиту, кровавая — силу. Без проклятия кузница молчит.',
            rare: true,
            options: [
                {
                    text: 'Перековать в защиту (30 золота, проклятие → Золотое пламя)',
                    action: () => {
                        const remaining = this.getTotalCurseBattles();
                        if (!Number.isInteger(remaining) || remaining <= 0) {
                            alert('Нет активного проклятия для перековки!'); return false;
                        }
                        if (this.player.gold < 30) { alert('Недостаточно золота!'); return false; }
                        this.player.gold -= 30;
                        this.clearTemporaryCurses();
                        this.grantTemporaryBlessing('blessingBattles', remaining);
                        return true;
                    }
                },
                {
                    text: 'Перековать в силу (−8 HP, проклятие → Пепельная печать)',
                    action: () => {
                        const remaining = this.getTotalCurseBattles();
                        if (!Number.isInteger(remaining) || remaining <= 0) {
                            alert('Нет активного проклятия для перековки!'); return false;
                        }
                        if (this.player.hp <= 8) { alert('Недостаточно здоровья!'); return false; }
                        this.player.hp -= 8;
                        this.clearTemporaryCurses();
                        this.grantTemporaryBlessing('ashBattles', remaining);
                        return true;
                    }
                },
                { text: 'Не доверять кузнецу', action: () => true }
            ]
        }, {
            name: 'Пепельная Печать',
            description: 'Из потухшего алтаря поднимаются красные искры. Печать даст тебе силу на две битвы, но заберёт часть жизненной энергии прямо сейчас.',
            rare: true,
            options: [
                {
                    text: 'Принять печать (−10 HP, +2 силы на 2 следующих боя)',
                    action: () => {
                        if (this.player.hp <= 10) { alert('Недостаточно здоровья для печати!'); return false; }
                        this.player.hp -= 10;
                        this.grantTemporaryBlessing('ashBattles', 2);
                        return true;
                    }
                },
                { text: 'Погасить искры', action: () => true }
            ]
        }, {
            name: 'Лунная Клятва',
            description: 'Среди осколков витража лунный свет складывается в письмена. За каплю жизненной силы он обещает ускорить два грядущих сражения.',
            rare: true,
            options: [
                {
                    text: 'Принять клятву (−12 HP, +1 энергия в начале 2 следующих боёв)',
                    action: () => {
                        if (this.player.hp <= 12) { alert('Недостаточно здоровья для клятвы!'); return false; }
                        this.player.hp -= 12;
                        this.grantTemporaryBlessing('oathBattles', 2);
                        return true;
                    }
                },
                { text: 'Оставить витраж нетронутым', action: () => true }
            ]
        }, {
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
                        this.grantTemporaryBlessing('blessingBattles', 2);
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

    applyForbiddenManuscript() {
        const eligible = Array.isArray(this.player?.deck)
            ? this.player.deck.filter(card => this.getCardUpgrade(card))
            : [];
        if (this.player.hp <= 7 || eligible.length === 0) return false;
        const target = eligible[Math.floor(Math.random() * eligible.length)];
        if (!this.upgradeCard(target)) return false;
        this.player.hp -= 7;
        this.player.archiveDebt = 'owed';
        this.player.archiveDebtAct = this.act;
        this.player.archiveDebtFloor = this.floor;
        return true;
    }

    canEncounterArchiveScribe() {
        if (this.player?.archiveDebt !== 'owed') return false;
        const act = Number(this.player.archiveDebtAct);
        const floor = Number(this.player.archiveDebtFloor);
        return Number.isInteger(act) && Number.isInteger(floor)
            && (this.act > act || (this.act === act && this.floor > floor));
    }

    applyObeliskBargain() {
        if (!this.player || this.player.maxHp <= 10) return false;
        this.player.maxHp -= 4;
        this.player.hp = Math.min(this.player.hp, this.player.maxHp);
        this.player.gold += 85;
        this.player.obeliskDebt = 'owed';
        this.player.obeliskDebtAct = this.act;
        this.player.obeliskDebtFloor = this.floor;
        return true;
    }

    canEncounterObeliskCollector() {
        if (this.player?.obeliskDebt !== 'owed') return false;
        const act = Number(this.player.obeliskDebtAct);
        const floor = Number(this.player.obeliskDebtFloor);
        return Number.isInteger(act) && Number.isInteger(floor)
            && (this.act > act || (this.act === act && this.floor > floor));
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
                name: 'Архив Несказанных Имен',
                description: 'Под сводами разрушенного скриптория страницы перелистываются без ветра. Книга обещает переписать судьбу одной случайной карты, если чернилами станет твоя кровь.',
                options: [
                    {
                        text: 'Пролить 7 HP (улучшить случайную карту)',
                        action: () => {
                            if (!this.applyForbiddenManuscript()) {
                                alert('Нужно больше 7 HP и хотя бы одна карта для улучшения!');
                                return false;
                            }
                            return true;
                        }
                    },
                    {
                        text: 'Собрать потерянные монеты (+22 золота)',
                        action: () => { this.player.gold += 22; return true; }
                    },
                    { text: 'Уйти', action: () => true }
                ]
            },
            {
                name: 'Расколотый Обелиск',
                description: 'На вершине холма возвышается камень с золотыми жилами. Он может превратить часть твоей жизненной силы в богатство или подарить короткий отдых у подножия.',
                options: [
                    {
                        text: 'Отдать 4 максимальных HP (+85 золота)',
                        action: () => {
                            if (!this.applyObeliskBargain()) {
                                alert('Обелиск требует более крепкого тела!');
                                return false;
                            }
                            return true;
                        }
                    },
                    {
                        text: 'Перевести дух (+12 HP)',
                        action: () => {
                            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12);
                            return true;
                        }
                    },
                    { text: 'Уйти', action: () => true }
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
                    {
                        text: 'Очистить проклятие (20 золота)',
                        action: () => {
                            if (this.getTotalCurseBattles() <= 0) {
                                alert('На вас нет проклятия!');
                                return false;
                            }
                            if (this.player.gold < 20) {
                                alert('Недостаточно золота!');
                                return false;
                            }
                            this.player.gold -= 20;
                            this.clearTemporaryCurses();
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
        // Развилка с последствиями, сохраняющимися между комнатами и актами.
        if (this.player?.pilgrimChoice == null) {
            commonEvents.push({
                name: 'Паломник у развилки',
                description: 'Под дождём сидит странник с потухшим фонарём. Он просит немного золота, чтобы добраться до последней часовни. На ладони у него знак золотой звезды.',
                options: [
                    {
                        text: 'Помочь страннику (−20 золота)',
                        action: () => {
                            if (this.player.gold < 20) { alert('Недостаточно золота!'); return false; }
                            this.player.gold -= 20;
                            this.player.pilgrimChoice = 'helped';
                            return true;
                        }
                    },
                    {
                        text: 'Пройти мимо',
                        action: () => {
                            this.player.pilgrimChoice = 'ignored';
                            return true;
                        }
                    }
                ]
            });
        } else if (this.player.pilgrimChoice === 'helped') {
            commonEvents.push({
                name: 'Возвращение паломника',
                description: 'У ворот часовни тебя узнаёт странник со знаком золотой звезды. Он пережил дорогу благодаря твоей помощи и теперь предлагает разделить свои находки.',
                options: [
                    {
                        text: 'Принять благодарность (+50 золота)',
                        action: () => {
                            this.player.gold += 50;
                            this.player.pilgrimChoice = 'repaid';
                            return true;
                        }
                    },
                    {
                        text: 'Попросить исцеления (+22 HP)',
                        action: () => {
                            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 22);
                            this.player.pilgrimChoice = 'repaid';
                            return true;
                        }
                    }
                ]
            });
        }
        // The obelisk bargain persists in the player checkpoint and resolves only on a later floor.
        if (this.canEncounterObeliskCollector()) {
            commonEvents.push({
                name: 'Хранитель Расколотого Обелиска',
                description: 'У следующей часовни тебя встречает хранитель камня. Он узнал печать обелиска на твоей ладони и предлагает выкупить утраченную силу.',
                options: [
                    {
                        text: 'Выкупить силу (−60 золота, +4 максимальных HP)',
                        action: () => {
                            if (this.player.gold < 60) { alert('Недостаточно золота!'); return false; }
                            this.player.gold -= 60;
                            this.player.maxHp += 4;
                            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 4);
                            this.player.obeliskDebt = 'redeemed';
                            return true;
                        }
                    },
                    {
                        text: 'Отказаться от выкупа',
                        action: () => { this.player.obeliskDebt = 'forgone'; return true; }
                    }
                ]
            });
        }
        if (this.canEncounterArchiveScribe()) {
            commonEvents.push({
                name: 'Чернильный Сборщик',
                description: 'Между колоннами слышен шелест страниц. Сборщик с руками, испачканными чернилами, помнит кровь, отданную за запретное знание, и предлагает закрыть счёт.',
                options: [
                    {
                        text: 'Залечить шрам (−25 золота, +20 HP)',
                        action: () => {
                            if (this.player.gold < 25) { alert('Недостаточно золота!'); return false; }
                            this.player.gold -= 25;
                            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
                            this.player.archiveDebt = 'healed';
                            return true;
                        }
                    },
                    {
                        text: 'Продать страницу (+40 золота, метка крови на 1 бой)',
                        action: () => {
                            this.player.gold += 40;
                            this.player.bloodMarkBattles = Math.min(99,
                                Math.max(0, Number(this.player.bloodMarkBattles) || 0) + 1);
                            this.player.archiveDebt = 'sold';
                            return true;
                        }
                    },
                    {
                        text: 'Сжечь книгу',
                        action: () => { this.player.archiveDebt = 'burned'; return true; }
                    }
                ]
            });
        }
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
            'Паломник у развилки': { style: 'pilgrim', sigil: '✧', caption: 'ПУТНИК НА ПЕРЕПУТЬЕ', hint: 'Твоя доброта может пережить эту встречу.' },
            'Возвращение паломника': { style: 'pilgrim-return', sigil: '✦', caption: 'ДОБРО ВОЗВРАЩАЕТСЯ', hint: 'Старый долг оплачен. Выбери награду.' },
            'Загадочный фонтан': { style: 'fountain', sigil: '♒', caption: 'ЗАБЫТАЯ КУПЕЛЬ', hint: 'Пить из древней воды или оставить её нетронутой?' },
            'Чернильный Сборщик': { style: 'archive-scribe', sigil: '✒', caption: 'СЧЁТ ЗА КРОВЬ', hint: 'Каждое знание оставляет след.' },
            'Архив Несказанных Имен': { style: 'archive', sigil: '✒', caption: 'ЗАПРЕТНЫЕ СТРАНИЦЫ', hint: 'Иногда знание оплачивают собственной кровью.' },
            'Хранитель Расколотого Обелиска': { style: 'obelisk-collector', sigil: '⚖', caption: 'ВОЗВРАЩЕНИЕ ДОЛГА', hint: 'Можно вернуть утраченную силу, но цена всё ещё велика.' },
            'Расколотый Обелиск': { style: 'obelisk', sigil: '◇', caption: 'КАМЕНЬ ЖЕРТВОПРИНОШЕНИЯ', hint: 'Не всё богатство стоит потери сил.' },
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
                const before = this.snapshotJournalResources();
                const result = option.action();
                if (result === false) return; // Невозможная покупка/сделка не завершает событие.
                this.recordEventDecision(event, option, before);
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

    getShopPrice(card) {
        const rarity = String(card?.rarity || 'common').toLowerCase();
        if (rarity === 'rare') return 80;
        if (rarity === 'uncommon') return 50;
        return 30;
    }

    getCardUpgrade(card) {
        if (!card || card.upgraded || ['telekinesis', 'mindStrike', 'telepathicStrike'].includes(card.id)) return null;
        for (const [stat, bonus, label] of [['damage', 3, 'Урон'], ['block', 3, 'Блок'], ['heal', 2, 'Лечение']]) {
            const current = Number(card[stat]);
            if (Number.isFinite(current) && current > 0) return { stat, bonus, label, current, next: current + bonus };
        }
        return null;
    }

    upgradeCard(card) {
        const change = this.getCardUpgrade(card);
        if (!change) return false;
        card[change.stat] = change.next;
        card.upgraded = true;
        card.name = `${card.name || card.id || 'Карта'}+`;
        card.description = `${card.description || ''} · ✦ ${change.label}: ${change.next}`.trim();
        return true;
    }

    openShop() {
        const cards = Object.values(getCardsForHero(this.player.heroId));
        // Sample without replacement: one visit should never offer the same card twice.
        const pool = [...cards];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const offers = pool.slice(0, 4);
        const modal = document.createElement('div');
        modal.className = 'modal merchant-modal';
        modal.id = 'merchant-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Магазин странствующего торговца');
        const content = document.createElement('div');
        content.className = 'modal-content merchant-content';
        const heading = document.createElement('h3');
        heading.textContent = '⚖️ Странствующий торговец';
        const balance = document.createElement('p');
        balance.className = 'merchant-balance';
        const description = document.createElement('p');
        description.className = 'merchant-description';
        description.textContent = 'Выбирайте улучшения для своего забега. Можно купить несколько товаров.';
        const shelf = document.createElement('div');
        shelf.className = 'merchant-shelf';
        const stock = [];
        const renderBalance = () => {
            balance.textContent = `💰 Ваше золото: ${this.player.gold}`;
            stock.forEach(({ button, price, sold }) => {
                button.disabled = sold() || this.player.gold < price;
                if (!sold()) button.textContent = this.player.gold >= price ? `Купить · ${price} 💰` : `Нужно ${price} 💰`;
            });
        };
        offers.forEach(card => {
            const price = this.getShopPrice(card);
            const item = document.createElement('article');
            item.className = 'merchant-item';
            const name = document.createElement('strong');
            name.textContent = `${card.emoji || '🃏'} ${card.name}`;
            const meta = document.createElement('small');
            meta.textContent = `${CardArt.rarity(card).label} · Энергия: ${card.cost}`;
            const effect = document.createElement('p');
            effect.textContent = card.description || '';
            const button = document.createElement('button');
            button.type = 'button';
            let purchased = false;
            button.onclick = () => {
                if (purchased || this.player.gold < price) return;
                this.player.gold -= price;
                this.player.deck.push({ ...card });
                refreshUpgradeOptions();
                purchased = true;
                button.textContent = '✓ Куплено';
                renderBalance();
            };
            stock.push({ button, price, sold: () => purchased });
            item.append(name, meta, effect, button);
            shelf.appendChild(item);
        });
        const healPrice = 35;
        const healAmount = Math.max(1, Math.floor(this.player.maxHp * 0.2));
        const heal = document.createElement('article');
        heal.className = 'merchant-item merchant-heal';
        const healName = document.createElement('strong');
        healName.textContent = '❤️ Зелье исцеления';
        const healDesc = document.createElement('p');
        healDesc.textContent = `Восстанавливает до ${healAmount} здоровья. Один раз за посещение.`;
        const healButton = document.createElement('button');
        healButton.type = 'button';
        let healed = false;
        healButton.onclick = () => {
            if (healed || this.player.gold < healPrice || this.player.hp >= this.player.maxHp) return;
            this.player.gold -= healPrice;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
            healed = true;
            healButton.textContent = '✓ Выпито';
            renderBalance();
        };
        stock.push({
            button: healButton, price: healPrice,
            sold: () => healed || this.player.hp >= this.player.maxHp
        });
        heal.append(healName, healDesc, healButton);
        shelf.appendChild(heal);
        // Deck thinning is a strategic purchase, not an automatic removal.
        const removalPrice = 65;
        const removal = document.createElement('article');
        removal.className = 'merchant-item merchant-removal';
        const removalName = document.createElement('strong');
        removalName.textContent = '✂️ Очистка колоды';
        const removalDesc = document.createElement('p');
        removalDesc.textContent = 'Навсегда уберите одну карту из текущей колоды. Один раз за посещение. Минимум 5 карт.';
        const removalSelect = document.createElement('select');
        removalSelect.className = 'merchant-removal-select';
        removalSelect.setAttribute('aria-label', 'Карта для удаления из колоды');
        this.player.deck.forEach((card, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = `${index + 1}. ${card.name || card.id || 'Безымянная карта'}`;
            removalSelect.appendChild(option);
        });
        const removalButton = document.createElement('button');
        removalButton.type = 'button';
        let removed = false;
        removalButton.onclick = () => {
            if (removed || this.player.gold < removalPrice || this.player.deck.length <= 5) return;
            const index = Number(removalSelect.value);
            if (!Number.isInteger(index) || index < 0 || index >= this.player.deck.length) return;
            this.player.gold -= removalPrice;
            this.player.deck.splice(index, 1);
            refreshUpgradeOptions();
            removed = true;
            removalButton.textContent = '✓ Карта удалена';
            removalSelect.disabled = true;
            renderBalance();
        };
        stock.push({
            button: removalButton, price: removalPrice,
            sold: () => removed || this.player.deck.length <= 5
        });
        removal.append(removalName, removalDesc, removalSelect, removalButton);
        shelf.appendChild(removal);
        // Enhance the actual deck copy: BattleCards reads these same numeric fields.
        const upgradePrice = 75;
        const upgrade = document.createElement('article');
        upgrade.className = 'merchant-item merchant-upgrade';
        const upgradeName = document.createElement('strong');
        upgradeName.textContent = '✦ Усиление карты';
        const upgradeDesc = document.createElement('p');
        upgradeDesc.textContent = 'Усильте урон или блок на 3, лечение на 2. Один раз за посещение.';
        const upgradeSelect = document.createElement('select');
        upgradeSelect.className = 'merchant-removal-select';
        upgradeSelect.setAttribute('aria-label', 'Карта для улучшения');
        const upgradePreview = document.createElement('p');
        upgradePreview.className = 'merchant-upgrade-preview';
        const eligible = [];
        const refreshUpgradeOptions = () => {
            const previousCard = eligible[Number(upgradeSelect.value)];
            eligible.length = 0;
            this.player.deck.forEach(card => { if (this.getCardUpgrade(card)) eligible.push(card); });
            upgradeSelect.innerHTML = '';
            eligible.forEach((card, index) => {
                const option = document.createElement('option');
                option.value = String(index);
                option.textContent = card.name || card.id || 'Карта';
                upgradeSelect.appendChild(option);
            });
            const retained = eligible.indexOf(previousCard);
            upgradeSelect.value = String(retained >= 0 ? retained : 0);
            const selected = eligible[Number(upgradeSelect.value)];
            const change = this.getCardUpgrade(selected);
            upgradePreview.textContent = change ? `${change.label}: ${change.current} → ${change.next}` : 'Нет карт, которые можно улучшить';
        };
        upgradeSelect.onchange = () => {
            const change = this.getCardUpgrade(eligible[Number(upgradeSelect.value)]);
            upgradePreview.textContent = change ? `${change.label}: ${change.current} → ${change.next}` : 'Выберите карту';
        };
        const upgradeButton = document.createElement('button');
        upgradeButton.type = 'button';
        let upgraded = false;
        upgradeButton.onclick = () => {
            if (upgraded || this.player.gold < upgradePrice) return;
            const card = eligible[Number(upgradeSelect.value)];
            if (!card || !this.player.deck.includes(card) || !this.upgradeCard(card)) return;
            this.player.gold -= upgradePrice;
            upgraded = true;
            upgradeButton.textContent = '✓ Карта улучшена';
            upgradeSelect.disabled = true;
            renderBalance();
        };
        stock.push({ button: upgradeButton, price: upgradePrice, sold: () => upgraded || eligible.length === 0 });
        upgrade.append(upgradeName, upgradeDesc, upgradeSelect, upgradePreview, upgradeButton);
        shelf.appendChild(upgrade);
        refreshUpgradeOptions();
        const leave = document.createElement('button');
        leave.type = 'button';
        leave.className = 'merchant-leave';
        leave.textContent = 'Продолжить путь →';
        leave.onclick = () => { modal.remove(); this.continueJourney(); };
        content.append(heading, balance, description, shelf, leave);
        modal.appendChild(content);
        document.body.appendChild(modal);
        renderBalance();
        if (this.player.hp >= this.player.maxHp) healButton.textContent = 'Здоровье полное';
        if (this.player.deck.length <= 5) removalButton.textContent = 'Нужно больше 5 карт';
        if (!eligible.length) upgradeButton.textContent = 'Нет доступных карт';
        leave.focus();
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
            this.recordFinishedRun(true);
            this.runSave.clear();
            this.showMenu();
            this.showActTransition(completedAct, true);
        }
    }

    getRunSummary(victory) {
        const player = this.player || {};
        const wins = Math.max(0, Number(player.battleWins) || 0);
        const elites = Math.max(0, Number(player.eliteWins) || 0);
        const bosses = Math.max(0, Number(player.bossWins) || 0);
        const cards = Array.isArray(player.deck) ? player.deck.length : 0;
        const relics = Array.isArray(player.relics) ? player.relics.length : 0;
        const decisions = Array.isArray(player.journalLog) ? player.journalLog.length : 0;
        const score = Math.max(0, Math.floor(wins * 25 + elites * 75 + bosses * 150
            + relics * 30 + decisions * 10 + (Number(player.gold) || 0)
            + (victory ? 500 : 0)));
        return {
            victory: Boolean(victory), act: this.act, floor: this.floor + 1,
            hero: String(player.name || 'Неизвестный герой'),
            hp: Math.max(0, Number(player.hp) || 0),
            maxHp: Math.max(0, Number(player.maxHp) || 0),
            gold: Math.max(0, Number(player.gold) || 0),
            wins, elites, bosses, cards, relics, decisions, score,
            rank: score >= 1250 ? 'Легенда шпиля' : score >= 650 ? 'Покоритель тьмы'
                : score >= 300 ? 'Странник собора' : 'Искатель судьбы'
        };
    }

    createRunSummaryElement(victory) {
        const stats = this.getRunSummary(victory);
        const wrap = document.createElement('section');
        wrap.className = 'cathedral-run-summary';
        wrap.setAttribute('aria-label', 'Итоги забега');
        const heading = document.createElement('h3');
        heading.textContent = '✧ Летопись восхождения';
        const subtitle = document.createElement('p');
        subtitle.className = 'cathedral-run-summary-subtitle';
        subtitle.textContent = `${stats.hero} · Акт ${stats.act}, этаж ${stats.floor}`;
        const grid = document.createElement('div');
        grid.className = 'cathedral-run-summary-grid';
        const items = [
            ['⚔️ Побед', stats.wins], ['☠️ Элитных', stats.elites],
            ['👑 Боссов', stats.bosses], ['❤️ Здоровье', `${stats.hp}/${stats.maxHp}`],
            ['🃏 Карт', stats.cards], ['💎 Реликвий', stats.relics],
            ['📜 Решений', stats.decisions], ['💰 Золото', stats.gold]
        ];
        items.forEach(([label, value]) => {
            const cell = document.createElement('div');
            const name = document.createElement('span');
            name.textContent = label;
            const number = document.createElement('strong');
            number.textContent = String(value);
            cell.append(name, number);
            grid.appendChild(cell);
        });
        const score = document.createElement('p');
        score.className = 'cathedral-run-summary-score';
        score.textContent = `✦ ${stats.rank} · ${stats.score} очков`;
        wrap.append(heading, subtitle, grid, score);
        return wrap;
    }

    showRunResult(victory) {
        document.getElementById('cathedral-run-result')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'cathedral-run-result';
        overlay.className = 'cathedral-act-transition';
        overlay.dataset.actTheme = victory ? 'victory' : 'defeat';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', victory ? 'Итоги победы' : 'Итоги поражения');
        const panel = document.createElement('div');
        panel.className = 'cathedral-transition-panel cathedral-result-panel';
        const title = document.createElement('h2');
        title.textContent = victory ? '✦ Шпиль покорён' : '☽ Путь оборвался';
        const description = document.createElement('p');
        description.className = 'cathedral-transition-subtitle';
        description.textContent = victory
            ? 'Твоя история останется в стенах собора.'
            : 'Собор запомнит этот путь. Следующее восхождение начнётся иначе.';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cathedral-transition-continue';
        button.textContent = 'Вернуться в главное меню →';
        button.onclick = () => overlay.remove();
        panel.append(title, description, this.createRunSummaryElement(victory), button);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        button.focus();
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
        if (isVictory) {
            const panel = overlay.querySelector('.cathedral-transition-panel');
            panel.insertBefore(this.createRunSummaryElement(true),
                overlay.querySelector('.cathedral-transition-continue'));
        }
        const continueButton = overlay.querySelector('.cathedral-transition-continue');
        continueButton.addEventListener('click', () => overlay.remove(), { once: true });
        document.body.appendChild(overlay);
        continueButton.focus();
    }

    rest() {
        const modal = document.createElement('div');
        modal.className = 'modal campfire-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Привал у костра');
        const panel = document.createElement('div');
        panel.className = 'modal-content campfire-content';
        const title = document.createElement('h3');
        title.textContent = '🏕️ Привал у костра';
        const intro = document.createElement('p');
        intro.textContent = 'Перед продолжением пути выберите одну награду.';
        const choices = document.createElement('div');
        choices.className = 'campfire-choices';
        const healAmount = Math.max(1, Math.floor(this.player.maxHp * 0.3));
        const actualHeal = Math.min(healAmount, this.player.maxHp - this.player.hp);
        const healButton = document.createElement('button');
        healButton.type = 'button';
        healButton.className = 'campfire-choice campfire-heal';
        healButton.textContent = `❤️ Отдохнуть · +${actualHeal} здоровья`;
        healButton.disabled = actualHeal <= 0;
        const forge = document.createElement('div');
        forge.className = 'campfire-forge';
        const forgeLabel = document.createElement('label');
        forgeLabel.textContent = '✦ Улучшить одну карту бесплатно';
        const selector = document.createElement('select');
        selector.className = 'merchant-removal-select';
        selector.setAttribute('aria-label', 'Карта для улучшения на привале');
        const eligible = this.player.deck.filter(card => this.getCardUpgrade(card));
        eligible.forEach((card, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = card.name || card.id || 'Карта';
            selector.appendChild(option);
        });
        selector.value = '0';
        selector.disabled = eligible.length === 0;
        const preview = document.createElement('p');
        preview.className = 'campfire-preview';
        const renderPreview = () => {
            const change = this.getCardUpgrade(eligible[Number(selector.value)]);
            preview.textContent = change
                ? `${change.label}: ${change.current} → ${change.next}`
                : 'Нет карт, доступных для улучшения';
        };
        selector.onchange = renderPreview;
        renderPreview();
        const upgradeButton = document.createElement('button');
        upgradeButton.type = 'button';
        upgradeButton.className = 'campfire-choice campfire-upgrade';
        upgradeButton.textContent = '✦ Закалить карту';
        upgradeButton.disabled = eligible.length === 0;
        const finish = () => { modal.remove(); this.continueJourney(); };
        healButton.onclick = () => {
            if (this.player.hp >= this.player.maxHp) return;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
            finish();
        };
        upgradeButton.onclick = () => {
            const card = eligible[Number(selector.value)];
            if (!card || !this.player.deck.includes(card) || !this.upgradeCard(card)) return;
            finish();
        };
        forge.append(forgeLabel, selector, preview, upgradeButton);
        choices.append(healButton, forge);
        panel.append(title, intro, choices);
        if (healButton.disabled && upgradeButton.disabled) {
            const continueButton = document.createElement('button');
            continueButton.type = 'button';
            continueButton.className = 'campfire-choice campfire-continue';
            continueButton.textContent = 'Продолжить путь →';
            continueButton.onclick = finish;
            panel.appendChild(continueButton);
        }
        modal.appendChild(panel);
        document.body.appendChild(modal);
        (healButton.disabled ? (upgradeButton.disabled ? panel.children[3] : upgradeButton) : healButton).focus();
    }
}

function hideAllScreens() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hero-select').style.display = 'none';
    document.getElementById('battle-screen').style.display = 'none';
    document.getElementById('map-screen').style.display = 'none';
}