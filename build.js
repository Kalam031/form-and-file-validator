'use strict';
/*
 * Build: node build.js   (or: npm run build)
 *
 * Produces dist/validator.js (script tag / CommonJS / AMD), dist/validator.mjs (ES module) and their .min.js / .min.mjs copies: ONE file with FormValidator, FileValidator, the upload widget and the
 * jQuery Validation compatibility layer. The jQuery layer switches itself on when jQuery is present, and FormValidator.useJQuery($)
 * installs it later if jQuery loads after the bundle.
 * Also writes each source file on its own (dist/formValidator.js, dist/formValidator.min.js, ...) for people who want only one part.
 *
 * The sources live in src/ and stay separate on purpose (each is a small standalone UMD file with its own dependencies).
 * Everything you would ship or load in a page is in dist/; the top level of the project holds no loose scripts.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const PARTS = [
    { name: 'fileValidator', file: 'fileValidator.js' },
    { name: 'fileValidator.widget', file: 'fileValidator.widget.js' },
    { name: 'formValidator', file: 'formValidator.js' },
    { name: 'formValidator.element', file: 'formValidator.element.js' },
    { name: 'formValidator.password', file: 'formValidator.password.js' },
    { name: 'formValidator.jquery', file: 'formValidator.jquery.js' },
    { name: 'formValidator.additional', file: 'formValidator.additional.js' },
    { name: 'locale', file: 'locale.js' }
];

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const versionOf = src => { const m = /\bv(\d+\.\d+\.\d+)\b/.exec(src.slice(0, 400)); return m ? m[1] : '?'; };

function bundle() {
    const sources = PARTS.map(p => ({ ...p, src: read(p.file) }));
    const versions = {}; sources.forEach(p => { versions[p.name] = versionOf(p.src); });
    const banner = '/*! FormValidator ' + versions.formValidator + ' + FileValidator ' + versions.fileValidator + ' + upload widget ' + versions['fileValidator.widget'] +
        ' + jQuery Validation layer ' + versions['formValidator.jquery'] + ' | one-file bundle | see docs/ */\n';

    const wrapped = sources.map(p =>
        '    mods[' + JSON.stringify(p.name) + '] = function (module, exports, require, define) {\n' + p.src + '\n    };\n').join('\n');

    const code = banner + `(function (root) {
    'use strict';
    var mods = {}, cache = {};
${wrapped}
    var norm = function (id) { return String(id).replace(/^.*[\\\\/]/, '').replace(/\\.js$/, ''); };
    function requireMod(id) {
        var n = norm(id);
        if (n === 'jquery') { if (root.jQuery) return root.jQuery; throw new Error('jQuery is not loaded'); }
        if (!mods[n]) throw new Error('Cannot find module ' + id);
        return run(n);
    }
    function run(n) {
        if (cache[n]) return cache[n].exports;
        var module = cache[n] = { exports: {} };
        mods[n].call(root, module, module.exports, requireMod, undefined);
        return module.exports;
    }

    var FileValidator = run('fileValidator');
    run('fileValidator.widget');                 // adds widget(), resizeImage(), filesFromDrop() ... to FileValidator
    var FormValidator = run('formValidator');
    run('formValidator.element');                // <fv-field> (registers itself when the browser has custom elements)
    run('formValidator.password');               // passwordStrength(), pwned(), the pwscore and pwned rules (before the locale registry, so its messages are translated)
    var locales = run('locale');                  // language packs: FVLocales.use('de')
    FormValidator.locales = locales; FileValidator.locales = locales;

    /** Installs the jQuery Validation compatibility layer on the given jQuery ($.fn.validate, $.validator ...). Safe to call twice. */
    function useJQuery($) {
        var m = { exports: {} };
        var req = function (id) { return norm(id) === 'jquery' ? $ : requireMod(id); };
        mods['formValidator.jquery'].call(root, m, m.exports, req, undefined);
        mods['formValidator.additional'].call(root, { exports: {} }, {}, req, undefined);   // country and bank methods of additional-methods.js
        try { locales.reapply(); } catch (e) { /* the current language now also reaches the jQuery messages */ }
        return m.exports;
    }
    FormValidator.bundled = true;
    FormValidator.useJQuery = useJQuery;

    var api = { FormValidator: FormValidator, FileValidator: FileValidator, locales: locales, useJQuery: useJQuery,
        versions: ${JSON.stringify(versions)} };

    if (typeof define === 'function' && define.amd) define(function () { return api; });
    else if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.FormValidator = FormValidator; root.FileValidator = FileValidator; root.FVLocales = locales; }

    // <script src="validator.min.js" data-fv-auto></script> starts validators from data-fv attributes by itself
    try { if (root.document && root.document.currentScript && root.document.currentScript.hasAttribute('data-fv-auto')) FormValidator.auto(); } catch (e) { /* no document */ }
    if (root.jQuery && root.jQuery.fn) useJQuery(root.jQuery);   // jQuery was loaded first: the jQuery Validation API is ready
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
`;
    return { code, versions, esm: toESM(code) };
}

