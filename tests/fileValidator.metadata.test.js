'use strict';
// readMetadata / stripMetadata: what a photo gives away (EXIF, GPS, XMP, IPTC, comments) and removing it without touching the picture.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const FileValidator = require('../src/fileValidator.js');

const { ascii, mkFile, bytesOf, has, cat, jpeg, png, webp, chunk, crc, be32 } = require('./helpers/images.js');

test('readMetadata tells what is inside a JPEG, including a real GPS position', async () => {
    const m = await FileValidator.readMetadata(mkFile(jpeg({ exif: true, orientation: 6, gps: true, xmp: true, iptc: true, comment: true }), 'a.jpg', 'image/jpeg'));
    assert.equal(m.format, 'jpeg');
    assert.deepEqual([m.exif, m.gps, m.xmp, m.iptc, m.comments, m.orientation], [true, true, true, true, true, 6]);
    assert.deepEqual(m.kinds, ['EXIF', 'GPS location', 'XMP', 'IPTC / Photoshop', 'comments']);
    const clean = await FileValidator.readMetadata(mkFile(jpeg(), 'b.jpg', 'image/jpeg'));
    assert.deepEqual([clean.exif, clean.gps, clean.xmp, clean.iptc, clean.comments, clean.orientation, clean.kinds.length], [false, false, false, false, false, null, 0]);
});

test('an EXIF block without coordinates is not reported as GPS', async () => {
    const m = await FileValidator.readMetadata(mkFile(jpeg({ exif: true, orientation: 3, gps: false }), 'a.jpg', 'image/jpeg'));
    assert.equal(m.exif, true);
    assert.equal(m.gps, false);
});

test('stripMetadata removes EXIF, GPS, XMP, IPTC and comments from a JPEG and leaves the picture alone', async () => {
    const src = mkFile(jpeg({ exif: true, orientation: 1, gps: true, xmp: true, iptc: true, comment: true }), 'holiday.jpg', 'image/jpeg');
    const out = await FileValidator.stripMetadata(src);
    assert.notEqual(out, src);
    assert.equal(out.name, 'holiday.jpg');
    assert.equal(out.type, 'image/jpeg');
    assert.equal(out.lastModified, 1700000000000);
    assert.ok(out.size < src.size);
    assert.deepEqual(out.fvStripped.removed, ['EXIF', 'GPS location', 'XMP', 'IPTC / Photoshop', 'comments']);
    const b = await bytesOf(out);
    for (const secret of ['Exif', 'ns.adobe.com', 'Photoshop', 'secret camera']) assert.equal(has(b, secret), false, secret);
    assert.equal(has(b, 'JFIF'), true, 'the JFIF header stays');
    assert.equal(b[0], 0xff); assert.equal(b[1], 0xd8);
    assert.equal(b[b.length - 2], 0xff); assert.equal(b[b.length - 1], 0xd9);
    assert.equal(has(b, String.fromCharCode(0x55, 0x55, 0x55, 0x55)), true, 'the image data is byte for byte the same');
    assert.equal((await FileValidator.readMetadata(out)).kinds.length, 0);
});

test('the orientation of a phone photo survives, as a minimal EXIF with nothing else in it', async () => {
    const src = mkFile(jpeg({ exif: true, orientation: 6, gps: true }), 'p.jpg', 'image/jpeg');
    const out = await FileValidator.stripMetadata(src);
    const m = await FileValidator.readMetadata(out);
    assert.equal(m.orientation, 6);
    assert.equal(m.gps, false);
    assert.deepEqual(m.kinds, ['EXIF']);
    const dropped = await FileValidator.stripMetadata(src, { keepOrientation: false });
    assert.equal((await FileValidator.readMetadata(dropped)).exif, false);
});

test('the colour profile stays unless you ask otherwise', async () => {
    const src = mkFile(jpeg({ exif: true, orientation: 1, icc: true }), 'c.jpg', 'image/jpeg');
    assert.equal(has(await bytesOf(await FileValidator.stripMetadata(src)), 'ICC_PROFILE'), true);
    assert.equal(has(await bytesOf(await FileValidator.stripMetadata(src, { keepColorProfile: false })), 'ICC_PROFILE'), false);
});

