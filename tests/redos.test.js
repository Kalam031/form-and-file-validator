'use strict';
// ReDoS guarantee: every built-in rule must stay fast on hostile 50,000-character input (no catastrophic or quadratic backtracking).
// Rules added later are covered automatically through FormValidator.ruleNames().
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { FormValidator } = require('../dist/validator.js');

const N = 50000, LIMIT_MS = 250;
const rep = (s, n = N) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
const inputs = {
    'a...': rep('a'), 'a...!': rep('a') + '!', '1...x': rep('1') + 'x', 'dots': rep('.'), 'a.a.': rep('a.'), 'a@a@': rep('a@'),
    'colons': rep(':'), '0:0:': rep('0:'), 'dashes': rep('-'), 'a-a-': rep('a-'), 'spaces+x': rep(' ') + 'x', 'x+spaces': 'x' + rep(' '), 'plus': rep('+') + '1',
    'parens': rep('('), 'digits+space': rep('1 '), 'é...': rep('é'), 'a=a=': rep('a='), 'slashes': rep('/'), 'http://a.': 'http://' + rep('a.'),
    'a@a.a.': 'a@' + rep('a.'), 'mixed': rep('aB1!-_.@ ')
};
const PARAMS = [true, 3, [2, 9], [1, 9], { minLength: 8 }, 'a'];

test('every built-in rule is fast on hostile input', () => {
    const slow = [];
    let covered = 0;
    for (const name of FormValidator.ruleNames()) {
        let params = null;
        for (const p of PARAMS) { try { FormValidator.checkValue('x', { [name]: p }); params = p; break; } catch (e) { /* needs a form, files or other params */ } }
        if (params === null) continue;
        covered++;
        for (const [label, text] of Object.entries(inputs)) {
            const once = () => { const t0 = process.hrtime.bigint(); try { FormValidator.checkValue(text, { [name]: params }); } catch (e) { /* a rule may reject by throwing; only time matters */ } return Number(process.hrtime.bigint() - t0) / 1e6; };
            let ms = once();
            if (ms > LIMIT_MS) ms = Math.min(ms, once());   // a busy machine (parallel tests) can stall one run; real backtracking is slow every time
            if (ms > LIMIT_MS) slow.push(name + ' on ' + label + ': ' + Math.round(ms) + ' ms');
        }
    }
    assert.ok(covered > 40, 'only ' + covered + ' rules were reachable');
    assert.deepEqual(slow, []);
});

test('every jQuery-layer method (country and bank checks included) is fast on hostile input', () => {
    const fs = require('fs'), path = require('path');
    const { JSDOM } = require('jsdom');
    const w = new JSDOM('<!doctype html><form id="f"><input name="a" id="a"><input name="b" id="b" value="5"></form>', { runScripts: 'outside-only', url: 'http://localhost/' }).window;
    w.eval(fs.readFileSync(path.join(__dirname, '../node_modules/jquery/dist/jquery.js'), 'utf8'));
    w.eval(fs.readFileSync(path.join(__dirname, '../dist/validator.js'), 'utf8'));
    const $ = w.jQuery, form = $('#f'), validator = form.validate(), el = w.document.getElementById('a');
    const skip = ['remote', 'required', 'equalTo', 'accept', 'require_from_group', 'skip_or_fill_minimum', 'maxfiles', 'maxsize', 'maxsizetotal', 'extension', 'filetype', 'filesize'];
    const slow = [];
    let covered = 0;
    for (const [name, fn] of Object.entries($.validator.methods)) {
        if (skip.includes(name)) continue;
        covered++;
        const param = /^(greaterThan|lessThan)/.test(name) ? '#b' : /^currency$/.test(name) ? '$' : name === 'creditcardtypes' ? { all: true } : true;
        for (const [label, text] of Object.entries(inputs)) {
            const once = () => { const t0 = process.hrtime.bigint(); try { fn.call(validator, text, el, param); } catch (e) { /* only time matters */ } return Number(process.hrtime.bigint() - t0) / 1e6; };
            let ms = once();
            if (ms > LIMIT_MS) ms = Math.min(ms, once());
            if (ms > LIMIT_MS) slow.push(name + ' on ' + label + ': ' + Math.round(ms) + ' ms');
        }
    }
    assert.ok(covered > 60, 'only ' + covered + ' methods were reachable');
    assert.deepEqual(slow, []);
});
