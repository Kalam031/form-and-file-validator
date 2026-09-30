'use strict';
require('./helpers/shim.js');
// FileValidator 2.2: custom methods, inline checks, server (remote) checks, duplicate content, media duration, global defaults.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const FV = require('../src/fileValidator.js');

const enc = s => Array.from(Buffer.from(s, 'latin1'));
const file = (name, bytes, type = 'text/plain') => new File([new Uint8Array(bytes)], name, { type });
const txt = (name, str) => new File([str], name, { type: 'text/plain' });
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const png = (name = 'a.png') => new File([new Uint8Array(PNG)], name, { type: 'image/png' });
const check = (files, cfg) => FV.validateFiles(files, cfg);
const codes = async (files, cfg) => (await check(files, cfg)).errors;

// ================================================================ addMethod / methods
test('addMethod + methods: parameter, {0} message, async, this.format', async () => {
    FV.addMethod('maxLines', async function (f, param) { return (await f.text()).split('\n').length <= param; }, 'At most {0} lines ({method})');
    const ok = await check([txt('a.txt', 'a\nb')], { methods: { maxLines: 3 } });
    assert.equal(ok.isValid, true);
    const bad = await check([txt('a.txt', 'a\nb\nc\nd')], { methods: { maxLines: 3 } });
    assert.equal(bad.isValid, false);
    assert.deepEqual(bad.errors, ['CUSTOM']);
    assert.equal(bad.details[0].message, 'At most 3 lines (maxLines)');
    assert.equal(bad.details[0].fileName, 'a.txt');
    assert.deepEqual([bad.details[0].params.method, bad.details[0].params.param], ['maxLines', 3]);
});

test('addMethod: message as function, array parameters, result objects with their own code and message', async () => {
    FV.addMethod('sizeBetween', (f, p) => f.size >= p[0] && f.size <= p[1], (param, f) => `${f.name} must be ${param[0]}-${param[1]} bytes`);
    const r = await check([txt('a.txt', 'hello world')], { methods: { sizeBetween: [1, 5] } });
    assert.equal(r.details[0].message, 'a.txt must be 1-5 bytes');
    FV.addMethod('coded', () => ({ valid: false, code: 'NOT_ALLOWED_HERE', message: 'Nope' }));
    const c = await check([txt('a.txt', 'x')], { methods: { coded: true } });
    assert.deepEqual(c.errors, ['NOT_ALLOWED_HERE']);
    assert.equal(c.details[0].message, 'Nope');
    FV.addMethod('withString', () => 'A string result is the message');
    assert.equal((await check([txt('a.txt', 'x')], { methods: { withString: true } })).details[0].message, 'A string result is the message');
    FV.addMethod('falsy', () => false);
    assert.equal((await check([txt('a.txt', 'x')], { methods: { falsy: true } })).details[0].message, 'This file did not pass the "falsy" check.');
});

test('methods: false switches one off, unknown names warn once, exceptions fail safely, dependency-mismatch passes', async () => {
    FV.addMethod('boom', () => { throw new Error('bug in a custom check'); });
    FV.addMethod('skipme', () => 'dependency-mismatch');
    const err = console.error, warn = console.warn; const warned = []; console.error = () => {}; console.warn = m => warned.push(m);
    try {
        assert.equal((await check([txt('a.txt', 'x')], { methods: { boom: true } })).isValid, false);
        assert.equal((await check([txt('a.txt', 'x')], { methods: { boom: false } })).isValid, true);
        assert.equal((await check([txt('a.txt', 'x')], { methods: { skipme: true } })).isValid, true);
        await check([txt('a.txt', 'x')], { methods: { neverRegistered: 1 } });
        await check([txt('a.txt', 'x')], { methods: { neverRegistered: 1 } });
    } finally { console.error = err; console.warn = warn; }
    assert.equal(warned.filter(m => /neverRegistered/.test(m)).length, 1);
    assert.throws(() => FV.addMethod('x', 'not a function'), /function/);
});

