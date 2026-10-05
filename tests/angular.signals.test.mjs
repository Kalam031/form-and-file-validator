/*
 * Angular Signal Forms (form() from '@angular/forms/signals') with the same rules: fvSchema / fvValidate / fvPrecognition / fvServerErrors,
 * run on REAL Signal Forms. Needs Angular 22 (Node 22.22+ / 24.15+ / 26+); on older Node versions these tests skip themselves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/shim.js';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Node: dom.window.Node, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Event: dom.window.Event, MutationObserver: dom.window.MutationObserver });
try { Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true }); } catch (e) { /* newer Node has its own */ }

let core = null, sf = null, testing = null, loadError = null;
try {
    await import('@angular/compiler');
    core = await import('@angular/core');
    testing = await import('@angular/core/testing');
    const bt = await import('@angular/platform-browser/testing');
    testing.TestBed.initTestEnvironment(bt.BrowserTestingModule, bt.platformBrowserTesting());
    sf = await import('@angular/forms/signals');
} catch (e) { loadError = e; }
const skip = sf ? false : 'Angular Signal Forms could not be loaded (Angular 22 needs Node 22.22+, 24.15+ or 26+): ' + String(loadError && loadError.message).split('\n')[0];

const { FormValidator } = await import('../dist/validator.mjs');
const { fvSchema, fvValidate, fvPrecognition, fvServerErrors } = skip ? {} : await import('../dist/integrations/angular-signals.mjs');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const make = (initial, schemaFn) => {
    const model = core.signal(initial);
    const injector = testing.TestBed.inject(core.EnvironmentInjector);
    return { model, f: sf.form(model, schemaFn, { injector }) };
};
const kinds = field => field().errors().map(e => e.kind);
const flush = async () => { for (let i = 0; i < 4; i++) { testing.TestBed.tick(); await settle(20); } };

test('fvSchema: rules on real Signal Forms, errors carry kind, message, rule and code; fixing the model clears them', { skip }, () => {
    const { model, f } = make({ email: 'nope', name: '' }, fvSchema({ email: ['required', 'email'], name: { required: true, minlength: 3 } }));
    assert.deepEqual(kinds(f.email), ['email']);
    assert.equal(f.email().errors()[0].message, 'Please enter a valid email address.');
    assert.equal(f.email().errors()[0].rule, 'email');
    assert.deepEqual(kinds(f.name), ['required']);
    assert.equal(f().valid(), false);
    model.set({ email: 'a@b.co', name: 'Bob' });
    assert.equal(f().valid(), true);
    assert.deepEqual(kinds(f.email), []);
});

test('fvSchema: cross-field equalTo reads the other field and follows it', { skip }, () => {
    const { model, f } = make({ password: 'Secret123', confirm: 'x' }, fvSchema({ password: { required: true, pwcheck: { minLength: 8 } }, confirm: { equalTo: 'password' } }));
    assert.deepEqual(kinds(f.confirm), ['equalTo']);
    model.set({ password: 'Secret123', confirm: 'Secret123' });
    assert.deepEqual(kinds(f.confirm), []);
    model.set({ password: 'Other1234', confirm: 'Secret123' });
    assert.deepEqual(kinds(f.confirm), ['equalTo'], 'changing the password re-checks the confirmation');
    model.set({ password: 'short', confirm: 'short' });
    assert.deepEqual(kinds(f.password), ['pwcheck']);
});

test('fvSchema: nested paths, numbers and dates become text, rule codes, custom messages, trim', { skip }, () => {
    {
        const { model, f } = make({ address: { zip: ' 12 ' }, qty: 5, born: new Date(2020, 0, 31), code: '' },
            fvSchema({
                'address.zip': { digits: true, minlength: 3 }, qty: { max: 3 }, born: [{ type: 'minDate', min: '2021-01-01' }],
                code: [{ type: 'pattern', pattern: '^[A-Z]+$', code: 'code.format' }, 'required']
            }, { messages: { max: 'Too many' } }));
        assert.deepEqual(kinds(f.address.zip), ['minlength'], '"12" after trimming is too short');
        assert.equal(f.qty().errors()[0].message, 'Too many');
        assert.deepEqual(kinds(f.born), ['minDate']);
        assert.deepEqual(kinds(f.code), ['required']);
        model.set({ address: { zip: '1234' }, qty: 2, born: new Date(2022, 0, 1), code: 'abc' });
        assert.deepEqual(kinds(f.code), ['code.format']);
        assert.deepEqual(kinds(f.address.zip), []);
    }
});

