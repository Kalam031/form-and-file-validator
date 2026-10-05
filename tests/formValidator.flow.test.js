'use strict';
// Cross-field rules (requiredIf, dateAfter, dateBefore, atLeastOne, sumEquals), inst.state / onStateChange, validateStep for wizards, explain().
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { for (let n = this; n && n.nodeType === 1; n = n.parentElement) if (n.hidden || n.style.display === 'none') return []; return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, FormData: w.FormData });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');
require('../src/locales/de.js');
const locales = require('../src/locale.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));
let n = 0;
function mount(html) {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}">${html}<button type="submit" id="go">Go</button></form>`;
    return document.getElementById(id);
}
const err = (form, name) => { const e = form.querySelector(`.error[data-error-for="${name}"]`); return e ? e.textContent : null; };
const cv = (value, rules, values) => FormValidator.checkValue(value, rules, { values });

// ---------------------------------------------------------------- requiredIf
test('requiredIf: filled-in, equals, in, notEquals; shorthand; empty-optional otherwise', () => {
    assert.equal(cv('', { requiredIf: 'country' }, { country: 'DE' }).rule, 'requiredIf');
    assert.equal(cv('', { requiredIf: 'country' }, { country: '' }).valid, true);
    assert.equal(cv('x', { requiredIf: 'country' }, { country: 'DE' }).valid, true);
    assert.equal(cv('', { requiredIf: { field: 'country', equals: 'US' } }, { country: 'US' }).valid, false);
    assert.equal(cv('', { requiredIf: { field: 'country', equals: 'US' } }, { country: 'CA' }).valid, true);
    assert.equal(cv('', { requiredIf: { field: 'country', in: ['US', 'CA'] } }, { country: 'CA' }).valid, false);
    assert.equal(cv('', { requiredIf: { field: 'country', notEquals: 'US' } }, { country: 'DE' }).valid, false);
    assert.equal(cv('', { requiredIf: { field: 'country', notEquals: 'US' } }, { country: 'US' }).valid, true);
    assert.equal(cv('', { requiredIf: { field: 'agree', equals: true } }, { agree: 'true' }).valid, false, 'booleans compare as text');
    assert.equal(cv('', { requiredIf: 'country' }, {}).valid, true, 'the other field is not known: no opinion');
    assert.equal(cv('', { requiredIf: { equals: 'x' } }, { a: 'x' }).valid, true, 'no field named: no opinion');
    assert.equal(cv('', { requiredIf: 'tags' }, { tags: ['a'] }).valid, false, 'a checkbox group counts as filled in');
    assert.equal(cv('', { requiredIf: 'tags' }, { tags: [] }).valid, true);
    assert.equal(cv('', { requiredIf: 'country' }, { country: '  ' }).valid, true, 'blank is blank');
    assert.equal(cv('', { requiredIf: 'country' }, { country: 'DE' }).message, 'This field is required.');
});
test('requiredIf with nested paths in checkValues and schema', () => {
    const r = FormValidator.checkValues({ user: { country: 'US', state: '' } }, { 'user.state': { requiredIf: { field: 'user.country', equals: 'US' } } });
    assert.deepEqual(Object.keys(r.errors), ['user.state']);
    const rows = FormValidator.checkValues({ rows: [{ type: 'a', note: '' }, { type: 'b', note: '' }] }, { 'rows[].note': { requiredIf: { field: 'type', equals: 'b' } } });
    assert.deepEqual(Object.keys(rows.errors), ['rows[1].note'], 'the other field is looked up in the same row first');
});

