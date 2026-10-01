/*!
 * Angular bindings v1.0.0 — validators for Reactive Forms (and Signal Forms' validator functions). Needs @angular/forms >= 14 (optional peer dependency).
 * Plain functions, no decorators and no compile step, so they work with any Angular version, standalone or NgModule, and in unit tests.
 * They run the same rules as the browser engine, the Node server and the .NET package (spec/form-rules.vectors.json).
 *
 *   import { fvValidator, fvControls, fvGroupValidator, fvWatch, fvMessage } from 'form-and-file-validator/angular';
 *
 *   form = new FormGroup({
 *     email: new FormControl('', fvValidator(['required', 'email'])),
 *     born:  new FormControl('', fvValidator(['required', { type: 'date', format: 'd/M/y' }])),
 *     pw:    new FormControl('', fvValidator([{ type: 'required' }, { type: 'pwcheck', minLength: 8, requireUppercase: true }])),
 *     pw2:   new FormControl('', fvValidator({ equalTo: 'pw' }))          // looks at the control named "pw" in the same group
 *   });
 *   // or in one go:  this.fb.group(fvControls({ email: ['required', 'email'], pw: {...} }, { email: 'a@b.co' }))
 *   // keep the confirm field in step with the password:  const stop = fvWatch(form, schema);  (call stop() in ngOnDestroy)
 *
 *   <small *ngIf="form.get('email')?.errors">{{ fvMessage(form.get('email')) }}</small>        // "Please enter a valid email address."
 *
 * A failed control has  errors = { <rule>: { message }, fv: { rule, message } }  so both  hasError('email')  and  errors.fv.message  work.
 * Values: null / undefined = blank, numbers and booleans are turned into text, a Date becomes yyyy-MM-dd (its local calendar date).
 *
 * Changelog
 *   1.0.0  First release.
 */
import { FormValidator } from 'form-and-file-validator';

const pad = (n, w) => String(n).padStart(w, '0');

/** Any form value -> the text the rules look at. */
export function fvText(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return isNaN(value.getTime()) ? '' : pad(value.getFullYear(), 4) + '-' + pad(value.getMonth() + 1, 2) + '-' + pad(value.getDate(), 2);
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    return String(value);
}

function siblings(control) {
    const parent = control && control.parent;
    if (!parent) return undefined;
    const raw = typeof parent.getRawValue === 'function' ? parent.getRawValue() : parent.value;
    if (!raw || typeof raw !== 'object') return undefined;
    const out = {};
    Object.keys(raw).forEach(k => { out[k] = fvText(raw[k]); });
    return out;
}

/**
 * A ValidatorFn for one control. `rules` is anything the browser engine accepts: a name, a rule object, a list, or the map shorthand.
 * options: trim, messages ({ rule: text }), values (fixed "other fields" for equalTo; by default the sibling controls of the group).
 */
export function fvValidator(rules, options) {
    const o = options || {};
    return function fvValidatorFn(control) {
        const values = Object.assign({}, siblings(control), o.values);
        let r;
        try { r = FormValidator.checkValue(fvText(control.value), rules, { trim: o.trim, messages: o.messages, values, passwordStrength: o.passwordStrength, context: o.context }); }
        catch (e) {
            // Angular runs a validator when the control is created, before it has a parent group: equalTo cannot see its sibling yet. No opinion until it is attached.
            if (!control.parent && /options.values/.test(String(e && e.message))) return null;
            throw e;
        }
        if (r.valid) return null;
        return { [r.rule]: { message: r.message }, fv: { rule: r.rule, message: r.message } };
    };
}

/** { field: rules } -> { field: [startValue, validator] }, to hand straight to `fb.group(...)` (FormBuilder). The second argument gives start values. */
export function fvControls(schema, initial, options) {
    const init = initial || {};
    const out = {};
    Object.keys(schema).forEach(name => { out[name] = [init[name] === undefined ? '' : init[name], fvValidator(schema[name], options)]; });
    return out;
}

function targetsOf(rules) {
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
}

/**
 * Angular re-checks a control only when its own value changes, so a confirm-password field would stay green after the password changed.
 * fvWatch(group, schema) links them: when a field that equalTo / notEqualTo looks at changes, the dependent control is checked again.
 * Returns a function that stops watching (call it in ngOnDestroy).
 */
export function fvWatch(group, schema) {
    const subs = [];
    Object.keys(schema).forEach(name => {
        const dependent = group.get(name);
        targetsOf(schema[name]).forEach(t => {
            const target = group.get(t);
            if (dependent && target && target.valueChanges) subs.push(target.valueChanges.subscribe(() => dependent.updateValueAndValidity()));
        });
    });
    return () => subs.forEach(s => s.unsubscribe());
}

/**
 * A validator for the whole group (put it on the FormGroup): checks every field of the schema at once and returns
 * { fv: { errors: { field: message }, details: { field: { rule, message } } } } or null. Handy for server-style "all errors" lists.
 */
export function fvGroupValidator(schema, options) {
    const o = options || {};
    return function fvGroupValidatorFn(group) {
        const raw = typeof group.getRawValue === 'function' ? group.getRawValue() : group.value || {};
        const data = {};
        Object.keys(raw || {}).forEach(k => { data[k] = fvText(raw[k]); });
        const r = FormValidator.checkValues(data, schema, { trim: o.trim, messages: o.messages, values: o.values, passwordStrength: o.passwordStrength, context: o.context });
        return r.valid ? null : { fv: { errors: r.errors, details: r.details } };
    };
}

/** The message of the first failed rule of a control ('' when it is valid). */
export function fvMessage(control) {
    const e = control && control.errors;
    if (!e) return '';
    if (e.fv && e.fv.message) return e.fv.message;
    const first = Object.keys(e).find(k => e[k] && e[k].message);
    return first ? e[first].message : '';
}

export default { fvValidator, fvControls, fvGroupValidator, fvMessage, fvText, fvWatch };
