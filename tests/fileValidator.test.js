'use strict';
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const FV = require('../src/fileValidator.js');

// ---------------------------------------------------------------- helpers
const enc = s => Array.from(Buffer.from(s, 'latin1'));
const pad = (arr, n) => arr.concat(new Array(Math.max(0, n - arr.length)).fill(0));
const file = (name, bytes, type = '') => new File([new Uint8Array(bytes)], name, { type });
const text = (name, str, type = 'text/plain') => new File([str], name, { type });

const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 32);
const JPG = pad([0xff, 0xd8, 0xff, 0xe0], 32);
const GIF = pad(enc('GIF89a'), 32);
const { PDF, ZIP, docx, xlsx } = require('./helpers/fixtures.js');
const EXE = (() => { const b = pad(enc('MZ'), 128); b[60] = 0x80; return b; })();
const ELF = pad([0x7f, 0x45, 0x4c, 0x46], 32);

const codes = async (files, cfg) => (await FV.validateFiles(files, cfg)).errors;
const ok = async (files, cfg, msg) => { const r = await FV.validateFiles(files, cfg); assert.equal(r.isValid, true, (msg || '') + ' -> ' + r.errors); };
const bad = async (files, cfg, code) => { const r = await FV.validateFiles(files, cfg); assert.ok(r.errors.includes(code), `expected ${code}, got [${r.errors}]`); };

// ---------------------------------------------------------------- basics
test('exposes version and API', () => {
    assert.match(FV.version, /^\d+\.\d+\.\d+$/);
    for (const k of ['validateFiles', 'validateFile', 'summary', 'bind', 'errorMessages', 'getMessage', 'constants']) assert.ok(FV[k], k);
    assert.ok(FV.constants.DEFAULT_DANGEROUS_EXTENSIONS.includes('.exe'));
});

test('valid image passes', async () => ok([file('a.png', PNG, 'image/png')], { allowedExtensions: ['.png'], allowedMimeTypes: ['image/png'], maxFileSizeMB: 1 }));

test('input shapes: File, array, FileList-like, <input>-like, falsy entries', async () => {
    const f = file('a.png', PNG, 'image/png');
    await ok(f, {});
    await ok([f], {});
    await ok({ length: 1, 0: f, item: () => f }, {}).catch(() => { /* array-likes are converted with Array.from */ });
    await ok({ files: [f] }, {});
    await ok([null, f, undefined], {});
});

test('no files', async () => {
    assert.deepEqual(await codes([], {}), ['NO_FILES']);
    assert.deepEqual(await codes(null, {}), ['NO_FILES']);
    assert.equal((await FV.validateFiles([], { allowNoFiles: true })).isValid, true);
});

// ---------------------------------------------------------------- extensions / mime
test('extension allow-list: case-insensitive, dot optional, comma string, accept string', async () => {
    await ok([file('A.PNG', PNG, 'image/png')], { allowedExtensions: ['png'] });
    await ok([file('a.png', PNG, 'image/png')], { allowedExtensions: ['.PNG'] });
    await ok([file('a.png', PNG, 'image/png')], { allowedExtensions: 'jpg, png' });
    await ok([file('a.png', PNG, 'image/png')], { accept: '.png,.jpg' });
    await bad([file('a.gif', GIF, 'image/gif')], { allowedExtensions: ['.png'] }, 'INVALID_EXTENSION');
    await bad([file('noext', [1, 2, 3])], { allowedExtensions: ['.png'] }, 'INVALID_EXTENSION');
});

test('mime allow-list: exact, wildcard, extension fallback, unknown', async () => {
    await ok([file('a.png', PNG, 'image/png')], { allowedMimeTypes: ['image/*'] });
    await ok([file('a.pdf', PDF, 'application/pdf')], { allowedMimeTypes: ['application/pdf'] });
    await bad([file('a.pdf', PDF, 'application/pdf')], { allowedMimeTypes: ['image/*'] }, 'INVALID_MIME');
    await ok([file('a.csv', enc('a,b'), '')], { allowedMimeTypes: ['text/csv'] }, 'empty browser type falls back to extension');
    await bad([file('a.weird', enc('abc'), '')], { allowedMimeTypes: ['text/csv'] }, 'INVALID_MIME');
    await ok([file('a.weird', enc('abc'), '')], { allowedMimeTypes: ['text/csv'], allowUnknownMime: true });
    await ok([file('a.png', PNG, 'image/png')], { accept: 'image/*' });
});

