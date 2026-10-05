'use strict';
// FormValidator.load() / initFromUrl() (rules served by a backend) and the testing helpers (fill, submit, expectError, fakeFetch).
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, FormData: w.FormData });
globalThis.FileValidator = require('../src/fileValidator.js');
const { FormValidator } = require('../dist/validator.js');
const t = require('../dist/testing.js');

const mount = html => { document.body.innerHTML = `<form id="f">${html}<button type="submit">Go</button></form>`; return document.getElementById('f'); };

// ---------------------------------------------------------------- load
test('load: rules, messages and config from the backend; cached per url; a failure is not cached', async () => {
    const fetch = t.fakeFetch({ 'GET /rules/signup': { json: { rules: { email: ['required', 'email'], age: { range: [18, 99] } }, messages: { required: 'Needed' }, config: { errorSummary: true } } }, 'GET /rules/down': { status: 500 } });
    const a = await FormValidator.load('/rules/signup', { fetch });
    assert.deepEqual(Object.keys(a), ['rules', 'messages', 'config']);
    assert.deepEqual(a.rules.age, { range: [18, 99] });
    assert.equal(FormValidator.checkValues({}, a.rules, { messages: a.messages }).errors.email, 'Needed');
    assert.equal(await FormValidator.load('/rules/signup', { fetch }), a, 'cached');
    assert.equal(fetch.calls.length, 1);
    await FormValidator.load('/rules/signup', { fetch, cache: false });
    assert.equal(fetch.calls.length, 2);
    assert.equal(fetch.calls[0].headers.Accept, 'application/json');
    await assert.rejects(FormValidator.load('/rules/down', { fetch }), /answered 500/);
    await assert.rejects(FormValidator.load('/rules/down', { fetch }), /answered 500/);
    assert.equal(fetch.calls.filter(c => c.path === '/rules/down').length, 2, 'the failure was asked again');
    await assert.rejects(FormValidator.load('/nope', { fetch }), /answered 404/);
});
test('load: a JSON Schema or an OpenAPI component, a schemaPath, bad answers, headers', async () => {
    const schema = { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2 }, age: { type: 'integer', minimum: 0 } } };
    const fetch = t.fakeFetch({ '/schema': { json: schema }, '/openapi': { json: { components: { schemas: { Signup: schema } } } }, '/empty': { json: {} }, '/text': { text: '"just a string"' }, '/norules': { json: { rules: null, other: 1 } } });
    const r = await FormValidator.load('/schema', { fetch });
    assert.deepEqual(Object.keys(r), ['rules']);
    assert.equal(FormValidator.checkValues({ name: 'a' }, r.rules).errors.name !== undefined, true);
    const o = await FormValidator.load('/openapi', { fetch, schemaPath: 'components.schemas.Signup' });
    assert.deepEqual(o.rules.name, ['required', { type: 'minlength', min: 2 }]);
    await assert.rejects(FormValidator.load('/openapi', { fetch, schemaPath: 'components.schemas.Missing', cache: false }), /did not answer rules/);
    await assert.rejects(FormValidator.load('/empty', { fetch }), /no "rules"/);
    await assert.rejects(FormValidator.load('/text', { fetch }), /did not answer rules/);
    await assert.rejects(FormValidator.load('/norules', { fetch }), /no "rules"/);
    await FormValidator.load('/schema?x=1', { fetch, headers: { Authorization: 'Bearer t' } });
    assert.equal(fetch.calls[fetch.calls.length - 1].headers.Authorization, 'Bearer t');
    await assert.rejects(FormValidator.load('/x', { fetch: null, cache: false }).then(() => { if (typeof globalThis.fetch === 'function') throw new Error('Node has fetch: skip'); }), () => true);
    const hostile = t.fakeFetch({ '/h': { json: { components: { schemas: {} } } } });
    await assert.rejects(FormValidator.load('/h', { fetch: hostile, schemaPath: '__proto__.x' }), /did not answer rules/);
});
test('initFromUrl starts a form with the loaded rules, messages and config; your options are added', async () => {
    const form = mount('<input name="email"><input name="age">');
    const fetch = t.fakeFetch({ '/rules': { json: { rules: { email: ['required', 'email'] }, messages: { required: 'Please fill this' }, config: { errorElement: 'em' } } } });
    const inst = await FormValidator.initFromUrl('f', '/rules', { config: { validClass: 'ok' }, load: { fetch } });
    assert.equal(inst.config.errorElement, 'em');
    assert.equal(inst.config.validClass, 'ok');
    await inst.validate({ focus: false });
    assert.equal(form.querySelector('em.error').textContent, 'Please fill this');
    await assert.rejects(FormValidator.initFromUrl('f', '/gone', { load: { fetch } }), /answered 404/);
});

