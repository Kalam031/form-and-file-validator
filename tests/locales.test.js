'use strict';
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const api = require('../dist/validator.js');
const { FormValidator, FileValidator, locales } = api;
const dir = path.join(__dirname, '..', 'src', 'locales');
const codes = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, ''));
codes.forEach(c => require(path.join(dir, c + '.js')));

const placeholders = s => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
const en = { form: Object.assign({}, FormValidator.messages), file: Object.assign({}, FileValidator.defaultMessages) };

test.afterEach(() => locales.use('en'));

test('13 packs ship and register', () => {
    assert.ok(codes.length >= 13, codes.join());
    const listed = locales.list().map(l => l.code);
    codes.forEach(c => assert.ok(listed.includes(c), c));
    assert.strictEqual(locales.list().find(l => l.code === 'ar').dir, 'rtl');
});

for (const code of codes) {
    test('pack ' + code + ' is complete and keeps every placeholder', () => {
        const p = locales.get(code);
        Object.keys(en.form).forEach(k => {
            assert.ok(p.form[k] && p.form[k].trim(), code + ' form.' + k);
            assert.strictEqual(placeholders(p.form[k]), placeholders(en.form[k]), code + ' form.' + k);
        });
        Object.keys(en.file).forEach(k => {
            assert.ok(p.file[k] && p.file[k].trim(), code + ' file.' + k);
            assert.strictEqual(placeholders(p.file[k]), placeholders(en.file[k]), code + ' file.' + k);
        });
        const keys = locales.keys().phrases;
        keys.forEach(k => assert.ok(p.phrases[k], code + ' phrase ' + k));
        ['B', 'KB', 'MB', 'GB'].forEach(u => assert.ok(p.units[u], code + ' unit ' + u));
        ['added', 'rejected'].forEach(n => { assert.ok(p.phrases['status.' + n].other, code + ' plural ' + n); assert.ok(/\{n\}/.test(p.phrases['status.' + n].other), code + ' {n} in ' + n); });
        assert.ok(['ltr', 'rtl'].includes(p.dir || 'ltr'));
    });
}

test('use() translates FormValidator, then use("en") restores English', () => {
    locales.use('de');
    assert.strictEqual(FormValidator.messages.required, 'Dieses Feld ist erforderlich.');
    locales.use('en');
    assert.strictEqual(FormValidator.messages.required, en.form.required);
});

test('FileValidator messages, units and phrases follow the language', () => {
    locales.use('fr');
    assert.strictEqual(FileValidator.units.MB, 'Mo');
    assert.strictEqual(FileValidator.formatBytes(2 * 1048576), '2 Mo');
    assert.strictEqual(FileValidator.phrase('macros'), 'des macros');
    assert.strictEqual(FileValidator.locale, 'fr');
    locales.use('en');
    assert.strictEqual(FileValidator.units.MB, 'MB');
    assert.strictEqual(FileValidator.phrase('macros'), 'macros');
});

test('plural forms follow the language (ru, ar, en)', () => {
    locales.use('ru');
    const f = (n) => FileValidator.phraseN('status.added', n, {}, { one: 'x', other: 'y' });
    assert.strictEqual(f(1), 'Добавлен 1 файл.');
    assert.strictEqual(f(3), 'Добавлено 3 файла.');
    assert.strictEqual(f(5), 'Добавлено 5 файлов.');
    locales.use('ar');
    assert.strictEqual(FileValidator.phraseN('status.added', 2, {}, {}), 'تمت إضافة ملفين.');
    locales.use('en');
    assert.strictEqual(FileValidator.phraseN('status.added', 2, {}, { one: '{n} file added.', other: '{n} files added.' }), '2 files added.');
});

test('partial packs fall back to English', () => {
    locales.register('sv', { name: 'Svenska', form: { required: 'Fältet är obligatoriskt.' } });
    locales.use('sv');
    assert.strictEqual(FormValidator.messages.required, 'Fältet är obligatoriskt.');
    assert.strictEqual(FormValidator.messages.email, en.form.email);
});

test('unknown language throws a helpful error; register validates input', () => {
    assert.throws(() => locales.use('xx'), /unknown language/);
    assert.throws(() => locales.register('', {}), /language code/);
});

test('auto() picks the browser language, with region fallback and default', () => {
    const nav = globalThis.navigator;
    const set = v => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true });
    try {
        set({ languages: ['de-AT', 'en'] });
        assert.strictEqual(locales.auto().code, 'de');
        set({ languages: ['xx-YY'] });
        assert.strictEqual(locales.auto().code, 'en');
        set({ languages: ['zh-CN'] });
        assert.strictEqual(locales.auto().code, 'zh');
    } finally { if (nav === undefined) delete globalThis.navigator; else set(nav); }
});

test('use() with document:true sets lang and dir', () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const saved = globalThis.document;
    // the registry reads the global scope it was built with, so patch document there
    Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
    try {
        locales.use('ar', { document: true });
        assert.strictEqual(dom.window.document.documentElement.getAttribute('dir'), 'rtl');
        assert.strictEqual(dom.window.document.documentElement.getAttribute('lang'), 'ar');
    } finally { if (saved === undefined) delete globalThis.document; else Object.defineProperty(globalThis, 'document', { value: saved, configurable: true }); }
});

test('dist/locales files exist and the combined file loads every language', () => {
    ['all.js', 'all.min.js', 'de.js', 'de.min.js'].forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', 'dist', 'locales', f)), f));
    const all = fs.readFileSync(path.join(__dirname, '..', 'dist', 'locales', 'all.js'), 'utf8');
    codes.forEach(c => assert.ok(all.includes('(' + c + ')'), c));
});

test('jQuery layer messages follow the language, including {0}/{1} parameter messages', () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><body></body>');
    const saved = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window: dom.window, document: dom.window.document });
    const $ = require('jquery');      // jQuery finds the global window (same setup as the jQuery compat tests)
    globalThis.jQuery = $;
    api.useJQuery($);
    locales.use('de');
    assert.strictEqual($.validator.messages.required, 'Dieses Feld ist erforderlich.');
    assert.strictEqual($.validator.messages.maxlength(5), 'Bitte geben Sie höchstens 5 Zeichen ein.');
    assert.strictEqual($.validator.messages.range([1, 9]), 'Bitte geben Sie einen Wert zwischen 1 und 9 ein.');
    locales.use('en');
    assert.strictEqual($.validator.messages.maxlength(5), 'Please enter no more than 5 characters.');
    delete globalThis.jQuery;
    Object.keys(saved).forEach(k => { if (saved[k] === undefined) delete globalThis[k]; else globalThis[k] = saved[k]; });
});