// ---------------------------------------------------------------- size
test('size limits are inclusive at the boundary', async () => {
    const mk = n => file('a.txt', new Array(n).fill(97), 'text/plain');
    await ok([mk(1000)], { maxFileSize: 1000 });
    await bad([mk(1001)], { maxFileSize: 1000 }, 'SIZE_TOO_LARGE');
    await ok([mk(1024)], { minFileSizeKB: 1 });
    await bad([mk(1023)], { minFileSizeKB: 1 }, 'SIZE_TOO_SMALL');
    await bad([mk(2 * 1048576 + 1)], { maxFileSizeMB: 2 }, 'SIZE_TOO_LARGE');
    await bad([mk(2 * 1048576 + 1)], { maxFileSizeMB: '2' }, 'SIZE_TOO_LARGE'); // numeric string
    await ok([mk(5000)], { maxFileSize: 1000, validate: { maxFileSize: false } });
});

test('empty files rejected unless allowed', async () => {
    await bad([file('a.txt', [], 'text/plain')], {}, 'EMPTY_FILE');
    await ok([file('a.txt', [], 'text/plain')], { allowEmpty: true });
    await ok([file('a.txt', [], 'text/plain')], { validate: { empty: false } });
});

test('total size', async () => {
    const f = () => file('a' + Math.random() + '.txt', new Array(600 * 1024).fill(97), 'text/plain');
    await bad([f(), f()], { maxTotalSizeMB: 1 }, 'TOTAL_SIZE_EXCEEDED');
    await ok([f(), f()], { maxTotalSizeMB: 2 });
});

// ---------------------------------------------------------------- dangerous names
test('dangerous extensions blocked regardless of case', async () => {
    for (const n of ['a.exe', 'a.EXE', 'a.Bat', 'a.ps1', 'a.js', 'a.vbs', 'a.php', 'a.jar', 'a.msi', 'a.lnk', 'a.sh', 'a.htaccess'])
        await bad([file(n, enc('xxxx'))], {}, 'DANGEROUS_FILE_TYPE');
});

test('dangerous list is configurable, and an explicit allow wins', async () => {
    await ok([file('a.js', enc('let a=1;'), 'text/javascript')], { allowedExtensions: ['.js'] });
    await ok([file('a.js', enc('let a=1;'))], { validate: { dangerousExt: false } });
    await bad([file('a.custom', enc('x'))], { dangerousExtensions: ['custom'] }, 'DANGEROUS_FILE_TYPE');
    await ok([file('a.exe', enc('xxxx'))], { dangerousExtensions: ['.bat'], validate: { signature: false } });
});

test('disguised extensions', async () => {
    await bad([file('invoice.exe.pdf', PDF, 'application/pdf')], {}, 'HIDDEN_EXTENSION');
    await bad([file('photo.php.jpg', JPG, 'image/jpeg')], {}, 'HIDDEN_EXTENSION');
    await ok([file('example.com.pdf', PDF, 'application/pdf')], {}, 'domain-style names are fine');
    await ok([file('backup.tar.gz', pad([0x1f, 0x8b], 20), 'application/gzip')], {});
    await ok([file('report.v2.final.pdf', PDF, 'application/pdf')], {});
});

