'use strict';
require('./helpers/shim.js');
// The jQuery-Validation-style API on the native FormValidator: addMethod, scalar rule parameters, depends, normalizer,
// class rules, data-rule-*, per-field messages, {0} placeholders, remote shorthand, pending state, focusCleanup.
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', {
    value() { for (let n = this; n && n.nodeType === 1; n = n.parentElement) if (n.hidden || n.style.display === 'none') return []; return [1]; }
});
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const settle = (ms = 25) => new Promise(r => setTimeout(r, ms));
const errFor = (form, name) => $$(`.error[data-error-for="${name}"]`, form).map(e => e.textContent);
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
let n = 0;
function mount(html) {
    document.body.innerHTML = `<form id="f${++n}">${html}<button type="submit">go</button></form>`;
    return document.getElementById('f' + n);
}
const run = async (html, rules, config, extra) => {
    const form = mount(html);
    const inst = FormValidator.init(Object.assign({ formId: form.id, rules, config }, extra));
    const ok = await inst.validate({ focus: false });
    return { form, inst, ok };
};
/** one field "x", one value, one rules object -> validity */
const check = async (rules, value, html = '<input name="x" id="x">') => {
    const form = mount(html);
    $('[name=x]').value = value;
    return FormValidator.validate(form.id, { x: rules });
};

// ================================================================ addMethod
test('addMethod: jQuery signature, this.optional, default message, param', async () => {
    FormValidator.addMethod('even', function (value, element, param) { return this.optional(element) || value % 2 === 0; }, 'Even numbers only');
    assert.equal(await check({ even: true }, ''), true, 'blank is optional');
    assert.equal(await check({ even: true }, '4'), true);
    assert.equal(await check({ even: true }, '5'), false);
    const { form } = await run('<input name="x" value="5">', { x: { even: true } });
    assert.deepEqual(errFor(form, 'x'), ['Even numbers only']);
});

test('addMethod: scalar and array parameters flow into the method and into {0} {1} placeholders', async () => {
    FormValidator.addMethod('multipleOf', function (value, element, param) { return this.optional(element) || value % param === 0; }, FormValidator.format('Multiples of {0} only'));
    FormValidator.addMethod('between', function (value, element, param) { return this.optional(element) || (value >= param[0] && value <= param[1]); }, 'Between {0} and {1}');
    assert.equal(await check({ multipleOf: 3 }, '9'), true);
    assert.equal(await check({ multipleOf: 3 }, '10'), false);
    assert.equal(await check({ between: [1, 5] }, '3'), true);
    assert.equal(await check({ between: [1, 5] }, '9'), false);
    let r = await run('<input name="x" value="10">', { x: { multipleOf: 3 } });
    assert.deepEqual(errFor(r.form, 'x'), ['Multiples of 3 only']);
    r = await run('<input name="x" value="9">', { x: { between: [1, 5] } });
    assert.deepEqual(errFor(r.form, 'x'), ['Between 1 and 5']);
});

test('addMethod: message as function(param, element); runs on empty values unless it calls this.optional', async () => {
    FormValidator.addMethod('mustBeOk', function (value) { return value === 'ok'; }, (param, element) => 'Field ' + element.name + ' must be ok');
    let r = await run('<input name="x" value="">', { x: { mustBeOk: true } });
    assert.equal(r.ok, false, 'no this.optional -> blank is checked too, like jQuery');
    assert.deepEqual(errFor(r.form, 'x'), ['Field x must be ok']);
    r = await run('<input name="x" value="ok">', { x: { mustBeOk: true } });
    assert.equal(r.ok, true);
});

