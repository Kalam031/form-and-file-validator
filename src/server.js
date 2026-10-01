/*!
 * FileValidator server companion v1.0.1 — runs the SAME file rules on the server (Node >= 18), so a browser check is never the only check.
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
 *   1.0.1  Accepts Fastify @fastify/multipart parts (read through toBuffer()); a too deeply nested or circular input gives a clear error instead of a stack overflow.
 *   1.0.0  First release. `locales` translates the server's messages (same packs as the browser).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const nodeBuffer = require('buffer');
const FileValidator = require('./fileValidator.js');
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

module.exports = { validate, middleware, toFile, flatten, FileValidator, locales, version: '1.0.1' };