// ================================================================ inline custom
test('custom: function, array and object forms; sync and async; context', async () => {
    let ctx;
    const one = await check([txt('a.txt', 'x')], { custom: (f, c) => { ctx = c; return f.name === 'b.txt' || 'Wrong name'; } });
    assert.equal(one.details[0].message, 'Wrong name');
    assert.equal(ctx.ext, '.txt');
    assert.equal(ctx.category, 'file');
    assert.equal(ctx.index, 0);
    assert.equal(ctx.files.length, 1);
    assert.ok(ctx.config);

    const arr = await check([txt('a.txt', 'x')], { custom: [() => true, async () => ({ valid: false, message: 'second failed' })] });
    assert.deepEqual(arr.details.map(d => d.message), ['second failed']);
    const obj = await check([txt('a.txt', 'x')], { custom: { noSpaces: f => !f.name.includes(' '), asyncOne: async () => true } });
    assert.equal(obj.isValid, true);
    const named = await check([txt('a b.txt', 'x')], { custom: { noSpaces: f => !f.name.includes(' ') } });
    assert.equal(named.details[0].params.method, 'noSpaces');
    assert.equal((await check([txt('a.txt', 'x')], { custom: () => undefined })).isValid, false, 'undefined = invalid, like FormValidator');
});

test('custom checks only run for files that passed the built-in checks, and see the position in the selection', async () => {
    let calls = 0; const seen = [];
    const cfg = { maxFileSize: 5, custom: (f, c) => { calls++; seen.push(c.index); return true; } };
    const r = await check([txt('big.txt', 'way too large'), txt('ok.txt', 'ok'), txt('ok2.txt', 'ok')], cfg);
    assert.equal(r.isValid, false);
    assert.equal(calls, 2);
    assert.deepEqual(seen.sort(), [1, 2]);
});

test('customAll: whole-selection checks', async () => {
    const good = await check([txt('a.txt', 'x'), txt('b.txt', 'y')], { customAll: files => files.length % 2 === 0 });
    assert.equal(good.isValid, true);
    const bad = await check([txt('a.txt', 'x')], { customAll: files => 'Please select pairs of files' });
    assert.equal(bad.details[0].fileName, null);
    assert.equal(bad.details[0].message, 'Please select pairs of files');
    const obj = await check([txt('a.txt', 'x')], { customAll: async () => ({ valid: false, code: 'NEED_MORE', message: 'more' }) });
    assert.deepEqual(obj.errors, ['NEED_MORE']);
    const falsy = await check([txt('a.txt', 'x')], { customAll: () => false });
    assert.match(falsy.details[0].message, /customAll/);
});

// ================================================================ remote
const json = body => ({ ok: true, status: 200, json: async () => body });
function mockFetch(handler) { const calls = []; globalThis.fetch = async (url, o) => { calls.push({ url, o }); return handler(url, o, calls.length); }; return calls; }
const fresh = () => txt('r' + Math.random().toString(36).slice(2) + '.txt', 'content ' + Math.random());

test('remote: GET is the default (metadata in the query string); POST is one option away, per call or globally', async () => {
    let calls = mockFetch(() => json(true));
    const f = fresh();
    const r = await check([f], { remote: '/check' });
    assert.equal(r.isValid, true);
    assert.equal(calls[0].o.method, 'GET');
    assert.equal(calls[0].o.body, undefined);
    const q = new URLSearchParams(calls[0].url.split('?')[1]);
    assert.deepEqual([q.get('name'), q.get('size'), q.get('type')], [f.name, String(f.size), 'text/plain']);

    calls = mockFetch(() => json(true));
    await check([fresh()], { remote: { url: '/check', method: 'POST' } });
    assert.equal(calls[0].o.method, 'POST');
    assert.equal(calls[0].url, '/check');

    FV.remoteDefaults.method = 'POST';
    try {
        calls = mockFetch(() => json(true));
        await check([fresh()], { remote: '/check' });
        assert.equal(calls[0].o.method, 'POST');
        calls = mockFetch(() => json(true));
        await check([fresh()], { remote: { url: '/check', method: 'get' } });
        assert.equal(calls[0].o.method, 'GET');
    } finally { FV.remoteDefaults.method = 'GET'; }
});

