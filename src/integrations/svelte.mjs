/*!
 * Svelte bindings v1.0.0 — an action and stores for Svelte 3, 4 and 5. No Svelte import: an action is a plain function and the stores follow the store contract.
 *
 *   <script>
 *     import { createFormValidator } from 'form-and-file-validator/svelte';
 *     const { form, errors, submitting, handleSubmit, validate } = createFormValidator({ rules: { email: ['required', 'email'] } });
 *     const save = handleSubmit(async values => { await fetch('/signup', { method: 'POST', body: JSON.stringify(values) }); });
 *   </script>
 *   <form use:form onsubmit={save}>                       <!-- Svelte 5: onsubmit,  Svelte 3/4: on:submit={save} -->
 *     <input name="email">
 *     {#each $errors as e}<p>{e.name}: {e.message}</p>{/each}   <!-- or let the engine place the messages -->
 *     <button disabled={$submitting}>Save</button>
 *   </form>
 *
 * Or only the action, no stores:  <form use:fvForm={{ rules: {...}, config: {...} }}>   (the action updates when you pass new options)
 * createFormValidator() returns { form (the action), errors (store of { name, message, code, field }), valid (store: true/false/null before the first check), submitting (store),
 *   validate(options), handleSubmit(fn), getValues(), setServerErrors(body, options), reset(), instance() }.
 * Direct submit: leave out onsubmit and give the form `action` / `method`; a valid form posts, an invalid one is blocked.
 *
 * Changelog
 *   1.0.0  First release.
 */
import { FormValidator } from 'form-and-file-validator';

/** A store with the Svelte contract: subscribe(run) calls run(value) now and on every change, and returns the unsubscribe function. */
function writable(initial) {
    let value = initial;
    const subs = new Set();
    return {
        set(v) { if (v === value && (v === null || typeof v !== 'object')) return; value = v; subs.forEach(fn => fn(value)); },
        subscribe(run) { subs.add(run); run(value); return () => { subs.delete(run); }; },
        get: () => value
    };
}
const readable = w => ({ subscribe: w.subscribe });

/** Attaches FormValidator to a form: `<form use:fvForm={{ rules, config, messages, context }}>`. Updating the options creates the validator again. */
export function fvForm(node, options) {
    let inst = null;
    const start = o => { inst = FormValidator.init({ form: node, rules: (o && o.rules) || {}, config: o && o.config, messages: o && o.messages, context: o && o.context }); node._fvInstance = inst; };
    start(options);
    return {
        update(o) { if (inst) inst.destroy(); start(o); },
        destroy() { if (inst) inst.destroy(); inst = null; }
    };
}

/** An action plus stores for one form. See the header for the usage. */
export function createFormValidator(options) {
    const errorsW = writable([]), validW = writable(null), submittingW = writable(false);
    let inst = null, node = null;
    const sync = () => { if (!inst) return; const list = inst.getErrors(); errorsW.set(list.map(e => ({ name: e.name, message: e.message, code: e.code, field: e.field }))); };
    const form = (el, opts) => {
        node = el;
        const o = opts || options || {};
        const make = cfg => {
            const config = Object.assign({}, cfg.config);
            // the stores follow the engine: errors shown or removed (live fixing included) and the result of every check
            const onError = config.onError, onSuccess = config.onSuccess;
            config.onError = list => { validW.set(false); sync(); if (typeof onError === 'function') onError(list); };
            config.onSuccess = () => { validW.set(true); sync(); if (typeof onSuccess === 'function') onSuccess(); };
            inst = FormValidator.init({ form: el, rules: cfg.rules || {}, config, messages: cfg.messages, context: cfg.context });
            const refresh = () => setTimeout(sync, 0);
            ['input', 'change', 'focusout'].forEach(t => el.addEventListener(t, refresh));
            inst._listeners.push(() => ['input', 'change', 'focusout'].forEach(t => el.removeEventListener(t, refresh)));
            sync();
        };
        make(o);
        return {
            update(next) { if (inst) inst.destroy(); make(next || options || {}); },
            destroy() { if (inst) inst.destroy(); inst = null; node = null; errorsW.set([]); }
        };
    };
    return {
        form,
        errors: readable(errorsW),
        valid: readable(validW),
        submitting: readable(submittingW),
        async validate(opts) { if (!inst) return false; const ok = await inst.validate(opts); validW.set(ok); sync(); return ok; },
        /** onsubmit handler: validates, calls fn(values, event) only when valid; fn may return { errors } from your server. */
        handleSubmit(fn) {
            return async event => {
                if (!inst) { if (event && event.preventDefault) event.preventDefault(); return { valid: false, values: {}, errors: [] }; }
                submittingW.set(true);
                try {
                    const r = await inst.handleSubmit(fn)(event);
                    validW.set(r.valid); sync();
                    return r;
                } finally { submittingW.set(false); }
            };
        },
        getValues: () => (inst ? inst.getValues() : {}),
        setServerErrors(body, o) { if (!inst) return null; const r = inst.setServerErrors(body, o); sync(); return r; },
        /** Precognition: asks your real endpoint whether the current values pass and shows its field errors. */
        async validateOnServer(url, o) { if (!inst) return { valid: null, status: 0, errors: {}, all: {}, form: [], only: null }; const r = await inst.validateOnServer(url, o); sync(); return r; },
        reset() { if (inst) { inst.resetForm(); validW.set(null); sync(); } },
        instance: () => inst,
        get element() { return node; }
    };
}

export default { fvForm, createFormValidator };
