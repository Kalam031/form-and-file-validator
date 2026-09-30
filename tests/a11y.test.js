'use strict';
// Automated accessibility audit (axe-core) of the error states, the jQuery layer and the upload widget.
// axe finds structural problems (labels, ARIA, roles, ids, names). It cannot judge colour contrast or how a screen reader
// actually sounds: see docs/Accessibility.md for the manual checklist.
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html lang="en"><head><title>Test</title></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/', runScripts: 'outside-only' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', {
    value() { for (let n = this; n && n.nodeType === 1; n = n.parentElement) if (n.hidden || n.style.display === 'none') return []; return [1]; }
});
Object.assign(globalThis, { window: w, document: w.document, Event: w.Event, CustomEvent: w.CustomEvent, Node: w.Node, HTMLElement: w.HTMLElement, CSS: w.CSS });
globalThis.FileValidator = require('../src/fileValidator.js');
require('../src/fileValidator.widget.js');
const FormValidator = require('../src/formValidator.js');
const axe = require('axe-core');
const $ = require(process.env.JQUERY_PKG || 'jquery');
globalThis.jQuery = $;
require('../src/formValidator.jquery.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
async function audit(label) {
    const r = await axe.run(document.body, {
        rules: { 'color-contrast': { enabled: false }, region: { enabled: false }, 'landmark-one-main': { enabled: false }, 'page-has-heading-one': { enabled: false } }
    });
    const lines = r.violations.map(v => `${v.id} (${v.impact}): ${v.help}\n    ` + v.nodes.map(n => n.html.slice(0, 120)).join('\n    '));
    assert.equal(r.violations.length, 0, label + ' has accessibility violations:\n' + lines.join('\n'));
    return r;
}
const form = html => { document.body.innerHTML = `<main><form id="f" novalidate>${html}<button type="submit">Send</button></form></main>`; return document.getElementById('f'); };
const FIELDS = `
  <div><label for="name">Full name</label><input id="name" name="name"></div>
  <div><label for="email">Email</label><input id="email" name="email" type="email"></div>
  <div><label for="pw">Password</label><input id="pw" name="pw" type="password"></div>
  <div><label for="country">Country</label><select id="country" name="country"><option value="">Choose…</option><option value="1">One</option></select></div>
  <fieldset class="answer"><legend>Plan</legend>
    <label><input type="radio" name="plan" value="free"> Free</label>
    <label><input type="radio" name="plan" value="pro"> Pro</label></fieldset>
  <div><label><input type="checkbox" name="terms" value="1"> I accept the terms</label></div>
  <div><label for="doc">Document</label><input id="doc" name="doc" type="file"></div>`;

test('native FormValidator: no violations before validation, with every field in error, and after fixing them', async () => {
    const f = form(FIELDS);
    const inst = FormValidator.init({ formId: 'f', rules: {
        name: ['required'], email: ['required', 'email'], pw: [{ type: 'pwcheck', minLength: 8 }, 'required'],
        country: ['required'], plan: ['required'], terms: ['required'], doc: ['required']
    } });
    await audit('the untouched form');
    assert.equal(await inst.validate({ focus: false }), false);
    assert.equal(document.querySelectorAll('.error').length, 7);
    await audit('the form with 7 errors');
    // the pieces a screen reader relies on
    for (const el of document.querySelectorAll('.error')) {
        assert.equal(el.getAttribute('role'), 'alert');
        const field = document.querySelector(`[aria-describedby~="${el.id}"]`);
        assert.ok(field, 'error ' + el.id + ' is referenced by aria-describedby of its field');
        assert.equal(field.getAttribute('aria-invalid'), 'true');
    }
    document.querySelector('#name').value = 'Ada'; document.querySelector('#email').value = 'a@b.co'; document.querySelector('#pw').value = 'longenough1';
    document.querySelector('#country').value = '1'; document.querySelectorAll('[name=plan]')[1].checked = true; document.querySelector('[name=terms]').checked = true;
    Object.defineProperty(document.querySelector('#doc'), 'files', { value: [new File(['x'], 'a.txt')], configurable: true });
    assert.equal(await inst.validate({ focus: false }), true);
    await audit('the corrected form');
    assert.equal(document.querySelectorAll('[aria-invalid], [aria-describedby]').length, 0, 'no stale ARIA left behind');
});

test('native FormValidator: labels as errorElement, custom placement and data-msg keep the markup valid', async () => {
    const f = form(FIELDS.replace('name="name"', 'name="name" data-msg-required="Please tell us your name"'));
    const inst = FormValidator.init({ formId: 'f', rules: { name: ['required'], email: ['email'] }, config: { errorElement: 'label', errorClass: 'error', invalidClass: 'bad' } });
    document.querySelector('#email').value = 'nope';
    await inst.validate({ focus: false });
    assert.equal(document.querySelector('label.error[for="name"]').textContent, 'Please tell us your name');
    await audit('label error elements');
});

test('native FormValidator: pending (remote) state exposes aria-busy without violations', async () => {
    const f = form('<div><label for="u">User</label><input id="u" name="u" value="bob"></div>');
    globalThis.fetch = async () => { await settle(40); return { ok: true, status: 200, json: async () => true }; };
    const inst = FormValidator.init({ formId: 'f', rules: { u: [{ type: 'remote', url: '/c' }] } });
    const p = inst.validate({ focus: false });
    await settle(10);
    assert.equal(document.querySelector('#u').getAttribute('aria-busy'), 'true');
    await audit('a field with a running server check');
    await p;
    assert.equal(document.querySelector('#u').hasAttribute('aria-busy'), false);
});

test('jQuery layer: errors (label + for), groups and showErrors are accessible', async () => {
    const f = form(FIELDS);
    const v = $('#f').validate({ rules: { name: 'required', email: { required: true, email: true }, plan: 'required', terms: 'required', doc: 'required' }, ignore: [] });
    assert.equal(v.form(), false);
    await audit('jQuery layer with errors');
    for (const el of document.querySelectorAll('label.error')) assert.ok(el.getAttribute('for') || document.querySelector(`[aria-describedby~="${el.id}"]`), 'error is tied to a field');
    v.destroy();
    form('<div><label for="a">First</label><input id="a" name="a"></div><div><label for="b">Last</label><input id="b" name="b"></div>');
    const g = $('#f').validate({ rules: { a: 'required', b: 'required' }, groups: { both: 'a b' } });
    g.form();
    await audit('grouped errors (the hidden duplicate must not be reachable)');
    assert.equal(document.querySelectorAll('label.error[hidden]').length, 1);
});

test('upload widget: dropzone, file list, previews and rejected-file messages are accessible', async () => {
    document.body.innerHTML = `<main><form id="f"><div id="zone"><label for="in">Choose files</label><input type="file" id="in" name="up" multiple></div>
        <ul id="list" aria-label="Selected files"></ul><div id="msg"></div></form></main>`;
    const zone = FileValidator.widget('#zone', { accept: '.txt', maxFiles: 3 }, { list: '#list', messageElement: '#msg', preview: true });
    await audit('the empty widget');
    await zone.add([new File(['a'], 'a.txt', { type: 'text/plain' }), new File(['b'], 'b.txt', { type: 'text/plain' }), new File(['x'], 'bad.exe')]);
    assert.equal(document.querySelectorAll('#list li').length, 2);
    await audit('the widget with files and a rejection message');
    const msg = document.getElementById('msg');
    assert.equal(msg.getAttribute('role'), 'alert');
    assert.equal(msg.getAttribute('aria-live'), 'polite');
    const removes = document.querySelectorAll('.fv-remove');
    assert.deepEqual(Array.from(removes).map(b => b.getAttribute('aria-label')), ['Remove a.txt', 'Remove b.txt']);
    assert.ok(Array.from(document.querySelectorAll('.fv-preview')).every(i => i.getAttribute('alt') === ''), 'thumbnails are decorative (the name is beside them)');
});

test('upload widget: a wrapper that is not a label gets keyboard access (tabindex + role) and is still valid', async () => {
    document.body.innerHTML = '<main><form><div id="zone" aria-label="Upload files"><input type="file" id="in" aria-label="Files" hidden></div></form></main>';
    const z = FileValidator.widget('#zone', {}, {});
    const el = document.getElementById('zone');
    assert.equal(el.getAttribute('tabindex'), '0');
    assert.equal(el.getAttribute('role'), 'button');
    await audit('a keyboard-operable dropzone');
    z.destroy();
});
