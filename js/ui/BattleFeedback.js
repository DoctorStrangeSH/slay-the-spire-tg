// Визуальная реакция боя. Никаких изменений урона, статусов или очередности ходов.
const BattleFeedback = Object.freeze({
    timers: new Map(),
    entranceTimers: new Map(),
    floatTimers: new Map(),
    floatNodes: new Map(),
    cardFxState: { timer: null, node: null },
    cardsPlayed(types) {
        if (!Array.isArray(types) || !types.length) return;
        const screen = document.getElementById('battle-screen');
        if (!screen) return;
        const known = types.filter(type => ['attack', 'skill', 'power', 'building'].includes(type));
        if (!known.length) return;
        const priority = ['attack', 'power', 'building', 'skill'];
        const style = priority.find(type => known.includes(type));
        const glyph = { attack: '╱', skill: '◇', power: '✧', building: '⬡' };
        if (this.cardFxState.timer) clearTimeout(this.cardFxState.timer);
        this.cardFxState.node?.remove();
        const marker = document.createElement('div');
        marker.className = `card-cast-fx card-cast-fx--${style}`;
        marker.setAttribute('aria-hidden', 'true');
        const symbol = document.createElement('span');
        symbol.className = 'card-cast-glyph';
        symbol.textContent = glyph[style];
        marker.appendChild(symbol);
        if (known.length > 1) {
            const count = document.createElement('span');
            count.className = 'card-cast-combo';
            count.textContent = `×${known.length}`;
            marker.appendChild(count);
        }
        screen.appendChild(marker);
        this.cardFxState.node = marker;
        this.cardFxState.timer = setTimeout(() => {
            marker.remove();
            this.cardFxState.node = null;
            this.cardFxState.timer = null;
        }, 850);
    },
    float(id, amount, kind) {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const area = document.getElementById(id);
        if (!area) return;
        const previousTimer = this.floatTimers.get(id);
        if (previousTimer) clearTimeout(previousTimer);
        this.floatNodes.get(id)?.remove();
        const marker = document.createElement('span');
        marker.className = `battle-float battle-float--${kind}`;
        marker.textContent = kind === 'damage' ? `−${amount}` : `+${amount} 🛡`;
        marker.setAttribute('aria-hidden', 'true');
        area.appendChild(marker);
        this.floatNodes.set(id, marker);
        const timer = setTimeout(() => {
            marker.remove();
            this.floatNodes.delete(id);
            this.floatTimers.delete(id);
        }, 950);
        this.floatTimers.set(id, timer);
    },
    enter(id) {
        const element = document.getElementById(id);
        if (!element) return;
        const previous = this.entranceTimers.get(id);
        if (previous) clearTimeout(previous);
        element.classList.remove('fx-enter');
        void element.offsetWidth;
        element.classList.add('fx-enter');
        const timer = setTimeout(() => {
            element.classList.remove('fx-enter');
            this.entranceTimers.delete(id);
        }, 780);
        this.entranceTimers.set(id, timer);
    },
    snapshot(battle) {
        return {
            enemyHp: battle?.enemy?.hp ?? 0,
            enemyBlock: battle?.enemyBlock ?? 0,
            heroHp: battle?.player?.hp ?? 0,
            heroBlock: battle?.block ?? 0
        };
    },
    flash(id, effect) {
        const element = document.getElementById(id);
        if (!element) return;
        const previous = this.timers.get(id);
        if (previous) clearTimeout(previous);
        element.classList.remove('fx-damage', 'fx-shield');
        // Перезапускает анимацию, когда игрок быстро разыгрывает несколько карт.
        void element.offsetWidth;
        element.classList.add(effect);
        const timer = setTimeout(() => {
            element.classList.remove(effect);
            this.timers.delete(id);
        }, 600);
        this.timers.set(id, timer);
    },
    show(before, battle) {
        if (!before || !battle) return;
        const after = this.snapshot(battle);
        // Урон важнее нового блока, если оба изменения произошли за ход.
        if (after.enemyHp < before.enemyHp) {
            this.flash('enemy-area', 'fx-damage');
            this.float('enemy-area', before.enemyHp - after.enemyHp, 'damage');
        } else if (after.enemyBlock > before.enemyBlock) {
            this.flash('enemy-area', 'fx-shield');
            this.float('enemy-area', after.enemyBlock - before.enemyBlock, 'shield');
        }
        if (after.heroHp < before.heroHp) {
            this.flash('player-area', 'fx-damage');
            this.float('player-area', before.heroHp - after.heroHp, 'damage');
        } else if (after.heroBlock > before.heroBlock) {
            this.flash('player-area', 'fx-shield');
            this.float('player-area', after.heroBlock - before.heroBlock, 'shield');
        }
    },
    result({ victory, gold = 0, onContinue }) {
        if (document.getElementById('battle-result-modal')) return;
        const defeatedArea = document.getElementById(victory ? 'enemy-area' : 'player-area');
        defeatedArea?.classList.add('fx-defeated');

        const modal = document.createElement('div');
        modal.id = 'battle-result-modal';
        modal.className = 'modal battle-result-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'battle-result-heading');

        const content = document.createElement('div');
        content.className = 'modal-content battle-result-content';
        const sigil = document.createElement('div');
        sigil.className = 'battle-result-sigil';
        sigil.setAttribute('aria-hidden', 'true');
        sigil.textContent = victory ? '✦' : '✧';

        const title = document.createElement('h3');
        title.id = 'battle-result-heading';
        title.textContent = victory ? 'Победа' : 'Поражение';
        const message = document.createElement('p');
        message.textContent = victory
            ? 'Проклятый шпиль уступает дорогу. Впереди новые испытания.'
            : 'Пепел хранит память о павшем герое. Следующий путь может сложиться иначе.';
        content.append(sigil, title, message);
        if (victory) {
            const reward = document.createElement('p');
            reward.className = 'battle-result-reward';
            reward.textContent = '✦ +' + gold + ' золота';
            content.appendChild(reward);
        }
        const continueButton = document.createElement('button');
        continueButton.type = 'button';
        continueButton.textContent = victory ? 'Забрать награду →' : 'Вернуться в меню';
        continueButton.addEventListener('click', () => {
            if (continueButton.disabled) return;
            continueButton.disabled = true;
            modal.remove();
            onContinue();
        }, { once: true });
        content.appendChild(continueButton);
        modal.appendChild(content);
        document.body.appendChild(modal);
        continueButton.focus();
    }
});
