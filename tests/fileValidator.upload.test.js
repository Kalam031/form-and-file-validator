'use strict';
// FileValidator.upload(): plain, presigned, retry, abort, progress, and tus (against a small server of our own and against @tus/server).
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const FV = require('../src/fileValidator.js');
require('../src/fileValidator.upload.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const bytes = n => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + 7) & 255; return b; };
const fileOf = (n, name = 'a.bin', type = 'application/octet-stream') => new File([bytes(n)], name, { type, lastModified: 1700000000000 });

// ---------------------------------------------------------------- a small server
const seen = [];
let flaky = 0, rateLimited = 0;
const tusFiles = new Map();   // our own minimal tus server: id -> { length, data[], meta }
const handler = (req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
        const body = Buffer.concat(chunks);
        const url = new URL(req.url, 'http://x');
        seen.push({ method: req.method, url: req.url, headers: req.headers, body });
        const json = (status, obj, extra) => { res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, extra)); res.end(JSON.stringify(obj)); };
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); return res.end(); }
        if (url.pathname === '/upload') return json(200, { size: body.length, type: req.headers['content-type'], hasName: body.includes(Buffer.from('filename="a.bin"')), hasField: body.includes(Buffer.from('name="file"')) });
        if (url.pathname.startsWith('/put/')) return json(200, { size: body.length, type: req.headers['content-type'], auth: req.headers['x-amz-acl'] || null });
        if (url.pathname === '/policy') {
            const text = body.toString('latin1');
            const order = ['key', 'policy', 'file'].map(k => text.indexOf('name="' + k + '"'));
            return json(201, { order, sorted: order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])) });
        }
        if (url.pathname === '/flaky') { if (flaky-- > 0) return json(503, { error: 'busy' }); return json(200, { ok: true, size: body.length }); }
        if (url.pathname === '/limited') { if (rateLimited-- > 0) return json(429, { error: 'slow down' }, { 'Retry-After': '0' }); return json(200, { ok: true }); }
        if (url.pathname === '/bad') return json(400, { error: 'nope' });
        if (url.pathname === '/text') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('stored'); }
        if (url.pathname === '/slow') { setTimeout(() => json(200, { late: true }), 400); return undefined; }
        if (url.pathname === '/empty') { res.writeHead(204); return res.end(); }
        // ---- tus
        const h = { 'Tus-Resumable': '1.0.0', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': '*' };
        if (url.pathname === '/tus' && req.method === 'POST') {
            const id = 'u' + (tusFiles.size + 1);
            const meta = {};
            String(req.headers['upload-metadata'] || '').split(',').filter(Boolean).forEach(p => { const [k, v] = p.split(' '); meta[k] = Buffer.from(v || '', 'base64').toString('utf8'); });
            tusFiles.set(id, { length: Number(req.headers['upload-length']), data: [], size: 0, meta });
            res.writeHead(201, Object.assign({ Location: '/tus/' + id }, h)); return res.end();
        }
        const m = /^\/tus\/(\w+)$/.exec(url.pathname);
        if (m) {
            const f = tusFiles.get(m[1]);
            if (!f) { res.writeHead(404, h); return res.end(); }
            if (req.method === 'HEAD') { res.writeHead(200, Object.assign({ 'Upload-Offset': String(f.size), 'Upload-Length': String(f.length), 'Cache-Control': 'no-store' }, h)); return res.end(); }
            if (req.method === 'PATCH') {
                if (Number(req.headers['upload-offset']) !== f.size) { res.writeHead(409, h); return res.end(); }
                if (f.failNext > 0) { f.failNext--; res.writeHead(500, h); return res.end(); }
                f.data.push(body); f.size += body.length;
                res.writeHead(204, Object.assign({ 'Upload-Offset': String(f.size) }, h)); return res.end();
            }
        }
        res.writeHead(404); res.end();
    });
};
let server, base;
test('start the test server', async () => {
    server = http.createServer(handler);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = 'http://127.0.0.1:' + server.address().port;
});

