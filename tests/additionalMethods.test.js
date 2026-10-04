'use strict';
// Differential test: every method of the jQuery Validation plugin (jquery.validate.js + additional-methods.js) must give the same
// answer in our jQuery layer, for the same value, parameter and element.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const jqSrc = fs.readFileSync(path.join(__dirname, '../node_modules/jquery/dist/jquery.js'), 'utf8');
const pluginDir = path.dirname(path.join(__dirname, '../node_modules/jquery-validation/dist/jquery.validate.js'));
const read = f => fs.readFileSync(f, 'utf8');

function world(files) {
    const w = new JSDOM('<!doctype html><form id="f"><input name="a" id="a"><input name="b" id="b" value="5"><input type="file" name="up" id="up"></form>',
        { runScripts: 'outside-only', url: 'http://localhost/' }).window;
    w.eval(jqSrc);
    for (const f of files) w.eval(f);
    return w;
}

const original = world([read(path.join(pluginDir, 'jquery.validate.js')), read(path.join(pluginDir, 'additional-methods.js'))]);
const ours = world([read(path.join(__dirname, '../dist/validator.js'))]);

const PROBES = ['', ' ', 'a', 'abc', 'abc def', '0', '1', '-1', '12', '123', '12345', '1234567', '123456789', '12.50', '1,234.50', '$12.50', '12345-6789',
    '90210', '90210-1234', '4111111111111111', '4111 1111 1111 1111', '12345678909', '52998224725', '111.444.777-35', '11444777000161', '11.444.777/0001-61',
    'NL91ABNA0417164300', 'DEUTDEFF', 'DEUTDEFF500', 'A58818501', 'X1234567L', '12345678Z', 'SW1A 1AA', 'M1 1AA', 'K1A 0B1', 'K1A0B1', '1234 AB', '1234AB',
    '07911123456', '+447911123456', '020 7946 0958', '(555) 123-4567', '+31 6 12345678', '0612345678', '+48 123 456 789', '123-456-789',
    '2012-06-01', '01/06/2012', '31/12/2012', '1391/01/15', '1391-01-15', '255.255.255.0', '255.0.255.0', '1HGCM82633A004352', '021000021', '123456780',
    '1234.5', '3,5', 'USD 12', '12 456 789', '019283746', 'http://a.b', 'a.com', 'www.a.com', 'foo'];

const PARAMS = {
    greaterThan: ['#b'], greaterThanEqual: ['#b'], lessThan: ['#b'], lessThanEqual: ['#b'],
    strippedminlength: [3], creditcardtypes: [{ visa: true }, { mastercard: true }, { all: true }],
    currency: ['$', ['$', true], ['USD', false]], maxfiles: [1], maxsize: [1000], maxsizetotal: [1000], bic: [true], zipcodeUS: [true]
};
const elementFor = (name, w) => w.document.getElementById(/^(maxfiles|maxsize|maxsizetotal)$/.test(name) ? 'up' : 'a');

test('every method name of the original plugin exists in the bundle, with a message', () => {
    const want = Object.keys(original.jQuery.validator.methods), have = ours.jQuery.validator.methods;
    assert.deepEqual(want.filter(n => !have[n]), []);
    assert.deepEqual(want.filter(n => original.jQuery.validator.messages[n] && !ours.jQuery.validator.messages[n]), []);
});

test('all methods answer like the original plugin on a wide set of probe values', () => {
    const names = Object.keys(original.jQuery.validator.methods).filter(n => !['remote', 'required', 'equalTo', 'accept', 'require_from_group', 'skip_or_fill_minimum'].includes(n));
    const diffs = [];
    let compared = 0;
    for (const name of names) {
        const params = PARAMS[name] || [true, 3, [2, 5]];
        for (const param of params) for (const value of PROBES) {
            const run = w => {
                const $ = w.jQuery;
                const form = $('#f');
                const validator = $.data(form[0], 'validator') || form.validate();
                // 'dependency-mismatch' (an empty optional field) means "valid, skip the message" like true
                try { const r = $.validator.methods[name].call(validator, value, elementFor(name, w), param); return r === 'dependency-mismatch' ? 'true' : String(!!r === r ? r : !!r); } catch (e) { return 'throws'; }
            };
            const a = run(original), b = run(ours);
            compared++;
            if (a !== b) diffs.push(name + '(' + JSON.stringify(value) + ', ' + JSON.stringify(param) + '): original ' + a + ', ours ' + b);
        }
    }
    assert.ok(compared > 5000, 'compared ' + compared);
    assert.deepEqual(diffs.slice(0, 20), []);
});

test('spot checks: real numbers pass, near misses fail', () => {
    const $ = ours.jQuery, v = $('#f').validate(), m = (n, val, p) => {
        const el = ours.document.getElementById('a'); el.value = val;      // a field with a value is not "optional"
        return !!$.validator.methods[n].call(v, val, el, p === undefined ? true : p);   // some originals return the regex match, which is truthy
    };
    assert.equal(m('abaRoutingNumber', '021000021'), true);
    assert.equal(m('abaRoutingNumber', '021000022'), false);
    assert.equal(m('cpfBR', '529.982.247-25'), true);
    assert.equal(m('cpfBR', '529.982.247-26'), false);
    assert.equal(m('cnpjBR', '11.444.777/0001-61'), true);
    assert.equal(m('bic', 'DEUTDEFF500'), true);
    assert.equal(m('bic', 'DEUTDEF'), false);
    assert.equal(m('postcodeUK', 'SW1A 1AA'), true);
    assert.equal(m('postalCodeCA', 'K1A 0B1'), true);
    assert.equal(m('vinUS', '1HGCM82633A004352'), true);
    assert.equal(m('zipcodeUS', '90210-1234'), true);
    assert.equal(m('zipcodeUS', '9021'), false);
    assert.equal(m('nifES', '12345678Z'), true);
    assert.equal(m('phoneUK', '07911123456'), true);
});
