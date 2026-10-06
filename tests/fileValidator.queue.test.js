'use strict';
// FileValidator.uploadQueue(): concurrency, waiting offline, retries, a file that changed or vanished, abort / pause / retry.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const FV = require('../src/fileValidator.js');
require('../src/fileValidator.upload.js');

const fileOf = (n, name = 'a.bin') => new File([Buffer.alloc(n, 7)], name, { type: 'application/octet-stream', lastModified: 1700000000000 });
let server, base, active = 0, maxActive = 0, hits = 0, failures = 0;
test('start the server', async () => {
    server = http.createServer((req, res) => {
        req.resume();
        req.on('end', () => {
            hits++;
            const url = new URL(req.url, 'http://x');
            if (url.pathname === '/flaky') {
                if (failures-- > 0) { res.writeHead(503); return res.end('{}'); }
                res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}');
            }
            active++; maxActive = Math.max(maxActive, active);
            setTimeout(() => { active--; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); }, url.pathname === '/slow' ? 120 : 5);
        });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = 'http://127.0.0.1:' + server.address().port;
});

test('concurrency: never more uploads in flight than the limit; whenIdle resolves after all', async () => {
    maxActive = 0;
    const q = FV.uploadQueue({ url: base + '/slow', concurrency: 2, onlineEvent: new EventTarget() });
    const items = [1, 2, 3, 4, 5].map(i => q.add(fileOf(100 + i, 'f' + i + '.bin')));
    const done = await q.whenIdle();
    assert.equal(maxActive, 2);
    assert.deepEqual(items.map(i => i.status), ['done', 'done', 'done', 'done', 'done']);
    assert.equal(items[0].result.body.ok, true);
    assert.equal(done.length, 5);
    q.destroy();
});

test('offline: nothing is sent until the connection is back, then it uploads (no failed attempt)', async () => {
    let on = false;
    const bus = new EventTarget();
    const statuses = [];
    const q = FV.uploadQueue({ url: base + '/upload', retries: 0, isOnline: () => on, onlineEvent: bus, onChange: it => statuses.push(it.status) });
    hits = 0;
    const it = q.add(fileOf(500));
    await new Promise(r => setTimeout(r, 40));
    assert.equal(it.status, 'offline');
    assert.equal(hits, 0);
    on = true; bus.dispatchEvent(new Event('online'));
    const r = await it.promise;
    assert.equal(r.status, 200);
    assert.equal(it.status, 'done');
    assert.ok(statuses.includes('offline') && statuses.includes('uploading'));
    q.destroy();
});

test('a network error while the device is offline waits for the connection and does not use up the retries', async () => {
    let on = true, calls = 0;
    const bus = new EventTarget();
    const flakyFetch = (url, init) => { calls++; if (calls === 1) { on = false; return Promise.reject(new TypeError('Failed to fetch')); } return fetch(url, init); };
    const q = FV.uploadQueue({ url: base + '/upload', retries: 0, retryDelayMs: 1, isOnline: () => on, onlineEvent: bus, fetch: flakyFetch, forceFetch: true });
    const it = q.add(fileOf(300));
    await new Promise(r => setTimeout(r, 40));
    assert.equal(it.status, 'offline');
    on = true; bus.dispatchEvent(new Event('online'));
    await it.promise;
    assert.equal(calls, 2);
    assert.equal(it.status, 'done');
    q.destroy();
});

test('retries: server errors are retried with backoff up to the limit, then the item fails with the status', async () => {
    const bus = new EventTarget();
    failures = 2;
    const retried = [];
    const q = FV.uploadQueue({ url: base + '/flaky', retries: 3, retryDelayMs: 1, onlineEvent: bus, onRetry: i => retried.push(i.attempt) });
    const ok = q.add(fileOf(100));
    await ok.promise;
    assert.deepEqual(retried, [1, 2]);
    failures = 99;
    const q2 = FV.uploadQueue({ url: base + '/flaky', retries: 1, retryDelayMs: 1, onlineEvent: bus });
    const bad = q2.add(fileOf(100));
    await assert.rejects(bad.promise, e => e.code === 'HTTP' && e.status === 503);
    assert.equal(bad.status, 'failed');
    failures = 0;
    assert.equal(q2.retryFailed(), 1);
    await bad.promise;
    assert.equal(bad.status, 'done');
    q.destroy(); q2.destroy();
});

test('a file that changed after it was chosen stops with FILE_CHANGED; replace() queues the new one', async () => {
    const bus = new EventTarget();
    failures = 1;
    const f = fileOf(100, 'report.pdf');
    let modified = f.lastModified;
    Object.defineProperty(f, 'lastModified', { get: () => modified });
    const q = FV.uploadQueue({ url: base + '/flaky', retries: 3, retryDelayMs: 20, onlineEvent: bus, onChange: it => { if (it.status === 'retrying') modified = 1800000000000; } });
    const it = q.add(f);
    await assert.rejects(it.promise, e => e.code === 'FILE_CHANGED');
    assert.equal(it.status, 'changed');
    assert.match(it.error.message, /report\.pdf/);
    it.replace(fileOf(120, 'report.pdf'));
    const r = await it.promise;
    assert.equal(r.status, 200);
    assert.equal(it.status, 'done');
    q.destroy();
});

test('a file that cannot be read any more (moved or deleted) stops with FILE_UNREADABLE', async () => {
    const f = fileOf(100, 'gone.png');
    f.slice = () => ({ arrayBuffer: () => Promise.reject(new DOMException('gone', 'NotFoundError')) });
    const q = FV.uploadQueue({ url: base + '/upload', onlineEvent: new EventTarget() });
    const it = q.add(f);
    await assert.rejects(it.promise, e => e.code === 'FILE_UNREADABLE');
    assert.equal(it.status, 'changed');
    assert.equal(it.error instanceof FV.UploadError, true);
    q.destroy();
});

test('abort: a queued item never starts, an uploading one is cancelled, abortAll and clear tidy up', async () => {
    const q = FV.uploadQueue({ url: base + '/slow', concurrency: 1, onlineEvent: new EventTarget() });
    hits = 0;
    const a = q.add(fileOf(100, 'a')), b = q.add(fileOf(100, 'b')), c = q.add(fileOf(100, 'c'));
    b.abort();
    await new Promise(r => setTimeout(r, 30));
    a.abort();
    await assert.rejects(a.promise, e => e.aborted);
    await assert.rejects(b.promise, e => e.aborted);
    await c.promise;
    assert.deepEqual([a.status, b.status, c.status], ['aborted', 'aborted', 'done']);
    assert.equal(hits <= 2, true, 'the aborted queued file was never sent, got ' + hits);
    q.clear();
    assert.equal(q.items.length, 0);
    q.destroy();
});

test('abort while waiting offline, and pause / resume', async () => {
    let on = false;
    const bus = new EventTarget();
    const q = FV.uploadQueue({ url: base + '/upload', isOnline: () => on, onlineEvent: bus });
    const it = q.add(fileOf(100));
    await new Promise(r => setTimeout(r, 20));
    it.abort();
    await assert.rejects(it.promise, e => e.aborted);
    assert.equal(it.status, 'aborted');
    on = true;
    q.pause();
    hits = 0;
    const p = q.add(fileOf(100));
    await new Promise(r => setTimeout(r, 40));
    assert.equal(p.status, 'queued');
    assert.equal(hits, 0);
    q.resume();
    await p.promise;
    assert.equal(p.status, 'done');
    q.destroy();
});

test('stop the server', () => { server.close(); });
