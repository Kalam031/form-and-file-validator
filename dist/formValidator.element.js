/*!
 * FormValidator element v1.1.0 — <fv-field> (any FormValidator rule as native constraint validation, in plain HTML, no init call) and <fv-form> (a whole form started from HTML).
 *
 *   <form>
 *     <fv-field rules="required email">
 *       <label for="e">Email</label>
 *       <input id="e" name="email">
 *     </fv-field>
 *     <fv-field rules="required pwcheck" ...>                     <!-- rule names, optionally with a parameter:  minlength:3  range:1,10  pattern:^[A-Z]+$  -->
 *     <fv-field rules='[{"type":"minDate","min":"2020-01-01"}]'>  <!-- or JSON: a list, or the map shorthand {"minlength":3,"equalTo":"password"} -->
 *     <fv-field rules="required" server="/signup">                <!-- ask your real endpoint (Precognition) when the user leaves the field -->
 *   </form>
 *
 * The rules run on the native control inside the element and are handed to the browser with setCustomValidity(), so form.checkValidity(), reportValidity(),
 * a blocked submit, the native :user-invalid / :user-valid pseudo-classes and the browser's own bubble all follow them. Reward early, punish late is the
 * browser's own rule for :user-invalid; the message under the field follows it too: it appears after the user leaves the field (or tries to submit) and
 * disappears the moment the value is right. Messages, language packs and cross-field rules (equalTo / notEqualTo read the other fields of the form) are the
 * engine's. Radio groups, checkbox groups, selects and textareas work. ElementInternals is used for the custom states :state(user-invalid) and
 * :state(user-valid) when the browser has it; nothing depends on it.
 *
 * Note: like the native pseudo-classes, checkValidity() fires the `invalid` event, and a field that gets one shows its message (so does reportValidity() and a blocked submit).
 *
 * mask="(999) 999-9999" formats the input while typing (FormValidator.mask) and asks for a complete value.
 *
 * Attributes: rules, mask, messages (JSON { rule: text }), server (URL), server-encoding ('form' default | 'json'), server-delay (ms, 300), native-bubble (keep the
 * browser's own bubble instead of our inline message), control (CSS selector when the field is not the first input inside).
 * Properties and methods: rules, messages, control, controls, value, validity, validationMessage, willValidate, checkValidity(), reportValidity(), validate(), reset(),
 * setServerError(text). Event: `fv-validate` (bubbles) with detail { valid, rule, code, message, shown }.
 * Styling: .fv-error (the message), [data-state="valid|invalid"] and [data-shown] on the element, input:user-invalid / fv-field:state(user-invalid).
 *
 * Needs FormValidator (the bundle, or formValidator.js): registered as <fv-field> when it loads; FormValidator.fieldElement.define('my-field') uses another name.
 *
 * <fv-form>: wrap a form, no script:
 *   <fv-form rules='{"email":"required email","age":"required digits"}' lang="de" validate-on="blur" error-summary>
 *     <form action="/signup" method="post">  <input name="email">  <input name="age" data-fv="min:18">  <button>Send</button>  </form>
 *   </fv-form>
 * Fields can also carry data-fv / data-fv-mask (the `rules` attribute wins). Attributes: rules (JSON map), messages (JSON), config (JSON of any FormValidator config),
 * lang, validate-on, error-summary, valid-class, auto-attributes, form (CSS selector when the form is not the first one inside).
 * Events (bubble): `fv-ready` { instance }, `fv-invalid` { errors }, `fv-valid`, and `fv-submit` { values, form, event } when a valid form is submitted: call
 * preventDefault() to send it yourself (fetch ...); otherwise the browser posts it as usual. Properties / methods: instance, form, rules, values, errors, valid, state,
 * validate(), validateStep(n), setErrors(map), clearErrors(), reset(). A form rendered later by a framework is picked up; moving or removing the element cleans up.
 *
 * Changelog
 *   1.1.0  <fv-form>.
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['./formValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, require('./formValidator.js'));
    else factory(root, root.FormValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';
    if (!FV) throw new Error('formValidator.element.js needs FormValidator loaded first');

    const DEFAULT_NAME = 'fv-field';
    let uid = 0;
    const warned = new Set();
    const warnOnce = (key, text) => { if (!warned.has(key)) { warned.add(key); if (root.console && console.warn) console.warn(text); } };

    /** 'required email minlength:3 pattern:^a:b$' | '["required"]' | '{"minlength":3}' -> rules for checkValue, or null */
    function parseRules(text) {
        if (typeof FV.parseRules === 'function' && !/^\s*[\[{]/.test(String(text))) return FV.parseRules(text);
        const s = String(text === null || text === undefined ? '' : text).trim();
        if (!s) return null;
        if (s.charAt(0) === '[' || s.charAt(0) === '{') {
            try { return JSON.parse(s); } catch (e) { warnOnce('json:' + s, 'fv-field: the rules attribute is not valid JSON and is ignored: ' + s); return null; }
        }
        const map = {};
        s.split(/\s+/).forEach(tok => {
            const i = tok.indexOf(':');
            const name = i < 0 ? tok : tok.slice(0, i);
            if (!name || name === '__proto__' || name === 'constructor' || name === 'prototype') return;
            map[name] = i < 0 ? true : tok.slice(i + 1);
        });
        return Object.keys(map).length ? map : null;
    }
    const isCustom = el => !!el.localName && el.localName.indexOf('-') > 0;
    const targetsOf = rules => {
        const out = [];
        const visit = r => {
            if (!r) return;
            if (Array.isArray(r)) { r.forEach(visit); return; }
            if (typeof r !== 'object') return;
            if (r.type) { if ((r.type === 'equalTo' || r.type === 'notEqualTo') && r.target) out.push(String(r.target).replace(/^#/, '')); return; }
            ['equalTo', 'notEqualTo'].forEach(k => {
                if (typeof r[k] === 'string') out.push(r[k].replace(/^#/, ''));
                else if (r[k] && typeof r[k] === 'object' && r[k].target) out.push(String(r[k].target).replace(/^#/, ''));
            });
        };
        visit(rules);
        return out;
    };

    function createClass() {
        const Base = root.HTMLElement;
        class FvField extends Base {
            static get formAssociated() { return true; }
            static get observedAttributes() { return ['rules', 'messages', 'server', 'control', 'mask']; }

            constructor() {
                super();
                this._rules = undefined;        // set through the property: wins over the attribute
                this._messages = undefined;
                this._touched = false;
                this._dirty = false;            // the user typed or picked something (even if it is empty again)
                this._submitted = false;
                this._shown = false;
                this._result = { valid: true, rule: null, code: null, message: '' };
                this._serverMsg = '';
                this._serverFor = null;
                this._token = 0;
                this._timer = null;
                this._abort = null;
                this._cleanups = [];
                this._err = null;
                this._internals = null;
                try { this._internals = typeof this.attachInternals === 'function' ? this.attachInternals() : null; } catch (e) { this._internals = null; }
            }

            // ---------------------------------------------------------------- lifecycle
            connectedCallback() {
                this._form = this.closest ? this.closest('form') : null;
                const on = (el, type, fn, cap) => { if (!el) return; el.addEventListener(type, fn, cap); this._cleanups.push(() => el.removeEventListener(type, fn, cap)); };
                on(this, 'input', e => this._onEvent(e, 'input'));
                on(this, 'change', e => this._onEvent(e, 'change'));
                on(this, 'focusout', e => this._onEvent(e, 'blur'));
                on(this, 'invalid', e => this._onInvalid(e), true);   // invalid does not bubble: capture it
                if (this._form) {
                    on(this._form, 'input', e => this._onSibling(e));
                    on(this._form, 'change', e => this._onSibling(e));
                    on(this._form, 'submit', () => { this._submitted = true; }, true);
                    on(this._form, 'reset', () => setTimeout(() => this.reset(), 0));
                }
                if (typeof root.MutationObserver === 'function') {
                    this._mo = new root.MutationObserver(records => {
                        // a control was added, removed or replaced; our own message element changing must not start a loop
                        const own = n => this._err && (n === this._err || this._err.contains(n));
                        if (records.every(r => own(r.target) || (Array.from(r.addedNodes).concat(Array.from(r.removedNodes)).every(own)))) return;
                        this._check(this._shown);
                    });
                    this._mo.observe(this, { childList: true, subtree: true });
                }
                this._bindMask();
                this._check(false);
            }
            _bindMask() {
                if (this._maskApi) { this._maskApi.destroy(); this._maskApi = null; }
                const pat = this.getAttribute('mask'), c = this.control;
                if (pat && c && typeof FV.mask === 'function' && c.tagName === 'INPUT') this._maskApi = FV.mask(c, pat);
            }
            disconnectedCallback() {
                if (this._maskApi) { this._maskApi.destroy(); this._maskApi = null; }
                this._cleanups.forEach(f => f()); this._cleanups = [];
                if (this._mo) { this._mo.disconnect(); this._mo = null; }
                clearTimeout(this._timer);
                if (this._abort) this._abort.abort();
                this._removeMessage();
                this._form = null;
            }
            attributeChangedCallback(name, oldValue, value) {
                if (oldValue === value || !this.isConnected) return;
                if (name === 'server') { this._serverMsg = ''; }
                if (name === 'mask' || name === 'control') this._bindMask();
                this._check(this._shown);
            }

            // ---------------------------------------------------------------- public API
            get rules() {
                const base = this._rules !== undefined ? this._rules : parseRules(this.getAttribute('rules'));
                const m = this.getAttribute('mask');
                if (!m) return base;
                // mask="(999) 999-9999" also asks for a complete value
                if (!base) return { mask: m };
                if (Array.isArray(base)) return base.concat([{ type: 'mask', pattern: m }]);
                if (typeof base === 'string') return [base, { type: 'mask', pattern: m }];
                if (base.type) return [base, { type: 'mask', pattern: m }];
                return Object.assign({}, base, { mask: m });
            }
            set rules(v) { this._rules = v === null ? undefined : v; if (this.isConnected) this._check(this._shown); }
            get messages() {
                if (this._messages !== undefined) return this._messages;
                const t = this.getAttribute('messages');
                if (!t) return undefined;
                try { const m = JSON.parse(t); return m && typeof m === 'object' ? m : undefined; } catch (e) { warnOnce('msg:' + t, 'fv-field: the messages attribute is not valid JSON and is ignored.'); return undefined; }
            }
            set messages(v) { this._messages = v === null ? undefined : v; if (this.isConnected) this._check(this._shown); }
            /** The native controls inside: one input / select / textarea, or the radios / checkboxes of a group. */
            get controls() {
                const sel = this.getAttribute('control');
                let list;
                try { list = Array.from(this.querySelectorAll(sel || 'input, select, textarea')); } catch (e) { list = []; }
                list = list.filter(c => c !== this && !/^(hidden|submit|button|reset|image)$/i.test(c.type || ''));
                const first = list[0];
                if (first && (first.type === 'radio' || first.type === 'checkbox') && first.name) return list.filter(c => c.type === first.type && c.name === first.name);
                return first ? [first] : [];
            }
            get control() { return this.controls[0] || null; }
            get form() { return this._internals && this._internals.form ? this._internals.form : (this.closest ? this.closest('form') : null); }
            get name() { const c = this.control; return c ? c.name : ''; }
            get type() { return 'fv-field'; }
            get value() { return this._text(); }
            get validity() { const c = this.control; return c ? c.validity : null; }
            get validationMessage() { const c = this.control; return c ? c.validationMessage : ''; }
            get willValidate() { const c = this.control; return !!c && c.willValidate; }
            checkValidity() { this._check(false); const c = this.control; return c ? c.checkValidity() : true; }
            /** Checks now, shows the message and focuses the control when it is invalid. Returns validity. */
            reportValidity() {
                this._touched = true;
                this._check(true);
                const c = this.control;
                const ok = !c || c.validity.valid;
                if (!ok) { try { c.focus(); } catch (e) { /* not focusable */ } }
                return ok;
            }
            /** Checks the value now and shows the message (sync rules; the server check runs on its own). Returns true when valid. */
            validate() { this._touched = true; this._check(true); return this._result.valid && !this._serverMessage(); }
            /** Back to untouched: no message, nothing shown (what a form reset does). */
            reset() { this._touched = false; this._dirty = false; this._submitted = false; this._serverMsg = ''; this._check(false); }
            /** Shows a message from the server on this field until the value changes. */
            setServerError(text) { this._serverMsg = text ? String(text) : ''; this._serverFor = this._text(); this._touched = true; this._check(true); }

            // ---------------------------------------------------------------- values
            _text() {
                const cs = this.controls, f = cs[0];
                if (!f) return '';
                if (f.type === 'radio') { const on = cs.find(c => c.checked); return on ? on.value : ''; }
                if (f.type === 'checkbox') return cs.filter(c => c.checked).map(c => c.value || 'on').join(',');
                if (f.tagName === 'SELECT' && f.multiple) return Array.from(f.selectedOptions).map(o => o.value).join(',');
                if (f.type === 'file') return f.files && f.files.length ? Array.from(f.files).map(x => x.name).join(', ') : '';
                return f.value === null || f.value === undefined ? '' : String(f.value);
            }
            _otherValues() {
                const out = {}, form = this.form;
                if (!form) return out;
                Array.from(form.elements).forEach(el => {
                    if (!el.name || el.disabled || this.contains(el) || isCustom(el)) return;
                    if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) { if (!(el.name in out)) out[el.name] = ''; return; }
                    if (el.type === 'file') { out[el.name] = el.files && el.files.length ? el.files[0].name : ''; return; }
                    out[el.name] = el.value === null || el.value === undefined ? '' : String(el.value);
                });
                return out;
            }

            // ---------------------------------------------------------------- checking
            _evaluate() {
                const rules = this.rules;
                const none = { valid: true, rule: null, code: null, message: '' };
                if (!rules || (Array.isArray(rules) && !rules.length)) return none;
                try {
                    return FV.checkValue(this._text(), rules, { values: this._otherValues(), messages: this.messages });
                } catch (e) {
                    if (/options\.values/.test(String(e && e.message))) return none;   // the other field is not in the form: no opinion
                    warnOnce('rule:' + (e && e.message), 'fv-field: ' + (e && e.message) + ' (this rule is ignored; use the server attribute for checks that need a server)');
                    return none;
                }
            }
            _serverMessage() {
                if (this._serverMsg && this._serverFor !== null && this._serverFor !== this._text()) { this._serverMsg = ''; }   // the value changed: the server's message is stale
                return this._serverMsg;
            }
            /** Runs the rules, hands the answer to the browser, and (when `show`) shows it. */
            _check(show) {
                const r = this._evaluate();
                this._result = r;
                const message = !r.valid ? r.message : this._serverMessage();
                const cs = this.controls;
                cs.forEach((c, i) => { if (typeof c.setCustomValidity === 'function') c.setCustomValidity(i === 0 ? message : ''); });
                const invalid = !!message;
                const showNow = !!show && invalid;
                this._shown = showNow;
                if (showNow) this._showMessage(message, !r.valid ? (r.code || r.rule) : 'server'); else this._removeMessage();
                this._reflect(invalid, showNow);
                if (!invalid && this.getAttribute('server') && this._text() !== '') this._scheduleServer(); else if (this._abort) { this._abort.abort(); this._abort = null; }
                this.dispatchEvent(new root.CustomEvent('fv-validate', { bubbles: true, detail: { valid: !invalid, rule: r.rule, code: !r.valid ? (r.code || r.rule) : (invalid ? 'server' : null), message, shown: showNow } }));
                return !invalid;
            }
            _reflect(invalid, shown) {
                this.setAttribute('data-state', invalid ? 'invalid' : 'valid');
                if (shown) this.setAttribute('data-shown', ''); else this.removeAttribute('data-shown');
                const st = this._internals && this._internals.states;
                if (st) {
                    const set = (name, on) => { try { if (on) st.add(name); else st.delete(name); } catch (e) { /* older engines want --names */ } };
                    set('invalid', invalid); set('valid', !invalid); set('user-invalid', shown); set('user-valid', this._touched && !invalid && this._text() !== '');
                }
            }
            _showMessage(message, code) {
                const D = this.ownerDocument;
                if (!this._err) {
                    this._err = D.createElement('div');
                    this._err.className = 'fv-error';
                    this._err.id = 'fv-field-error-' + (++uid);
                    this._err.setAttribute('role', 'alert');
                    this._err.setAttribute('dir', 'auto');
                }
                this._err.setAttribute('data-code', code || 'custom');
                this._err.textContent = message;
                if (this.hasAttribute('native-bubble')) return;
                const cs = this.controls, last = cs[cs.length - 1];
                if (this._err.parentNode !== this) {
                    if (last && last.parentNode === this) last.insertAdjacentElement('afterend', this._err); else this.appendChild(this._err);
                }
                cs.forEach(c => {
                    c.setAttribute('aria-invalid', 'true');
                    const ids = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
                    if (!ids.includes(this._err.id)) c.setAttribute('aria-describedby', ids.concat(this._err.id).join(' '));
                });
            }
            _removeMessage() {
                if (!this._err) return;
                const id = this._err.id;
                if (this._err.parentNode) this._err.parentNode.removeChild(this._err);
                this.controls.forEach(c => {
                    c.removeAttribute('aria-invalid');
                    const ids = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter(x => x && x !== id);
                    if (ids.length) c.setAttribute('aria-describedby', ids.join(' ')); else c.removeAttribute('aria-describedby');
                });
            }

            // ---------------------------------------------------------------- events
            _onEvent(e, type) {
                if (!this.controls.includes(e.target)) return;
                if (type === 'input') {
                    this._dirty = true;
                    // reward early: a field that shows a message is re-checked while typing; one that does not is checked silently (no message, the browser's own state follows)
                    this._check(this._shown);
                    return;
                }
                this._touched = true;
                // punish late: after the user leaves a field, and not for a field they only tabbed through
                this._check(this._text() !== '' || this._dirty || this._submitted || this._shown);
            }
            _onInvalid(e) {
                if (!this.controls.includes(e.target)) return;
                this._touched = true; this._submitted = true;
                this._check(true);
                if (this.hasAttribute('native-bubble')) return;
                e.preventDefault();   // our message replaces the browser's bubble (which would also have moved the focus: do that ourselves for the first invalid control)
                const form = this.form;
                const firstInvalid = form ? Array.from(form.elements).find(el => !isCustom(el) && typeof el.checkValidity === 'function' && el.willValidate && !el.validity.valid) : null;   // the <fv-field> hosts are in form.elements too: skip them
                if (firstInvalid === e.target) { try { e.target.focus(); } catch (err) { /* not focusable */ } }
            }
            _onSibling(e) {
                const t = e.target;
                if (!t || !t.name || this.contains(t)) return;
                if (targetsOf(this.rules).indexOf(t.name) >= 0) this._check(this._shown || (this._touched && this._text() !== ''));
            }

            // ---------------------------------------------------------------- the server (Precognition)
            _scheduleServer() {
                clearTimeout(this._timer);
                const delay = parseInt(this.getAttribute('server-delay'), 10);
                this._timer = setTimeout(() => this._askServer(), isFinite(delay) ? delay : 300);
            }
            async _askServer() {
                const url = this.getAttribute('server'), name = this.name;
                if (!url || !name || this._result.valid === false) return;
                if (!this._touched) return;   // only after the user has been in the field
                const token = ++this._token;
                if (this._abort) this._abort.abort();
                this._abort = typeof root.AbortController === 'function' ? new root.AbortController() : null;
                const asked = this._text();
                const form = this.form;
                const flat = Object.assign(this._otherValues(), { [name]: asked });
                let values = flat;
                if (this.getAttribute('server-encoding') === 'json' && form && typeof root.FormData === 'function') values = FV.parseFormData(new root.FormData(form));
                const r = await FV.precognition(url, values, { only: [name], encoding: this.getAttribute('server-encoding') === 'json' ? 'json' : 'form', signal: this._abort ? this._abort.signal : undefined });
                if (token !== this._token || r.valid === null || this._text() !== asked) return;
                const canon = String(name).replace(/\.(\d+)(?=\.|$)/g, '[$1]');
                const msg = r.valid === false ? (r.errors[canon] || r.errors[name] || r.form[0] || '') : '';
                if (msg) { this._serverMsg = msg; this._serverFor = asked; } else if (this._serverMsg) { this._serverMsg = ''; }
                this._check(!!msg || this._shown);
            }
        }
        return FvField;
    }

    let Klass = null;
    const fieldElement = {
        /** Registers the element (default name 'fv-field'). Returns the class, or null when this environment has no custom elements. */
        define(name) {
            if (typeof root.customElements === 'undefined' || typeof root.HTMLElement === 'undefined') return null;
            const tag = name || DEFAULT_NAME;
            const existing = root.customElements.get(tag);
            if (existing) return existing;
            if (!Klass) Klass = createClass();
            const C = tag === DEFAULT_NAME ? Klass : class extends Klass {};   // a class can be registered once: another name gets a thin subclass
            root.customElements.define(tag, C);
            return C;
        },
        parseRules
    };
    // ------------------------------------------------------------------ <fv-form>: a whole form, started from HTML
    const FORM_NAME = 'fv-form';
    const jsonAttr = (el, name, what) => {
        const t = el.getAttribute(name);
        if (t === null || t === '') return null;
        try { return JSON.parse(t); } catch (e) { warnOnce(name + ':' + t, 'fv-form: the ' + name + ' attribute is not valid JSON and is ignored: ' + t); return null; }
    };
    function createFormClass() {
        const Base = root.HTMLElement;
        class FvForm extends Base {
            static get observedAttributes() { return ['rules', 'messages', 'config', 'lang', 'validate-on', 'error-summary', 'valid-class', 'auto-attributes', 'form']; }
            constructor() { super(); this._inst = null; this._form = null; this._rules = undefined; this._mo = null; this._starting = false; this._cleanups = []; }

            connectedCallback() { this._schedule(); }
            disconnectedCallback() { this._stop(); }
            attributeChangedCallback(name, oldV, newV) { if (oldV !== newV && this.isConnected && this._inst) this._schedule(); }

            _schedule() {
                if (this._starting) return;
                this._starting = true;
                Promise.resolve().then(() => { this._starting = false; if (this.isConnected) this._start(); });   // children are parsed by now
            }
            _findForm() {
                const sel = this.getAttribute('form');
                if (sel) { const f = this.querySelector(sel) || (root.document && root.document.querySelector(sel)); return f && f.tagName === 'FORM' ? f : null; }
                if (this.tagName === 'FORM') return this;
                return this.querySelector('form') || (this.closest ? this.closest('form') : null);
            }
            /** rules: the `rules` attribute / property (a map name -> rules) plus every data-fv field inside; the attribute wins */
            _collectRules(form) {
                const out = {};
                Array.from(form.querySelectorAll('[data-fv]')).forEach(el => { if (el !== form && el.name) { const r = parseRules(el.getAttribute('data-fv')); if (r) out[el.name] = r; } });
                const given = this._rules !== undefined ? this._rules : jsonAttr(this, 'rules');
                if (given && typeof given === 'object') Object.keys(given).forEach(k => { out[k] = typeof given[k] === 'string' ? (parseRules(given[k]) || given[k]) : given[k]; });
                return out;
            }
            _config(form) {
                const cfg = Object.assign({ autoRules: false }, jsonAttr(this, 'config'));
                if (this.hasAttribute('lang')) cfg.lang = this.getAttribute('lang');
                if (this.hasAttribute('validate-on')) cfg.validateOn = this.getAttribute('validate-on');
                if (this.hasAttribute('error-summary')) cfg.errorSummary = this.getAttribute('error-summary') === 'false' ? false : true;
                if (this.hasAttribute('valid-class')) cfg.validClass = this.getAttribute('valid-class');
                if (this.hasAttribute('auto-attributes')) cfg.autoAttributes = this.getAttribute('auto-attributes') === 'false' ? false : true;
                const host = this;
                cfg.submitHandler = (f, e, values) => {
                    const ev = new root.CustomEvent('fv-submit', { bubbles: true, cancelable: true, detail: { values, form: f, event: e } });
                    host.dispatchEvent(ev);
                    if (ev.defaultPrevented) return undefined;            // your code sends it (fetch ...): the browser does not
                    const inst = host._inst;
                    setTimeout(() => {                                    // hand the form back to the browser on the next task (see FormValidator's own submit)
                        if (inst) inst._bypass = true;
                        try { if (typeof f.requestSubmit === 'function') { try { f.requestSubmit(e && e.submitter || undefined); } catch (err) { f.requestSubmit(); } } else f.submit(); }
                        finally { if (inst) inst._bypass = false; }
                    }, 0);
                    return undefined;
                };
                return cfg;
            }
            _start() {
                this._stop();
                const form = this._findForm();
                if (!form) {                                              // the form may arrive later (a framework renders it): wait for it
                    if (typeof root.MutationObserver === 'function' && !this._mo) {
                        this._mo = new root.MutationObserver(() => { if (this._findForm()) { this._mo.disconnect(); this._mo = null; this._start(); } });
                        this._mo.observe(this, { childList: true, subtree: true });
                    } else warnOnce('noform', 'fv-form: no <form> found inside it.');
                    return;
                }
                if (this._mo) { this._mo.disconnect(); this._mo = null; }
                this._form = form;
                const rules = this._collectRules(form);
                const masks = [];
                Array.from(form.querySelectorAll('[data-fv-mask]')).forEach(el => { if (el.name || el.id) masks.push(FV.mask(el, el.getAttribute('data-fv-mask'))); });
                const inst = FV.init({ form, rules, messages: jsonAttr(this, 'messages') || undefined, config: this._config(form) });
                this._inst = Array.isArray(inst) ? inst[0] : inst;
                this._inst._listeners.push(() => masks.forEach(m => m.destroy()));
                // the form's own events reach the host too (they bubble): re-announce them under the element's name
                const relay = (from, to) => { const fn = e => this.dispatchEvent(new root.CustomEvent(to, { detail: e.detail })); form.addEventListener(from, fn); this._cleanups.push(() => form.removeEventListener(from, fn)); };
                relay('fv:invalid', 'fv-invalid'); relay('fv:valid', 'fv-valid');
                this.dispatchEvent(new root.CustomEvent('fv-ready', { detail: { instance: this._inst } }));
            }
            _stop() {
                this._cleanups.splice(0).forEach(fn => fn());
                if (this._mo) { this._mo.disconnect(); this._mo = null; }
                if (this._inst) { try { this._inst.destroy(); } catch (e) { /* gone */ } }
                if (this._form && this._form._fvInstance === this._inst) this._form._fvInstance = null;
                this._inst = null;
            }

            get instance() { return this._inst; }
            get form() { return this._form; }
            get rules() { return this._rules !== undefined ? this._rules : jsonAttr(this, 'rules'); }
            set rules(v) { this._rules = v; if (this.isConnected) this._schedule(); }
            get values() { return this._inst ? this._inst.getValues() : {}; }
            get errors() { return this._inst ? this._inst.getErrors() : []; }
            get valid() { return this._inst ? this._inst.getErrors().length === 0 : true; }
            get state() { return this._inst ? this._inst.getState() : null; }
            validate(o) { return this._inst ? this._inst.validate(o) : Promise.resolve(true); }
            validateStep(step) { return this._inst ? this._inst.validateStep(step) : Promise.resolve(true); }
            setErrors(map) { return this._inst ? this._inst.setErrors(map) : []; }
            clearErrors() { if (this._inst) this._inst.clearErrors(); }
            reset() { if (this._form) this._form.reset(); }
        }
        return FvForm;
    }
    let FormKlass = null;
    const formElement = {
        /** Registers <fv-form> (or another name). Returns the class, or null when this environment has no custom elements. */
        define(name) {
            if (typeof root.customElements === 'undefined' || typeof root.HTMLElement === 'undefined') return null;
            const tag = name || FORM_NAME;
            const existing = root.customElements.get(tag);
            if (existing) return existing;
            if (!FormKlass) FormKlass = createFormClass();
            const C = tag === FORM_NAME ? FormKlass : class extends FormKlass {};
            root.customElements.define(tag, C);
            return C;
        }
    };
    FV.formElement = formElement;
    try { formElement.define(FORM_NAME); } catch (e) { if (root.console) console.warn('fv-form could not be registered:', e); }

    FV.fieldElement = fieldElement;
    try { fieldElement.define(DEFAULT_NAME); } catch (e) { if (root.console) console.warn('fv-field could not be registered:', e); }
    return fieldElement;
});
