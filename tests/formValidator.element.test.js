'use strict';
// <fv-field>: FormValidator rules as native constraint validation, in plain HTML.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, HTMLElement: w.HTMLElement, customElements: w.customElements, CustomEvent: w.CustomEvent, MutationObserver: w.MutationObserver, FormData: w.FormData, Element: w.Element, CSS: w.CSS });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');
require('../src/formValidator.element.js');
require('../src/locales/de.js');
const locales = require('../src/locale.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
let n = 0;
function mount(html) {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}">${html}<button type="submit" id="go">Go</button></form>`;
    return document.getElementById(id);
}
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));
const typeIn = (el, v) => { el.value = v; fire(el, 'input'); };
const leave = el => { fire(el, 'change'); fire(el, 'focusout'); };
const msg = field => { const e = field.querySelector('.fv-error'); return e ? e.textContent : null; };

test('it registers <fv-field> and FormValidator.fieldElement, and does nothing without rules', () => {
    assert.ok(customElements.get('fv-field'));
    assert.equal(typeof FormValidator.fieldElement.define, 'function');
    const form = mount('<fv-field><input name="a"></fv-field>');
    assert.equal(form.elements.a.validity.valid, true);
    assert.equal(form.querySelector('fv-field').getAttribute('data-state'), 'valid');
});

test('the rules reach the native control: validity, checkValidity, the message after leaving it, live fix', async () => {
    const form = mount('<fv-field rules="required email"><label for="e">Email</label><input id="e" name="email"></fv-field>');
    const field = form.querySelector('fv-field'), input = form.elements.email;
    assert.equal(input.validity.customError, true, 'invalid from the start, silently');
    assert.equal(input.validationMessage, 'This field is required.');
    assert.equal(input.validity.valid, false);
    assert.equal(msg(field), null, 'punish late: nothing shown yet');
    typeIn(input, 'a@'); await settle(5);
    assert.equal(msg(field), null, 'still nothing while typing');
    assert.equal(input.validationMessage, 'Please enter a valid email address.');
    leave(input);
    assert.equal(msg(field), 'Please enter a valid email address.');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.ok(input.getAttribute('aria-describedby').includes(field.querySelector('.fv-error').id));
    assert.equal(field.querySelector('.fv-error').getAttribute('role'), 'alert');
    assert.equal(field.querySelector('.fv-error').getAttribute('data-code'), 'email');
    assert.equal(field.getAttribute('data-state'), 'invalid');
    assert.ok(field.hasAttribute('data-shown'));
    typeIn(input, 'a@b.co');
    assert.equal(msg(field), null, 'reward early: the message goes as soon as the value is right');
    assert.equal(input.getAttribute('aria-invalid'), null);
    assert.equal(input.getAttribute('aria-describedby'), null);
    assert.equal(form.checkValidity(), true);
    assert.equal(field.getAttribute('data-state'), 'valid');
    typeIn(input, 'a@b'); await settle(5);
    assert.equal(msg(field), null, 'a field that was fine is not nagged while typing again');
});

test('a field the user only tabbed through is not scolded; a submit attempt shows every message and keeps the browser from submitting', async () => {
    const form = mount('<fv-field rules="required"><input name="a"></fv-field><fv-field rules="required minlength:3"><input name="b" value="x"></fv-field>');
    const [fa, fb] = form.querySelectorAll('fv-field');
    leave(form.elements.a);
    assert.equal(msg(fa), null);
    // what the browser does on submit: fire "invalid" at every invalid control
    assert.equal(form.checkValidity(), false);
    form.elements.a.dispatchEvent(new w.Event('invalid', { cancelable: true }));
    form.elements.b.dispatchEvent(new w.Event('invalid', { cancelable: true }));
    assert.equal(msg(fa), 'This field is required.');
    assert.equal(msg(fb), 'Please enter at least 3 characters.');
});

test('the invalid event is cancelled (our message replaces the bubble) unless native-bubble is set', () => {
    const form = mount('<fv-field rules="required"><input name="a"></fv-field><fv-field rules="required" native-bubble><input name="b"></fv-field>');
    const e1 = new w.Event('invalid', { cancelable: true }), e2 = new w.Event('invalid', { cancelable: true });
    form.elements.a.dispatchEvent(e1); form.elements.b.dispatchEvent(e2);
    assert.equal(e1.defaultPrevented, true);
    assert.equal(e2.defaultPrevented, false);
    assert.equal(msg(form.querySelectorAll('fv-field')[1]), null, 'the native bubble is the message');
});

