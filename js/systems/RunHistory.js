// Постоянная история завершённых восхождений отдельно от чекпоинта текущего забега.
class RunHistory {
    static get KEY() { return 'slay-and-spire-history-v1'; }
    static get MAX_RECENT() { return 20; }

    constructor(storage = typeof localStorage === 'undefined' ? null : localStorage) {
        this.storage = storage;
    }

    empty() {
        return { version: 1, runs: 0, victories: 0, defeats: 0,
            bestScore: 0, bestAct: 0, totalBattles: 0, heroes: {}, heroVictories: {}, challenges: {}, recent: [] };
    }

    read() {
        if (!this.storage) return this.empty();
        try {
            const data = JSON.parse(this.storage.getItem(RunHistory.KEY));
            if (!data || data.version !== 1 || !Array.isArray(data.recent)) return this.empty();
            return { ...this.empty(), ...data,
                heroes: data.heroes && typeof data.heroes === 'object' && !Array.isArray(data.heroes) ? data.heroes : {},
                heroVictories: data.heroVictories && typeof data.heroVictories === 'object' && !Array.isArray(data.heroVictories) ? data.heroVictories : {},
                challenges: data.challenges && typeof data.challenges === 'object' && !Array.isArray(data.challenges) ? data.challenges : {},
                recent: data.recent.slice(-RunHistory.MAX_RECENT) };
        } catch (_) {
            return this.empty();
        }
    }

    record(summary, heroId, runId) {
        if (!summary || !this.storage || !runId) return false;
        const data = this.read();
        if (data.recent.some(item => item.id === runId)) return false;
        const entry = {
            id: String(runId), victory: Boolean(summary.victory),
            hero: String(summary.hero || 'Герой'), heroId: String(heroId || 'unknown'),
            act: Number(summary.act) || 1, floor: Number(summary.floor) || 1,
            score: Math.max(0, Number(summary.score) || 0),
            wins: Math.max(0, Number(summary.wins) || 0),
            completedAt: new Date().toISOString()
        };
        data.runs += 1;
        data.victories += Number(entry.victory);
        data.defeats += Number(!entry.victory);
        data.bestScore = Math.max(data.bestScore, entry.score);
        data.bestAct = Math.max(data.bestAct, entry.act);
        data.totalBattles += entry.wins;
        data.heroes[entry.heroId] = (Number(data.heroes[entry.heroId]) || 0) + 1;
        if (entry.victory) data.heroVictories[entry.heroId] = (Number(data.heroVictories[entry.heroId]) || 0) + 1;
        data.recent = [...data.recent, entry].slice(-RunHistory.MAX_RECENT);
        try {
            this.storage.setItem(RunHistory.KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            console.warn('Не удалось сохранить историю восхождений:', error);
            return false;
        }
    }

    unlockChallenge(id) {
        if (!['berserk_last_breath', 'engineer_iron_line', 'psyker_mind_chain'].includes(id) || !this.storage) return false;
        const data = this.read();
        if (data.challenges[id]) return false;
        data.challenges[id] = true;
        try {
            this.storage.setItem(RunHistory.KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            console.warn('Не удалось сохранить испытание:', error);
            return false;
        }
    }

    achievements(data = this.read()) {
        const categoryByName = {
            'Кровавый триумф': 'berserk', 'На последнем дыхании': 'berserk',
            'Стальной разум': 'engineer', 'Железная линия': 'engineer',
            'Зрящий за гранью': 'psyker', 'Разрыв сознания': 'psyker'
        };
        return [
            { name: 'Первый шаг', description: 'Завершить первый забег', unlocked: data.runs >= 1 },
            { name: 'Покоритель шпиля', description: 'Одержать первую победу', unlocked: data.victories >= 1 },
            { name: 'Ветеран собора', description: 'Завершить 10 забегов', unlocked: data.runs >= 10 },
            { name: 'Несокрушимый', description: 'Победить трижды', unlocked: data.victories >= 3 },
            { name: 'Легенда', description: 'Набрать 1250 очков в одном забеге', unlocked: data.bestScore >= 1250 },
            { name: 'Кровавый триумф', description: 'Победить Берсерком', unlocked: (Number(data.heroVictories?.berserk) || 0) >= 1 },
            { name: 'Стальной разум', description: 'Победить Инженером', unlocked: (Number(data.heroVictories?.engineer) || 0) >= 1 },
            { name: 'Зрящий за гранью', description: 'Победить Псайкером', unlocked: (Number(data.heroVictories?.psyker) || 0) >= 1 },
            { name: 'Три судьбы', description: 'Победить каждым из трёх стартовых героев', unlocked: ['berserk', 'engineer', 'psyker'].every(id => (Number(data.heroVictories?.[id]) || 0) >= 1) },
            { name: 'На последнем дыхании', description: 'Берсерком победить босса, имея не более 20% максимального HP', unlocked: data.challenges?.berserk_last_breath === true },
            { name: 'Железная линия', description: 'Инженером победить элитного врага, сохранив не менее двух конструкций', unlocked: data.challenges?.engineer_iron_line === true },
            { name: 'Разрыв сознания', description: 'Псайкером победить элитного врага под параличом, разыграв три карты за ход', unlocked: data.challenges?.psyker_mind_chain === true }
        ].map(entry => ({ ...entry, category: categoryByName[entry.name] || 'general' }));
    }
}