// ---------------------------------------------------------------- testing helpers
const FORM = '<input name="email"><input name="age"><input type="checkbox" name="terms"><label><input type="radio" name="plan" value="free"> F</label><label><input type="radio" name="plan" value="pro"> P</label>' +
    '<label><input type="checkbox" name="tag" value="a"> a</label><label><input type="checkbox" name="tag" value="b"> b</label><select name="color"><option value="">-</option><option value="r">Red</option><option value="g">Green</option></select><select name="multi" multiple><option>x</option><option>y</option></select>';
test('fill: text, checkbox (boolean and group), radio, select, multiple select, file; unknown names throw', () => {
    const form = mount(FORM + '<input type="file" name="doc">');
    const events = [];
    ['input', 'change', 'focusout'].forEach(e => form.addEventListener(e, ev => events.push(ev.type + ':' + ev.target.name)));
    t.fill(form, { email: 'a@b.co', age: 42, terms: true, plan: 'pro', tag: ['a', 'b'], color: 'g', multi: ['x', 'y'] });
    assert.deepEqual(FormValidator.checkValues({ email: form.elements.email.value }, { email: 'email' }).errors, {});
    assert.equal(form.elements.age.value, '42');
    assert.equal(form.elements.terms.checked, true);
    assert.equal(form.elements.plan[1].checked, true);
    assert.deepEqual([form.elements.tag[0].checked, form.elements.tag[1].checked], [true, true]);
    assert.equal(form.elements.color.value, 'g');
    assert.deepEqual(Array.from(form.elements.multi.selectedOptions).map(o => o.value), ['x', 'y']);
    assert.ok(events.includes('input:email') && events.includes('change:email') && events.includes('focusout:email'));
    t.fill(form, { terms: false, tag: ['b'], plan: 'free', email: '' });
    assert.equal(form.elements.terms.checked, false);
    assert.deepEqual([form.elements.tag[0].checked, form.elements.tag[1].checked], [false, true]);
    assert.equal(form.elements.email.value, '');
    const file = new File(['x'], 'a.txt');
    t.fill(form, { doc: file });
    assert.equal(form.elements.doc.files[0], file);
    assert.throws(() => t.fill(form, { nope: 1 }), /no field named "nope"/);
    assert.throws(() => t.fill('#missing', {}), /form not found/);
});
test('fillAndSubmit + expectError / expectValid on a real validator, with a debounce and a remote check', async () => {
    const form = mount('<input name="email"><input name="user">');
    const fetch = t.fakeFetch({ 'GET /free': req => ({ json: req.query.user !== 'taken' }) });
    const orig = globalThis.fetch; globalThis.fetch = fetch;
    try {
        FormValidator.init({ form, rules: { email: ['required', 'email'], user: [{ type: 'remote', url: '/free' }] } });
        const e = await t.fillAndSubmit(form, { email: 'nope', user: 'taken' });
        assert.deepEqual(Object.keys(e).sort(), ['email', 'user']);
        t.expectError(form, 'email', /valid email/i);
        t.expectError(form, 'email', 'valid email');
        t.expectError(form, 'email');
        assert.throws(() => t.expectError(form, 'email', /nothing like this/), /the error on "email" is .*expected/);
        assert.throws(() => t.expectError(form, 'age'), /expected an error on "age" but there is none.*email/s);
        t.expectNoError(form, 'age');
        assert.throws(() => t.expectNoError(form, 'email'), /expected no error/);
        t.expectInvalid(form, ['email', 'user']);
        assert.throws(() => t.expectInvalid(form, ['email']), /unexpected errors on user/);
        assert.throws(() => t.expectValid(form), /these messages show/);
        await t.fillAndSubmit(form, { email: 'a@b.co', user: 'free' });
        t.expectValid(form);
        assert.throws(() => t.expectInvalid(form), /shows none/);
        assert.ok(fetch.calls.some(c => c.query.user === 'taken'));
    } finally { globalThis.fetch = orig; }
});
test('submit works without a button, settle waits for a slow remote check', async () => {
    const form = document.body.appendChild(Object.assign(document.createElement('form'), { id: 'g' }));
    form.innerHTML = '<input name="u">';
    form.requestSubmit = form.requestSubmit || function () { this.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); };
    const fetch = t.fakeFetch({ '/slow': { delay: 120, json: false } });
    const orig = globalThis.fetch; globalThis.fetch = fetch;
    try {
        FormValidator.init({ form, rules: { u: [{ type: 'remote', url: '/slow', message: 'Taken' }] } });
        t.fill(form, { u: 'x' }, { change: false });
        const t0 = Date.now();
        const e = await t.submit(form);
        assert.ok(Date.now() - t0 >= 100, 'it waited for the answer');
        assert.equal(e.u, 'Taken');
    } finally { globalThis.fetch = orig; }
});
test('errors(): reads the messages from the page, and from a validator when there is one', async () => {
    const form = mount('<input name="a">');
    assert.deepEqual(t.errors(form), {});
    FormValidator.init({ form, rules: { a: 'required' } });
    await FormValidator.getInstance(form).validate({ focus: false });
    assert.deepEqual(t.errors('#f'), { a: 'This field is required.' });
    assert.deepEqual(t.errors(null), {});
});

