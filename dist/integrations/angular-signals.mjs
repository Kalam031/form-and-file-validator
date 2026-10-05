/*!
 * Angular Signal Forms bindings v1.0.0 — the same rules for `form()` from '@angular/forms/signals' (Angular 21+). Needs @angular/forms >= 21 and @angular/core (optional peer dependencies).
 *
 *   import { signal } from '@angular/core';
 *   import { form, submit } from '@angular/forms/signals';
 *   import { fvSchema, fvPrecognition, fvServerErrors } from 'form-and-file-validator/angular-signals';
 *
 *   model = signal({ email: '', password: '', confirm: '' });
 *   f = form(this.model, p => {
 *     fvSchema({ email: ['required', 'email'], password: { required: true, pwcheck: { minLength: 8 } }, confirm: { equalTo: 'password' } })(p);   // cross-field: the sibling is read for you
 *     fvPrecognition(p.email, '/signup', { name: 'email' });                                                                                      // "is it taken?" asked to the real endpoint
 *   });
 *   // template:  @for (e of f.email().errors(); track e.kind) { <small>{{ e.message }}</small> }
 *   // submit:    submit(this.f, async () => { const res = await fetch('/signup', ...); if (!res.ok) return fvServerErrors(this.f, await res.json()); });
 *
 * Errors are Signal Forms errors: { kind: 'required' | 'email' | 'minlength' | ..., message, rule, code } (kind = your rule's `code`, else the rule type).
 * Same engine, messages and language packs as the browser, Node and Reactive Forms bindings (spec/form-rules.vectors.json).
 * Alternative without this file: validateStandardSchema(p, FormValidator.schema({ ... })) from '@angular/forms/signals' also works, because schema() is a Standard Schema.
 *
 * Changelog
 *   1.0.0  First release: fvValidate, fvSchema, fvPrecognition, fvServerErrors.
 */
import { validate, validateAsync } from '@angular/forms/signals';
import { resource } from '@angular/core';
import { FormValidator } from 'form-and-file-validator';
import { fvText, fvTargets } from './angular.mjs';

const warned = new Set();
const warnOnce = (key, text) => { if (!warned.has(key)) { warned.add(key); if (typeof console !== 'undefined' && console.warn) console.warn(text); } };

/** 'address.zip' / 'items[0].qty' -> path tokens */
const tokens = name => String(name).split(/[.\[\]]/).filter(s => s !== '').map(s => (/^[0-9]+$/.test(s) ? +s : s));
const SAFE = k => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';

/** Walks a schema path or a field tree by 'a.b[0].c'. FieldTrees are called to read state, so this only indexes. Returns undefined when a step does not exist. */
function walk(root, name) {
    let node = root;
    for (const t of tokens(name)) {
        if (node === null || node === undefined || !SAFE(t)) return undefined;
        node = node[t];
    }
    return node;
}

/**
 * A validator function for `validate(path.email, fvValidate([...]))`. `rules` is anything the browser engine accepts.
 * options: trim, messages, passwordStrength, context, values (fixed other-field values, or a function (ctx) => values for equalTo / notEqualTo).
 * Returns { kind, message, rule, code } for the first failed rule, or undefined.
 */
export function fvValidate(rules, options) {
    const o = options || {};
    return function fvValidateFn(ctx) {
        const values = typeof o.values === 'function' ? o.values(ctx) : o.values;
        const norm = {};
        Object.keys(values || {}).forEach(k => { norm[k] = fvText(values[k]); });
        let r;
        try { r = FormValidator.checkValue(fvText(ctx.value()), rules, { trim: o.trim, messages: o.messages, values: norm, passwordStrength: o.passwordStrength, context: o.context }); }
        catch (e) {
            if (/options.values/.test(String(e && e.message))) return undefined;   // equalTo without the other value: no opinion
            throw e;
        }
        if (r.valid) return undefined;
        return { kind: r.code || r.rule, message: r.message, rule: r.rule, code: r.code || r.rule };
    };
}

