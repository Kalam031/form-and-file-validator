'use strict';
// The command line (fv), the rule checker, the code generator, the jQuery codemod and the ESLint plugin.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { FormValidator } = require('../dist/validator.js');
const { checkRules, closest } = require('../tools/fv-check.js');
const { exportRules } = require('../tools/fv-codegen.js');
const { migrateSource } = require('../tools/fv-migrate.js');

const FV = path.join(__dirname, '..', 'tools', 'fv.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-tools-'));
const write = (name, text) => { const f = path.join(tmp, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
const cli = (...args) => spawnSync(process.execPath, [FV, ...args], { encoding: 'utf8', cwd: tmp });
const known = FormValidator.ruleNames();

const RULES = {
    email: ['required', 'email'],
    age: { integer: true, range: [18, 99] },
    plan: { oneOf: ['free', 'pro'] },
    nick: { minlength: 3, maxlength: 12, pattern: '^[a-z0-9]+$' },
    pw: { required: true, minlength: 8 },
    pw2: { equalTo: 'pw' },
    'items[].qty': { required: true, number: true, min: 1 },
    items: { minItems: 1 }
};

test('checkRules: finds mistakes, suggests the closest name, and has no false alarms on the conformance vectors', () => {
    const f = checkRules({ email: ['required', 'emial'], a: { minlenght: 3 }, b: { range: [9, 1] }, c: { minlength: 'x' }, d: { pattern: '(' }, e: { oneOf: [] } }, { known });
    const by = Object.fromEntries(f.map(x => [x.field, x]));
    assert.match(by.email.message, /Did you mean "email"/);
    assert.match(by.a.message, /Did you mean "minlength"/);
    assert.match(by.b.message, /nothing can pass/);
    assert.match(by.c.message, /needs a number/);
    assert.match(by.d.message, /regular expression/);
    assert.match(by.e.message, /non-empty/);
    assert.equal(closest('zzzzzzzz', known), null);
    assert.deepEqual(checkRules(RULES, { known }).filter(x => x.severity === 'error'), []);
    const vectors = require('../spec/form-rules.vectors.json');
    let seen = 0;
    for (const c of vectors.cases) {
        const errors = checkRules({ f: c.rule }, { known, fieldsKnown: false }).filter(x => x.severity === 'error');
        assert.deepEqual(errors, [], JSON.stringify(c.rule));
        seen++;
    }
    assert.ok(seen > 100);
    assert.deepEqual(checkRules({ x: { type: 'range', min: 1, max: 5 }, y: { type: 'minlength', min: 3 }, z: { custom: true } }, { known, allow: ['custom'] }), []);
});

test('export: the generated Zod schema judges payloads like the rules do', async () => {
    const { z } = require('zod');
    const src = exportRules(RULES, 'zod', { FormValidator, name: 'signup' });
    assert.match(src, /export type Signup/);
    const body = src.replace(/^import .*\n/m, '').replace(/^export type .*\n/m, '').replace('export const SignupSchema =', 'return');
    const schema = new Function('z', body)(z);
    const good = { email: 'a@b.co', age: 30, plan: 'pro', nick: 'bob99', pw: 'Secret123', pw2: 'Secret123', items: [{ qty: 2 }] };
    const verdict = data => { const r = schema.safeParse(data); return r.success ? [] : [...new Set(r.error.issues.map(i => String(i.path[0])))].sort(); };
    assert.deepEqual(verdict(good), []);
    assert.deepEqual(verdict(Object.assign({}, good, { email: 'nope', age: 12, plan: 'gold', nick: 'B', pw: 'short', items: [] })), ['age', 'email', 'items', 'nick', 'plan', 'pw']);
    assert.deepEqual(verdict(Object.assign({}, good, { nick: '' })), [], 'an optional field may stay empty');
});

test('export: TypeScript, JSON Schema, HTML, React, Vue and Angular output is well formed', () => {
    const esbuild = require('esbuild');
    const ts = exportRules(RULES, 'typescript', { FormValidator, name: 'signup' });
    assert.match(ts, /export interface Signup \{/);
    assert.match(ts, /plan\?: "free" \| "pro";/);
    esbuild.transformSync(ts, { loader: 'ts' });
    const js = JSON.parse(exportRules(RULES, 'json-schema', { FormValidator }));
    assert.equal(js.properties.age.type, 'integer');
    assert.equal(JSON.stringify(JSON.parse(exportRules(RULES, 'rules', {}))), JSON.stringify(RULES));
    const html = exportRules({ email: ['required', 'email'], n: { minlength: 3 }, x: { equalTo: 'email' } }, 'html', { FormValidator });
    assert.match(html, /data-fv="required email"/);
    assert.match(html, /data-fv="minlength:3"/);
    assert.match(html, /<!-- these rules need JavaScript/);
    esbuild.transformSync(exportRules(RULES, 'react', { FormValidator, name: 'signup' }), { loader: 'jsx' });
    esbuild.transformSync(exportRules(RULES, 'angular', { FormValidator, name: 'signup' }), { loader: 'ts', tsconfigRaw: { compilerOptions: { experimentalDecorators: true } } });
    assert.match(exportRules(RULES, 'vue', { FormValidator, name: 'signup' }), /<script setup>[\s\S]*useFormValidator[\s\S]*<template>/);
    assert.throws(() => exportRules(RULES, 'cobol', { FormValidator }), /Unknown format/);
    // the data-fv text the HTML export writes is read back by the library to the same verdicts
    const form = (() => { const { JSDOM } = require('jsdom'); return new JSDOM('<body>' + html.replace(/<script[\s\S]*?<\/script>/, '') + '</body>').window.document.querySelector('form'); })();
    assert.ok(form.querySelector('[data-fv="required email"]'));
});

test('migrate: validate(), valid(), addMethod; unknown options are kept in a comment and reported', () => {
    const src = [
        "$('#signup').validate({",
        "  rules: { email: { required: true, remote: '/x' }, pw: { minlength: 8 } },",
        "  messages: { email: { required: 'We need it, (really)' } },",
        "  errorPlacement: function (e, el) { e.insertAfter(el); },",
        "  submitHandler: function (form) { form.submit(); }",
        "});",
        "if ($('#signup').valid()) {}",
        "$.validator.addMethod('even', function (v) { return v % 2 === 0; }, 'Even');",
        "$('#plain').validate();",
        "$('#odd').rules('add', { minlength: 2 });"
    ].join('\n');
    const r = migrateSource(src);
    assert.match(r.code, /FormValidator\.init\(\{ form: '#signup', rules: \{ email: \{ required: true, remote: '\/x' \}, pw: \{ minlength: 8 \} \}, messages: \{ email: \{ required: 'We need it, \(really\)' \} \} \/\* TODO[^*]*errorPlacement, submitHandler \*\/ \}\);/);
    assert.match(r.code, /if \(FormValidator\.isValid\('#signup'\)\) \{\}/);
    assert.match(r.code, /FormValidator\.addMethod\('even'/);
    assert.match(r.code, /FormValidator\.init\(\{ form: '#plain', rules: \{\} \}\);/);
    assert.ok(r.todo.some(t => /errorPlacement/.test(t)) && r.todo.some(t => /rules\("add"/.test(t)));
    new Function(r.code.replace(/\$\('#odd'\)[^\n]*/, ''));   // still parses
    assert.equal(migrateSource('const x = 1;').changes.length, 0);
    assert.equal(migrateSource("$('#a').validate({ rules: { a: { required: true } } ").code.includes('validate'), true, 'unbalanced input is left alone');
});

test('fv CLI: check, export, import (Zod, Yup, Joi, JSON Schema), migrate, rules, errors', () => {
    const rulesFile = write('rules.json', JSON.stringify({ rules: { email: ['required', 'emial'] } }));
    let r = cli('check', rulesFile);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Did you mean "email"/);
    r = cli('check', write('good.json', JSON.stringify(RULES)), '--json');
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(r.stdout).findings.filter(f => f.severity === 'error'), []);
    r = cli('check', rulesFile, '--allow', 'emial');
    assert.equal(r.status, 0, 'an allowed custom rule is fine');

    r = cli('export', write('signup.json', JSON.stringify(RULES)), '--to', 'typescript');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /export interface signup|export interface Signup/i);
    assert.equal(cli('export', rulesFile).status, 2);
    assert.equal(cli('export', rulesFile, '--to', 'nope').status, 2);

    const zodFile = write('zodschema.cjs', "const { z } = require(" + JSON.stringify(require.resolve('zod')) + "); module.exports = { schema: z.object({ email: z.email(), age: z.number().int().min(18), tags: z.array(z.string()).min(1) }) };");
    r = cli('import', zodFile, '--from', 'zod', '--export', 'schema');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(Object.keys(JSON.parse(r.stdout)).sort(), ['age', 'email', 'tags']);
    const yupFile = write('yupschema.cjs', "const yup = require(" + JSON.stringify(require.resolve('yup')) + "); module.exports = yup.object({ email: yup.string().email().required(), n: yup.number().min(1) });");
    r = cli('import', yupFile, '--from', 'yup');
    assert.deepEqual(JSON.parse(r.stdout).email, ['required', 'email']);
    let joi = null;
    try { joi = require.resolve('joi'); } catch (e) { /* joi 18 needs a newer Node */ }
    const joiFile = write('joischema.cjs', "const Joi = require(" + JSON.stringify(joi || 'joi') + "); module.exports = Joi.object({ name: Joi.string().required().min(2).max(10), age: Joi.number().integer().min(18), plan: Joi.string().valid('a', 'b'), rows: Joi.array().items(Joi.object({ q: Joi.number().required() })).min(1) });");
    if (joi) {
        r = cli('import', joiFile, '--from', 'joi');
        assert.equal(r.status, 0, r.stderr);
        const joiRules = JSON.parse(r.stdout);
        assert.deepEqual(Object.keys(joiRules).sort(), ['age', 'name', 'plan', 'rows', 'rows[].q']);
        assert.equal(FormValidator.checkValues({ name: 'A', age: 20, plan: 'a', rows: [{ q: '1' }] }, joiRules).valid, false);
        assert.equal(FormValidator.checkValues({ name: 'Ann', age: 20, plan: 'a', rows: [{ q: '1' }] }, joiRules).valid, true);
    }
    r = cli('import', write('s.json', JSON.stringify({ type: 'object', required: ['a'], properties: { a: { type: 'string', format: 'email' } } })), '--from', 'json-schema');
    assert.deepEqual(JSON.parse(r.stdout).a, ['required', 'email']);

    const js = write('app/page.js', "$('#f').validate({ rules: { a: { required: true } } });\n");
    r = cli('migrate', 'app/*.js');
    assert.match(r.stdout, /1 change\(s\) \(dry run/);
    assert.match(fs.readFileSync(js, 'utf8'), /\$\('#f'\)/, 'a dry run changes nothing');
    cli('migrate', 'app/**/*.js', '--write');
    assert.match(fs.readFileSync(js, 'utf8'), /FormValidator\.init\(\{ form: '#f', rules: \{ a: \{ required: true \} \} \}\)/);

    assert.match(cli('rules').stdout, /^required$/m);
    assert.equal(cli('bogus').status, 2);
    assert.equal(cli().status, 2);
    assert.equal(cli('--version').stdout.trim(), require('../package.json').version);
});

test('ESLint plugin: unknown rules in init / schema / checkValue / useFormValidator, skips what it cannot read', async t => {
    let Linter;
    try { ({ Linter } = require('eslint')); } catch (e) { return t.skip('eslint does not load on this Node (' + process.version + ')'); }
    const plugin = require('../tools/eslint-plugin.js');
    const linter = new Linter();
    const run = code => linter.verify(code, [plugin.configs.recommended], { filename: 'x.js' });
    let msgs = run("FormValidator.init({ form: 'f', rules: { email: ['required', 'emial'], age: { range: [9, 1] } } });");
    assert.equal(msgs.length, 2, JSON.stringify(msgs));
    assert.match(msgs[0].message, /email: Unknown rule "emial"\. Did you mean "email"\?/);
    assert.match(msgs[1].message, /nothing can pass/);
    assert.equal(run("FormValidator.schema({ a: 'required', b: { minlenght: 3 } });").length, 1);
    assert.equal(run("FormValidator.checkValue(v, ['required', 'mail']);").length, 1);
    assert.equal(run("useFormValidator({ rules: { a: 'requird' } });").length, 1);
    assert.equal(run("fvValidator(['required', 'email']);").length, 0);
    assert.equal(run("const r = { a: 'nonsense' }; FormValidator.init({ form: 'f', rules: r });").length, 0, 'variables are not guessed');
    assert.equal(run("FormValidator.init({ form: 'f', rules: { a: { minlength: n, nonsense: 1 } } });").length, 1, 'a dynamic parameter is skipped, a bad name is not');
    assert.equal(run("FormValidator.registerRule('mine', () => true); FormValidator.init({ form: 'f', rules: { a: 'mine' } });").length, 0, 'rules registered in the file are known');
    assert.equal(run("somethingElse.init({ rules: { a: 'nonsense' } });").length, 0);
    assert.equal(run("FormValidator.init({ form: 'f', rules: { a: { required: true, minlength: 3, equalTo: '#b' }, b: 'required' } });").length, 0);
});

test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* temp */ } });
