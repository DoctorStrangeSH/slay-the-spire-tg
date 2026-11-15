// Визуальная реакция боя. Никаких изменений урона, статусов или очередности ходов.
const BattleFeedback = Object.freeze({
    timers: new Map(),
    entranceTimers: new Map(),
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
        if (after.enemyHp < before.enemyHp) this.flash('enemy-area', 'fx-damage');
        else if (after.enemyBlock > before.enemyBlock) this.flash('enemy-area', 'fx-shield');
        if (after.heroHp < before.heroHp) this.flash('player-area', 'fx-damage');
        else if (after.heroBlock > before.heroBlock) this.flash('player-area', 'fx-shield');
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
