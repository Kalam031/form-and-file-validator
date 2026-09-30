'use strict';
require('./helpers/shim.js');
// FileValidator 2.6: PDF / Office / ZIP inspection, macros, zip bombs, malware-scan hook, more file signatures.
const test = require('node:test');
const assert = require('node:assert/strict');
const FV = require('../src/fileValidator.js');
const { enc, PDF, pdfWith, makeZip, EMPTY_ZIP, ZIP, docx, xlsx, pptx } = require('./helpers/fixtures.js');

const file = (name, bytes, type = '') => new File([new Uint8Array(bytes)], name, { type });
const check = (files, cfg) => FV.validateFiles(files, cfg);
const codes = async (f, cfg) => (await check([f], cfg)).errors;
const detected = async (f, cfg) => { const r = await check([f], cfg); return r.details.map(d => d.params && d.params.detected).filter(Boolean); };
const ok = async (f, cfg, msg) => { const r = await check([f], cfg); assert.equal(r.isValid, true, (msg || f.name) + ' -> ' + r.errors + ' ' + JSON.stringify(r.details.map(d => d.message))); };
const pad = (arr, n) => arr.concat(new Array(Math.max(0, n - arr.length)).fill(0));

// ================================================================ ZIP and Office structure
test('valid ZIP and Office files pass', async () => {
    await ok(file('a.zip', ZIP), {});
    await ok(file('empty.zip', EMPTY_ZIP), {});
    await ok(file('a.docx', docx()), {});
    await ok(file('a.xlsx', xlsx()), {});
    await ok(file('a.pptx', pptx()), {});
    await ok(file('a.docx', docx({ 'word/media/image1.png': 'x', 'docProps/core.xml': '<x/>' })), {});
    await ok(file('a.odt', makeZip({ mimetype: 'application/vnd.oasis.opendocument.text', 'content.xml': '<x/>' })), {});
    await ok(file('a.epub', makeZip({ mimetype: 'application/epub+zip' })), {});
    await ok(file('a.docx', docx({ 'word/embeddings/oleObject1.xlsx': 'x' })), {}, 'embedded documents are fine');
});

test('damaged archives are CORRUPT_FILE, with what kind of file and why', async () => {
    const z = makeZip({ 'readme.txt': 'hello world '.repeat(20) });
    const cut = z.slice(0, z.length - 30);
    let r = await check([file('cut.zip', cut)], {});
    assert.deepEqual(r.errors, ['CORRUPT_FILE']);
    assert.equal(r.details[0].params.kind, 'ZIP archive');
    assert.match(r.details[0].message, /^This ZIP archive looks damaged or incomplete: the ZIP directory at the end of the file is missing/);
    assert.deepEqual(await codes(file('a.docx', cut), {}), ['CORRUPT_FILE']);
    assert.equal((await check([file('a.docx', cut)], {})).details[0].params.kind, 'Office document');
    const bad = z.slice(); bad[bad.length - 6] = 0xff; bad[bad.length - 5] = 0xff;   // directory offset far outside the file
    assert.match((await check([file('a.zip', bad)], {})).details[0].message, /outside the file|damaged/);
    await ok(file('a.zip', cut), { documents: { checkStructure: false } });
    await ok(file('a.zip', cut), { documents: false });
    await ok(file('a.zip', cut), { validate: { documents: false } });
});

test('a ZIP renamed to .docx/.xlsx/.pptx is not an Office file', async () => {
    for (const [name, content] of [['fake.docx', ZIP], ['fake.xlsx', ZIP], ['fake.pptx', ZIP], ['fake.docx', xlsx()]]) {
        const r = await check([file(name, content)], {});
        assert.deepEqual(r.errors, ['CORRUPT_FILE'], name);
        assert.match(r.details[0].message, /required parts are missing, so it is not a real (DOCX|XLSX|PPTX) file/);
    }
    await ok(file('fake.docx', ZIP), { documents: { checkStructure: false } });
});

