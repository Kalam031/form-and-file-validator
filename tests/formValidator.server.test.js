'use strict';
// serverErrors() (any backend's validation answer -> field messages), precognition() / validateOnServer() / watchServer() (ask the real endpoint),
// action() (React 19 useActionState / Server Actions) and the smarter setErrors() name matching.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
let n = 0;
function mount(html) {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}">${html}</form>`;
    return document.getElementById(id);
}
const errText = (form, name) => { const e = form.querySelector(`.error[data-error-for="${name}"]`); return e ? e.textContent : null; };
const se = (b, o) => FormValidator.serverErrors(b, o);

// ---------------------------------------------------------------- serverErrors
test('problem+json / ASP.NET ValidationProblemDetails: field lists, form-level key, indexes', () => {
    const r = se({ type: 'https://x/validation', title: 'One or more validation errors occurred.', status: 400, errors: { Email: ['Taken', 'Invalid'], 'Items[0].Name': ['Required'], '': ['Form wide'] } });
    assert.equal(r.format, 'problem+json');
    assert.deepEqual(r.errors, { Email: 'Taken', 'Items[0].Name': 'Required' });
    assert.deepEqual(r.all.Email, ['Taken', 'Invalid']);
    assert.deepEqual(r.form, ['Form wide']);
});
test('problem+json without field errors: detail (else title) is the form message', () => {
    assert.deepEqual(se({ type: 'about:blank', title: 'Conflict', status: 409, detail: 'Already submitted' }).form, ['Already submitted']);
    assert.deepEqual(se({ title: 'Forbidden', status: 403 }).form, ['Forbidden']);
});
test('classic ASP.NET ModelState: model. prefix removed, "" is form-level', () => {
    const r = se({ Message: 'The request is invalid.', ModelState: { 'model.Email': ['Bad'], 'Items[1].Qty': ['Low'], '': ['General'] } });
    assert.equal(r.format, 'aspnet-modelstate');
    assert.deepEqual(r.errors, { Email: 'Bad', 'Items[1].Qty': 'Low' });
    assert.deepEqual(r.form, ['General']);
});
test('Laravel / Rails: dotted paths become indexed names', () => {
    const r = se({ message: 'The given data was invalid.', errors: { email: ['The email field is required.'], 'items.0.name': ['Required'], 'user.address.zip': ['Bad'] } });
    assert.deepEqual(r.errors, { email: 'The email field is required.', 'items[0].name': 'Required', 'user.address.zip': 'Bad' });
    assert.deepEqual(r.form, []);   // the generic top-level message is dropped when fields are named
});
test('Django REST framework: lists, non_field_errors, nested serializers, list serializers', () => {
    const r = se({ email: ['Enter a valid email.'], non_field_errors: ['Passwords differ'], profile: { age: ['Too young'] }, items: [{}, { qty: ['Min 1'] }], detail: 'Hint' });
    assert.deepEqual(r.errors, { email: 'Enter a valid email.', 'profile.age': 'Too young', 'items[1].qty': 'Min 1' });
    assert.deepEqual(r.form, ['Passwords differ', 'Hint']);
});
test('FastAPI / Pydantic: loc path without the body/query prefix', () => {
    const r = se({ detail: [{ loc: ['body', 'user', 'emails', 0], msg: 'value is not a valid email address', type: 'value_error.email' }, { loc: ['query', 'page'], msg: 'bad page' }] });
    assert.equal(r.format, 'fastapi');
    assert.deepEqual(r.errors, { 'user.emails[0]': 'value is not a valid email address', page: 'bad page' });
});
test('Zod (issues, flatten()), Standard Schema issues (path items with key)', () => {
    assert.deepEqual(se({ issues: [{ path: ['a', 0, 'b'], message: 'm' }, { path: [], message: 'root' }] }).errors, { 'a[0].b': 'm' });
    assert.deepEqual(se({ issues: [{ path: [], message: 'root' }] }).form, ['root']);
    assert.deepEqual(se({ fieldErrors: { a: ['x'] }, formErrors: ['f'] }), { format: 'zod', errors: { a: 'x' }, all: { a: ['x'] }, form: ['f'] });
    assert.deepEqual(se([{ message: 'no', path: [{ key: 'user' }, { key: 'name' }] }]).errors, { 'user.name': 'no' });
});
test('JSON:API, express-validator (v6 param, v7 path), Ajv instancePath', () => {
    assert.deepEqual(se({ errors: [{ source: { pointer: '/data/attributes/email' }, detail: 'Bad' }, { source: { pointer: '/data/relationships/team/0' }, detail: 'Gone' }] }).errors, { email: 'Bad', 'team[0]': 'Gone' });
    assert.deepEqual(se({ errors: [{ param: 'email', msg: 'Invalid', location: 'body' }] }).errors, { email: 'Invalid' });
    assert.deepEqual(se({ errors: [{ type: 'field', path: 'name', msg: 'Short' }] }).errors, { name: 'Short' });
    assert.deepEqual(se([{ instancePath: '/items/2/qty', message: 'must be >= 1' }]).errors, { 'items[2].qty': 'must be >= 1' });
});
test('a body that names no field is a form message, and a form with a field called "message" still works', () => {
    assert.deepEqual(se({ message: 'Server error' }).form, ['Server error']);
    assert.deepEqual(se({ message: ['Too short'], email: ['x'] }).errors, { message: 'Too short', email: 'x' });
});
test('input shapes: JSON text, arrays, objects with message, numbers, nulls, garbage never throw', () => {
    assert.deepEqual(se('{"errors":{"a":["x"]}}').errors, { a: 'x' });
    assert.deepEqual(se({ errors: { a: [{ message: 'obj' }, 5, null, '', '  '] } }).all, { a: ['obj', '5'] });
    for (const bad of [null, undefined, 42, true, 'not json', '', [], {}, [null, 3, 'x'], { errors: null }, { errors: 'x' }]) {
        const r = se(bad);
        assert.deepEqual(Object.keys(r).sort(), ['all', 'errors', 'form', 'format']);
    }
    assert.deepEqual(se([null, 3, 'text']).form, ['text']);
});
test('hostile keys are dropped, cyclic and very deep bodies do not hang or throw', () => {
    const r = se(JSON.parse('{"errors":{"__proto__":["x"],"a.__proto__.b":["y"],"constructor.prototype":["z"],"ok":["fine"]}}'));
    assert.deepEqual(r.errors, { ok: 'fine' });
    assert.equal({}.x, undefined);
    const cyc = { a: {} }; cyc.a.b = cyc;
    assert.doesNotThrow(() => se(cyc));
    let deep = { leaf: ['x'] }; for (let i = 0; i < 5000; i++) deep = { k: deep };
    assert.doesNotThrow(() => se(deep));
    const big = {}; for (let i = 0; i < 50000; i++) big['f' + i] = ['m'];
    assert.ok(Object.keys(se(big).all).length <= 2001);
});
test('format can be forced', () => {
    assert.equal(se({ errors: { a: ['x'] } }, { format: 'laravel' }).format, 'laravel');
});