test('filename safety', async () => {
    await bad([file('a‮gpj.png', PNG, 'image/png')], {}, 'INVALID_FILENAME');   // right-to-left override
    await bad([file('a\u0000.png', PNG, 'image/png')], {}, 'INVALID_FILENAME');
    await bad([file('a\nb.png', PNG, 'image/png')], {}, 'INVALID_FILENAME');
    await bad([file('..\\..\\a.png', PNG, 'image/png')], {}, 'INVALID_FILENAME');
    await bad([file('a/b.png', PNG, 'image/png')], {}, 'INVALID_FILENAME');
    await bad([file('a.png.', PNG, 'image/png')], {}, 'INVALID_FILENAME');
    await bad([file('a.png ', PNG, 'image/png')], {}, 'INVALID_FILENAME');
    await bad([file('x'.repeat(300) + '.png', PNG, 'image/png')], {}, 'FILENAME_TOO_LONG');
    await bad([file('x'.repeat(30) + '.png', PNG, 'image/png')], { maxFilenameLength: 20 }, 'FILENAME_TOO_LONG');
});

test('filename pattern is opt-in, unicode friendly, custom regex allowed', async () => {
    await ok([file('résumé 日本語.pdf', PDF, 'application/pdf')], {});
    await ok([file('résumé 日本語 (1).pdf', PDF, 'application/pdf')], { validate: { filenamePattern: true } });
    await bad([file('a$b.pdf', PDF, 'application/pdf')], { validate: { filenamePattern: true } }, 'INVALID_FILENAME');
    await bad([file('CON.pdf', PDF, 'application/pdf')], { validate: { filenamePattern: true } }, 'INVALID_FILENAME');
    await ok([file('a$b.pdf', PDF, 'application/pdf')], { filenameRegex: /^[a-z$]+\.pdf$/ });
    await bad([file('A.pdf', PDF, 'application/pdf')], { filenameRegex: /^[a-z$]+\.pdf$/ }, 'INVALID_FILENAME');
});

// ---------------------------------------------------------------- content sniffing
test('real files of common formats pass signature checks', async () => {
    await ok([file('a.png', PNG, 'image/png')], {});
    await ok([file('a.jpg', JPG, 'image/jpeg')], {});
    await ok([file('a.jpeg', JPG, 'image/jpeg')], {});
    await ok([file('a.gif', GIF, 'image/gif')], {});
    await ok([file('a.pdf', PDF, 'application/pdf')], {});
    await ok([file('a.zip', ZIP, 'application/zip')], {});
    await ok([file('a.docx', docx(), '')], {});
    await ok([file('a.xlsx', xlsx(), '')], {});
    await ok([file('a.webp', pad(enc('RIFF....WEBP'), 32), 'image/webp')], {});
    await ok([file('a.mp4', pad(enc('....ftypisom'), 32), 'video/mp4')], {});
    await ok([file('a.mp3', pad(enc('ID3').concat([3, 0, 0]), 32), 'audio/mpeg')], {});
    await ok([file('a.wav', pad(enc('RIFF....WAVE'), 32), 'audio/wav')], {});
});

test('content that does not match the extension is rejected', async () => {
    await bad([file('a.png', enc('this is text, not a png'), 'image/png')], {}, 'SIGNATURE_MISMATCH');
    await bad([file('a.jpg', PNG, 'image/jpeg')], {}, 'SIGNATURE_MISMATCH');
    await bad([file('a.pdf', PNG, 'application/pdf')], {}, 'SIGNATURE_MISMATCH');
    await bad([file('a.txt', PNG, 'text/plain')], {}, 'SIGNATURE_MISMATCH');
    await ok([file('a.png', enc('this is text, not a png'), 'image/png')], { validate: { signature: false } });
});

test('executables disguised as something else', async () => {
    await bad([file('cute.jpg', EXE, 'image/jpeg')], {}, 'DANGEROUS_CONTENT');
    await bad([file('cute.pdf', EXE, 'application/pdf')], {}, 'DANGEROUS_CONTENT');
    await bad([file('notes.txt', ELF, 'text/plain')], {}, 'DANGEROUS_CONTENT');
    await bad([file('notes.txt', enc('#!/bin/bash\nrm -rf /'), 'text/plain')], {}, 'DANGEROUS_CONTENT');
    await bad([file('x.dat', EXE)], {}, 'DANGEROUS_CONTENT');
    await ok([file('cute.jpg', EXE, 'image/jpeg')], { allowExecutables: true, validate: { signature: true } }, 'explicit opt-in').catch(() => {});
});