/**
 * A schema function for `form(model, fvSchema({ field: rules }))`, or call it inside your own schema: `fvSchema({...})(p)`.
 * Field names may be paths ('address.zip'). A rule that looks at another field (equalTo, notEqualTo) reads it from the model.
 * A name that the model does not have is checked as a blank value.
 */
export function fvSchema(schemaRules, options) {
    const o = options || {};
    return function fvSchemaFn(path) {
        Object.keys(schemaRules || {}).forEach(name => {
            const field = walk(path, name);
            if (!field) { warnOnce('field:' + name, 'FormValidator (Signal Forms): the model has no field "' + name + '"; its rules are ignored.'); return; }
            const targets = fvTargets(schemaRules[name]);
            validate(field, fvValidate(schemaRules[name], Object.assign({}, o, {
                values: ctx => {
                    const vals = {};
                    targets.forEach(t => { const tp = walk(path, t); if (tp) vals[t] = ctx.valueOf(tp); });
                    return Object.assign(vals, typeof o.values === 'function' ? o.values(ctx) : o.values);
                }
            })));
        });
    };
}

/**
 * Asks your real endpoint (Precognition protocol, see FormValidator.precognition) whether the value would pass, as Signal Forms async validation.
 * It only runs after the synchronous rules pass and the field holds a value, waits `debounce` ms (300), and cancels stale requests.
 *   fvPrecognition(p.email, '/signup', { name: 'email', values: ctx => ({ email: ctx.value(), team: ctx.valueOf(p.team) }) })
 * options: name (the field name sent as `Precognition-Validate-Only`, required), values (function (ctx) => the values to send; default { [name]: value }),
 * debounce, method, headers, credentials, encoding, timeout, fetch. A check that could not be made (offline, 5xx) reports nothing.
 */
export function fvPrecognition(path, url, options) {
    const o = options || {};
    if (!o.name) throw new Error('fvPrecognition: options.name (the field name) is required');
    validateAsync(path, {
        params: ctx => {
            const v = ctx.value();
            if (v === '' || v === null || v === undefined) return undefined;
            return { values: typeof o.values === 'function' ? o.values(ctx) : { [o.name]: v } };
        },
        debounce: typeof o.debounce === 'number' || typeof o.debounce === 'function' ? o.debounce : 300,
        factory: params => resource({
            params: () => params(),
            loader: ({ params: p, abortSignal }) => FormValidator.precognition(url, p.values, { only: [o.name], method: o.method, headers: o.headers, credentials: o.credentials, encoding: o.encoding, timeout: o.timeout, fetch: o.fetch, signal: abortSignal })
        }),
        onSuccess: (result, ctx) => {
            if (!result || result.valid !== false) return [];
            const canon = String(o.name).replace(/\.(\d+)(?=\.|$)/g, '[$1]');
            const msg = result.errors[canon] || result.errors[o.name] || result.form[0];
            return msg ? [{ kind: 'server', message: msg, rule: 'server', code: 'server' }] : [];
        },
        onError: () => []
    });
}

/**
 * Server messages as Signal Forms errors, for `submit()`:
 *   await submit(this.f, async () => { const res = await fetch(...); if (!res.ok) return fvServerErrors(this.f, await res.json()); });
 * `body` is anything FormValidator.serverErrors reads (problem+json, Laravel, Django REST, ASP.NET, FastAPI, Zod ...). Each message lands on its field
 * (`items[0].qty` finds `form.items[0].qty`); messages that belong to no field, and fields the form does not have, land on the form itself.
 * Returns an array of { kind: 'server', message, fieldTree, rule, code }.
 */
export function fvServerErrors(fieldTree, body, options) {
    const r = FormValidator.serverErrors(body, options);
    const out = [];
    Object.keys(r.all).forEach(key => {
        const target = walk(fieldTree, key);
        r.all[key].forEach(message => out.push({ kind: 'server', message, fieldTree: typeof target === 'function' ? target : fieldTree, rule: 'server', code: 'server' }));
    });
    r.form.forEach(message => out.push({ kind: 'server', message, fieldTree, rule: 'server', code: 'server' }));
    return out;
}

export default { fvValidate, fvSchema, fvPrecognition, fvServerErrors };
