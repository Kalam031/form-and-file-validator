'use strict';
require('./helpers/shim.js');
// FileValidator 2.4: built-in extension registry, extension-derived MIME checks, unknown types, dangerous MIME types.
const test = require('node:test');
const assert = require('node:assert/strict');
const FV = require('../src/fileValidator.js');

const enc = s => Array.from(Buffer.from(s, 'latin1'));
const file = (name, bytes, type = '') => new File([new Uint8Array(bytes)], name, { type });
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const { PDF, ZIP, docx } = require('./helpers/fixtures.js');
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];
const check = (files, cfg) => FV.validateFiles(files, cfg);
const codes = async (files, cfg) => (await check(files, cfg)).errors;

// ================================================================ registry
test('the registry knows the common extensions, with browser aliases, and is queryable', () => {
    assert.deepEqual(FV.getMimeTypes('.pdf').slice(0, 1), ['application/pdf']);
    assert.ok(FV.getMimeTypes('.PDF').includes('application/x-pdf'), 'case-insensitive');
    assert.ok(FV.getMimeTypes('pdf').includes('application/pdf'), 'dot optional');
    assert.ok(FV.getMimeTypes('.csv').includes('application/vnd.ms-excel'), 'Windows reports Excel for csv');
    assert.ok(FV.getMimeTypes('.jpg').includes('image/pjpeg'));
    assert.ok(FV.getMimeTypes('.zip').includes('application/x-zip-compressed'));
    assert.ok(FV.getMimeTypes('.exe').length > 0, 'dangerous extensions are known too');
    assert.deepEqual(FV.getMimeTypes('.neverheardofit'), []);
    const all = FV.constants.EXTENSIONS();
    for (const ext of ['.png', '.jpg', '.pdf', '.docx', '.xlsx', '.pptx', '.mp4', '.mp3', '.zip', '.txt', '.csv', '.json', '.svg', '.webp', '.heic', '.woff2', '.mkv'])
        assert.ok(all[ext] && all[ext].length, ext);
    Object.keys(all).forEach(k => { assert.match(k, /^\.[a-z0-9]+$/); all[k].forEach(m => assert.match(m, /^[a-z]+\/[a-z0-9.+-]+$/, k + ' ' + m)); });
    all['.pdf'].push('hack');
    assert.ok(!FV.getMimeTypes('.pdf').includes('hack'), 'the snapshot is a copy');
});

test('addExtension teaches the registry; mimeByExtension does the same for one call', async () => {
    assert.throws(() => FV.addExtension('.x', []), /MIME/);
    FV.addExtension('.qzx', 'application/x-qzx');
    assert.deepEqual(FV.getMimeTypes('.qzx'), ['application/x-qzx']);
    FV.addExtension('QZY', ['application/x-qzy', 'application/octet-stream']);
    assert.deepEqual(FV.getMimeTypes('.qzy'), ['application/x-qzy', 'application/octet-stream']);
    assert.deepEqual((await check([file('a.qzx', [1, 2, 3], 'application/x-qzx')], { allowedExtensions: ['.qzx'] })).errors, []);
    assert.deepEqual(FV.getMimeTypes('.per-call'), [], 'not in the registry');
    assert.deepEqual(FV.getMimeTypes('.per-call', { mimeByExtension: { '.per-call': 'x/y' } }), ['x/y']);
    assert.deepEqual(FV.getMimeTypes('.pc', { mimeByExtension: { pc: ['X/Y'] } }), ['x/y']);
});

// ================================================================ dangerous by default
test('dangerous extensions AND dangerous MIME types are blocked by default', async () => {
    for (const n of ['a.exe', 'a.BAT', 'a.ps1', 'a.sh', 'a.js', 'a.php', 'a.jar', 'a.msi', 'a.vbs', 'a.lnk']) assert.ok((await codes([file(n, [1, 2, 3, 4])], {})).includes('DANGEROUS_FILE_TYPE'), n);
    for (const m of ['application/x-msdownload', 'application/x-dosexec', 'application/x-sh', 'application/java-archive', 'application/x-httpd-php', 'application/vnd.microsoft.portable-executable']) {
        const r = await check([file('photo.jpg', JPG, m)], {});
        assert.ok(r.errors.includes('DANGEROUS_FILE_TYPE'), m);
        assert.equal(r.details.find(d => d.code === 'DANGEROUS_FILE_TYPE').params.mime, m);
    }
    const one = await check([file('setup.exe', [1, 2, 3, 4], 'application/x-msdownload')], {});
    assert.equal(one.details.filter(d => d.code === 'DANGEROUS_FILE_TYPE').length, 1, 'reported once, not twice');
    assert.equal((await check([file('a.jpg', JPG, 'image/jpeg')], {})).isValid, true, 'harmless types are fine');
});