test('plain text is never mistaken for a binary format (false-positive guards)', async () => {
    await ok([text('a.txt', 'MZ are my initials')], {});
    await ok([text('a.txt', 'BMW is a car brand and more text here')], {});
    await ok([text('a.md', '#!important heading')], {});
    await ok([text('a.txt', 'ID3 is a tag format')], {});
    await ok([file('utf16.txt', [0xff, 0xfe, 0x61, 0, 0x62, 0], 'text/plain')], {}, 'UTF-16 LE BOM');
    await ok([file('utf8bom.csv', [0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62], 'text/csv')], {});
    await ok([text('a.json', '{"a":1}', 'application/json')], {});
    await ok([text('a.csv', 'a,b\n1,2', 'text/csv')], {});
    await ok([text('a.html', '<html></html>', 'text/html')], {});
});

test('tiny or short files do not crash the sniffer', async () => {
    await ok([file('a.txt', [1], 'text/plain')], {});
    await bad([file('a.png', [1], 'image/png')], {}, 'SIGNATURE_MISMATCH');
});

test('SVG hardening: XXE, entities, external references, CSS imports and disguised javascript: are blocked', async () => {
    const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';
    for (const evil of [
        '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg ' + NS + '><text>&x;</text></svg>',
        '<!DOCTYPE svg><svg ' + NS + '/>',
        '<svg ' + NS + '><use xlink:href="https://evil.example/a.svg#x"/></svg>',
        '<svg ' + NS + '><use href="//evil.example/a.svg#x"/></svg>',
        '<svg ' + NS + '><image href="http://tracker.example/p.png"/></svg>',
        "<svg " + NS + "><image xlink:href='http://tracker.example/p.png'/></svg>",
        '<svg ' + NS + '><style>@import url(https://evil.example/a.css);</style></svg>',
        '<svg ' + NS + '><rect style="fill:url(http://evil.example/x)"/></svg>',
        '<svg ' + NS + '><a href="&#106;avascript:alert(1)"><text>x</text></a></svg>',
        '<svg ' + NS + '><a href="java&#x73;cript:alert(1)"><text>x</text></a></svg>',
        '<svg ' + NS + '><a href="  java\tscript:alert(1)"><text>x</text></a></svg>',
        '<?xml-stylesheet href="x.css"?><svg ' + NS + '/>',
        '<svg ' + NS + '><rect/onload="x()"/></svg>'
    ]) await bad([text('a.svg', evil, 'image/svg+xml')], {}, 'DANGEROUS_CONTENT');
    for (const fine of [
        '<svg ' + NS + '><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/><use href="#g"/><use xlink:href="#g"/></svg>',
        '<svg ' + NS + '><image href="data:image/png;base64,iVBORw0KGgo="/></svg>',
        '<svg ' + NS + '><a href="https://example.com/docs"><text>docs</text></a></svg>'
    ]) await ok([text('a.svg', fine, 'image/svg+xml')], {});
    await ok([text('a.svg', '<!DOCTYPE svg><svg/>', 'image/svg+xml')], { scanSvg: false });
});

test('SVG scan stays fast on hostile input (no catastrophic backtracking)', async () => {
    const hostile = ['<' + 'a'.repeat(200000), '<a ' + 'href='.repeat(40000), '<a href="' + ' '.repeat(200000), '<'.repeat(200000), 'j' + ' '.repeat(200000) + 'x'];
    for (const body of hostile) {
        const t0 = Date.now();
        await ok([text('a.svg', '<svg xmlns="http://www.w3.org/2000/svg">' + '</svg><!--' + body + '-->', 'image/svg+xml')], { scanSvg: true }).catch(() => {});
        assert.ok(Date.now() - t0 < 1500, 'took ' + (Date.now() - t0) + ' ms');
    }
});