test('addMethod: sync and async results, dependency-mismatch, strings as messages, this.elementValue/optional on other fields', async () => {
    FormValidator.addMethod('asyncOk', async function (value) { await settle(5); return value === 'ok'; }, 'Async says no');
    FormValidator.addMethod('maybe', function () { return 'dependency-mismatch'; }, 'never shown');
    FormValidator.addMethod('withText', function (value) { return value === 'a' ? true : 'Inline message'; });
    FormValidator.addMethod('needsOther', function (value, element) { return this.optional(element) || !this.optional(this.form.querySelector('[name=other]')); }, 'Fill the other field too');
    assert.equal(await check({ asyncOk: true }, 'ok'), true);
    assert.equal(await check({ asyncOk: true }, 'no'), false);
    assert.equal(await check({ maybe: true }, 'anything'), true);
    const r = await run('<input name="x" value="b">', { x: { withText: true } });
    assert.deepEqual(errFor(r.form, 'x'), ['Inline message']);
    const html = '<input name="x" value="v"><input name="other" value="">';
    assert.equal((await run(html, { x: { needsOther: true } })).ok, false);
    assert.equal((await run('<input name="x" value="v"><input name="other" value="o">', { x: { needsOther: true } })).ok, true);
});

test('addMethod validates its input and works in the array rule form too', async () => {
    assert.throws(() => FormValidator.addMethod('bad', 'nope'), /function/);
    FormValidator.addMethod('divisible', function (v, el, p) { return this.optional(el) || v % p === 0; }, 'Not divisible by {0}');
    assert.equal(await check([{ type: 'divisible', param: 4 }], '8'), true);
    assert.equal(await check([{ type: 'divisible', param: 4 }], '9'), false);
});

// ================================================================ scalar rule parameters (map form)
test('map rules with scalar parameters behave like jQuery rules', async () => {
    const cases = [
        [{ minlength: 3 }, 'abc', 'ab'], [{ maxlength: 3 }, 'abc', 'abcd'], [{ rangelength: [2, 4] }, 'abc', 'a'], [{ rangelength: '[2, 4]' }, 'ab', 'abcde'],
        [{ min: 5 }, '5', '4'], [{ max: 5 }, '5', '6'], [{ range: [1, 5] }, '3', '6'], [{ range: '1,5' }, '1', '0'], [{ step: 5 }, '10', '3'],
        [{ oneOf: ['a', 'b'] }, 'a', 'c'], [{ pattern: '^a+$' }, 'aaa', 'b'], [{ pattern: /^a+$/ }, 'a', 'b'],
        [{ minDate: '2024-01-01' }, '2024-06-01', '2023-01-01'], [{ maxDate: '2024-01-01' }, '2023-06-01', '2025-01-01'],
        [{ fileType: 'png,jpg' }, null, null]
    ];
    for (const [rules, good, bad] of cases) {
        if (good === null) continue;
        assert.equal(await check(rules, good), true, JSON.stringify(rules) + ' with ' + good);
        assert.equal(await check(rules, bad), false, JSON.stringify(rules) + ' with ' + bad);
    }
});

test('scalar params: equalTo / notEqualTo by selector or by field name, checkbox counts, file rules', async () => {
    const two = '<input name="pw" id="pw" value="secret"><input name="x" id="x" value="secret">';
    for (const target of ['#pw', 'pw']) {
        assert.equal((await run(two, { x: { equalTo: target } })).ok, true, 'equalTo ' + target);
        assert.equal((await run(two.replace('id="x" value="secret"', 'id="x" value="other"'), { x: { equalTo: target } })).ok, false);
    }
    assert.equal((await run(two, { x: { notEqualTo: '#pw' } })).ok, false);
    const boxes = '<input type="checkbox" name="x" value="1" checked><input type="checkbox" name="x" value="2">';
    assert.equal((await run(boxes, { x: { minChecked: 1 } })).ok, true);
    assert.equal((await run(boxes, { x: { minChecked: 2 } })).ok, false);
    assert.equal((await run(boxes, { x: { maxChecked: 0 } })).ok, false);
    const form = mount('<input type="file" name="x">');
    Object.defineProperty($('[name=x]'), 'files', { value: [new File(['1'], 'a.png'), new File(['1'], 'b.exe')] });
    assert.equal(await FormValidator.validate(form.id, { x: { fileType: 'png' } }), false);
    assert.equal(await FormValidator.validate(form.id, { x: { maxFiles: 1 } }), false);
    assert.equal(await FormValidator.validate(form.id, { x: { minFiles: 2, fileType: 'png,exe' } }), true);
});

