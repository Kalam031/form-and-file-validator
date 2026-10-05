/*!
 * Malware scanner adapters v1.0.0 — ready-made `scan` functions for FileValidator (Node 18+, server side).
 *
 *   const { clamav, virustotal, httpScanner } = require('form-and-file-validator/scanners');
 *   const rules = { allowedExtensions: ['.pdf', '.png'], scan: clamav({ host: '127.0.0.1', port: 3310 }) };      // ClamAV daemon (clamd), INSTREAM
 *   const rules = { scan: virustotal({ apiKey: process.env.VT_KEY }) };                                           // VirusTotal hash lookup (and optional upload)
 *   const rules = { scan: httpScanner({ url: 'https://scan.internal/check' }) };                                  // your own service
 *   // combine: scan: all(clamav({...}), virustotal({...}))
 *
 * Each adapter is `async (file, ctx) => true | { valid: false, threat, message? }`, which is what the `scan` option expects. They never throw for a clean file; a scanner that cannot be
 * reached rejects, and FileValidator turns that into SCAN_ERROR (or lets the file pass with scanFailOpen: true).
 *
 * Changelog
 *   1.0.0  First release.
 */
'use strict';
const net = require('net');
const crypto = require('crypto');

async function bytesOf(file) {
    if (Buffer.isBuffer(file)) return file;
    if (file && typeof file.arrayBuffer === 'function') return Buffer.from(await file.arrayBuffer());
    throw new TypeError('scanner: expected a File or Buffer');
}
const threatResult = (name, extra) => Object.assign({ valid: false, threat: name || 'malware' }, extra);

/**
 * ClamAV daemon over TCP or a unix socket (the INSTREAM command, so the file never touches the scanner's disk).
 * options: host ('127.0.0.1'), port (3310), socket (path of a unix socket, instead of host/port), timeout (30000 ms), chunkSize (64 KB).
 * clamd's StreamMaxLength (25 MB by default) applies: a bigger file is answered with an error and rejects.
 */
function clamav(options) {
    const o = options || {};
    const chunkSize = o.chunkSize || 65536;
    return async function scanWithClamav(file) {
        const data = await bytesOf(file);
        const answer = await new Promise((resolve, reject) => {
            const sock = o.socket ? net.createConnection(o.socket) : net.createConnection({ host: o.host || '127.0.0.1', port: o.port || 3310 });
            const parts = [];
            let settled = false;
            const done = (err, val) => { if (settled) return; settled = true; clearTimeout(timer); sock.destroy(); err ? reject(err) : resolve(val); };
            const timer = setTimeout(() => done(new Error('clamd: timed out')), o.timeout || 30000);
            sock.on('error', e => done(e));
            sock.on('data', d => parts.push(d));
            sock.on('end', () => done(null, Buffer.concat(parts).toString('utf8').replace(/\0/g, '').trim()));
            sock.on('close', () => done(null, Buffer.concat(parts).toString('utf8').replace(/\0/g, '').trim()));
            sock.on('connect', () => {
                sock.write('zINSTREAM\0');
                for (let i = 0; i < data.length; i += chunkSize) {
                    const chunk = data.subarray(i, Math.min(data.length, i + chunkSize));
                    const len = Buffer.alloc(4); len.writeUInt32BE(chunk.length, 0);
                    sock.write(len); sock.write(chunk);
                }
                sock.write(Buffer.alloc(4));   // a zero-length chunk ends the stream
            });
        });
        // "stream: OK" | "stream: Eicar-Test-Signature FOUND" | "INSTREAM size limit exceeded. ERROR" | "... ERROR"
        if (/\bFOUND$/.test(answer)) return threatResult(answer.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, ''));
        if (/\bOK$/.test(answer)) return true;
        throw new Error('clamd: ' + (answer || 'no answer'));
    };
}

/**
 * VirusTotal v3 (https://docs.virustotal.com): looks the file's SHA-256 up; a known file is judged from the engines' verdicts.
 * options: apiKey (required), minDetections (1: engines that must call it malicious, suspicious counts when `countSuspicious`), countSuspicious (false),
 *   upload (false: an unknown hash is treated as `unknown`; true uploads the file and waits for the analysis, files up to 32 MB), unknown ('allow' | 'block', default 'allow'),
 *   pollMs (3000), maxWaitMs (60000), baseUrl, fetch.
 * Privacy note: a hash lookup sends only the hash; `upload: true` shares the file with VirusTotal and its partners.
 */