// ---------------------------------------------------------------- plain uploads
test('a multipart POST: field name, extra fields, headers, JSON answer, progress reaches 100', async () => {
    const f = fileOf(5000, 'a.bin');
    const prog = [];
    const r = await FV.upload(f, { url: base + '/upload', fields: { folder: 'x' }, headers: { 'X-Token': 't' }, onProgress: p => prog.push(p) });
    assert.equal(r.status, 200);
    assert.equal(r.body.hasName, true);
    assert.equal(r.body.hasField, true);
    assert.match(r.body.type, /^multipart\/form-data; boundary=/);
    const last = seen[seen.length - 1];
    assert.equal(last.headers['x-token'], 't');
    assert.equal(last.body.includes(Buffer.from('name="folder"')), true);
    assert.deepEqual(prog[prog.length - 1], { loaded: 5000, total: 5000, percent: 100 });
    assert.ok(prog.every((p, i) => i === 0 || p.loaded >= prog[i - 1].loaded));
    assert.equal((await FV.upload(f, { url: base + '/upload', fieldName: 'photo' })).body.hasField, false, 'another field name');
});
test('responseType text, an empty 204 answer, a plain PUT of the raw file, and the result shape', async () => {
    assert.equal((await FV.upload(fileOf(10), { url: base + '/text', responseType: 'text' })).body, 'stored');
    const e = await FV.upload(fileOf(10), { url: base + '/empty' });
    assert.deepEqual([e.status, e.body], [204, null]);
    const r = await FV.upload(fileOf(1234, 'a.png', 'image/png'), { url: base + '/put/a.png', method: 'PUT' });
    assert.equal(r.body.size, 1234, 'a PUT sends the file itself');
    assert.equal(r.body.type, 'image/png');
    assert.equal(typeof r.url, 'string');
});
test('presigned PUT and presigned POST policy (fields before the file)', async () => {
    const f = fileOf(777, 'doc.pdf', 'application/pdf');
    const put = await FV.upload(f, { presign: async file => ({ url: base + '/put/' + file.name, method: 'PUT', headers: { 'Content-Type': file.type, 'x-amz-acl': 'private' } }) });
    assert.equal(put.body.size, 777);
    assert.equal(put.body.auth, 'private');
    assert.equal(put.body.type, 'application/pdf');
    const post = await FV.upload(f, { presign: async () => ({ url: base + '/policy', method: 'POST', fields: { key: 'uploads/doc.pdf', policy: 'abc' }, fileField: 'file' }) });
    assert.equal(post.status, 201);
    assert.equal(post.body.sorted, true, 'S3 needs the policy fields before the file');
    await assert.rejects(FV.upload(f, { presign: async () => ({}) }), e => e.code === 'PROTOCOL');
    await assert.rejects(FV.upload(f, {}), e => e.code === 'PROTOCOL');
});
test('retries: 5xx and 429 are retried with backoff, 4xx is not, onRetry and retryOn work', async () => {
    flaky = 2;
    const retries = [];
    const r = await FV.upload(fileOf(100), { url: base + '/flaky', retryDelayMs: 5, onRetry: x => retries.push(x.attempt) });
    assert.equal(r.status, 200);
    assert.deepEqual(retries, [1, 2]);
    rateLimited = 1;
    assert.equal((await FV.upload(fileOf(10), { url: base + '/limited', retryDelayMs: 5 })).status, 200, '429 with Retry-After');
    const before = seen.length;
    await assert.rejects(FV.upload(fileOf(10), { url: base + '/bad', retryDelayMs: 5 }), e => e.code === 'HTTP' && e.status === 400 && e.response.text.includes('nope'));
    assert.equal(seen.length - before, 1, 'a 400 is not retried');
    flaky = 10;
    await assert.rejects(FV.upload(fileOf(10), { url: base + '/flaky', retries: 1, retryDelayMs: 1 }), e => e.status === 503);
    flaky = 1;
    await assert.rejects(FV.upload(fileOf(10), { url: base + '/flaky', retries: 5, retryDelayMs: 1, retryOn: () => false }), e => e.status === 503, 'retryOn can say no');
    flaky = 0;
    await assert.rejects(FV.upload(fileOf(10), { url: 'http://127.0.0.1:1/none', retries: 1, retryDelayMs: 1 }), e => e.code === 'NETWORK');
});
test('abort: while it runs, before it starts (signal), and during a retry wait; timeout', async () => {
    const up = FV.upload(fileOf(10), { url: base + '/slow' });
    setTimeout(() => up.abort(), 50);
    await assert.rejects(up, e => e.aborted === true && e.code === 'ABORTED');
    const ctrl = new AbortController(); ctrl.abort();
    await assert.rejects(FV.upload(fileOf(10), { url: base + '/upload', signal: ctrl.signal }), e => e.code === 'ABORTED');
    const c2 = new AbortController();
    flaky = 5;
    const waiting = FV.upload(fileOf(10), { url: base + '/flaky', retryDelayMs: 5000, signal: c2.signal });
    setTimeout(() => c2.abort(), 80);
    await assert.rejects(waiting, e => e.code === 'ABORTED');
    flaky = 0;
    await assert.rejects(FV.upload(fileOf(10), { url: base + '/slow', timeout: 60, retries: 0 }), e => e.code === 'TIMEOUT');
});
test('validate: an invalid file is not sent; a good one is', async () => {
    const before = seen.length;
    await assert.rejects(FV.upload(fileOf(10, 'x.exe'), { url: base + '/upload', validate: { allowedExtensions: ['.png'] } }), e => e.code === 'INVALID' && e.errors.length > 0);
    assert.equal(seen.length, before);
    const png = new File([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), Buffer.alloc(40)], 'a.png', { type: 'image/png' });
    assert.equal((await FV.upload(png, { url: base + '/upload', validate: { allowedExtensions: ['.png'], validate: { imageDecode: false } } })).status, 200);
});
test('a throwing onProgress cannot break the upload', async () => {
    const r = await FV.upload(fileOf(10), { url: base + '/upload', onProgress: () => { throw new Error('ui bug'); } });
    assert.equal(r.status, 200);
});