// ---------------------------------------------------------------- date and number rules
test('dateAfter / dateBefore: strict, inclusive, formats, nothing to compare with', () => {
    assert.equal(cv('2024-05-02', { dateAfter: 'start' }, { start: '2024-05-01' }).valid, true);
    assert.equal(cv('2024-05-01', { dateAfter: 'start' }, { start: '2024-05-01' }).valid, false);
    assert.equal(cv('2024-05-01', { dateAfter: { field: 'start', inclusive: true } }, { start: '2024-05-01' }).valid, true);
    assert.equal(cv('2024-04-30', { dateBefore: 'end' }, { end: '2024-05-01' }).valid, true);
    assert.equal(cv('2024-05-01', { dateBefore: 'end' }, { end: '2024-05-01' }).valid, false);
    assert.equal(cv('2024-05-01', { dateBefore: { field: 'end', inclusive: true } }, { end: '2024-05-01' }).valid, true);
    assert.equal(cv('02/05/2024', { dateAfter: { field: 'start', format: 'd/M/yyyy' } }, { start: '01/05/2024' }).valid, true);
    assert.equal(cv('01/05/2024', { dateAfter: { field: 'start', format: 'd/M/yyyy' } }, { start: '02/05/2024' }).valid, false);
    assert.equal(cv('2024-05-01', { dateAfter: 'start' }, { start: '' }).valid, true, 'the other date is empty');
    assert.equal(cv('2024-05-01', { dateAfter: 'start' }, {}).valid, true);
    assert.equal(cv('not a date', { dateAfter: { field: 'start', strict: true } }, { start: '2024-05-01' }).valid, false);
    assert.equal(cv('', { dateAfter: 'start' }, { start: '2024-05-01' }).valid, true, 'an empty value is left to required');
    assert.equal(cv('2024-05-01', { dateAfter: 'start' }, { start: '2024-05-02' }).message, 'Please enter a later date.');
    assert.equal(cv('2024-05-03', { dateBefore: 'end' }, { end: '2024-05-02' }).message, 'Please enter an earlier date.');
});
test('atLeastOne and sumEquals', () => {
    assert.equal(cv('', { atLeastOne: ['phone', 'email'] }, { phone: '', email: '' }).rule, 'atLeastOne');
    assert.equal(cv('', { atLeastOne: ['phone', 'email'] }, { phone: '', email: 'a@b.co' }).valid, true);
    assert.equal(cv('1', { atLeastOne: ['phone'] }, { phone: '' }).valid, true);
    assert.equal(cv('', { atLeastOne: { fields: ['phone'] } }, {}).valid, false, 'unknown fields count as empty');
    assert.equal(cv('40', { sumEquals: { fields: ['b', 'c'], total: 100 } }, { b: '30', c: '30' }).valid, true);
    assert.equal(cv('40', { sumEquals: { fields: ['b', 'c'], total: 100 } }, { b: '30', c: '' }).valid, false);
    assert.equal(cv('', { sumEquals: { fields: ['b'], total: 100 } }, { b: '100' }).valid, true, 'empty counts as 0');
    assert.equal(cv('0.1', { sumEquals: { fields: ['b'], total: 0.3 } }, { b: '0.2' }).valid, true, 'no floating point surprises');
    assert.equal(cv('x', { sumEquals: { fields: ['b'], total: 1 } }, { b: '1' }).valid, false, 'not a number');
    assert.equal(cv('40', { sumEquals: { fields: ['b'], total: 100 } }, { b: '30' }).message, 'The values must add up to 100.');
});
test('the new rules have messages in every language pack', () => {
    locales.use('de');
    assert.equal(cv('2024-05-01', { dateAfter: 'start' }, { start: '2024-05-02' }).message, 'Bitte geben Sie ein späteres Datum ein.');
    assert.equal(cv('1', { sumEquals: { fields: [], total: 5 } }, {}).message, 'Die Werte müssen zusammen 5 ergeben.');
    locales.use('en');
});