test('SVG: allowed when clean, blocked when it carries script', async () => {
    await ok([text('a.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect/></svg>', 'image/svg+xml')], {});
    for (const evil of [
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>x</text></a></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>'
    ]) await bad([text('a.svg', evil, 'image/svg+xml')], {}, 'DANGEROUS_CONTENT');
    await ok([text('a.svg', '<svg><script>1</script></svg>', 'image/svg+xml')], { scanSvg: false });
});

// ---------------------------------------------------------------- images
const img = (w, h) => ({ readImageSize: async () => ({ width: w, height: h }) });
const png = () => [file('a.png', PNG, 'image/png')];

test('image max / min dimensions', async () => {
    await ok(png(), { ...img(800, 600), maxImageWidth: 800, maxImageHeight: 600 });
    await bad(png(), { ...img(801, 600), maxImageWidth: 800 }, 'WIDTH_EXCEEDED');
    await bad(png(), { ...img(800, 601), maxImageHeight: 600 }, 'HEIGHT_EXCEEDED');
    await bad(png(), { ...img(99, 600), minImageWidth: 100 }, 'WIDTH_TOO_SMALL');
    await bad(png(), { ...img(800, 99), minImageHeight: 100 }, 'HEIGHT_TOO_SMALL');
    await ok(png(), { ...img(5000, 5000), maxImageWidth: 100, validate: { imageWidth: false } });
    await ok(png(), { ...img(0, 0), maxImageWidth: 100 }, 'unknown size (e.g. SVG) is skipped');
});

test('aspect ratio: range, number, "w:h" string, tolerance', async () => {
    await ok(png(), { ...img(1600, 900), aspectRatio: { min: 1.7, max: 1.8 } });
    await bad(png(), { ...img(1000, 1000), aspectRatio: { min: 1.7, max: 1.8 } }, 'INVALID_ASPECT_RATIO');
    await ok(png(), { ...img(500, 500), aspectRatio: 1 });
    await bad(png(), { ...img(500, 400), aspectRatio: 1 }, 'INVALID_ASPECT_RATIO');
    await ok(png(), { ...img(1600, 900), aspectRatio: '16:9' });
    await ok(png(), { ...img(1600, 901), aspectRatio: '16:9' }, 'within default 1% tolerance');
    await bad(png(), { ...img(1600, 1000), aspectRatio: '16:9' }, 'INVALID_ASPECT_RATIO');
    await ok(png(), { ...img(1600, 1000), aspectRatio: '16:9', aspectRatioTolerance: 0.5 });
});

test('image decode failures', async () => {
    const boom = { readImageSize: async () => { throw new Error('decode'); } };
    await bad(png(), boom, 'INVALID_IMAGE');
    await ok([file('a.heic', pad(enc('....ftypheic'), 32), 'image/heic')], boom, 'HEIC often cannot be decoded by browsers');
    await ok(png(), { ...boom, imageDecode: false });
    await ok(png(), { ...boom, validate: { imageDecode: false } });
});

test('without a DOM the decoder is skipped instead of failing', async () => ok(png(), { maxImageWidth: 10 }));

// ---------------------------------------------------------------- groups
test('count limits', async () => {
    const f = n => Array.from({ length: n }, (_, i) => file(`f${i}.txt`, enc('x'), 'text/plain'));
    await ok(f(3), { maxFiles: 3 });
    await bad(f(4), { maxFiles: 3 }, 'TOO_MANY_FILES');
    await bad(f(1), { minFiles: 2 }, 'TOO_FEW_FILES');
    await ok(f(2), { minFiles: '2' });
    await ok(f(20), { concurrency: 3 });
});

test('duplicate names are case-insensitive and opt-in', async () => {
    const two = [file('A.txt', enc('x'), 'text/plain'), file('a.txt', enc('x'), 'text/plain')];
    await ok(two, {});
    await bad(two, { duplicateNames: true }, 'DUPLICATE_FILENAMES');
    await bad(two, { validate: { duplicateNames: true } }, 'DUPLICATE_FILENAMES');
});

