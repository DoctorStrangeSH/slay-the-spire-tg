// Единый каталог авторских иллюстраций карт. Изолирован от игровой механики.
const CardArt = Object.freeze({
    types: Object.freeze({
        attack: Object.freeze({ src: 'assets/cards/attack.svg', alt: 'Клинок пепельной клятвы' }),
        skill: Object.freeze({ src: 'assets/cards/skill.svg', alt: 'Печать бастиона' }),
        power: Object.freeze({ src: 'assets/cards/power.svg', alt: 'Хроника ритуала' }),
        building: Object.freeze({ src: 'assets/cards/building.svg', alt: 'Орудийная башня' })
    }),

    get(type) {
        return Object.prototype.hasOwnProperty.call(this.types, type) ? this.types[type] : null;
    },

    markup(card, cssClass = 'card-art') {
        const art = this.get(card?.type);
        // Для неизвестных типов из старых сохранений остаётся безопасная нейтральная иконка.
        if (!art) return '<span class="card-art-fallback" aria-hidden="true">✦</span>';
        return `<img class="${cssClass}" src="${art.src}" alt="${art.alt}" loading="lazy" decoding="async">`;
    }
});
