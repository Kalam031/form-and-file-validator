'use strict';
require('./helpers/shim.js');
// Hardening: hostile and random inputs must never crash, hang, or take a long time.
//  - fuzzing of the file inspection code (ZIP directory, PDF, Office, names, paths) with mutated real files
//  - slow-input ("ReDoS") checks of every rule and regular expression on pathological strings
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const FV = require('../src/fileValidator.js');
const { PDF, pdfWith, makeZip, docx, xlsx, ZIP } = require('./helpers/fixtures.js');

// deterministic pseudo-random numbers (mulberry32), so a failure can be reproduced from its seed
const rng = seed => () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rint = (r, n) => Math.floor(r() * n);

function mutate(bytes, r) {
    const out = bytes.slice();
    const kind = rint(r, 6);
    if (kind === 0) { for (let i = 0; i < 1 + rint(r, 8); i++) out[rint(r, out.length)] = rint(r, 256); }                       // flip bytes
    else if (kind === 1) return out.slice(0, rint(r, out.length));                                                                 // truncate
    else if (kind === 2) { const at = rint(r, out.length); out.splice(at, rint(r, 30)); }                                          // delete a run
    else if (kind === 3) { const at = rint(r, out.length); out.splice(at, 0, ...Array.from({ length: rint(r, 50) }, () => rint(r, 256))); } // insert junk
    else if (kind === 4) { const at = rint(r, out.length); for (let i = at; i < Math.min(out.length, at + 8); i++) out[i] = 0xff; } // 0xFF run (huge sizes)
    else { const at = rint(r, out.length); for (let i = at; i < Math.min(out.length, at + 8); i++) out[i] = 0; }                  // zero run
    return out;
}

const ROUNDS = Math.max(1, Number(process.env.FUZZ_ROUNDS || 1));   // FUZZ_ROUNDS=20 npm test: a much longer fuzz run
const SEED = Number(process.env.FUZZ_SEED || 0);
const budget = async (label, ms, fn) => {
    const t0 = process.hrtime.bigint();
    const out = await fn();
    const took = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(took < ms, `${label} took ${took.toFixed(0)} ms (limit ${ms} ms)`);
    return out;
};
const wellFormed = r => { assert.equal(typeof r.isValid, 'boolean'); assert.ok(Array.isArray(r.errors)); assert.ok(Array.isArray(r.details)); r.details.forEach(d => { assert.equal(typeof d.code, 'string'); assert.equal(typeof d.message, 'string'); assert.ok(!/\{\w+\}/.test(d.message) || d.code === 'CUSTOM', d.code + ': ' + d.message); }); };

