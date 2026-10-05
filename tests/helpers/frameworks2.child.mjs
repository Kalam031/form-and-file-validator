// Run by tests/frameworks2.test.mjs with `node --conditions=browser` (Solid's reactive build): Svelte, Lit and Solid bindings on real libraries.
import test from 'node:test';
import assert from 'node:assert/strict';
import './shim.js';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, Node: w.Node, HTMLElement: w.HTMLElement, Element: w.Element, Event: w.Event, CustomEvent: w.CustomEvent, MutationObserver: w.MutationObserver,
    customElements: w.customElements, ShadowRoot: w.ShadowRoot, DocumentFragment: w.DocumentFragment, CSS: w.CSS, FormData: w.FormData, Text: w.Text, Comment: w.Comment, HTMLTemplateElement: w.HTMLTemplateElement,
    Document: w.Document, HTMLSlotElement: w.HTMLSlotElement, CSSStyleSheet: w.CSSStyleSheet, SVGElement: w.SVGElement, HTMLInputElement: w.HTMLInputElement });
try { Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true }); } catch (e) { /* newer Node has its own */ }

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));
const mountForm = html => { const root = document.getElementById('root'); root.innerHTML = `<form>${html}<button type="submit">Go</button></form>`; return root.firstElementChild; };

// ---------------------------------------------------------------- Svelte (action + stores; the store contract is checked with Svelte's own get())
test('Svelte: the action starts the validator, the stores follow it, handleSubmit gives validated values and shows server errors', async () => {
    const { createFormValidator, fvForm } = await import('../../dist/integrations/svelte.mjs');
    const { get } = await import('svelte/store');
    const form = mountForm('<input name="email">');
    const fv = createFormValidator({ rules: { email: ['required', 'email'] } });
    const action = fv.form(form);
    assert.deepEqual(get(fv.errors), []);
    assert.equal(get(fv.valid), null);
    const seen = [];
    const off = fv.errors.subscribe(v => seen.push(v.length));
    const sent = [];
    const submit = fv.handleSubmit(async values => { sent.push(values); return values.email === 'taken@b.co' ? { errors: { email: 'Taken' } } : { id: 1 }; });
    let r = await submit({ preventDefault() {} });
    assert.equal(r.valid, false);
    assert.equal(get(fv.valid), false);
    assert.equal(get(fv.errors).length, 1);
    assert.equal(get(fv.errors)[0].name, 'email');
    assert.equal(get(fv.errors)[0].code, 'required');
    assert.equal(sent.length, 0);
    form.elements.email.value = 'taken@b.co'; fire(form.elements.email, 'input');
    r = await submit({ preventDefault() {} });
    assert.deepEqual(sent, [{ email: 'taken@b.co' }]);
    assert.equal(get(fv.errors)[0].message, 'Taken');
    form.elements.email.value = 'free@b.co'; fire(form.elements.email, 'change'); await settle(20);
    assert.equal(get(fv.errors).length, 0, 'fixing a field updates the store without a submit');
    r = await submit({ preventDefault() {} });
    assert.equal(r.valid, true);
    assert.equal(get(fv.valid), true);
    assert.ok(seen.includes(1) && seen[seen.length - 1] === 0);
    assert.equal(get(fv.submitting), false);
    assert.equal(fv.setServerErrors({ errors: { email: ['Server says no'] } }).missed.length, 0);
    assert.equal(get(fv.errors)[0].message, 'Server says no');
    fv.reset();
    assert.equal(get(fv.errors).length, 0);
    assert.equal(get(fv.valid), null);
    off();
    action.destroy();
    assert.equal(form._fvInstance, undefined);
    // the plain action
    const f2 = mountForm('<input name="a">');
    const a2 = fvForm(f2, { rules: { a: 'required' } });
    assert.ok(f2._fvInstance);
    a2.update({ rules: { a: 'email' } });
    f2.elements.a.value = 'nope';
    assert.equal(await f2._fvInstance.validate({ focus: false }), false);
    a2.destroy();
});

test('Svelte: an unmounted form is safe to submit and validate', async () => {
    const { createFormValidator } = await import('../../dist/integrations/svelte.mjs');
    const fv = createFormValidator({ rules: {} });
    let prevented = false;
    const r = await fv.handleSubmit(() => {})({ preventDefault() { prevented = true; } });
    assert.equal(r.valid, false); assert.equal(prevented, true);
    assert.equal(await fv.validate(), false);
    assert.deepEqual(fv.getValues(), {});
});