// ---------------------------------------------------------------- tus against our own small server
const tusOpts = (extra) => ({ tus: Object.assign({ endpoint: base + '/tus', chunkSize: 64 * 1024, resume: false }, extra) });
test('tus: create, PATCH in chunks, metadata, progress, result', async () => {
    const f = fileOf(200 * 1024 + 123, 'big file.bin', 'application/x-test');
    const prog = [];
    const r = await FV.upload(f, Object.assign(tusOpts({ metadata: { owner: 'bob' } }), { onProgress: p => prog.push(p.loaded) }));
    assert.equal(r.status, 204);
    assert.equal(r.size, f.size);
    assert.match(r.url, /\/tus\/u\d+$/);
    const up = tusFiles.get(r.url.split('/').pop());
    assert.equal(up.size, f.size);
    assert.ok(Buffer.concat(up.data).equals(bytes(f.size)), 'every byte arrived in order');
    assert.equal(up.data.length, 4, '64 KB chunks: 3 full and the rest');
    assert.deepEqual(up.meta, { filename: 'big file.bin', filetype: 'application/x-test', owner: 'bob' });
    assert.equal(prog[prog.length - 1], f.size);
    const creates = seen.filter(s => s.method === 'POST' && s.url === '/tus');
    assert.equal(creates[creates.length - 1].headers['tus-resumable'], '1.0.0');
    assert.equal(creates[creates.length - 1].headers['upload-length'], String(f.size));
    const patches = seen.filter(s => s.method === 'PATCH').slice(-4);
    assert.deepEqual(patches.map(p => p.headers['upload-offset']), ['0', '65536', '131072', '196608']);
    assert.equal(patches[0].headers['content-type'], 'application/offset+octet-stream');
});
test('tus: an empty file, and a chunk that fails is retried at the same offset', async () => {
    const e = await FV.upload(fileOf(0), tusOpts());
    assert.equal(e.size, 0);
    const f = fileOf(150 * 1024);
    let id = null;
    const origSet = tusFiles.set.bind(tusFiles);
    tusFiles.set = (k, v) => { id = k; v.failNext = 2; return origSet(k, v); };
    try {
        const r = await FV.upload(f, tusOpts({ retryDelayMs: 1 }));
        assert.ok(Buffer.concat(tusFiles.get(r.url.split('/').pop()).data).equals(bytes(f.size)));
    } finally { tusFiles.set = origSet; }
    assert.ok(id);
});
test('tus: resume after the tab was closed (the same file continues where the server stopped), and a vanished upload starts over', async () => {
    const storage = new Map();
    const fake = { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
    try {
        const f = fileOf(256 * 1024, 'resume.bin');
        // first session: stop after the first chunk
        const first = FV.upload(f, { tus: { endpoint: base + '/tus', chunkSize: 64 * 1024, onChunkComplete: () => first.abort() } });
        await assert.rejects(first, e => e.aborted);
        assert.equal(storage.size, 1, 'the location was remembered');
        const loc = Array.from(storage.values())[0];
        const id = loc.split('/').pop();
        assert.equal(tusFiles.get(id).size, 64 * 1024);
        const before = seen.length;
        const r = await FV.upload(f, { tus: { endpoint: base + '/tus', chunkSize: 64 * 1024 } });
        assert.equal(r.url.endsWith(id), true, 'the same upload');
        assert.ok(Buffer.concat(tusFiles.get(id).data).equals(bytes(f.size)));
        const after = seen.slice(before);
        assert.equal(after.filter(s => s.method === 'POST' && s.url === '/tus').length, 0, 'no new upload was created');
        assert.equal(after.filter(s => s.method === 'HEAD').length, 1);
        assert.equal(after.filter(s => s.method === 'PATCH')[0].headers['upload-offset'], '65536');
        assert.equal(storage.size, 0, 'forgotten after success');
        // the server lost it: 404 on HEAD -> a new upload
        storage.set(Array.from(['fv-tus', base + '/tus', 'gone.bin', 100, 1700000000000, 'application/octet-stream']).join(':'), base + '/tus/doesnotexist');
        const g = await FV.upload(fileOf(100, 'gone.bin'), { tus: { endpoint: base + '/tus' } });
        assert.notEqual(g.url.split('/').pop(), 'doesnotexist');
        assert.equal(g.size, 100);
    } finally { delete globalThis.localStorage; }
});
test('tus: pause() stops, resume() continues from the server offset in the same session', async () => {
    const f = fileOf(256 * 1024, 'pause.bin');
    let up;
    let paused = false;
    up = FV.upload(f, { tus: { endpoint: base + '/tus', chunkSize: 64 * 1024, resume: false, onChunkComplete: (n, offset) => { if (!paused && offset >= 64 * 1024) { paused = true; up.pause(); setTimeout(() => up.resume(), 60); } } } });
    const r = await up;
    assert.equal(r.size, f.size);
    assert.ok(Buffer.concat(tusFiles.get(r.url.split('/').pop()).data).equals(bytes(f.size)), 'all bytes, once, in order');
    assert.throws(() => FV.upload(f, { url: base + '/upload' }).pause(), /only tus/);
});

// ---------------------------------------------------------------- tus against the real @tus/server
test('tus: works against the official @tus/server (create, chunks, resume with HEAD, metadata)', async () => {
    let TusServer, FileStore;
    try { ({ Server: TusServer } = require('@tus/server')); ({ FileStore } = require('@tus/file-store')); } catch (e) { return; }   // not installed: skip
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-tus-'));
    const tus = new TusServer({ path: '/files', datastore: new FileStore({ directory: dir }), respectForwardedHeaders: false });
    const srv = http.createServer((req, res) => { res.setHeader('Access-Control-Allow-Origin', '*'); tus.handle(req, res); });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const endpoint = 'http://127.0.0.1:' + srv.address().port + '/files';
    try {
        const f = fileOf(300 * 1024 + 5, 'official.bin', 'application/x-test');
        const prog = [];
        const r = await FV.upload(f, { tus: { endpoint, chunkSize: 128 * 1024, resume: false, metadata: { owner: 'bob' } }, onProgress: p => prog.push(p.percent) });
        assert.equal(r.size, f.size);
        assert.equal(prog[prog.length - 1], 100);
        const id = r.url.split('/').pop();
        assert.ok(fs.readFileSync(path.join(dir, id)).equals(bytes(f.size)), 'the file on the official server is byte for byte the same');
        const info = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
        assert.equal(info.metadata.filename, 'official.bin');
        assert.equal(info.metadata.owner, 'bob');
    } finally { srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('stop the test server', async () => { await new Promise(r => server.close(r)); });
