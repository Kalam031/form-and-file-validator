import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import './helpers/shim.js';
import { JSDOM } from 'jsdom';

// ---- a jsdom page as the global environment (before the libraries are loaded)
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', {
    value() { for (let n = this; n && n.nodeType === 1; n = n.parentElement) if (n.hidden || n.style.display === 'none') return []; return [1]; }
});
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, Node: w.Node, HTMLElement: w.HTMLElement, CSS: w.CSS, Element: w.Element, Event: w.Event, MutationObserver: w.MutationObserver,
    SVGElement: w.SVGElement, Text: w.Text, Comment: w.Comment, DocumentFragment: w.DocumentFragment, ShadowRoot: w.ShadowRoot, HTMLInputElement: w.HTMLInputElement });
try { Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true }); } catch (e) { /* newer Node has its own */ }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms));
const $ = sel => document.querySelector(sel);
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));

// ---------------------------------------------------------------- React
test('React: useFormValidator validates the form and exposes errors; FileDropzone builds a widget', async () => {
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { act } = React;
    const { useFormValidator, FileDropzone } = await import('../dist/integrations/react.mjs');
    let api, zoneRef = React.createRef(), changes = 0;
    function App() {
        api = useFormValidator({ rules: { email: ['required', 'email'] } });
        return React.createElement('form', { ref: api.ref, id: 'rf' },
            React.createElement('input', { name: 'email', type: 'text' }),
            React.createElement(FileDropzone, { ref: zoneRef, name: 'photos', label: 'Drop photos', config: { allowedExtensions: ['.png'], maxFiles: 2 }, onChange: () => { changes++; } }));
    }
    const container = document.getElementById('root');
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(App)); });
    assert.equal(api.instance() !== null, true);
    let ok;
    await act(async () => { ok = await api.validate(); });
    assert.equal(ok, false);
    assert.equal(api.errors.length, 1);
    assert.equal(api.errors[0].name, 'email');
    document.querySelector('input[name=email]').value = 'a@b.co';
    await act(async () => { ok = await api.validate(); });
    assert.equal(ok, true);
    // dropzone: structure, controller, and a file added programmatically
    assert.ok($('.fv-zone input[type=file][name=photos]'));
    assert.equal($('.fv-zone-label').textContent, 'Drop photos');
    const png = new w.File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])], 'a.png', { type: 'image/png' });
    await act(async () => { await zoneRef.current.add([png]); await settle(); });
    assert.equal(zoneRef.current.files.length, 1);
    assert.ok(changes >= 1);
    assert.equal($('.fv-list').children.length, 1);
    await act(async () => { root.unmount(); });
    assert.equal(document.getElementById('root').innerHTML, '');
});

// ---------------------------------------------------------------- Vue
test('Vue: composable, directive and FileDropzone component', async () => {
    const Vue = await import('vue');
    const { useFormValidator, vFormValidator, FileDropzone, FormValidatorPlugin } = await import('../dist/integrations/vue.mjs');
    document.getElementById('root').innerHTML = '<div id="vue"></div>';
    let api, dropzone;
    const changes = [];
    const App = Vue.defineComponent({
        setup() {
            api = useFormValidator({ rules: { email: ['required', 'email'] } });
            return () => Vue.h('div', [
                Vue.h('form', { ref: api.formRef, id: 'vf' }, [Vue.h('input', { name: 'email' })]),
                Vue.h('form', { id: 'dir' }, [Vue.h('input', { name: 'q' })]),
                Vue.h(FileDropzone, { ref: el => { dropzone = el; }, name: 'docs', config: { allowedExtensions: ['.png'] }, onChange: files => changes.push(files.length) })
            ]);
        }
    });
    const app = Vue.createApp(App);
    app.use(FormValidatorPlugin);
    app.directive('fv', vFormValidator);
    app.mount('#vue');
    await Vue.nextTick();
    assert.ok(api.instance.value);
    assert.equal(await api.validate(), false);
    assert.equal(api.errors.value.length, 1);
    document.querySelector('#vf input').value = 'x@y.zz';
    assert.equal(await api.validate(), true);
    assert.ok($('.fv-zone input[name=docs]'));
    const png = new w.File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])], 'a.png', { type: 'image/png' });
    await dropzone.add([png]); await settle();
    assert.equal(dropzone.files.length, 1);
    assert.deepEqual(changes.slice(-1), [1]);
    // directive
    const el = document.createElement('form'); el.innerHTML = '<input name="q">';
    document.body.appendChild(el);
    vFormValidator.mounted(el, { value: { rules: { q: ['required'] } } });
    assert.equal(await el.__fvInstance.validate(), false);
    vFormValidator.unmounted(el);
    assert.equal(el.__fvInstance, null);
    app.unmount();
});

// ---------------------------------------------------------------- Alpine
test('Alpine: x-validate and x-dropzone directives', async () => {
    globalThis.FormValidator = require('../dist/formValidator.js');
    globalThis.FileValidator = require('../dist/fileValidator.js');
    require('../dist/fileValidator.widget.js');
    const register = require('../dist/integrations/alpine.js');
    assert.equal(typeof register, 'function');
    const directives = {};
    register({ directive: (name, fn) => { directives[name] = fn; } });
    assert.deepEqual(Object.keys(directives).sort(), ['dropzone', 'validate']);

    const cleanups = [];
    const utilitiesFor = value => ({ evaluateLater: () => cb => cb(value), cleanup: fn => cleanups.push(fn) });
    const form = document.createElement('form'); form.innerHTML = '<input name="email">'; document.body.appendChild(form);
    directives.validate(form, { expression: '' }, utilitiesFor({ rules: { email: ['required', 'email'] } }));
    assert.equal(await form.__fvInstance.validate(), false);

    const zone = document.createElement('div');
    zone.innerHTML = '<input type="file" name="p"><ul class="fv-list"></ul><div class="fv-messages"></div><div class="fv-status"></div>';
    document.body.appendChild(zone);
    let detail = null;
    zone.addEventListener('fv-change', e => { detail = e.detail; });
    directives.dropzone(zone, { expression: '' }, utilitiesFor({ config: { allowedExtensions: ['.png'] } }));
    const png = new w.File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])], 'a.png', { type: 'image/png' });
    await zone.__fvWidget.add([png]); await settle();
    assert.equal(detail.files.length, 1);
    assert.equal(zone.querySelector('.fv-list').children.length, 1);
    cleanups.forEach(fn => fn());
    assert.equal(form.__fvInstance, null);
    assert.equal(zone.__fvWidget, null);
});

test('the real Alpine runtime runs both directives from HTML attributes', async () => {
    const mod = await import('alpinejs');
    const Alpine = mod.default && mod.default.directive ? mod.default : (mod.default && mod.default.default) || mod.default;
    globalThis.Alpine = Alpine;
    const register = require('../dist/integrations/alpine.js');
    register(Alpine);
    document.body.insertAdjacentHTML('beforeend', '<form id="ax" x-data x-validate="{ rules: { email: [\'required\'] } }"><input name="email"></form>');
    Alpine.start();
    await settle(100);
    const form = document.getElementById('ax');
    assert.ok(form.__fvInstance, 'x-validate created the FormValidator');
    assert.equal(await form.__fvInstance.validate(), false);
});