test('dangerous checks can be lifted explicitly: allowedExtensions, allowedMimeTypes, dangerousMimeTypes, validate.dangerousExt', async () => {
    const jar = () => file('app.jar', ZIP, 'application/java-archive');
    assert.equal((await check([jar()], { allowedExtensions: ['.jar'] })).isValid, true, 'an explicit extension allow wins (and .jar is a known type)');
    assert.equal((await check([jar()], { allowedMimeTypes: ['application/java-archive'], allowedExtensions: ['.jar'] })).isValid, true);
    assert.equal((await check([file('x.dat', [1, 2], 'application/x-sh')], { allowedMimeTypes: ['application/x-sh'] })).isValid, true, 'an explicit MIME allow wins');
    assert.equal((await check([file('x.dat', [1, 2], 'application/x-sh')], { validate: { dangerousExt: false } })).isValid, true);
    assert.equal((await check([file('x.dat', [1, 2], 'application/x-sh')], { dangerousMimeTypes: ['application/x-other'] })).isValid, true, 'custom list replaces the default');
    assert.ok((await codes([file('x.dat', [1, 2], 'application/x-other')], { dangerousMimeTypes: ['application/x-other'] })).includes('DANGEROUS_FILE_TYPE'));
    assert.ok(FV.constants.DEFAULT_DANGEROUS_MIME_TYPES.includes('application/x-msdownload'));
});