// ================================================================ fuzzing the file inspection
const SEEDS = [
    ['a.pdf', PDF], ['js.pdf', pdfWith('/S /JavaScript /JS (x)')], ['a.zip', ZIP], ['a.docx', docx()], ['m.docx', docx({ 'word/vbaProject.bin': 'x' })], ['a.xlsx', xlsx()],
    ['a.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]],
    ['a.doc', [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(200).fill(0)]], ['a.mp4', [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, ...new Array(40).fill(0)]]
];

test('fuzz: mutated PDF, ZIP, Office, image and media files never throw and always finish quickly', async () => {
    const r = rng(20240501 + SEED);
    let checked = 0, flagged = 0;
    for (let round = 0; round < 60 * ROUNDS; round++) {
        for (const [name, seed] of SEEDS) {
            const bytes = mutate(seed, r);
            const file = new File([new Uint8Array(bytes)], name, { type: '' });
            const res = await budget(`${name} round ${round}`, 1500, () => FV.validateFiles([file], {}));
            wellFormed(res);
            checked++; if (!res.isValid) flagged++;
        }
    }
    assert.ok(checked >= 540);
    assert.ok(flagged > 50, 'the mutations should be noticed at least sometimes (' + flagged + ' of ' + checked + ')');
});

test('fuzz: hostile ZIP directories (huge counts, sizes and offsets, overlapping records, giant names)', async () => {
    const good = makeZip({ 'a.txt': 'hello', 'b/c.txt': 'world' });
    const eocd = good.length - 22;
    const setU16 = (arr, at, v) => { arr[at] = v & 255; arr[at + 1] = (v >> 8) & 255; };
    const setU32 = (arr, at, v) => { arr[at] = v & 255; arr[at + 1] = (v >>> 8) & 255; arr[at + 2] = (v >>> 16) & 255; arr[at + 3] = (v >>> 24) & 255; };
    const cases = {
        'count 65534': a => setU16(a, eocd + 10, 65534),
        'count 0': a => { setU16(a, eocd + 10, 0); setU16(a, eocd + 8, 0); },
        'cd size 4 GB': a => setU32(a, eocd + 12, 0xfffffffe),
        'cd offset 4 GB': a => setU32(a, eocd + 16, 0xfffffffe),
        'cd offset before start': a => setU32(a, eocd + 16, 3),
        'name length 65535': a => setU16(a, 46 - 46 + (good.length - 22 - (good.length - 22 - (a.indexOf(0x50, 60)))) + 28, 65535),
        'comment length huge': a => setU16(a, eocd + 20, 65535),
        'usize/csize huge': a => { const cd = a.lastIndexOf(0x50, eocd - 1); for (let i = 0; i < 40; i++) if (a[i] === 0x50 && a[i + 1] === 0x4b && a[i + 2] === 1) setU32(a, i + 24, 0xffffffff); void cd; },
        'eocd repeated inside comment': a => { for (let i = 0; i < 10; i++) a.splice(eocd, 0, 0x50, 0x4b, 5, 6); }
    };
    for (const [label, mutateZip] of Object.entries(cases)) {
        const bytes = good.slice(); mutateZip(bytes);
        for (const name of ['x.zip', 'x.docx', 'x.jar']) {
            const res = await budget(label + ' as ' + name, 1500, () => FV.validateFiles([new File([new Uint8Array(bytes)], name)], {}));
            wellFormed(res);
        }
    }
});

test('fuzz: a ZIP with a giant central directory and tens of thousands of entries is refused or handled fast, using bounded memory', async () => {
    const entries = {}; for (let i = 0; i < 30000; i++) entries['dir/file' + i + '.txt'] = '';
    const res = await budget('30000 entries', 6000, () => FV.validateFiles([new File([new Uint8Array(makeZip(entries))], 'many.zip')], {}));
    wellFormed(res);
    assert.ok(res.errors.includes('ARCHIVE_BOMB'), res.errors + '');
});

test('fuzz: PDFs with long hostile runs (hex-escape storms, repeated keywords, one giant line) are scanned in linear time', async () => {
    const big = n => new Array(n).fill(35).concat(); // '#'
    const cases = {
        'hash storm': pdfWith('/S /' + '#61'.repeat(200000)),
        'hash noise': pdfWith('#'.repeat(400000)),
        'keyword flood': pdfWith('/Launch '.repeat(50000)),
        'one giant line': pdfWith('/A '.repeat(300000)),
        'near miss': pdfWith('/JavaScrip '.repeat(60000)),
        'deep parens': pdfWith('('.repeat(200000)),
        'embedded near miss': pdfWith('/EmbeddedFile /F (' + 'a'.repeat(300000) + ')')
    };
    void big;
    for (const [label, bytes] of Object.entries(cases)) {
        const res = await budget('pdf ' + label, 3000, () => FV.validateFiles([new File([new Uint8Array(bytes)], 'x.pdf', { type: 'application/pdf' })], {}));
        wellFormed(res);
    }
});

test('fuzz: hostile file names, paths and types never crash the name, path and type checks', async () => {
    const r = rng(7 + SEED);
    const pieces = ['..', '.', '/', '\\', '‮', '\u0000', 'CON', ' ', '.exe', '.pdf', '.PDF', '%00', '\ud800', 'é', '日本', ':', '*', '?', '"', '<', '>', '|', 'a'.repeat(300), '​', '~$', '._'];
    for (let i = 0; i < 400 * ROUNDS; i++) {
        let name = ''; for (let k = 0; k < 1 + rint(r, 8); k++) name += pieces[rint(r, pieces.length)];
        const file = new File([new Uint8Array([1, 2, 3])], name || 'x', { type: ['', 'text/plain', 'application/x-msdownload', 'IMAGE/PNG', 'a'.repeat(200)][rint(r, 5)] });
        if (rint(r, 2)) { try { Object.defineProperty(file, 'webkitRelativePath', { value: name + '/' + pieces[rint(r, pieces.length)] }); } catch (e) { /* not settable */ } }
        const res = await budget('name ' + JSON.stringify(name).slice(0, 40), 500, () => FV.validateFiles([file], { accept: '.pdf,.png', ignoreFiles: true, maxPathDepth: 3, validate: { filenamePattern: rint(r, 2) === 1 } }));
        wellFormed(res);
    }
});

test('fuzz: random configs (wrong types, nulls, odd values) never crash the validator', async () => {
    const r = rng(99 + SEED);
    const odd = [null, undefined, NaN, -1, 0, 1e12, '', 'x', '5', [], {}, () => { }, /x/, true, false, Symbol.for('x').toString(), 'a,b', ['.pdf'], { min: 1 }];
    const keys = ['allowedExtensions', 'allowedMimeTypes', 'accept', 'maxFileSizeMB', 'minFileSizeKB', 'maxFiles', 'minFiles', 'maxTotalSizeMB', 'maxImageWidth', 'aspectRatio', 'messages', 'validate',
        'validateTarget', 'validateScope', 'categories', 'documents', 'ignoreFiles', 'maxPathDepth', 'mimeByExtension', 'dangerousExtensions', 'methods', 'custom', 'remote', 'scan', 'filenameRegex', 'maxDurationSec'];
    for (let i = 0; i < 300 * ROUNDS; i++) {
        const cfg = {};
        for (let k = 0; k < 1 + rint(r, 6); k++) cfg[keys[rint(r, keys.length)]] = odd[rint(r, odd.length)];
        const warn = console.warn, err = console.error; console.warn = () => { }; console.error = () => { };
        try {
            const res = await budget('config ' + i, 1500, () => FV.validateFiles([new File([new Uint8Array(PDF)], 'a.pdf', { type: 'application/pdf' })], cfg));
            wellFormed(res);
        } finally { console.warn = warn; console.error = err; }
    }
});

// ================================================================ slow-input ("ReDoS") checks
const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, Event: w.Event, CustomEvent: w.CustomEvent, Node: w.Node, HTMLElement: w.HTMLElement, CSS: w.CSS });
const FormValidator = require('../src/formValidator.js');
globalThis.FormValidator = FormValidator;
const $ = require('jquery');
globalThis.jQuery = $;
require('../src/formValidator.jquery.js');

