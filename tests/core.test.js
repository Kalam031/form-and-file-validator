'use strict';
// The DOM-free core build, the subset builder, and the size budget that keeps the library from growing unnoticed.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { build, listRules, NEEDS_ENGINE } = require('../tools/build-subset.js');

const dist = f => path.join(__dirname, '..', 'dist', f);
const gz = f => zlib.gzipSync(fs.readFileSync(dist(f)), { level: 9 }).length;

// ---------------------------------------------------------------- the prebuilt core
test('dist core: no DOM engine, every rule that needs no form, same answers as the full build', () => {
    const Core = require('../dist/formValidator.core.min.js');
    const Full = require('../dist/formValidator.js');
    assert.equal(Core.version, Full.version);
    ['init', 'validate', 'isValid', 'getInstance', 'unobtrusive', 'addClassRules'].forEach(k => assert.equal(k in Core, false, k + ' is not in the core'));
    ['checkValue', 'checkValues', 'schema', 'serverErrors', 'precognition', 'action', 'parseFormData', 'registerRule', 'addMethod', 'format', 'ValidationError', 'messages'].forEach(k => assert.ok(k in Core, k));
    const rules = Core.ruleNames();
    NEEDS_ENGINE.forEach(r => assert.equal(rules.includes(r), false, r + ' needs a form'));
    assert.equal(rules.length, Full.ruleNames().length - NEEDS_ENGINE.length);
    // the shared vectors give the same answer on the core as on the full engine
    const spec = require('../spec/form-rules.vectors.json');
    let compared = 0;
    for (const c of spec.cases) {
        let a, b;
        try { a = Full.checkValue(c.value, c.rule, { values: c.values }); } catch (e) { a = 'throws'; }
        try { b = Core.checkValue(c.value, c.rule, { values: c.values }); } catch (e) { b = 'throws'; }
        if (b === 'throws' && a !== 'throws') continue;   // a rule the core leaves out
        assert.deepEqual(b, a, JSON.stringify(c.rule) + ' on ' + JSON.stringify(c.value));
        compared++;
    }
    assert.ok(compared > 200, 'compared ' + compared);
});
test('dist core: schema, nested paths, server errors, the action and precognition all work without a DOM', async () => {
    const { schema, checkValues, serverErrors, action, precognition, parseFormData } = require('../dist/formValidator.core.min.js');
    const s = schema({ 'user.email': ['required', 'email'], 'items[].qty': ['required', 'digits'] });
    assert.equal(s.safeParse({ user: { email: 'a@b.co' }, items: [{ qty: '2' }] }).success, true);
    assert.deepEqual(Object.keys(checkValues({ items: [{ qty: 'x' }] }, { 'items[].qty': 'digits' }).errors), ['items[0].qty']);
    assert.deepEqual(serverErrors({ errors: { a: ['x'] } }).errors, { a: 'x' });
    assert.deepEqual(parseFormData([['a.b', '1']]), { a: { b: '1' } });
    const act = action({ email: 'required' }, async v => ({ ok: v }));
    assert.equal((await act(null, { email: 'a' })).ok, true);
    const r = await precognition('/x', { a: 1 }, { fetch: async () => ({ status: 204, json: async () => ({}) }) });
    assert.equal(r.valid, true);
});
test('dist core: the ES module build has the same API as named exports', async () => {
    const { pathToFileURL } = require('node:url');
    const mod = await import(pathToFileURL(dist('formValidator.core.min.mjs')).href);
    assert.equal(typeof mod.checkValue, 'function');
    assert.equal(typeof mod.schema, 'function');
    assert.equal(mod.default, mod.FormValidator);
    assert.equal(mod.checkValue('x', 'email').valid, false);
    const esm = await import('form-and-file-validator/core');
    assert.equal(typeof esm.checkValues, 'function');
});

// ---------------------------------------------------------------- the subset builder
test('build-subset: only the chosen rules are registered, and the code shrinks', async () => {
    const full = await build({ rules: '*', engine: true });
    const small = await build({ rules: ['required', 'email', 'minlength'], engine: false });
    assert.ok(small.size < full.size / 2, small.size + ' vs ' + full.size);
    const F = new Function('module', 'exports', small.code + '\nreturn module.exports;');
    const m = { exports: {} };
    const FV = (F(m, m.exports), m.exports);
    assert.deepEqual(FV.ruleNames(), ['required', 'email', 'minlength']);
    assert.equal(FV.checkValue('x', ['required', 'email']).rule, 'email');
    assert.throws(() => FV.checkValue('x', 'digits'), /unknown rule "digits"/);
});
test('build-subset: an esm build, unknown names are refused, a full build keeps the engine, --list', async () => {
    const esm = await build({ rules: ['required'], engine: false, format: 'esm' });
    assert.match(esm.code, /export default module\.exports/);
    await assert.rejects(() => build({ rules: ['required', 'nope'] }), /Unknown rule\(s\): nope/);
    const ow = console.warn; const warns = []; console.warn = m => warns.push(String(m));
    try { await build({ rules: ['required', 'remote'], engine: false }); } finally { console.warn = ow; }
    assert.ok(warns.some(w => /remote/.test(w)), 'a rule that needs the engine is reported');
    const engine = await build({ rules: ['required'], engine: true });
    assert.match(engine.code, /unobtrusive/);
    const names = listRules();
    assert.ok(names.includes('email') && names.includes('unique') && names.length >= 55);
    assert.equal(new Set(names).size, names.length);
});
test('build-subset: the unminified output keeps readable source and marks what was left out', async () => {
    const r = await build({ rules: ['required'], engine: true, minify: false });
    assert.match(r.code, /rule email left out/);
    assert.doesNotMatch(r.code, /R\('email'/);
});

// ---------------------------------------------------------------- size budget (gzip, bytes): raise a number only on purpose
const BUDGET = {
    'formValidator.core.min.js': 16000,
    'formValidator.min.js': 35500,
    'fileValidator.min.js': 23000,
    'fileValidator.widget.min.js': 7500,
    'fileValidator.upload.min.js': 4500,
    'formValidator.jquery.min.js': 10500,
    'formValidator.additional.min.js': 5500,
    'formValidator.element.min.js': 5500,
    'formValidator.password.min.js': 4500,
    'locale.min.js': 2600,
    'integrations/alpine.min.js': 1500,
    'validator.min.js': 95000
};
for (const f of Object.keys(BUDGET)) {
    test('size budget: ' + f + ' stays under ' + (BUDGET[f] / 1024).toFixed(1) + ' KB gzip', () => {
        const size = gz(f);
        assert.ok(size <= BUDGET[f], f + ' is ' + size + ' bytes gzip, the budget is ' + BUDGET[f] + ' (update BUDGET in tests/core.test.js only if the growth is intended)');
    });
}