test('remote: metadata as JSON when POSTing, with extra data and headers', async () => {
    const calls = mockFetch(() => json(true));
    const f = fresh();
    const r = await check([f], { remote: { url: '/check', method: 'POST', data: { project: 7 }, headers: { 'X-Token': 't' } } });
    assert.equal(r.isValid, true);
    assert.equal(calls[0].o.method, 'POST');
    assert.equal(calls[0].o.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].o.headers['X-Token'], 't');
    const body = JSON.parse(calls[0].o.body);
    assert.deepEqual([body.name, body.size, body.type, body.project], [f.name, f.size, 'text/plain', 7]);
    assert.equal(typeof body.lastModified, 'number');
});

test('remote: string shorthand, GET query, data as a function', async () => {
    let calls = mockFetch(() => json(true));
    const f = fresh();
    await check([f], { remote: '/short' });
    assert.match(calls[0].url, /^\/short\?name=/);
    calls = mockFetch(() => json(true));
    const g = fresh();
    await check([g], { remote: { url: '/q?x=1', method: 'get', data: (file, meta) => ({ n: meta.name.length }) } });
    assert.match(calls[0].url, /^\/q\?x=1&name=r.+&size=\d+&type=text%2Fplain&lastModified=\d+&n=\d+$/);
    assert.equal(calls[0].o.body, undefined);
});

test('remote: send "file" uploads the file as multipart form data (GET becomes POST)', async () => {
    const calls = mockFetch(() => json(true));
    const f = fresh();
    await check([f], { remote: { url: '/scan', send: 'file', field: 'upload', method: 'GET', data: { id: 5 } } });
    assert.equal(calls[0].o.method, 'POST');
    const fd = calls[0].o.body;
    assert.ok(fd instanceof FormData);
    assert.equal(fd.get('upload').name, f.name);
    assert.equal(fd.get('id'), '5');
    assert.equal(fd.get('name'), f.name);
    assert.equal(calls[0].o.headers['Content-Type'], undefined, 'the browser sets the multipart boundary');
});