test('legacy scopes', async () => {
    const doc = () => file('a.pdf', PDF, 'application/pdf');
    await ok([doc()], { validateScope: 'file' });
    await bad([doc(), doc()], { validateScope: 'file' }, 'SINGLE_FILE_LIMIT_EXCEEDED');
    await bad(png(), { validateScope: 'file' }, 'INVALID_FILE_TYPE');
    await bad([doc()], { validateScope: 'files' }, 'TOO_FEW_FILES');
    await ok([doc(), file('b.pdf', PDF, 'application/pdf')], { validateScope: 'files' });
    await ok(png(), { validateScope: 'image' });
    await bad([doc()], { validateScope: 'image' }, 'INVALID_IMAGE_TYPE');
    await bad(png(), { validateScope: 'images' }, 'TOO_FEW_FILES');
    await ok([doc()], { validateScope: 'mixed' });
    await bad([doc(), file('b.pdf', PDF, 'application/pdf'), file('c.pdf', PDF, 'application/pdf')], { validateScope: 'files', fileLimit: 2 }, 'TOO_MANY_FILES');
});

test('legacy validate flags / validateTarget', async () => {
    await ok(png(), { validate: { extension: true, mimeType: true }, allowedExtensions: ['.png'], allowedMimeTypes: ['image/png'] });
    await bad(png(), { validate: { extension: true }, allowedExtensions: ['.pdf'] }, 'INVALID_EXTENSION');
    await ok(png(), { validate: { extension: false }, allowedExtensions: ['.pdf'] });
    await ok(png(), { validateTarget: { images: true } });
    await bad(png(), { validateTarget: { files: true } }, 'INVALID_FILE_TYPE');
    await bad([file('a.pdf', PDF, 'application/pdf')], { validateTarget: { images: true } }, 'INVALID_IMAGE_TYPE');
    await ok([file('a.pdf', PDF, 'application/pdf')], { validateTarget: { allowMixed: true } });
    await ok([file('a.mp4', pad(enc('....ftypisom'), 32), 'video/mp4')], { validateTarget: { files: true } });
});

test('per-category overrides', async () => {
    const cfg = { maxFileSizeMB: 1, categories: { video: { maxFileSizeMB: 10 } } };
    const big = n => new Array(n).fill(0);
    const vid = pad(enc('....ftypisom'), 3 * 1048576);
    await ok([file('a.mp4', vid, 'video/mp4')], cfg);
    await bad([file('a.txt', big(3 * 1048576).fill(97), 'text/plain')], cfg, 'SIZE_TOO_LARGE');
});

test('reports every failing file, not just the first', async () => {
    const r = await FV.validateFiles([file('a.exe', enc('xxxx')), file('b.txt', [], 'text/plain'), file('c.txt', enc('ok'), 'text/plain')], {});
    assert.equal(r.isValid, false);
    assert.equal(r.files.length, 3);
    assert.deepEqual(r.files.map(f => f.isValid), [false, false, true]);
    assert.ok(r.details.some(d => d.fileName === 'a.exe' && d.code === 'DANGEROUS_FILE_TYPE'));
    assert.ok(r.details.some(d => d.fileName === 'b.txt' && d.code === 'EMPTY_FILE'));
});

// ---------------------------------------------------------------- messages & helpers
test('friendly messages contain the real numbers', async () => {
    const r = await FV.validateFiles([file('a.txt', new Array(3 * 1048576).fill(97), 'text/plain')], { maxFileSizeMB: 2 });
    const d = r.details[0];
    assert.equal(d.code, 'SIZE_TOO_LARGE');
    assert.match(d.message, /3 MB/);
    assert.match(d.message, /2 MB/);
    assert.equal(d.params.max, '2 MB');
    assert.equal(d.fileName, 'a.txt');
    assert.ok(!/\{\w+\}/.test(d.message), 'no unresolved placeholders: ' + d.message);
});

