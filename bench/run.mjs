// Benchmarks: bundle size, value validation speed, and form validation speed against the libraries people compare with.
//   npm run bench                 prints the tables
//   npm run bench -- --write      also writes docs/Benchmarks.md
//   node bench/run.mjs --quick    tiny run (the test suite uses it)
// Numbers depend on the machine; compare the columns, not the absolute values. See docs/Benchmarks.md for what is and is not measured.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const quick = process.argv.includes('--quick');
const write = process.argv.includes('--write');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const gz = data => zlib.gzipSync(data, { level: 9 }).length;
const kb = n => (n / 1024).toFixed(1) + ' KB';
const pkgVersion = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version;
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// ---------------------------------------------------------------- 1. bundle size (what a page downloads, minified + gzip)
async function sizes() {
    const esbuild = require('esbuild');
    const bundleSize = async (code) => {
        const r = await esbuild.build({ stdin: { contents: code, resolveDir: ROOT, loader: 'js' }, bundle: true, minify: true, format: 'esm', write: false, platform: 'browser', logLevel: 'silent' });
        return gz(r.outputFiles[0].contents);
    };
    const rows = [];
    const add = (name, version, bytes, note) => rows.push({ name, version, gzip: bytes, note });
    const fileGz = f => gz(fs.readFileSync(path.join(ROOT, f)));
    add('form-and-file-validator core (checkValue, schema, 47 rules)', JSON.parse(read('package.json')).version, fileGz('dist/formValidator.core.min.js'), 'no DOM');
    add('form-and-file-validator form engine', JSON.parse(read('package.json')).version, fileGz('dist/formValidator.min.js'), 'DOM forms, 55 rules, 13 messages sets are separate');
    add('form-and-file-validator everything', JSON.parse(read('package.json')).version, fileGz('dist/validator.min.js'), 'forms + files + widget + jQuery layer');
    add('zod (object with 3 fields)', pkgVersion('zod'), await bundleSize("import { z } from 'zod'; export default z.object({ name: z.string().min(2), email: z.string().email(), age: z.string().regex(/^\\d+$/) });"), 'tree-shaken');
    add('yup (object with 3 fields)', pkgVersion('yup'), await bundleSize("import { object, string } from 'yup'; export default object({ name: string().min(2), email: string().email(), age: string().matches(/^\\d+$/) });"), 'tree-shaken');
    add('valibot (object with 3 fields)', pkgVersion('valibot'), await bundleSize("import * as v from 'valibot'; export default v.object({ name: v.pipe(v.string(), v.minLength(2)), email: v.pipe(v.string(), v.email()), age: v.pipe(v.string(), v.regex(/^\\d+$/)) });"), 'tree-shaken');
    add('ajv (schema compiled in the browser)', pkgVersion('ajv'), await bundleSize("import Ajv from 'ajv'; export default new Ajv({ allErrors: true }).compile({ type: 'object', properties: { name: { type: 'string', minLength: 2 }, age: { type: 'string', pattern: '^\\\\d+$' } } });"), 'no formats');
    add('jquery.validate + jQuery', pkgVersion('jquery-validation') + ' / ' + pkgVersion('jquery'), fileGz('node_modules/jquery/dist/jquery.min.js') + fileGz('node_modules/jquery-validation/dist/jquery.validate.min.js'), 'both files');
    add('pristinejs', pkgVersion('pristinejs'), fileGz('node_modules/pristinejs/dist/pristine.min.js'), '');
    return rows;
}