test('string values: message for names that are not parameter rules, selector/param for names that are', async () => {
    const r = await run('<input name="x" value="bad">', { x: { email: 'That is not an email' } });
    assert.deepEqual(errFor(r.form, 'x'), ['That is not an email']);
    assert.equal((await run('<input name="x" value="abcd">', { x: { pattern: '^[a-z]+$' } })).ok, true);
});

test('required as selector or function (a dependency), and depends { param, depends }', async () => {
    const html = '<input type="checkbox" id="chk"><input name="a" id="a"><input name="b" id="b"><input name="c" id="c">';
    const form = mount(html);
    const inst = FormValidator.init({ formId: form.id, rules: {
        a: { required: '#chk:checked' },
        b: { minlength: { param: 5, depends: () => $('#chk').checked } },
        c: { required: () => $('#chk').checked }
    } });
    assert.equal(await inst.validate({ focus: false }), true, 'nothing depends yet');
    $('#chk').checked = true;
    assert.equal(await inst.validate({ focus: false }), false);
    $('#a').value = 'x'; $('#c').value = 'y';
    assert.equal(await inst.validate({ focus: false }), true, 'b is blank');
    $('#b').value = 'abc';
    assert.equal(await inst.validate({ focus: false }), false);
    $('#b').value = 'abcde';
    assert.equal(await inst.validate({ focus: false }), true);
    const f2 = mount('<input type="checkbox" id="chk2"><input name="d" id="d" value="x">');
    const i2 = FormValidator.init({ formId: f2.id, rules: { d: { minlength: { param: 5, depends: '#chk2:checked' } } } });
    assert.equal(await i2.validate({ focus: false }), true);
    $('#chk2').checked = true;
    assert.equal(await i2.validate({ focus: false }), false);
});

test('normalizer runs before the rules; `messages` inside a rules object; required first, remote last', async () => {
    const r = await run('<input name="x" value="a-b">', { x: { required: true, minlength: 3, normalizer: v => v.replace(/-/g, '') } });
    assert.equal(r.ok, false, '"a-b" -> "ab"');
    $('[name=x]').value = 'a-b-c';
    assert.equal(await r.inst.validate({ focus: false }), true);
    const m = await run('<input name="x" value="">', { x: { minlength: 3, required: true, messages: { required: 'Fill me in' } } });
    assert.deepEqual(errFor(m.form, 'x'), ['Fill me in']);
    const order = await run('<input name="x">', { x: { remote: '/x', email: true, required: true } });
    assert.deepEqual(order.inst.rules.x.map(r => r.type), ['required', 'email', 'remote']);
});

// ================================================================ class rules
test('addClassRules and config.classRules; explicit rules win over class rules', async () => {
    FormValidator.addClassRules('zip', { required: true, digits: true, minlength: 5, maxlength: 5 });
    FormValidator.addClassRules({ upper: { pattern: '^[A-Z]+$' } });
    let r = await run('<input name="z" class="zip">', {});
    assert.equal(r.ok, false);
    $('[name=z]').value = '1234'; assert.equal(await r.inst.validate({ focus: false }), false);
    $('[name=z]').value = '12345'; assert.equal(await r.inst.validate({ focus: false }), true);
    r = await run('<input name="u" class="upper" value="abc">', {});
    assert.equal(r.ok, false);
    r = await run('<input name="q" class="local" value="">', {}, { classRules: { local: { required: true } } });
    assert.equal(r.ok, false);
    r = await run('<input name="z" class="zip" value="abc">', { z: { digits: true, message: 'x' } });
    assert.equal(r.ok, false);
    r = await run('<input name="z" class="zip" value="12345">', { z: [{ type: 'minlength', min: 2 }] });
    assert.equal(r.ok, true, 'explicit minlength replaces the class rule for that type');
});