// ---------------------------------------------------------------- setErrors / setServerErrors on a form
test('setErrors matches the same path written another way, and still exact then case-insensitive', () => {
    const form = mount('<input name="items[0].qty"><input name="items[1][name]"><input name="Email"><input name="user.first">');
    FormValidator.init({ form, rules: {} });
    const inst = FormValidator.getInstance(form);
    const missed = inst.setErrors({ 'items.0.qty': 'A', 'items[1].name': 'B', email: 'C', 'user[first]': 'D', nope: 'E' });
    assert.deepEqual(missed, ['nope']);
    assert.equal(errText(form, 'items[0].qty'), 'A');
    assert.equal(errText(form, 'items[1][name]'), 'B');
    assert.equal(errText(form, 'Email'), 'C');
    assert.equal(errText(form, 'user.first'), 'D');
});
test('setServerErrors shows field errors, returns form messages and missed names, clear:true drops older server errors', () => {
    const form = mount('<input name="email"><input name="name">');
    FormValidator.init({ form, rules: {} });
    const inst = FormValidator.getInstance(form);
    const r = inst.setServerErrors({ errors: { email: ['Taken'], ghost: ['x'], '': ['Try later'] } });
    assert.equal(errText(form, 'email'), 'Taken');
    assert.deepEqual(r.missed, ['ghost']);
    assert.deepEqual(r.form, ['Try later']);
    inst.setServerErrors({ errors: { name: ['Short'] } }, { clear: true });
    assert.equal(errText(form, 'email'), null);
    assert.equal(errText(form, 'name'), 'Short');
    inst.clearServerErrors();
    assert.equal(errText(form, 'name'), null);
});