// ================================================================ extensions only: MIME comes from the registry
test('with only allowedExtensions, the reported type must fit the extension', async () => {
    const cfg = { allowedExtensions: ['.png', '.pdf', '.csv', '.jpg', '.zip', '.docx'] };
    const ok = [file('a.png', PNG, 'image/png'), file('b.pdf', PDF, 'application/pdf'), file('c.jpg', JPG, 'image/jpeg'),
        file('d.zip', ZIP, 'application/zip'), file('e.docx', docx(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')];
    for (const f of ok) assert.equal((await check([f], cfg)).isValid, true, f.name);
    // real-world aliases
    assert.equal((await check([file('a.csv', enc('a,b'), 'application/vnd.ms-excel')], cfg)).isValid, true);
    assert.equal((await check([file('a.csv', enc('a,b'), 'text/csv')], cfg)).isValid, true);
    assert.equal((await check([file('a.jpg', JPG, 'image/pjpeg')], cfg)).isValid, true);
    assert.equal((await check([file('a.zip', ZIP, 'application/x-zip-compressed')], cfg)).isValid, true);
    // the browser gave no type, or a generic one: nothing to compare, the extension decides
    assert.equal((await check([file('a.png', PNG, '')], cfg)).isValid, true);
    assert.equal((await check([file('a.png', PNG, 'application/octet-stream')], cfg)).isValid, true);
});

test('a type that does not fit the extension is MIME_MISMATCH, with a clear message', async () => {
    const r = await check([file('report.pdf', PDF, 'image/png')], { allowedExtensions: ['.pdf'] });
    assert.deepEqual(r.errors, ['MIME_MISMATCH']);
    assert.equal(r.details[0].message, "The file's type (image/png) doesn't match its extension (.pdf).");
    assert.deepEqual([r.details[0].params.mime, r.details[0].params.extension], ['image/png', '.pdf']);
    assert.ok((await codes([file('a.png', PNG, 'text/plain')], { allowedExtensions: 'png' })).includes('MIME_MISMATCH'));
});

test('an extension that is not allowed is only INVALID_EXTENSION, no extra MIME noise', async () => {
    assert.deepEqual(await codes([file('a.gif', enc('GIF89a'), 'image/gif')], { allowedExtensions: ['.png'] }), ['INVALID_EXTENSION']);
    assert.deepEqual(await codes([file('noext', [1, 2, 3], '')], { allowedExtensions: ['.png'] }), ['INVALID_EXTENSION']);
});

test('accept strings and legacy flags feed the same logic', async () => {
    assert.equal((await check([file('a.png', PNG, 'image/png')], { accept: '.png,.jpg' })).isValid, true);
    assert.ok((await codes([file('a.pdf', PDF, 'image/png')], { accept: '.pdf' })).includes('MIME_MISMATCH'));
    assert.equal((await check([file('a.png', PNG, 'image/png')], { validate: { extension: true }, allowedExtensions: ['.png'] })).isValid, true);
});

test('validate.mimeType:false switches the derived MIME check off', async () => {
    assert.equal((await check([file('a.pdf', PDF, 'image/png')], { allowedExtensions: ['.pdf'], validate: { mimeType: false } })).isValid, true);
    assert.equal((await check([file('a.xyz', [1, 2], '')], { allowedExtensions: ['.xyz'], validate: { mimeType: false } })).isValid, true);
});

// ================================================================ MIME not found -> error, unless given
test('an extension the registry does not know is reported as UNKNOWN_MIME', async () => {
    const f = () => file('data.abcdef', [1, 2, 3], '');
    const r = await check([f()], { allowedExtensions: ['.abcdef'] });
    assert.deepEqual(r.errors, ['UNKNOWN_MIME']);
    assert.equal(r.details[0].message, 'The type of ".abcdef" files is not known, so this file can\'t be verified.');
    assert.deepEqual(await codes([file('data.abcdef', [1, 2, 3], 'text/plain')], { allowedExtensions: ['.abcdef'] }), ['UNKNOWN_MIME'], 'a reported type cannot be verified either');
});

test('...and there are four ways to tell it what to expect', async () => {
    const f = (type = '') => file('data.abcdef', [1, 2, 3], type);
    // 1. allowedMimeTypes in the config
    assert.equal((await check([f('application/x-abc')], { allowedExtensions: ['.abcdef'], allowedMimeTypes: ['application/x-abc'] })).isValid, true);
    assert.deepEqual(await codes([f('text/plain')], { allowedExtensions: ['.abcdef'], allowedMimeTypes: ['application/x-abc'] }), ['INVALID_MIME']);
    // 2. mimeByExtension for this call
    const cfg2 = { allowedExtensions: ['.abcdef'], mimeByExtension: { '.abcdef': 'application/x-abc' } };
    assert.equal((await check([f('application/x-abc')], cfg2)).isValid, true);
    assert.equal((await check([f('')], cfg2)).isValid, true, 'no reported type: fine');
    assert.deepEqual(await codes([f('text/plain')], cfg2), ['MIME_MISMATCH']);
    // 3. allowUnknownMime
    assert.equal((await check([f('')], { allowedExtensions: ['.abcdef'], allowUnknownMime: true })).isValid, true);
    // 4. addExtension (see the registry test)
});

test('allowedMimeTypes decides on its own: extension registry is not consulted, wildcards work, unknown types are errors', async () => {
    assert.equal((await check([file('a.txt', enc('x'), 'text/csv')], { allowedExtensions: ['.txt'], allowedMimeTypes: ['text/csv'] })).isValid, true, 'list wins over the registry');
    assert.equal((await check([file('a.png', PNG, 'image/png')], { allowedMimeTypes: ['image/*'] })).isValid, true);
    assert.deepEqual(await codes([file('a.weird', [1, 2], '')], { allowedMimeTypes: ['image/*'] }), ['INVALID_MIME'], 'unknown extension + no reported type: cannot be verified');
    assert.equal((await check([file('a.weird', [1, 2], '')], { allowedMimeTypes: ['image/*'], allowUnknownMime: true })).isValid, true);
    const noExt = await check([file('picture', PNG, '')], { allowedMimeTypes: ['image/png'] });
    assert.equal(noExt.isValid, true, 'content sniffing finds the type of files with no extension and no reported type');
    assert.deepEqual(await codes([file('picture', enc('plain text'), '')], { allowedMimeTypes: ['image/png'] }), ['INVALID_MIME']);
});

test('nothing configured: unknown extensions are not an error (only dangerous checks apply)', async () => {
    assert.equal((await check([file('a.weirdext', [1, 2, 3], '')], {})).isValid, true);
    assert.equal((await check([file('a.weirdext', [1, 2, 3], 'application/x-whatever')], {})).isValid, true);
});

test('messages are friendly and never contain an unresolved placeholder', async () => {
    const rs = await Promise.all([
        check([file('a.pdf', PDF, 'image/png')], { allowedExtensions: ['.pdf'] }),
        check([file('a.abcdef', [1], '')], { allowedExtensions: ['.abcdef'] }),
        check([file('a.jpg', JPG, 'application/x-msdownload')], {}),
        check([file('noext', [1], 'application/x-sh')], {})
    ]);
    rs.forEach(r => { assert.equal(r.isValid, false); r.details.forEach(d => assert.ok(!/\{\w+\}/.test(d.message), d.code + ': ' + d.message)); });
    assert.match(rs[3].details[0].message, /application\/x-sh/, 'no extension: the MIME type is named instead');
});

test('custom message overrides for the new codes', async () => {
    const r = await check([file('a.pdf', PDF, 'image/png')], { allowedExtensions: ['.pdf'], messages: { MIME_MISMATCH: 'Wrong file type: {mime}' } });
    assert.equal(r.details[0].message, 'Wrong file type: image/png');
    const u = await check([file('a.abcdef', [1], '')], { allowedExtensions: ['.abcdef'], messages: { UNKNOWN_MIME: p => 'Cannot verify ' + p.extension } });
    assert.equal(u.details[0].message, 'Cannot verify .abcdef');
});

test('categories still come from the registry (images, video, audio, documents)', () => {
    const cat = (name, type = '') => FV.getCategory({ name, type });
    assert.deepEqual([cat('a.png'), cat('a.mp4'), cat('a.mp3'), cat('a.pdf'), cat('a.mkv'), cat('a.heic'), cat('a.weird')], ['image', 'video', 'audio', 'file', 'video', 'image', 'file']);
});
