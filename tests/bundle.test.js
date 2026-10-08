'use strict';
require('./helpers/shim.js');
// The one-file bundle (dist/validator.js and its minified copy) must behave like the separate sources in every way it is loaded.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { build } = require('../build.js');
const { PDF, pdfWith, docx } = require('./helpers/fixtures.js');

const JQ3 = fs.readFileSync(require.resolve('jquery3/dist/jquery.js'), 'utf8');
let built;
const getBuilt = async () => built || (built = await build({ write: false }));

function windowWith() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
    const w = dom.window;
    Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { for (let n = this; n && n.nodeType === 1; n = n.parentElement) if (n.hidden || n.style.display === 'none') return []; return [1]; } });
    Object.assign(w, { File, Blob, FormData, URLSearchParams, AbortController });   // Node's file classes: real bytes, real arrayBuffer()
    return w;
}
const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- freshness
test('dist/ is up to date with the sources (run "npm run build" after changing them)', async () => {
    const { code, minCode } = await getBuilt();
    const onDisk = p => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
    assert.equal(onDisk(path.join(__dirname, '..', 'dist', 'validator.js')), code, 'dist/validator.js is stale: run npm run build');
    assert.equal(onDisk(path.join(__dirname, '..', 'dist', 'validator.min.js')), minCode, 'dist/validator.min.js is stale: run npm run build');
    for (const f of ['fileValidator', 'fileValidator.widget', 'formValidator', 'formValidator.jquery', 'formValidator.additional', 'formValidator.element', 'formValidator.password', 'fileValidator.upload']) assert.ok(fs.existsSync(path.join(__dirname, '..', 'dist', f + '.min.js')), f + '.min.js');
});

test('the bundle is much smaller minified, keeps the version banner, and has no source maps or leftovers', async () => {
    const { code, minCode, versions } = await getBuilt();
    assert.ok(minCode.length < code.length * 0.65);
    assert.match(minCode, /^\/\*! FormValidator \d+\.\d+\.\d+ \+ FileValidator \d+\.\d+\.\d+/);
    assert.equal(Object.keys(versions).length, 11);
    for (const v of Object.values(versions)) assert.match(v, /^\d+\.\d+\.\d+$/);
});

