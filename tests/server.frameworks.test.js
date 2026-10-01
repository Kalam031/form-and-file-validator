'use strict';
/*
 * The server companion against REAL frameworks over real HTTP multipart uploads
 * (Express + multer / express-fileupload / formidable, Fastify, Koa, Hono), not hand-made request objects.
 */
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { validate, middleware } = require('../dist/server.js');

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);   // "MZ": a Windows program
const rules = { allowedExtensions: ['.png'], maxFileSizeMB: 1 };

const upload = (url, parts) => {
    const fd = new FormData();
    for (const [name, buf, type] of parts) fd.append('files', new Blob([buf], { type }), name);
    return fetch(url, { method: 'POST', body: fd }).then(async r => ({ status: r.status, body: await r.json() }));
};
const listen = server => new Promise(res => server.listen(0, '127.0.0.1', () => res('http://127.0.0.1:' + server.address().port + '/upload')));
const close = server => new Promise(res => { server.closeAllConnections && server.closeAllConnections(); server.close(() => res()); });

/** the same three checks for every framework: a real PNG passes, a program renamed to .png is rejected, a second good file passes with it */
async function checks(url) {
    const ok = await upload(url, [['a.png', PNG, 'image/png']]);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.ok, true);
    const bad = await upload(url, [['evil.png', EXE, 'image/png']]);
    assert.equal(bad.status, 422);
    assert.equal(bad.body.ok, false);
    assert.ok(bad.body.files[0].details.some(d => d.code === 'SIGNATURE_MISMATCH'), JSON.stringify(bad.body));
    const mixed = await upload(url, [['a.png', PNG, 'image/png'], ['b.png', PNG, 'image/png']]);
    assert.equal(mixed.status, 200, JSON.stringify(mixed.body));
    const wrongExt = await upload(url, [['a.gif', PNG, 'image/gif']]);
    assert.equal(wrongExt.status, 422);
}

const answer = result => result.isValid
    ? { status: 200, body: { ok: true } }
    : { status: 422, body: { ok: false, errors: result.errors, files: result.files.map(f => ({ name: f.name, details: f.details.map(d => ({ code: d.code })) })) } };

test('Express + multer (memory storage): the middleware', async () => {
    const express = require('express'), multer = require('multer');
    const app = express();
    app.post('/upload', multer({ storage: multer.memoryStorage() }).array('files'), middleware(rules), (req, res) => res.json({ ok: true }));
    const server = http.createServer(app);
    try { await checks(await listen(server)); } finally { await close(server); }
});

test('Express + express-fileupload: the middleware', async () => {
    const express = require('express'), fileUpload = require('express-fileupload');
    const app = express();
    app.post('/upload', fileUpload(), middleware(rules), (req, res) => res.json({ ok: true }));
    const server = http.createServer(app);
    try { await checks(await listen(server)); } finally { await close(server); }
});

test('Express + formidable (v3): validate() on the parsed files', async () => {
    const express = require('express'), { formidable } = require('formidable');
    const app = express();
    app.post('/upload', async (req, res, next) => {
        try {
            const [, files] = await formidable({}).parse(req);
            const r = answer(await validate(files, rules));
            res.status(r.status).json(r.body);
        } catch (e) { next(e); }
    });
    const server = http.createServer(app);
    try { await checks(await listen(server)); } finally { await close(server); }
});

test('Fastify + @fastify/multipart: validate() accepts the parts (req.files()) directly', async () => {
    const Fastify = require('fastify');
    const app = Fastify();
    await app.register(require('@fastify/multipart'));
    app.post('/upload', async (req, reply) => {
        const parts = [];
        for await (const part of req.files()) { await part.toBuffer(); parts.push(part); }   // toBuffer() reads the stream and caches it on the part
        const r = answer(await validate(parts, rules));
        return reply.code(r.status).send(r.body);
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    try { await checks('http://127.0.0.1:' + app.server.address().port + '/upload'); } finally { await app.close(); }
});

test('Fastify + @fastify/multipart with attachFieldsToBody: validate() accepts req.body.files', async () => {
    const Fastify = require('fastify');
    const app = Fastify();
    await app.register(require('@fastify/multipart'), { attachFieldsToBody: true });
    app.post('/upload', async (req, reply) => {
        const r = answer(await validate(req.body.files, rules));
        return reply.code(r.status).send(r.body);
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    try { await checks('http://127.0.0.1:' + app.server.address().port + '/upload'); } finally { await app.close(); }
});

test('Koa + @koa/multer: validate() on ctx.files', async () => {
    const Koa = require('koa'), Router = require('@koa/router'), multer = require('@koa/multer');
    const app = new Koa(), router = new Router();
    router.post('/upload', multer({ storage: multer.memoryStorage() }).array('files'), async ctx => {
        const r = answer(await validate(ctx.files, rules));
        ctx.status = r.status; ctx.body = r.body;
    });
    app.use(router.routes());
    const server = http.createServer(app.callback());
    try { await checks(await listen(server)); } finally { await close(server); }
});

test('Hono (Web standard): validate() on the File objects from parseBody', async () => {
    const { Hono } = require('hono'), { serve } = require('@hono/node-server');
    const app = new Hono();
    app.post('/upload', async c => {
        const body = await c.req.parseBody({ all: true });
        const r = answer(await validate(body.files, rules));
        return c.json(r.body, r.status);
    });
    const server = await new Promise(res => { const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => res(s)); });
    try { await checks('http://127.0.0.1:' + server.address().port + '/upload'); } finally { await close(server); }
});

test('Web standard Request (Workers, Bun, Deno, Next.js route handlers): validate() on request.formData()', async () => {
    const req = new Request('http://x/upload', { method: 'POST', body: (() => { const fd = new FormData(); fd.append('files', new Blob([PNG], { type: 'image/png' }), 'a.png'); fd.append('files', new Blob([EXE], { type: 'image/png' }), 'evil.png'); return fd; })() });
    const form = await req.formData();
    const r = await validate(form.getAll('files'), rules);
    assert.equal(r.isValid, false);
    assert.deepEqual(r.files.map(f => f.isValid), [true, false]);
});