// ---------------------------------------------------------------- fakeFetch
test('fakeFetch: routes by method and path, regex routes, functions, delays, aborts, 404, calls', async () => {
    const f = t.fakeFetch({
        'GET /a': { json: { ok: 1 } }, 'POST /a': { status: 201, text: 'made', headers: { 'X-Id': '7' } }, '/any': req => ({ json: { method: req.method } }),
        're:/^\\/api\\/\\d+$/': { json: 'regex' }, '/late': { delay: 200, json: 1 }, '/async': async () => ({ json: 'later' })
    });
    const a = await f('/a'); assert.equal(a.status, 200); assert.deepEqual(await a.json(), { ok: 1 }); assert.equal(a.headers.get('Content-Type'), 'application/json');
    const p = await f('/a', { method: 'post', body: 'x=1', headers: { H: '1' } }); assert.equal(p.status, 201); assert.equal(await p.text(), 'made'); assert.equal(p.headers.get('x-id'), '7');
    assert.equal((await (await f('/any', { method: 'DELETE' })).json()).method, 'DELETE');
    assert.equal(await (await f('/api/42')).json(), 'regex');
    assert.equal(await (await f('/async')).json(), 'later');
    const n = await f('/unknown'); assert.equal(n.ok, false); assert.equal(n.status, 404);
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 20);
    await assert.rejects(f('/late', { signal: ctrl.signal }), e => e.name === 'AbortError');
    const done = new AbortController(); done.abort();
    await assert.rejects(f('/a', { signal: done.signal }), e => e.name === 'AbortError');
    assert.deepEqual(f.calls.map(c => c.method + ' ' + c.path).slice(0, 3), ['GET /a', 'POST /a', 'DELETE /any']);
    assert.equal(f.calls[1].body, 'x=1');
    assert.equal(f.calls[1].headers.H, '1');
    const q = t.fakeFetch({ '/q': req => ({ json: req.query }) });
    assert.deepEqual(await (await q('/q?a=1&b=2')).json(), { a: '1', b: '2' });
    const pc = await FormValidator.precognition('/signup', { email: 'x' }, { fetch: t.fakeFetch({ 'POST /signup': { status: 422, json: { errors: { email: ['Taken'] } } } }), only: ['email'] });
    assert.deepEqual(pc.errors, { email: 'Taken' });
});
