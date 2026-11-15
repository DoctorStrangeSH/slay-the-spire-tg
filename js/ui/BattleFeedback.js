// Визуальная реакция боя. Никаких изменений урона, статусов или очередности ходов.
const BattleFeedback = Object.freeze({
    timers: new Map(),
    entranceTimers: new Map(),
    entranceMarks: new Map(),
    floatTimers: new Map(),
    floatNodes: new Map(),
    cardFxState: { timer: null, node: null },
    bossAttackState: { timer: null, node: null },
    relicState: { timer: null, node: null },
    relicAcquired(relic) {
        if (!relic || typeof relic.name !== 'string') return;
        if (this.relicState.timer) clearTimeout(this.relicState.timer);
        this.relicState.node?.remove();
        const overlay = document.createElement('div');
        overlay.className = 'relic-acquired-toast';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        const sign = document.createElement('span');
        sign.className = 'relic-acquired-sigil';
        sign.setAttribute('aria-hidden', 'true');
        sign.textContent = relic.emoji || '✦';
        const words = document.createElement('div');
        const kicker = document.createElement('small');
        kicker.textContent = 'НОВАЯ РЕЛИКВИЯ';
        const title = document.createElement('strong');
        title.textContent = relic.name;
        const description = document.createElement('span');
        description.textContent = relic.description || '';
        words.appendChild(kicker);
        words.appendChild(title);
        words.appendChild(description);
        overlay.appendChild(sign);
        overlay.appendChild(words);
        document.body.appendChild(overlay);
        this.relicState.node = overlay;
        this.relicState.timer = setTimeout(() => {
            overlay.remove();
            this.relicState.node = null;
            this.relicState.timer = null;
        }, 4200);
    },
    bossAttack(enemyId) {
        const attacks = {
            forestBoss: ['roots', '♣'],
            caveBoss: ['stone', '◆'],
            castleBoss: ['curse', '✶']
        };
        if (!Object.prototype.hasOwnProperty.call(attacks, enemyId)) return;
        const screen = document.getElementById('battle-screen');
        if (!screen) return;
        if (this.bossAttackState.timer) clearTimeout(this.bossAttackState.timer);
        this.bossAttackState.node?.remove();
        const marker = document.createElement('div');
        marker.className = `boss-attack-fx boss-attack-fx--${attacks[enemyId][0]}`;
        marker.setAttribute('aria-hidden', 'true');
        const glyph = document.createElement('span');
        glyph.className = 'boss-attack-glyph';
        glyph.textContent = attacks[enemyId][1];
        marker.appendChild(glyph);
        screen.appendChild(marker);
        this.bossAttackState.node = marker;
        this.bossAttackState.timer = setTimeout(() => {
            marker.remove();
            this.bossAttackState.node = null;
            this.bossAttackState.timer = null;
        }, 720);
    },
    cardsPlayed(types, heroId = null, cardIds = []) {
        if (!Array.isArray(types) || !types.length) return;
        const screen = document.getElementById('battle-screen');
        if (!screen) return;
        const known = types.filter(type => ['attack', 'skill', 'power', 'building'].includes(type));
        if (!known.length) return;
        const priority = ['attack', 'power', 'building', 'skill'];
        const style = priority.find(type => known.includes(type));
        const glyph = { attack: '╱', skill: '◇', power: '✧', building: '⬡' };
        const hero = ['berserk', 'engineer', 'psyker'].includes(heroId) ? heroId : 'neutral';
        const signatureIds = {
            berserk: ['bloodCut', 'retaliationStrike', 'berserkStance'],
            engineer: ['rocket', 'flamethrower', 'blueprints'],
            psyker: ['psyStrike', 'mindDestruction', 'mentalRift']
        };
        const signatures = {
            bloodCut: ['🩸', 'Кровавая клятва'],
            retaliationStrike: ['⚔', 'Возмездие'],
            berserkStance: ['✹', 'Ярость'],
            rocket: ['✦', 'Залп'],
            flamethrower: ['🔥', 'Пламя'],
            blueprints: ['⬡', 'Чертежи'],
            psyStrike: ['✧', 'Пси-удар'],
            mindDestruction: ['☽', 'Разлом разума'],
            mentalRift: ['◇', 'Ментальный разлом']
        };
        const signatureId = Array.isArray(cardIds)
            ? (signatureIds[hero] || []).find(id => cardIds.includes(id)) : null;
        const signature = signatureId ? signatures[signatureId] : null;
        if (this.cardFxState.timer) clearTimeout(this.cardFxState.timer);
        this.cardFxState.node?.remove();
        const marker = document.createElement('div');
        marker.className = `card-cast-fx card-cast-fx--${style} card-cast-fx--${hero}`;
        marker.setAttribute('aria-hidden', 'true');
        const symbol = document.createElement('span');
        symbol.className = 'card-cast-glyph';
        symbol.textContent = signature ? signature[0] : glyph[style];
        marker.appendChild(symbol);
        if (signature) {
            const caption = document.createElement('span');
            caption.className = 'card-cast-signature';
            caption.textContent = signature[1];
            marker.appendChild(caption);
        }
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
    enter(id, enemy = null) {
        const element = document.getElementById(id);
        if (!element) return;
        const previous = this.entranceTimers.get(id);
        if (previous) clearTimeout(previous);
        this.entranceMarks.get(id)?.remove();
        this.entranceMarks.delete(id);
        element.classList.remove('fx-enter');
        void element.offsetWidth;
        element.classList.add('fx-enter');

        // Боевой знак возникает один раз при открытии боя, а не при перерисовке HP.
        const bossGlyphs = {
            forestBoss: ['forest', '♣'],
            caveBoss: ['cave', '◆'],
            castleBoss: ['castle', '✶']
        };
        const glyph = enemy?.isBoss && Object.prototype.hasOwnProperty.call(bossGlyphs, enemy.id)
            ? bossGlyphs[enemy.id] : null;
        if (id === 'enemy-area' && glyph) {
            const marker = document.createElement('div');
            marker.className = `boss-entry-effect boss-entry-effect--${glyph[0]}`;
            marker.setAttribute('aria-hidden', 'true');
            const sigil = document.createElement('span');
            sigil.className = 'boss-entry-glyph';
            sigil.textContent = glyph[1];
            marker.appendChild(sigil);
            element.appendChild(marker);
            this.entranceMarks.set(id, marker);
        }
        const timer = setTimeout(() => {
            element.classList.remove('fx-enter');
            this.entranceMarks.get(id)?.remove();
            this.entranceMarks.delete(id);
            this.entranceTimers.delete(id);
        }, 900);
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