// ================================================================ data-rule-*
test('data-rule-* attributes with autoRules (booleans, numbers, JSON arrays, selectors, kebab names) and data-msg-*', async () => {
    const html = `<input name="pw" id="pw" value="secret">
        <input name="a" data-rule-required data-msg-required="Name please">
        <input name="b" value="ab" data-rule-minlength="4">
        <input name="c" value="9" data-rule-range="[1,5]" data-msg-range="Between {0} and {1}, please">
        <input name="d" value="other" data-rule-equalto="#pw">
        <input name="e" value="2020-01-01" data-rule-min-date="2024-01-01">
        <input name="f" value="x" data-rule-required="false">`;
    const { form, inst, ok } = await run(html, {}, { autoRules: true });
    assert.equal(ok, false);
    assert.equal(errFor(form, 'a')[0], 'Name please');
    assert.match(errFor(form, 'b')[0], /at least|4/i);
    assert.equal(errFor(form, 'c')[0], 'Between 1 and 5, please');
    assert.equal(errFor(form, 'd').length, 1);
    assert.equal(errFor(form, 'e').length, 1);
    assert.equal(errFor(form, 'f').length, 0);
});

// ================================================================ messages
test('init `messages`: per field (string or per rule), per rule type, and rule.message still wins', async () => {
    const html = '<input name="a"><input name="b" value="x"><input name="c"><input name="d">';
    const { form } = await run(html, {
        a: 'required', b: { minlength: 3, email: true }, c: { required: true }, d: { required: true, message: 'x' }
    }, undefined, { messages: {
        a: 'Whole-field message',
        b: { minlength: 'Need {0} characters', email: 'Bad email' },
        c: { required: 'C is required' },
        required: 'Type-level required'
    } });
    assert.equal(errFor(form, 'a')[0], 'Whole-field message');
    assert.equal(errFor(form, 'b')[0], 'Need 3 characters');
    assert.equal(errFor(form, 'c')[0], 'C is required');
    assert.equal(errFor(form, 'd')[0], 'Type-level required');
});

test('{0}/{1} placeholders in every message source; format() and setDefaults()', async () => {
    assert.equal(FormValidator.format('{0}-{1}', 'a', 'b'), 'a-b');
    assert.equal(FormValidator.format('Hi {0}', ['x']), 'Hi x');
    assert.equal(FormValidator.format('{0}{0}')('z'), 'zz');
    const { form } = await run('<input name="x" value="1"><input name="y" value="abcdef">',
        { x: { range: [5, 9], messages: { range: 'Pick {0}..{1}' } }, y: { maxlength: 3 } }, { messages: { maxlength: 'Max {0} chars' } });
    assert.equal(errFor(form, 'x')[0], 'Pick 5..9');
    assert.equal(errFor(form, 'y')[0], 'Max 3 chars');
    const before = FormValidator.defaults.errorClass;
    FormValidator.setDefaults({ errorClass: 'oops error' });
    try {
        const r = await run('<input name="x">', { x: 'required' });
        assert.ok($('.oops', r.form));
    } finally { FormValidator.setDefaults({ errorClass: before }); }
});

// ================================================================ remote
const json = body => ({ ok: true, status: 200, json: async () => body });
function mockFetch(handler) { const calls = []; globalThis.fetch = async (url, o) => { calls.push({ url, o }); return handler(url, o, calls.length); }; return calls; }