// ---------------------------------------------------------------- precognition
const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => { if (body === undefined) throw new Error('no body'); return body; } });
const spy = fn => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return fn(url, init, calls.length); }; f.calls = calls; return f; };

test('precognition: sends the Precognition headers and JSON, 204 is valid', async () => {
    const f = spy(() => reply(204));
    const r = await FormValidator.precognition('/signup', { email: 'a@b.co', n: 1, t: null, nested: { x: ['p', 'q'] } }, { fetch: f, only: ['email'], headers: { 'X-CSRF': 't' } });
    assert.equal(r.valid, true);
    assert.equal(r.status, 204);
    const { init } = f.calls[0];
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Precognition, 'true');
    assert.equal(init.headers['Precognition-Validate-Only'], 'email');
    assert.equal(init.headers['X-CSRF'], 't');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), { email: 'a@b.co', n: 1, t: null, nested: { x: ['p', 'q'] } });
});
test('precognition: 422 gives field errors, filtered to the asked fields; asked fields that pass are valid', async () => {
    const body = { message: 'x', errors: { email: ['Taken'], name: ['Required'] } };
    const a = await FormValidator.precognition('/x', {}, { fetch: spy(() => reply(422, body)), only: ['email'] });
    assert.equal(a.valid, false);
    assert.deepEqual(a.errors, { email: 'Taken' });
    assert.deepEqual(Object.keys(a.all), ['email']);
    const b = await FormValidator.precognition('/x', {}, { fetch: spy(() => reply(422, body)), only: ['phone'] });
    assert.equal(b.valid, true);
    assert.deepEqual(b.errors, {});
    const c = await FormValidator.precognition('/x', {}, { fetch: spy(() => reply(422, body)) });
    assert.deepEqual(c.errors, { email: 'Taken', name: 'Required' });
    assert.equal(c.valid, false);
});
test('precognition: GET puts values in the query, form and multipart encodings, files', async () => {
    const g = spy(() => reply(204));
    await FormValidator.precognition('/c?x=1', { a: 'b c', n: [1, 2] }, { fetch: g, method: 'GET' });
    assert.equal(g.calls[0].url, '/c?x=1&a=b+c&n%5B0%5D=1&n%5B1%5D=2');
    assert.equal(g.calls[0].init.body, undefined);
    const f = spy(() => reply(204));
    await FormValidator.precognition('/c', { a: 'b c', u: { v: 'w' } }, { fetch: f, encoding: 'form' });
    assert.equal(f.calls[0].init.body, 'a=b+c&u.v=w');
    assert.match(f.calls[0].init.headers['Content-Type'], /x-www-form-urlencoded/);
    const m = spy(() => reply(204));
    await FormValidator.precognition('/c', { a: '1', file: new File(['x'], 'a.txt') }, { fetch: m });
    assert.ok(m.calls[0].init.body instanceof FormData);
    assert.equal(m.calls[0].init.body.get('a'), '1');
    assert.equal(m.calls[0].init.body.get('file').name, 'a.txt');
    assert.equal(m.calls[0].init.headers['Content-Type'], undefined, 'the boundary header is the browser\'s job');
});
test('precognition: network error, 500, 422 without readable errors, timeout and abort give valid null and never throw', async () => {
    const net = await FormValidator.precognition('/x', {}, { fetch: async () => { throw new TypeError('Failed to fetch'); } });
    assert.equal(net.valid, null); assert.match(net.error.message, /Failed to fetch/);
    const five = await FormValidator.precognition('/x', {}, { fetch: spy(() => reply(500, { message: 'boom' })) });
    assert.equal(five.valid, null); assert.match(five.error.message, /HTTP 500/);
    const bad = await FormValidator.precognition('/x', {}, { fetch: spy(() => reply(422)) });
    assert.equal(bad.valid, null);
    const hang = (url, init) => new Promise((res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const to = await FormValidator.precognition('/x', {}, { fetch: hang, timeout: 20 });
    assert.equal(to.valid, null); assert.match(to.error.message, /timed out/);
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 10);
    const ab = await FormValidator.precognition('/x', {}, { fetch: hang, signal: ctrl.signal });
    assert.equal(ab.aborted, true); assert.equal(ab.valid, null);
    const none = await FormValidator.precognition('', {}, { fetch: spy(() => reply(204)) });
    assert.equal(none.valid, null);
});

// ---------------------------------------------------------------- validateOnServer / watchServer on a form
test('validateOnServer shows server errors only for the asked fields and clears them when the server is happy', async () => {
    const form = mount('<input name="email" value="a@b.co"><input name="name" value="">');
    FormValidator.init({ form, rules: {} });
    const inst = FormValidator.getInstance(form);
    let answer = reply(422, { errors: { email: ['Taken'], name: ['Required'] } });
    const f = spy(() => answer);
    let r = await inst.validateOnServer('/check', { fetch: f, only: ['email'] });
    assert.equal(r.valid, false);
    assert.equal(errText(form, 'email'), 'Taken');
    assert.equal(errText(form, 'name'), null, 'not asked, so not shown');
    assert.equal(JSON.parse(f.calls[0].init.body).email, 'a@b.co');
    answer = reply(204);
    r = await inst.validateOnServer({ url: '/check', fetch: f, only: 'email' });
    assert.equal(r.valid, true);
    assert.equal(errText(form, 'email'), null);
});
test('validateOnServer: a failed check changes nothing, and a newer call cancels the older one', async () => {
    const form = mount('<input name="email" value="a@b.co">');
    FormValidator.init({ form, rules: {} });
    const inst = FormValidator.getInstance(form);
    inst.setServerErrors({ errors: { email: ['Old'] } });
    const down = await inst.validateOnServer('/check', { fetch: async () => { throw new Error('offline'); } });
    assert.equal(down.valid, null);
    assert.equal(errText(form, 'email'), 'Old');
    const slow = (url, init) => new Promise((res, rej) => { init.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))); });
    const first = inst.validateOnServer('/check', { fetch: slow });
    const second = inst.validateOnServer('/check', { fetch: spy(() => reply(422, { errors: { email: ['New'] } })) });
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.aborted, true);
    assert.equal(b.valid, false);
    assert.equal(errText(form, 'email'), 'New');
});
test('watchServer checks one field after it is left, skips empty, browser-invalid, password and excluded fields, and can be stopped', async () => {
    const form = mount('<input name="email"><input name="nick"><input type="password" name="pw"><input name="skip">');
    FormValidator.init({ form, rules: { email: ['required', 'email'] } });
    const inst = FormValidator.getInstance(form);
    const f = spy(() => reply(422, { errors: { nick: ['Taken'] } }));
    const stop = inst.watchServer('/check', { fetch: f, delay: 10, exclude: ['skip'] });
    const leave = (name, value) => { const el = form.elements[name]; el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
    leave('nick', 'bob'); await settle(60);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].init.headers['Precognition-Validate-Only'], 'nick');
    assert.equal(errText(form, 'nick'), 'Taken');
    leave('nick', ''); leave('pw', 'secret'); leave('skip', 'x'); await settle(60);
    assert.equal(f.calls.length, 1, 'empty, password and excluded fields are not sent');
    leave('email', 'not-an-email'); await settle(80);
    assert.equal(f.calls.length, 1, 'a field the browser rules reject is not sent');
    stop();
    leave('nick', 'again'); await settle(60);
    assert.equal(f.calls.length, 1, 'stopped');
});

