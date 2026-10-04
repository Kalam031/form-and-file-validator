'use strict';
// Messages, option shorthand and languages of the rules added in 2.8.0 (what passes and fails is in spec/form-rules.vectors.json).
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { FormValidator, locales } = require('../dist/validator.js');   // the bundle: one registry for the rules and the language packs
require('../src/locales/de.js');
const check = (v, r, o) => FormValidator.checkValue(v, r, o);

test('every new rule has an English message with its placeholders filled', () => {
    assert.equal(check('x', { startsWith: 'AB' }).message, 'Must start with AB.');
    assert.equal(check('x', { type: 'endsWith', value: '.pdf' }).message, 'Must end with .pdf.');
    assert.equal(check('x', { type: 'contains', value: 'z' }).message, 'Must contain z.');
    assert.equal(check('a b', { minWords: 3 }).message, 'Please enter at least 3 words.');
    assert.equal(check('a b c', { maxWords: 2 }).message, 'Please enter no more than 2 words.');
    assert.equal(check('x', 'uuid').message, 'Please enter a valid UUID.');
    assert.equal(check('x', 'hexColor').message, 'Please enter a valid hex color, like #1a2b3c.');
    assert.equal(check('admin', { notOneOf: ['admin'] }).message, 'This value is not allowed.');
});

test('the jQuery-style shorthand reads the parameter of each new rule', () => {
    assert.equal(check('hello', { startsWith: 'he', endsWith: 'lo', contains: 'ell', minWords: 1, maxWords: 1 }).valid, true);
    assert.equal(check('hello', { startsWith: 'x' }).valid, false);
    assert.equal(check('root', { notOneOf: ['admin', 'root'] }).valid, false);
    assert.equal(check('user', { notOneOf: 'admin' }).valid, true);
});

test('blank values skip the new rules like every other rule except required', () => {
    for (const r of ['integer', 'uuid', 'hexColor', 'slug', 'ipv4', 'ipv6', 'iban', 'time', 'domain', 'base64', 'mac', 'latitude', 'longitude', { startsWith: 'x' }, { minWords: 3 }])
        assert.equal(check('', r).valid, true, JSON.stringify(r));
});

test('a language pack translates the new messages and keeps the placeholders', () => {
    locales.use('de');
    try {
        assert.equal(check('x', { startsWith: 'AB' }).message, 'Muss mit AB beginnen.');
        assert.equal(check('a', { minWords: 3 }).message, 'Bitte geben Sie mindestens 3 Wörter ein.');
        assert.equal(check('x', 'iban').message, 'Bitte geben Sie eine gültige IBAN ein.');
    } finally { locales.use('en'); }
});

test('the rules work on a whole object and in a real form', () => {
    const r = FormValidator.checkValues({ id: 'nope', ip: '10.0.0.1', mac: '00:11:22:33:44:55', zone: '25:00' }, {
        id: 'uuid', ip: ['required', 'ipv4'], mac: 'mac', zone: ['time']
    });
    assert.deepEqual(Object.keys(r.errors).sort(), ['id', 'zone']);
});
