#!/usr/bin/env node
'use strict';
/*
 * fv: the command line of form-and-file-validator.
 *
 *   fv check rules.json                         lint a rules file: unknown rules (did you mean), wrong parameters, dangling field references
 *   fv export rules.json --to zod --name Signup rules as zod / typescript / json-schema / html / react / vue / angular / rules
 *   fv import ./schema.mjs --from zod           a Zod, Yup or Joi schema (or a JSON Schema file) as rules JSON   [--export schema]
 *   fv migrate src/**.js [--write]              jQuery Validation calls -> FormValidator (prints a diff summary; --write changes the files)
 *   fv rules                                    every rule name
 *
 * Rules files: .json ({ "rules": {...} }, a plain map, or a JSON Schema / OpenAPI object), or .js / .mjs / .cjs exporting the rules (default export, `rules`, or module.exports).
 * Options: --require ./setup.js (load your registerRule / addMethod calls first), --allow name,name, --json (machine-readable output), --out file.
 * Exit code: 0 clean, 1 problems found, 2 usage error.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function parseArgs(argv) {
    const args = { _: [], flags: {} };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const eq = a.indexOf('=');
            if (eq > 0) args.flags[a.slice(2, eq)] = a.slice(eq + 1);
            else if (i + 1 < argv.length && !argv[i + 1].startsWith('--') && ['to', 'name', 'from', 'export', 'out', 'require', 'allow'].indexOf(a.slice(2)) >= 0) args.flags[a.slice(2)] = argv[++i];
            else args.flags[a.slice(2)] = true;
        } else args._.push(a);
    }
    return args;
}

// The Node build: rules, schemas and checks need no DOM
const loadLibrary = () => require('../dist/validator.js').FormValidator;

async function importModule(file) {
    const abs = path.resolve(process.cwd(), file);
    if (/\.json$/i.test(abs)) return JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (/\.c?js$/i.test(abs)) { try { return require(abs); } catch (e) { if (e.code !== 'ERR_REQUIRE_ESM') throw e; } }
    return await import(pathToFileURL(abs).href);
}
function pickExport(mod, name) {
    if (name && mod && mod[name] !== undefined) return mod[name];
    if (name && mod && mod.default && mod.default[name] !== undefined) return mod.default[name];
    if (name) throw new Error('The module has no export named "' + name + '".');
    if (mod && (typeof mod.describe === 'function' || mod._zod)) return mod;   // the module is the schema itself
    for (const k of ['rules', 'schema', 'default']) if (mod && mod[k] !== undefined) return mod[k];
    return mod;
}
function rulesFrom(value, FV) {
    if (value && typeof value === 'object' && value.rules && typeof value.rules === 'object' && !value.properties) return value.rules;
    if (value && typeof value === 'object' && (value.properties || value.$schema || value.type === 'object' || value.allOf)) return FV.fromJsonSchema(value);
    return value;
}
function die(msg, code) { process.stderr.write('fv: ' + msg + '\n'); process.exit(code || 2); }

// ---- Joi: describe() -> JSON Schema node -> rules
function joiNode(d, depth) {
    const n = {};
    if (!d || depth > 12) return n;
    const t = d.type;
    if (t === 'string' || t === 'number' || t === 'array' || t === 'object') n.type = t;
    if (Array.isArray(d.allow) && d.flags && d.flags.only) n.enum = d.allow.filter(v => v !== '' && v !== null);
    (d.rules || []).forEach(r => {
        const a = r.args || {};
        if (r.name === 'min') { if (t === 'array') n.minItems = a.limit; else if (t === 'number') n.minimum = a.limit; else n.minLength = a.limit; }
        else if (r.name === 'max') { if (t === 'array') n.maxItems = a.limit; else if (t === 'number') n.maximum = a.limit; else n.maxLength = a.limit; }
        else if (r.name === 'length') { if (t === 'array') { n.minItems = a.limit; n.maxItems = a.limit; } else { n.minLength = a.limit; n.maxLength = a.limit; } }
        else if (r.name === 'integer') n.type = 'integer';
        else if (r.name === 'email') n.format = 'email';
        else if (r.name === 'uri') n.format = 'uri';
        else if (r.name === 'guid' || r.name === 'uuid') n.format = 'uuid';
        else if (r.name === 'multiple') n.multipleOf = a.base;
        else if (r.name === 'greater') n.exclusiveMinimum = a.limit;
        else if (r.name === 'less') n.exclusiveMaximum = a.limit;
        else if (r.name === 'pattern' && typeof a.regex === 'string') { const m = /^\/([\s\S]*)\/([a-z]*)$/.exec(a.regex); if (m && !m[2]) n.pattern = m[1]; }
    });
    if (d.keys) { n.type = 'object'; n.properties = {}; n.required = []; Object.keys(d.keys).forEach(k => { if (k === '__proto__' || k === 'constructor' || k === 'prototype') return; n.properties[k] = joiNode(d.keys[k], depth + 1); if (d.keys[k].flags && d.keys[k].flags.presence === 'required') n.required.push(k); }); }
    if (Array.isArray(d.items) && d.items[0]) { n.type = 'array'; n.items = joiNode(d.items[0], depth + 1); }
    return n;
}

async function cmdCheck(args, FV) {
    const { checkRules } = require('./fv-check.js');
    const file = args._[1];
    if (!file) die('usage: fv check <rules.json|rules.js>');
    const rules = rulesFrom(pickExport(await importModule(file), args.flags.export), FV);
    if (!rules || typeof rules !== 'object') die('no rules found in ' + file);
    const known = FV.ruleNames();
    const findings = checkRules(rules, { known, allow: String(args.flags.allow || '').split(',').filter(Boolean) });
    const errors = findings.filter(f => f.severity === 'error').length;
    if (args.flags.json) process.stdout.write(JSON.stringify({ file, fields: Object.keys(rules).length, findings }, null, 2) + '\n');
    else {
        findings.forEach(f => process.stdout.write(f.severity + ': ' + f.field + (f.rule ? ' (' + f.rule + ')' : '') + ': ' + f.message + '\n'));
        process.stdout.write(Object.keys(rules).length + ' field(s) checked, ' + errors + ' error(s), ' + (findings.length - errors) + ' warning(s).\n');
    }
    return errors ? 1 : 0;
}
async function cmdExport(args, FV) {
    const { exportRules } = require('./fv-codegen.js');
    const file = args._[1];
    if (!file || !args.flags.to) die('usage: fv export <rules.json> --to zod|typescript|json-schema|html|react|vue|angular|rules [--name Signup]');
    const rules = rulesFrom(pickExport(await importModule(file), args.flags.export), FV);
    let text;
    try { text = exportRules(rules, args.flags.to, { FormValidator: FV, name: args.flags.name || path.basename(file).replace(/\.[^.]+$/, '') }); } catch (e) { die(e.message); }
    if (args.flags.out) fs.writeFileSync(args.flags.out, text); else process.stdout.write(text);
    return 0;
}
async function cmdImport(args, FV) {
    const file = args._[1], from = String(args.flags.from || '').toLowerCase();
    if (!file || !from) die('usage: fv import <module> --from zod|yup|joi|json-schema [--export name]');
    const value = pickExport(await importModule(file), args.flags.export);
    const unsupported = [];
    const onUnsupported = (p, w) => unsupported.push((p ? p + ': ' : '') + w);
    let rules;
    if (from === 'zod') rules = FV.fromZod(value, { onUnsupported });
    else if (from === 'yup') rules = FV.fromYup(value, { onUnsupported });
    else if (from === 'joi') rules = FV.fromJsonSchema(joiNode(typeof value.describe === 'function' ? value.describe() : value, 0), { onUnsupported });
    else if (from === 'json-schema' || from === 'jsonschema') rules = FV.fromJsonSchema(value, { onUnsupported });
    else die('--from must be zod, yup, joi or json-schema');
    const text = JSON.stringify(rules, null, 2) + '\n';
    if (args.flags.out) fs.writeFileSync(args.flags.out, text); else process.stdout.write(text);
    if (unsupported.length) process.stderr.write('Not converted (add these with your own rules):\n  ' + Array.from(new Set(unsupported)).join('\n  ') + '\n');
    return 0;
}
function expand(pattern) {
    if (!/[*?]/.test(pattern)) return [pattern];
    const parts = pattern.split(/[\\/]/);
    const base = parts.findIndex(p => /[*?]/.test(p));
    const root = parts.slice(0, base).join('/') || '.';
    const re = new RegExp('^' + pattern.replace(/\\/g, '/').replace(/[.+^${}()|[\]]/g, '\\$&').replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0002').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0001/g, '(?:.*/)?').replace(/\u0002/g, '.*') + '$');
    const out = [];
    (function walk(dir) {
        let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
        list.forEach(e => {
            if (e.name === 'node_modules' || e.name === '.git') return;
            const p = (dir === '.' ? '' : dir + '/') + e.name;
            if (e.isDirectory()) walk(p); else if (re.test(p)) out.push(p);
        });
    })(root);
    return out;
}
async function cmdMigrate(args) {
    const { migrateSource } = require('./fv-migrate.js');
    const patterns = args._.slice(1);
    if (!patterns.length) die('usage: fv migrate <files or globs> [--write]');
    const files = Array.from(new Set([].concat(...patterns.map(expand))));
    let changed = 0, todo = 0;
    files.forEach(f => {
        let src; try { src = fs.readFileSync(f, 'utf8'); } catch (e) { process.stderr.write('fv: cannot read ' + f + '\n'); return; }
        const r = migrateSource(src);
        if (!r.changes.length && !r.todo.length) return;
        changed += r.changes.length ? 1 : 0; todo += r.todo.length;
        process.stdout.write(f + ': ' + r.changes.length + ' change(s)' + (args.flags.write ? ' written' : ' (dry run, add --write)') + '\n');
        r.todo.forEach(t => process.stdout.write('  TODO ' + t + '\n'));
        if (args.flags.write && r.code !== src) fs.writeFileSync(f, r.code);
    });
    process.stdout.write(files.length + ' file(s) looked at, ' + changed + ' with changes, ' + todo + ' thing(s) to look at by hand.\n');
    return 0;
}

