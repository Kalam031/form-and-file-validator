'use strict';
// ClamAV (against a fake clamd that speaks INSTREAM), VirusTotal and HTTP scanners, and the scan option end to end.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const FV = require('../src/fileValidator.js');
const { clamav, virustotal, httpScanner, all } = require('../src/scanners.js');

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const fileOf = (text, name = 'a.txt') => new File([text], name, { type: 'text/plain' });

// ---------------------------------------------------------------- a fake clamd
function fakeClamd(opts = {}) {
    const seen = [];
    const server = net.createServer(sock => {
        let buf = Buffer.alloc(0), started = false;
        sock.on('data', d => {
            buf = Buffer.concat([buf, d]);
            if (!started) { const z = buf.indexOf(0); if (z < 0) return; seen.push(buf.subarray(0, z).toString()); buf = buf.subarray(z + 1); started = true; }
            const data = [];
            let off = 0;
            for (;;) {
                if (buf.length - off < 4) return;
                const len = buf.readUInt32BE(off);
                if (len === 0) break;
                if (buf.length - off - 4 < len) return;
                data.push(buf.subarray(off + 4, off + 4 + len)); off += 4 + len;
            }
            const body = Buffer.concat(data);
            seen.push({ size: body.length, chunks: data.length });
            if (opts.hang) return;
            if (opts.error) { sock.end('INSTREAM size limit exceeded. ERROR\0'); return; }
            sock.end(body.includes(Buffer.from('EICAR-STANDARD')) ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0');
        });
    });
    return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port, seen })));
}

test('clamav: a clean file passes, EICAR is found, the stream is chunked', async () => {
    const { server, port, seen } = await fakeClamd();
    try {
        const scan = clamav({ port, chunkSize: 10 });
        assert.equal(await scan(fileOf('hello world, this is clean')), true);
        assert.equal(seen[0], 'zINSTREAM');
        assert.deepEqual(seen[1], { size: 26, chunks: 3 }, 'chunks of 10 bytes');
        const r = await scan(fileOf(EICAR));
        assert.deepEqual([r.valid, r.threat], [false, 'Eicar-Test-Signature']);
        assert.equal(await scan(Buffer.from('buffer works too')), true);
        assert.equal(await scan(new File([], 'empty.txt')), true, 'an empty file');
        const big = Buffer.alloc(300000, 7);
        assert.equal(await scan(big), true);
        assert.equal(seen[seen.length - 1].size, 300000);
    } finally { server.close(); }
});
test('clamav: errors and timeouts reject; an unreachable daemon rejects', async () => {
    const a = await fakeClamd({ error: true });
    try { await assert.rejects(clamav({ port: a.port })(fileOf('x')), /clamd: INSTREAM size limit exceeded/); } finally { a.server.close(); }
    const b = await fakeClamd({ hang: true });
    try { await assert.rejects(clamav({ port: b.port, timeout: 80 })(fileOf('x')), /timed out/); } finally { b.server.close(); }
    await assert.rejects(clamav({ port: 1 })(fileOf('x')), e => /ECONNREFUSED|connect/i.test(e.message + e.code));
    await assert.rejects(clamav()(123), /expected a File/);
});
test('the scan option end to end: EICAR is MALWARE_DETECTED, a dead scanner is SCAN_ERROR unless scanFailOpen', async () => {
    const { server, port } = await fakeClamd();
    try {
        const cfg = { scan: clamav({ port }), validate: { signature: false } };
        const bad = await FV.validateFile(fileOf(EICAR, 'eicar.txt'), cfg);
        assert.equal(bad.isValid, false);
        assert.ok(bad.errors.includes('MALWARE_DETECTED'));
        assert.match(bad.details.map(d => d.message).join(' '), /Eicar-Test-Signature/);
        assert.equal((await FV.validateFile(fileOf('fine'), cfg)).isValid, true);
    } finally { server.close(); }
    const dead = { scan: clamav({ port: 1, timeout: 200 }), validate: { signature: false } };
    assert.ok((await FV.validateFile(fileOf('x'), dead)).errors.includes('SCAN_ERROR'));
    assert.equal((await FV.validateFile(fileOf('x'), Object.assign({ scanFailOpen: true }, dead))).isValid, true);
});

