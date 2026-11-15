// node --test tests/build-version.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

test('an explicit build version is published for Telegram diagnostics', () => {
    const meta = html.match(/<meta name="app-version" content="([^"]+)"/);
    assert.ok(meta, 'missing app-version meta tag');
    assert.match(meta[1], /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
    assert.match(html, /id="app-version"/);
});

test('all local JavaScript and CSS references carry the current build version', () => {
    const version = html.match(/<meta name="app-version" content="([^"]+)"/)[1];
    const refs = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map(match => match[1]);
    assert.ok(refs.length >= 10, 'expected the complete game resource manifest');
    for (const reference of refs) {
        assert.ok(reference.endsWith('?v=' + version), 'stale resource: ' + reference);
        const file = reference.split('?')[0];
        assert.ok(fs.existsSync(path.join(__dirname, '..', file)), 'missing asset: ' + file);
    }
});

test('Telegram SDK uses its official source without build query', () => {
    assert.match(html, /src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"/);
});
