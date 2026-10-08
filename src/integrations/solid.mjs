/*!
 * Solid bindings v1.0.0 — createFormValidator() for SolidJS. Needs solid-js >= 1.6 (optional peer dependency).
 *
 *   import { createFormValidator } from 'form-and-file-validator/solid';
 *
 *   function Signup() {
 *     const fv = createFormValidator({ rules: { email: ['required', 'email'] } });
 *     const save = fv.handleSubmit(async values => { await fetch('/signup', { method: 'POST', body: JSON.stringify(values) }); });
 *     return (
 *       <form ref={fv.ref} onSubmit={save}>
 *         <input name="email" />
 *         <For each={fv.errors()}>{e => <p>{e.name}: {e.message}</p>}</For>
 *         <button disabled={fv.submitting()}>Save</button>
 *       </form>
 *     );
 *   }
 *
 * Returns { ref, errors (accessor of { name, message, code, field }[]), valid (accessor: true / false / null before the first check), submitting (accessor),
 *   validate(options), handleSubmit(fn), getValues(), setServerErrors(body, options), reset(), instance() }.
 * The validator is created when the form gets its ref and destroyed with the owner (onCleanup). Direct submit: leave out onSubmit and give the form `action` / `method`.
 *
 * Changelog
 *   1.0.0  First release.
 */
import { createSignal, onCleanup, getOwner } from 'solid-js';
import { FormValidator } from 'form-and-file-validator';

export function createFormValidator(options) {
    const o = options || {};
    const [errors, setErrors] = createSignal([]);
    const [valid, setValid] = createSignal(null);
    const [submitting, setSubmitting] = createSignal(false);
    let inst = null, node = null, off = [];
    const sync = () => { if (inst) setErrors(inst.getErrors().map(e => ({ name: e.name, message: e.message, code: e.code, field: e.field }))); };
    const stop = () => { off.forEach(f => f()); off = []; if (inst) inst.destroy(); inst = null; };
    const start = el => {
        stop();
        node = el;
        if (!el) return;
        const config = Object.assign({}, o.config);
        const onError = config.onError, onSuccess = config.onSuccess;
        config.onError = list => { setValid(false); sync(); if (typeof onError === 'function') onError(list); };
        config.onSuccess = () => { setValid(true); sync(); if (typeof onSuccess === 'function') onSuccess(); };
        inst = FormValidator.init({ form: el, rules: o.rules || {}, config, messages: o.messages, context: o.context });
        const refresh = () => setTimeout(sync, 0);
        ['input', 'change', 'focusout'].forEach(t => { el.addEventListener(t, refresh); off.push(() => el.removeEventListener(t, refresh)); });
        sync();
    };
    if (getOwner()) onCleanup(stop);
    return {
        // Solid calls ref with the element once its children exist; the engine starts on the next microtask so late-rendered children are there too
        ref: el => { queueMicrotask(() => start(el)); },
        errors, valid, submitting,
        async validate(opts) { if (!inst) return false; const ok = await inst.validate(opts); setValid(ok); sync(); return ok; },
        handleSubmit(fn) {
            return async event => {
                if (!inst) { if (event && event.preventDefault) event.preventDefault(); return { valid: false, values: {}, errors: [] }; }
                setSubmitting(true);
                try {
                    const r = await inst.handleSubmit(fn)(event);
                    setValid(r.valid); sync();
                    return r;
                } finally { setSubmitting(false); }
            };
        },
        getValues: () => (inst ? inst.getValues() : {}),
        setServerErrors(body, opts) { if (!inst) return null; const r = inst.setServerErrors(body, opts); sync(); return r; },
        /** Precognition: asks your real endpoint whether the current values pass and shows its field errors. */
        async validateOnServer(url, opts) { if (!inst) return { valid: null, status: 0, errors: {}, all: {}, form: [], only: null }; const r = await inst.validateOnServer(url, opts); sync(); return r; },
        reset() { if (inst) { inst.resetForm(); setValid(null); sync(); } },
        instance: () => inst,
        element: () => node
    };
}

export default { createFormValidator };
