/*!
 * FormValidator testing helpers v1.0.0 — fill a form, submit it, wait for the checks, assert on the messages. Works with jsdom, happy-dom, Playwright's page.evaluate and a browser.
 *
 *   const t = require('form-and-file-validator/testing');
 *   await t.fillAndSubmit(form, { email: 'nope', terms: true, plan: 'pro', tags: ['a', 'b'] });
 *   t.expectError(form, 'email', /valid email/i);        // throws a readable Error listing what is shown when it does not match
 *   t.expectNoError(form, 'plan');   t.expectValid(form);
 *   t.errors(form);                                       // { email: 'Please enter a valid email address.' }
 *
 *   const fetch = t.fakeFetch({ 'GET /check-username': { json: true }, 'POST /signup': req => ({ status: 422, json: { errors: { email: ['Taken'] } } }) });
 *   FormValidator.precognition('/signup', values, { fetch });     fetch.calls  // [{ method, url, body, headers }]
 *
 * Changelog
 *   1.0.0  First release.
 */
'use strict';
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(root);
    else root.FormValidatorTesting = factory(root);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
    const win = el => (el && el.ownerDocument && el.ownerDocument.defaultView) || root.window || root;
    const fire = (el, type, init) => { const W = win(el); el.dispatchEvent(new W.Event(type, Object.assign({ bubbles: true, cancelable: true }, init))); };
    const toList = v => (Array.isArray(v) ? v : [v]).map(x => (x === null || x === undefined ? '' : String(x)));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const formOf = f => (typeof f === 'string' ? root.document.querySelector(f) : f && f.jquery ? f[0] : f);
    const instOf = form => form && form._fvInstance;

    /** Sets the fields like a person would: text typed (input), options chosen (change), boxes ticked, then focus leaves (focusout). Names that are not in the form throw. */
    function fill(form, values, options) {
        const f = formOf(form);
        if (!f) throw new Error('fill: form not found');
        const o = options || {};
        Object.keys(values || {}).forEach(name => {
            const els = Array.from(f.elements).filter(e => e.name === name);
            if (!els.length) throw new Error('fill: the form has no field named "' + name + '" (fields: ' + Array.from(new Set(Array.from(f.elements).map(e => e.name).filter(Boolean))).join(', ') + ')');
            const v = values[name], first = els[0];
            if (first.type === 'checkbox' && els.length === 1 && typeof v === 'boolean') { first.checked = v; fire(first, 'input'); fire(first, 'change'); fire(first, 'focusout'); return; }
            if (first.type === 'checkbox' || first.type === 'radio') {
                const want = toList(v);
                els.forEach(e => { e.checked = want.indexOf(e.value) >= 0; });
                els.forEach(e => { fire(e, 'input'); fire(e, 'change'); });
                fire(els[els.length - 1], 'focusout');
                return;
            }
            if (first.tagName === 'SELECT') {
                const want = toList(v);
                Array.from(first.options).forEach(op => { op.selected = want.indexOf(op.value) >= 0; });
                fire(first, 'input'); fire(first, 'change'); fire(first, 'focusout');
                return;
            }
            if (first.type === 'file') {
                const files = [].concat(v || []);
                Object.defineProperty(first, 'files', { value: files, configurable: true });
                fire(first, 'input'); fire(first, 'change'); fire(first, 'focusout');
                return;
            }
            first.value = v === null || v === undefined ? '' : String(v);
            fire(first, 'input');
            if (o.change !== false) fire(first, 'change');
            fire(first, 'focusout');
        });
    }

    /** Waits until nothing is pending: asynchronous checks have answered and debounce timers have run. */
    async function settle(form, options) {
        const o = options || {};
        const f = formOf(form), inst = instOf(f);
        const deadline = Date.now() + (o.timeout || 2000);
        await sleep(typeof o.delay === 'number' ? o.delay : 20);
        while (inst && Date.now() < deadline) {
            let busy = false;
            try { busy = inst.state.validating || inst.isSubmitting(); } catch (e) { busy = false; }
            if (!busy) break;
            await sleep(10);
        }
        await sleep(0);
    }

    /** Presses the submit button (or requestSubmit / a submit event) and waits for the validator to finish. Resolves to the errors that are showing. */
    async function submit(form, options) {
        const f = formOf(form);
        if (!f) throw new Error('submit: form not found');
        const o = options || {};
        const btn = o.button ? (typeof o.button === 'string' ? f.querySelector(o.button) : o.button) : f.querySelector('button[type=submit], input[type=submit], button:not([type])');
        if (btn && typeof btn.click === 'function') btn.click();
        else if (typeof f.requestSubmit === 'function') f.requestSubmit();
        else fire(f, 'submit');
        await settle(f, o);
        return errors(f);
    }
    async function fillAndSubmit(form, values, options) { fill(form, values, options); return submit(form, options); }

    /** { fieldName: message } for every message that shows now. */
    function errors(form) {
        const f = formOf(form), out = {};
        if (!f) return out;
        Array.from(f.querySelectorAll('[data-error-for]')).forEach(el => { const n = el.getAttribute('data-error-for'); if (!(n in out)) out[n] = el.textContent.trim(); });
        const inst = instOf(f);
        if (inst && typeof inst.getErrors === 'function') inst.getErrors().forEach(e => { if (!(e.name in out)) out[e.name] = e.message; });
        return out;
    }
    const shown = e => { const k = Object.keys(e); return k.length ? k.map(n => '  ' + n + ': ' + JSON.stringify(e[n])).join('\n') : '  (no messages)'; };
    function expectError(form, name, matcher) {
        const e = errors(form);
        if (!(name in e)) throw new Error('expected an error on "' + name + '" but there is none.\nShowing:\n' + shown(e));
        if (matcher !== undefined && !(matcher instanceof RegExp ? matcher.test(e[name]) : e[name] === matcher || e[name].indexOf(String(matcher)) >= 0)) {
            throw new Error('the error on "' + name + '" is ' + JSON.stringify(e[name]) + ', expected ' + (matcher instanceof RegExp ? String(matcher) : JSON.stringify(matcher)) + '.');
        }
        return e[name];
    }
    function expectNoError(form, name) {
        const e = errors(form);
        if (name in e) throw new Error('expected no error on "' + name + '" but it shows ' + JSON.stringify(e[name]) + '.');
    }
    function expectValid(form) {
        const e = errors(form);
        if (Object.keys(e).length) throw new Error('expected a valid form but these messages show:\n' + shown(e));
    }
    function expectInvalid(form, names) {
        const e = errors(form);
        const want = [].concat(names || []);
        if (!Object.keys(e).length) throw new Error('expected errors but the form shows none.');
        want.forEach(n => { if (!(n in e)) throw new Error('expected an error on "' + n + '".\nShowing:\n' + shown(e)); });
        if (names !== undefined) { const extra = Object.keys(e).filter(k => want.indexOf(k) < 0); if (extra.length) throw new Error('unexpected errors on ' + extra.join(', ') + '.\nShowing:\n' + shown(e)); }
    }

    /**
     * A fetch stand-in: fakeFetch({ 'GET /check': { json: true }, '/signup': req => ({ status: 422, json: {...} }), 'POST /slow': { delay: 50, text: 'ok' } }).
     * A route is 'METHOD /path' or '/path' (any method), or a regular expression written 're:/^\/api\/\d+$/'. A route is an answer { status = 200, json | text, headers, delay } or a function(request).
     * Unmatched calls answer 404. fetch.calls lists { method, url, body, headers }.
     */
    function fakeFetch(routes) {
        const table = Object.keys(routes || {}).map(k => {
            const m = /^(?:([A-Z]+)\s+)?(.*)$/.exec(k);
            const rx = /^re:\/(.+)\/([a-z]*)$/.exec(m[2]);   // 're:/^\/api\/\d+$/'
            return { method: m[1] || null, path: m[2], re: rx ? new RegExp(rx[1], rx[2]) : null, handler: routes[k] };
        });
        const fetch = async function (url, init) {
            const i = init || {};
            const method = String(i.method || 'GET').toUpperCase();
            const u = new URL(String(url), 'http://localhost');
            const body = i.body && typeof i.body === 'string' ? i.body : (i.body && typeof i.body.toString === 'function' && !(typeof FormData === 'function' && i.body instanceof FormData) ? String(i.body) : i.body);
            const req = { method, url: String(url), path: u.pathname, query: Object.fromEntries(u.searchParams.entries()), body, headers: Object.assign({}, i.headers) };
            fetch.calls.push(req);
            if (i.signal && i.signal.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
            const hit = table.find(r => (!r.method || r.method === method) && (r.re ? r.re.test(u.pathname) : r.path === u.pathname || r.path === String(url)));
            let res = hit ? (typeof hit.handler === 'function' ? await hit.handler(req) : hit.handler) : { status: 404 };
            if (res && typeof res.then === 'function') res = await res;
            res = res || {};
            if (res.delay) await new Promise((resolve, reject) => { const t = setTimeout(resolve, res.delay); if (i.signal) i.signal.addEventListener('abort', () => { clearTimeout(t); const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }, { once: true }); });
            const status = res.status === undefined ? 200 : res.status;
            const text = res.text !== undefined ? String(res.text) : (res.json !== undefined ? JSON.stringify(res.json) : '');
            const h = {};
            if (res.json !== undefined) h['content-type'] = 'application/json';
            Object.keys(res.headers || {}).forEach(k => { h[k.toLowerCase()] = res.headers[k]; });
            return { ok: status >= 200 && status < 300, status, headers: { get: k => h[String(k).toLowerCase()] || null, forEach: fn => Object.keys(h).forEach(k => fn(h[k], k)) }, json: async () => { if (res.json !== undefined) return res.json; return JSON.parse(text); }, text: async () => text };
        };
        fetch.calls = [];
        return fetch;
    }

    return { fill, submit, fillAndSubmit, settle, errors, expectError, expectNoError, expectValid, expectInvalid, fakeFetch, version: '1.0.0' };
});
