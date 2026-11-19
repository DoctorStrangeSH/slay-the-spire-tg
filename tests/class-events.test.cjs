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
