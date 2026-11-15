// Безопасный каталог портретов врагов: неизвестные ID используют старый символ.
const EnemyArt = Object.freeze({
    portraits: Object.freeze({
        slime: Object.freeze({ src: 'assets/enemies/slime.svg', alt: 'Слизень Бездны' }),
        goblin: Object.freeze({ src: 'assets/enemies/goblin.svg', alt: 'Гоблин-налётчик' }),
        skeleton: Object.freeze({ src: 'assets/enemies/skeleton.svg', alt: 'Страж костницы' }),
        wolf: Object.freeze({ src: 'assets/enemies/wolf.svg', alt: 'Сумрачный волк' })
    }),
    get(id) {
        return Object.prototype.hasOwnProperty.call(this.portraits, id) ? this.portraits[id] : null;
    },
    render(container, enemy) {
        const art = this.get(enemy?.id);
        container.replaceChildren();
        container.classList.toggle('enemy-has-portrait', Boolean(art));
        if (!art) {
            container.textContent = enemy?.emoji || '✦';
            return;
        }
        const image = document.createElement('img');
        image.className = 'enemy-portrait';
        image.src = art.src;
        image.alt = art.alt;
        image.decoding = 'async';
        container.appendChild(image);
    }
});
