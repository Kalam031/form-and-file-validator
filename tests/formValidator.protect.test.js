'use strict';
// antiBot (honeypot, minimum time), idempotency keys, disableOnSubmit, drafts and leaveWarning.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/page' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, FormData: w.FormData, Event: w.Event });
for (const k of ['sessionStorage', 'localStorage']) Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
globalThis.location = w.location;
globalThis.addEventListener = (...a) => w.addEventListener(...a);
globalThis.removeEventListener = (...a) => w.removeEventListener(...a);
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));
let n = 0;
function mount(html, id) {
    const fid = id || 'f' + (++n);
    document.body.innerHTML = `<form id="${fid}">${html}<button type="submit" id="go">Go</button></form>`;
    return document.getElementById(fid);
}
const ok = { preventDefault() {} };

// ---------------------------------------------------------------- antiBot
test('honeypot: a hidden trap field is added, kept out of the values, and removed with the validator', async () => {
    const form = mount('<input name="email" value="a@b.co">');
    const inst = FormValidator.init({ form, rules: {}, config: { antiBot: true } });
    const trap = form.querySelector('[data-fv-trap]');
    assert.ok(trap);
    assert.equal(trap.name, 'website_url');
    assert.equal(trap.tabIndex, -1);
    assert.equal(trap.getAttribute('autocomplete'), 'off');
    assert.equal(trap.closest('[aria-hidden=true]') !== null, true);
    assert.match(trap.closest('div').style.cssText, /left: -10000px/);
    assert.deepEqual(inst.getValues(), { email: 'a@b.co' });
    assert.equal(inst.botReason(), null);
    trap.value = 'http://spam.example';
    assert.equal(inst.botReason(), 'honeypot');
    inst.destroy();
    assert.equal(form.querySelector('[data-fv-trap]'), null);
});
test('a bot submit goes nowhere: no handler, no message, onBot and fv:bot, handleSubmit says bot', async () => {
    const form = mount('<input name="email" value="a@b.co">');
    const reasons = [], events = [];
    form.addEventListener('fv:bot', e => events.push(e.detail.reason));
    let called = 0;
    const inst = FormValidator.init({ form, rules: { email: 'required' }, config: { antiBot: { onBot: r => reasons.push(r) }, onSubmit: () => { called++; } } });
    form.querySelector('[data-fv-trap]').value = 'spam';
    form.querySelector('#go').click(); await settle(30);
    assert.equal(called, 0);
    assert.deepEqual(reasons, ['honeypot']);
    assert.deepEqual(events, ['honeypot']);
    assert.equal(form.querySelectorAll('.error').length, 0);
    const r = await inst.handleSubmit(() => { called++; })(ok);
    assert.deepEqual([r.valid, r.bot, r.reason], [false, true, 'honeypot']);
    assert.equal(called, 0);
    form.querySelector('[data-fv-trap]').value = '';
    form.querySelector('#go').click(); await settle(30);
    assert.equal(called, 1, 'a human gets through');
});
test('honeypot name, honeypot: false, and a bad name falls back', () => {
    let form = mount('<input name="a">');
    FormValidator.init({ form, rules: {}, config: { antiBot: { honeypot: 'company_site' } } });
    assert.ok(form.querySelector('input[name=company_site][data-fv-trap]'));
    form = mount('<input name="a">');
    FormValidator.init({ form, rules: {}, config: { antiBot: { honeypot: false, minTime: 10 } } });
    assert.equal(form.querySelector('[data-fv-trap]'), null);
    form = mount('<input name="a">');
    FormValidator.init({ form, rules: {}, config: { antiBot: { honeypot: 'bad name!' } } });
    assert.ok(form.querySelector('input[name=website_url]'));
});
test('minTime: a submit that is too fast is a bot, a later one is fine; the timestamp field and reset', async () => {
    const form = mount('<input name="a" value="x">');
    const inst = FormValidator.init({ form, rules: {}, config: { antiBot: { honeypot: false, minTime: 80, timestampField: '_fv_t' } } });
    const stamp = form.querySelector('input[name=_fv_t]');
    assert.equal(stamp.type, 'hidden');
    assert.ok(Math.abs(Number(stamp.value) - Date.now()) < 2000);
    assert.deepEqual(inst.getValues(), { a: 'x' }, 'the stamp is not a form value');
    assert.equal(inst.botReason(), 'too-fast');
    await settle(100);
    assert.equal(inst.botReason(), null);
    inst.resetForm();
    assert.equal(inst.botReason(), 'too-fast', 'the clock starts again');
});
test('isBotSubmission: the server side', () => {
    const f = FormValidator.isBotSubmission;
    assert.deepEqual(f({ email: 'a@b.co' }), { bot: false, reason: null });
    assert.deepEqual(f({ website_url: 'x' }), { bot: true, reason: 'honeypot' });
    assert.deepEqual(f({ website_url: '   ' }), { bot: false, reason: null });
    assert.deepEqual(f({ other: 'x' }, { honeypot: 'other' }), { bot: true, reason: 'honeypot' });
    assert.deepEqual(f({ website_url: 'x' }, { honeypot: false }), { bot: false, reason: null });
    assert.deepEqual(f({ _fv_t: '1000' }, { timestampField: '_fv_t', minTimeMs: 2000, now: 2500 }), { bot: true, reason: 'too-fast' });
    assert.deepEqual(f({ _fv_t: '1000' }, { timestampField: '_fv_t', minTimeMs: 2000, now: 4000 }), { bot: false, reason: null });
    assert.deepEqual(f({ _fv_t: 'junk' }, { timestampField: '_fv_t', minTimeMs: 2000 }), { bot: false, reason: null });
    assert.deepEqual(f(null), { bot: false, reason: null });
});

