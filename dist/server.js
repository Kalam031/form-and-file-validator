/*!
 * FileValidator server companion v1.1.0 — runs the SAME file rules on the server (Node >= 18), so a browser check is never the only check.
 *
 *   const { middleware, validate } = require('form-and-file-validator/server');
 *   const upload = multer({ storage: multer.memoryStorage() });
 *   const rules = { allowedExtensions: ['.jpg', '.png', '.pdf'], maxFileSizeMB: 5, maxFiles: 3 };   // share this object with the browser code
 *
 *   app.post('/upload', upload.array('files'), middleware(rules), (req, res) => res.json({ ok: true }));   // 422 + JSON when a file fails
 *
 *   const result = await validate(req.files, rules);        // or call it yourself: same result object as FileValidator.validateFiles
 *
 * Accepts multer (memory or disk), formidable, express-fileupload, Fastify multipart parts, busboy-style { filename, buffer }, Buffers, file paths and Web File/Blob objects.
 * Content signatures, dangerous types, ZIP/Office/PDF inspection, duplicate detection and the scan hook all run here; image pixel sizes need a DOM and are skipped.
 *
 * Changelog
 *   1.1.0  Plain forms too: validateRequest(request, rules) for Fetch-API frameworks (Next, Remix, SvelteKit, Nuxt, Astro, Hono, Workers, Bun, Deno), bodyValidator(rules) for Express / Fastify / Connect,
 *          renderErrors(result) for no-JS pages (accessible summary, per-field messages, escaped values to put back into the inputs).
 *   1.0.1  Accepts Fastify @fastify/multipart parts (read through toBuffer()); a too deeply nested or circular input gives a clear error instead of a stack overflow.
 *   1.0.0  First release. `locales` translates the server's messages (same packs as the browser).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const nodeBuffer = require('buffer');
const FileValidator = require('./fileValidator.js');
const FormValidator = require('./formValidator.js');
const locales = require('./locale.js');       // language packs for THIS FileValidator instance: locales.use('de') (packs: require('form-and-file-validator/locales/de.js'))

const FileCtor = globalThis.File || nodeBuffer.File;
const isBuf = v => Buffer.isBuffer(v) || v instanceof Uint8Array;

/** Any upload object -> a Web File (with its path remembered in file.__path so it can be removed again). */
async function toFile(item) {
    if (!item) throw new TypeError('FileValidator server: empty file entry');
    if (typeof item.arrayBuffer === 'function' && typeof item.slice === 'function') return item;      // already a File / Blob
    if (!FileCtor) throw new Error('FileValidator server: this Node version has no File class (use Node 18.13 or newer)');
    if (typeof item === 'string') item = { path: item };
    const name = item.originalname || item.originalFilename || item.filename || item.name || (item.path || item.filepath ? path.basename(item.path || item.filepath) : 'file');
    const type = item.mimetype || item.mimeType || item.type || '';
    let data = item.buffer || item.data || item._buf;
    if (!data && typeof item.toBuffer === 'function') data = await item.toBuffer();   // Fastify @fastify/multipart parts
    const onDisk = item.path || item.filepath || item.tempFilePath;
    if (!data && onDisk) data = await fs.promises.readFile(onDisk);
    if (!data && isBuf(item)) data = item;
    if (!data) throw new TypeError('FileValidator server: cannot read "' + name + '" (expected buffer, data, path or filepath)');
    const file = new FileCtor([data], String(name), { type: String(type) });
    if (onDisk) Object.defineProperty(file, '__path', { value: onDisk });
    if (item.webkitRelativePath || item.relativePath) Object.defineProperty(file, 'webkitRelativePath', { value: item.webkitRelativePath || item.relativePath });
    return file;
}

/** req.file, req.files (array, or { field: [..] } for fields()/express-fileupload), or your own array/object -> flat array of entries. */
function flatten(input, depth = 0) {
    if (input == null) return [];
    if (depth > 5) throw new TypeError('FileValidator server: could not find uploaded files in this object (too deeply nested or circular); pass the files themselves, e.g. req.files');
    if (Array.isArray(input)) return input.reduce((all, x) => all.concat(flatten(x, depth + 1)), []);
    const looksLikeFile = ['buffer', 'data', 'path', 'filepath', 'tempFilePath', 'originalname', 'originalFilename', 'arrayBuffer', 'toBuffer'].some(k => k in Object(input)) || isBuf(input) || typeof input === 'string';
    if (looksLikeFile) return [input];
    return Object.keys(input).reduce((all, k) => all.concat(flatten(input[k], depth + 1)), []);
}

