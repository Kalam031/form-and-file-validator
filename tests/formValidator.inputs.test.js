'use strict';
// otp() one-time-code boxes, parseNumber / parseDate (locale-aware) and the localeNumber / localeDate rules.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { for (let n = this; n && n.nodeType === 1; n = n.parentElement) if (n.hidden || n.style.display === 'none') return []; return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, FormData: w.FormData, Event: w.Event, AbortController: w.AbortController });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');
require('../src/formValidator.inputs.js');

const settle = (ms = 20) => new Promise(r => setTimeout(r, ms));
const type = (el, text) => { el.value = text; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const key = (el, k) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
const paste = (el, text) => { const e = new w.Event('paste', { bubbles: true, cancelable: true }); e.clipboardData = { getData: () => text }; el.dispatchEvent(e); return e; };
function mount(html) { document.body.innerHTML = '<form id="f">' + html + '<button>Go</button></form>'; return document.getElementById('f'); }

// ---------------------------------------------------------------- parseNumber
test('parseNumber reads numbers the way each country writes them', () => {
    const n = FormValidator.parseNumber;
    assert.equal(n('1.234,56', 'de'), 1234.56);
    assert.equal(n('1,234.56', 'en'), 1234.56);
    assert.equal(n('1 234,56', 'fr'), 1234.56);
    assert.equal(n('1 234,56', 'fr'), 1234.56);
    assert.equal(n('1 234,56', 'fr'), 1234.56);
    assert.equal(n("1'234.5", 'de-CH'), 1234.5);
    assert.equal(n('12,34,567.5', 'en-IN'), 1234567.5);
    assert.equal(n('١٢٣٫٥', 'ar-EG'), 123.5);
    assert.equal(n('-1.234', 'de'), -1234);
    assert.equal(n('−5', 'en'), -5);
    assert.equal(n(',5', 'de'), 0.5);
    assert.equal(n('1234567.5', 'en'), 1234567.5);
    assert.equal(n(42, 'de'), 42);
});
test('parseNumber is strict: wrong separators, stray text, exponents, empty and non-text are NaN', () => {
    const n = FormValidator.parseNumber;
    for (const [t, l] of [['1.5', 'de'], ['1,23,4', 'en'], ['1,234,56', 'en'], ['12,3456', 'en'], ['abc', 'en'], ['1e3', 'en'], ['', 'en'], ['  ', 'en'], ['-', 'en'], ['1.2.3', 'en'], ['1 2', 'en'], ['0x10', 'en'], ['1,,234', 'en'], ['.', 'en'], [null, 'en'], [undefined, 'en'], [NaN, 'en'], [Infinity, 'en']]) assert.ok(Number.isNaN(n(t, l)), JSON.stringify(t) + ' ' + l);
    assert.ok(Number.isNaN(n('1,234', 'en', { group: false })));
    assert.equal(n('1234', 'en', { group: false }), 1234);
    assert.equal(n('x', 'not-a-locale-!!'), NaN);
    assert.equal(n('1.5', 'zz-nonexistent'), 1.5);   // an unknown language falls back to English
});

// ---------------------------------------------------------------- parseDate
test('parseDate follows the language order, two-digit years, CJK and other digits', () => {
    const d = FormValidator.parseDate;
    assert.equal(d('22.11.2033', 'de'), '2033-11-22');
    assert.equal(d('11/22/2033', 'en-US'), '2033-11-22');
    assert.equal(d('22/11/2033', 'en-GB'), '2033-11-22');
    assert.equal(d('22/11/33', 'en-GB'), '2033-11-22');
    assert.equal(d('22/11/99', 'en-GB'), '1999-11-22');
    assert.equal(d('22/11/99', 'en-GB', { pivot: 99 }), '2099-11-22');
    assert.equal(d('2033/11/22', 'ja-JP'), '2033-11-22');
    assert.equal(d('2033年11月22日', 'ja-JP'), '2033-11-22');
    assert.equal(d('22-11-2033', 'nl'), '2033-11-22');
    assert.equal(d('29.02.2024', 'de'), '2024-02-29');
    assert.equal(d('٢٢/١١/٢٠٣٣', 'ar-EG'), '2033-11-22');
    assert.equal(d(' 1.2.2033 ', 'de'), '2033-02-01');
});
test('parseDate rejects impossible dates, wrong shapes and wrong types', () => {
    const d = FormValidator.parseDate;
    for (const [t, l] of [['31.02.2033', 'de'], ['29.02.2023', 'de'], ['00.01.2033', 'de'], ['01.13.2033', 'de'], ['32.01.2033', 'de'], ['1.2', 'de'], ['1.2.3.4', 'de'], ['22.11.203', 'de'], ['abc', 'de'], ['', 'de'], ['22.11.2033 10:00', 'de'], [null, 'de'], [undefined, 'de']]) assert.equal(d(t, l), null, JSON.stringify(t));
    assert.equal(d('22/11/33', 'en-GB', { twoDigitYear: false }), null);
    assert.equal(d('11/22/2033', 'en-GB'), null, 'month 22 does not exist');
});

// ---------------------------------------------------------------- rules
test('localeNumber and localeDate rules: messages, min / max, decimals, integer, translated texts', async () => {
    const check = (v, rule, locale) => FormValidator.checkValue(v, rule, locale ? { lang: locale } : undefined);
    assert.equal(check('1.234,56', { localeNumber: { locale: 'de', min: 0, max: 5000, decimals: 2 } }).valid, true);
    assert.equal(check('1.234,567', { localeNumber: { locale: 'de', decimals: 2 } }).valid, false);
    assert.equal(check('1,5', { localeNumber: { locale: 'de', integer: true } }).valid, false);
    const lo = check('-1', { localeNumber: { locale: 'en', min: 0 } });
    assert.equal(lo.valid, false);
    assert.match(lo.message, /0/);
    assert.equal(check('1.5', { localeNumber: { locale: 'de' } }).valid, false);
    assert.equal(check('5.000', { localeNumber: { locale: 'de' } }).valid, true);
    assert.equal(check('x', { localeNumber: { locale: 'en' } }).valid, false);
    assert.equal(check('22.11.2033', { localeDate: { locale: 'de', min: '2000-01-01', max: '2040-01-01' } }).valid, true);
    assert.equal(check('22.11.1999', { localeDate: { locale: 'de', min: '2000-01-01' } }).valid, false);
    assert.equal(check('22.11.2041', { localeDate: { locale: 'de', max: '2040-01-01' } }).valid, false);
    assert.equal(check('31.02.2033', { localeDate: { locale: 'de' } }).valid, false);
});

// ---------------------------------------------------------------- otp
test('otp: creates the boxes, a hidden-looking holder with the whole code, labels and autofill hints', () => {
    const form = mount('<div id="c"></div>');
    const o = FormValidator.otp('#c', { length: 6, name: 'code' });
    assert.equal(o.inputs.length, 6);
    assert.equal(o.inputs[0].getAttribute('autocomplete'), 'one-time-code');
    assert.equal(o.inputs[1].getAttribute('autocomplete'), 'off');
    assert.equal(o.inputs[0].getAttribute('inputmode'), 'numeric');
    assert.equal(o.inputs[2].getAttribute('aria-label'), 'Digit 3 of 6');
    assert.equal(document.getElementById('c').getAttribute('role'), 'group');
    assert.equal(o.hidden.name, 'code');
    assert.equal(o.inputs.every(i => !i.name), true);
    assert.equal(new w.FormData(form).get('code'), '');
    o.destroy();
    assert.equal(document.getElementById('c').children.length, 0);
});
test('otp: typing moves forward, Backspace moves back, arrows move, non-digits are dropped, onComplete fires once', () => {
    mount('<div id="c"></div>');
    const done = [];
    const o = FormValidator.otp('#c', { length: 4, name: 'code', onComplete: c => done.push(c) });
    const [a, b, c, d] = o.inputs;
    a.focus(); type(a, '1');
    assert.equal(document.activeElement, b);
    type(b, 'x');                                   // not a digit
    assert.equal(b.value, '');
    type(b, '2'); type(c, '3');
    assert.equal(o.getValue(), '123');
    assert.equal(done.length, 0);
    type(d, '4');
    assert.deepEqual(done, ['1234']);
    assert.equal(o.hidden.value, '1234');
    key(d, 'Backspace');                            // the box has a character: the browser deletes it, no jump
    d.value = '';
    key(d, 'Backspace');                            // empty: go back and clear the previous box
    assert.equal(document.activeElement, c);
    assert.equal(c.value, '');
    key(c, 'ArrowLeft'); assert.equal(document.activeElement, b);
    key(b, 'ArrowRight'); assert.equal(document.activeElement, c);
    key(c, 'Home'); assert.equal(document.activeElement, a);
    key(a, 'End'); assert.equal(document.activeElement, d);
    type(c, '3'); type(d, '4');
    assert.deepEqual(done, ['1234', '1234'], 'completing it again reports again');
    o.destroy();
});
test('otp: paste and an SMS autofill that fills one box are spread over the boxes; extra characters are cut', () => {
    mount('<div id="c"></div>');
    const done = [];
    const o = FormValidator.otp('#c', { length: 6, name: 'code', onComplete: c => done.push(c) });
    const e = paste(o.inputs[3], ' 12-34 56 99 ');
    assert.equal(e.defaultPrevented, true);
    assert.equal(o.getValue(), '123456');
    assert.deepEqual(done, ['123456']);
    o.clear();
    assert.equal(o.getValue(), '');
    type(o.inputs[0], '987654');                     // autofill puts the code into the first box
    assert.equal(o.getValue(), '987654');
    o.setValue('55');
    assert.equal(o.getValue(), '55');
    assert.equal(o.hidden.value, '55');
    assert.equal(paste(o.inputs[0], '').defaultPrevented, false);
    o.destroy();
});
test('otp: existing inputs are reused, alphanumeric codes are allowed, length is bounded', () => {
    mount('<div id="c"><input><input><input></div>');
    const o = FormValidator.otp('#c', { length: 3, numeric: false });
    assert.equal(o.inputs.length, 3);
    assert.equal(o.hidden, null);
    assert.equal(o.inputs[0].getAttribute('inputmode'), 'text');
    type(o.inputs[0], 'aB3');
    assert.equal(o.getValue(), 'aB3');
    type(o.inputs[0], '!!');
    o.destroy();
    mount('<div id="c"></div>');
    assert.equal(FormValidator.otp('#c', { length: 99 }).inputs.length, 12);
    assert.equal(FormValidator.otp(document.getElementById('c'), { length: 0 }).inputs.length, 1);
    assert.throws(() => FormValidator.otp('#nope'), /container not found/);
});
test('otp: the form validates the whole code through the hidden-looking holder, and posts one field', async () => {
    const form = mount('<div id="c"></div>');
    const o = FormValidator.otp('#c', { length: 4, name: 'code' });
    const inst = FormValidator.init({ form, rules: { code: { required: true, digits: true, minlength: 4 } }, config: { debounce: 0 } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.ok(form.querySelector('.error[data-error-for="code"]'));
    o.setValue('1234');
    assert.equal(await inst.validate({ focus: false }), true);
    assert.equal(new w.FormData(form).get('code'), '1234');
    assert.equal(Array.from(new w.FormData(form).keys()).filter(k => k === 'code').length, 1);
    o.destroy();
});
test('otp: WebOTP fills the code and never throws; destroy aborts the request; missing API is ignored', async () => {
    mount('<div id="c"></div>');
    let signal = null;
    Object.defineProperty(w.navigator, 'credentials', { configurable: true, value: { get: async opt => { signal = opt.signal; assert.deepEqual(opt.otp.transport, ['sms']); return { code: '246810' }; } } });
    const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: w.navigator });
    const done = [];
    const o = FormValidator.otp('#c', { length: 6, name: 'code', webotp: true, onComplete: c => done.push(c) });
    await settle();
    assert.equal(o.getValue(), '246810');
    assert.deepEqual(done, ['246810']);
    o.destroy();
    assert.equal(signal.aborted, true);
    Object.defineProperty(w.navigator, 'credentials', { configurable: true, value: { get: async () => { throw new Error('denied'); } } });
    mount('<div id="c"></div>');
    const o2 = FormValidator.otp('#c', { length: 4, webotp: true });
    await settle();
    assert.equal(o2.getValue(), '');
    o2.destroy();
    Object.defineProperty(w.navigator, 'credentials', { configurable: true, value: undefined });
    mount('<div id="c"></div>');
    FormValidator.otp('#c', { webotp: true }).destroy();
    if (realNav) Object.defineProperty(globalThis, 'navigator', realNav); else delete globalThis.navigator;
});