// ---------------------------------------------------------------- idempotency
test('idempotency key: the same for retries, new after a success; a hidden field, headers, off by default', async () => {
    const form = mount('<input name="email" value="a@b.co">');
    assert.equal(FormValidator.init({ form, rules: {} }).idempotencyKey(), null);
    const inst = FormValidator.init({ form, rules: {}, config: { idempotencyKey: true } });
    const k1 = inst.idempotencyKey();
    assert.match(k1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const hidden = form.querySelector('input[name=_idempotency_key]');
    assert.equal(hidden.value, k1);
    assert.equal(inst.idempotencyKey(), k1);
    assert.deepEqual(inst.idempotencyHeaders(), { 'Idempotency-Key': k1 });
    assert.deepEqual(inst.getValues(), { email: 'a@b.co' });
    const seen = [];
    let fail = true;
    const submit = inst.handleSubmit(async (values, e, i) => { seen.push(i.idempotencyKey()); return fail ? { errors: { email: 'Server says no' } } : { id: 1 }; });
    await submit(ok);
    assert.equal(inst.idempotencyKey(), k1, 'a failed attempt keeps the key: a retry is the same request');
    await submit(ok);
    fail = false;
    await submit(ok);
    assert.deepEqual(seen, [k1, k1, k1]);
    const k2 = inst.idempotencyKey();
    assert.notEqual(k2, k1, 'a success rotates it');
    assert.equal(hidden.value, k2);
    inst.resetForm();
    assert.notEqual(inst.idempotencyKey(), k2);
    inst.destroy();
    assert.equal(form.querySelector('input[name=_idempotency_key]'), null);
});
test('idempotency key: custom field and header, and a UUID without crypto.randomUUID', () => {
    const form = mount('<input name="a">');
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    try {
        const inst = FormValidator.init({ form, rules: {}, config: { idempotencyKey: { field: 'idem', header: 'X-Request-Id' } } });
        assert.match(inst.idempotencyKey(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        assert.ok(form.querySelector('input[name=idem]'));
        assert.deepEqual(Object.keys(inst.idempotencyHeaders()), ['X-Request-Id']);
    } finally { if (original) Object.defineProperty(globalThis, 'crypto', original); else delete globalThis.crypto; }
});

// ---------------------------------------------------------------- disableOnSubmit
test('disableOnSubmit: buttons are disabled while the handler runs and restored (also when it throws, and for an already disabled one)', async () => {
    const form = mount('<input name="a" value="x"><button type="submit" id="two" disabled>Two</button><input type="submit" id="three" value="3"><button type="button" id="plain">p</button>');
    const inst = FormValidator.init({ form, rules: {}, config: { disableOnSubmit: true } });
    let release;
    const seen = [];
    const run = inst.handleSubmit(() => new Promise(r => { seen.push({ go: form.querySelector('#go').disabled, three: form.querySelector('#three').disabled, plain: form.querySelector('#plain').disabled, cls: form.classList.contains('fv-submitting'), busy: form.querySelector('#go').getAttribute('aria-busy'), sub: inst.isSubmitting() }); release = r; }));
    const p = run(ok);
    await settle(10);
    assert.deepEqual(seen[0], { go: true, three: true, plain: false, cls: true, busy: 'true', sub: true });
    release(); await p;
    assert.equal(form.querySelector('#go').disabled, false);
    assert.equal(form.querySelector('#two').disabled, true, 'it was disabled before: it stays disabled');
    assert.equal(form.querySelector('#go').hasAttribute('aria-busy'), false);
    assert.equal(form.classList.contains('fv-submitting'), false);
    assert.equal(inst.isSubmitting(), false);
    await assert.rejects(inst.handleSubmit(async () => { throw new Error('network'); })(ok), /network/);
    assert.equal(form.querySelector('#go').disabled, false, 'restored after an error');
    // config.onSubmit path
    const form2 = mount('<input name="a" value="x">');
    let rel2;
    FormValidator.init({ form: form2, rules: {}, config: { disableOnSubmit: true, onSubmit: () => new Promise(r => { rel2 = r; }) } });
    form2.querySelector('#go').click(); await settle(20);
    assert.equal(form2.querySelector('#go').disabled, true);
    rel2(); await settle(20);
    assert.equal(form2.querySelector('#go').disabled, false);
});
test('without disableOnSubmit the buttons are left alone (the double-submit guard still applies)', async () => {
    const form = mount('<input name="a" value="x">');
    const inst = FormValidator.init({ form, rules: {} });
    let release;
    const p = inst.handleSubmit(() => new Promise(r => { release = r; }))(ok);
    await settle(10);
    assert.equal(form.querySelector('#go').disabled, false);
    assert.equal(inst.isSubmitting(), true);
    release(); await p;
});

// ---------------------------------------------------------------- drafts
const FIELDS = '<input name="name"><input name="pw" type="password"><input name="secret" type="hidden" value="h"><input type="checkbox" name="tag" value="a"><input type="checkbox" name="tag" value="b">' +
    '<input type="radio" name="plan" value="free"><input type="radio" name="plan" value="pro"><select name="colors" multiple><option value="r">r</option><option value="g">g</option></select>' +
    '<textarea name="note"></textarea><input name="skipme" data-fv-no-draft><input name="excluded">';
const DRAFT = { draft: { key: 'test-draft', debounce: 5, exclude: ['excluded'] } };
const stored = (key = 'test-draft', st = w.sessionStorage) => JSON.parse(st.getItem(key));

test('a draft is saved while the user types (never passwords, hidden or files) and restored by the next page load', async () => {
    w.sessionStorage.clear();
    let form = mount(FIELDS, 'df');
    let inst = FormValidator.init({ form, rules: {}, config: DRAFT });
    form.elements.name.value = 'Bob'; fire(form.elements.name, 'input');
    form.elements.pw.value = 'secret'; fire(form.elements.pw, 'input');
    form.elements.tag[1].checked = true; form.elements.plan[1].checked = true;
    Array.from(form.elements.colors.options).forEach(o => { o.selected = o.value === 'g'; });
    form.elements.note.value = 'multi\nline'; form.elements.skipme.value = 'x'; form.elements.excluded.value = 'y';
    fire(form.elements.note, 'input'); await settle(30);
    const saved = stored();
    assert.deepEqual(saved.values, { name: 'Bob', tag: ['b'], plan: 'pro', colors: ['g'], note: 'multi\nline' });
    assert.equal(saved.v, 1);
    assert.equal(inst.hasUnsavedChanges(), true);
    inst.destroy();
    // the "reload"
    form = mount(FIELDS, 'df');
    const events = [];
    form.addEventListener('fv:draft-restored', e => events.push(e.detail.fields));
    inst = FormValidator.init({ form, rules: { name: 'required' }, config: DRAFT });
    assert.equal(form.elements.name.value, 'Bob');
    assert.deepEqual([form.elements.tag[0].checked, form.elements.tag[1].checked], [false, true]);
    assert.equal(form.elements.plan[1].checked, true);
    assert.deepEqual(Array.from(form.elements.colors.selectedOptions).map(o => o.value), ['g']);
    assert.equal(form.elements.note.value, 'multi\nline');
    assert.equal(form.elements.pw.value, '');
    assert.equal(form.elements.skipme.value, '');
    assert.deepEqual(events, [5]);
    assert.equal(inst.getState().fields.name.dirty, true, 'the restored text counts as typed, not as the start value');
});
test('a draft is cleared after a successful submit, kept after a failed one, and by clearDraft / resetForm / markSaved', async () => {
    w.sessionStorage.clear();
    const form = mount('<input name="name" value="">', 'dc');
    const inst = FormValidator.init({ form, rules: {}, config: DRAFT });
    form.elements.name.value = 'Bob'; fire(form.elements.name, 'input'); await settle(30);
    assert.ok(w.sessionStorage.getItem('test-draft'));
    await inst.handleSubmit(async () => ({ errors: { name: 'Taken' } }))(ok);
    assert.ok(w.sessionStorage.getItem('test-draft'), 'a failed save keeps the draft');
    await inst.handleSubmit(async () => ({ id: 1 }))(ok);
    assert.equal(w.sessionStorage.getItem('test-draft'), null);
    form.elements.name.value = 'Eve'; fire(form.elements.name, 'input'); await settle(30);
    assert.ok(w.sessionStorage.getItem('test-draft'));
    inst.clearDraft();
    assert.equal(w.sessionStorage.getItem('test-draft'), null);
    form.elements.name.value = 'Eve2'; fire(form.elements.name, 'input'); await settle(30);
    inst.markSaved();
    assert.equal(w.sessionStorage.getItem('test-draft'), null);
    form.elements.name.value = 'Eve3'; fire(form.elements.name, 'input'); await settle(30);
    inst.resetForm();
    assert.equal(w.sessionStorage.getItem('test-draft'), null);
});
test('typing back to the start value removes the draft; an unchanged form saves nothing', async () => {
    w.sessionStorage.clear();
    const form = mount('<input name="name" value="start">', 'dd');
    FormValidator.init({ form, rules: {}, config: DRAFT });
    form.elements.name.value = 'changed'; fire(form.elements.name, 'input'); await settle(30);
    assert.ok(w.sessionStorage.getItem('test-draft'));
    form.elements.name.value = 'start'; fire(form.elements.name, 'input'); await settle(30);
    assert.equal(w.sessionStorage.getItem('test-draft'), null);
});
test('drafts: expiry, broken storage content, blocked storage, localStorage, default key, hostile names', async () => {
    w.sessionStorage.clear(); w.localStorage.clear();
    // expired
    w.sessionStorage.setItem('test-draft', JSON.stringify({ v: 1, t: Date.now() - 9 * 86400000, values: { name: 'old' } }));
    let form = mount('<input name="name">', 'de1');
    FormValidator.init({ form, rules: {}, config: DRAFT });
    assert.equal(form.elements.name.value, '', 'older than 7 days');
    assert.equal(w.sessionStorage.getItem('test-draft'), null);
    // garbage and wrong version
    for (const junk of ['not json', '{"v":2,"values":{"name":"x"}}', 'null', '[]', '{"v":1,"t":' + Date.now() + ',"values":5}']) {
        w.sessionStorage.setItem('test-draft', junk);
        form = mount('<input name="name">', 'de2');
        assert.doesNotThrow(() => FormValidator.init({ form, rules: {}, config: DRAFT }));
        assert.equal(form.elements.name.value, '');
    }
    // hostile and unknown names are ignored, others restored
    w.sessionStorage.setItem('test-draft', JSON.stringify({ v: 1, t: Date.now(), values: { __proto__: 'x', constructor: 'y', ghost: 'z', name: 'ok' } }));
    form = mount('<input name="name">', 'de3');
    FormValidator.init({ form, rules: {}, config: DRAFT });
    assert.equal(form.elements.name.value, 'ok');
    // localStorage + the default key
    form = mount('<input name="name">', 'de4');
    FormValidator.init({ form, rules: {}, config: { draft: { storage: 'local', debounce: 5 } } });
    form.elements.name.value = 'L'; fire(form.elements.name, 'input'); await settle(30);
    assert.deepEqual(stored('fv-draft:de4', w.localStorage).values, { name: 'L' });
    // blocked storage
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } };
    Object.defineProperty(globalThis, 'sessionStorage', { value: broken, configurable: true, writable: true });
    try {
        form = mount('<input name="name">', 'de5');
        const inst = FormValidator.init({ form, rules: {}, config: DRAFT });
        form.elements.name.value = 'x'; fire(form.elements.name, 'input'); await settle(30);
        assert.equal(inst.saveDraft(), false);
        assert.equal(inst.restoreDraft(), false);
        inst.clearDraft();
    } finally { Object.defineProperty(globalThis, 'sessionStorage', { value: w.sessionStorage, configurable: true, writable: true }); }
});

// ---------------------------------------------------------------- leaveWarning
const leave = () => { const e = new w.Event('beforeunload', { cancelable: true }); w.dispatchEvent(e); return e; };
test('leaveWarning: the browser asks only while there are unsaved changes, and not after a save or a native submit', async () => {
    const form = mount('<input name="name" value="a"><input name="pw" type="password">', 'lw');
    const inst = FormValidator.init({ form, rules: {}, config: { leaveWarning: true } });
    assert.equal(leave().defaultPrevented, false, 'nothing changed');
    form.elements.name.value = 'b';
    assert.equal(leave().defaultPrevented, true);
    assert.equal(inst.hasUnsavedChanges(), true);
    form.elements.name.value = 'a';
    assert.equal(leave().defaultPrevented, false, 'back to the start');
    form.elements.pw.value = 'typed';
    assert.equal(leave().defaultPrevented, false, 'passwords do not count');
    form.elements.name.value = 'b';
    await inst.handleSubmit(async () => ({ ok: 1 }))(ok);
    assert.equal(leave().defaultPrevented, false, 'saved');
    form.elements.name.value = 'c';
    inst.resetForm();
    assert.equal(leave().defaultPrevented, false, 'reset starts over');
    form.elements.name.value = 'd';
    assert.equal(leave().defaultPrevented, true);
    inst.markSaved();
    assert.equal(leave().defaultPrevented, false);
    inst.destroy();
    form.elements.name.value = 'e';
    assert.equal(leave().defaultPrevented, false, 'the listener goes with the validator');
});
test('leaveWarning: off by default; a string option is accepted', () => {
    const form = mount('<input name="name" value="a">', 'lw2');
    FormValidator.init({ form, rules: {} });
    form.elements.name.value = 'b';
    assert.equal(leave().defaultPrevented, false);
    const form2 = mount('<input name="name" value="a">', 'lw3');
    FormValidator.init({ form: form2, rules: {}, config: { leaveWarning: 'You have unsaved changes.' } });
    form2.elements.name.value = 'b';
    const e = leave();
    assert.equal(e.defaultPrevented, true);   // (a real BeforeUnloadEvent also gets the string as returnValue; jsdom's plain Event cannot hold it)
});
