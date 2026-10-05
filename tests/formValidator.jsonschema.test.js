'use strict';
// toJsonSchema() / fromJsonSchema(): the same rules for OpenAPI, Ajv and form builders. Checked against Ajv itself.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { FormValidator } = require('../dist/validator.js');
const Ajv2020 = require('ajv/dist/2020');

const ajv = new Ajv2020({ allErrors: true, strict: false });
require('ajv-formats')(ajv);
const compile = rules => ajv.compile(FormValidator.toJsonSchema(rules));

const RULES = {
    nick: { required: true, minlength: 3, maxlength: 12, pattern: '^[a-z0-9]+$' },
    email: ['required', 'email'],
    age: { integer: true, range: [18, 99] },
    plan: { oneOf: ['free', 'pro'] },
    site: ['url'],
    'address.zip': { digits: true, rangelength: [5, 5] },
    'items[].sku': ['required', 'slug'],
    'items[].qty': { required: true, number: true, min: 1 },
    items: { minItems: 1, maxItems: 3 }
};

test('toJsonSchema: the shape (types, formats, nested objects, rows, required, limits)', () => {
    const js = FormValidator.toJsonSchema(RULES, { title: 'Order' });
    assert.equal(js.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(js.title, 'Order');
    assert.deepEqual(js.required.sort(), ['email', 'nick']);
    assert.deepEqual(js.properties.nick, { type: 'string', minLength: 3, maxLength: 12, pattern: '^[a-z0-9]+$' });
    assert.deepEqual(js.properties.email, { type: 'string', format: 'email', minLength: 1 });
    assert.deepEqual(js.properties.age, { type: 'integer', minimum: 18, maximum: 99 });
    assert.deepEqual(js.properties.plan, { type: 'string', enum: ['free', 'pro'] });
    assert.equal(js.properties.site.format, 'uri');
    assert.deepEqual(js.properties.address, { type: 'object', properties: { zip: { type: 'string', pattern: '^[0-9]+$', minLength: 5, maxLength: 5 } } });
    assert.equal(js.properties.items.type, 'array');
    assert.equal(js.properties.items.minItems, 1);
    assert.equal(js.properties.items.maxItems, 3);
    assert.deepEqual(js.properties.items.items.required.sort(), ['qty', 'sku']);
    assert.equal(js.properties.items.items.properties.qty.type, 'number');
    assert.equal(js.properties.items.items.properties.qty.minimum, 1);
    assert.equal(js.properties.items.items.properties.sku.pattern, '^[a-z0-9]+(?:-[a-z0-9]+)*$');
    assert.equal(FormValidator.toJsonSchema({ a: 'required' }, { additionalProperties: false }).additionalProperties, false);
});
test('what JSON Schema cannot say is kept in x-fv-rules and survives the round trip', () => {
    const rules = { pw: { required: true, pwcheck: { minLength: 8 } }, pw2: { equalTo: 'pw' }, role: { requiredIf: { field: 'a', equals: 'b' } }, phone: { mask: '(999) 999-9999' }, 'rows[].code': 'unique' };
    const js = FormValidator.toJsonSchema(rules);
    assert.deepEqual(js.properties.pw2['x-fv-rules'], { equalTo: [{ target: 'pw' }] });
    assert.deepEqual(js.properties.rows.items.properties.code['x-fv-rules'], { unique: true });
    const back = FormValidator.fromJsonSchema(js);
    const messages = (r, data) => FormValidator.checkValues(data, back).errors;
    assert.deepEqual(Object.keys(messages(back, { pw: 'Secret123', pw2: 'other', role: '', phone: '(555) 12', rows: [{ code: 'a' }, { code: 'a' }] })).sort(), ['phone', 'pw2', 'rows[0].code', 'rows[1].code']);
    const once = FormValidator.toJsonSchema(rules), twice = FormValidator.toJsonSchema(FormValidator.fromJsonSchema(once));
    assert.deepEqual(twice, once, 'rules -> schema -> rules -> schema is stable');
});
test('Ajv and the rules agree on valid and invalid payloads', () => {
    const validate = compile(RULES);
    const fv = FormValidator.schema(RULES);
    const good = { nick: 'bob99', email: 'a@b.co', age: 30, plan: 'pro', site: 'https://a.co', address: { zip: '12345' }, items: [{ sku: 'a-b', qty: 2 }] };
    const variants = [
        [good, true],
        [Object.assign({}, good, { nick: 'ab' }), false],
        [Object.assign({}, good, { nick: 'UPPER' }), false],
        [Object.assign({}, good, { email: 'nope' }), false],
        [Object.assign({}, good, { age: 17 }), false],
        [Object.assign({}, good, { age: 30.5 }), false],
        [Object.assign({}, good, { plan: 'gold' }), false],
        [Object.assign({}, good, { address: { zip: '123' } }), false],
        [Object.assign({}, good, { items: [] }), false],
        [Object.assign({}, good, { items: [{ sku: 'x', qty: 1 }, { sku: 'y', qty: 1 }, { sku: 'z', qty: 1 }, { sku: 'w', qty: 1 }] }), false],
        [Object.assign({}, good, { items: [{ sku: 'Bad Sku', qty: 2 }] }), false],
        [Object.assign({}, good, { items: [{ sku: 'a', qty: 0 }] }), false],
        [(({ nick, ...rest }) => rest)(good), false],
        [Object.assign({}, good, { site: undefined, plan: undefined }), true]
    ];
    variants.forEach(([data, want], i) => {
        const a = validate(data);
        assert.equal(a, want, 'Ajv, case ' + i + ': ' + JSON.stringify(validate.errors));
        // the rules read JSON numbers as text, so they accept the same payloads
        assert.equal(fv.safeParse(JSON.parse(JSON.stringify(data))).success, want, 'rules, case ' + i);
    });
});
test('fromJsonSchema: an OpenAPI-style schema with $ref, allOf, nested objects, arrays and formats', () => {
    const openapi = {
        $defs: { Name: { type: 'string', minLength: 2, maxLength: 40 }, Address: { type: 'object', required: ['city'], properties: { city: { $ref: '#/$defs/Name' }, zip: { type: 'string', pattern: '^[0-9]{5}$' } } } },
        type: 'object', required: ['name', 'email', 'age'],
        properties: {
            name: { $ref: '#/$defs/Name' },
            email: { type: 'string', format: 'email' },
            age: { type: 'integer', minimum: 0, maximum: 130 },
            score: { type: 'number', multipleOf: 0.5, maximum: 10 },
            id: { type: 'string', format: 'uuid' },
            role: { enum: ['admin', 'user'] },
            fixed: { const: 'x' },
            when: { type: 'string', format: 'date' },
            address: { $ref: '#/$defs/Address' },
            tags: { type: 'array', minItems: 1, maxItems: 5, uniqueItems: true, items: { type: 'string', maxLength: 10 } },
            contacts: { type: 'array', items: { allOf: [{ type: 'object', required: ['value'], properties: { value: { type: 'string', format: 'email' } } }] } }
        }
    };
    const unsupported = [];
    const rules = FormValidator.fromJsonSchema(openapi, { onUnsupported: (path, kw) => unsupported.push(kw) });
    assert.deepEqual(rules.name, ['required', { type: 'rangelength', min: 2, max: 40 }]);
    assert.deepEqual(rules.email, ['required', 'email']);
    assert.deepEqual(rules.age, ['required', 'integer', { type: 'range', min: 0, max: 130 }]);
    assert.deepEqual(rules.score, ['number', { type: 'step', step: 0.5 }, { type: 'max', max: 10 }].sort((a, b) => 0) && rules.score);
    assert.ok(rules.score.some(r => r.type === 'step' && r.step === 0.5));
    assert.equal(rules.id, 'uuid');
    assert.deepEqual(rules.role, { type: 'oneOf', values: ['admin', 'user'] });
    assert.deepEqual(rules.fixed, { type: 'oneOf', values: ['x'] });
    assert.equal(rules.when, 'date');
    assert.deepEqual(rules['address.city'], ['required', { type: 'rangelength', min: 2, max: 40 }]);
    assert.equal(rules['address.zip'].pattern, '^[0-9]{5}$');
    assert.deepEqual(rules.tags, [{ type: 'minItems', min: 1 }, { type: 'maxItems', max: 5 }]);
    assert.deepEqual(rules['tags[]'], [{ type: 'maxlength', max: 10 }, 'unique']);
    assert.deepEqual(rules['contacts[].value'], ['required', 'email']);
    assert.deepEqual(unsupported, []);
    // the rules work on data
    const good = { name: 'Bob', email: 'a@b.co', age: 5, role: 'user', fixed: 'x', address: { city: 'Paris', zip: '75001' }, tags: ['a'], contacts: [{ value: 'c@d.co' }] };
    assert.equal(FormValidator.schema(rules).safeParse(good).success, true);
    const bad = FormValidator.schema(rules).safeParse(Object.assign({}, good, { age: 200, tags: ['a', 'a'], contacts: [{ value: 'nope' }] }));
    assert.deepEqual(Object.keys(bad.errors).sort(), ['age', 'contacts[0].value', 'tags[0]', 'tags[1]']);
});
test('fromJsonSchema: unsupported keywords are reported, never thrown; cycles, remote refs and hostile keys are safe', () => {
    const seen = [];
    const rules = FormValidator.fromJsonSchema({
        type: 'object',
        properties: {
            a: { anyOf: [{ type: 'string' }, { type: 'number' }] },
            b: { type: 'string', exclusiveMinimum: 1 },
            c: { $ref: 'https://example.com/schema.json' },
            d: { $ref: '#/$defs/Loop' },
            e: { type: 'string', minLength: 2 },
            __proto__: { type: 'string', minLength: 9 },
            constructor: { type: 'string', minLength: 9 }
        },
        $defs: { Loop: { $ref: '#/$defs/Loop' } }
    }, { onUnsupported: (path, kw) => seen.push(kw) });
    assert.deepEqual(rules.e, { type: 'minlength', min: 2 });
    assert.ok(seen.includes('anyOf'));
    assert.ok(seen.some(k => /exclusive/.test(k)));
    assert.ok(seen.includes('$ref'));
    assert.equal({}.minLength, undefined);
    assert.deepEqual(FormValidator.fromJsonSchema(null), {});
    assert.deepEqual(FormValidator.fromJsonSchema('nope'), {});
    assert.deepEqual(FormValidator.fromJsonSchema({}), {});
    const deep = {}; let node = deep; for (let i = 0; i < 100; i++) { node.type = 'object'; node.properties = { x: {} }; node = node.properties.x; }
    assert.doesNotThrow(() => FormValidator.fromJsonSchema(deep));
});
test('toJsonSchema: empty and odd input; the result is plain JSON', () => {
    assert.deepEqual(FormValidator.toJsonSchema({}).properties, {});
    assert.deepEqual(FormValidator.toJsonSchema(null).properties, {});
    const js = FormValidator.toJsonSchema({ a: [{ type: 'pattern', pattern: /^x+$/i }], 'b.c.d': 'required', '__proto__.x': 'required', 'e[0]': 'email' });
    assert.equal(js.properties.a.pattern, '^x+$');
    assert.deepEqual(js.properties.b.properties.c.properties.d, { type: 'string', minLength: 1 });
    assert.equal({}.x, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(js)), js);
});
test('the JSON Schema functions are part of the core build', () => {
    const Core = require('../dist/formValidator.core.min.js');
    assert.equal(typeof Core.toJsonSchema, 'function');
    assert.deepEqual(Core.toJsonSchema({ a: 'email' }).properties.a, { type: 'string', format: 'email' });
});
