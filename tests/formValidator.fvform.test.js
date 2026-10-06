'use strict';
// <fv-form>: a whole form started from HTML.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });   // jsdom has no layout
Object.assign(globalThis, { window: w, document: w.document, HTMLElement: w.HTMLElement, customElements: w.customElements, CustomEvent: w.CustomEvent, MutationObserver: w.MutationObserver, FormData: w.FormData, Element: w.Element, CSS: w.CSS });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');
require('../src/formValidator.element.js');
require('../src/locales/de.js');
require('../src/locale.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const mount = html => { document.body.innerHTML = html; return document.querySelector('fv-form'); };
const submit = form => form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
const errorsOf = form => Array.from(form.querySelectorAll('.fv-error, .error, [data-fv-error], label.error')).map(e => e.textContent).filter(Boolean);

test('it is registered, starts a validator on the form inside it and blocks an invalid submit', async () => {
    assert.ok(customElements.get('fv-form'));
    assert.equal(typeof FormValidator.formElement.define, 'function');
    const el = mount(`<fv-form rules='{"email":"required email","name":"required"}'><form><input name="email" value="nope"><input name="name"><button>Go</button></form></fv-form>`);
    await settle();
    assert.ok(el.instance, 'an instance exists');
    assert.equal(el.form.tagName, 'FORM');
    let seen = null;
    el.addEventListener('fv-invalid', e => { seen = e.detail; });
    const ev = submit(el.form);
    await settle();
    assert.equal(el.valid, false);
    assert.deepEqual(el.errors.map(e => e.name).sort(), ['email', 'name']);
    assert.ok(seen && seen.errors.length === 2, 'fv-invalid is announced on the element');
    assert.equal(await el.validate(), false);
});

test('data-fv on the fields works too, and the rules attribute wins', async () => {
    const el = mount(`<fv-form rules='{"age":"required"}'><form><input name="age" data-fv="min:18 digits" value=""><input name="zip" data-fv="required digits" value="abc"></form></fv-form>`);
    await settle();
    assert.equal(await el.validate(), false);
    assert.deepEqual(el.errors.map(e => e.name).sort(), ['age', 'zip']);
    el.form.elements.age.value = '5';
    el.form.elements.zip.value = '12345';
    assert.equal(await el.validate(), true, 'age "5" passes: the attribute (required) replaced the data-fv min');
});

test('lang, messages and config attributes reach the engine', async () => {
    const el = mount(`<fv-form lang="de" messages='{"name":{"required":"Bitte Namen eingeben"}}' config='{"focusInvalid":false}' rules='{"email":"required email","name":"required"}'><form><input name="email"><input name="name"></form></fv-form>`);
    await settle();
    await el.validate();
    const by = Object.fromEntries(el.errors.map(e => [e.name, e.message]));
    assert.match(by.email, /E-Mail|Feld|erforderlich|Pflicht|ausf/i, 'German built-in message, got ' + by.email);
    assert.equal(by.name, 'Bitte Namen eingeben');
});

test('fv-submit carries the validated values; preventDefault keeps the browser from posting, otherwise it posts', async () => {
    const el = mount(`<fv-form rules='{"email":"required email"}'><form><input name="email" value="a@b.co"><button>Go</button></form></fv-form>`);
    await settle();
    let posted = 0;
    el.form.requestSubmit = () => { posted++; };
    let detail = null, prevent = true;
    el.addEventListener('fv-submit', e => { detail = e.detail; if (prevent) e.preventDefault(); });
    submit(el.form);
    await settle(60);
    assert.deepEqual(detail.values, { email: 'a@b.co' });
    assert.equal(detail.form, el.form);
    assert.equal(posted, 0, 'prevented: not posted');
    prevent = false;
    submit(el.form);
    await settle(60);
    assert.equal(posted, 1, 'not prevented: handed back to the browser once');
});

test('a form that appears later is picked up, changing rules restarts, removing the element destroys the instance', async () => {
    document.body.innerHTML = '<fv-form rules=\'{"a":"required"}\'></fv-form>';
    const el = document.querySelector('fv-form');
    await settle();
    assert.equal(el.instance, null);
    el.innerHTML = '<form><input name="a"></form>';
    await settle(60);
    assert.ok(el.instance, 'started once the form arrived');
    assert.equal(await el.validate(), false);
    const first = el.instance;
    el.rules = { a: 'required', b: 'required' };
    el.form.insertAdjacentHTML('beforeend', '<input name="b">');
    await settle(40);
    assert.notEqual(el.instance, first, 'restarted');
    const form = el.form;
    el.remove();
    await settle();
    assert.equal(el.instance, null);
    assert.ok(!form._fvInstance, 'destroyed on removal');
});

test('setErrors / clearErrors / reset and an explicit form="selector"', async () => {
    const el = mount(`<fv-form form="#real" rules='{"email":"required"}'><form id="decoy"></form><form id="real"><input name="email" value="x"></form></fv-form>`);
    await settle();
    assert.equal(el.form.id, 'real');
    el.setErrors({ email: 'Taken' });
    assert.equal(el.errors[0].message, 'Taken');
    el.clearErrors();
    assert.equal(el.errors.length, 0);
    assert.equal(typeof el.reset, 'function');
});