// ================================================================ macros, embedded programs, unsafe paths, bombs
test('macros: OOXML vbaProject.bin, LibreOffice Basic/Scripts, and legacy OLE documents', async () => {
    assert.deepEqual(await detected(file('a.docx', docx({ 'word/vbaProject.bin': 'x' })), {}), ['macros']);
    assert.deepEqual(await detected(file('a.xlsx', xlsx({ 'xl/vbaProject.bin': 'x' })), {}), ['macros']);
    assert.deepEqual(await detected(file('a.pptx', pptx({ 'ppt/vbaProject.bin': 'x' })), {}), ['macros']);
    assert.deepEqual(await detected(file('a.odt', makeZip({ mimetype: 'x', 'Basic/Standard/Module1.xml': '<x/>' })), {}), ['macros']);
    assert.deepEqual(await detected(file('a.ods', makeZip({ mimetype: 'x', 'Scripts/python/a.py': 'x' })), {}), ['macros']);
    assert.match((await check([file('a.docx', docx({ 'word/vbaProject.bin': 'x' }))], {})).details[0].message, /^This file contains macros, which can't be uploaded\.$/);
    await ok(file('a.docx', docx({ 'word/vbaProject.bin': 'x' })), { documents: { blockMacros: false } });

    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const utf16 = s => Array.from(s).flatMap(c => [c.charCodeAt(0), 0]);
    const macroDoc = pad(ole.concat(new Array(200).fill(0), utf16('VBA'), new Array(20).fill(0), utf16('_VBA_PROJECT')), 1024);
    const cleanDoc = pad(ole.concat(new Array(200).fill(0), utf16('WordDocument')), 1024);
    assert.deepEqual(await detected(file('old.doc', macroDoc), {}), ['macros']);
    assert.deepEqual(await detected(file('old.xls', macroDoc), {}), ['macros']);
    await ok(file('old.doc', cleanDoc), {});
    await ok(file('old.doc', macroDoc), { documents: { blockMacros: false } });
});

test('macro-enabled extensions are dangerous by default; allowing the extension explicitly allows their macros', async () => {
    for (const n of ['a.docm', 'a.xlsm', 'a.pptm', 'a.xlam', 'a.dotm']) assert.ok((await codes(file(n, docx({ 'word/vbaProject.bin': 'x' })), {})).includes('DANGEROUS_FILE_TYPE'), n);
    await ok(file('a.docm', docx({ 'word/vbaProject.bin': 'x' })), { allowedExtensions: ['.docm'] });
    await ok(file('a.xlsm', xlsx({ 'xl/vbaProject.bin': 'x' })), { allowedExtensions: ['.xlsm'] });
    assert.deepEqual(await detected(file('a.docx', docx({ 'word/vbaProject.bin': 'x' })), { allowedExtensions: ['.docx', '.docm'] }), ['macros'], 'a plain .docx with macros is still flagged');
});

test('embedded programs and ActiveX inside Office files', async () => {
    assert.deepEqual(await detected(file('a.docx', docx({ 'word/activeX/activeX1.xml': '<x/>' })), {}), ['embedded programs']);
    assert.deepEqual(await detected(file('a.xlsx', xlsx({ 'xl/embeddings/payload.exe': 'MZ' })), {}), ['embedded programs']);
    assert.deepEqual(await detected(file('a.pptx', pptx({ 'ppt/embeddings/run.js': 'x' })), {}), ['embedded programs']);
    await ok(file('a.docx', docx({ 'word/activeX/activeX1.xml': '<x/>' })), { documents: { blockEmbeddedPrograms: false } });
    await ok(file('a.zip', makeZip({ 'tools/setup.exe': 'MZ' })), {}, 'programs inside a plain zip are the archive owner\'s business');
});

test('unsafe paths inside archives (zip slip)', async () => {
    for (const bad of ['../evil.txt', 'a/../../evil.txt', '/etc/passwd', 'C:/Windows/x.dll', 'a\\..\\b.txt']) {
        assert.deepEqual(await detected(file('a.zip', makeZip({ [bad]: 'x' })), {}), ['unsafe file paths inside the archive'], bad);
    }
    await ok(file('a.zip', makeZip({ 'dir/file..name.txt': 'x', 'a/b/c.txt': 'y' })), {}, '".." inside a name is fine');
    await ok(file('a.zip', makeZip({ '../evil.txt': 'x' })), { documents: { blockUnsafePaths: false } });
});

test('zip bombs: expanded size, compression ratio, number of entries (from the directory, nothing is unpacked)', async () => {
    const huge = file('a.zip', makeZip({ 'big.bin': { data: 'x', usize: 3 * 1024 * 1048576, csize: 3 * 1048576 } }));
    let r = await check([huge], {});
    assert.deepEqual(r.errors, ['ARCHIVE_BOMB']);
    assert.match(r.details[0].message, /would expand to 3 GB/);
    const ratio = file('a.zip', makeZip({ 'a.bin': { data: 'x', usize: 100 * 1048576, csize: 100 * 1024 } }));
    r = await check([ratio], {});
    assert.match(r.details[0].message, /compresses 1024 times/);
    const many = {}; for (let i = 0; i < 5; i++) many['f' + i + '.txt'] = 'x';
    r = await check([file('a.zip', makeZip(many))], { documents: { maxEntries: 4 } });
    assert.match(r.details[0].message, /holds 5 files/);
    await ok(file('a.zip', makeZip(many)), { documents: { maxEntries: 5 } });
    await ok(huge, { documents: { maxUncompressedMB: 4096, maxCompressionRatio: 5000 } });
    await ok(file('ok.zip', makeZip({ 'a.txt': { data: 'x', usize: 20 * 1048576, csize: 5 * 1048576 } })), {}, 'a normal ratio is fine');
});

test('ZIP64 archives are not inspected (and not rejected)', async () => {
    const z = makeZip({ 'a.txt': 'x' });
    z[z.length - 12] = 0xff; z[z.length - 11] = 0xff;   // "entry count" = 0xFFFF: the real one lives in the ZIP64 record
    await ok(file('big.zip', z), {});
});

// ================================================================ PDF
test('PDF: valid passes, cut-off files are CORRUPT_FILE', async () => {
    await ok(file('a.pdf', PDF, 'application/pdf'), {});
    const cut = PDF.slice(0, PDF.length - 20);
    const r = await check([file('a.pdf', cut, 'application/pdf')], {});
    assert.deepEqual(r.errors, ['CORRUPT_FILE']);
    assert.equal(r.details[0].message, 'This PDF looks damaged or incomplete: the end of the file is missing (it may be cut off).');
    await ok(file('a.pdf', cut), { documents: { checkStructure: false } });
    await ok(file('a.pdf', PDF.concat(new Array(1500).fill(32))), {}, 'trailing whitespace after %%EOF is fine');
});

test('PDF: JavaScript, launch actions and embedded programs are blocked (also when the names are hex-escaped)', async () => {
    assert.deepEqual(await detected(file('a.pdf', pdfWith('/OpenAction << /S /JavaScript /JS (app.alert(1)) >>')), {}), ['JavaScript in a PDF']);
    assert.deepEqual(await detected(file('a.pdf', pdfWith('/AA << /O << /S /J#61vaScript /J#53 (x) >> >>')), {}), ['JavaScript in a PDF']);
    assert.deepEqual(await detected(file('a.pdf', pdfWith('/OpenAction << /S /Launch /F (cmd.exe) >>')), {}), ['a launch action in a PDF']);
    assert.deepEqual(await detected(file('a.pdf', pdfWith('/Names << /EmbeddedFiles << /Names [ (a) << /Type /Filespec /F (payload.exe) /EF << /F 5 0 R >> >> ] >> >> /Type /EmbeddedFile')), {}), ['an embedded program in a PDF']);
    await ok(file('a.pdf', pdfWith('/Type /EmbeddedFile /F (notes.pdf)')), {}, 'an attached document is fine');
    await ok(file('a.pdf', pdfWith('/OpenAction [ 3 0 R /Fit ]')), {}, 'go-to-page actions are fine');
    await ok(file('a.pdf', pdfWith('/S /JavaScript /JS (x)')), { documents: { blockPdfJavaScript: false } });
    await ok(file('a.pdf', pdfWith('/S /Launch')), { documents: { blockPdfLaunch: false } });
    await ok(file('a.pdf', pdfWith('/S /JavaScript')), { documents: false });
});

test('PDF scanning is bounded by maxScanMB and never throws on big files', async () => {
    const big = PDF.slice(0, PDF.length - 7).concat(new Array(400).fill(65), enc('%%EOF\n'));
    await ok(file('big.pdf', big), { documents: { maxScanMB: 0.0001 } });
});

// ================================================================ malware-scan hook
test('scan: a clean file passes; false, a threat name, or an object flags it', async () => {
    const f = () => file('a.zip', ZIP);
    await ok(f(), { scan: () => true });
    let r = await check([f()], { scan: async () => false });
    assert.deepEqual(r.errors, ['MALWARE_DETECTED']);
    assert.equal(r.details[0].message, "This file was flagged as malware and can't be uploaded.");
    r = await check([f()], { scan: () => 'Eicar-Test-Signature' });
    assert.equal(r.details[0].message, "This file was flagged as Eicar-Test-Signature and can't be uploaded.");
    r = await check([f()], { scan: () => ({ valid: false, threat: 'Trojan.X', code: 'INFECTED' }) });
    assert.deepEqual(r.errors, ['INFECTED']);
    assert.equal(r.details[0].params.threat, 'Trojan.X');
    r = await check([f()], { scan: () => ({ valid: false, message: 'Our scanner says no' }) });
    assert.equal(r.details[0].message, 'Our scanner says no');
    await ok(f(), { scan: () => ({ valid: true }) });
});

test('scan: gets the file and context, runs only for files that passed the other checks, and before remote', async () => {
    const seen = [], order = [];
    const cfg = { maxFileSize: 100, scan: (f, ctx) => { seen.push([f.name, ctx.ext, ctx.category, ctx.index, ctx.files.length]); order.push('scan'); return true; } };
    globalThis.fetch = async () => { order.push('remote'); return { ok: true, status: 200, json: async () => true }; };
    const r = await check([file('big.txt', new Array(500).fill(97), 'text/plain'), file('ok.txt', enc('fine'), 'text/plain')], { ...cfg, remote: '/c' });
    assert.equal(r.isValid, false);
    assert.deepEqual(seen, [['ok.txt', '.txt', 'file', 1, 2]], 'the oversized file was never scanned');
    assert.deepEqual(order, ['scan', 'remote']);
});

test('scan: failures and timeouts block the file (SCAN_ERROR) unless scanFailOpen', async () => {
    const f = () => file('a.zip', ZIP);
    const err = console.error; console.error = () => {};
    try {
        let r = await check([f()], { scan: () => { throw new Error('scanner offline'); } });
        assert.deepEqual(r.errors, ['SCAN_ERROR']);
        assert.equal(r.details[0].message, 'This file could not be scanned. Please try again.');
        r = await check([f()], { scan: () => new Promise(() => { }), scanTimeout: 30 });
        assert.deepEqual(r.errors, ['SCAN_ERROR'], 'a scanner that never answers');
        await ok(f(), { scan: () => { throw new Error('offline'); }, scanFailOpen: true });
        await ok(f(), { scan: () => new Promise(() => { }), scanTimeout: 20, scanFailOpen: true });
    } finally { console.error = err; }
});

// ================================================================ more signatures
const sig = async (name, bytes, ext) => assert.equal((await FV.detectSignature(file(name, pad(bytes, 300)))).name, ext, name);

test('new content signatures are recognised', async () => {
    await sig('a.psd', enc('8BPS'), 'psd');
    await sig('a.rtf', enc('{\\rtf1\\ansi'), 'rtf');
    await sig('a.ps', enc('%!PS-Adobe-3.0'), 'postscript');
    await sig('a.eps', [0xc5, 0xd0, 0xd3, 0xc6], 'postscript');
    await sig('a.sqlite', enc('SQLite format 3\0'), 'sqlite');
    await sig('a.woff', enc('wOFF'), 'woff');
    await sig('a.woff2', enc('wOF2'), 'woff2');
    await sig('a.otf', enc('OTTO'), 'otf');
    await sig('a.ttf', [0, 1, 0, 0, 0, 12], 'ttf');
    await sig('a.xz', [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0], 'xz');
    await sig('a.zst', [0x28, 0xb5, 0x2f, 0xfd], 'zstd');
    await sig('a.bz2', enc('BZh9'), 'bzip2');
    await sig('a.cab', enc('MSCF'), 'cab');
    await sig('a.flv', enc('FLV\x01'), 'flv');
    await sig('a.wmv', [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11], 'asf');
    await sig('a.mid', enc('MThd'), 'midi');
    await sig('a.aiff', enc('FORM').concat([0, 0, 0, 0], enc('AIFF')), 'aiff');
    await sig('a.mpg', [0, 0, 1, 0xba], 'mpeg-ps');
    await sig('a.dwg', enc('AC1027'), 'dwg');
    await sig('a.jp2', [0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a], 'jp2');
    const tar = new Array(300).fill(0); enc('ustar').forEach((b, i) => { tar[257 + i] = b; });
    assert.equal((await FV.detectSignature(file('a.tar', tar))).name, 'tar');
});

test('files with the new signatures pass under their own extension and fail under another one', async () => {
    const cases = [['a.psd', enc('8BPS')], ['a.sqlite', enc('SQLite format 3\0')], ['a.xz', [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0]], ['a.mid', enc('MThd')], ['a.woff2', enc('wOF2')]];
    for (const [name, bytes] of cases) {
        await ok(file(name, pad(bytes, 64)), {});
        assert.ok((await codes(file('renamed.png', pad(bytes, 64)), {})).includes('SIGNATURE_MISMATCH'), name + ' as .png');
    }
});

test('a weak signature (TrueType) never flags files with unknown extensions, only known ones', async () => {
    const ttfLike = pad([0, 1, 0, 0, 0, 12], 64);
    await ok(file('data.dat', ttfLike), {});
    await ok(file('font.ttf', ttfLike), {});
    assert.ok((await codes(file('picture.png', ttfLike), {})).includes('SIGNATURE_MISMATCH'));
});

test('more program formats are executable content: WebAssembly, Windows shortcuts, compiled help, Android dex', async () => {
    for (const [name, bytes, what] of [['a.dat', [0, 0x61, 0x73, 0x6d, 1, 0, 0, 0], 'wasm'], ['photo.jpg', [0x4c, 0, 0, 0, 1, 0x14, 2, 0], 'lnk'], ['a.txt', enc('ITSF'), 'chm'], ['a.bin', enc('dex\n035\0'), 'dex']]) {
        const r = await check([file(name, pad(bytes, 64))], {});
        assert.ok(r.errors.includes('DANGEROUS_CONTENT'), what);
        assert.equal(r.details.find(d => d.code === 'DANGEROUS_CONTENT').params.detected, what);
    }
    await ok(file('a.wasm', pad([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0], 64)), { allowExecutables: true, allowedExtensions: ['.wasm'] });
});

test('every new message resolves its placeholders', async () => {
    const rs = await Promise.all([
        check([file('a.zip', ZIP.slice(0, 40))], {}),
        check([file('a.docx', docx({ 'word/vbaProject.bin': 'x' }))], {}),
        check([file('a.zip', makeZip({ 'b.bin': { data: 'x', usize: 3 * 1024 * 1048576, csize: 1 } }))], {}),
        check([file('a.zip', ZIP)], { scan: () => false }),
        check([file('a.zip', ZIP)], { scan: () => { throw new Error('x'); } })
    ].map(p => p.catch(e => { throw e; })));
    rs.forEach(r => { assert.equal(r.isValid, false); r.details.forEach(d => assert.ok(!/\{\w+\}/.test(d.message), d.code + ': ' + d.message)); });
});
