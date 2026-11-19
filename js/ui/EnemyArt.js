// Безопасный каталог портретов врагов: неизвестные ID используют старый символ.
const EnemyArt = Object.freeze({
    portraits: Object.freeze({
        slime: Object.freeze({ src: 'assets/enemies/slime.svg', alt: 'Слизень Бездны' }),
        goblin: Object.freeze({ src: 'assets/enemies/goblin.svg', alt: 'Гоблин-налётчик' }),
        skeleton: Object.freeze({ src: 'assets/enemies/skeleton.svg', alt: 'Страж костницы' }),
        wolf: Object.freeze({ src: 'assets/enemies/wolf.svg', alt: 'Сумрачный волк' }),
        forestBoss: Object.freeze({ src: 'assets/enemies/forest-boss.svg', alt: 'Древний Энт — страж корней' }),
        caveBoss: Object.freeze({ src: 'assets/enemies/cave-boss.svg', alt: 'Каменный Голем — сердце разлома' }),
        castleBoss: Object.freeze({ src: 'assets/enemies/castle-boss.svg', alt: 'Тёмный Лорд — владыка проклятого шпиля' }),
        veiledCollector: Object.freeze({ src: 'assets/enemies/veiled-collector.svg', alt: 'Сборщик Последнего Долга — тайный взыскатель' })
    }),
    get(id) {
        return Object.prototype.hasOwnProperty.call(this.portraits, id) ? this.portraits[id] : null;
    },
    render(container, enemy) {
        const art = this.get(enemy?.id);
        container.replaceChildren();
        container.classList.toggle('enemy-has-portrait', Boolean(art));
        container.classList.toggle('enemy-is-boss', Boolean(enemy?.isBoss));
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