const N = 200000;
const PATHOLOGICAL = [
    'a'.repeat(N) + '!', 'a@'.repeat(N / 2), '.'.repeat(N), 'a.'.repeat(N / 2) + '!', '-'.repeat(N), '1'.repeat(N) + 'x', '1,'.repeat(N / 2) + 'x', '0'.repeat(N) + '.' + '0'.repeat(N),
    'a-'.repeat(N / 2) + '.c', ('a'.repeat(60) + '.').repeat(N / 61) + '-', 'http://' + 'a'.repeat(N) + '.', 'http://' + 'a.'.repeat(N / 2) + 'b', '1.'.repeat(N / 2), ':'.repeat(N),
    '::'.repeat(N / 2) + '1', '+'.repeat(N) + '1', ' '.repeat(N) + 'x', '\t\n'.repeat(N / 2), '({[]})'.repeat(N / 6), 'a b '.repeat(N / 4), 'é'.repeat(N), 'x=1&'.repeat(N / 4)
];

test('slow input: every built-in rule finishes fast on pathological 200 KB strings', async () => {
    const rules = [
        { type: 'email' }, { type: 'url' }, { type: 'number' }, { type: 'digits' }, { type: 'alpha' }, { type: 'alphanumeric' }, { type: 'phone' }, { type: 'date' },
        { type: 'minDate', min: '2020-01-01' }, { type: 'maxDate', max: '2020-01-01' }, { type: 'creditcard' }, { type: 'pattern', pattern: '^[a-z]+$' }, { type: 'minlength', min: 3 },
        { type: 'maxlength', max: 3 }, { type: 'range', min: 1, max: 5 }, { type: 'step', step: 2 }, { type: 'oneOf', values: ['a', 'b'] }, { type: 'pwcheck', minLength: 8, requireDigit: true, requireSpecialChar: true },
        { type: 'equalTo', target: 'other' }, { type: 'notEqualTo', target: 'other' }
    ];
    const worst = [];
    for (const rule of rules) {
        for (const value of PATHOLOGICAL) {
            document.body.innerHTML = '<form id="f"><input name="x" id="x"><input name="other" value="q"></form>';
            document.getElementById('x').value = value;
            const t0 = process.hrtime.bigint();
            await FormValidator.validate('f', { x: [rule] });
            const ms = Number(process.hrtime.bigint() - t0) / 1e6;
            if (ms > 300) worst.push(`${rule.type} on ${JSON.stringify(value.slice(0, 20))}...(${value.length}) took ${ms.toFixed(0)} ms`);
        }
    }
    assert.deepEqual(worst, [], 'slow rules:\n' + worst.join('\n'));
});

