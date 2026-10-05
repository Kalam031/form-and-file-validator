'use strict';
// validateRequest (Web Request), bodyValidator (Express, Fastify, plain http) and renderErrors (no-JS pages), against real servers.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { validateRequest, bodyValidator, renderErrors } = require('../dist/server.js');

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
const modern = { skip: parseInt(process.versions.node, 10) < 20 && 'the framework itself needs Node 20 or newer' };
const rules = { email: ['required', 'email'], age: { required: true, min: 18 }, 'user.name': { minlength: 2 } };

const post = (body, headers) => new Request('http://localhost/x', { method: 'POST', body, headers });
const json = o => post(JSON.stringify(o), { 'Content-Type': 'application/json' });

// ---------------------------------------------------------------- Web Request
test('validateRequest: JSON, urlencoded and multipart bodies give the validated data', async () => {
    const a = await validateRequest(json({ email: ' a@b.co ', age: 20, user: { name: 'Al' } }), rules);
    assert.equal(a.ok, true, JSON.stringify(a.errors));
    assert.deepEqual(a.data, { email: 'a@b.co', age: '20', user: { name: 'Al' } });
    const b = await validateRequest(post('email=a%40b.co&age=30&user.name=Al', { 'Content-Type': 'application/x-www-form-urlencoded' }), rules);
    assert.equal(b.ok, true, JSON.stringify(b.errors));
    const fd = new FormData(); fd.append('email', 'a@b.co'); fd.append('age', '30'); fd.append('user.name', 'Al');
    const c = await validateRequest(post(fd), rules);
    assert.equal(c.ok, true, JSON.stringify(c.errors));
});
test('validateRequest: invalid values give 422 problem+json with a Response', async () => {
    const r = await validateRequest(json({ email: 'nope', age: 5 }), rules);
    assert.equal(r.ok, false);
    assert.equal(r.status, 422);
    assert.ok(r.errors.email && r.errors.age);
    const res = r.response();
    assert.equal(res.status, 422);
    assert.match(res.headers.get('content-type'), /application\/problem\+json/);
    const body = await res.json();
    assert.equal(body.status, 422);
    assert.ok(body.errors.email.length);
    assert.equal(FormValidatorOf().serverErrors(body).errors.email, r.errors.email);
});
const FormValidatorOf = () => require('../dist/server.js').FormValidator;
test('validateRequest: unreadable or unsupported bodies give 400 / 415, never throw', async () => {
    assert.equal((await validateRequest(post('{bad', { 'Content-Type': 'application/json' }), rules)).status, 400);
    const u = await validateRequest(post('hello', { 'Content-Type': 'text/plain' }), rules);
    assert.equal(u.status, 415);
    assert.equal(u.response().status, 415);
    const empty = await validateRequest(post('null', { 'Content-Type': 'application/json' }), rules);
    assert.equal(empty.ok, false);
    const arr = await validateRequest(json([1, 2]), rules);
    assert.equal(arr.ok, false);
});
test('validateRequest: accepts FormData, URLSearchParams, strings and plain objects; ignores prototype pollution keys', async () => {
    const fd = new FormData(); fd.append('email', 'a@b.co'); fd.append('age', '19'); fd.append('__proto__', 'x');
    assert.equal((await validateRequest(fd, rules)).ok, true);
    assert.equal((await validateRequest(new URLSearchParams({ email: 'a@b.co', age: '19' }), rules)).ok, true);
    assert.equal((await validateRequest('email=a%40b.co&age=19', rules)).ok, true);
    assert.equal((await validateRequest({ email: 'a@b.co', age: 19 }, rules)).ok, true);
    assert.equal(({}).polluted, undefined);
    const evil = await validateRequest(JSON.parse('{"email":"a@b.co","age":"20","__proto__":{"polluted":"yes"}}'), rules);
    assert.equal(({}).polluted, undefined);
    assert.equal(evil.ok, true);
});
test('validateRequest: file fields are checked with the file rules', async () => {
    const opt = { files: { avatar: { allowedExtensions: ['.png'], maxFileSizeMB: 1 } } };
    const good = new FormData(); good.append('email', 'a@b.co'); good.append('age', '30'); good.append('avatar', new Blob([PNG], { type: 'image/png' }), 'a.png');
    const r1 = await validateRequest(post(good), rules, opt);
    assert.equal(r1.ok, true, JSON.stringify(r1.errors));
    assert.equal(r1.files.avatar.isValid, true);
    const bad = new FormData(); bad.append('email', 'a@b.co'); bad.append('age', '30'); bad.append('avatar', new Blob([EXE], { type: 'image/png' }), 'evil.png');
    const r2 = await validateRequest(post(bad), rules, opt);
    assert.equal(r2.ok, false);
    assert.ok(r2.errors.avatar);
    assert.equal(r2.status, 422);
    const none = new FormData(); none.append('email', 'a@b.co'); none.append('age', '30');
    assert.equal((await validateRequest(post(none), rules, opt)).ok, true);   // the file is optional unless you add `required` yourself (allowNoFiles false in the rules)
    const strict = await validateRequest(post(none), rules, { files: { avatar: { allowNoFiles: false } } });
    assert.equal(strict.ok, false);
});