test('rules syntax: names with parameters, JSON list, JSON map, bad JSON, properties', async () => {
    const ow = console.warn; const warns = []; console.warn = m => warns.push(String(m));
    const form = mount('<fv-field id="a" rules="required minlength:3 pattern:^[a-z]+:[0-9]$"><input name="a" value="ab"></fv-field>' +
        '<fv-field id="b" rules=\'[{"type":"min","min":5,"message":"At least five"}]\'><input name="b" value="2"></fv-field>' +
        '<fv-field id="c" rules=\'{"range":[1,10]}\'><input name="c" value="11"></fv-field>' +
        '<fv-field id="d" rules="{broken"><input name="d" value="x"></fv-field><fv-field id="e"><input name="e" value=""></fv-field>');
    try {
        const get = id => form.querySelector('#' + id);
        assert.equal(form.elements.a.validationMessage, 'Please enter at least 3 characters.');
        typeIn(form.elements.a, 'abc'); assert.equal(form.elements.a.validationMessage, 'Invalid format.');
        typeIn(form.elements.a, 'abc:5'); assert.equal(form.elements.a.validity.valid, true, 'a colon inside the pattern is kept');
        assert.equal(form.elements.b.validationMessage, 'At least five');
        assert.equal(form.elements.c.validity.valid, false);
        assert.equal(form.elements.d.validity.valid, true, 'unreadable rules: ignored with a warning');
        assert.ok(warns.some(m => /not valid JSON/.test(m)));
        get('e').rules = { required: true };
        assert.equal(form.elements.e.validity.valid, false, 'the rules property works');
        get('e').rules = null;
        assert.equal(form.elements.e.validity.valid, true);
        get('e').setAttribute('rules', 'required');
        assert.equal(form.elements.e.validity.valid, false, 'attribute changes are picked up');
        get('e').messages = { required: 'Fill me' };
        assert.equal(form.elements.e.validationMessage, 'Fill me');
        get('e').removeAttribute('rules'); get('e').messages = null;
        get('e').setAttribute('messages', '{"required":"From attribute"}'); get('e').setAttribute('rules', 'required');
        assert.equal(form.elements.e.validationMessage, 'From attribute');
    } finally { console.warn = ow; }
});

test('cross-field: equalTo reads the other control and follows it', async () => {
    const form = mount('<input name="password" type="password" value="Secret123"><fv-field rules="equalTo:password"><input name="confirm" type="password" value="x"></fv-field>');
    const field = form.querySelector('fv-field');
    assert.equal(form.elements.confirm.validity.valid, false);
    typeIn(form.elements.confirm, 'Secret123'); leave(form.elements.confirm);
    assert.equal(form.elements.confirm.validity.valid, true);
    typeIn(form.elements.password, 'Other4567');
    assert.equal(form.elements.confirm.validity.valid, false, 'changing the password re-checks the confirmation');
    assert.equal(msg(field), 'Values do not match.', 'and shows it, because the field had been visited');
    typeIn(form.elements.password, 'Secret123');
    assert.equal(msg(field), null);
});

test('radio group, checkbox group, select, textarea', async () => {
    const form = mount('<fv-field id="r" rules="required"><label><input type="radio" name="plan" value="a"> A</label><label><input type="radio" name="plan" value="b"> B</label></fv-field>' +
        '<fv-field id="c" rules="required"><input type="checkbox" name="terms" value="yes"></fv-field>' +
        '<fv-field id="s" rules="required"><select name="color"><option value="">-</option><option value="r">Red</option></select></fv-field>' +
        '<fv-field id="t" rules="required minlength:5"><textarea name="note"></textarea></fv-field>');
    assert.equal(form.checkValidity(), false);
    [form.querySelector('#r').control, form.querySelector('#c').control, form.querySelector('#s').control, form.querySelector('#t').control].forEach(c => assert.equal(c.validity.customError, true));
    assert.equal(form.querySelectorAll('input[name=plan]')[1].validity.customError, false, 'the message sits on the first radio only');
    form.elements.plan[1].checked = true; fire(form.elements.plan[1], 'change');
    assert.equal(form.querySelector('#r').control.validity.valid, true);
    form.elements.terms.checked = true; fire(form.elements.terms, 'change');
    assert.equal(form.elements.terms.validity.valid, true);
    form.elements.color.value = 'r'; fire(form.elements.color, 'change');
    assert.equal(form.elements.color.validity.valid, true);
    typeIn(form.elements.note, 'abcd'); assert.equal(form.elements.note.validity.valid, false);
    typeIn(form.elements.note, 'abcde'); assert.equal(form.elements.note.validity.valid, true);
    assert.equal(form.checkValidity(), true);
    assert.equal(form.querySelector('#r').value, 'b');
});

test('reportValidity focuses and shows; validate() and reset(); fv-validate event; language packs', async () => {
    const form = mount('<fv-field rules="required"><input name="a"></fv-field>');
    const field = form.querySelector('fv-field');
    const events = [];
    field.addEventListener('fv-validate', e => events.push(e.detail));
    assert.equal(field.reportValidity(), false);
    assert.equal(msg(field), 'This field is required.');
    assert.equal(document.activeElement, form.elements.a);
    assert.deepEqual(events[events.length - 1], { valid: false, rule: 'required', code: 'required', message: 'This field is required.', shown: true });
    assert.equal(field.validate(), false);
    typeIn(form.elements.a, 'x');
    assert.equal(field.validate(), true);
    assert.equal(events[events.length - 1].valid, true);
    typeIn(form.elements.a, '');
    field.reset();
    assert.equal(msg(field), null);
    assert.equal(field.hasAttribute('data-shown'), false);
    assert.equal(form.elements.a.validity.customError, true, 'still invalid, just not shown');
    locales.use('de');
    field.validate();
    assert.equal(msg(field), 'Dieses Feld ist erforderlich.');
    locales.use('en');
});