// ---------------------------------------------------------------- the same rules on a form
test('form: requiredIf follows the other field live, dateAfter re-checks when the start changes, atLeastOne and sumEquals read the form', async () => {
    const form = mount('<input name="country" value="DE"><input name="state">' +
        '<input name="start" value="2024-05-10"><input name="end" value="2024-05-01">' +
        '<input name="phone"><input name="email">' +
        '<input name="p1" value="40"><input name="p2" value="30"><input name="p3" value="30">');
    const inst = FormValidator.init({ form, config: { debounce: 0 }, rules: {
        state: { requiredIf: { field: 'country', equals: 'US' } }, end: { dateAfter: 'start' },
        phone: { atLeastOne: ['email'] }, p1: { sumEquals: { fields: ['p2', 'p3'], total: 100 } }
    } });
    await inst.validate({ focus: false });
    assert.equal(err(form, 'state'), null);
    assert.ok(err(form, 'end'), 'end is before start');
    assert.ok(err(form, 'phone'));
    assert.equal(err(form, 'p1'), null);
    form.elements.country.value = 'US'; fire(form.elements.country, 'change'); await settle(40);
    assert.equal(err(form, 'state'), null, 'not shown for a field the user has not visited');
    await inst.validate({ focus: false });
    assert.ok(err(form, 'state'));
    form.elements.country.value = 'DE'; fire(form.elements.country, 'change'); await settle(40);
    assert.equal(err(form, 'state'), null, 'the message goes when the condition no longer holds');
    form.elements.start.value = '2024-04-01'; fire(form.elements.start, 'change'); await settle(40);
    assert.equal(err(form, 'end'), null, 'changing the start re-checks the end');
    form.elements.email.value = 'a@b.co'; fire(form.elements.email, 'change'); await settle(40);
    assert.equal(err(form, 'phone'), null);
    form.elements.p2.value = '10'; fire(form.elements.p2, 'change'); await settle(40);
    assert.ok(err(form, 'p1'), 'the total no longer adds up');
});
test('form: radio and checkbox values are the other field for requiredIf', async () => {
    const form = mount('<label><input type="radio" name="kind" value="company"> C</label><label><input type="radio" name="kind" value="person"> P</label><input name="vat">');
    const inst = FormValidator.init({ form, rules: { vat: { requiredIf: { field: 'kind', equals: 'company' } } } });
    assert.equal(await inst.validate({ focus: false }), true);
    form.elements.kind[0].checked = true;
    assert.equal(await inst.validate({ focus: false }), false);
    form.elements.kind[1].checked = true;
    assert.equal(await inst.validate({ focus: false }), true);
});

// ---------------------------------------------------------------- state
test('inst.state: touched, dirty, pristine, valid, error, submit count; reset starts over', async () => {
    const form = mount('<input name="a" value="x"><input name="b">');
    const inst = FormValidator.init({ form, rules: { a: 'required', b: ['required', 'email'] }, config: { debounce: 0 } });
    let s = inst.state;
    assert.deepEqual([s.valid, s.dirty, s.pristine, s.touched, s.submitCount, s.submitted, s.validating, s.errorCount], [true, false, true, false, 0, false, false, 0]);
    assert.deepEqual(s.fields.a, { value: 'x', dirty: false, pristine: true, touched: false, pending: false, valid: true, error: null, code: null });
    form.elements.a.value = 'y'; fire(form.elements.a, 'input');
    fire(form.elements.a, 'focusout');
    s = inst.getState();
    assert.equal(s.fields.a.dirty, true);
    assert.equal(s.fields.a.touched, true);
    assert.equal(s.fields.b.touched, false);
    assert.equal(s.dirty, true);
    form.elements.a.value = 'x';
    assert.equal(inst.getState().fields.a.dirty, false, 'back to the start value is pristine again');
    await inst.validate({ focus: false, submit: true });
    s = inst.state;
    assert.equal(s.submitCount, 1);
    assert.equal(s.submitted, true);
    assert.equal(s.valid, false);
    assert.equal(s.errorCount, 1);
    assert.deepEqual([s.fields.b.valid, s.fields.b.error, s.fields.b.code], [false, 'This field is required.', 'required']);
    await inst.validate({ focus: false, submit: true });
    assert.equal(inst.state.submitCount, 2);
    inst.resetForm();
    s = inst.state;
    assert.deepEqual([s.submitCount, s.touched, s.dirty, s.errorCount], [0, false, false, 0]);
});
test('inst.state: groups, checkboxes and pending remote checks', async () => {
    const orig = globalThis.fetch;
    let release;
    globalThis.fetch = () => new Promise(r => { release = () => r({ ok: true, status: 200, json: async () => true }); });
    try {
        const form = mount('<label><input type="checkbox" name="t" value="a"> a</label><label><input type="checkbox" name="t" value="b"> b</label><input name="u" value="bob">');
        const inst = FormValidator.init({ form, rules: { t: 'required', u: [{ type: 'remote', url: '/check' }] } });
        assert.deepEqual(inst.state.fields.t.value, []);
        form.elements.t[1].checked = true;
        assert.equal(inst.state.fields.t.dirty, true);
        const p = inst.validate({ focus: false });
        await settle(10);
        assert.equal(inst.state.validating, true);
        assert.equal(inst.state.fields.u.pending, true);
        release(); await p;
        assert.equal(inst.state.validating, false);
    } finally { globalThis.fetch = orig; }
});
test('onStateChange: once per tick for errors, touched, dirty and submit changes; unsubscribe; a throwing listener is contained', async () => {
    const form = mount('<input name="a"><input name="b">');
    const inst = FormValidator.init({ form, rules: { a: 'required', b: 'required' }, config: { debounce: 0 } });
    const seen = [];
    const off = inst.onStateChange(s => seen.push([s.errorCount, s.touched, s.submitCount]));
    const ow = console.error; console.error = () => {};
    inst.onStateChange(() => { throw new Error('boom'); });
    try {
        await inst.validate({ focus: false, submit: true }); await settle(5);
        assert.deepEqual(seen[seen.length - 1], [2, false, 1], 'two errors, one submit: coalesced into the last state');
        const count = seen.length;
        fire(form.elements.a, 'focusout'); await settle(5);
        assert.ok(seen.length > count);
        assert.equal(seen[seen.length - 1][1], true);
        form.elements.a.value = 'x'; fire(form.elements.a, 'change'); await settle(40);
        assert.equal(seen[seen.length - 1][0], 1);
        off();
        const after = seen.length;
        await inst.validate({ focus: false }); await settle(5);
        assert.equal(seen.length, after, 'unsubscribed');
        assert.equal(typeof inst.onStateChange(null), 'function');
    } finally { console.error = ow; }
});