/** Same as FileValidator.validateFiles, for uploads received by a Node server. Resolves to { isValid, errors, details, files }. */
async function validate(input, config) {
    const files = await Promise.all(flatten(input).map(toFile));
    return FileValidator.validateFiles(files, Object.assign({ readImageSize: false, imageDecode: false }, config));
}

const removeUploads = async (input) => {
    await Promise.all(flatten(input).map(async it => {
        const p = it && (it.path || it.filepath || it.tempFilePath);
        if (typeof p === 'string') { try { await fs.promises.unlink(p); } catch (e) { /* already gone */ } }
    }));
};

/**
 * Express / Connect / Fastify-style middleware (place it after multer, formidable or express-fileupload).
 *   middleware(config, { status: 422, field: undefined, allowNoFiles: false, removeFailed: true, respond: (req, res, result) => ... })
 * config can also be a function (req) => config, for rules that depend on the user. On success `req.fileValidation` holds the result.
 */
function middleware(config, options) {
    const opt = Object.assign({ status: 422, removeFailed: true }, options);
    return function fileValidationMiddleware(req, res, next) {
        const uploaded = opt.field ? (req.files && !Array.isArray(req.files) ? req.files[opt.field] : req.files) : (req.files !== undefined ? req.files : req.file);
        const cfg = typeof config === 'function' ? config(req) : config;
        validate(uploaded, Object.assign({ allowNoFiles: !!opt.allowNoFiles }, cfg)).then(result => {
            req.fileValidation = result;
            if (result.isValid) return next();
            const done = () => {
                if (typeof opt.respond === 'function') return opt.respond(req, res, result);
                const body = { ok: false, errors: result.errors, files: result.files.map(f => ({ name: f.name, isValid: f.isValid, errors: f.errors, details: f.details.map(d => ({ code: d.code, message: d.message })) })) };
                if (typeof res.status === 'function') return res.status(opt.status).json(body);
                res.statusCode = opt.status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body));
            };
            (opt.removeFailed ? removeUploads(uploaded) : Promise.resolve()).then(done, done);
        }, err => next(err));
    };
}

// ------------------------------------------------------------------ plain form values: one rules object for the browser and the server

const isFileLike = v => v && typeof v === 'object' && typeof v.arrayBuffer === 'function' && typeof v.name === 'string' && typeof v.size === 'number';
const hasHeaders = r => r && r.headers && typeof r.headers.get === 'function';
const isRequest = r => hasHeaders(r) && typeof r.method === 'string' && (typeof r.formData === 'function' || typeof r.json === 'function');
const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

/** A Web Request, FormData, URLSearchParams, a JSON/urlencoded string or a parsed body object -> { values (nested, no files), files: { field: [File] }, kind } or { error } */
async function readBody(input) {
    let body = input, kind = 'object';
    if (isRequest(input)) {
        const type = String(input.headers.get('content-type') || '').toLowerCase();
        try {
            if (type.includes('json')) { body = await input.json(); kind = 'json'; }
            else if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) { body = await input.formData(); kind = 'form'; }
            else return { error: { status: 415, title: 'Unsupported media type: send JSON, multipart/form-data or application/x-www-form-urlencoded.' } };
        } catch (e) { return { error: { status: 400, title: 'The request body could not be read.' } }; }
    } else if (typeof FormData === 'function' && input instanceof FormData) kind = 'form';
    else if (typeof URLSearchParams === 'function' && input instanceof URLSearchParams) kind = 'form';
    else if (typeof input === 'string') {
        try { body = JSON.parse(input); kind = 'json'; } catch (e) { body = new URLSearchParams(input); kind = 'form'; }
    }
    const files = {};
    if (kind === 'form' && body && typeof body.entries === 'function') {
        const plain = [];
        for (const [k, v] of body.entries()) {
            if (isFileLike(v)) { if (v.size > 0 || v.name) (files[k] = files[k] || []).push(v); } else plain.push([k, v]);
        }
        return { values: FormValidator.parseFormData(plain, { coerce: false }), files, kind };
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return { values: body, files, kind };
    return { values: body, files, kind };
}

