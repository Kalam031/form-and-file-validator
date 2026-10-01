'use strict';
/*
 * Conformance: the JavaScript engine must give the answers written in spec/form-rules.vectors.json.
 * The same file is run by the .NET port (dotnet/) and the Angular package, so every platform behaves identically.
 */
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const FormValidator = require('../dist/formValidator.js');
const spec = require('../spec/form-rules.vectors.json');

test('the vectors file is sane', () => {
    assert.equal(spec.version, 1);
    assert.ok(spec.cases.length > 200);
    assert.ok(spec.cases.every(c => typeof c.valid === 'boolean' && 'rule' in c && typeof c.value === 'string'));
});

for (const [i, c] of spec.cases.entries()) {
    test('vector ' + i + ': ' + JSON.stringify(c.rule) + ' on ' + JSON.stringify(c.value) + ' -> ' + (c.valid ? 'valid' : 'invalid'), () => {
        const r = FormValidator.checkValue(c.value, c.rule, { values: c.values });
        assert.equal(r.valid, c.valid);
        if (c.failedRule) assert.equal(r.rule, c.failedRule);
        if (c.valid) assert.equal(r.message, '');
        else assert.ok(r.message.length > 0 && r.rule);
    });
}

test('checkValues validates an object and uses the other fields for equalTo', () => {
    const body = { email: 'a@b.co', pw: 'Abcdef1!', pw2: 'Abcdef1?', born: '31/04/2024', n: '3' };
    const r = FormValidator.checkValues(body, {
        email: ['required', 'email'], pw: { required: true, pwcheck: { minLength: 8 } }, pw2: { equalTo: 'pw' },
        born: { date: { format: 'd/M/y' } }, n: { range: [1, 5] }
    });
    assert.equal(r.valid, false);
    assert.deepEqual(Object.keys(r.errors).sort(), ['born', 'pw2']);
    assert.equal(r.details.born.rule, 'date');
});

test('checkValue refuses rules that need a form, and unknown rules', () => {
    assert.throws(() => FormValidator.checkValue('x', 'remote'), /server/);
    assert.throws(() => FormValidator.checkValue('x', 'fileType'), /files/);
    assert.throws(() => FormValidator.checkValue('x', 'nope'), /unknown rule/);
    assert.throws(() => FormValidator.checkValue('x', { equalTo: 'a' }), /options\.values/);
});

test('messages fill {min} / {max} and a custom message wins', () => {
    assert.match(FormValidator.checkValue('ab', { type: 'minlength', min: 3 }).message, /3/);
    assert.equal(FormValidator.checkValue('ab', { type: 'minlength', min: 3, message: 'Too short' }).message, 'Too short');
    assert.equal(FormValidator.checkValue('ab', { minlength: 3 }, { messages: { minlength: 'Kurz!' } }).message, 'Kurz!');
});

test('the legacy date rule keeps working as before (no format, not strict)', () => {
    const date = FormValidator.getRule('date').fn;
    assert.equal(date('2024-02-29', {}), true);
    assert.equal(date('2024-13-45', {}), false);
});