// ---------------------------------------------------------------- wizard steps
const STEPS = '<fieldset id="s1"><input name="name"><input name="email"></fieldset><fieldset id="s2"><input name="street"><input name="city"></fieldset>';
test('validateStep: only the fields of the step, by element, selector or names; it shows and focuses', async () => {
    const form = mount(STEPS);
    const inst = FormValidator.init({ form, rules: { name: 'required', email: ['required', 'email'], street: 'required', city: 'required' } });
    assert.equal(await inst.validateStep('#s1'), false);
    assert.ok(err(form, 'name') && err(form, 'email'));
    assert.equal(err(form, 'street'), null, 'the other step is not touched');
    assert.equal(document.activeElement, form.elements.name, 'focus goes to the first invalid field of the step');
    form.elements.name.value = 'Bob'; form.elements.email.value = 'a@b.co';
    assert.equal(await inst.validateStep(form.querySelector('#s1')), true);
    assert.equal(err(form, 'name'), null);
    assert.equal(await inst.validateStep(['street']), false);
    assert.equal(err(form, 'city'), null, 'only the named fields');
    assert.equal(await inst.validateStep('#nothing'), true, 'an empty scope is valid');
    assert.equal(inst.getState().submitCount, 0, 'a step is not a submit');
});
test('validateStep: a hidden step is skipped, events and focus:false behave', async () => {
    const form = mount(STEPS);
    const inst = FormValidator.init({ form, rules: { name: 'required', street: 'required' } });
    form.querySelector('#s2').hidden = true;
    assert.equal(await inst.validateStep('#s2'), true, 'hidden fields are not validated');
    let invalid = 0;
    form.addEventListener('fv:invalid', () => { invalid++; });
    assert.equal(await inst.validateStep('#s1', { focus: false }), false);
    assert.equal(invalid, 1);
    assert.notEqual(document.activeElement, form.elements.name);
    form.querySelector('#s2').hidden = false;
    assert.equal(await inst.validate({ focus: false }), false, 'the whole form still checks everything');
});

