'use strict';
// Polyglots (a script, program or archive hidden in a picture), FileValidator.safeName() and FileValidator.detect().
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const FV = require('../src/fileValidator.js');
const { makeZip, ZIP, PDF, enc } = require('./helpers/fixtures.js');
const { makePng } = require('../browser-tests/files.js');

const file = (name, bytes, type = '') => new File([new Uint8Array(bytes)], name, { type });
const cat = (...parts) => [].concat(...parts.map(p => (typeof p === 'string' ? enc(p) : Array.from(p))));
const PNG = Array.from(makePng(8, 8));
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...enc('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9];
const GIF = [...enc('GIF89a'), 8, 0, 8, 0, 0, 0, 0, 0x3b];
const verdict = async (f, cfg) => { const r = await FV.validateFiles([f], cfg || {}); return { ok: r.isValid, errors: r.errors, text: r.messages ? r.messages.join(' ') : '' }; };
const dangerous = async (f, cfg) => { const v = await verdict(f, cfg); assert.equal(v.ok, false, 'should be blocked'); assert.ok(v.errors.includes('DANGEROUS_CONTENT'), String(v.errors)); return v; };
const clean = async (f, cfg) => { const v = await verdict(f, cfg); assert.equal(v.ok, true, 'should pass: ' + v.errors); };

// ---------------------------------------------------------------- polyglots
test('real pictures still pass', async () => {
    await clean(file('a.png', PNG, 'image/png'));
    await clean(file('a.jpg', JPEG, 'image/jpeg'));
    await clean(file('a.gif', GIF, 'image/gif'));
});
test('a PHP script appended to a PNG or JPEG, or tucked into a comment, is blocked', async () => {
    await dangerous(file('shell.png', cat(PNG, '<?php system($_GET["c"]); ?>'), 'image/png'));
    await dangerous(file('shell.jpg', cat(JPEG.slice(0, -2), [0xff, 0xfe, 0, 30], '<?php echo 1; ?>', [0xff, 0xd9]), 'image/jpeg'));
    await dangerous(file('shell.PNG', cat(PNG.slice(0, 33), '<?PHP echo 1;', PNG.slice(33)), 'image/png'));
});
test('HTML or script text inside a picture (XSS through content sniffing) is blocked', async () => {
    await dangerous(file('x.png', cat(PNG, '<script>alert(document.domain)</script>'), 'image/png'));
    await dangerous(file('x.gif', cat(GIF, '<html><body onload=alert(1)>'), 'image/gif'));
    await dangerous(file('x.jpg', cat(JPEG, '<!DOCTYPE html><title>x</title>'), 'image/jpeg'));
    await dangerous(file('x.png', cat(PNG, '#!/bin/sh\nrm -rf /'), 'image/png'));
    await dangerous(file('x.png', cat(PNG, '<%@ Page Language="C#" %>'), 'image/png'));
});
test('a GIF that is also JavaScript (GIF89a/*...) is blocked, a big real GIF is not', async () => {
    await dangerous(file('p.gif', cat('GIF89a/*', [0, 0, 0, 0], '*/=1;alert(1)//;'), 'image/gif'));
    await dangerous(file('p.gif', cat('GIF89a', '=1', '=1', '/*', [0, 0], '*/;alert(1);'), 'image/gif'));
    await clean(file('wide.gif', [...enc('GIF89a'), 0x00, 0x20, 0x00, 0x03, 0, 0, 0, 0x3b], 'image/gif'));   // 8192 x 768 px: the high byte is not printable text
});
test('an EXE or ELF program appended to a picture is blocked', async () => {
    const stub = 'MZ\x90\x00' + '\x00'.repeat(60) + 'This program cannot be run in DOS mode.\r\r\n$';
    await dangerous(file('p.jpg', cat(JPEG, stub), 'image/jpeg'));
    await dangerous(file('p.png', cat(PNG, [0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0]), 'image/png'));
    await clean(file('ok.png', cat(PNG, [0x7f, 0x45, 0x4c, 0x46, 9, 9, 9]), 'image/png'), {});   // not a valid ELF header: only the four bytes
});
test('a ZIP / JAR appended to a picture (GIFAR) and a PDF hidden after it are blocked, a real picture with random data is not', async () => {
    await dangerous(file('gifar.gif', cat(GIF, ZIP), 'image/gif'));
    await dangerous(file('a.png', cat(PNG, makeZip({ 'Evil.class': 'cafebabe', 'META-INF/MANIFEST.MF': 'Main-Class: Evil' })), 'image/png'));
    await dangerous(file('a.jpg', cat(JPEG, PDF), 'image/jpeg'));
    // a PK header that is not a complete archive, and random bytes that happen to hold two of the four bytes of a signature
    await clean(file('noise.png', cat(PNG, [0x50, 0x4b, 0x05, 0x06, 1, 2, 3], [0x25, 0x50, 0x44], [0x3c, 0x3f]), 'image/png'));
    const noise = []; let x = 12345; for (let i = 0; i < 200000; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; noise.push(x & 255); }
    await clean(file('big.png', cat(PNG, noise), 'image/png'));
});
test('the scan covers the head and the tail; a payload far from both needs a bigger polyglotScanKB', async () => {
    const filler = new Array(600 * 1024).fill(0x11);
    const middle = file('m.png', cat(PNG, filler.slice(0, 300 * 1024), '<?php evil();', filler.slice(0, 300 * 1024)), 'image/png');
    await clean(middle);
    await dangerous(middle, { polyglotScanKB: 512 });
    await dangerous(file('t.png', cat(PNG, filler, '<?php evil();'), 'image/png'));
    await dangerous(file('h.png', cat(PNG, '<?php evil();', filler), 'image/png'));
});
test('polyglot: false switches it off; polyglot: "all" also covers audio and PDFs; documents and archives are never treated as pictures', async () => {
    const shell = file('shell.png', cat(PNG, '<?php 1; ?>'), 'image/png');
    await dangerous(shell);
    await clean(shell, { polyglot: false });
    await clean(shell, { validate: { polyglot: false } });
    const wav = file('a.wav', cat('RIFF', [4, 0, 0, 0], 'WAVE', '<?php 1; ?>'), 'audio/wav');
    await clean(wav);
    await dangerous(wav, { polyglot: 'all' });
    await clean(file('a.zip', ZIP.concat(enc('<?php nothing ?>')), 'application/zip'), { polyglot: 'all' });
    await clean(file('a.pdf', PDF, 'application/pdf'), { polyglot: 'all' });
});
test('the message names what was found, in the current language', async () => {
    const v = await FV.validateFile(file('shell.png', cat(PNG, '<?php 1; ?>'), 'image/png'), {});
    assert.match(String(v.messages ? v.messages.join(' ') : JSON.stringify(v)), /scripts/);
    const v2 = await FV.validateFile(file('z.gif', cat(GIF, ZIP), 'image/gif'), {});
    assert.match(String(v2.messages ? v2.messages.join(' ') : JSON.stringify(v2)), /hidden extra data/);
});
test('the unknown-option warning knows the new options', async () => {
    const ow = console.warn; const warns = []; console.warn = m => warns.push(String(m));
    try { await FV.validateFiles([file('a.png', PNG)], { polyglot: true, polyglotScanKB: 64 }); } finally { console.warn = ow; }
    assert.equal(warns.filter(w => /polyglot/.test(w)).length, 0);
});

// ---------------------------------------------------------------- safeName
test('safeName: path, control characters, bidi override, special characters, reserved names', () => {
    const s = FV.safeName;
    assert.equal(s('photo.jpg'), 'photo.jpg');
    assert.equal(s('../../etc/passwd'), 'passwd');
    assert.equal(s('C:\\Users\\bob\\evil.exe'), 'evil.exe');
    assert.equal(s('a\u0000b\u0007c.txt'), 'abc.txt');
    assert.equal(s('invoice\u202Egpj.exe'), 'invoicegpj.exe', 'the right-to-left override that makes exe look like jpg is removed');
    assert.equal(s('a\u200Bb\uFEFF.txt'), 'ab.txt');
    assert.equal(s('re<po>rt: "final"|v2?.pdf'), 're_po_rt_ _final__v2_.pdf'.replace(/ +/g, ' '));
    assert.equal(s('CON.txt'), '_CON.txt');
    assert.equal(s('nul'), '_nul');
    assert.equal(s('LPT1.log'), '_LPT1.log');
    assert.equal(s('console.txt'), 'console.txt');
    assert.equal(s('name. '), 'name');
    assert.equal(s('...hidden'), 'hidden');
    assert.equal(s('   '), 'file');
    assert.equal(s(''), 'file');
    assert.equal(s(null), 'file');
    assert.equal(s(undefined, { fallback: 'upload' }), 'upload');
    assert.equal(s('.htaccess'), 'htaccess');
    assert.equal(s('a  b   c.txt'), 'a b c.txt');
});
test('safeName: only the last dot is an extension, so double extensions cannot be read by a server as code', () => {
    assert.equal(FV.safeName('invoice.php.jpg'), 'invoice_php.jpg');
    assert.equal(FV.safeName('a.b.c.d.png'), 'a_b_c_d.png');
    assert.equal(FV.safeName('archive.tar.gz'), 'archive_tar.gz');
    assert.equal(FV.safeName('invoice.php.jpg', { dots: 'keep' }), 'invoice.php.jpg');
    assert.equal(FV.safeName('no extension at all, just words'), 'no extension at all, just words');
    assert.equal(FV.safeName('trailing.'), 'trailing');
    assert.equal(FV.safeName('x.' + 'e'.repeat(30)), 'x_' + 'e'.repeat(30));
});
test('safeName: length keeps the extension; unicode, ascii, lowercase, replacement', () => {
    const long = 'a'.repeat(300) + '.jpeg';
    const out = FV.safeName(long);
    assert.equal(out.length, 100);
    assert.ok(out.endsWith('.jpeg'));
    assert.equal(FV.safeName('b'.repeat(50), { maxLength: 20 }).length, 20);
    assert.equal(FV.safeName('日本語のファイル.pdf'), '日本語のファイル.pdf');
    assert.equal(Array.from(FV.safeName('😀'.repeat(200) + '.png')).length, 100);
    assert.equal(FV.safeName('Résumé Ünïcode.PDF', { ascii: true }), 'Resume Unicode.PDF');
    assert.equal(FV.safeName('日本.txt', { ascii: true }), '__.txt');
    assert.equal(FV.safeName('MiXeD.PnG', { lowercase: true }), 'mixed.png');
    assert.equal(FV.safeName('a:b.txt', { replacement: '-' }), 'a-b.txt');
    assert.equal(FV.safeName('a:b.txt', { replacement: '/' }), 'a_b.txt', 'an unsafe replacement falls back to _');
    assert.equal(FV.safeName('e\u0301.txt'), '\u00e9.txt', 'normalised to NFC');
});
test('safeName: idempotent and always safe on hostile input', () => {
    const inputs = ['../a', 'a/../b', 'CON', 'COM1.txt', '\u202e\u202d.exe', 'a'.repeat(500), '....', ' . ', '"quoted".txt', 'tab\there', 'new\nline.txt', '%00.png', 'a\\b\\c', '\u0000', 'x.y.z', '.a.b.', 'AUX.tar.gz', 'é'.repeat(150) + '.jpg', '<script>.png', 'ends with space .txt'];
    for (const i of inputs) {
        const a = FV.safeName(i), b = FV.safeName(a);
        assert.equal(b, a, JSON.stringify(i) + ' is not stable: ' + a + ' -> ' + b);
        assert.ok(a.length > 0 && !/[\\/:*?"<>|\u0000-\u001f\u202a-\u202e]/.test(a), JSON.stringify(i) + ' -> ' + a);
        assert.ok(!/^[.\s]|[.\s]$/.test(a), JSON.stringify(i) + ' -> ' + a);
        assert.ok(!/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(a), JSON.stringify(i) + ' -> ' + a);
    }
    assert.equal(FV.safeName(12345), '12345');
});

// ---------------------------------------------------------------- detect
test('detect: the content decides, not the name or the type', async () => {
    assert.deepEqual(await FV.detect(file('whatever.txt', PNG, 'text/plain')), { type: 'png', mime: 'image/png', extensions: ['.png', '.apng'], executable: false });
    const mz = new Array(128).fill(0); mz[0] = 0x4d; mz[1] = 0x5a; mz[60] = 0x80;
    const exe = await FV.detect(file('cute.jpg', mz, 'image/jpeg'));
    assert.equal(exe.executable, true);
    assert.equal(exe.type, 'exe');
    assert.equal(await FV.detect(file('plain.txt', enc('just text'), 'text/plain')), null);
    assert.equal((await FV.detect(file('d.pdf', PDF))).type, 'pdf');
    assert.equal(await FV.detect({}), undefined, 'not a file: unreadable');
});