test('slow input: the jQuery Validation methods finish fast on pathological strings too', async () => {
    const methods = { email: true, url: true, date: true, dateISO: true, number: true, digits: true, integer: true, lettersonly: true, letterswithbasicpunc: true, alphanumeric: true, nowhitespace: true,
        ipv4: true, ipv6: true, time: true, time12h: true, phoneUS: true, creditcard: true, iban: true, maxWords: 5, minWords: 5, rangeWords: [1, 5], pattern: '[a-z]+', extension: 'png|jpg' };
    const worst = [];
    for (const [name, param] of Object.entries(methods)) {
        for (const value of PATHOLOGICAL) {
            document.body.innerHTML = '<form id="g"><input name="x" id="gx"></form>';
            $('#g').validate({ rules: { x: { [name]: param } } });
            $('#gx').val(value);
            const t0 = process.hrtime.bigint();
            $('#gx').valid();
            const ms = Number(process.hrtime.bigint() - t0) / 1e6;
            if (ms > 300) worst.push(`${name} on ${JSON.stringify(value.slice(0, 20))}...(${value.length}) took ${ms.toFixed(0)} ms`);
            $('#g').data('validator').destroy();
        }
    }
    assert.deepEqual(worst, [], 'slow methods:\n' + worst.join('\n'));
});

test('slow input: file name, path, extension and MIME checks are fast on huge names', async () => {
    const worst = [];
    for (const value of PATHOLOGICAL) {
        const files = [new File([new Uint8Array([1])], value.slice(0, 100000) + '.pdf'), new File([new Uint8Array([1])], 'a.pdf', { type: value.slice(0, 5000) })];
        const t0 = process.hrtime.bigint();
        await FV.validateFiles(files, { accept: '.pdf', validate: { filenamePattern: true }, maxFilenameLength: 255 });
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if (ms > 300) worst.push(`${JSON.stringify(value.slice(0, 20))}(${value.length}) took ${ms.toFixed(0)} ms`);
    }
    assert.deepEqual(worst, [], worst.join('\n'));
});