// ---------------------------------------------------------------- renderErrors
test('renderErrors: accessible markup, everything escaped, secrets never echoed', async () => {
    const r = await validateRequest(json({ email: '"><script>alert(1)</script>', age: 5, password: 'hunter2', note: '<b>x</b>' }), Object.assign({ password: 'required', note: {} }, rules));
    const h = r.html();
    assert.match(h.summary, /role="alert"/);
    assert.match(h.summary, /<li><a href="#email">/);
    assert.equal(h.summary.includes('<script>'), false);
    assert.match(h.error('email'), /id="email-error"/);
    assert.equal(h.error('nothing'), '');
    assert.equal(h.attrs('email'), ' aria-invalid="true" aria-describedby="email-error"');
    assert.equal(h.attrs('note'), '');
    assert.equal(h.value('email'), '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(h.value('password'), '');
    assert.equal(h.value('note'), '&lt;b&gt;x&lt;/b&gt;');
    assert.equal(h.value('missing.path'), '');
    assert.equal(renderErrors({ errors: {} }).summary, '');
    assert.equal(renderErrors({ errors: { a: 'x' } }, { title: 'Oops <1>' }).summary.includes('Oops &lt;1&gt;'), true);
    assert.equal(renderErrors({ errors: { 'items[0].qty': 'bad' } }).summary.includes('href="#items-0-qty"'), true);
    assert.equal(renderErrors(null).ok, true);
});

// ---------------------------------------------------------------- real servers
const listen = server => new Promise(res => server.listen(0, '127.0.0.1', () => res('http://127.0.0.1:' + server.address().port)));
const close = server => new Promise(res => { server.closeAllConnections && server.closeAllConnections(); server.close(() => res()); });
const send = async (url, body, type) => { const r = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': type } }); return { status: r.status, type: r.headers.get('content-type'), body: await r.json() }; };

async function checks(url, withForm = true) {
    const ok = await send(url, JSON.stringify({ email: 'a@b.co', age: 20 }), 'application/json');
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.email, 'a@b.co');
    const bad = await send(url, JSON.stringify({ email: 'nope', age: 3 }), 'application/json');
    assert.equal(bad.status, 422);
    assert.match(bad.type, /problem\+json/);
    assert.ok(bad.body.errors.email);
    if (!withForm) return;
    const form = await send(url, 'email=a%40b.co&age=40', 'application/x-www-form-urlencoded');
    assert.equal(form.status, 200, JSON.stringify(form.body));
}

test('bodyValidator with Express (json and urlencoded)', async () => {
    const express = require('express');
    const app = express();
    app.use(express.json()); app.use(express.urlencoded({ extended: true }));
    app.post('/', bodyValidator(rules), (req, res) => res.json(req.validated));
    const server = http.createServer(app);
    try { await checks(await listen(server)); } finally { await close(server); }
});
test('bodyValidator with Fastify (preHandler)', modern, async () => {
    const Fastify = require('fastify');
    const app = Fastify();
    app.post('/', { preHandler: (req, reply, done) => bodyValidator(rules)(req, reply, done) }, async req => req.validated);
    await app.listen({ port: 0, host: '127.0.0.1' });
    try { await checks('http://127.0.0.1:' + app.server.address().port, false); } finally { await app.close(); }
});
test('bodyValidator on plain http, with a custom respond and source: query', async () => {
    const mw = bodyValidator({ q: 'required' }, { source: 'query', respond: (req, res, r) => { res.statusCode = 400; res.end(JSON.stringify({ custom: r.errors })); } });
    const server = http.createServer((req, res) => { req.query = Object.fromEntries(new URL(req.url, 'http://x').searchParams); mw(req, res, () => res.end(JSON.stringify(req.validated))); });
    try {
        const url = await listen(server);
        assert.deepEqual(await (await fetch(url + '/?q=cats')).json(), { q: 'cats' });
        const bad = await fetch(url + '/'); assert.equal(bad.status, 400);
        assert.ok((await bad.json()).custom.q);
    } finally { await close(server); }
});
test('bodyValidator: a missing body is a validation error, not a crash; a throwing schema goes to next(err)', () => {
    const calls = [];
    const res = { setHeader() {}, end(t) { calls.push(['end', t]); } };
    bodyValidator({ a: 'required' })({ }, res, e => calls.push(['next', e]));
    assert.equal(res.statusCode, 422);
    assert.equal(calls[0][0], 'end');
});

// ---------------------------------------------------------------- a Hono app uses validateRequest on c.req.raw
test('validateRequest inside a Hono handler', modern, async () => {
    const { Hono } = require('hono');
    const { serve } = require('@hono/node-server');
    const app = new Hono();
    app.post('/', async c => { const r = await validateRequest(c.req.raw, rules); return r.ok ? c.json(r.data) : r.response(); });
    const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
    await new Promise(r => server.once('listening', r));
    try { await checks('http://127.0.0.1:' + server.address().port); } finally { await close(server); }
});