const escapeHtml = v => String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const SECRET_FIELD = /pass(word)?|pwd|secret|token|card|cvv|cvc|otp|pin$/i;
const idFor = (name, prefix) => (prefix || '') + String(name).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Error markup for pages that work without JavaScript. Everything is escaped.
 *   const r = renderErrors(result);       // result of validateRequest, or { errors: { email: 'Enter an email' } }
 *   r.summary                              // <div role="alert" tabindex="-1">...a list of links to the fields...</div>  (put it at the top of the form)
 *   r.error('email')                       // <p id="email-error" class="error">...</p>  (put it under the input)
 *   r.attrs('email')                       //  aria-invalid="true" aria-describedby="email-error"   (for the input tag)
 *   r.value('email')                       // the text the visitor typed, escaped, for value="..." (empty for password-like fields, see options.omit)
 * Options: { title, idPrefix, errorClass, summaryClass, omit: [names] or RegExp }
 */
function renderErrors(result, options) {
    const o = options || {};
    const errors = (result && result.errors && typeof result.errors === 'object' && !Array.isArray(result.errors) ? result.errors : result) || {};
    const keys = Object.keys(errors).filter(k => UNSAFE_KEYS.indexOf(k) < 0 && typeof errors[k] === 'string');
    const values = (result && result.values) || {};
    const errorClass = escapeHtml(o.errorClass || 'error'), summaryClass = escapeHtml(o.summaryClass || 'fv-error-summary');
    const omit = n => (o.omit instanceof RegExp ? o.omit.test(n) : Array.isArray(o.omit) ? o.omit.includes(n) : false) || SECRET_FIELD.test(String(n).split(/[.[\]]/).filter(Boolean).pop() || '');
    const errId = n => idFor(n, o.idPrefix) + '-error';
    return {
        ok: !keys.length,
        keys,
        summary: keys.length
            ? '<div class="' + summaryClass + '" id="' + escapeHtml(idFor('summary', o.idPrefix)) + '" role="alert" tabindex="-1"><h2>' + escapeHtml(o.title || (keys.length === 1 ? 'There is a problem' : 'There are ' + keys.length + ' problems')) + '</h2><ul>'
              + keys.map(k => '<li><a href="#' + escapeHtml(idFor(k, o.idPrefix)) + '">' + escapeHtml(errors[k]) + '</a></li>').join('') + '</ul></div>'
            : '',
        error: n => keys.includes(n) ? '<p class="' + errorClass + '" id="' + escapeHtml(errId(n)) + '" data-error-for="' + escapeHtml(n) + '">' + escapeHtml(errors[n]) + '</p>' : '',
        attrs: n => keys.includes(n) ? ' aria-invalid="true" aria-describedby="' + escapeHtml(errId(n)) + '"' : '',
        value: n => {
            if (omit(n)) return '';
            const v = String(n).split(/[.[\]]+/).filter(Boolean).reduce((node, t) => (node === null || node === undefined || typeof node !== 'object' || UNSAFE_KEYS.indexOf(t) >= 0 ? undefined : node[t]), values);
            return v === null || v === undefined || typeof v === 'object' ? '' : escapeHtml(v);
        }
    };
}

/**
 * Validates the values of a request against the same rules the browser uses.
 *   const result = await validateRequest(request, { email: ['required', 'email'], age: { min: 18 } }, { files: { avatar: { allowedExtensions: ['.png'] } } });
 *   if (!result.ok) return result.response();            // 422 application/problem+json (400 / 415 for an unreadable body)
 *   result.data                                          // the validated values (trimmed text, nested like the field names)
 * Works with a Web Request (Next.js, Remix, SvelteKit, Nuxt/H3, Astro, Hono c.req.raw, Workers, Bun, Deno), FormData, URLSearchParams or a parsed object.
 * Options: { status: 422, files: { field: fileRules }, lang, omit, title }
 * Result: { ok, status, data, values, errors, issues, files (FileValidator results by field), problem, response(), html(options) }
 */