// ---------------------------------------------------------------- explain
test('explain: every rule in order, failures with messages, skips with reasons', () => {
    const r = FormValidator.explain('ab', ['required', { type: 'minlength', min: 3 }, 'email', { type: 'maxlength', max: 5, code: 'len.max' }]);
    assert.deepEqual(r.map(x => [x.rule, x.passed]), [['required', true], ['minlength', false], ['email', false], ['maxlength', true]]);
    assert.equal(r[1].message, 'Please enter at least 3 characters.');
    assert.deepEqual(r[1].param, [3]);
    assert.equal(r[3].code, 'len.max');
    const e = FormValidator.explain('', ['required', 'email', { type: 'minlength', min: 2, when: () => false }, 'remote', 'nonsense', 'file']);
    assert.deepEqual(e.map(x => x.passed), [false, true, null, null, null, null]);
    assert.match(e[1].skipped, /empty value/);
    assert.match(e[2].skipped, /when/);
    assert.match(e[3].skipped, /needs a form/);
    assert.match(e[4].skipped, /unknown rule/);
    const eq = FormValidator.explain('a', { equalTo: 'pw' }, { values: { pw: 'b' } });
    assert.equal(eq[0].passed, false);
    assert.match(FormValidator.explain('a', { equalTo: 'pw' })[0].skipped, /options\.values/);
    assert.deepEqual(FormValidator.explain('x', 'email').map(x => x.rule), ['email']);
    assert.deepEqual(FormValidator.explain('x', null), []);
});

test('devtools: shows live state, escapes hostile text, and removes itself', async () => {
    const form = mount('<input name="email" required type="email"><input name="x" value="<img src=x onerror=alert(1)>">');
    FormValidator.init({ form, rules: { email: { required: true, email: true } } });
    const dt = FormValidator.devtools(form);
    assert.ok(dt.element && document.body.contains(dt.element));
    assert.match(dt.element.textContent, /email/);
    form.elements.email.value = 'nope'; fire(form.elements.email, 'input'); fire(form.elements.email, 'blur'); fire(form.elements.email, 'focusout');
    await FormValidator.validate(form);
    await settle();
    assert.match(dt.element.textContent, /error/);
    assert.equal(dt.element.querySelector('img'), null);
    dt.destroy();
    assert.equal(document.body.contains(dt.element), false);
    assert.equal(FormValidator.devtools('missing-form').element, null);
});

globalThis.addEventListener = (...a) => w.addEventListener(...a);
globalThis.removeEventListener = (...a) => w.removeEventListener(...a);
test('onFieldStats: counts focus, edits and errors per field, reports on submit and abandon, never values', async () => {
    const form = mount('<input name="email" type="email"><input name="pw" value="secret-value">');
    const seen = [];
    const inst = FormValidator.init({ form, rules: { email: { required: true, email: true } }, config: { debounce: 0, onFieldStats: s => seen.push(s) } });
    const email = form.elements.email;
    fire(email, 'focusin'); email.value = 'bad'; fire(email, 'input'); fire(email, 'focusout');
    await FormValidator.validate(form);
    const ok = await inst.validate({ submit: true });
    assert.equal(ok, false);
    const last = seen[seen.length - 1];
    assert.equal(last.reason, 'submit');
    assert.equal(last.valid, false);
    assert.ok(last.fields.email.focusCount >= 1);
    assert.equal(last.fields.email.changes, 1);
    assert.ok(last.fields.email.errorsShown >= 1);
    assert.ok(last.fields.email.codes.email >= 1 || Object.keys(last.fields.email.codes).length);
    assert.equal(JSON.stringify(last).includes('secret-value'), false);
    window.dispatchEvent(new w.Event('pagehide'));
    assert.equal(seen[seen.length - 1].reason, 'abandon');
    const n = seen.length; window.dispatchEvent(new w.Event('pagehide')); assert.equal(seen.length, n);
    assert.ok(inst.getFieldStats().fields.email.focusCount >= 1);
    // a throwing callback never breaks the form
    const f2 = mount('<input name="a">');
    const i2 = FormValidator.init({ form: f2, rules: { a: 'required' }, config: { onFieldStats() { throw new Error('boom'); } } });
    const orig = console.error; console.error = () => {};
    assert.equal(await i2.validate({ submit: true }), false);
    console.error = orig;
});

test('unknown rule warning names the field, suggests the closest rule and points at the init() call, once', async () => {
    const form = mount('<input name="mail" value="x">');
    const warn = console.warn; const seen = []; console.warn = m => seen.push(String(m));
    try {
        const inst = FormValidator.init({ form, rules: { mail: ['emial'] }, config: { debounce: 0 } });
        await inst.validate(); await inst.validate();
    } finally { console.warn = warn; }
    assert.equal(seen.length, 1);
    assert.match(seen[0], /unknown rule "emial" on field "mail" \(did you mean "email"\?\)/);
    assert.match(seen[0], /rules passed at .*formValidator\.flow\.test\.js:\d+/);
});