test('fvSchema works inside your own schema next to Angular rules; fvValidate with a values function', { skip }, () => {
    const { model, f } = make({ a: '', b: 'x', c: 'x' }, p => {
        sf.required(p.a);
        fvSchema({ b: ['email'] })(p);
        sf.validate(p.c, fvValidate({ equalTo: 'b' }, { values: ctx => ({ b: ctx.valueOf(p.b) }) }));
    });
    assert.deepEqual(kinds(f.a), ['required']);
    assert.deepEqual(kinds(f.b), ['email']);
    assert.deepEqual(kinds(f.c), []);
    model.set({ a: 'z', b: 'a@b.co', c: 'nope' });
    assert.deepEqual(kinds(f.c), ['equalTo']);
    assert.equal(f.a().valid(), true);
});

test('validateStandardSchema accepts FormValidator.schema() too', { skip }, () => {
    const schema = FormValidator.schema({ email: ['required', 'email'], nick: { minlength: 3 } });
    const { model, f } = make({ email: 'bad', nick: 'ab' }, p => sf.validateStandardSchema(p, schema));
    assert.equal(f().valid(), false);
    assert.ok(f.email().errors().some(e => /valid email/.test(e.message)));
    model.set({ email: 'a@b.co', nick: 'abc' });
    assert.equal(f().valid(), true);
});

test('fvPrecognition: asks the endpoint after the sync rules pass, shows the server message, ignores empty and failed checks', { skip }, async () => {
    const calls = [];
    let answer = { status: 422, body: { errors: { email: ['Already registered'] } } };
    const fetch = async (url, init) => { calls.push({ url, init }); if (answer === 'down') throw new TypeError('offline'); return { status: answer.status, json: async () => answer.body }; };
    const { model, f } = make({ email: '' }, p => { fvSchema({ email: ['required', 'email'] })(p); fvPrecognition(p.email, '/signup', { name: 'email', fetch, debounce: 0 }); });
    await flush();
    assert.equal(calls.length, 0, 'empty: not asked');
    model.set({ email: 'not-an-email' }); await flush();
    assert.equal(calls.length, 0, 'sync rules fail first: not asked');
    model.set({ email: 'a@b.co' }); await flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.headers['Precognition-Validate-Only'], 'email');
    assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'a@b.co' });
    assert.deepEqual(f.email().errors().map(e => e.message), ['Already registered']);
    assert.deepEqual(kinds(f.email), ['server']);
    answer = { status: 204, body: {} };
    model.set({ email: 'free@b.co' }); await flush();
    assert.deepEqual(f.email().errors(), []);
    answer = 'down';
    model.set({ email: 'x@b.co' }); await flush();
    assert.deepEqual(f.email().errors(), [], 'a check that could not be made reports nothing');
    assert.throws(() => make({ e: '' }, p => fvPrecognition(p.e, '/x', {})), /name/);
});

test('fvServerErrors: messages land on their fields (nested, indexed), the rest on the form; works with submit()', { skip }, async () => {
    const { f } = make({ email: 'a@b.co', items: [{ qty: '1' }, { qty: '2' }], profile: { zip: '1' } }, () => {});
    const errs = fvServerErrors(f, { type: 'x', status: 422, errors: { email: ['Taken'], 'items.1.qty': ['Too many'], 'profile.zip': ['Bad'], ghost: ['No such field'], '': ['Try later'] } });
    assert.deepEqual(errs.map(e => e.message).sort(), ['Bad', 'No such field', 'Taken', 'Too many', 'Try later']);
    assert.ok(errs.every(e => e.kind === 'server'));
    const target = m => errs.find(e => e.message === m).fieldTree;
    assert.equal(target('Taken'), f.email);
    assert.equal(target('Too many'), f.items[1].qty);
    assert.equal(target('Bad'), f.profile.zip);
    assert.equal(target('No such field'), f, 'an unknown field falls back to the form');
    assert.equal(target('Try later'), f);
    await sf.submit(f, async () => fvServerErrors(f, { errors: { email: ['Taken'] } }));
    assert.deepEqual(f.email().errors().map(e => e.message), ['Taken']);
});

test('hostile server keys cannot reach prototypes', { skip }, () => {
    const { f } = make({ email: '' }, () => {});
    const errs = fvServerErrors(f, JSON.parse('{"errors":{"__proto__":["x"],"constructor.prototype":["y"],"email":["ok"]}}'));
    assert.deepEqual(errs.map(e => e.message), ['ok']);
});