// ---------------------------------------------------------------- Lit
test('Lit: the controller starts after the first render, errors follow the form, handleSubmit validates', async () => {
    const { LitElement, html } = await import('lit');
    const { FvFormController } = await import('../../dist/integrations/lit.mjs');
    const sent = [];
    class SignupForm extends LitElement {
        constructor() { super(); this.fv = new FvFormController(this, { rules: { email: ['required', 'email'] } }); }
        createRenderRoot() { return this; }   // light DOM: the test can query the form directly
        render() {
            return html`<form @submit=${this.fv.handleSubmit(async values => { sent.push(values); })}><input name="email"><span class="count">${this.fv.errors.length}</span><button type="submit">Save</button></form>`;
        }
    }
    customElements.define('signup-form-test', SignupForm);
    const el = document.createElement('signup-form-test');
    document.getElementById('root').appendChild(el);
    await el.updateComplete; await settle(10);
    assert.ok(el.fv.instance, 'the validator exists after the first render');
    const input = el.querySelector('input');
    assert.equal(el.fv.valid, null);
    assert.equal(await el.fv.validate({ focus: false }), false);
    await el.updateComplete;
    assert.equal(el.fv.errors.length, 1);
    assert.equal(el.querySelector('.count').textContent, '1', 'the host re-rendered with the errors');
    assert.equal(el.fv.errors[0].code, 'required');
    input.value = 'a@b.co'; fire(input, 'change'); await settle(20); await el.updateComplete;
    assert.equal(el.fv.errors.length, 0);
    assert.equal(el.querySelector('.count').textContent, '0');
    el.querySelector('button').click(); await settle(40);
    assert.deepEqual(sent, [{ email: 'a@b.co' }]);
    assert.equal(el.fv.submitting, false);
    assert.equal(el.fv.valid, true);
    assert.deepEqual(el.fv.getValues(), { email: 'a@b.co' });
    el.fv.setServerErrors({ errors: { email: ['Taken'] } });
    await el.updateComplete;
    assert.equal(el.fv.errors[0].message, 'Taken');
    const inst = el.fv.instance;
    el.remove(); await settle(10);
    assert.equal(el.fv.instance, null);
    assert.equal(inst.getErrors().length, 0, 'destroyed with the element');
});

test('Lit: shadow DOM form and a form selector', async () => {
    const { LitElement, html } = await import('lit');
    const { FvFormController } = await import('../../dist/integrations/lit.mjs');
    class ShadowForm extends LitElement {
        constructor() { super(); this.fv = new FvFormController(this, { rules: { a: 'required' }, form: '#mine' }); }
        render() { return html`<form id="other"><input name="x"></form><form id="mine"><input name="a"></form>`; }
    }
    customElements.define('shadow-form-test', ShadowForm);
    const el = document.createElement('shadow-form-test');
    document.getElementById('root').appendChild(el);
    await el.updateComplete; await settle(10);
    assert.equal(el.fv.instance.form.id, 'mine');
    assert.equal(await el.fv.validate({ focus: false }), false);
    assert.ok(el.shadowRoot.querySelector('#mine .error'), 'the message is placed inside the shadow root');
    el.remove();
});

// ---------------------------------------------------------------- Solid (reactive build)
test('Solid: accessors are reactive, the validator follows the ref and the owner', async () => {
    const solid = await import('solid-js');
    const { createFormValidator } = await import('../../dist/integrations/solid.mjs');
    const form = mountForm('<input name="email">');
    const seen = [], validSeen = [];
    let fv, dispose;
    solid.createRoot(d => {
        dispose = d;
        fv = createFormValidator({ rules: { email: ['required', 'email'] } });
        solid.createEffect(() => { seen.push(fv.errors().length); });
        solid.createEffect(() => { validSeen.push(fv.valid()); });
    });
    fv.ref(form); await settle(5);
    assert.ok(fv.instance());
    assert.equal(fv.valid(), null);
    const sent = [];
    const submit = fv.handleSubmit(async values => { sent.push(values); });
    let r = await submit({ preventDefault() {} });
    assert.equal(r.valid, false);
    assert.equal(fv.errors().length, 1);
    assert.equal(fv.errors()[0].name, 'email');
    assert.equal(fv.valid(), false);
    assert.deepEqual(seen.slice(-1), [1]);
    form.elements.email.value = 'a@b.co'; fire(form.elements.email, 'change'); await settle(20);
    assert.equal(fv.errors().length, 0);
    assert.deepEqual(seen.slice(-1), [0], 'an effect that reads errors() re-runs');
    r = await submit({ preventDefault() {} });
    assert.equal(r.valid, true);
    assert.deepEqual(sent, [{ email: 'a@b.co' }]);
    assert.equal(fv.valid(), true);
    assert.ok(validSeen.includes(false) && validSeen[validSeen.length - 1] === true);
    assert.equal(fv.submitting(), false);
    assert.deepEqual(fv.getValues(), { email: 'a@b.co' });
    fv.setServerErrors({ errors: { email: ['Taken'] } });
    assert.equal(fv.errors()[0].message, 'Taken');
    const inst = fv.instance();
    dispose();
    assert.equal(fv.instance(), null);
    assert.equal(form._fvInstance, undefined);
    assert.ok(inst);
});
