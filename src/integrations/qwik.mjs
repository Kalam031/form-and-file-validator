/*!
 * Qwik bindings v1.0.0 — fvQwik() for Qwik and Qwik City. Needs nothing from Qwik itself (no peer dependency): it is plain functions that you call
 * inside the places Qwik runs code in the browser, so they work with any Qwik version (@builder.io/qwik 1.x and @qwik.dev/core 2.x).
 *
 *   import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
 *   import { fvQwik } from 'form-and-file-validator/qwik';
 *
 *   export default component$(() => {
 *     const errors = useSignal([]);
 *     const formRef = useSignal();
 *     useVisibleTask$(({ cleanup }) => {                       // runs in the browser only, after the HTML is shown
 *       const fv = fvQwik(formRef.value, { rules: { email: ['required', 'email'] }, onErrors: list => { errors.value = list; } });
 *       cleanup(() => fv.destroy());
 *     }, { strategy: 'document-ready' });                      // or leave the default: it starts when the form scrolls into view
 *     return <form ref={formRef} preventdefault:submit><input name="email" /><ul>{errors.value.map(e => <li key={e.name}>{e.message}</li>)}</ul><button>Save</button></form>;
 *   });
 *
 *   // Qwik City, on the server: the same rules check what the browser posted
 *   export const useSignup = routeAction$(async (data, { fail }) => {
 *     const r = fvQwikCheck({ email: ['required', 'email'] }, data);
 *     if (!r.ok) return fail(400, { errors: r.errors });
 *     // r.values holds the validated data
 *   });
 *
 * fvQwik(form, options) options: rules, config, messages, context (as FormValidator.init), onErrors(list) called with [{ name, message, code }] after every check,
 * onValid(valid) true / false after every check. Returns { errors() (plain data, safe to put in a signal), valid(), validate(options), handleSubmit(fn),
 * getValues(), setServerErrors(body, options), validateOnServer(url, options), reset(), instance(), destroy() }.
 * fvQwikCheck(rules, data, options) -> { ok, values, errors: { field: message }, details } (no DOM; runs in routeAction$ / server$ / endpoints).
 *
 * Changelog
 *   1.0.0  First release.
 */
import { FormValidator } from 'form-and-file-validator';

const plain = list => list.map(e => ({ name: e.name, message: e.message, code: e.code }));   // no DOM nodes: Qwik serializes signal values

export function fvQwik(form, options) {
    const o = options || {};
    if (!form) throw new Error('fvQwik: the form element is missing (pass formRef.value from inside useVisibleTask$)');
    let valid = null, errors = [];
    const config = Object.assign({}, o.config);
    const onError = config.onError, onSuccess = config.onSuccess;
    const emit = ok => {
        if (inst) errors = plain(inst.getErrors());
        if (ok !== undefined) valid = ok;
        if (typeof o.onErrors === 'function') o.onErrors(errors.slice());
        if (typeof o.onValid === 'function' && ok !== undefined) o.onValid(ok);
    };
    config.onError = list => { emit(false); if (typeof onError === 'function') onError(list); };
    config.onSuccess = () => { emit(true); if (typeof onSuccess === 'function') onSuccess(); };
    const inst = FormValidator.init({ form, rules: o.rules || {}, config, messages: o.messages, context: o.context });
    // errors also change while the visitor fixes fields (live feedback) and when a field is cleared: follow the engine after the event
    const refresh = () => setTimeout(() => { if (alive) emit(); }, 0);
    let alive = true;
    ['input', 'change', 'focusout'].forEach(t => form.addEventListener(t, refresh));
    const ctl = {
        errors: () => errors.slice(),
        valid: () => valid,
        async validate(opts) { const ok = await inst.validate(opts); emit(ok); return ok; },
        /** submit handler: validates, then calls fn(values, event) only when valid. fn may return { errors: { field: message } } from your server. */
        handleSubmit(fn) {
            return async event => {
                const r = await inst.handleSubmit(fn)(event);
                emit(r.valid);
                return r;
            };
        },
        getValues: () => inst.getValues(),
        setServerErrors(body, opts) { const r = inst.setServerErrors(body, opts); emit(); return r; },
        async validateOnServer(url, opts) { const r = await inst.validateOnServer(url, opts); emit(); return r; },
        reset() { inst.resetForm(); valid = null; emit(); },
        instance: () => inst,
        destroy() { alive = false; ['input', 'change', 'focusout'].forEach(t => form.removeEventListener(t, refresh)); inst.destroy(); }
    };
    emit();
    return ctl;
}

/** Server side, no DOM: fvQwikCheck(rules, data) -> { ok, values, errors: { field: message }, details }. `data` may be the object Qwik City gives routeAction$, FormData or URLSearchParams. */
export function fvQwikCheck(rules, data, options) {
    const o = options || {};
    const values = (data && typeof data === 'object' && !(typeof FormData !== 'undefined' && data instanceof FormData) && !(typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams))
        ? data : FormValidator.parseFormData(data, { coerce: o.coerce === true });
    const r = FormValidator.checkValues(values, rules, o);
    return { ok: r.valid, values, errors: r.errors, details: r.details };
}

export default { fvQwik, fvQwikCheck };