// ---------------------------------------------------------------- action
const fd = obj => { const f = new FormData(); Object.keys(obj).forEach(k => [].concat(obj[k]).forEach(v => f.append(k, v))); return f; };
const rules = { email: ['required', 'email'], password: { required: true, pwcheck: { minLength: 8 } }, nick: { minlength: 3 } };

test('action: invalid input returns errors and the typed values (no passwords) without calling the server', async () => {
    let called = 0;
    const act = FormValidator.action(rules, async () => { called++; });
    const s = await act(act.initialState, fd({ email: 'nope', password: 'x', nick: 'ab' }));
    assert.equal(s.ok, false);
    assert.equal(called, 0);
    assert.ok(s.errors.email && s.errors.password && s.errors.nick);
    assert.deepEqual(s.values, { email: 'nope', nick: 'ab' });
    assert.deepEqual(act.initialState, { ok: false, values: {}, errors: {}, form: [], result: undefined });
});
test('action: valid input calls the server with trimmed, validated values and the FormData; its return is result', async () => {
    let seen;
    const act = FormValidator.action(rules, async (v, formData, prev) => { seen = { v, formData, prev }; return { id: 7 }; });
    const input = fd({ email: ' a@b.co ', password: 'Secret123', nick: 'bobby', extra: 'dropped' });
    const s = await act({ ok: false }, input);
    assert.equal(s.ok, true);
    assert.deepEqual(s.result, { id: 7 });
    assert.deepEqual(seen.v, { email: 'a@b.co', password: 'Secret123', nick: 'bobby' });
    assert.equal(seen.formData, input);
    assert.deepEqual(seen.prev, { ok: false });
    assert.deepEqual(s.values, { email: ' a@b.co ', nick: 'bobby' });
});
test('action: server errors in any shape come back as field and form errors; thrown errors are not swallowed', async () => {
    const good = fd({ email: 'a@b.co', password: 'Secret123' });
    let act = FormValidator.action(rules, async () => ({ errors: { email: 'Taken' } }));
    let s = await act(null, good);
    assert.deepEqual([s.ok, s.errors, s.form], [false, { email: 'Taken' }, []]);
    act = FormValidator.action(rules, async () => ({ message: 'x', errors: { email: ['Taken'], '': ['Try later'] } }));
    s = await act(null, good);
    assert.deepEqual([s.ok, s.errors, s.form], [false, { email: 'Taken' }, ['Try later']]);
    act = FormValidator.action(rules, async () => ({ issues: [{ path: ['email'], message: 'Zod says no' }] }));
    assert.equal((await act(null, good)).errors.email, 'Zod says no');
    act = FormValidator.action(rules, async () => ({ errors: {} }));
    assert.equal((await act(null, good)).ok, true);
    act = FormValidator.action(rules, async () => { throw new Error('db down'); });
    await assert.rejects(() => act(null, good), /db down/);
});
test('action: repeated fields, plain objects, an existing schema, missing serverFn, omitValues', async () => {
    const act = FormValidator.action({ tags: { required: true } }, async v => v);
    const s = await act(null, fd({ tags: ['a', 'b'] }));
    assert.deepEqual(s.result, { tags: 'a,b' });
    const o = await FormValidator.action({ email: 'required' })(null, { email: 'x' });
    assert.equal(o.ok, true);
    const sch = FormValidator.schema({ email: ['required', 'email'] });
    assert.equal((await FormValidator.action(sch)(null, fd({ email: 'bad' }))).ok, false);
    const omit = await FormValidator.action({ email: 'required', secret: 'required' }, null, { omitValues: ['secret'] })(null, fd({ email: 'a', secret: 'b' }));
    assert.deepEqual(omit.values, { email: 'a' });
    assert.equal((await FormValidator.action({ email: 'required' }, null)(null, null)).ok, false);
});
