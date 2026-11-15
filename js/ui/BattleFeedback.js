// Визуальная реакция боя. Никаких изменений урона, статусов или очередности ходов.
const BattleFeedback = Object.freeze({
    timers: new Map(),
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
    }
});
