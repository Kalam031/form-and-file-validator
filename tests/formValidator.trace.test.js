'use strict';
// Rule trace: inst.enableTrace / getTrace / onTrace / restoreTrace, config.trace, and the devtools trace section.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, FormData: w.FormData, Event: w.Event });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));
let n = 0;
function mount(html) {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}">${html}<button type="submit">Go</button></form>`;
    return document.getElementById(id);
}

test('tracing is off by default and costs nothing: getTrace() is empty', async () => {
    const form = mount('<input name="email">');
    const inst = FormValidator.init({ form, rules: { email: ['required', 'email'] } });
    await inst.validate();
    assert.deepEqual(inst.getTrace(), []);
});

test('each check records its rules in order with the result, trigger, code and message', async () => {
    const form = mount('<input name="email" value="nope"><input name="name" value="">');
    const inst = FormValidator.init({ form, rules: { email: ['required', 'email'], name: { required: true, minlength: 3 } }, config: { trace: true } });
    await inst.validate({ submit: true });
    const t = inst.getTrace();
    const email = t.find(e => e.field === 'email'), name = t.find(e => e.field === 'name');
    assert.deepEqual(email.steps.map(s => [s.rule, s.result]), [['required', 'pass'], ['email', 'fail']]);
    assert.equal(email.valid, false);
    assert.equal(email.code, 'email');
    assert.match(email.message, /email/i);
    assert.equal(email.trigger, 'submit');
    assert.deepEqual(name.steps.map(s => [s.rule, s.result]), [['required', 'fail']], 'stops at the first failing rule');
    assert.equal(typeof email.steps[0].ms, 'number');
    assert.equal(email.value, undefined, 'values are not kept unless asked');
    form.elements.email.value = 'a@b.co';
    await inst.validate();
    const last = inst.getTrace().filter(e => e.field === 'email').pop();
    assert.equal(last.valid, true);
    assert.equal(last.trigger, 'api');
    assert.ok(last.seq > email.seq);
});

test('skipped rules say why: empty optional field, when() false', async () => {
    const form = mount('<input name="a" value=""><input name="b" value="x">');
    const inst = FormValidator.init({ form, rules: { a: ['email'], b: { minlength: { value: 5, when: () => false } } } });
    inst.enableTrace();
    await inst.validate();
    const by = Object.fromEntries(inst.getTrace().map(e => [e.field, e]));
    assert.equal(by.a.steps[0].result, 'skipped');
    assert.match(by.a.steps[0].why, /empty/);
});

test('values: opt-in, passwords are always hidden; max keeps the last N; clearTrace; disableTrace; onTrace', async () => {
    const form = mount('<input name="user" value="ada"><input name="pw" type="password" value="hunter2">');
    const inst = FormValidator.init({ form, rules: { user: ['required'], pw: ['required'] } });
    inst.enableTrace({ values: true, max: 3 });
    const seen = [];
    const off = inst.onTrace(e => seen.push(e.field));
    for (let i = 0; i < 4; i++) await inst.validate();
    const t = inst.getTrace();
    assert.equal(t.length, 3, 'only the last 3 are kept');
    assert.equal(t.find(e => e.field === 'user').value, 'ada');
    assert.equal(t.find(e => e.field === 'pw').value, '\u2022\u2022\u2022');
    assert.ok(!JSON.stringify(t).includes('hunter2'));
    assert.ok(seen.length >= 8);
    off();
    const count = seen.length;
    await inst.validate();
    assert.equal(seen.length, count, 'unsubscribed');
    inst.clearTrace();
    assert.equal(inst.getTrace().length, 0);
    inst.disableTrace();
    await inst.validate();
    assert.equal(inst.getTrace().length, 0);
});

test('async rules: stale runs are marked and typing triggers are recorded', async () => {
    const form = mount('<input name="code" value="a">');
    FormValidator.registerRule && FormValidator.registerRule('slowok', async v => { await settle(20); return true; });
    const inst = FormValidator.init({ form, rules: { code: ['slowok'] }, config: { trace: true, validateOn: ['input'], debounce: 0 } });
    form.elements.code.value = 'ab'; fire(form.elements.code, 'input');
    await settle(80);
    const t = inst.getTrace();
    assert.ok(t.length >= 1);
    assert.ok(t.some(e => e.steps.some(s => s.rule === 'slowok' && s.result === 'pass')));
});

test('time travel: with snapshots, restoreTrace puts the form back and the check runs again', async () => {
    const form = mount('<input name="email" value="first@x.co"><input type="checkbox" name="tos" value="y" checked>');
    const inst = FormValidator.init({ form, rules: { email: ['required', 'email'] }, config: { trace: { snapshots: true } } });
    await inst.validate();
    const early = inst.getTrace().find(e => e.field === 'email');
    assert.equal(early.snapshot.email, 'first@x.co');
    form.elements.email.value = 'broken'; form.elements.tos.checked = false;
    await inst.validate();
    assert.equal(inst.getTrace().filter(e => e.field === 'email').pop().valid, false);
    const restored = await inst.restoreTrace(early.seq);
    assert.equal(restored, 2);
    assert.equal(form.elements.email.value, 'first@x.co');
    assert.equal(form.elements.tos.checked, true);
    assert.equal(await inst.restoreTrace(99999), 0, 'unknown entry');
});

test('devtools({ trace: true }) lists the checks, shows the detail on click, escapes hostile text, and stops with destroy()', async () => {
    const form = mount('<input name="email" value="&lt;img src=x onerror=alert(1)&gt;">');
    const inst = FormValidator.init({ form, rules: { email: ['required', 'email'] } });
    const dt = FormValidator.devtools(form, { trace: true });
    await inst.validate();
    await settle();
    assert.match(dt.element.textContent, /Trace \(\d+\)/);
    assert.match(dt.element.textContent, /email\[?.*email/);
    const row = Array.from(dt.element.querySelectorAll('[role="button"]'))[0];
    row.click();
    assert.match(dt.element.textContent, /required: pass/);
    assert.match(dt.element.textContent, /email: fail/);
    assert.ok(Array.from(dt.element.querySelectorAll('button')).some(b => /restore/.test(b.textContent)), 'snapshots on: a restore button');
    assert.equal(dt.element.querySelector('img'), null);
    dt.destroy();
    await inst.validate();
    assert.equal(document.body.contains(dt.element), false);
});
