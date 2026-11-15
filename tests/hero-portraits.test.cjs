const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

test('all three unlocked classes have distinct local portrait artwork', () => {
    const seen = new Set();
    for (const hero of ['berserk', 'engineer', 'psyker']) {
        const file = path.join(root, 'assets', 'heroes', hero + '.svg');
        const svg = fs.readFileSync(file, 'utf8');
        assert.match(svg, /<svg[^>]*viewBox="0 0 320 220"/);
        assert.match(svg, /<title/);
        assert.match(svg, /<\/svg>$/);
        assert.doesNotMatch(svg, /<script|onload=|href="https?:/i);
        assert.ok(svg.length > 2200, hero + ' should be a detailed illustration');
        seen.add(svg);
    }
    assert.equal(seen.size, 3);
});

test('hero-select renders accessible portrait images, not emoji as primary artwork', () => {
    const list = { children: [], appendChild(el) { this.children.push(el); } };
    const HeroSelect = vm.runInNewContext(
        fs.readFileSync(path.join(root, 'js/ui/HeroSelect.js'), 'utf8') + '\nHeroSelect;',
        {
            HEROES: {
                berserk: { id: 'berserk', name: 'Берсерк', unlocked: true, color: '#f00', title: '', description: '', maxHp: 100 },
                engineer: { id: 'engineer', name: 'Инженер', unlocked: true, color: '#ff0', title: '', description: '', maxHp: 80 },
                psyker: { id: 'psyker', name: 'Псайкер', unlocked: true, color: '#aaf', title: '', description: '', maxHp: 70 }
            },
            document: {
                getElementById() { return list; },
                createElement() {
                    return { style: { setProperty() {} }, attrs: {}, setAttribute(k,v) { this.attrs[k]=v; } };
                }
            },
            game: { selectHero() {} }
        }
    );
    HeroSelect.render();
    assert.equal(list.children.length, 3);
    for (const hero of ['berserk', 'engineer', 'psyker']) {
        assert.ok(list.children.some(el => el.innerHTML.includes('assets/heroes/' + hero + '.svg')));
    }
    assert.ok(list.children.every(el => el.innerHTML.includes('alt="Портрет:')));
});
