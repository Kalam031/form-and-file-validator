'use strict';
// fromZod() / fromYup(): existing schemas become rules. The same payloads must pass or fail in both worlds.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { FormValidator } = require('../dist/validator.js');
const { z } = require('zod');
const yup = require('yup');

const errorsOf = (rules, data) => Object.keys(FormValidator.checkValues(data, rules).errors).sort();
const zodErrors = (schema, data) => { const r = schema.safeParse(data); return r.success ? [] : [...new Set(r.error.issues.map(i => i.path.join('.').replace(/\.(\d+)\./g, '[$1].').replace(/\.(\d+)$/, '[$1]')))].sort(); };

test('fromZod: the rules and a verdict that agrees with Zod itself', () => {
    const schema = z.object({
        name: z.string().min(2).max(10),
        email: z.email(),
        age: z.number().int().min(18).max(99).optional(),
        plan: z.enum(['free', 'pro']),
        site: z.string().url().optional(),
        code: z.string().regex(/^[A-Z]{3}$/),
        address: z.object({ zip: z.string().length(5) }),
        items: z.array(z.object({ sku: z.string().min(1), qty: z.number().min(1) })).min(1).max(3)
    });
    const rules = FormValidator.fromZod(schema);
    assert.deepEqual(Object.keys(rules).sort(), ['address.zip', 'age', 'code', 'email', 'items', 'items[].qty', 'items[].sku', 'name', 'plan', 'site']);
    const good = { name: 'Bob', email: 'a@b.co', age: 30, plan: 'pro', site: 'https://a.co', code: 'ABC', address: { zip: '12345' }, items: [{ sku: 'x', qty: 2 }] };
    assert.deepEqual(errorsOf(rules, good), []);
    const bad = { name: 'B', email: 'nope', age: 12, plan: 'gold', site: 'x', code: 'abc', address: { zip: '1' }, items: [{ sku: 'x', qty: 0 }] };
    assert.deepEqual(errorsOf(rules, bad), zodErrors(schema, bad));
    assert.deepEqual(errorsOf(rules, Object.assign({}, good, { items: [] })), ['items']);
    assert.deepEqual(errorsOf(rules, Object.assign({}, good, { age: '', site: '' })), [], 'optional fields may stay empty');
});
test('fromZod: optional / default / nullable are not required, literals and coerce are read, the rest is reported', () => {
    const seen = [];
    const rules = FormValidator.fromZod(z.object({
        a: z.string().optional(), b: z.string().default('x'), c: z.string().nullable(), d: z.literal('yes'), e: z.coerce.number().min(1),
        f: z.string().refine(v => v !== 'no'), g: z.union([z.string(), z.number()]), h: z.number().positive(), i: z.string().regex(/a/i), j: z.string().startsWith('ab')
    }), { onUnsupported: (p, w) => seen.push(p + ':' + w) });
    assert.equal(errorsOf(rules, { a: '', b: '', c: 'x', d: 'yes', e: '2', f: 'ok', g: 'x', h: '1', i: 'a', j: 'ab' }).join(), '');
    assert.deepEqual(errorsOf(rules, { c: '', d: 'no', e: '0', f: 'ok', g: 'x', h: '1', i: 'a', j: 'xx' }), ['c', 'd', 'e', 'j']);
    assert.ok(seen.some(s => /^f:/.test(s)), 'refine is reported: ' + seen);
    assert.ok(seen.some(s => /^g:/.test(s)), 'union is reported');
    assert.ok(seen.some(s => /exclusive/.test(s)), 'exclusive bound is reported');
    assert.ok(seen.some(s => /^i:/.test(s)), 'regex flags are reported');
});
test('fromZod and fromYup never throw on junk', () => {
    for (const bad of [null, undefined, 5, 'x', {}, { _zod: {} }, { describe() { throw new Error('boom'); } }, { describe: () => null }]) {
        assert.deepEqual(FormValidator.fromZod(bad), {});
        assert.deepEqual(FormValidator.fromYup(bad), {});
    }
});
test('fromYup: required, formats, limits, nested objects and rows, agreeing with Yup', () => {
    const schema = yup.object({
        name: yup.string().required().min(2).max(10),
        email: yup.string().required().email(),
        age: yup.number().integer().min(18).max(99),
        plan: yup.string().required().oneOf(['free', 'pro']),
        code: yup.string().matches(/^[A-Z]{3}$/),
        address: yup.object({ zip: yup.string().required().length(5) }),
        items: yup.array(yup.object({ qty: yup.number().required().min(1) })).min(1)
    });
    const rules = FormValidator.fromYup(schema);
    assert.deepEqual(Object.keys(rules).sort(), ['address.zip', 'age', 'code', 'email', 'items', 'items[].qty', 'name', 'plan']);
    const good = { name: 'Bob', email: 'a@b.co', age: 30, plan: 'pro', code: 'ABC', address: { zip: '12345' }, items: [{ qty: 2 }] };
    assert.deepEqual(errorsOf(rules, good), []);
    assert.equal(schema.isValidSync(good), true);
    const bad = { name: 'B', email: 'nope', age: 12, plan: 'gold', code: 'abc', address: { zip: '1' }, items: [{ qty: 0 }] };
    const yupBad = (() => { try { schema.validateSync(bad, { abortEarly: false }); return []; } catch (e) { return [...new Set(e.inner.map(i => i.path.replace(/\.\[/g, '[')))].sort(); } })();
    assert.deepEqual(errorsOf(rules, bad), yupBad);
    assert.deepEqual(errorsOf(rules, { name: '', email: '', plan: '', address: { zip: '' }, items: [] }), ['address.zip', 'email', 'items', 'name', 'plan']);
});
test('fromYup: reports tests it cannot read', () => {
    const seen = [];
    FormValidator.fromYup(yup.object({ a: yup.string().test('mine', 'no', v => v !== 'x'), b: yup.number().positive() }), { onUnsupported: (p, w) => seen.push(p + ':' + w) });
    assert.ok(seen.some(s => s === 'a:mine'), String(seen));
    assert.ok(seen.some(s => /exclusive/.test(s)), String(seen));
});
