/*!
 * Lit bindings v1.0.0 — a ReactiveController for LitElement (and any element that follows the ReactiveController host contract). Needs lit >= 2 (optional peer dependency).
 *
 *   import { LitElement, html } from 'lit';
 *   import { FvFormController } from 'form-and-file-validator/lit';
 *
 *   class SignupForm extends LitElement {
 *     fv = new FvFormController(this, { rules: { email: ['required', 'email'] } });
 *     render() {
 *       return html`<form @submit=${this.fv.handleSubmit(async values => { await save(values); })}>
 *         <input name="email">
 *         ${this.fv.errors.map(e => html`<p>${e.name}: ${e.message}</p>`)}
 *         <button ?disabled=${this.fv.submitting}>Save</button>
 *       </form>`;
 *     }
 *   }
 *
 * The form is found inside the element's render root (shadow DOM or light DOM): the first <form>, or options.form (a selector). Messages are placed by the engine inside it, or
 * render `fv.errors` yourself. Properties: errors (refreshed after each check and while the user fixes fields), valid (true / false / null before the first check), submitting,
 * instance. Methods: validate(options), handleSubmit(fn), getValues(), setServerErrors(body), reset().
 * Direct submit (the browser posts the form): leave out @submit; a valid form posts, an invalid one is blocked.
 *
 * Changelog
 *   1.0.0  First release.
 */
import { FormValidator } from 'form-and-file-validator';

export class FvFormController {
    /** host: the LitElement. options: { rules, config, messages, context, form: 'selector' }. */
    constructor(host, options) {
        this.host = host;
        this.options = options || {};
        this.errors = [];
        this.valid = null;
        this.submitting = false;
        this._inst = null;
        this._off = [];
        if (host && typeof host.addController === 'function') host.addController(this);
    }

    hostConnected() { /* the form exists after the first render */ }
    hostUpdated() { this._attach(); }
    hostDisconnected() { this._detach(); }

    _find() {
        const root = this.host.renderRoot || this.host.shadowRoot || this.host;
        return this.options.form ? root.querySelector(this.options.form) : root.querySelector('form');
    }
    _attach() {
        const form = this._find();
        if (form === this._form && this._inst) return;
        this._detach();
        if (!form) return;
        const o = this.options;
        const config = Object.assign({}, o.config);
        const onError = config.onError, onSuccess = config.onSuccess;
        config.onError = list => { this.valid = false; this._sync(); if (typeof onError === 'function') onError(list); };
        config.onSuccess = () => { this.valid = true; this._sync(); if (typeof onSuccess === 'function') onSuccess(); };
        this._form = form;
        this._inst = FormValidator.init({ form, rules: o.rules || {}, config, messages: o.messages, context: o.context });
        const refresh = () => setTimeout(() => this._sync(), 0);
        ['input', 'change', 'focusout'].forEach(t => { form.addEventListener(t, refresh); this._off.push(() => form.removeEventListener(t, refresh)); });
    }
    _detach() {
        this._off.forEach(f => f()); this._off = [];
        if (this._inst) this._inst.destroy();
        this._inst = null; this._form = null;
    }
    _sync() {
        if (!this._inst) return;
        const next = this._inst.getErrors().map(e => ({ name: e.name, message: e.message, code: e.code, field: e.field }));
        const same = next.length === this.errors.length && next.every((e, i) => e.name === this.errors[i].name && e.message === this.errors[i].message);
        this.errors = next;
        if (!same) this.host.requestUpdate();
    }

    get instance() { return this._inst; }
    getValues() { return this._inst ? this._inst.getValues() : {}; }
    async validate(opts) { if (!this._inst) return false; const ok = await this._inst.validate(opts); this.valid = ok; this._sync(); return ok; }
    /** @submit handler: validates, then calls fn(values, event) only for a valid form; fn may return { errors } from your server. */
    handleSubmit(fn) {
        return async event => {
            if (!this._inst) { if (event && event.preventDefault) event.preventDefault(); return { valid: false, values: {}, errors: [] }; }
            this.submitting = true; this.host.requestUpdate();
            try {
                const r = await this._inst.handleSubmit(fn)(event);
                this.valid = r.valid;
                return r;
            } finally { this.submitting = false; this._sync(); this.host.requestUpdate(); }
        };
    }
    setServerErrors(body, o) { if (!this._inst) return null; const r = this._inst.setServerErrors(body, o); this._sync(); return r; }
    /** Precognition: asks your real endpoint whether the current values pass and shows its field errors. */
    async validateOnServer(url, o) { if (!this._inst) return { valid: null, status: 0, errors: {}, all: {}, form: [], only: null }; const r = await this._inst.validateOnServer(url, o); this._sync(); return r; }
    reset() { if (this._inst) { this._inst.resetForm(); this.valid = null; this._sync(); } }
}

export default { FvFormController };
