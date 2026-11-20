// node --test tests/class-events.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const gameSource = readFileSync(join(__dirname, '../js/systems/Game.js'), 'utf8');

const classEncounters = [
    {
        hero: 'berserk',
        name: 'Круг Кровавой Клятвы',
        presentation: 'blood-oath',
        mechanic: 'chooseRelic(this.player.relics, Math.random, this.player.heroId)'
    },
    {
        hero: 'engineer',
        name: 'Мастерская Последнего Механика',
        presentation: 'last-mechanic',
        mechanic: 'this.offerCard()'
    },
    {
        hero: 'psyker',
        name: 'Шёпот Между Созвездиями',
        presentation: 'star-whisper',
        mechanic: 'this.applyForbiddenManuscript()'
    }
];

test('each playable hero has a distinct event with a real gameplay action', () => {
    for (const encounter of classEncounters) {
        assert.match(gameSource, new RegExp(`\\b${encounter.hero}:\\s*\\{`));
        assert.ok(gameSource.includes(encounter.name), `Missing event: ${encounter.name}`);
        assert.ok(gameSource.includes(encounter.mechanic), `Missing mechanic for ${encounter.hero}`);
    }
});

test('class events are added only for the currently selected hero', () => {
    assert.ok(gameSource.includes('const classEvent = classEvents[this.player?.heroId]'));
    assert.ok(gameSource.includes('if (classEvent) commonEvents.push(classEvent)'));
});

test('class encounters have dedicated event presentation styles', () => {
    for (const encounter of classEncounters) {
        assert.ok(gameSource.includes(`style: '${encounter.presentation}'`));
    }
});

test('accepting a class encounter schedules a later follow-up', () => {
    assert.ok(gameSource.includes("this.player.classEventDebt = 'berserk'"));
    assert.ok(gameSource.includes("this.player.classEventDebt = 'engineer'"));
    assert.ok(gameSource.includes("this.player.classEventDebt = 'psyker'"));
    assert.ok(gameSource.includes('canEncounterClassEventFollowUp()'));
    assert.ok(gameSource.includes('(this.act > act || (this.act === act && this.floor > floor))'));
});

test('each class follow-up resolves with a distinct reward choice', () => {
    for (const title of ['Эхо Павшего Чемпиона', 'Наследие Последнего Механика', 'Ответ Звёздного Разлома']) {
        assert.ok(gameSource.includes(title), `Missing follow-up: ${title}`);
    }
    assert.ok(gameSource.includes("this.player.classEventDebt = 'berserk-resolved'"));
    assert.ok(gameSource.includes("this.player.classEventDebt = 'engineer-resolved'"));
    assert.ok(gameSource.includes("this.player.classEventDebt = 'psyker-resolved'"));
});

test('class story progress is reset for a new run and exposed in the run journal', () => {
    assert.ok(gameSource.includes("this.player.classEventDebt = 'psyker'"));
    assert.ok(gameSource.includes("player.classEventDebt === 'berserk'"));
    assert.ok(gameSource.includes("player.classEventDebt === 'engineer'"));
    assert.ok(gameSource.includes("player.classEventDebt === 'psyker'"));
});

test('class follow-ups appear only on a later floor and resolve once for every hero', () => {
    const vm = require('node:vm');
    const Game = vm.runInNewContext(gameSource + '\\nGame;', {
        console, Math, Date, JSON,
        RunSave: class { clear() {} },
        GAME_CONFIG: { maxActs: 3 },
        alert() {},
        chooseRelic: () => ({ id: 'test-relic' })
    });
    const cases = [
        { hero: 'berserk', choice: 0, title: 'Эхо Павшего Чемпиона', expected: 'berserk-resolved', hp: 58, gold: 0 },
        { hero: 'engineer', choice: 1, title: 'Наследие Последнего Механика', expected: 'engineer-resolved', hp: 40, gold: 55 },
        { hero: 'psyker', choice: 1, title: 'Ответ Звёздного Разлома', expected: 'psyker-resolved', hp: 40, gold: 40 }
    ];

    for (const scenario of cases) {
        const game = Object.create(Game.prototype);
        game.player = {
            heroId: scenario.hero, hp: 40, maxHp: 80, gold: 0,
            deck: [], relics: [], classEventDebt: scenario.hero,
            classEventDebtAct: 1, classEventDebtFloor: 2
        };
        game.act = 1;
        game.floor = 2;
        assert.equal(game.canEncounterClassEventFollowUp(), false);
        assert.equal(game.getEventsForAct().some(event => event.name === scenario.title), false);

        game.floor = 3;
        assert.equal(game.canEncounterClassEventFollowUp(), true);
        const followUp = game.getEventsForAct().find(event => event.name === scenario.title);
        assert.ok(followUp, 'Missing follow-up for ' + scenario.hero);
        assert.equal(followUp.options[scenario.choice].action(), true);
        assert.equal(game.player.classEventDebt, scenario.expected);
        assert.equal(game.player.hp, scenario.hp);
        assert.equal(game.player.gold, scenario.gold);
        assert.equal(game.canEncounterClassEventFollowUp(), false);
        assert.equal(game.getEventsForAct().some(event => event.name === scenario.title), false);
    }
});
