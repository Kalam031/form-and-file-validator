// Qwik bindings: the sample component is compiled by Qwik's real optimizer and rendered on the server by Qwik's real renderToString (the import must be SSR safe),
// and fvQwik / fvQwikCheck are exercised on their own in jsdom. The browser run (Qwik resuming the visible task in Chromium, Firefox, WebKit) is in browser-tests/browser.spec.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './helpers/shim.js';
import { JSDOM } from 'jsdom';

const dir = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-qwik-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('Qwik: the sample component compiles with the real optimizer and renders on the server without touching the DOM', { timeout: 120000 }, async () => {
    execFileSync(process.execPath, [path.join(dir, 'qwik', 'build.mjs'), 'ssr', tmp], { stdio: 'pipe' });
    const mod = await import(pathToFileURL(path.join(tmp, 'ssr.mjs')).href);
    const html = await mod.html();
    assert.match(html, /<form[^>]*id="signup"/);
    assert.match(html, /on-document:qinit/, 'the visible task is registered for the browser');
    assert.match(html, /id="state">(<!--t=[0-9]+-->)?unchecked/);
    assert.doesNotMatch(html, /is-invalid|aria-invalid/, 'nothing is validated on the server');
});

// ---------------------------------------------------------------- fvQwik on its own
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, Node: w.Node, HTMLElement: w.HTMLElement, Element: w.Element, Event: w.Event, CustomEvent: w.CustomEvent, FormData: w.FormData, HTMLInputElement: w.HTMLInputElement, Text: w.Text, DocumentFragment: w.DocumentFragment });
const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const mount = html => { const root = document.getElementById('root'); root.innerHTML = '<form>' + html + '<button type="submit">Go</button></form>'; return root.firstChild; };
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));

test('fvQwik: plain-data errors for signals, onValid, live fixing, submit handling, server errors, destroy', async () => {
    const { fvQwik } = await import('form-and-file-validator/qwik');
    const form = mount('<input name="email"><input name="name">');
    const seen = [], valids = [];
    const fv = fvQwik(form, { rules: { email: ['required', 'email'], name: { required: true, minlength: 3 } }, onErrors: l => seen.push(l.map(e => e.name + ':' + e.code)), onValid: v => valids.push(v) });
    assert.equal(fv.valid(), null);
    assert.deepEqual(fv.errors(), []);
    assert.equal(await fv.validate(), false);
    assert.deepEqual(fv.errors().map(e => e.name).sort(), ['email', 'name']);
    assert.deepEqual(Object.keys(fv.errors()[0]).sort(), ['code', 'message', 'name'], 'no DOM nodes: a Qwik signal can hold it');
    JSON.stringify(fv.errors());
    assert.equal(fv.valid(), false);
    assert.deepEqual(valids.slice(-1), [false]);

    form.elements.email.value = 'a@b.co'; fire(form.elements.email, 'input'); fire(form.elements.email, 'change');
    await settle();
    assert.deepEqual(fv.errors().map(e => e.name), ['name'], 'a fixed field leaves the list');
    assert.ok(seen.length > 1);

    form.elements.name.value = 'Bob';
    const sent = [];
    const result = await fv.handleSubmit(async values => { sent.push(values); return { errors: { email: 'Already registered' } }; })(new w.Event('submit', { cancelable: true }));
    assert.deepEqual(sent, [{ email: 'a@b.co', name: 'Bob' }]);
    assert.equal(result.valid, false, 'the answer of the server counts as invalid');
    await settle();
    assert.match(fv.errors().map(e => e.message).join(), /Already registered/);

    const r = fv.setServerErrors({ type: 'about:blank', errors: { name: ['Too short on the server'] } });
    assert.ok(r);
    assert.match(fv.errors().map(e => e.message).join(), /Too short on the server/);
    assert.deepEqual(fv.getValues(), { email: 'a@b.co', name: 'Bob' });
    fv.reset();
    assert.deepEqual(fv.errors(), []);
    assert.equal(fv.valid(), null);

    const before = seen.length;
    fv.destroy();
    form.elements.name.value = ''; fire(form.elements.name, 'input');
    await settle();
    assert.equal(seen.length, before, 'no callbacks after destroy');
    assert.throws(() => fvQwik(null, {}), /form element is missing/);
});

test('fvQwik: Precognition-style validateOnServer fills the errors from the endpoint', async () => {
    const { fvQwik } = await import('form-and-file-validator/qwik');
    const form = mount('<input name="email" value="a@b.co">');
    const fv = fvQwik(form, { rules: { email: ['required', 'email'] } });
    const calls = [];
    const fetchStub = async (url, init) => { calls.push([String(url), init && init.method]); return { ok: false, status: 422, headers: { get: () => 'application/json' }, json: async () => ({ errors: { email: ['Taken'] } }), text: async () => '' }; };
    const r = await fv.validateOnServer('/check', { fetch: fetchStub });
    assert.equal(r.valid, false);
    assert.equal(calls.length, 1);
    assert.match(fv.errors().map(e => e.message).join(), /Taken/);
    fv.destroy();
});

test('fvQwikCheck: server side, with a plain object, FormData and URLSearchParams', async () => {
    const { fvQwikCheck } = await import('form-and-file-validator/qwik');
    const rules = { email: ['required', 'email'], age: { integer: true, range: [18, 99] } };
    const bad = fvQwikCheck(rules, { email: 'nope', age: '17' });
    assert.equal(bad.ok, false);
    assert.deepEqual(Object.keys(bad.errors).sort(), ['age', 'email']);
    assert.equal(bad.details.email.rule, 'email');
    const good = fvQwikCheck(rules, new URLSearchParams('email=a%40b.co&age=30'), { coerce: true });
    assert.equal(good.ok, true);
    assert.deepEqual(good.values, { email: 'a@b.co', age: 30 });
    const fd = new w.FormData(); fd.append('email', 'a@b.co'); fd.append('age', '5');
    assert.deepEqual(Object.keys(fvQwikCheck(rules, fd).errors), ['age']);
});