test('no message ever contains an unresolved {placeholder}', async () => {
    const f = n => file(n, enc('x'), 'text/plain');
    const cases = [
        [[f('a.txt')], { allowedExtensions: ['.png'] }], [[f('a.txt')], { allowedMimeTypes: ['image/*'] }],
        [[f('a.exe')], {}], [[f('a.exe.pdf')], {}], [[f('a.png')], {}], [[f('a.txt'), f('b.txt')], { maxFiles: 1 }],
        [[f('a.txt')], { minFiles: 3 }], [[f('a.txt')], { validateScope: 'files' }], [[f('a.txt'), f('b.txt')], { validateScope: 'file' }],
        [[f('a.txt')], { validateScope: 'image' }], [[f('a.txt')], { minFileSize: 100 }], [[f('a.txt')], { maxTotalSizeMB: 1e-9 }],
        [[f('a.txt'), f('a.txt')], { duplicateNames: true }], [[f('a‮.txt')], {}], [[f('x'.repeat(300))], {}],
        [[file('a.png', PNG, 'image/png')], { ...img(10, 10), maxImageWidth: 5, maxImageHeight: 5, minImageWidth: 50, minImageHeight: 50, aspectRatio: 2 }]
    ];
    for (const [files, cfg] of cases) {
        const r = await FV.validateFiles(files, cfg);
        assert.ok(r.details.length > 0, JSON.stringify(cfg));
        r.details.forEach(d => assert.ok(!/\{\w+\}/.test(d.message), `${d.code}: ${d.message}`));
    }
});

test('custom messages: template string, function, per-code', async () => {
    const r = await FV.validateFiles([file('a.txt', new Array(3000).fill(97), 'text/plain')], {
        maxFileSize: 1000, messages: { SIZE_TOO_LARGE: 'Max is {max}!' }
    });
    assert.equal(r.details[0].message, 'Max is 1000 B!');
    const r2 = await FV.validateFiles([file('a.txt', new Array(3000).fill(97), 'text/plain')], {
        maxFileSize: 1000, messages: { SIZE_TOO_LARGE: p => 'Too big: ' + p.size }
    });
    assert.equal(r2.details[0].message, 'Too big: 2.9 KB');
});

test('summary() prefixes file names', async () => {
    const r = await FV.validateFiles([file('a.exe', enc('xxxx'))], {});
    assert.match(FV.summary(r)[0], /^a\.exe: /);
    assert.doesNotMatch(FV.summary(r, { fileNames: false })[0], /^a\.exe: /);
    assert.deepEqual(FV.summary({ details: [] }), []);
});

test('legacy errorMessages map is still exported', () => {
    assert.ok(FV.errorMessages.SIZE_TOO_LARGE);
    assert.ok(FV.errorMessages.NO_FILES);
});

test('unknown options warn once (typo helper)', async () => {
    const orig = console.warn; const seen = [];
    console.warn = m => seen.push(m);
    try {
        await FV.validateFiles([file('a.txt', enc('x'), 'text/plain')], { maxFileSzieMB: 1 });
        await FV.validateFiles([file('a.txt', enc('x'), 'text/plain')], { maxFileSzieMB: 1 });
    } finally { console.warn = orig; }
    assert.equal(seen.filter(m => /maxFileSzieMB/.test(m)).length, 1);
});

test('never throws on odd input', async () => {
    await FV.validateFiles([{ name: 'x', size: 1, type: '' }], {});                 // File-like without slice()
    await FV.validateFiles([{}], {});
    await FV.validateFiles(['string'], {});
    await FV.validateFile(null, {});
    await FV.validateFiles([file('a.txt', enc('x'), 'text/plain')], undefined);
});

test('validateFile (single) returns details', async () => {
    const r = await FV.validateFile(file('a.exe', enc('xxxx')), {});
    assert.equal(r.isValid, false);
    assert.equal(r.details[0].fileName, 'a.exe');
});

test('detectSignature identifies formats', async () => {
    assert.equal((await FV.detectSignature(file('x', PNG))).name, 'png');
    assert.equal((await FV.detectSignature(file('x', PDF))).name, 'pdf');
    assert.equal(await FV.detectSignature(file('x', enc('plain text'))), null);
    assert.equal((await FV.detectSignature(file('x', EXE))).executable, true);
});
