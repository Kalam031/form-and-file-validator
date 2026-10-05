#!/usr/bin/env node
'use strict';
/*
 * Smaller builds of FormValidator: only the rules you use, and optionally without the form engine (no DOM).
 *
 *   node node_modules/form-and-file-validator/tools/build-subset.js --rules=required,email,minlength,pattern --out=fv.min.js
 *   node node_modules/form-and-file-validator/tools/build-subset.js --rules=required,email --format=esm --out=fv.min.mjs
 *   node node_modules/form-and-file-validator/tools/build-subset.js --no-engine --out=core.min.js      (DOM-free: checkValue, checkValues, schema, serverErrors, precognition, action, parseFormData)
 *   node node_modules/form-and-file-validator/tools/build-subset.js --list                              (every rule name)
 *
 * Options: --rules=a,b,c (default: all)  --no-engine (drop the form engine: init(), validate(), unobtrusive ...; rules that need a form, files or a server go with it)
 *          --format=umd|esm (default umd)  --out=file (default: print to stdout)  --list
 * The result is the same FormValidator API, only smaller. It needs `terser` and `acorn` (npm i -D terser acorn); the published library itself has no dependencies.
 *
 * From code:  const { build } = require('form-and-file-validator/tools/build-subset.js');  const { code, rules, size } = await build({ rules: ['required', 'email'], engine: false, format: 'esm' });
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'src', 'formValidator.js');
/** Rules that need a form, files or a server: they go away with the engine. */
const NEEDS_ENGINE = ['file', 'fileType', 'fileSize', 'minFiles', 'maxFiles', 'minChecked', 'maxChecked', 'remote'];

function need(name) {
    try { return require(name); }
    catch (e) { throw new Error('build-subset needs "' + name + '": npm i -D terser acorn'); }
}

/** The statements `R('name', ...)` / `registerRule('name', ...)` of the factory body: [{ name, start, end }] */
function ruleStatements(src) {
    const acorn = need('acorn');
    const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
    const out = [];
    const visit = node => {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression' && node.expression.callee.type === 'Identifier' &&
            (node.expression.callee.name === 'R' || node.expression.callee.name === 'registerRule') && node.expression.arguments[0] && node.expression.arguments[0].type === 'Literal' &&
            typeof node.expression.arguments[0].value === 'string') {
            out.push({ name: node.expression.arguments[0].value, start: node.start, end: node.end });
            return;
        }
        for (const k of Object.keys(node)) {
            const v = node[k];
            if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v);
        }
    };
    visit(ast);
    return out;
}

/** Every built-in rule name, in source order. */
function listRules(src) {
    return ruleStatements(src || fs.readFileSync(SOURCE, 'utf8')).map(r => r.name).filter((n, i, a) => a.indexOf(n) === i);
}

/**
 * options: rules (array of names, or '*' / undefined for all), engine (default true; false drops the form engine and the rules that need a form),
 *          format ('umd' | 'esm', default 'umd'), minify (default true), source (alternative source text).
 * Returns { code, rules, size, gzip }.
 */
async function build(options) {
    const o = Object.assign({ engine: true, format: 'umd', minify: true }, options);
    let src = o.source || fs.readFileSync(SOURCE, 'utf8');
    const statements = ruleStatements(src);
    const all = statements.map(r => r.name).filter((n, i, a) => a.indexOf(n) === i);
    let wanted;
    if (!o.rules || o.rules === '*') wanted = all.filter(n => o.engine || NEEDS_ENGINE.indexOf(n) < 0);
    else {
        wanted = [].concat(o.rules).map(String).map(s => s.trim()).filter(Boolean);
        const unknown = wanted.filter(n => all.indexOf(n) < 0);
        if (unknown.length) throw new Error('Unknown rule(s): ' + unknown.join(', ') + '. Known rules: ' + all.join(', '));
        if (!o.engine) {
            const dropped = wanted.filter(n => NEEDS_ENGINE.indexOf(n) >= 0);
            wanted = wanted.filter(n => NEEDS_ENGINE.indexOf(n) < 0);
            if (dropped.length && o.warn !== false && typeof console !== 'undefined') console.warn('build-subset: these rules need the form engine and are left out of a no-engine build: ' + dropped.join(', '));
        }
    }
    // remove the statements of the rules that are not wanted (back to front so the offsets stay valid)
    statements.filter(r => wanted.indexOf(r.name) < 0).sort((a, b) => b.start - a.start).forEach(r => { src = src.slice(0, r.start) + '/* rule ' + r.name + ' left out */' + src.slice(r.end); });
    let code = src;
    if (o.minify) {
        const { minify } = need('terser');
        const res = await minify(src, {
            compress: { passes: 3, global_defs: o.engine ? {} : { __FV_CORE__: true } },
            mangle: true,
            format: { comments: false }
        });
        if (res.error) throw res.error;
        code = res.code;
    }
    const label = (o.engine ? 'engine' : 'no engine') + ', ' + wanted.length + ' of ' + all.length + ' rules';
    const banner = '/*! FormValidator (' + label + ') | built with tools/build-subset.js | rules: ' + wanted.join(',') + ' */\n';
    if (o.format === 'esm') {
        const names = o.engine ? ['FormValidator'] : ['FormValidator'];
        code = banner + 'const module = { exports: {} };\n(function (module, exports, define) {\n' + code + '\n}).call(globalThis, module, module.exports, undefined);\n' +
            'export const FormValidator = module.exports;\nexport default module.exports;\n' +
            'export const { ' + ['checkValue', 'checkValues', 'schema', 'serverErrors', 'precognition', 'action', 'parseFormData', 'registerRule', 'addMethod', 'format', 'ValidationError', 'messages'].join(', ') + ' } = module.exports;\n';
        void names;
    } else code = banner + code;
    const size = Buffer.byteLength(code);
    const gzip = require('zlib').gzipSync(code).length;
    return { code, rules: wanted, size, gzip };
}

module.exports = { build, listRules, NEEDS_ENGINE };

if (require.main === module) {
    const args = {};
    process.argv.slice(2).forEach(a => {
        const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
        if (m) args[m[1]] = m[2] === undefined ? true : m[2];
    });
    (async () => {
        if (args.list) { console.log(listRules().join('\n')); return; }
        const r = await build({ rules: args.rules ? String(args.rules).split(',') : '*', engine: !args['no-engine'], format: args.format === 'esm' ? 'esm' : 'umd' });
        if (args.out) {
            fs.writeFileSync(args.out, r.code);
            console.log(args.out + ': ' + r.rules.length + ' rules, ' + (r.size / 1024).toFixed(1) + ' KB (' + (r.gzip / 1024).toFixed(1) + ' KB gzip)');
        } else process.stdout.write(r.code);
    })().catch(e => { console.error(e.message); process.exit(1); });
}
