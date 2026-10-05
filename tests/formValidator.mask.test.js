'use strict';
// mask() (format while typing), the mask rule, and declarative forms (data-fv, data-fv-mask, FormValidator.auto()).
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, MutationObserver: w.MutationObserver, FormData: w.FormData, Element: w.Element, Event: w.Event });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');
require('../src/locales/de.js');
const locales = require('../src/locale.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const PHONE = '(999) 999-9999';
function field(html) {
    document.body.innerHTML = `<form>${html || '<input id="t" name="t" type="text">'}</form>`;
    const el = document.getElementById('t') || document.querySelector('input');
    el.focus();
    return el;
}
/** what the browser does: insert text at the caret, move the caret, fire input */
const type = (el, text, inputType = 'insertText') => {
    const s = el.selectionStart, e = el.selectionEnd;
    el.value = el.value.slice(0, s) + text + el.value.slice(e);
    el.setSelectionRange(s + text.length, s + text.length);
    el.dispatchEvent(new w.InputEvent('input', { bubbles: true, inputType, data: text }));
};
const typeAll = (el, text) => Array.from(text).forEach(ch => type(el, ch));
const backspace = el => {
    let s = el.selectionStart, e = el.selectionEnd;
    if (s === e && s > 0) s--;
    el.value = el.value.slice(0, s) + el.value.slice(e);
    el.setSelectionRange(s, s);
    el.dispatchEvent(new w.InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
};

// ---------------------------------------------------------------- mask()
test('typing digits formats the phone number, ignores other characters, and reports completion once', () => {
    const el = field();
    const done = [];
    const m = FormValidator.mask(el, PHONE, { onComplete: (v, raw) => done.push([v, raw]) });
    typeAll(el, '5');
    assert.equal(el.value, '(5');
    typeAll(el, '55');
    assert.equal(el.value, '(555');
    typeAll(el, '1');
    assert.equal(el.value, '(555) 1');
    typeAll(el, 'x-y');
    assert.equal(el.value, '(555) 1', 'letters are not part of this mask');
    typeAll(el, '234567');
    assert.equal(el.value, '(555) 123-4567');
    assert.equal(m.complete, true);
    assert.equal(m.raw, '5551234567');
    assert.equal(m.value, '(555) 123-4567');
    typeAll(el, '9');
    assert.equal(el.value, '(555) 123-4567', 'nothing beyond the mask');
    assert.deepEqual(done, [['(555) 123-4567', '5551234567']]);
});
test('paste: unformatted, formatted, with extra characters, over a selection', () => {
    const el = field();
    FormValidator.mask(el, PHONE);
    type(el, '5551234567', 'insertFromPaste');
    assert.equal(el.value, '(555) 123-4567');
    el.setSelectionRange(0, el.value.length);
    type(el, '(800) 555-0199 ext 5', 'insertFromPaste');
    assert.equal(el.value, '(800) 555-0199');
    el.setSelectionRange(0, el.value.length);
    type(el, '+1 800.555.0100', 'insertFromPaste');
    assert.equal(el.value, '(180) 055-5010', 'extra digits are digits: a mask cannot know a country code was pasted');
    el.setSelectionRange(0, el.value.length);
    type(el, 'abc', 'insertFromPaste');
    assert.equal(el.value, '');
});
test('backspace removes typed characters, also over a literal; the caret stays where the user is', () => {
    const el = field();
    FormValidator.mask(el, PHONE);
    typeAll(el, '5551234');
    assert.equal(el.value, '(555) 123-4');
    backspace(el);
    assert.equal(el.value, '(555) 123');
    backspace(el); backspace(el); backspace(el);
    assert.equal(el.value, '(555', 'the literals that are only waiting for more digits go away');
    backspace(el);
    assert.equal(el.value, '(55');
    el.value = '(555) 123'; el.setSelectionRange(6, 6);   // right after ") "
    el.dispatchEvent(new w.InputEvent('input', { bubbles: true }));
    backspace(el);
    assert.equal(el.value, '(551) 23', 'backspace over the literal takes the digit before it');
    assert.equal(el.selectionStart, 3, 'the caret is after the second 5');
});
test('typing in the middle keeps the caret after the typed character', () => {
    const el = field();
    FormValidator.mask(el, PHONE);
    type(el, '5551234567', 'insertFromPaste');
    el.setSelectionRange(2, 2);
    type(el, '9');
    assert.equal(el.value, '(595) 512-3456', 'the last digit is pushed out');
    assert.equal(el.selectionStart, 3);
    typeAll(el, '8');
    assert.equal(el.value, '(598) 551-2345');
    assert.equal(el.selectionStart, 4);
});
test('letters, alphanumerics, unicode letters, escapes and regex characters in the pattern', () => {
    let el = field();
    FormValidator.mask(el, 'aa-99');
    typeAll(el, 'ab12');
    assert.equal(el.value, 'ab-12');
    typeAll(el, 'é');
    assert.equal(el.value, 'ab-12');
    el = field();
    FormValidator.mask(el, 'aaa');
    typeAll(el, 'éüñ');
    assert.equal(el.value, 'éüñ', 'a letter is any letter of any alphabet');
    el = field();
    FormValidator.mask(el, '***-***');
    typeAll(el, 'a1b2c3');
    assert.equal(el.value, 'a1b-2c3');
    el = field();
    FormValidator.mask(el, '\\9 99 \\a');
    typeAll(el, '12');
    assert.equal(el.value, '9 12', 'an escaped character is a literal');
    el = field();
    FormValidator.mask(el, '$[99].*');
    typeAll(el, '42');
    assert.equal(el.value, '$[42');
    assert.equal(FormValidator.maskPattern('$[99].*').test('$[42].x'), true, 'regex characters in the pattern are literals');
    assert.equal(FormValidator.maskPattern('$[99].*').test('$[42]xx'), false);
    assert.equal(FormValidator.maskPattern('$[99].*').test('$[42]x'), false);
});
test('trailing literals, a value that is already there, update(), destroy(), IME composition', () => {
    let el = field();
    const m = FormValidator.mask(el, PHONE, { trailing: true });
    typeAll(el, '555');
    assert.equal(el.value, '(555) ');
    m.update('99-99');
    assert.equal(el.value, '55-5', 'update() formats what is there with the new pattern');
    m.destroy();
    typeAll(el, 'zzz');
    assert.equal(el.value, '55-5zzz', 'after destroy() the input is left alone');
    el = field('<input id="t" name="t" value="5551234567">');
    FormValidator.mask(el, PHONE);
    assert.equal(el.value, '(555) 123-4567', 'an existing value is formatted at once');
    el = field();
    FormValidator.mask(el, 'aaa');
    el.dispatchEvent(new w.CompositionEvent('compositionstart', { bubbles: true }));
    el.value = 'kyo'; el.dispatchEvent(new w.InputEvent('input', { bubbles: true, isComposing: true }));
    el.value = 'kyoto-city'; el.dispatchEvent(new w.InputEvent('input', { bubbles: true, isComposing: true }));
    assert.equal(el.value, 'kyoto-city', 'nothing is touched while an IME is composing');
    el.dispatchEvent(new w.CompositionEvent('compositionend', { bubbles: true }));
    assert.equal(el.value, 'kyo', 'it formats when the composition ends');
    assert.throws(() => FormValidator.mask(null, '99'), /text input/);
});
test('a huge paste and an empty pattern are handled', () => {
    const el = field();
    FormValidator.mask(el, PHONE);
    const t0 = Date.now();
    type(el, '1234567890'.repeat(100000), 'insertFromPaste');
    assert.equal(el.value, '(123) 456-7890');
    assert.ok(Date.now() - t0 < 2000);
    const el2 = field();
    FormValidator.mask(el2, '');
    typeAll(el2, 'abc');
    assert.equal(el2.value, '');
});

// ---------------------------------------------------------------- rule, unmask, pattern
test('mask rule: complete values pass, empty is left to required, the message and the shorthand', () => {
    assert.equal(FormValidator.checkValue('(555) 123-4567', { mask: PHONE }).valid, true);
    assert.equal(FormValidator.checkValue('(555) 123', { mask: PHONE }).valid, false);
    assert.equal(FormValidator.checkValue('(555) 123', { mask: PHONE }).message, 'Please complete this field.');
    assert.equal(FormValidator.checkValue('', { mask: PHONE }).valid, true);
    assert.equal(FormValidator.checkValue('', ['required', { mask: PHONE }]).rule, 'required');
    assert.equal(FormValidator.checkValue('12-ab', { type: 'mask', pattern: '99-aa' }).valid, true);
    locales.use('de');
    assert.equal(FormValidator.checkValue('1', { mask: '99' }).message, 'Bitte vervollständigen Sie dieses Feld.');
    locales.use('en');
    assert.equal(FormValidator.unmaskValue('(555) 123-4567', PHONE), '5551234567');
    assert.equal(FormValidator.unmaskValue('5551234567', PHONE), '5551234567');
    assert.equal(FormValidator.unmaskValue('', PHONE), '');
    assert.equal(FormValidator.unmaskValue('+1 (555)', '\\+1 (999)'), '555', 'a digit that is a literal of the pattern is not a typed digit');
});

// ---------------------------------------------------------------- declarative
let n = 0;
function page(html) { document.body.innerHTML = html; return document.body; }
const err = (form, name) => { const e = form.querySelector(`.error[data-error-for="${name}"]`); return e ? e.textContent : null; };

test('parseRules: names, parameters with colons, JSON, bad input', () => {
    assert.deepEqual(FormValidator.parseRules('required email'), { required: true, email: true });
    assert.deepEqual(FormValidator.parseRules('minlength:3 range:1,10 pattern:^a:b$'), { minlength: '3', range: '1,10', pattern: '^a:b$' });
    assert.deepEqual(FormValidator.parseRules('["required",{"type":"email"}]'), ['required', { type: 'email' }]);
    assert.equal(FormValidator.parseRules('{broken'), null);
    assert.equal(FormValidator.parseRules(''), null);
    assert.equal(FormValidator.parseRules(null), null);
    assert.deepEqual(FormValidator.parseRules('__proto__:x constructor required'), { required: true });
    assert.equal({}.x, undefined);
});
test('auto(): data-fv on fields starts a validator, with messages, masks and a JSON config; forms without it are left alone', async () => {
    const root = page('<form id="a"><input name="email" data-fv="required email" data-msg-required="Tell us your email"><input name="zip" data-fv="required digits minlength:5" data-fv-mask="99999">' +
        '<input name="free"><button>Go</button></form><form id="b"><input name="x"></form>');
    const stop = FormValidator.auto();
    await settle(10);
    const a = document.getElementById('a'), b = document.getElementById('b');
    assert.ok(a._fvInstance);
    assert.equal(b._fvInstance, undefined);
    assert.equal(await a._fvInstance.validate({ focus: false }), false);
    assert.equal(err(a, 'email'), 'Tell us your email');
    assert.ok(err(a, 'zip'));
    assert.equal(err(a, 'free'), null);
    const zip = a.elements.zip;
    zip.focus(); typeAll(zip, '12ab3456');
    assert.equal(zip.value, '12345', 'data-fv-mask formats the field');
    a.elements.email.value = 'a@b.co';
    assert.equal(await a._fvInstance.validate({ focus: false }), true);
    stop();
});
test('auto(): data-fv-config, a form with data-fv and no field attributes, bad JSON, forms added later, stop', async () => {
    page('<form id="c" data-fv data-fv-config=\'{"errorElement":"em","errorSummary":true}\'><input name="a" data-fv="required"></form>' +
        '<form id="d" data-fv data-fv-config="{oops"><input name="a" data-fv="required"></form><form id="e" data-fv><input name="a"></form><div id="slot"></div>');
    const ow = console.warn; const warns = []; console.warn = m => warns.push(String(m));
    let stop;
    try { stop = FormValidator.auto({ validClass: 'ok' }); await settle(10); } finally { console.warn = ow; }
    const c = document.getElementById('c'), d = document.getElementById('d'), e = document.getElementById('e');
    assert.equal(c._fvInstance.config.errorElement, 'em');
    assert.equal(c._fvInstance.config.validClass, 'ok', 'the config you pass is the base');
    await c._fvInstance.validate({ focus: false, submit: true });
    assert.ok(c.querySelector('em.error'));
    assert.ok(c.querySelector('.fv-summary'));
    assert.ok(d._fvInstance);
    assert.ok(warns.some(m => /data-fv-config/.test(m)));
    assert.ok(e._fvInstance, 'a form that only says data-fv is started (no rules yet)');
    document.getElementById('slot').innerHTML = '<form id="late"><input name="z" data-fv="required"></form>';
    await settle(80);
    assert.ok(document.getElementById('late')._fvInstance, 'forms added later are picked up');
    stop();
    document.getElementById('slot').innerHTML = '<form id="later"><input name="z" data-fv="required"></form>';
    await settle(80);
    assert.equal(document.getElementById('later')._fvInstance, undefined, 'stopped');
});
test('data-fv-auto on the script tag starts everything by itself', async () => {
    const code = fs.readFileSync(path.join(__dirname, '../dist/validator.js'), 'utf8');
    const html = '<!doctype html><body><form id="f"><input name="a" data-fv="required"><button>Go</button></form><script data-fv-auto>' + code.replace(/<\/script>/g, '<\\/script>') + '</script></body>';
    const win = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' }).window;
    await settle(20);
    assert.ok(win.document.getElementById('f')._fvInstance, 'the form was started');
    const plain = new JSDOM('<!doctype html><body><form id="f"><input name="a" data-fv="required"></form><script>' + code.replace(/<\/script>/g, '<\\/script>') + '</script></body>', { runScripts: 'dangerously', url: 'http://localhost/' }).window;
    await settle(20);
    assert.equal(plain.document.getElementById('f')._fvInstance, undefined, 'without data-fv-auto nothing starts');
});
test('<fv-field rules="..."> still parses its rules (the element uses the shared parser)', () => {
    require('../src/formValidator.element.js');
    assert.deepEqual(FormValidator.fieldElement.parseRules('required minlength:3'), { required: true, minlength: '3' });
    assert.deepEqual(FormValidator.fieldElement.parseRules('[{"type":"email"}]'), [{ type: 'email' }]);
});
