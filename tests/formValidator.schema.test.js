'use strict';
// FormValidator.schema(): the rules of an object as a Standard Schema (https://standardschema.dev), with parse / safeParse.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { FormValidator, locales } = require('../dist/validator.js');
require('../src/locales/de.js');

const signup = () => FormValidator.schema({
    email: ['required', 'email'],
    password: { required: true, pwcheck: { minLength: 8, requireDigit: true } },
    confirm: { equalTo: 'password' },
    nick: { minlength: 3 }
});
const good = { email: '  a@b.co ', password: ' Secret123 ', confirm: ' Secret123 ', nick: 'ab1' };

test('the schema has the Standard Schema shape', () => {
    const s = signup()['~standard'];
    assert.equal(s.version, 1);
    assert.equal(s.vendor, 'form-and-file-validator');
    assert.equal(typeof s.validate, 'function');
    assert.deepEqual(signup().fields, ['email', 'password', 'confirm', 'nick']);
});

test('validate() answers { value } for good data: text trimmed, passwords exactly as typed, other fields dropped', () => {
    const r = signup()['~standard'].validate(Object.assign({ extra: 'dropped', isAdmin: true }, good));
    assert.equal(r.issues, undefined);
    assert.deepEqual(r.value, { email: 'a@b.co', password: ' Secret123 ', confirm: 'Secret123', nick: 'ab1' });
});

test('validate() answers { issues } with the field as path and the failed rule, in the order of the rules', () => {
    const r = signup()['~standard'].validate({ email: 'nope', password: 'short', confirm: 'x', nick: 'a' });
    assert.equal(r.value, undefined);
    assert.deepEqual(r.issues.map(i => [i.path, i.rule]), [[['email'], 'email'], [['password'], 'pwcheck'], [['confirm'], 'equalTo'], [['nick'], 'minlength']]);
    assert.equal(r.issues[0].message, 'Please enter a valid email address.');
});

test('missing fields count as blank: required fails, optional rules are skipped', () => {
    const r = signup()['~standard'].validate({});
    assert.deepEqual(r.issues.map(i => i.path[0]), ['email', 'password']);
    assert.equal(r.issues[0].message, 'This field is required.');
    const v = FormValidator.schema({ note: { maxlength: 3 } })['~standard'].validate({});
    assert.deepEqual(v.value, { note: '' });
});

test('numbers, booleans and null are read like the form engine reads them', () => {
    const s = FormValidator.schema({ age: { required: true, min: 18 }, agree: 'required', note: { maxlength: 5 } });
    assert.deepEqual(s.parse({ age: 21, agree: true, note: null }), { age: '21', agree: 'true', note: '' });
    assert.equal(s.safeParse({ age: 17, agree: true }).errors.age, 'Please enter a value no less than 18.');
});

test('input that is not an object is one issue about the whole value', () => {
    for (const bad of [null, undefined, 'text', 42, [1, 2]]) {
        const r = signup()['~standard'].validate(bad);
        assert.deepEqual(r.issues, [{ message: 'Expected an object.', path: [] }]);
    }
});

test('safeParse() never throws and gives { field: message }', () => {
    const ok = signup().safeParse(good);
    assert.deepEqual([ok.success, ok.issues, ok.errors], [true, [], {}]);
    assert.equal(ok.data.email, 'a@b.co');
    const bad = signup().safeParse({ email: 'x', password: 'Secret123', confirm: 'nope' });
    assert.equal(bad.success, false);
    assert.equal(bad.data, undefined);
    assert.deepEqual(bad.errors, { email: 'Please enter a valid email address.', confirm: 'Values do not match.' });
    assert.ok(bad.error instanceof FormValidator.ValidationError);
    assert.ok(bad.error instanceof Error);
});

test('parse() returns the values or throws a ValidationError that lists every problem', () => {
    assert.equal(signup().parse(good).nick, 'ab1');
    assert.throws(() => signup().parse({ email: 'x' }), e => {
        assert.equal(e.name, 'ValidationError');
        assert.equal(e.message, 'Please enter a valid email address.');
        assert.deepEqual(Object.keys(e.errors), ['email', 'password']);
        assert.equal(e.issues.length, 2);
        return true;
    });
});

test('options: your messages, trim: false, and the language of the current locale', () => {
    const s = FormValidator.schema({ email: ['required', 'email'], name: 'required' }, { messages: { required: 'Pflichtfeld' }, trim: false });
    assert.equal(s.safeParse({ email: 'a@b.co', name: '' }).errors.name, 'Pflichtfeld');
    assert.equal(s.parse({ email: 'a@b.co', name: ' x ' }).name, ' x ', 'trim: false keeps the spaces');
    locales.use('de');
    try { assert.equal(signup().safeParse({ email: 'x' }).errors.email, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'); } finally { locales.use('en'); }
});

test('check() is the checkValues() answer', () => {
    const r = signup().check({ email: 'x', password: 'Secret123', confirm: 'Secret123' });
    assert.equal(r.valid, false);
    assert.equal(r.details.email.rule, 'email');
});

test('a rule that cannot run on plain values is a mistake in the rules and throws, like checkValues', () => {
    assert.throws(() => FormValidator.schema({ f: 'file' })['~standard'].validate({ f: 'x' }), /needs a form/);
    assert.throws(() => FormValidator.schema({ f: 'noSuchRule' }).parse({ f: 'x' }), /unknown rule/);
});

test('every new rule of 2.8 works inside a schema', () => {
    const s = FormValidator.schema({ id: 'uuid', ip: 'ipv4', iban: 'iban', slug: 'slug', tag: { startsWith: 'fv-' } });
    assert.equal(s.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000', ip: '10.0.0.1', iban: 'DE89 3704 0044 0532 0130 00', slug: 'a-b', tag: 'fv-x' }).success, true);
    assert.deepEqual(Object.keys(s.safeParse({ id: 'x', ip: '999.1.1.1', iban: 'DE00', slug: 'A', tag: 'x' }).errors), ['id', 'ip', 'iban', 'slug', 'tag']);
});

// ---------------------------------------------------------------- real consumers of Standard Schema
test('React Hook Form: its official Standard Schema resolver accepts the schema and maps the errors to fields', async () => {
    const { standardSchemaResolver } = require('@hookform/resolvers/standard-schema');
    const resolver = standardSchemaResolver(signup());
    const okResult = await resolver(good, undefined, { fields: {}, shouldUseNativeValidation: false });
    assert.deepEqual(okResult.errors, {});
    assert.equal(okResult.values.email, 'a@b.co');
    const bad = await resolver({ email: 'x', password: 'Secret123', confirm: 'no', nick: 'ab' }, undefined, { fields: {}, shouldUseNativeValidation: false });
    assert.deepEqual(Object.keys(bad.errors).sort(), ['confirm', 'email', 'nick']);
    assert.equal(bad.errors.email.message, 'Please enter a valid email address.');
    assert.deepEqual(bad.values, {});
});

test('a hand-written consumer following the specification works with sync and async handling', async () => {
    // exactly what the specification shows: await the result, then look at `issues`
    async function run(schema, input) {
        let result = schema['~standard'].validate(input);
        if (result instanceof Promise) result = await result;
        if (result.issues) return { ok: false, messages: result.issues.map(i => (i.path || []).join('.') + ': ' + i.message) };
        return { ok: true, value: result.value };
    }
    assert.deepEqual((await run(signup(), good)).value.email, 'a@b.co');
    assert.deepEqual((await run(signup(), { email: 'x' })).messages, ['email: Please enter a valid email address.', 'password: This field is required.']);
});
