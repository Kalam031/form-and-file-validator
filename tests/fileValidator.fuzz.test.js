'use strict';
// Fuzzing: valid files of every family are truncated, bit-flipped, spliced and padded with a seeded random generator.
// Whatever the bytes are, FileValidator must never throw, never hang, and always return a well-formed result.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const FV = require('../src/fileValidator.js');
const { makeZip, ZIP, PDF, enc, docx, xlsx, pptx } = require('./helpers/fixtures.js');
const { makePng } = require('../browser-tests/files.js');

const PNG = Array.from(makePng(8, 8));
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...enc('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9];
const GIF = [...enc('GIF89a'), 8, 0, 8, 0, 0, 0, 0, 0x3b];
const SVG = enc('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
const SEEDS = [
    ['a.png', 'image/png', PNG], ['a.jpg', 'image/jpeg', JPEG], ['a.gif', 'image/gif', GIF], ['a.svg', 'image/svg+xml', SVG],
    ['a.pdf', 'application/pdf', Array.from(PDF)], ['a.zip', 'application/zip', Array.from(ZIP)],
    ['a.docx', '', Array.from(docx())], ['a.xlsx', '', Array.from(xlsx())], ['a.pptx', '', Array.from(pptx())],
    ['a.docm', '', Array.from(docx({ 'word/vbaProject.bin': 'x' }))],
    ['a.txt', 'text/plain', enc('hello world')], ['a.csv', 'text/csv', enc('a,b\n1,2\n')]
];

// small seeded generator (mulberry32) so a failure can be replayed
const rng = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function mutate(bytes, rand) {
    let b = bytes.slice();
    const n = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
        const at = Math.floor(rand() * Math.max(1, b.length));
        switch (Math.floor(rand() * 7)) {
            case 0: b = b.slice(0, at); break;                                              // truncate
            case 1: b[at] = Math.floor(rand() * 256); break;                                // overwrite a byte
            case 2: b[at] = (b[at] || 0) ^ (1 << Math.floor(rand() * 8)); break;            // flip a bit
            case 3: b = b.slice(0, at).concat(Array.from({ length: Math.floor(rand() * 64) }, () => Math.floor(rand() * 256)), b.slice(at)); break;   // insert noise
            case 4: b.splice(at, Math.floor(rand() * 32)); break;                            // delete a range
            case 5: { const o = SEEDS[Math.floor(rand() * SEEDS.length)][2]; b = b.concat(o); break; }   // append another file (polyglot-style)
            default: b[at] = 0xff; if (at + 1 < b.length) b[at + 1] = 0xff; if (at + 2 < b.length) b[at + 2] = 0xff; if (at + 3 < b.length) b[at + 3] = 0xff;   // huge sizes / offsets
        }
    }
    return b;
}
const names = ['a.png', 'a.jpg', 'a.gif', 'a.svg', 'a.pdf', 'a.zip', 'a.docx', 'a.xlsx', 'a.docm', 'a.txt', 'noext', 'a.PNG.php', '.htaccess', 'a b.exe'];

test('fuzz: mutated files never make validateFiles throw or hang, and the result is well formed', async () => {
    const rand = rng(20261005);
    const cfg = { maxImageWidth: 4096, maxImageHeight: 4096, readMediaInfo: true };
    const started = Date.now();
    let blocked = 0, passed = 0;
    for (let i = 0; i < 600; i++) {
        const seed = SEEDS[i % SEEDS.length];
        const bytes = mutate(seed[2], rand);
        const name = rand() < 0.3 ? names[Math.floor(rand() * names.length)] : seed[0];
        const type = rand() < 0.3 ? SEEDS[Math.floor(rand() * SEEDS.length)][1] : seed[1];
        const f = new File([new Uint8Array(bytes)], name, { type });
        let r;
        try { r = await FV.validateFiles([f], cfg); }
        catch (e) { assert.fail('iteration ' + i + ' (' + name + ', ' + bytes.length + ' bytes) threw: ' + (e && e.stack || e)); }
        assert.equal(typeof r.isValid, 'boolean', 'iteration ' + i);
        assert.ok(Array.isArray(r.errors), 'iteration ' + i);
        assert.equal(r.isValid, r.errors.length === 0, 'isValid must match errors, iteration ' + i);
        r.isValid ? passed++ : blocked++;
    }
    assert.ok(Date.now() - started < 60000, 'fuzzing took too long: ' + (Date.now() - started) + ' ms');
    assert.ok(blocked > 0 && passed > 0, 'the corpus should produce both verdicts (' + blocked + ' blocked, ' + passed + ' passed)');
});

test('fuzz: hostile hand-made inputs (empty, huge declared sizes, deep nesting, zip bombs, bad names) are handled', async () => {
    const big32 = [0xff, 0xff, 0xff, 0xff];
    const inputs = [
        ['empty.png', 'image/png', []],
        ['one.pdf', 'application/pdf', [0x25]],
        ['bomb.zip', 'application/zip', Array.from(makeZip({ 'a.txt': 'A'.repeat(20000) }))],
        ['bad.zip', 'application/zip', [...enc('PK\x03\x04'), ...big32, ...big32, ...big32, ...big32]],
        ['eocd.zip', 'application/zip', [...enc('PK\x05\x06'), 0, 0, 0, 0, ...big32, ...big32, ...big32, 0, 0]],
        ['slip.zip', 'application/zip', Array.from(makeZip({ '../../evil.sh': 'x', '/abs/path': 'y', 'C:\\win\\path': 'z' }))],
        ['deep.svg', 'image/svg+xml', enc('<svg>' + '<g>'.repeat(20000) + '</g>'.repeat(20000) + '</svg>')],
        ['nul\u0000.png', 'image/png', PNG],
        ['a'.repeat(5000) + '.png', 'image/png', PNG],
        ['bad.png', 'image/png', [...PNG.slice(0, 16), ...big32, ...big32, ...PNG.slice(24)]]
    ];
    for (const [name, type, bytes] of inputs) {
        const t0 = Date.now();
        const r = await FV.validateFiles([new File([new Uint8Array(bytes)], name, { type })], { maxImageWidth: 4096, maxImageHeight: 4096 });
        assert.equal(typeof r.isValid, 'boolean', name);
        assert.ok(Date.now() - t0 < 5000, name + ' took ' + (Date.now() - t0) + ' ms');
    }
    const r = await FV.validateFiles([new File([new Uint8Array(enc('x'))], 'x.zip', { type: 'application/zip' })], {});
    assert.equal(typeof r.isValid, 'boolean');
});
