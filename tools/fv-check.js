'use strict';
/*
 * Static check of a rules object: unknown rule names (with "did you mean"), parameters of the wrong shape, rules that point at fields that do not exist.
 * Used by `fv check` and by the ESLint plugin. Pure: it only needs the list of known rule names.
 *
 *   const { checkRules, closest } = require('form-and-file-validator/tools/fv-check');
 *   checkRules({ email: ['required', 'emial'] }, { known: FormValidator.ruleNames() })
 *   -> [{ field: 'email', rule: 'emial', severity: 'error', message: 'Unknown rule "emial". Did you mean "email"?' }]
 */
const NOT_RULES = ['normalizer', 'messages', 'message', 'when', 'code'];
const NUMERIC = ['minlength', 'maxlength', 'min', 'max', 'step', 'minItems', 'maxItems', 'minWords', 'maxWords', 'maxsize', 'minsize'];
const PAIRS = ['range', 'rangelength', 'rangeWords'];
const FIELD_REFS = { equalTo: ['target'], notEqualTo: ['target'], requiredIf: ['field'], dateAfter: ['field'], dateBefore: ['field'], atLeastOne: ['fields'], sumEquals: ['fields'] };

function distance(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[n];
}
/** The known name closest to `name` (case-insensitive, two edits or a third of its length away), or null. */
function closest(name, known) {
    const lower = String(name).toLowerCase();
    let best = null, bestD = Infinity;
    (known || []).forEach(k => {
        const d = k.toLowerCase() === lower ? 0 : distance(lower, k.toLowerCase());
        if (d < bestD) { bestD = d; best = k; }
    });
    return best !== null && bestD <= Math.max(2, Math.floor(lower.length / 3)) ? best : null;
}
/** One field's rule spec -> [{ type, param }]. Same reading as the library: a name, a list, one rule object, or a map { rule: param }. */
function listRules(spec) {
    if (!spec) return [];
    if (typeof spec === 'string') return [{ type: spec }];
    if (Array.isArray(spec)) return spec.map(x => typeof x === 'string' ? { type: x } : (x && typeof x === 'object' && typeof x.type === 'string' ? { type: x.type, param: x, object: true } : null)).filter(Boolean);
    if (typeof spec === 'object') {
        if (typeof spec.type === 'string') return [{ type: spec.type, param: spec, object: true }];
        return Object.keys(spec).filter(k => NOT_RULES.indexOf(k) < 0 && spec[k] !== false).map(k => ({ type: k, param: spec[k] }));
    }
    return [];
}
const isNum = v => typeof v === 'number' && isFinite(v);
const paramOf = (r, key) => r.object ? r.param[key] : r.param;

function checkRules(rules, options) {
    const o = options || {};
    const known = new Set((o.known || []).concat(o.allow || []));
    const out = [];
    const fields = new Set(Object.keys(rules || {}).map(k => k.replace(/\[\]/g, '')));
    const add = (field, rule, severity, message) => out.push({ field, rule, severity, message });
    Object.keys(rules || {}).forEach(field => {
        listRules(rules[field]).forEach(r => {
            const t = r.type;
            if (known.size && !known.has(t)) {
                const c = closest(t, Array.from(known));
                add(field, t, 'error', 'Unknown rule "' + t + '".' + (c ? ' Did you mean "' + c + '"?' : ' Register it with FormValidator.registerRule / addMethod, or pass it to --allow.'));
                return;
            }
            if (NUMERIC.indexOf(t) >= 0) {
                const v = r.object ? (r.param.min !== undefined && t.indexOf('min') === 0 ? r.param.min : (r.param.max !== undefined && t.indexOf('max') === 0 ? r.param.max : r.param[t])) : r.param;
                if (!(isNum(v) || (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v))))) add(field, t, 'error', '"' + t + '" needs a number, got ' + JSON.stringify(v === undefined ? null : v) + '.');
            }
            if (PAIRS.indexOf(t) >= 0) {
                const p = r.param;
                const arr = Array.isArray(p) ? p : (p && typeof p === 'object' ? [p.min, p.max] : null);
                if (!arr || arr.length !== 2 || !isNum(Number(arr[0])) || !isNum(Number(arr[1]))) add(field, t, 'error', '"' + t + '" needs [min, max].');
                else if (Number(arr[0]) > Number(arr[1])) add(field, t, 'error', '"' + t + '" has min ' + arr[0] + ' above max ' + arr[1] + ': nothing can pass.');
            }
            if (t === 'pattern') {
                const src = paramOf(r, 'pattern');
                if (typeof src === 'string') { try { new RegExp(src, 'u'); } catch (e) { try { new RegExp(src); } catch (e2) { add(field, t, 'error', 'The pattern is not a valid regular expression: ' + e2.message); } } }
                else if (!(src instanceof RegExp)) add(field, t, 'error', '"pattern" needs a string or a RegExp.');
            }
            if ((t === 'oneOf' || t === 'notOneOf')) {
                const v = r.object ? r.param.values : r.param;
                if (!Array.isArray(v) || !v.length) add(field, t, 'error', '"' + t + '" needs a non-empty list of values.');
            }
            (FIELD_REFS[t] || []).forEach(key => {
                const refs = r.object ? [].concat(r.param[key] === undefined ? [] : r.param[key]) : (typeof r.param === 'string' ? [r.param] : []);
                refs.forEach(ref => {
                    const name = String(ref).replace(/^#/, '');
                    if (o.fieldsKnown !== false && !fields.has(name) && typeof ref === 'string' && !/[\s.#\[]/.test(name)) add(field, t, 'warning', '"' + t + '" refers to the field "' + name + '", which has no rules here (fine if it is a plain field of the form).');
                });
            });
        });
    });
    return out;
}
module.exports = { checkRules, closest, listRules, distance };
