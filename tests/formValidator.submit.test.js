'use strict';
/*
 * Submitting: direct and AJAX, with the validated values. isValid() is jQuery's valid() without jQuery; getValues(), validateAndGetValues(),
 * handleSubmit(fn), setErrors(map) and config.onSubmit are the tools for AJAX; the default (no onSubmit / submitHandler) is the normal browser submit.
 */
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });   // jsdom has no layout: everything is rendered
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');

const $ = (sel, root) => (root || document).querySelector(sel);
const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
let n = 0;
function mount(html) {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}">${html}<button type="submit" id="go">Go</button></form>`;
    const form = document.getElementById(id);
    form.native = 0;
    form.requestSubmit = function (sub) {   // jsdom does not navigate: count the submits the library lets through
        const ev = new w.Event('submit', { bubbles: true, cancelable: true });
        if (sub) Object.defineProperty(ev, 'submitter', { value: sub });
        if (this.dispatchEvent(ev)) this.native++;
    };
    form.submit = () => { form.native++; };
    return form;
}
const FIELDS = '<input name="email"><input type="password" name="pw"><input type="checkbox" name="tag" value="a"><input type="checkbox" name="tag" value="b">' +
    '<input type="radio" name="plan" value="free"><input type="radio" name="plan" value="pro"><input type="checkbox" name="terms" value="yes">' +
    '<select name="colors" multiple><option value="red">r</option><option value="blue">b</option></select><input name="off" disabled value="x">';
const fill = (form, v) => {
    form.elements.email.value = v.email;
    form.elements.pw.value = v.pw;
    Array.from(form.elements.tag).forEach(t => { t.checked = v.tags.includes(t.value); });
    Array.from(form.elements.plan).forEach(r => { r.checked = r.value === v.plan; });
    Array.from(form.elements.colors.options).forEach(o => { o.selected = v.colors.includes(o.value); });
};

test('isValid(form): true / false right now, like jQuery valid(), for a direct submit', () => {
    const form = mount(FIELDS);
    FormValidator.init({ form, rules: { email: ['required', 'email'] } });
    assert.equal(FormValidator.isValid(form), false);
    assert.ok($('.error[data-error-for=email]', form), 'the error is shown');
    form.elements.email.value = 'a@b.co';
    assert.equal(FormValidator.isValid(form), true);
    assert.equal(FormValidator.isValid(form, { email: ['required', { type: 'minlength', min: 20 }] }), false, 'ad-hoc rules work too');
    assert.throws(() => FormValidator.isValid(mount(''), undefined), /not initialized/);
});

test('getValues(): what to send, trimmed like the validation saw it; checkbox groups and multiple selects are arrays; passwords are not trimmed', () => {
    const form = mount(FIELDS);
    const inst = FormValidator.init({ form, rules: { email: ['required', 'email'] } });
    fill(form, { email: '  ada@example.com ', pw: ' secret ', tags: ['a', 'b'], plan: 'pro', colors: ['red', 'blue'] });
    assert.deepEqual(inst.getValues(), { email: 'ada@example.com', pw: ' secret ', tag: ['a', 'b'], plan: 'pro', colors: ['red', 'blue'] });   // unchecked terms and disabled off are left out, like a native submit
    fill(form, { email: 'x@y.zz', pw: '', tags: [], plan: 'free', colors: [] });
    assert.deepEqual(inst.getValues(), { email: 'x@y.zz', pw: '', tag: [], plan: 'free', colors: [] });
});

test('validateAndGetValues(): { valid, values, errors }', async () => {
    const form = mount(FIELDS);
    const inst = FormValidator.init({ form, rules: { email: ['required', 'email'] } });
    const bad = await inst.validateAndGetValues();
    assert.equal(bad.valid, false);
    assert.deepEqual(bad.errors.map(e => e.name), ['email']);
    form.elements.email.value = ' a@b.co ';
    const ok = await inst.validateAndGetValues();
    assert.equal(ok.valid, true);
    assert.equal(ok.values.email, 'a@b.co');
});

test('handleSubmit(fn): fn runs only for a valid form and gets the values; the server messages it returns are shown on the fields', async () => {
    const form = mount(FIELDS);
    const inst = FormValidator.init({ form, rules: { email: ['required', 'email'] } });
    const calls = [];
    const onSubmit = inst.handleSubmit(async (values) => { calls.push(values); return values.email === 'taken@example.com' ? { errors: { Email: 'Already registered', nothere: 'x' } } : { id: 7 }; });

    let prevented = false;
    let r = await onSubmit({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(r.valid, false);
    assert.equal(calls.length, 0, 'an invalid form never reaches your function');

    form.elements.email.value = 'taken@example.com';
    r = await onSubmit();
    assert.equal(calls.length, 1);
    assert.equal(r.valid, false, 'the server said no');
    assert.equal($('.error[data-error-for=email]', form).textContent, 'Already registered', 'names are matched ignoring case');

    form.elements.email.value = 'free@example.com';
    r = await onSubmit();
    assert.equal(r.valid, true);
    assert.deepEqual(r.result, { id: 7 });
    assert.equal(calls.length, 2);
});

test('setErrors(map): shows the server messages and says which names matched no field', () => {
    const form = mount(FIELDS);
    const inst = FormValidator.init({ form, rules: {} });
    assert.deepEqual(inst.setErrors({ email: 'Taken', PW: ['Too common', 'second is ignored'], missing: 'x' }), ['missing']);
    assert.equal($('.error[data-error-for=email]', form).textContent, 'Taken');
    assert.equal($('.error[data-error-for=pw]', form).textContent, 'Too common');
});

test('config.onSubmit(values, event, inst): a click on submit = validate, then AJAX with the values; no native submit, no double submit', async () => {
    const form = mount(FIELDS);
    const got = [];
    let release;
    const slow = new Promise(r => { release = r; });
    FormValidator.init({ form, rules: { email: ['required', 'email'] }, config: { onSubmit: async (values) => { got.push(values); await slow; return { errors: { email: 'Server says no' } }; } } });

    $('#go', form).click(); await settle();
    assert.equal(got.length, 0, 'invalid: nothing sent');
    form.elements.email.value = 'a@b.co';
    $('#go', form).click(); await settle();
    $('#go', form).click(); await settle();
    assert.equal(got.length, 1, 'a second click while the request runs is ignored');
    assert.equal(form.native, 0, 'AJAX: no native submit');
    release(); await settle();
    assert.equal($('.error[data-error-for=email]', form).textContent, 'Server says no');
});

test('direct submit (no onSubmit, no submitHandler): a valid form is handed back to the browser once, an invalid one is not', async () => {
    const form = mount(FIELDS);
    FormValidator.init({ form, rules: { email: ['required', 'email'] } });
    $('#go', form).click(); await settle();
    assert.equal(form.native, 0);
    form.elements.email.value = 'a@b.co';
    $('#go', form).click(); await settle();
    assert.equal(form.native, 1);
});

test('submitHandler(form, event, values): the classic AJAX place, with the validated values as a third argument', async () => {
    const form = mount(FIELDS);
    let third = null;
    FormValidator.init({ form, rules: { email: ['required', 'email'] }, config: { submitHandler: (f, e, values) => { third = values; } } });
    form.elements.email.value = ' a@b.co ';
    $('#go', form).click(); await settle();
    assert.equal(third.email, 'a@b.co');
    assert.equal(form.native, 0);
});
