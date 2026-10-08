'use strict';
/*
 * Source codemod: jQuery Validation plugin calls -> FormValidator, for people who want to drop jQuery. Pure text in, text out (used by `fv migrate`).
 *
 *   $('#signup').validate({ rules: {...}, messages: {...}, submitHandler: fn })
 *     -> FormValidator.init({ form: '#signup', rules: {...}, messages: {...} /* TODO: submitHandler ... *\/ })
 *   $('#signup').valid()         -> FormValidator.isValid('#signup')
 *   $.validator.addMethod(...)   -> FormValidator.addMethod(...)
 *   $.validator.addClassRules(...) -> FormValidator.addClassRules(...)
 *
 * Only `rules` and `messages` move across (the rule names and parameters are the same). Every other option is kept in a comment with its name so nothing is lost silently.
 * The jQuery compatibility layer (dist/formValidator.jquery.js) needs no codemod at all; this is for code that should stop depending on jQuery.
 */
// Skips strings, template literals, regex-ish and comments while matching a bracket pair. Returns the index of the closing bracket, or -1.
function matchClose(src, open) {
    const pairs = { '{': '}', '(': ')', '[': ']' };
    const stack = [];
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (c === '"' || c === "'" || c === '`') {
            for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
            continue;
        }
        if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) return -1; i++; continue; }
        if (pairs[c]) stack.push(pairs[c]);
        else if (c === '}' || c === ')' || c === ']') { if (stack.pop() !== c) return -1; if (!stack.length) return i; }
    }
    return -1;
}
// The top-level properties of an object literal text "{ a: 1, b: {..} }" -> [{ key, text }]
function splitProps(body) {
    const out = [];
    let i = 0;
    const n = body.length;
    while (i < n) {
        while (i < n && /[\s,]/.test(body[i])) i++;
        if (i >= n) break;
        const start = i;
        let depth = 0;
        for (; i < n; i++) {
            const c = body[i];
            if (c === '"' || c === "'" || c === '`') { for (i++; i < n && body[i] !== c; i++) if (body[i] === '\\') i++; continue; }
            if (c === '/' && body[i + 1] === '/') { while (i < n && body[i] !== '\n') i++; continue; }
            if (c === '/' && body[i + 1] === '*') { i = body.indexOf('*/', i + 2) + 1; if (i <= 0) i = n; continue; }
            if (c === '{' || c === '(' || c === '[') depth++;
            else if (c === '}' || c === ')' || c === ']') depth--;
            else if (c === ',' && depth === 0) break;
        }
        const text = body.slice(start, i).trim();
        const m = /^(?:(["'])(.+?)\1|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]*)$/.exec(text);
        const shorthand = !m && /^[A-Za-z_$][\w$]*$/.test(text) ? text : null;
        const method = !m ? /^(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(text) : null;
        if (m) out.push({ key: m[2] || m[3], value: m[4].trim(), text });
        else if (shorthand) out.push({ key: shorthand, value: shorthand, text });
        else if (method) out.push({ key: method[1], value: null, text });
        else if (text) out.push({ key: null, value: null, text });
    }
    return out;
}

/** migrateSource(text) -> { code, changes: [{ line, kind, note? }], todo: [string] } */
function migrateSource(text) {
    let code = String(text);
    const changes = [], todo = [];
    const lineOf = idx => code.slice(0, idx).split('\n').length;

    // $.validator.addMethod / addClassRules / setDefaults
    code = code.replace(/(?:\$|jQuery)\.validator\.(addMethod|addClassRules)\s*\(/g, (m, fn, idx) => { changes.push({ line: lineOf(idx), kind: fn }); return 'FormValidator.' + fn + '('; });

    // $('#id').validate({ ... })
    const re = /(?:\$|jQuery)\(\s*(["'])([^"'\n]+)\1\s*\)\s*\.validate\s*\(\s*(?=\{)/g;
    let m, out = '', last = 0;
    while ((m = re.exec(code))) {
        const objStart = m.index + m[0].length;
        const objEnd = matchClose(code, objStart);
        if (objEnd < 0) { todo.push('line ' + lineOf(m.index) + ': could not find the end of the validate() options; left as it is'); continue; }
        const closeParen = code.indexOf(')', objEnd);
        if (closeParen < 0 || code.slice(objEnd + 1, closeParen).trim()) { todo.push('line ' + lineOf(m.index) + ': unusual validate() call; left as it is'); continue; }
        const props = splitProps(code.slice(objStart + 1, objEnd));
        const keep = [], left = [];
        props.forEach(p => { if (p.key === 'rules' || p.key === 'messages') keep.push(p.key + ': ' + p.value); else if (p.key) left.push(p); });
        if (!keep.some(k => /^rules:/.test(k))) keep.unshift('rules: {}');
        const sel = m[2];
        let repl = 'FormValidator.init({ form: ' + JSON.stringify(sel).replace(/^"|"$/g, "'").replace(/\\"/g, '"') + ', ' + keep.join(', ');
        if (left.length) {
            repl += ' /* TODO (jQuery Validation options with no direct switch yet): ' + left.map(p => p.key).join(', ') + ' */';
            todo.push('line ' + lineOf(m.index) + ' ' + sel + ': check ' + left.map(p => p.key).join(', ') + ' (see docs/Migrating-from-jQuery-Validate.md: some are config options, submitHandler becomes handleSubmit / the submit event)');
        }
        repl += ' })';
        changes.push({ line: lineOf(m.index), kind: 'validate', note: sel });
        out += code.slice(last, m.index) + repl;
        last = closeParen + 1;
        re.lastIndex = last;
    }
    code = out + code.slice(last);
    code = code.replace(/(?:\$|jQuery)\(\s*(["'])([^"'\n]+)\1\s*\)\s*\.validate\s*\(\s*\)/g, (m0, q, sel, idx) => { changes.push({ line: lineOf(idx), kind: 'validate', note: sel }); return "FormValidator.init({ form: '" + sel + "', rules: {} })"; });   // rules come from the markup

    code = code.replace(/(?:\$|jQuery)\(\s*(["'])([^"'\n]+)\1\s*\)\.valid\(\)/g, (m0, q, sel, idx) => { changes.push({ line: lineOf(idx), kind: 'valid', note: sel }); return "FormValidator.isValid('" + sel + "')"; });   // both are synchronous
    if (/\.rules\(\s*["'](add|remove)["']/.test(code)) todo.push('.rules("add"/"remove"): use inst.addRules(...) / the rules object (needs the jQuery compatibility layer otherwise)');
    return { code, changes, todo };
}
module.exports = { migrateSource, matchClose, splitProps };
