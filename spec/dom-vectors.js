/*
 * Runs spec/form-rules.vectors.json through the real DOM form engine (FormValidator.init + validate), not the value-only checkValue.
 * The same function runs in jsdom (tests/conformance.dom.test.js) and inside every real browser (browser-tests/browser.spec.js),
 * so a browser engine that parses URLs, dates or Unicode differently from the others shows up as a failing vector.
 * Returns the list of cases that got a different answer than the file says (empty = all good).
 */
(function (root) {
    async function runDomVectors(FormValidator, cases) {
        const doc = root.document;
        const bad = [];
        for (const c of cases) {
            const form = doc.createElement('form');
            const add = (name, value) => { const i = doc.createElement('input'); i.type = 'text'; i.name = name; i.value = value; form.appendChild(i); return i; };
            add('field', c.value);
            Object.keys(c.values || {}).forEach(k => add(k, c.values[k]));
            doc.body.appendChild(form);
            let ok, error = '';
            try {
                const inst = FormValidator.init({ form, rules: { field: c.rule }, config: { focusInvalid: false } });
                ok = await inst.validate({ focus: false });
                inst.destroy();
            } catch (e) { ok = 'threw'; error = String(e && e.message || e); }
            form.remove();
            if (ok !== c.valid) bad.push(JSON.stringify(c.rule) + ' on ' + JSON.stringify(c.value) + ': expected ' + c.valid + ', got ' + ok + (error ? ' (' + error + ')' : ''));
        }
        return bad;
    }
    if (typeof module === 'object' && module.exports) module.exports = runDomVectors;
    root.runDomVectors = runDomVectors;
})(typeof window !== 'undefined' ? window : globalThis);