// ================================================================ FormValidator: random and wrong-typed rules and configs
test('fuzz: random rule definitions and configs never crash FormValidator (init, validate, events)', async () => {
    const r = rng(5 + SEED);
    const odd = [null, undefined, NaN, -1, 0, 1e12, '', 'x', '5', '#pw', '[1,2]', [], [1, 2], ['a'], {}, { min: 1 }, { param: 3 }, { depends: '#none' }, () => true, () => { throw new Error('boom'); }, /x/, true, false, { url: '/x' }, 'required email'];
    const types = ['required', 'email', 'url', 'number', 'digits', 'alpha', 'phone', 'date', 'minDate', 'creditcard', 'pattern', 'minlength', 'maxlength', 'rangelength', 'range', 'min', 'max', 'step', 'oneOf',
        'equalTo', 'notEqualTo', 'pwcheck', 'minChecked', 'maxChecked', 'minFiles', 'maxFiles', 'fileType', 'fileSize', 'file', 'custom', 'nope', 'normalizer', 'messages', 'remote'];
    const cfgKeys = ['trim', 'validateOn', 'debounce', 'errorElement', 'errorClass', 'invalidClass', 'messages', 'passwordStrength', 'errorPlacement', 'submitHandler', 'onError', 'ignore', 'classRules', 'fieldRules', 'resolveMessage', 'pendingClass'];
    const err = console.error, warn = console.warn; console.error = () => { }; console.warn = () => { };
    globalThis.fetch = async () => { throw new Error('offline'); };
    try {
        for (let i = 0; i < 250 * ROUNDS; i++) {
            document.body.innerHTML = '<form id="f"><input name="x" id="x" value="abc"><input name="pw" id="pw" value="p"><input type="checkbox" name="c" value="1"></form>';
            const rules = {};
            for (const field of ['x', 'c', 'ghost']) {
                const map = {};
                for (let k = 0; k < 1 + rint(r, 4); k++) map[types[rint(r, types.length)]] = odd[rint(r, odd.length)];
                rules[field] = rint(r, 3) === 0 ? [map] : (rint(r, 2) ? map : [{ type: types[rint(r, types.length)], ...(typeof odd[rint(r, odd.length)] === 'object' ? odd[rint(r, odd.length)] || {} : {}) }]);
            }
            const config = {};
            for (let k = 0; k < rint(r, 4); k++) config[cfgKeys[rint(r, cfgKeys.length)]] = odd[rint(r, odd.length)];
            let inst = null;
            try {
                inst = FormValidator.init({ formId: 'f', rules, config });
                await budget('form fuzz ' + i, 2000, () => inst.validate({ focus: false }));
                inst.validateSync({ focus: false });
                document.getElementById('x').dispatchEvent(new w.Event('input', { bubbles: true }));
                document.getElementById('x').dispatchEvent(new w.Event('change', { bubbles: true }));
                document.getElementById('f').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
                await new Promise(res => setTimeout(res, 2));
            } catch (e) {
                // a clear error thrown by init() for an unusable definition is acceptable; a crash inside validation is not
                assert.ok(inst === null, 'validation crashed: ' + (e && e.stack || e) + '\nrules=' + JSON.stringify(rules, (k, v) => typeof v === 'function' ? '[fn]' : v instanceof RegExp ? String(v) : v));
            } finally { if (inst) inst.destroy(); }
        }
    } finally { console.error = err; console.warn = warn; }
});

// ================================================================ streaming SHA-256 (big files, constant memory)
const nodeCrypto = require('node:crypto');
const sha = b => nodeCrypto.createHash('sha256').update(b).digest('hex');

test('streaming SHA-256 equals the real thing for every block-boundary length and any chunking', () => {
    const r = rng(11);
    for (const len of [0, 1, 2, 55, 56, 57, 63, 64, 65, 119, 120, 121, 127, 128, 129, 1000, 4096, 65537]) {
        const data = Buffer.from(Array.from({ length: len }, () => rint(r, 256)));
        const h = FV._sha256Stream();
        let pos = 0;
        while (pos < len) { const n = 1 + rint(r, 200); h.update(data.subarray(pos, pos + n)); pos += n; }   // random chunk sizes
        assert.equal(h.digest(), sha(data), 'length ' + len);
    }
    assert.equal(FV._sha256Stream().digest(), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'empty input');
    const abc = FV._sha256Stream(); abc.update(Buffer.from('abc'));
    assert.equal(abc.digest(), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('hashFile: small files use crypto.subtle, big files are streamed, both give the same digest; the cap still applies', async () => {
    const small = Buffer.from(Array.from({ length: 3000 }, (_, i) => i % 251));
    assert.equal(await FV.hashFile(new File([small], 's.bin')), sha(small));
    const big = Buffer.alloc(33 * 1048576 + 12345); for (let i = 0; i < big.length; i += 4099) big[i] = i % 253;   // just over the 32 MB streaming threshold
    const t0 = Date.now();
    assert.equal(await FV.hashFile(new File([big], 'big.bin'), 100), sha(big));
    assert.ok(Date.now() - t0 < 20000, 'a 33 MB stream took ' + (Date.now() - t0) + ' ms');
    assert.equal(await FV.hashFile(new File([big], 'big2.bin'), 10), null, 'over the cap: not hashed');
    const twice = new File([small], 'c.bin');
    assert.equal(await FV.hashFile(twice), await FV.hashFile(twice), 'cached per File');
});
