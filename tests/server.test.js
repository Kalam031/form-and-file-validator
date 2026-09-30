'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validate, middleware, toFile, flatten, locales: serverLocales } = require('../dist/server.js');

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);   // "MZ": a Windows program
const rules = { allowedExtensions: ['.png', '.pdf'], maxFileSizeMB: 1 };
const multerFile = (name, buf, mimetype = 'image/png') => ({ fieldname: 'f', originalname: name, mimetype, buffer: buf, size: buf.length });

function run(mw, req) {
    return new Promise(resolve => {
        const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ nexted: false, code: this.code, body: b }); } };
        mw(req, res, err => resolve({ nexted: true, err }));
    });
}

test('validate: a real PNG passes, a program renamed to .png is caught by its content', async () => {
    assert.equal((await validate([multerFile('a.png', PNG)], rules)).isValid, true);
    const bad = await validate([multerFile('a.png', EXE)], rules);
    assert.equal(bad.isValid, false);
    assert.ok(bad.details.some(d => d.code === 'SIGNATURE_MISMATCH'));
});

test('validate: size, extension and count limits work like in the browser', async () => {
    const big = multerFile('big.png', Buffer.concat([PNG, Buffer.alloc(1.5 * 1048576)]));
    assert.ok((await validate([big], rules)).details.some(d => d.code === 'SIZE_TOO_LARGE'));
    assert.ok((await validate([multerFile('x.exe', EXE, 'application/octet-stream')], rules)).details.some(d => ['DANGEROUS_FILE_TYPE', 'INVALID_EXTENSION'].includes(d.code)));
    assert.ok((await validate([multerFile('a.png', PNG), multerFile('b.png', PNG)], Object.assign({ maxFiles: 1 }, rules))).details.some(d => d.code === 'TOO_MANY_FILES'));
});

test('adapters: multer fields object, formidable, express-fileupload, path and Web File', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-'));
    const disk = path.join(dir, 'up.png'); fs.writeFileSync(disk, PNG);
    const input = {
        avatar: [multerFile('a.png', PNG)],
        docs: [{ filepath: disk, originalFilename: 'b.png', mimetype: 'image/png' }],
        one: { name: 'c.png', data: PNG, mimetype: 'image/png' }
    };
    assert.equal(flatten(input).length, 3);
    const r = await validate([input, { path: disk, originalname: 'd.png' }, new File([PNG], 'e.png', { type: 'image/png' })], rules);
    assert.equal(r.files.length, 5);
    assert.equal(r.isValid, true, JSON.stringify(r.details));
    assert.equal((await toFile(multerFile('z.png', PNG))).name, 'z.png');
    await assert.rejects(() => toFile({ originalname: 'n.png' }), /cannot read/);
});

test('middleware: valid -> next() with req.fileValidation; invalid -> 422 JSON; no files -> 422 unless allowed', async () => {
    const mw = middleware(rules);
    const ok = { files: [multerFile('a.png', PNG)] };
    assert.equal((await run(mw, ok)).nexted, true);
    assert.equal(ok.fileValidation.isValid, true);
    const bad = await run(mw, { files: [multerFile('a.png', EXE)] });
    assert.equal(bad.code, 422); assert.equal(bad.body.ok, false); assert.ok(bad.body.files[0].details[0].code);
    assert.equal((await run(mw, { files: [] })).code, 422);
    assert.equal((await run(middleware(rules, { allowNoFiles: true }), { files: [] })).nexted, true);
});

test('middleware: req.file, config function, custom status, failed disk uploads are removed', async () => {
    assert.equal((await run(middleware(() => rules), { file: multerFile('a.png', PNG) })).nexted, true);
    assert.equal((await run(middleware(rules, { status: 400 }), { file: multerFile('a.png', EXE) })).code, 400);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-'));
    const disk = path.join(dir, 'bad.png'); fs.writeFileSync(disk, EXE);
    await run(middleware(rules), { file: { path: disk, originalname: 'bad.png', mimetype: 'image/png' } });
    assert.equal(fs.existsSync(disk), false);
});

test('middleware: an unreadable upload passes the error to next()', async () => {
    const r = await run(middleware(rules), { file: { originalname: 'n.png' } });
    assert.equal(r.nexted, true); assert.match(String(r.err), /cannot read/);
});

test('server languages: FileValidator messages follow FVLocales on the server too', async () => {
    require('../dist/locales/de.js');
    serverLocales.use('de');
    try {
        const r = await validate([multerFile('a.png', EXE)], rules);
        assert.match(r.details[0].message, /Datei|Inhalt|Dateityp/);
    } finally { serverLocales.use('en'); }
});