test('remote shorthand: remote:"/url", jQuery options (type, data functions, dataFilter) and rule order', async () => {
    let calls = mockFetch(() => json(true));
    const html = '<input name="user" id="user" value="bob"><input id="tok" value="T9">';
    let form = mount(html);
    let inst = FormValidator.init({ formId: form.id, rules: { user: { remote: '/check' } } });
    assert.equal(await inst.validate({ focus: false }), true);
    assert.equal(calls[0].o.method, 'GET', 'default is GET, like jQuery');
    assert.equal(calls[0].url, '/check?user=bob');

    calls = mockFetch(() => json({ ok: true }));
    form = mount(html);
    inst = FormValidator.init({ formId: form.id, rules: { user: { remote: { url: '/check', data: { token: () => $('#tok').value, fixed: 'F' }, dataFilter: r => r.ok } } } });
    assert.equal(await inst.validate({ focus: false }), true);
    assert.equal(calls[0].o.method, 'GET');
    assert.equal(calls[0].url, '/check?user=bob&token=T9&fixed=F');

    calls = mockFetch(() => json(true));
    form = mount(html);
    inst = FormValidator.init({ formId: form.id, rules: { user: { remote: { url: '/check', type: 'post', data: { token: () => $('#tok').value } } } } });
    assert.equal(await inst.validate({ focus: false }), true);
    assert.equal(calls[0].o.method, 'POST', 'type: "post" switches to POST, like jQuery');
    assert.deepEqual(JSON.parse(calls[0].o.body), { user: 'bob', token: 'T9' });
});

test('remote: server message shown, data-msg-remote wins, network error blocks unless failOpen', async () => {
    mockFetch(() => json('Already taken'));
    let r = await run('<input name="user" value="bob">', { user: { remote: '/c' } });
    assert.deepEqual(errFor(r.form, 'user'), ['Already taken']);
    r = await run('<input name="user" value="bob" data-msg-remote="Try another name">', { user: { remote: '/c' } });
    assert.deepEqual(errFor(r.form, 'user'), ['Try another name']);
    mockFetch(() => { throw new Error('offline'); });
    r = await run('<input name="user" value="bob">', { user: { remote: '/c' } });
    assert.equal(r.ok, false);
    r = await run('<input name="user" value="bob">', { user: { remote: { url: '/c', failOpen: true } } });
    assert.equal(r.ok, true);
});

test('pending state: class + aria-busy while a server check runs, removed afterwards (also when it fails)', async () => {
    mockFetch(async () => { await settle(40); return json(false); });
    const form = mount('<input name="user" id="user" value="bob">');
    const inst = FormValidator.init({ formId: form.id, rules: { user: { remote: '/c' } } });
    const p = inst.validate({ focus: false });
    await settle(10);
    assert.ok($('#user').classList.contains('fv-pending'));
    assert.equal($('#user').getAttribute('aria-busy'), 'true');
    assert.equal(await p, false);
    assert.ok(!$('#user').classList.contains('fv-pending'));
    assert.equal($('#user').hasAttribute('aria-busy'), false);

    mockFetch(() => json(true));
    const f2 = mount('<input name="user" id="user" value="bob">');
    const i2 = FormValidator.init({ formId: f2.id, rules: { user: { remote: '/c' } }, config: { pendingClass: '' } });
    const p2 = i2.validate({ focus: false });
    await settle(1);
    assert.ok(!$('#user').classList.contains('fv-pending'), 'pendingClass: "" turns it off');
    await p2;
});

// ================================================================ focusCleanup
test('focusCleanup clears the error when the field gets focus', async () => {
    const { form, inst } = await run('<input name="a" id="a">', { a: 'required' }, { focusCleanup: true });
    assert.equal(errFor(form, 'a').length, 1);
    fire($('#a'), 'focusin');
    assert.equal(errFor(form, 'a').length, 0);
});

// ================================================================ regression: old forms unchanged
test('old array/object rule forms and the earlier shorthand still work', async () => {
    const { form } = await run('<input name="a" value="x"><input name="b" value="x">', {
        a: [{ type: 'minlength', min: 3, message: 'short' }],
        b: { required: true, minlength: { min: 3, message: 'also short' }, email: 'Bad address' }
    });
    assert.equal(errFor(form, 'a')[0], 'short');
    assert.equal(errFor(form, 'b')[0], 'also short');
});