// ---------------------------------------------------------------- 2. validating objects (a server, a JSON body, a Server Action)
function objects() {
    const { FormValidator } = require('../dist/validator.js');
    const { z } = require('zod');
    const { object, string } = require('yup');
    const v = require('valibot');
    const Ajv = require('ajv');
    const N = quick ? 300 : 10000, ROUNDS = quick ? 2 : 7;
    const mk = invalidShare => Array.from({ length: N }, (_, i) => ({ name: 'Name ' + i, email: invalidShare && i % Math.round(1 / invalidShare) === 0 ? 'not-an-email' : 'user' + i + '@example.com', age: String(20 + i % 50) }));
    const fv = FormValidator.schema({ name: { required: true, minlength: 2, maxlength: 50 }, email: ['required', 'email'], age: ['required', 'digits'] });
    const zs = z.object({ name: z.string().min(2).max(50), email: z.string().email(), age: z.string().regex(/^\d+$/) });
    const ys = object({ name: string().required().min(2).max(50), email: string().required().email(), age: string().required().matches(/^\d+$/) });
    const vs = v.object({ name: v.pipe(v.string(), v.minLength(2), v.maxLength(50)), email: v.pipe(v.string(), v.email()), age: v.pipe(v.string(), v.regex(/^\d+$/)) });
    const ajv = new Ajv({ allErrors: true });
    const av = ajv.compile({ type: 'object', required: ['name', 'email', 'age'], properties: { name: { type: 'string', minLength: 2, maxLength: 50 }, email: { type: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$' }, age: { type: 'string', pattern: '^\\d+$' } } });
    const libs = {
        'form-and-file-validator': d => fv.safeParse(d),
        'zod': d => zs.safeParse(d),
        'yup': d => { try { ys.validateSync(d, { abortEarly: false }); return true; } catch (e) { return e; } },
        'valibot': d => v.safeParse(vs, d),
        'ajv': d => av(d)
    };
    const out = {};
    for (const [label, share] of [['all valid', 0], ['20% invalid', 0.2]]) {
        const data = mk(share);
        out[label] = {};
        for (const [name, fn] of Object.entries(libs)) {
            for (let i = 0; i < 2; i++) data.forEach(fn);   // warm up
            const times = [];
            for (let r = 0; r < ROUNDS; r++) { const t0 = process.hrtime.bigint(); for (let i = 0; i < data.length; i++) fn(data[i]); times.push(Number(process.hrtime.bigint() - t0) / 1e6); }
            out[label][name] = { ms: median(times), perSecond: Math.round(N / (median(times) / 1000)) };
        }
    }
    out.N = N;
    return out;
}

// ---------------------------------------------------------------- 3. validating a big form in the DOM (jsdom: the same DOM cost for everybody)
async function forms() {
    const { JSDOM } = require('jsdom');
    const ROWS = quick ? 20 : 100, ROUNDS = quick ? 2 : 7;
    const html = '<!doctype html><body><form id="f">' + Array.from({ length: ROWS }, (_, i) =>
        `<div class="form-group"><input name="name${i}" required minlength="2" value="${i % 4 ? 'Name ' + i : ''}"></div>` +
        `<div class="form-group"><input name="email${i}" type="email" required value="${i % 5 ? 'u' + i + '@example.com' : 'bad'}"></div>` +
        `<div class="form-group"><input name="age${i}" data-pristine-pattern="/^\\d+$/" value="${i % 6 ? i : 'x'}"></div>`).join('') + '</form></body>';
    const make = () => {
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
        return w;
    };
    const rules = {}, jq = {};
    for (let i = 0; i < ROWS; i++) {
        rules['name' + i] = ['required', { type: 'minlength', min: 2 }]; rules['email' + i] = ['required', 'email']; rules['age' + i] = ['digits'];
        jq['name' + i] = { required: true, minlength: 2 }; jq['email' + i] = { required: true, email: true }; jq['age' + i] = { digits: true };
    }
    const result = {};
    const time = async (label, setup, run) => {
        const times = [], firsts = [];
        for (let r = 0; r < ROUNDS; r++) {
            const ctx = await setup();
            const t0 = process.hrtime.bigint();
            await run(ctx);
            firsts.push(Number(process.hrtime.bigint() - t0) / 1e6);
            const t1 = process.hrtime.bigint();
            await run(ctx);
            times.push(Number(process.hrtime.bigint() - t1) / 1e6);
        }
        result[label] = { firstMs: median(firsts), againMs: median(times) };
    };
    const fvSrc = read('dist/validator.js');
    await time('form-and-file-validator', () => { const w = make(); w.eval(fvSrc); return { w, inst: w.FormValidator.init({ formId: 'f', rules }) }; }, ({ inst }) => inst.validate({ focus: false }));
    await time('form-and-file-validator (sync)', () => { const w = make(); w.eval(fvSrc); return { w, inst: w.FormValidator.init({ formId: 'f', rules }) }; }, ({ inst }) => inst.validateSync({ focus: false }));
    const jqSrc = read('node_modules/jquery/dist/jquery.js'), jvSrc = read('node_modules/jquery-validation/dist/jquery.validate.js');
    await time('jQuery Validation', () => { const w = make(); w.eval(jqSrc); w.eval(jvSrc); const $f = w.jQuery('#f'); $f.validate({ rules: jq, ignore: [] }); return { $f }; }, ({ $f }) => $f.valid());
    const pSrc = read('node_modules/pristinejs/dist/pristine.js');
    await time('Pristine', () => { const w = make(); w.eval(pSrc); return { p: new w.Pristine(w.document.getElementById('f')) }; }, ({ p }) => p.validate());
    result.fields = ROWS * 3;
    return result;
}

const info = { node: process.version, cpu: os.cpus()[0] && os.cpus()[0].model.trim(), cores: os.cpus().length, os: os.platform() + ' ' + os.release() };
const sz = await sizes();
const ob = objects();
const fo = await forms();

const lines = [];
lines.push('## Bundle size (minified + gzip)', '', '| Library | Version | Size | Note |', '| --- | --- | --- | --- |');
sz.forEach(r => lines.push(`| ${r.name} | ${r.version} | ${kb(r.gzip)} | ${r.note} |`));
lines.push('', `## Validating objects (${ob.N} objects with 3 fields; checks per second, higher is better)`, '');
for (const label of ['all valid', '20% invalid']) {
    lines.push(`**${label}**`, '', '| Library | Objects / second | ms per ' + ob.N + ' |', '| --- | --- | --- |');
    Object.entries(ob[label]).sort((a, b) => b[1].perSecond - a[1].perSecond).forEach(([n, r]) => lines.push(`| ${n} | ${r.perSecond.toLocaleString('en-US')} | ${r.ms.toFixed(1)} |`));
    lines.push('');
}
lines.push(`## Validating a form of ${fo.fields} fields in the DOM (jsdom, milliseconds, lower is better)`, '', '| Library | First validation | Validating again |', '| --- | --- | --- |');
Object.entries(fo).filter(([k]) => k !== 'fields').forEach(([n, r]) => lines.push(`| ${n} | ${r.firstMs.toFixed(1)} | ${r.againMs.toFixed(1)} |`));
const report = lines.join('\n');
console.log('Node ' + info.node + ', ' + info.cpu + ' (' + info.cores + ' cores)\n\n' + report);

if (write && !quick) {
    const md = `# Benchmarks

Measured with \`npm run bench\` (the script is in \`bench/run.mjs\`) on Node ${info.node}, ${info.cpu}, ${info.cores} cores, ${info.os}, on ${new Date().toISOString().slice(0, 10)}.
Absolute numbers depend on the machine: compare the rows with each other, and run \`npm run bench\` yourself.

${report}

## What this measures, and what it does not

- **Size** is the minified and gzipped code a page has to download for a three-field schema (tree-shaken where the library supports it). The form engine, the file validator, the upload widget and the 13 language packs are separate files; the "core" row is the DOM-free part that servers and Server Actions need.
- **Objects**: one schema per library, the same rules (name 2 to 50 characters, a valid email, digits), run on ${ob.N} plain objects. form-and-file-validator reports the first message per field in a language-pack-aware, trimmed form, which is more work than a bare boolean; zod, yup and valibot are asked for their error lists, ajv for its error array. Validation of one object in microseconds is rarely a bottleneck: a form posts once.
- **Forms**: ${fo.fields} fields in jsdom with required / minlength / email / digits rules. jsdom makes DOM work slower than a browser for everybody, so only the ratios mean something. jQuery Validation and Pristine validate in place; form-and-file-validator also keeps focus, ARIA state and message elements up to date.
- Not measured: bundle sizes of libraries that need a UI framework (React Hook Form, VeeValidate, TanStack Form), memory, time to first render, real browsers.
- A faster library is not a better one for your case: ask which rules you need (files, photo privacy, ASP.NET, Angular, server answers), not only how many objects per second.
`;
    fs.writeFileSync(path.join(ROOT, 'docs', 'Benchmarks.md'), md);
    console.log('\nwrote docs/Benchmarks.md');
}
