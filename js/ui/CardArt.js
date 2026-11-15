// Единый каталог авторских иллюстраций карт. Изолирован от игровой механики.
const CardArt = Object.freeze({
    types: Object.freeze({
        attack: Object.freeze({ src: 'assets/cards/attack.svg', alt: 'Клинок пепельной клятвы' }),
        skill: Object.freeze({ src: 'assets/cards/skill.svg', alt: 'Печать бастиона' }),
        power: Object.freeze({ src: 'assets/cards/power.svg', alt: 'Хроника ритуала' }),
        building: Object.freeze({ src: 'assets/cards/building.svg', alt: 'Орудийная башня' })
    }),

    signature: Object.freeze({
        bloodCut: Object.freeze({ src: 'assets/cards/blood-cut.svg', alt: 'Кровавый порез — алый росчерк клинка' }),
        retaliationStrike: Object.freeze({ src: 'assets/cards/retaliation-strike.svg', alt: 'Удар возмездия — клинок в золотой вспышке' }),
        berserkStance: Object.freeze({ src: 'assets/cards/berserk-stance.svg', alt: 'Стойка берсерка — щит с багровой руной' })
    }),

    rarity(card) {
        const rarity = card?.rarity;
        if (rarity === 'rare') return { key: 'rare', label: 'Редкая', sigil: '✦✦' };
        if (rarity === 'uncommon') return { key: 'uncommon', label: 'Необычная', sigil: '✦' };
        return { key: 'common', label: 'Обычная', sigil: '·' };
    },

    get(type) {
        return Object.prototype.hasOwnProperty.call(this.types, type) ? this.types[type] : null;
    },

    resolve(card) {
        const id = typeof card?.id === 'string' ? card.id : '';
        return Object.prototype.hasOwnProperty.call(this.signature, id)
            ? this.signature[id] : this.get(card?.type);
    },

    markup(card, cssClass = 'card-art') {
        const art = this.resolve(card);
        // Для неизвестных типов из старых сохранений остаётся безопасная нейтральная иконка.
        if (!art) return '<span class="card-art-fallback" aria-hidden="true">✦</span>';
        return `<img class="${cssClass}" src="${art.src}" alt="${art.alt}" loading="lazy" decoding="async">`;
    }
});