async function validateRequest(input, rules, options) {
    const o = options || {};
    const status = o.status || 422;
    const schema = rules && typeof rules.safeParse === 'function' ? rules : FormValidator.schema(rules || {}, o.lang ? { lang: o.lang } : undefined);
    const body = await readBody(input);
    const finish = r => {
        r.response = init => {
            const R = globalThis.Response;
            if (!R) throw new Error('validateRequest: this runtime has no Response class; send result.problem yourself');
            return new R(JSON.stringify(r.problem || { type: 'about:blank', title: 'OK', status: 200 }), Object.assign({ status: r.status, headers: { 'Content-Type': 'application/problem+json' } }, init));
        };
        r.html = opts => renderErrors(r, Object.assign({ omit: o.omit }, opts));
        return r;
    };
    if (body.error) {
        const problem = { type: 'about:blank', title: body.error.title, status: body.error.status, errors: {} };
        return finish({ ok: false, status: body.error.status, data: undefined, values: undefined, errors: {}, issues: [], files: {}, problem });
    }
    const values = body.values;
    const parsed = schema.safeParse(values);
    const errors = parsed.success ? {} : Object.assign({}, parsed.errors);
    const fileResults = {};
    const fileRules = o.files || {};
    for (const field of Object.keys(fileRules)) {
        const list = body.files[field] || (body.kind !== 'form' && values && typeof values === 'object' && values[field] ? [].concat(values[field]).filter(isFileLike) : []);
        const r = await validate(list, Object.assign({ allowNoFiles: true }, fileRules[field]));
        fileResults[field] = r;
        if (!r.isValid) errors[field] = (r.details && r.details[0] && r.details[0].message) || 'This file is not accepted.';
    }
    const ok = parsed.success && Object.keys(errors).length === 0;
    const problem = ok ? null : FormValidator.formatErrors({ errors }, 'problem', { status, title: o.title });
    return finish({ ok, status: ok ? 200 : status, data: ok ? parsed.data : undefined, values, errors, issues: parsed.success ? [] : parsed.issues, files: fileResults, problem });
}

/**
 * Express / Connect / Fastify middleware for a parsed body (use express.json() / express.urlencoded() or @fastify/formbody first).
 *   app.post('/signup', express.json(), bodyValidator({ email: ['required', 'email'] }), (req, res) => res.json(req.validated));
 * A failing request gets 422 application/problem+json. On success req.validated has the validated values and req.validation the whole result.
 * Options: { status: 422, source: 'body' | 'query', respond: (req, res, result) => ..., lang }
 */
function bodyValidator(rules, options) {
    const opt = Object.assign({ status: 422, source: 'body' }, options);
    const schema = FormValidator.schema(rules || {}, opt.lang ? { lang: opt.lang } : undefined);
    return function bodyValidationMiddleware(req, res, next) {
        const raw = req[opt.source];
        let result;
        try { result = schema.safeParse(raw === undefined || raw === null ? {} : raw); } catch (e) { return next(e); }
        if (result.success) { req.validated = result.data; req.validation = { ok: true, status: 200, data: result.data, errors: {}, issues: [] }; return next(); }
        const problem = FormValidator.formatErrors({ errors: result.errors }, 'problem', { status: opt.status });
        const full = { ok: false, status: opt.status, errors: result.errors, issues: result.issues, problem };
        req.validation = full;
        if (typeof opt.respond === 'function') return opt.respond(req, res, full);
        const text = JSON.stringify(problem);
        if (typeof res.code === 'function') return res.code(opt.status).type('application/problem+json').send(text);      // Fastify
        res.statusCode = opt.status; res.setHeader('Content-Type', 'application/problem+json'); res.end(text);              // Express, Connect, plain http
        return undefined;
    };
}

module.exports = { validate, middleware, toFile, flatten, validateRequest, bodyValidator, renderErrors, FormValidator, FileValidator, locales, version: '1.1.0' };
