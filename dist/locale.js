/*!
 * FVLocales v1.0.0 — language packs for FormValidator, FileValidator, the upload widget and the jQuery Validation layer.
 *
 *   <script src="dist/validator.min.js"></script>          <!-- the bundle already contains this registry -->
 *   <script src="dist/locales/de.js"></script>            <!-- one script per language, after the bundle (or dist/locales/all.js) -->
 *   <script>FVLocales.use('de');</script>                 <!-- everything is German now -->
 *
 *   FVLocales.auto();                     // the visitor's browser language, else English
 *   FVLocales.use('ar', { document: true });   // also sets <html lang="ar" dir="rtl">
 *   FVLocales.register('sv', { name: 'Svenska', form: { required: 'Fältet är obligatoriskt.' } });   // your own language; missing texts stay English
 *
 * A pack is { name, dir: 'ltr' | 'rtl', form: { ruleType: text }, file: { ERROR_CODE: text }, phrases: { 'English fragment': text },
 *             units: { B, KB, MB, GB }, jquery: { method: text } }.
 * Texts use {0} {1} for rule parameters (form) and {name} placeholders as in the English text (file). `use('en')` restores English.
 *
 * Changelog
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define([], function () { return factory(root); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root);
    else root.FVLocales = factory(root);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
    'use strict';

    /** The English fragments FileValidator and the widget look up (FileValidator.phrases); plural sentences are objects keyed by CLDR category. */
    const PHRASE_KEYS = ['Office document', 'document', 'ZIP archive', 'PDF', 'the file is too short',
        'the ZIP directory at the end of the file is missing (the file may be cut off)', 'the ZIP directory points outside the file', 'the ZIP directory is damaged',
        'unsafe file paths inside the archive', 'it holds {n} files', 'it would expand to {size}', 'it compresses {ratio} times, which is not normal for a real document',
        'required parts are missing, so it is not a real {type} file', 'macros', 'embedded programs', 'the end of the file is missing (it may be cut off)',
        'JavaScript in a PDF', 'a launch action in a PDF', 'an embedded program in a PDF', 'scripts', 'hidden extra data',
        'Remove {name}', '…and {n} more.', '{n} selected.', '{name} removed. {n} selected.', 'All files removed.', 'status.added', 'status.rejected'];

    const packs = { en: { name: 'English', dir: 'ltr' } };
    const seen = new Set();        // queued pack objects this registry already took in
    const snapshots = {};          // English originals, taken the first time a language is applied
    let current = 'en';

    const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const tryRequire = name => { try { return typeof require === 'function' ? require(name) : null; } catch (e) { return null; } };
    const targets = () => ({
        form: root.FormValidator || tryRequire('./formValidator.js'),
        file: root.FileValidator || tryRequire('./fileValidator.js'),
        jq: root.jQuery && root.jQuery.validator && root.jQuery.validator.__fv ? root.jQuery.validator : null
    });

    /** Packs whose script ran before this registry (or that were required in Node) wait in FVLocalePacks: take them in. */
    function pullQueued() {
        const queued = root.FVLocalePacks;
        if (!isObj(queued)) return;
        // the queue stays as it is (another registry, for example the server's, may need the same packs); each pack object is taken in once per registry
        Object.keys(queued).forEach(code => { const pack = queued[code]; if (seen.has(pack)) return; seen.add(pack); register(code, pack); });
    }

    const find = code => {
        pullQueued();
        const wanted = String(code || '').toLowerCase();
        return Object.keys(packs).find(k => k.toLowerCase() === wanted) || null;
    };

    function register(code, pack) {
        if (!code || !isObj(pack)) throw new Error('FVLocales.register(code, pack): a language code and a pack object are needed');
        const key = Object.keys(packs).find(k => k.toLowerCase() === String(code).toLowerCase()) || String(code);
        const old = packs[key] || {};
        packs[key] = Object.assign({}, old, pack, {
            form: Object.assign({}, old.form, pack.form), file: Object.assign({}, old.file, pack.file), phrases: Object.assign({}, old.phrases, pack.phrases),
            units: Object.assign({}, old.units, pack.units), jquery: Object.assign({}, old.jquery, pack.jquery)
        });
        if (key === current && key !== 'en') apply(key);   // a pack that arrives after use(): apply it right away
        return packs[key];
    }

    /** Put `obj` back to its English state (the first call remembers it), then fill in `values`. */
    function reset(name, obj, values) {
        const snap = snapshots[name] || (snapshots[name] = Object.assign({}, obj));
        Object.keys(obj).forEach(k => { if (!(k in snap)) delete obj[k]; });
        Object.assign(obj, snap);
        if (values) Object.keys(values).forEach(k => { obj[k] = values[k]; });
    }

    function apply(code) {
        const pack = packs[code] || {};
        const t = targets();
        if (t.form && t.form.messages) reset('form', t.form.messages, pack.form);
        if (t.file) {
            if (t.file.defaultMessages) reset('file', t.file.defaultMessages, pack.file);
            if (t.file.units) reset('units', t.file.units, pack.units);
            if (t.file.phrases) { Object.keys(t.file.phrases).forEach(k => { delete t.file.phrases[k]; }); Object.assign(t.file.phrases, pack.phrases); }
            try { t.file.locale = code; } catch (e) { /* older FileValidator */ }
        }
        if (t.jq && t.jq.messages) {
            // the form texts serve the jQuery methods of the same name ({min}/{max}/{step} become {0}/{1}); `jquery` adds or overrides
            const snap = snapshots.jq || (snapshots.jq = Object.assign({}, t.jq.messages));
            const derived = {}, format = t.jq.format;
            const toIndexed = text => /\{min\}/.test(text) && /\{max\}/.test(text) ? text.replace(/\{min\}/g, '{0}').replace(/\{max\}/g, '{1}') : text.replace(/\{(min|max|step)\}/g, '{0}');
            const merged = Object.assign({}, pack.form, pack.jquery);
            Object.keys(merged).forEach(k => {
                if (!(k in snap) || typeof merged[k] !== 'string') return;
                const text = pack.jquery && k in pack.jquery ? merged[k] : toIndexed(merged[k]);
                derived[k] = typeof snap[k] === 'function' && format ? format(text) : text;
            });
            reset('jq', t.jq.messages, derived);
        }
    }

    function use(code, options) {
        const key = find(code);
        if (!key) throw new Error('FVLocales: unknown language "' + code + '". Loaded: ' + Object.keys(packs).join(', ') + '. Load its file (dist/locales/' + code + '.js) or register() a pack.');
        apply(key);
        current = key;
        const pack = packs[key];
        if (options && options.document && root.document && root.document.documentElement) {
            root.document.documentElement.setAttribute('lang', key);
            root.document.documentElement.setAttribute('dir', pack.dir || 'ltr');
        }
        return { code: key, name: pack.name || key, dir: pack.dir || 'ltr' };
    }

    /** The visitor's language: the first language of navigator.languages that has a pack (de-AT falls back to de), else `fallback` (default 'en'). */
    function auto(fallback, options) {
        const nav = root.navigator || {};
        const wanted = [].concat(nav.languages || [], nav.language || []);
        for (const l of wanted) {
            const exact = find(l), base = find(String(l).split('-')[0]);
            if (exact || base) return use(exact || base, options);
        }
        return use(fallback || 'en', options);
    }

    /** Apply the current language again, for example after the jQuery layer was installed. */
    function reapply() { if (current !== 'en') apply(current); }

    pullQueued();

    return {
        version: '1.0.0',
        register, use, auto, reapply,
        get current() { return current; },
        get(code) { const k = find(code); return k ? packs[k] : null; },
        list() { pullQueued(); return Object.keys(packs).map(code => ({ code, name: packs[code].name || code, dir: packs[code].dir || 'ltr' })); },
        /** Every text a complete pack needs: use it as a checklist for your own language. */
        keys() {
            const t = targets();
            return { form: Object.keys(snapshots.form || (t.form && t.form.messages) || {}), file: Object.keys(snapshots.file || (t.file && t.file.defaultMessages) || {}), phrases: PHRASE_KEYS.slice() };
        }
    };
});
