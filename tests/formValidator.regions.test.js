'use strict';
// postalCode / phoneCountry rules and FormValidator.regions (inputs add-on): plausibility per country.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { FormValidator } = require('../dist/validator.js');

const R = FormValidator.regions;

test('postal codes: real examples pass, wrong shapes fail, an unknown country has no opinion', () => {
    const good = { US: ['90210', '90210-1234'], CA: ['K1A 0B1', 'k1a0b1'], GB: ['SW1A 1AA', 'EC1A 1BB', 'M1 1AE', 'B33 8TH', 'gir 0aa'], DE: ['10115'], FR: ['75001'], NL: ['1012 AB', '1012AB'], PL: ['00-950'], PT: ['1000-001'],
        JP: ['100-0001', '1000001'], BR: ['01310-100', '01310100'], IE: ['D02 X285'], SE: ['114 55', '11455'], AR: ['C1425ABC', '1425'], IN: ['110001'], ES: ['28001', '52001'], CH: ['8001'] };
    for (const c of Object.keys(good)) good[c].forEach(v => assert.equal(R.isPostalCode(v, c), true, c + ' ' + v));
    const bad = { US: ['9021', '90210-12', 'abcde'], CA: ['D1A 0B1', '12345'], GB: ['12345', 'SW1A1', 'ZZZ ZZZ'], DE: ['1011', '101155'], NL: ['0123 AB', '1012 A'], PL: ['00950'], IN: ['011001'], ES: ['00001', '53000'], CH: ['0123'] };
    for (const c of Object.keys(bad)) bad[c].forEach(v => assert.equal(R.isPostalCode(v, c), false, c + ' ' + v));
    assert.equal(R.isPostalCode('whatever', 'HK'), null);
    assert.equal(R.isPostalCode('x', ''), null);
    assert.equal(R.isPostalCode('x', '__proto__'), null);
    assert.equal(R.isPostalCode('90210', ' us '), true, 'case and spaces of the country code do not matter');
});
test('phone numbers: international and national forms, trunk 0, length per country', () => {
    const yes = [['+44 20 7946 0958', 'GB'], ['020 7946 0958', 'GB'], ['+44 (0) 20 7946 0958', 'GB'], ['0044 20 7946 0958', 'GB'], ['(212) 555-0123', 'US'], ['+1 212 555 0123', 'US'], ['1-212-555-0123', 'US'],
        ['+33 1 23 45 67 89', 'FR'], ['01 23 45 67 89', 'FR'], ['+49 30 123456', 'DE'], ['+91 98765 43210', 'IN'], ['98765 43210', 'IN'], ['8 912 345 67 89', 'RU'], ['+7 912 345 67 89', 'RU'], ['+81 3-1234-5678', 'JP']];
    yes.forEach(([v, c]) => assert.equal(R.isPhone(v, c), true, c + ' ' + v));
    const no = [['+1 212 555 0123', 'GB'], ['12345', 'GB'], ['+44 123', 'GB'], ['212 555', 'US'], ['abc', 'US'], ['+33 1 23 45', 'FR'], ['+91 12345', 'IN'], ['', 'US'], ['+44 20 7946 0958 ext 5', 'GB']];
    no.forEach(([v, c]) => assert.equal(R.isPhone(v, c), false, c + ' ' + v));
    assert.equal(R.isPhone('123', 'XX'), null);
    assert.equal(R.callingCode('gb'), 44);
    assert.equal(R.callingCode('zz'), null);
    assert.ok(R.postalCodes.length >= 55 && R.phoneCountries.length >= 50);
});
test('rules: a fixed country, a country taken from another field, empty values, translated messages', () => {
    const rules = { country: 'required', zip: { postalCode: { countryField: 'country' } }, phone: { phoneCountry: { countryField: 'country' } }, fixed: { postalCode: { country: 'US' } } };
    const run = data => FormValidator.checkValues(data, rules).errors;
    assert.deepEqual(Object.keys(run({ country: 'GB', zip: 'SW1A 1AA', phone: '020 7946 0958', fixed: '90210' })), []);
    assert.deepEqual(Object.keys(run({ country: 'GB', zip: '90210', phone: '12345', fixed: 'SW1A 1AA' })).sort(), ['fixed', 'phone', 'zip']);
    assert.deepEqual(Object.keys(run({ country: 'US', zip: '90210', phone: '(212) 555-0123', fixed: '90210' })), []);
    assert.deepEqual(Object.keys(run({ country: 'HK', zip: 'anything', phone: '12345678', fixed: '' })), [], 'no postal system: accepted; empty is optional');
    assert.deepEqual(Object.keys(run({ country: '', zip: 'x', phone: 'x', fixed: '' })), ['country'], 'no country chosen yet: no opinion');
    const r = FormValidator.checkValue('1', { postalCode: { country: 'US' } });
    assert.equal(r.valid, false);
    assert.equal(r.message, FormValidator.messages.postalCode);
});