/** The same bundle as an ES module: named exports { FormValidator, FileValidator, useJQuery, versions } and a default export. */
function toESM(code) {
    const marker = "    if (typeof define === 'function' && define.amd) define(function () { return api; });";
    const at = code.lastIndexOf(marker);                       // the bundle's own tail (the sources have similar UMD lines earlier)
    if (at < 0) throw new Error('build.js: the bundle tail changed, update toESM()');
    const tail = code.slice(at);
    const m = /(if \(root\.jQuery && root\.jQuery\.fn\) useJQuery\(root\.jQuery\);[^\n]*)\n\}\)\((.*)\);\n$/.exec(tail);
    if (!m) throw new Error('build.js: the bundle tail changed, update toESM()');
    const head = code.slice(0, at).replace('(function (root) {', 'const api = (function (root) {');
    return head + '    ' + m[1] + '\n    return api;\n})(' + m[2] + ');\n' +
        'export const FormValidator = api.FormValidator;\n' +
        'export const FileValidator = api.FileValidator;\n' +
        'export const useJQuery = api.useJQuery;\n' +
        'export const locales = api.locales;\n' +
        'export const versions = api.versions;\n' +
        'export default api;\n';
}

async function minify(code, esm) {
    const { minify: terser } = require('terser');
    const out = await terser(code, { compress: { passes: 2 }, mangle: true, module: !!esm, format: { comments: /^!/ } });
    if (out.error) throw out.error;
    return out.code;
}

/** dist/locales/<code>.js (+ .min.js) for every pack in src/locales/, and dist/locales/all.js with all of them. */
async function buildLocales(withMin) {
    const dir = path.join(SRC, 'locales'), out = path.join(DIST, 'locales'), files = {};
    if (!fs.existsSync(dir)) return files;
    fs.mkdirSync(out, { recursive: true });
    const packs = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
    let all = '/*! FormValidator + FileValidator language packs (all languages in one file) | load after the bundle | FVLocales.use(\'de\') */\n';
    for (const f of packs) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        all += src + '\n';
        fs.writeFileSync(path.join(out, f), src);
        if (withMin) fs.writeFileSync(path.join(out, f.replace(/\.js$/, '.min.js')), await minify(src));
    }
    fs.writeFileSync(path.join(out, 'all.js'), all);
    files['locales/all.js'] = all.length;
    if (withMin) { const min = await minify(all); fs.writeFileSync(path.join(out, 'all.min.js'), min); files['locales/all.min.js'] = min.length; }
    files['locales/*.js (' + packs.length + ' languages)'] = 0;
    return files;
}

async function build(options) {
    const opts = Object.assign({ write: true, minify: true }, options);
    const { code, versions, esm } = bundle();
    const result = { code, esm, versions, files: {} };
    if (opts.minify) { result.minCode = await minify(code); result.minEsm = await minify(esm, true); }
    if (opts.write) {
        fs.mkdirSync(DIST, { recursive: true });
        result.files = Object.assign(result.files, await buildLocales(opts.minify));
        fs.writeFileSync(path.join(DIST, 'validator.js'), code);
        result.files['validator.js'] = code.length;
        fs.writeFileSync(path.join(DIST, 'validator.mjs'), esm);
        result.files['validator.mjs'] = esm.length;
        if (opts.minify) {
            fs.writeFileSync(path.join(DIST, 'validator.min.js'), result.minCode);
            result.files['validator.min.js'] = result.minCode.length;
            fs.writeFileSync(path.join(DIST, 'validator.min.mjs'), result.minEsm);
            result.files['validator.min.mjs'] = result.minEsm.length;
            const server = read('server.js');                      // Node-only companion: copied as is (it requires ./fileValidator.js next to it)
            fs.writeFileSync(path.join(DIST, 'server.js'), server);
            result.files['server.js'] = server.length;
            const intDir = path.join(SRC, 'integrations');        // framework bindings (React, Vue, Alpine): copied as is
            if (fs.existsSync(intDir)) {
                fs.mkdirSync(path.join(DIST, 'integrations'), { recursive: true });
                for (const f of fs.readdirSync(intDir)) {
                    const code = fs.readFileSync(path.join(intDir, f), 'utf8');
                    fs.writeFileSync(path.join(DIST, 'integrations', f), code);
                    result.files['integrations/' + f] = code.length;
                }
                const alpine = read('integrations/alpine.js'), min = await minify(alpine);
                fs.writeFileSync(path.join(DIST, 'integrations', 'alpine.min.js'), min);
                result.files['integrations/alpine.min.js'] = min.length;
            }
            // the DOM-free core of FormValidator (checkValue, checkValues, schema, serverErrors, precognition, action, parseFormData; all rules that need no form)
            const { build: buildSubset } = require('./tools/build-subset.js');
            for (const format of ['umd', 'esm']) {
                const core = await buildSubset({ rules: '*', engine: false, format });
                const name = format === 'esm' ? 'formValidator.core.min.mjs' : 'formValidator.core.min.js';
                fs.writeFileSync(path.join(DIST, name), core.code);
                result.files[name] = core.code.length;
            }
            for (const p of PARTS) {
                const src = read(p.file);
                fs.writeFileSync(path.join(DIST, p.file), src);
                result.files[p.file] = src.length;
                const min = await minify(src);
                const name = p.file.replace(/\.js$/, '.min.js');
                fs.writeFileSync(path.join(DIST, name), min);
                result.files[name] = min.length;
            }
        }
    }
    return result;
}

module.exports = { build, bundle, PARTS };

if (require.main === module) {
    build().then(r => {
        console.log('Built', JSON.stringify(r.versions));
        Object.keys(r.files).forEach(f => console.log('  dist/' + f.padEnd(28) + (r.files[f] / 1024).toFixed(1).padStart(7) + ' KB'));
    }).catch(e => { console.error(e); process.exit(1); });
}