// ---------------------------------------------------------------- VirusTotal
const vtResp = (status, body) => ({ status, json: async () => body });
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
test('virustotal: known clean, known malicious with a name, thresholds, unknown handling', async () => {
    const calls = [];
    const db = { [sha('clean')]: { last_analysis_stats: { malicious: 0, suspicious: 0 } }, [sha('bad')]: { last_analysis_stats: { malicious: 5 }, popular_threat_classification: { suggested_threat_label: 'trojan.generic' } },
        [sha('meh')]: { last_analysis_stats: { malicious: 0, suspicious: 2 }, last_analysis_results: { E1: { category: 'suspicious', result: 'Heur.Suspect' } } } };
    const fetch = async (url, init) => { calls.push({ url, init }); const h = url.split('/files/')[1]; return db[h] ? vtResp(200, { data: { attributes: db[h] } }) : vtResp(404, {}); };
    const scan = virustotal({ apiKey: 'k', fetch });
    assert.equal(await scan(fileOf('clean')), true);
    assert.equal(calls[0].init.headers['x-apikey'], 'k');
    assert.equal(calls[0].url, 'https://www.virustotal.com/api/v3/files/' + sha('clean'), 'only the hash is sent');
    const r = await scan(fileOf('bad'));
    assert.deepEqual([r.valid, r.threat, r.sha256], [false, 'trojan.generic', sha('bad')]);
    assert.equal(await scan(fileOf('meh')), true, 'suspicious alone does not count by default');
    const strict = await virustotal({ apiKey: 'k', fetch, countSuspicious: true })(fileOf('meh'));
    assert.equal(strict.threat, 'Heur.Suspect');
    assert.equal(await virustotal({ apiKey: 'k', fetch, minDetections: 10 })(fileOf('bad')), true);
    assert.equal(await scan(fileOf('never seen')), true, 'unknown hash: allowed by default');
    assert.equal((await virustotal({ apiKey: 'k', fetch, unknown: 'block' })(fileOf('never seen'))).unknown, true);
    assert.throws(() => virustotal({}), /apiKey/);
});
test('virustotal: upload and wait for the analysis, errors reject', async () => {
    let polls = 0;
    const fetch = async (url, init) => {
        if (url.includes('/files/')) return vtResp(404, {});
        if (url.endsWith('/files') && init.method === 'POST') { assert.ok(init.body instanceof FormData); return vtResp(200, { data: { id: 'an1' } }); }
        if (url.endsWith('/analyses/an1')) { polls++; return vtResp(200, { data: { attributes: polls < 2 ? { status: 'queued' } : { status: 'completed', stats: { malicious: 3 }, results: { E: { category: 'malicious', result: 'Win.Bad' } } } } }); }
        throw new Error('unexpected ' + url);
    };
    const r = await virustotal({ apiKey: 'k', fetch, upload: true, pollMs: 5 })(fileOf('fresh'));
    assert.equal(r.threat, 'Win.Bad');
    assert.equal(polls, 2);
    await assert.rejects(virustotal({ apiKey: 'k', fetch: async () => vtResp(401, {}) })(fileOf('x')), /refused/);
    await assert.rejects(virustotal({ apiKey: 'k', fetch: async () => vtResp(429, {}) })(fileOf('x')), /rate limit/);
    await assert.rejects(virustotal({ apiKey: 'k', fetch: async () => vtResp(500, {}) })(fileOf('x')), /HTTP 500/);
    const never = async url => (url.includes('/files/') ? vtResp(404, {}) : url.endsWith('/files') ? vtResp(200, { data: { id: 'z' } }) : vtResp(200, { data: { attributes: { status: 'queued' } } }));
    await assert.rejects(virustotal({ apiKey: 'k', fetch: never, upload: true, pollMs: 5, maxWaitMs: 40 })(fileOf('x')), /did not finish/);
});

// ---------------------------------------------------------------- HTTP scanner
test('httpScanner: raw and multipart bodies, verdict shapes, 406, custom parse, errors and timeout', async () => {
    const seen = [];
    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            const body = Buffer.concat(chunks);
            seen.push({ url: req.url, type: req.headers['content-type'], size: body.length, auth: req.headers.authorization });
            const j = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
            if (req.url === '/ok') return j(200, { clean: true });
            if (req.url === '/infected') return j(200, { infected: true, threat: 'Bad.Thing' });
            if (req.url === '/406') return j(406, { virus: 'Q' });
            if (req.url === '/valid') return j(200, { valid: false, name: 'N' });
            if (req.url === '/plain') { res.writeHead(200); return res.end('whatever'); }
            if (req.url === '/500') return j(500, {});
            if (req.url === '/slow') return setTimeout(() => j(200, {}), 500);
            return j(404, {});
        });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const u = p => 'http://127.0.0.1:' + server.address().port + p;
    try {
        assert.equal(await httpScanner({ url: u('/ok'), headers: { Authorization: 'Bearer t' } })(fileOf('abc')), true);
        assert.deepEqual([seen[0].type, seen[0].size, seen[0].auth], ['application/octet-stream', 3, 'Bearer t']);
        await httpScanner({ url: u('/ok'), field: 'file' })(fileOf('abc'));
        assert.match(seen[1].type, /^multipart\/form-data/);
        assert.equal((await httpScanner({ url: u('/infected') })(fileOf('x'))).threat, 'Bad.Thing');
        assert.equal((await httpScanner({ url: u('/406') })(fileOf('x'))).threat, 'Q');
        assert.equal((await httpScanner({ url: u('/valid') })(fileOf('x'))).threat, 'N');
        assert.equal(await httpScanner({ url: u('/plain') })(fileOf('x')), true, '200 without a verdict is clean');
        await assert.rejects(httpScanner({ url: u('/500') })(fileOf('x')), /HTTP 500/);
        await assert.rejects(httpScanner({ url: u('/slow'), timeout: 60 })(fileOf('x')), /timed out/);
        await assert.rejects(httpScanner({ url: 'http://127.0.0.1:1/x' })(fileOf('x')), /scanner:/);
        assert.equal((await httpScanner({ url: u('/ok'), parse: () => 'Custom.Name' })(fileOf('x'))).threat, 'Custom.Name');
        assert.equal(await httpScanner({ url: u('/infected'), parse: () => true })(fileOf('x')), true);
        assert.equal((await httpScanner({ url: u('/ok'), parse: () => false })(fileOf('x'))).valid, false);
        assert.throws(() => httpScanner({}), /url/);
    } finally { server.close(); }
});

test('all(): the first threat wins, every scanner runs for a clean file, an error rejects', async () => {
    const order = [];
    const ok = n => async () => { order.push(n); return true; };
    const bad = async () => { order.push('bad'); return { valid: false, threat: 'T' }; };
    assert.equal(await all(ok('a'), ok('b'), null)(fileOf('x')), true);
    assert.deepEqual(order, ['a', 'b']);
    order.length = 0;
    assert.equal((await all(ok('a'), bad, ok('never'))(fileOf('x'))).threat, 'T');
    assert.deepEqual(order, ['a', 'bad']);
    await assert.rejects(all(async () => { throw new Error('down'); })(fileOf('x')), /down/);
});