test('a file with nothing to remove, and files that are not photos, come back unchanged', async () => {
    const clean = mkFile(jpeg(), 'clean.jpg', 'image/jpeg');
    assert.equal(await FileValidator.stripMetadata(clean), clean);
    const text = mkFile(new TextEncoder().encode('hello'), 'a.txt', 'text/plain');
    assert.equal(await FileValidator.stripMetadata(text), text);
    assert.equal(await FileValidator.readMetadata(text), null);
    const broken = mkFile(cat([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff], new Array(10).fill(1)), 'b.jpg', 'image/jpeg');
    assert.equal(await FileValidator.stripMetadata(broken), broken);
    const empty = mkFile(new Uint8Array(0), 'e.jpg', 'image/jpeg');
    assert.equal(await FileValidator.stripMetadata(empty), empty);
});

test('PNG: eXIf, text, XMP and time chunks go, the picture chunks stay, the CRC of a kept orientation is right', async () => {
    const src = mkFile(png({ exif: true, orientation: 8, gps: true, text: true, xmp: true, time: true }), 'a.png', 'image/png');
    const m = await FileValidator.readMetadata(src);
    assert.deepEqual([m.format, m.gps, m.xmp, m.comments, m.orientation], ['png', true, true, true, 8]);
    const out = await FileValidator.stripMetadata(src);
    const b = await bytesOf(out);
    for (const secret of ['tEXt', 'iTXt', 'tIME', 'private note', 'ns.adobe']) assert.equal(has(b, secret), false, secret);
    for (const keep of ['IHDR', 'gAMA', 'IDAT', 'IEND']) assert.equal(has(b, keep), true, keep);
    // walk the chunks: every CRC must be correct, eXIf holds only the orientation and comes before IDAT
    let pos = 8; const order = [];
    while (pos < b.length) {
        const size = (b[pos] << 24 | b[pos + 1] << 16 | b[pos + 2] << 8 | b[pos + 3]) >>> 0;
        const type = String.fromCharCode(...b.subarray(pos + 4, pos + 8));
        const stored = (b[pos + 8 + size] << 24 | b[pos + 9 + size] << 16 | b[pos + 10 + size] << 8 | b[pos + 11 + size]) >>> 0;
        assert.equal(stored, crc(b.subarray(pos + 4, pos + 8 + size)), 'CRC of ' + type);
        order.push(type);
        pos += 12 + size;
    }
    assert.deepEqual(order, ['IHDR', 'gAMA', 'eXIf', 'IDAT', 'IEND']);
    const after = await FileValidator.readMetadata(out);
    assert.deepEqual([after.orientation, after.gps, after.kinds], [8, false, ['EXIF']]);
});

test('WebP: EXIF and XMP chunks go, the flags and the RIFF size are updated, the orientation is kept', async () => {
    const src = mkFile(webp({ exif: true, orientation: 3, gps: true, xmp: true }), 'a.webp', 'image/webp');
    const m = await FileValidator.readMetadata(src);
    assert.deepEqual([m.format, m.gps, m.xmp, m.orientation], ['webp', true, true, 3]);
    const out = await FileValidator.stripMetadata(src);
    const b = await bytesOf(out);
    assert.equal(has(b, 'XMP '), false);
    assert.equal(has(b, 'EXIF'), true);                                  // the minimal orientation block
    const riffSize = b[4] | b[5] << 8 | b[6] << 16 | b[7] << 24;
    assert.equal(riffSize, b.length - 8);
    assert.equal(b[20] & 0x0c, 0x08, 'only the EXIF flag is set');
    const after = await FileValidator.readMetadata(out);
    assert.deepEqual([after.orientation, after.gps, after.xmp], [3, false, false]);
    const noOri = await FileValidator.stripMetadata(src, { keepOrientation: false });
    const nb = await bytesOf(noOri);
    assert.equal(has(nb, 'EXIF'), false);
    assert.equal(nb[20] & 0x0c, 0);
    assert.equal((nb[4] | nb[5] << 8 | nb[6] << 16 | nb[7] << 24), nb.length - 8);
});

test('the stripped file still passes FileValidator (signature, extension, size)', async () => {
    const out = await FileValidator.stripMetadata(mkFile(jpeg({ exif: true, orientation: 6, gps: true }), 'a.jpg', 'image/jpeg'));
    const r = await FileValidator.validateFiles([out], { allowedExtensions: ['jpg'], maxFileSizeMB: 1, imageDecode: false });
    assert.equal(r.isValid, true, JSON.stringify(r.errors));
});

test('folder paths survive', async () => {
    const f = mkFile(jpeg({ exif: true, orientation: 1, gps: true }), 'a.jpg', 'image/jpeg');
    f.fvPath = 'trip/day1/a.jpg';
    assert.equal((await FileValidator.stripMetadata(f)).fvPath, 'trip/day1/a.jpg');
});
