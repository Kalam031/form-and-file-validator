'use strict';
// Field arrays: nested paths and wildcard rules ('items[].qty') in checkValues / schema, row rules (unique, minItems, maxItems), and repeater rows on a form.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, FormData: w.FormData });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');
require('../src/locales/de.js');
const locales = require('../src/locale.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));

// ---------------------------------------------------------------- checkValues
const DATA = { user: { email: 'x' }, items: [{ sku: 'a', qty: '1' }, { sku: 'A', qty: '' }, { sku: 'b', qty: 'x' }], tags: ['one', ' '] };

test('checkValues: nested paths, wildcards over rows, errors keyed by the concrete path', () => {
    const r = FormValidator.checkValues(DATA, { 'user.email': ['required', 'email'], 'items[].qty': ['required', 'digits'], 'tags[]': 'required' });
    assert.deepEqual(r.errors, {
        'user.email': 'Please enter a valid email address.',
        'items[1].qty': 'This field is required.',
        'items[2].qty': 'Please enter digits only.',
        'tags[1]': 'This field is required.'
    });
    assert.equal(r.details['items[2].qty'].rule, 'digits');
    assert.equal(r.valid, false);
});
test('wildcard spellings: items[].qty, items.*.qty, items[*].qty and items[0].qty all point at rows', () => {
    for (const key of ['items[].qty', 'items.*.qty', 'items[*].qty']) {
        assert.deepEqual(Object.keys(FormValidator.checkValues(DATA, { [key]: 'required' }).errors), ['items[1].qty'], key);
    }
    assert.deepEqual(Object.keys(FormValidator.checkValues(DATA, { 'items[2].qty': 'digits', 'items.1.qty': 'required' }).errors).sort(), ['items[1].qty', 'items[2].qty']);
});
test('a plain path through missing data is a blank value; a wildcard over nothing checks nothing', () => {
    assert.deepEqual(Object.keys(FormValidator.checkValues({}, { 'user.email': 'required', 'items[].qty': 'required', 'a.b.c': 'required' }).errors).sort(), ['a.b.c', 'user.email']);
    assert.equal(FormValidator.checkValues({ items: [] }, { 'items[].qty': 'required' }).valid, true);
    assert.equal(FormValidator.checkValues({ items: null }, { 'items[].qty': 'required' }).valid, true);
    assert.equal(FormValidator.checkValues({ items: 'oops' }, { 'items[].qty': 'required' }).valid, true);
});
test('unique: every row that repeats a value fails; empty values and case (ignoreCase) are handled', () => {
    const r = FormValidator.checkValues(DATA, { 'items[].sku': [{ type: 'unique', ignoreCase: true }] });
    assert.deepEqual(Object.keys(r.errors), ['items[0].sku', 'items[1].sku']);
    assert.equal(r.errors['items[0].sku'], 'This value is used more than once.');
    assert.equal(FormValidator.checkValues(DATA, { 'items[].sku': 'unique' }).valid, true, 'case matters by default');
    assert.equal(FormValidator.checkValues({ items: [{ sku: '' }, { sku: '' }, { sku: ' ' }] }, { 'items[].sku': 'unique' }).valid, true, 'empty values are not compared');
    assert.equal(FormValidator.checkValues({ items: [{ sku: ' a ' }, { sku: 'a' }] }, { 'items[].sku': 'unique' }).valid, false, 'compared after trimming');
    assert.equal(FormValidator.checkValues({ tags: ['x', 'y', 'x'] }, { 'tags[]': 'unique' }).valid, false, 'a list of plain values too');
});
test('minItems / maxItems on the array itself, with their messages', () => {
    assert.equal(FormValidator.checkValues({ items: [] }, { items: { minItems: 1 } }).errors.items, 'Please add at least 1.');
    assert.equal(FormValidator.checkValues({}, { items: { minItems: 1 } }).errors.items, 'Please add at least 1.', 'missing counts as empty');
    assert.equal(FormValidator.checkValues({ items: [1, 2, 3] }, { items: { maxItems: 2 } }).errors.items, 'Please add no more than 2.');
    assert.equal(FormValidator.checkValues({ items: [1, 2] }, { items: { minItems: 1, maxItems: 2 } }).valid, true);
    assert.equal(FormValidator.checkValues({ user: { roles: [] } }, { 'user.roles': { minItems: 1 } }).errors['user.roles'], 'Please add at least 1.');
    locales.use('de');
    assert.equal(FormValidator.checkValues({ items: [] }, { items: { minItems: 2 } }).errors.items, 'Bitte fügen Sie mindestens 2 hinzu.');
    locales.use('en');
});
test('equalTo inside a row looks at the same row first, then at an absolute path', () => {
    const data = { rows: [{ pw: 'a', confirm: 'a' }, { pw: 'b', confirm: 'c' }], top: 'x', other: 'x' };
    const r = FormValidator.checkValues(data, { 'rows[].confirm': { equalTo: 'pw' }, other: { equalTo: 'top' } });
    assert.deepEqual(Object.keys(r.errors), ['rows[1].confirm']);
    assert.equal(FormValidator.checkValues({ a: { x: '1' }, b: { y: '1' } }, { 'b.y': { equalTo: 'a.x' } }).valid, true, 'absolute path');
});
test('rules for a field that really has a dotted or bracketed key win over path reading', () => {
    assert.deepEqual(Object.keys(FormValidator.checkValues({ 'a.b': '' }, { 'a.b': 'required' }).errors), ['a.b']);
    assert.deepEqual(Object.keys(FormValidator.checkValues({ 'items[]': '' }, { 'items[]': 'required' }).errors), ['items[]']);
});
test('hostile keys in rules and data cannot reach prototypes or hang', () => {
    const r = FormValidator.checkValues(JSON.parse('{"__proto__":{"x":""},"a":{"__proto__":{"y":""}}}'), { '__proto__.x': 'required', 'a.__proto__.y': 'required', 'constructor.prototype.z': 'required' });
    assert.equal(r.valid, true);
    assert.equal({}.x, undefined);
    const big = { items: Array.from({ length: 5000 }, (_, i) => ({ qty: String(i) })) };
    const t0 = Date.now();
    assert.equal(FormValidator.checkValues(big, { 'items[].qty': ['required', 'digits'] }).valid, true);
    assert.ok(Date.now() - t0 < 1000);
    const cyc = { items: [] }; cyc.items.push(cyc);
    assert.doesNotThrow(() => FormValidator.checkValues(cyc, { 'items[].items[].items[].x': 'required', 'items[].x': 'required' }));
});

// ---------------------------------------------------------------- schema
test('schema with nested and wildcard keys: nested trimmed output, issues with token paths, errors by concrete path', () => {
    const s = FormValidator.schema({ title: 'required', 'user.email': ['required', 'email'], 'items[].qty': ['required', 'digits'], 'items[].sku': 'unique' });
    const ok = s.safeParse({ title: ' T ', user: { email: ' a@b.co ' }, items: [{ qty: ' 2 ', sku: 'a', junk: 1 }, { qty: '3', sku: 'b' }], extra: true });
    assert.equal(ok.success, true);
    assert.deepEqual(ok.data, { title: 'T', user: { email: 'a@b.co' }, items: [{ qty: '2', sku: 'a' }, { qty: '3', sku: 'b' }] });
    const bad = s.safeParse({ title: '', user: { email: 'x' }, items: [{ qty: '', sku: 'a' }, { qty: '1', sku: 'a' }] });
    assert.equal(bad.success, false);
    assert.deepEqual(bad.issues.map(i => i.path), [['title'], ['user', 'email'], ['items', 0, 'qty'], ['items', 0, 'sku'], ['items', 1, 'sku']]);
    assert.deepEqual(Object.keys(bad.errors), ['title', 'user.email', 'items[0].qty', 'items[0].sku', 'items[1].sku']);
    assert.equal(bad.issues[2].code, 'required');
    assert.throws(() => s.parse({ title: '' }), e => e.name === 'ValidationError' && 'user.email' in e.errors);
    const std = s['~standard'].validate({ title: 'x', user: { email: 'a@b.co' }, items: [] });
    assert.deepEqual(std.value, { title: 'x', user: { email: 'a@b.co' } }, 'rows that are not there are not invented');
    assert.equal(std.issues, undefined);
});
test('schema: flat schemas behave exactly as before; passwords in rows are not trimmed', () => {
    const flat = FormValidator.schema({ email: ['required', 'email'], pw: { pwcheck: { minLength: 4 } } });
    assert.deepEqual(flat.safeParse({ email: ' a@b.co ', pw: ' abcd ' }).data, { email: 'a@b.co', pw: ' abcd ' });
    const rows = FormValidator.schema({ 'users[].pw': { pwcheck: { minLength: 4 } } });
    assert.deepEqual(rows.safeParse({ users: [{ pw: ' abcd ' }] }).data, { users: [{ pw: ' abcd ' }] });
});
test('parseFormData + schema: a repeater form posted as flat fields validates as nested data', () => {
    const fd = new FormData();
    [['title', 'Order'], ['items[0].sku', 'a'], ['items[0].qty', '2'], ['items[1].sku', 'a'], ['items[1].qty', 'x']].forEach(([k, v]) => fd.append(k, v));
    const s = FormValidator.schema({ title: 'required', 'items[].sku': 'unique', 'items[].qty': ['required', 'digits'] });
    const r = s.safeParse(FormValidator.parseFormData(fd));
    assert.deepEqual(Object.keys(r.errors), ['items[0].sku', 'items[1].sku', 'items[1].qty']);
});

// ---------------------------------------------------------------- repeater rows on a form
let n = 0;
function mount(html) {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}"><div id="rows">${html}</div><button type="submit" id="go">Go</button></form>`;
    return document.getElementById(id);
}
const row = i => `<div class="row"><input name="items[${i}].sku" value=""><input name="items[${i}].qty" value=""></div>`;
const err = (form, name) => { const e = form.querySelector(`.error[data-error-for="${name}"]`); return e ? e.textContent : null; };

