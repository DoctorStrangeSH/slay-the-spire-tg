// UI боевого экрана
const BattleUI = {
    update(game) {
        if (!game.currentBattle) return;

        const battle = game.currentBattle;

        // Враг
        document.getElementById('enemy-sprite').textContent = battle.enemy.emoji;
        document.getElementById('enemy-name').textContent = battle.enemy.name;
        document.getElementById('enemy-hp-fill').style.width =
            `${(battle.enemy.hp / battle.enemy.maxHp) * 100}%`;
        document.getElementById('enemy-hp-text').textContent =
            `❤️ ${Math.floor(battle.enemy.hp)}/${Math.floor(battle.enemy.maxHp)}`;
        document.getElementById('enemy-block').textContent =
            `🛡️ Броня: ${Math.floor(battle.enemyBlock)}`;

        const intentInfo = battle.getEnemyIntentInfo();
        if (intentInfo.type === 'attack') {
            document.getElementById('enemy-intent').textContent =
                `⚔️ Атака: ${intentInfo.damage} урона`;
        } else {
            document.getElementById('enemy-intent').textContent =
                `🛡️ Защита: +${intentInfo.block} брони`;
        }

        const enemyEffects = [];
        if (battle.statusEffects.enemy.strength > 0) enemyEffects.push(`💪 Сила: ${battle.statusEffects.enemy.strength}`);
        if (battle.statusEffects.enemy.vulnerable > 0) enemyEffects.push(`🎯 Уязвимость: ${battle.statusEffects.enemy.vulnerable}`);
        if (battle.statusEffects.enemy.weak > 0) enemyEffects.push(`📉 Слабость: ${battle.statusEffects.enemy.weak}`);
        if (battle.statusEffects.enemy.poison > 0) enemyEffects.push(`☠️ Яд: ${battle.statusEffects.enemy.poison}`);
        if (battle.statusEffects.enemy.bleed > 0) enemyEffects.push(`🩸 Кровотечение: ${battle.statusEffects.enemy.bleed}`);
        document.getElementById('enemy-effects').textContent = enemyEffects.join(' | ');

        // Игрок
        document.getElementById('player-name').textContent = game.player.name;
        document.getElementById('player-hp-fill').style.width =
            `${(game.player.hp / game.player.maxHp) * 100}%`;
        document.getElementById('player-hp-text').textContent =
            `❤️ ${Math.floor(game.player.hp)}/${Math.floor(game.player.maxHp)}`;
        document.getElementById('player-energy').textContent =
            `⚡ Энергия: ${battle.energy}/${battle.maxEnergy}`;
        document.getElementById('player-block').textContent =
            `🛡️ Броня: ${Math.floor(battle.block)}`;

        const playerEffects = [];
        if (battle.statusEffects.player.strength > 0) playerEffects.push(`💪 Сила: ${battle.statusEffects.player.strength}`);
        if (battle.statusEffects.player.vulnerable > 0) playerEffects.push(`🎯 Уязвимость: ${battle.statusEffects.player.vulnerable}`);
        if (battle.statusEffects.player.weak > 0) playerEffects.push(`📉 Слабость: ${battle.statusEffects.player.weak}`);
        if (battle.statusEffects.player.poison > 0) playerEffects.push(`☠️ Яд: ${battle.statusEffects.player.poison}`);
        if (battle.statusEffects.player.thorns > 0) playerEffects.push(`🌵 Шипы: ${battle.statusEffects.player.thorns}`);
        if (battle.statusEffects.player.bleed > 0) playerEffects.push(`🩸 Кровотечение: ${battle.statusEffects.player.bleed}`);
        document.getElementById('player-effects').textContent = playerEffects.join(' | ');

        // Карты в руке
        const handArea = document.getElementById('hand-area');
        handArea.innerHTML = '';

        battle.hand.forEach((card, index) => {
            const cardElement = this.createCardElement(card, index, battle);
            handArea.appendChild(cardElement);
        });

        // Колоды
        document.getElementById('draw-count').textContent = battle.drawPile.length;
        document.getElementById('discard-count').textContent = battle.discardPile.length;
    },

    createCardElement(card, index, battle) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card card-type-${card.type}`;

        // Подсветка выбранных карт
        if (battle.selectedCards.includes(index)) {
            cardDiv.classList.add('selected');
        }

        cardDiv.innerHTML = `
            <div class="card-cost">${card.cost}</div>
            <div class="card-name">${card.emoji} ${card.name}</div>
            <div class="card-description">${card.description}</div>
        `;

        cardDiv.onclick = () => game.selectCard(index);
        return cardDiv;
    },

    showPreview(description) {
        // Удаляем старое превью
        this.hidePreview();

        if (!description || description === '') return;

        // Показываем превью эффекта
        const previewDiv = document.createElement('div');
        previewDiv.id = 'card-preview';
        previewDiv.className = 'card-preview';
        previewDiv.textContent = description;

        document.getElementById('battle-screen').appendChild(previewDiv);
    },

    hidePreview() {
        const preview = document.getElementById('card-preview');
        if (preview) {
            preview.remove();
        }
    }
};