test('remote: send "hash" includes the SHA-256 of the content', async () => {
    const calls = mockFetch(() => json(true));
    const f = new File(['abc'], 'abc.txt', { type: 'text/plain' });
    const expected = crypto.createHash('sha256').update('abc').digest('hex');
    await check([f], { remote: { url: '/dupe', send: 'hash', cache: false } });
    assert.equal(new URLSearchParams(calls[0].url.split('?')[1]).get('hash'), expected, 'GET: in the query string');
    await check([f], { remote: { url: '/dupe', send: 'hash', method: 'POST', cache: false } });
    assert.equal(JSON.parse(calls[1].o.body).hash, expected, 'POST: in the JSON body');
    assert.equal(await FV.hashFile(f), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(await FV.hashFile(new File([new Uint8Array(3 * 1048576)], 'big.bin'), 1), null, 'over the size cap: not hashed');
});

test('remote: every kind of answer', async () => {
    const answers = [
        [true, true, null], ['true', true, null], [false, false, 'REMOTE_REJECTED'], ['false', false, 'REMOTE_REJECTED'],
        [{ valid: true }, true, null], [{ valid: false, message: 'Taken', code: 'TAKEN' }, false, 'TAKEN'], ['Already uploaded', false, 'REMOTE_REJECTED']
    ];
    for (const [body, valid, code] of answers) {
        mockFetch(() => json(body));
        const r = await check([fresh()], { remote: '/c' });
        assert.equal(r.isValid, valid, JSON.stringify(body));
        if (code) assert.ok(r.errors.includes(code), JSON.stringify(body) + ' -> ' + r.errors);
    }
    mockFetch(() => json('Already uploaded'));
    assert.equal((await check([fresh()], { remote: '/c' })).details[0].message, 'Already uploaded');
    mockFetch(() => json(false));
    assert.equal((await check([fresh()], { remote: '/c' })).details[0].message, 'The server did not accept this file.');
    mockFetch(() => json({ result: 'ok' }));
    assert.equal((await check([fresh()], { remote: { url: '/c', parse: r => r.result === 'ok' } })).isValid, true);
});

test('remote: network / HTTP errors block unless failOpen; timeouts are supported', async () => {
    mockFetch(() => { throw new Error('offline'); });
    let r = await check([fresh()], { remote: '/c' });
    assert.deepEqual(r.errors, ['REMOTE_ERROR']);
    assert.match(r.details[0].message, /could not be checked/);
    assert.equal((await check([fresh()], { remote: { url: '/c', failOpen: true } })).isValid, true);
    mockFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));
    assert.deepEqual((await check([fresh()], { remote: '/c' })).errors, ['REMOTE_ERROR']);
    mockFetch(() => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }));
    assert.deepEqual((await check([fresh()], { remote: '/c' })).errors, ['REMOTE_ERROR']);
    mockFetch((url, o) => new Promise((res, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted')))));
    r = await check([fresh()], { remote: { url: '/slow', timeout: 30 } });
    assert.deepEqual(r.errors, ['REMOTE_ERROR']);
});

test('remote: results are cached per file, and the server is not asked about files that already failed', async () => {
    const calls = mockFetch(() => json(true));
    const f = fresh();
    await check([f], { remote: '/c' });
    await check([f], { remote: '/c' });
    assert.equal(calls.length, 1, 'same File, same URL: cached');
    await check([f], { remote: { url: '/c', cache: false } });
    assert.equal(calls.length, 2);
    await check([f], { remote: '/other' });
    assert.equal(calls.length, 3);
    calls.length = 0;
    const r = await check([txt('bad.exe', 'x'), fresh()], { remote: '/c' });
    assert.equal(r.isValid, false);
    assert.equal(calls.length, 1, 'only the valid file reached the server');
});

// ================================================================ duplicate content
test('duplicateContent finds identical files under different names', async () => {
    const same = ['abc', 'abc', 'different'].map((c, i) => new File([c], `f${i}.txt`, { type: 'text/plain' }));
    const r = await check(same, { duplicateContent: true });
    assert.equal(r.isValid, false);
    assert.deepEqual(r.errors, ['DUPLICATE_FILES']);
    assert.equal(r.details[0].fileName, null);
    assert.match(r.details[0].message, /identical content: f0\.txt, f1\.txt/);
    assert.equal((await check(same, {})).isValid, true, 'off by default');
    assert.equal((await check([same[0], same[2]], { duplicateContent: true })).isValid, true);
    assert.equal((await check([same[0]], { duplicateContent: true })).isValid, true);
    const big = [new File([new Uint8Array(2 * 1048576)], 'a.bin'), new File([new Uint8Array(2 * 1048576)], 'b.bin')];
    assert.equal((await check(big, { duplicateContent: true, duplicateContentMaxMB: 1, validate: { signature: false } })).isValid, true, 'too big to hash: skipped');
});

// ================================================================ media duration
const mp4 = (name = 'v.mp4') => new File([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0, 0, 0, 0])], name, { type: 'video/mp4' });
const mp3 = (name = 'a.mp3') => new File([new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0])], name, { type: 'audio/mpeg' });