test('form: a wildcard rule applies to every row, including rows added later; each row is validated on its own', async () => {
    const form = mount(row(0) + row(1));
    const inst = FormValidator.init({ form, rules: { 'items[].sku': ['required'], 'items[].qty': ['required', 'digits'] }, config: { debounce: 0 } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.deepEqual(['items[0].sku', 'items[0].qty', 'items[1].sku', 'items[1].qty'].map(k => !!err(form, k)), [true, true, true, true]);
    form.elements['items[0].sku'].value = 'a'; form.elements['items[0].qty'].value = '2';
    form.elements['items[1].sku'].value = 'b'; form.elements['items[1].qty'].value = '3';
    assert.equal(await inst.validate({ focus: false }), true);
    form.querySelector('#rows').insertAdjacentHTML('beforeend', row(2));
    assert.equal(await inst.validate({ focus: false }), false, 'the new row is checked');
    assert.ok(err(form, 'items[2].qty'));
    form.querySelector('#rows').lastElementChild.remove();
    assert.equal(await inst.validate({ focus: false }), true, 'a removed row no longer counts');
});
test('form: dotted names (items.0.qty) match the same wildcard, and a more specific rule is added to it', async () => {
    const form = mount('<input name="items.0.qty" value="x"><input name="items.1.qty" value="">');
    const inst = FormValidator.init({ form, rules: { 'items[].qty': ['digits'], 'items.1.qty': ['required'] } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.ok(err(form, 'items.0.qty'));
    assert.ok(err(form, 'items.1.qty'));
});
test('form: unique across rows is re-checked when a sibling row changes, and clears when the duplicate is fixed', async () => {
    const form = mount(row(0) + row(1) + row(2));
    const inst = FormValidator.init({ form, rules: { 'items[].sku': [{ type: 'unique', ignoreCase: true }] }, config: { debounce: 0 } });
    const sku = i => form.elements[`items[${i}].sku`];
    sku(0).value = 'abc'; sku(1).value = 'ABC'; sku(2).value = 'zzz';
    assert.equal(await inst.validate({ focus: false }), false);
    assert.ok(err(form, 'items[0].sku') && err(form, 'items[1].sku'));
    assert.equal(err(form, 'items[2].sku'), null);
    sku(1).value = 'other'; fire(sku(1), 'change'); await settle(40);
    assert.equal(err(form, 'items[1].sku'), null);
    await inst.validate({ focus: false });
    assert.equal(err(form, 'items[0].sku'), null, 'the first row is fine once its twin changed');
});
test('form: a PHP-style field literally named items[] keeps working', async () => {
    const form = mount('<input name="items[]" value="a"><input name="items[]" value="">');
    const inst = FormValidator.init({ form, rules: { 'items[]': ['required'] } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.equal(form.querySelectorAll('.error').length, 1);
});