test('a form reset clears what was shown', async () => {
    const form = mount('<fv-field rules="required"><input name="a" value="x"></fv-field>');
    const field = form.querySelector('fv-field');
    typeIn(form.elements.a, ''); leave(form.elements.a);
    assert.ok(msg(field));
    form.reset(); await settle(20);
    assert.equal(msg(field), null);
});

test('setServerError shows a server message until the value changes', async () => {
    const form = mount('<fv-field rules="required"><input name="a" value="taken"></fv-field>');
    const field = form.querySelector('fv-field');
    field.setServerError('Already registered');
    assert.equal(msg(field), 'Already registered');
    assert.equal(form.elements.a.validationMessage, 'Already registered');
    assert.equal(field.querySelector('.fv-error').getAttribute('data-code'), 'server');
    typeIn(form.elements.a, 'free');
    assert.equal(msg(field), null);
    assert.equal(form.elements.a.validity.valid, true);
});

test('server attribute: asks the endpoint (Precognition) after the user leaves a valid field, shows its message, ignores failures', async () => {
    const calls = [];
    let answer = { status: 422, body: { errors: { email: ['Already registered'] } } };
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => { calls.push({ url, init }); if (answer === 'down') throw new TypeError('offline'); return { status: answer.status, json: async () => answer.body }; };
    try {
        const form = mount('<input name="team" value="blue"><fv-field rules="required email" server="/signup" server-delay="5"><input name="email"></fv-field>');
        const field = form.querySelector('fv-field');
        typeIn(form.elements.email, 'a@b.co'); await settle(40);
        assert.equal(calls.length, 0, 'not before the user has been in the field and left it');
        leave(form.elements.email); await settle(60);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, '/signup');
        assert.equal(calls[0].init.headers['Precognition-Validate-Only'], 'email');
        assert.equal(calls[0].init.body, 'team=blue&email=a%40b.co');
        assert.equal(msg(field), 'Already registered');
        assert.equal(form.elements.email.validity.valid, false, 'the browser knows too: submit is blocked');
        answer = { status: 204, body: {} };
        typeIn(form.elements.email, 'free@b.co'); leave(form.elements.email); await settle(60);
        assert.equal(msg(field), null);
        assert.equal(form.elements.email.validity.valid, true);
        answer = 'down';
        typeIn(form.elements.email, 'x@b.co'); leave(form.elements.email); await settle(60);
        assert.equal(form.elements.email.validity.valid, true, 'a check that could not be made changes nothing');
        typeIn(form.elements.email, 'bad'); leave(form.elements.email); await settle(30);
        const before = calls.length;
        await settle(30);
        assert.equal(calls.length, before, 'invalid by the browser rules: the server is not asked');
    } finally { globalThis.fetch = orig; }
});

test('rules that need a form, files or a server are ignored with one warning; custom states exist when the browser has them', () => {
    const ow = console.warn; const warns = [];
    console.warn = m => warns.push(String(m));
    try {
        const form = mount('<fv-field rules="required remote:/x"><input name="a" value="x"></fv-field><fv-field rules="remote:/y"><input name="b" value="x"></fv-field>');
        assert.equal(form.elements.a.validity.valid, true);
        assert.ok(warns.length >= 1 && /server/.test(warns[0]));
    } finally { console.warn = ow; }
});

test('controls added later or replaced are picked up; removing the element cleans up its message', async () => {
    const form = mount('<fv-field rules="required"></fv-field>');
    const field = form.querySelector('fv-field');
    assert.equal(field.control, null);
    field.innerHTML = '<input name="late">';
    await settle(20);
    assert.equal(form.elements.late.validity.customError, true);
    leave(form.elements.late);
    field.remove();
    assert.equal(document.querySelector('.fv-error'), null);
});

test('FormValidator.fieldElement.define registers another tag name; the control attribute picks a specific control', () => {
    FormValidator.fieldElement.define('x-field');
    assert.ok(customElements.get('x-field'));
    const form = mount('<x-field rules="required" control="#pick"><input name="skip" value="v"><input id="pick" name="pick"></x-field>');
    assert.equal(form.elements.pick.validity.valid, false);
    assert.equal(form.elements.skip.validity.valid, true);
    assert.equal(FormValidator.fieldElement.define('x-field'), customElements.get('x-field'), 'idempotent');
});

test('hostile rule names in the attribute do not pollute prototypes', () => {
    assert.deepEqual(FormValidator.fieldElement.parseRules('__proto__:x constructor:y required'), { required: true });
    assert.equal({}.x, undefined);
});