test('duration limits for video and audio, with a custom reader', async () => {
    const reader = secs => ({ readMediaInfo: async () => ({ duration: secs }) });
    assert.equal((await check([mp4()], { maxDurationSec: 60, ...reader(45) })).isValid, true);
    let r = await check([mp4()], { maxDurationSec: 60, ...reader(3725) });
    assert.deepEqual(r.errors, ['DURATION_TOO_LONG']);
    assert.equal(r.details[0].message, 'This recording is 1:02:05 long but the maximum is 1:00.');
    r = await check([mp3()], { minDurationSec: 30, ...reader(12) });
    assert.deepEqual(r.errors, ['DURATION_TOO_SHORT']);
    assert.equal(r.details[0].message, 'This recording is 0:12 long but it must be at least 0:30.');
    assert.equal((await check([mp3()], { minDurationSec: '30', maxDurationSec: '60', ...reader(45) })).isValid, true, 'numeric strings');
    assert.equal(FV.formatDuration(59), '0:59');
    assert.equal(FV.formatDuration(3600), '1:00:00');
});

test('duration: unreadable media is skipped unless requireMediaInfo; images and documents are not affected', async () => {
    const boom = { readMediaInfo: async () => { throw new Error('cannot decode'); } };
    assert.equal((await check([mp4()], { maxDurationSec: 60, ...boom })).isValid, true);
    assert.deepEqual((await check([mp4()], { maxDurationSec: 60, requireMediaInfo: true, ...boom })).errors, ['INVALID_MEDIA']);
    assert.equal((await check([mp4()], { maxDurationSec: 60 })).isValid, true, 'no DOM (Node): duration is not checked');
    assert.equal((await check([png()], { maxDurationSec: 1, readMediaInfo: async () => ({ duration: 99 }) })).isValid, true);
    const asyncReader = { readMediaInfo: async () => ({ duration: 200 }) };
    assert.equal((await check([mp4()], { categories: { video: { maxDurationSec: 300 } }, ...asyncReader })).isValid, true);
    assert.equal((await check([mp4()], { categories: { video: { maxDurationSec: 100 } }, ...asyncReader })).isValid, false);
});

// ================================================================ global defaults + combination
test('setDefaults applies to every call; explicit config wins; reset afterwards', async () => {
    FV.setDefaults({ maxFileSize: 3, messages: { SIZE_TOO_LARGE: 'Default: {max}' } });
    try {
        const r = await check([txt('a.txt', 'longer than three')], {});
        assert.equal(r.details[0].message, 'Default: 3 B');
        assert.equal((await check([txt('a.txt', 'longer than three')], { maxFileSize: 1000 })).isValid, true);
    } finally { Object.keys(FV.defaults).forEach(k => delete FV.defaults[k]); }
    assert.equal((await check([txt('a.txt', 'longer than three')], {})).isValid, true);
});

test('everything together: built-ins, methods, custom and remote run in that order and stop at the first group that fails', async () => {
    const order = [];
    FV.addMethod('trace', () => { order.push('method'); return true; });
    const calls = mockFetch(() => { order.push('remote'); return json(true); });
    const r = await check([txt('a.txt', 'x')], { methods: { trace: true }, custom: () => { order.push('custom'); return true; }, remote: '/c' });
    assert.equal(r.isValid, true);
    assert.deepEqual(order, ['method', 'custom', 'remote']);
    order.length = 0;
    const bad = await check([txt('a.txt', 'x')], { methods: { trace: true }, custom: () => { order.push('custom'); return false; }, remote: '/c' });
    assert.equal(bad.isValid, false);
    assert.deepEqual(order, ['method', 'custom'], 'the server is not asked when a local check failed');
});

test('new options do not trigger the unknown-option warning', async () => {
    const warn = console.warn; const seen = []; console.warn = m => seen.push(m);
    try {
        await check([txt('a.txt', 'x')], { methods: {}, custom: [], customAll: () => true, remote: null, duplicateContent: true, duplicateContentMaxMB: 5, maxDurationSec: 1, minDurationSec: 0, requireMediaInfo: false });
    } finally { console.warn = warn; }
    assert.deepEqual(seen, []);
});
