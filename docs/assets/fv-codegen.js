'use strict';
/*
 * Code generation from rules: the engine behind `fv export` and the playground's export box. Pure functions, no DOM, no file access, so it runs in Node and in the browser.
 *
 *   const { exportRules, FORMATS } = require('form-and-file-validator/tools/fv-codegen');
 *   exportRules(rules, 'zod', { FormValidator, name: 'Signup' })   // -> source text
 *
 * Formats: rules (JSON), json-schema, zod, typescript, html (data-fv attributes), react, vue, angular.
 * `FormValidator` (the library) is passed in because it knows how to turn rules into a JSON Schema; everything else is generated from that schema.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.FVCodegen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const FORMATS = ['rules', 'json-schema', 'zod', 'typescript', 'html', 'react', 'vue', 'angular'];
    const q = s => JSON.stringify(String(s));
    const ident = s => /^[A-Za-z_$][\w$]*$/.test(s) ? s : q(s);
    const pascal = s => String(s || 'form').replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (m, a, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '') || 'Form';

    function schemaOf(rules, FV) {
        if (!FV || typeof FV.toJsonSchema !== 'function') throw new Error('exportRules needs options.FormValidator (the library)');
        return FV.toJsonSchema(rules || {});
    }

    // ---- JSON Schema -> zod source
    function zodExpr(n, required, indent) {
        const pad = '    '.repeat(indent);
        const pad1 = '    '.repeat(indent + 1);
        let e;
        const left = n['x-fv-rules'] ? ' /* ' + Object.keys(n['x-fv-rules']).join(', ') + ': write these with .refine() or .superRefine() */' : '';
        if (Array.isArray(n.enum)) {
            e = n.enum.every(v => typeof v === 'string') ? 'z.enum([' + n.enum.map(q).join(', ') + '])' : 'z.union([' + n.enum.map(v => 'z.literal(' + JSON.stringify(v) + ')').join(', ') + '])';
        } else if (n.type === 'object') {
            const req = n.required || [];
            const props = Object.keys(n.properties || {}).map(k => pad1 + ident(k) + ': ' + zodExpr(n.properties[k], req.indexOf(k) >= 0, indent + 1));
            e = props.length ? 'z.object({\n' + props.join(',\n') + '\n' + pad + '})' : 'z.object({})';
            return e + (required ? '' : '.optional()') + left;
        } else if (n.type === 'array') {
            e = 'z.array(' + (n.items ? zodExpr(n.items, true, indent) : 'z.string()') + ')';
            if (typeof n.minItems === 'number') e += '.min(' + n.minItems + ')';
            if (typeof n.maxItems === 'number') e += '.max(' + n.maxItems + ')';
            if (n.uniqueItems) e += '.refine(a => new Set(a).size === a.length, "Values must be unique")';
            return e + (required ? '' : '.optional()') + left;
        } else if (n.type === 'number' || n.type === 'integer') {
            e = 'z.coerce.number()' + (n.type === 'integer' ? '.int()' : '');
            if (typeof n.minimum === 'number') e += '.min(' + n.minimum + ')';
            if (typeof n.maximum === 'number') e += '.max(' + n.maximum + ')';
            if (typeof n.multipleOf === 'number') e += '.multipleOf(' + n.multipleOf + ')';
            return e + (required ? '' : '.optional()') + left;
        } else {
            const fmt = { email: 'z.email()', uri: 'z.url()', uuid: 'z.uuid()', ipv4: 'z.ipv4()', ipv6: 'z.ipv6()' }[n.format];
            e = fmt || 'z.string()';
            if (typeof n.minLength === 'number') e += '.min(' + n.minLength + ')';
            if (typeof n.maxLength === 'number') e += '.max(' + n.maxLength + ')';
            if (typeof n.pattern === 'string') e += '.regex(new RegExp(' + q(n.pattern) + (/\\p\{/.test(n.pattern) ? ', "u"' : '') + '))';
            if (n.format && !fmt) e += ' /* format: ' + n.format + ' */';
            const constrained = e !== 'z.string()';
            return e + (required ? '' : (constrained ? '.or(z.literal("")).optional()' : '.optional()')) + left;
        }
        return e + (required ? '' : '.optional()') + left;
    }
    function toZod(rules, o) {
        const s = schemaOf(rules, o.FormValidator), name = pascal(o.name) + 'Schema';
        return 'import { z } from "zod";\n\nexport const ' + name + ' = ' + zodExpr(Object.assign({}, s, { type: 'object' }), true, 0) + ';\n\nexport type ' + pascal(o.name) + ' = z.infer<typeof ' + name + '>;\n';
    }

    // ---- JSON Schema -> TypeScript
    function tsType(n, indent) {
        const pad = '    '.repeat(indent), pad1 = '    '.repeat(indent + 1);
        if (Array.isArray(n.enum)) return n.enum.map(v => JSON.stringify(v)).join(' | ');
        if (n.type === 'object') {
            const req = n.required || [];
            const props = Object.keys(n.properties || {}).map(k => pad1 + ident(k) + (req.indexOf(k) >= 0 ? '' : '?') + ': ' + tsType(n.properties[k], indent + 1) + ';');
            return props.length ? '{\n' + props.join('\n') + '\n' + pad + '}' : 'Record<string, never>';
        }
        if (n.type === 'array') { const t = n.items ? tsType(n.items, indent) : 'string'; return (/[|{]/.test(t) ? '(' + t + ')' : t) + '[]'; }
        if (n.type === 'number' || n.type === 'integer') return 'number';
        return 'string';
    }
    function toTs(rules, o) {
        const s = schemaOf(rules, o.FormValidator);
        return 'export interface ' + pascal(o.name) + ' ' + tsType(Object.assign({}, s, { type: 'object' }), 0) + '\n';
    }

    // ---- data-fv attributes
    function dataFv(list) {
        return list.map(r => {
            if (typeof r === 'string') return r;
            const keys = Object.keys(r).filter(k => k !== 'type');
            if (!keys.length) return r.type;
            if (keys.length === 1 && ['min', 'max', 'param', 'step'].indexOf(keys[0]) >= 0 && typeof r[keys[0]] !== 'object') return r.type + ':' + r[keys[0]];
            if (keys.length === 2 && keys.indexOf('min') >= 0 && keys.indexOf('max') >= 0) return r.type + ':' + r.min + ',' + r.max;
            return null;
        });
    }
    function toHtml(rules, o) {
        const out = ['<form id="' + (o.name ? String(o.name).replace(/[^\w-]/g, '-') : 'form') + '" novalidate data-fv-auto>'];
        Object.keys(rules || {}).filter(k => !/[\[\]]/.test(k)).forEach(name => {   // rows of a repeating group need markup of their own
            const raw = rules[name];
            let mapped;
            if (typeof raw === 'string') mapped = [raw];
            else if (Array.isArray(raw)) mapped = dataFv(raw);
            else mapped = Object.keys(raw || {}).filter(k => raw[k] !== false).map(k => {
                const v = raw[k];
                if (v === true) return k;
                if (typeof v === 'number') return k + ':' + v;
                if (Array.isArray(v) && v.every(x => typeof x === 'number' || (typeof x === 'string' && !/[\s,]/.test(x)))) return k + ':' + v.join(',');
                return null;
            });
            const ok = mapped.every(x => x);
            out.push('  <label for="' + name + '">' + name + '</label>');
            out.push('  <input id="' + name + '" name="' + name + '"' + (ok ? ' data-fv="' + mapped.join(' ') + '"' : '') + '>' + (ok ? '' : '  <!-- these rules need JavaScript: use the rules JSON -->'));
        });
        out.push('  <button type="submit">Send</button>', '</form>', '<script src="https://cdn.jsdelivr.net/npm/form-and-file-validator/dist/validator.min.js"></script>', '');
        return out.join('\n');
    }

    // ---- framework starters
    const rulesLiteral = rules => JSON.stringify(rules, null, 2).replace(/\n/g, '\n    ');
    function toReact(rules, o) {
        const fields = Object.keys(rules || {}).filter(k => !/[.\[\]]/.test(k));
        return "import { useFormValidator } from 'form-and-file-validator/react';\n\nconst rules = " + JSON.stringify(rules, null, 2) + ";\n\nexport function " + pascal(o.name) + "Form() {\n    const { ref, handleSubmit, errors } = useFormValidator({ rules });\n    return (\n        <form ref={ref} onSubmit={handleSubmit(async values => { console.log(values); })} noValidate>\n"
            + fields.map(f => '            <label>' + f + ' <input name="' + f + '" /></label>').join('\n') + "\n            <button type=\"submit\">Send</button>\n        </form>\n    );\n}\n";
    }
    function toVue(rules, o) {
        const fields = Object.keys(rules || {}).filter(k => !/[.\[\]]/.test(k));
        return "<script setup>\nimport { useFormValidator } from 'form-and-file-validator/vue';\n\nconst { formRef, handleSubmit } = useFormValidator({ rules: " + rulesLiteral(rules) + " });\nconst send = handleSubmit(async values => { console.log(values); });\n</script>\n\n<template>\n    <form ref=\"formRef\" novalidate @submit=\"send\">\n"
            + fields.map(f => '        <label>' + f + ' <input name="' + f + '" /></label>').join('\n') + "\n        <button type=\"submit\">Send</button>\n    </form>\n</template>\n";
    }
    function toAngular(rules, o) {
        const fields = Object.keys(rules || {}).filter(k => !/[.\[\]]/.test(k));
        return "import { Component } from '@angular/core';\nimport { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';\nimport { fvValidator, fvMessage } from 'form-and-file-validator/angular';\n\nconst rules = " + JSON.stringify(rules, null, 2) + " as const;\n\n@Component({\n    selector: 'app-" + String(o.name || 'form').toLowerCase().replace(/[^a-z0-9]+/g, '-') + "',\n    standalone: true,\n    imports: [ReactiveFormsModule],\n    template: `\n        <form [formGroup]=\"form\" (ngSubmit)=\"submit()\" novalidate>\n"
            + fields.map(f => '            <label>' + f + ' <input formControlName="' + f + '" /></label>\n            <small>{{ fvMessage(form.get(\'' + f + '\')) }}</small>').join('\n') + "\n            <button type=\"submit\">Send</button>\n        </form>`\n})\nexport class " + pascal(o.name) + "Component {\n    fvMessage = fvMessage;\n    form = new FormGroup({\n"
            + fields.map(f => '        ' + ident(f) + ": new FormControl('', fvValidator(rules[" + q(f) + "] as any))").join(',\n') + "\n    });\n    submit() { this.form.markAllAsTouched(); if (this.form.valid) console.log(this.form.value); }\n}\n";
    }

    /** exportRules(rules, format, { FormValidator, name }) -> text */
    function exportRules(rules, format, options) {
        const o = options || {};
        const f = String(format || 'rules').toLowerCase();
        if (f === 'rules' || f === 'json') return JSON.stringify(rules, null, 2) + '\n';
        if (f === 'json-schema' || f === 'jsonschema') return JSON.stringify(schemaOf(rules, o.FormValidator), null, 2) + '\n';
        if (f === 'zod') return toZod(rules, o);
        if (f === 'typescript' || f === 'ts') return toTs(rules, o);
        if (f === 'html') return toHtml(rules, o);
        if (f === 'react') return toReact(rules, o);
        if (f === 'vue') return toVue(rules, o);
        if (f === 'angular') return toAngular(rules, o);
        throw new Error('Unknown format "' + format + '". Use one of: ' + FORMATS.join(', '));
    }
    return { exportRules, FORMATS };
});