function virustotal(options) {
    const o = options || {};
    if (!o.apiKey) throw new Error('virustotal: apiKey is required');
    const base = (o.baseUrl || 'https://www.virustotal.com/api/v3').replace(/\/$/, '');
    const f = o.fetch || fetch;
    const headers = { 'x-apikey': o.apiKey, Accept: 'application/json' };
    const min = typeof o.minDetections === 'number' ? o.minDetections : 1;
    const judge = stats => {
        const bad = (stats.malicious || 0) + (o.countSuspicious ? (stats.suspicious || 0) : 0);
        return bad >= min;
    };
    const nameOf = attrs => {
        const c = attrs.popular_threat_classification && attrs.popular_threat_classification.suggested_threat_label;
        if (c) return c;
        const r = attrs.last_analysis_results || attrs.results || {};
        const hit = Object.keys(r).map(k => r[k]).find(x => x && (x.category === 'malicious' || x.category === 'suspicious') && x.result);
        return hit ? hit.result : 'malware';
    };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    return async function scanWithVirusTotal(file) {
        const data = await bytesOf(file);
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        const r = await f(base + '/files/' + hash, { headers });
        if (r.status === 200) {
            const attrs = (await r.json()).data.attributes;
            return judge(attrs.last_analysis_stats || {}) ? threatResult(nameOf(attrs), { sha256: hash }) : true;
        }
        if (r.status === 401 || r.status === 403) throw new Error('virustotal: the API key was refused (' + r.status + ')');
        if (r.status === 429) throw new Error('virustotal: rate limit reached');
        if (r.status !== 404) throw new Error('virustotal: HTTP ' + r.status);
        if (!o.upload) return o.unknown === 'block' ? threatResult('unknown to VirusTotal', { unknown: true }) : true;
        const form = new FormData();
        form.append('file', new Blob([data]), (file && file.name) || 'upload.bin');
        const up = await f(base + '/files', { method: 'POST', headers: { 'x-apikey': o.apiKey }, body: form });
        if (up.status !== 200) throw new Error('virustotal: upload failed (' + up.status + ')');
        const id = (await up.json()).data.id;
        const deadline = Date.now() + (o.maxWaitMs || 60000);
        while (Date.now() < deadline) {
            await sleep(o.pollMs || 3000);
            const a = await f(base + '/analyses/' + id, { headers });
            if (a.status !== 200) continue;
            const attrs = (await a.json()).data.attributes;
            if (attrs.status === 'completed') return judge(attrs.stats || {}) ? threatResult(nameOf(attrs), { sha256: hash }) : true;
        }
        throw new Error('virustotal: the analysis did not finish in time');
    };
}

/**
 * Your own scanning service over HTTP: the file is POSTed (raw body, or multipart with `field`) and the JSON answer is read.
 * options: url, method ('POST'), headers, field (multipart field name; omit for a raw body), timeout (30000), fetch,
 *   parse(json, response) -> true | { valid: false, threat } | string (a threat name) | false
 *   default parse: { clean: true } / { infected: true, threat } / { valid, threat } / HTTP 200 without a verdict = clean, 406 / 422 = infected.
 */
function httpScanner(options) {
    const o = options || {};
    if (!o.url) throw new Error('httpScanner: url is required');
    const f = o.fetch || fetch;
    return async function scanWithHttp(file) {
        const data = await bytesOf(file);
        let body, headers = Object.assign({}, o.headers);
        if (o.field) { body = new FormData(); body.append(o.field, new Blob([data]), (file && file.name) || 'upload.bin'); }
        else { body = data; headers = Object.assign({ 'Content-Type': 'application/octet-stream' }, headers); }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), o.timeout || 30000);
        let resp;
        try { resp = await f(o.url, { method: o.method || 'POST', headers, body, signal: ctrl.signal }); }
        catch (e) { throw new Error('scanner: ' + (e && e.name === 'AbortError' ? 'timed out' : e && e.message)); }
        finally { clearTimeout(timer); }
        let json = null;
        try { json = await resp.json(); } catch (e) { /* no JSON body */ }
        if (typeof o.parse === 'function') {
            const v = await o.parse(json, resp);
            if (v === true) return true;
            if (typeof v === 'string') return threatResult(v);
            return v === false ? threatResult() : v;
        }
        if (resp.status === 406 || resp.status === 422) return threatResult(json && (json.threat || json.virus || json.name));
        if (resp.status < 200 || resp.status >= 300) throw new Error('scanner: HTTP ' + resp.status);
        if (json && (json.infected === true || json.clean === false || json.valid === false || json.malware === true)) return threatResult(json.threat || json.virus || json.name);
        return true;
    };
}

/** Runs several scanners one after another; the first threat wins, an error from any of them rejects. */
function all() {
    const list = Array.prototype.slice.call(arguments).filter(Boolean);
    return async function scanWithAll(file, ctx) {
        for (const s of list) { const r = await s(file, ctx); if (r !== true && !(r && r.valid !== false)) return r; }
        return true;
    };
}

module.exports = { clamav, virustotal, httpScanner, all };