async function main(argv) {
    const args = parseArgs(argv);
    const cmd = args._[0];
    if (args.flags.version) { process.stdout.write(require('../package.json').version + '\n'); return 0; }
    if (!cmd || args.flags.help || cmd === 'help') { const head = /\/\*\r?\n([\s\S]*?)\*\//.exec(fs.readFileSync(__filename, 'utf8'))[1].replace(/\r/g, ''); process.stdout.write(head.replace(/^ \* ?/gm, '')); return cmd ? 0 : 2; }
    if (args.flags.require) await importModule(String(args.flags.require));
    const FV = loadLibrary();
    try {
        if (cmd === 'check') return await cmdCheck(args, FV);
        if (cmd === 'export') return await cmdExport(args, FV);
        if (cmd === 'import') return await cmdImport(args, FV);
        if (cmd === 'migrate') return await cmdMigrate(args);
        if (cmd === 'rules') { process.stdout.write(FV.ruleNames().join('\n') + '\n'); return 0; }
        if (cmd === 'version' || cmd === '--version') { process.stdout.write(require('../package.json').version + '\n'); return 0; }
    } catch (e) { die(e && e.message ? e.message : String(e)); }
    die('unknown command "' + cmd + '". Try: fv --help');
}
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
module.exports = { main, parseArgs, joiNode, rulesFrom };