// ---------------------------------------------------------------- the ways to load it
for (const kind of ['readable', 'minified']) {
    const src = async () => { const b = await getBuilt(); return kind === 'readable' ? b.code : b.minCode; };

    test(`[${kind}] script tag, no jQuery: globals exist, the jQuery layer stays out of the way`, async () => {
        const w = windowWith();
        w.eval(await src());
        for (const k of ['FormValidator', 'FileValidator']) assert.equal(typeof w[k], 'object', k);
        assert.equal(w.FormValidator.bundled, true);
        assert.equal(typeof w.FormValidator.useJQuery, 'function');
        for (const k of ['validateFiles', 'widget', 'resizeImage', 'filesFromDrop', 'addMethod', 'getMimeTypes']) assert.equal(typeof w.FileValidator[k], 'function', 'FileValidator.' + k);
        for (const k of ['init', 'validate', 'addMethod', 'registerRule']) assert.equal(typeof w.FormValidator[k], 'function', 'FormValidator.' + k);
        assert.equal(w.jQuery, undefined);
        assert.equal(typeof w.FVLocales.use, 'function');
        assert.match(w.FormValidator.version, /^\d+\.\d+\.\d+$/);
        assert.match(w.FileValidator.version, /^\d+\.\d+\.\d+$/);
    });

    test(`[${kind}] jQuery loaded before the bundle: $.fn.validate and $.validator are ready`, async () => {
        const w = windowWith();
        w.eval(JQ3);
        w.eval(await src());
        assert.equal(typeof w.jQuery.fn.validate, 'function');
        assert.equal(typeof w.jQuery.fn.valid, 'function');
        assert.equal(typeof w.jQuery.validator.addMethod, 'function');
        assert.ok(w.jQuery.validator.methods.fileValidator, 'the fileValidator method is there');
        w.document.body.innerHTML = '<form id="f"><input name="a" id="a"></form>';
        w.jQuery('#f').validate({ rules: { a: 'required' } });
        assert.equal(w.jQuery('#a').valid(), false);
        w.jQuery('#a').val('x');
        assert.equal(w.jQuery('#a').valid(), true);
    });

    test(`[${kind}] jQuery loaded after the bundle: FormValidator.useJQuery($) installs the layer (twice is harmless)`, async () => {
        const w = windowWith();
        w.eval(await src());
        w.eval(JQ3);
        assert.equal(w.jQuery.fn.validate, undefined);
        w.FormValidator.useJQuery(w.jQuery);
        w.FormValidator.useJQuery(w.jQuery);
        assert.equal(typeof w.jQuery.fn.validate, 'function');
        w.document.body.innerHTML = '<form id="f"><input name="a" id="a"></form>';
        w.jQuery('#f').validate({ rules: { a: { required: true, minlength: 3 } } });
        assert.equal(w.jQuery('#a').val('ab').valid(), false);
        assert.equal(w.jQuery('#a').val('abc').valid(), true);
    });

    test(`[${kind}] CommonJS / bundlers: require() returns { FormValidator, FileValidator, useJQuery, versions }`, async () => {
        const m = { exports: {} };
        new Function('module', 'exports', await src())(m, m.exports);
        const api = m.exports;
        assert.equal(typeof api.FormValidator.init, 'function');
        assert.equal(typeof api.FileValidator.validateFiles, 'function');
        assert.equal(typeof api.FileValidator.widget, 'function');
        assert.equal(typeof api.useJQuery, 'function');
        assert.equal(api.versions.formValidator, api.FormValidator.version);
        assert.equal(api.versions.fileValidator, api.FileValidator.version);
        const r = await api.FileValidator.validateFiles([new File(['x'], 'a.exe')], {});
        assert.equal(r.isValid, false);
    });

    test(`[${kind}] AMD loaders get the same API from define()`, async () => {
        let got;
        new Function('define', await src())(Object.assign(fn => { got = fn(); }, { amd: {} }));
        assert.equal(typeof got.FormValidator.init, 'function');
        assert.equal(typeof got.FileValidator.widget, 'function');
    });

    test(`[${kind}] real behaviour: forms, files, PDF/Office inspection, widget and jQuery layer all work from the bundle`, async () => {
        const w = windowWith();
        w.eval(JQ3);
        w.eval(await src());
        const { FormValidator, FileValidator } = w;

        // FormValidator: blocks invalid submit, jQuery-style rules, remote-free checks
        w.document.body.innerHTML = '<form id="f"><input name="email" id="email"><input name="pw" id="pw" type="password"><input name="pw2" id="pw2" type="password"><button>go</button></form>';
        const inst = FormValidator.init({ formId: 'f', rules: { email: { required: true, email: true }, pw: { minlength: 6 }, pw2: { equalTo: '#pw' } } });
        w.document.getElementById('email').value = 'nope';
        assert.equal(await inst.validate({ focus: false }), false);
        w.document.getElementById('email').value = 'a@b.co'; w.document.getElementById('pw').value = 'secret1'; w.document.getElementById('pw2').value = 'secret1';
        assert.equal(await inst.validate({ focus: false }), true);

        // FileValidator: dangerous, disguised, PDF with JavaScript, Office with macros, fine files
        const f = (name, bytes, type = '') => new File([new Uint8Array(bytes)], name, { type });
        const check = async (file, cfg) => Array.from((await FileValidator.validateFiles([file], cfg || {})).errors); // copy: the array comes from the jsdom realm
        assert.ok((await check(f('a.exe', [1, 2, 3, 4]))).includes('DANGEROUS_FILE_TYPE'));
        assert.ok((await check(f('invoice.exe.pdf', PDF, 'application/pdf'))).includes('HIDDEN_EXTENSION'));
        assert.deepEqual(await check(f('ok.pdf', PDF, 'application/pdf')), []);
        assert.ok((await check(f('bad.pdf', pdfWith('/S /JavaScript /JS (x)'), 'application/pdf'))).includes('DANGEROUS_CONTENT'));
        assert.ok((await check(f('m.docx', docx({ 'word/vbaProject.bin': 'x' })))).includes('DANGEROUS_CONTENT'));
        assert.deepEqual(await check(f('a.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0], 'image/png'), { allowedExtensions: ['.png'] }), []);
        assert.ok((await check(f('a.pdf', PDF, 'image/png'), { allowedExtensions: ['.pdf'] })).includes('MIME_MISMATCH'));

        // widget: adds accepted files, reports rejected ones
        w.document.body.innerHTML = '<div id="zone"><input type="file" id="in" multiple></div><ul id="list"></ul><div id="msg"></div>';
        const zone = FileValidator.widget('#zone', { accept: '.txt' }, { list: '#list', messageElement: '#msg' });
        const res = await zone.add([f('a.txt', [97], 'text/plain'), f('b.exe', [1, 2, 3, 4])]);
        assert.deepEqual([res.accepted.length, res.rejected.length], [1, 1]);
        assert.equal(w.document.querySelectorAll('#list .fv-file').length, 1);

        // jQuery layer: methods, messages, valid()
        w.document.body.innerHTML = '<form id="g"><input name="n" id="n" value="7"></form>';
        w.jQuery.validator.addMethod('even', function (v, el) { return this.optional(el) || v % 2 === 0; }, 'Even only');
        w.jQuery('#g').validate({ rules: { n: { even: true } } });
        assert.equal(w.jQuery('#n').valid(), false);
        assert.equal(w.jQuery('label.error').text(), 'Even only');
    });
}

test('the bundle and the separate files agree (same versions, same public API surface)', async () => {
    const { code, versions } = await getBuilt();
    const m = { exports: {} };
    new Function('module', 'exports', code)(m, m.exports);
    const FormSep = require('../src/formValidator.js'), FileSep = require('../src/fileValidator.js');
    require('../src/fileValidator.widget.js');
    assert.equal(m.exports.FormValidator.version, FormSep.version);
    assert.equal(m.exports.FileValidator.version, FileSep.version);
    assert.deepEqual(Object.keys(m.exports.FormValidator).sort(), Object.keys(FormSep).filter(k => k !== 'fieldElement').concat(['bundled', 'fieldElement', 'formElement', 'locales', 'otp', 'parseDate', 'parseNumber', 'passwordStrength', 'pwned', 'regions', 'useJQuery', 'watchPasswordStrength']).sort());
    assert.deepEqual(Object.keys(m.exports.FileValidator).sort(), Object.keys(FileSep).concat(['locales', 'upload', 'uploadQueue', 'UploadError', 'transformImage', 'convertImage', 'convertHeic', 'cropper', 'capture', 'isHeic']).sort());
    assert.equal(versions.formValidator, FormSep.version);
});

// ---------------------------------------------------------------- ES module build and the package "exports"
test('the ES module build exports the same API (named and default), readable and minified', async () => {
    const { pathToFileURL } = require('node:url');
    for (const f of ['validator.mjs', 'validator.min.mjs']) {
        const mod = await import(pathToFileURL(path.join(__dirname, '..', 'dist', f)).href);
        assert.equal(typeof mod.FormValidator.init, 'function', f);
        assert.equal(typeof mod.FileValidator.widget, 'function', f);
        assert.equal(typeof mod.useJQuery, 'function', f);
        assert.equal(mod.default.FormValidator, mod.FormValidator);
        assert.match(mod.versions.formValidator, /^\d+\.\d+\.\d+$/);
        const r = await mod.FileValidator.validateFiles([new File(['x'], 'a.exe')], {});
        assert.equal(r.isValid, false, f);
    }
});

test('the package name resolves to the right file for import, require and the subpaths', async () => {
    const esm = await import('form-and-file-validator');
    assert.equal(typeof esm.FormValidator.init, 'function');
    assert.equal(typeof esm.default.FileValidator.validateFiles, 'function');
    const cjs = require('form-and-file-validator');
    assert.equal(typeof cjs.FormValidator.init, 'function');
    assert.ok(require.resolve('form-and-file-validator').endsWith(path.join('dist', 'validator.js')));
    assert.equal(typeof require('form-and-file-validator/form').init, 'function');
    assert.equal(typeof require('form-and-file-validator/file').validateFiles, 'function');
    const pkg = require('form-and-file-validator/package.json');
    assert.equal(pkg.types, 'types/index.d.ts');
    for (const f of ['types/index.d.ts', 'types/formValidator.d.ts', 'types/fileValidator.d.ts', 'types/jquery-validate.d.ts', 'types/global.d.ts']) assert.ok(fs.existsSync(path.join(__dirname, '..', f)), f);
});

test('dist/SRI.json matches the built files (so the README script tags stay valid)', () => {
    const crypto = require('crypto'), fs = require('fs'), path = require('path');
    const sri = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dist', 'SRI.json'), 'utf8'));
    assert.ok(Object.keys(sri).length >= 10);
    for (const f of Object.keys(sri)) {
        const actual = 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(path.join(__dirname, '..', 'dist', f))).digest('base64');
        assert.equal(actual, sri[f], f + ' changed: regenerate dist/SRI.json and the README hashes');
    }
});
