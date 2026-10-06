/*!
 * FileValidator upload add-on v1.1.0 — send a validated file: progress, cancel, retry, direct-to-storage and resumable (tus) uploads, and a queue that waits offline.
 *
 *   const up = FileValidator.upload(file, { url: '/upload', onProgress: p => bar.value = p.percent, retries: 3 });
 *   up.abort();                                  // cancel
 *   const { status, body } = await up;           // resolves with the response, rejects with an UploadError (code, status, response)
 *
 *   // straight to S3 / GCS / Azure with a URL your server signed for this one file
 *   FileValidator.upload(file, { presign: async f => ({ url: await getSignedUrl(f.name, f.type), method: 'PUT', headers: { 'Content-Type': f.type } }) });
 *   // ... or a presigned POST policy:  presign: async f => ({ url, method: 'POST', fields: { key, policy, 'x-amz-signature' }, fileField: 'file' })
 *
 *   // big files over a bad connection: resumable, in chunks (the tus protocol: tusd, @tus/server, Uppy's tus, Cloudflare, Vimeo ...)
 *   const t = FileValidator.upload(file, { tus: { endpoint: '/files/', chunkSize: 5 * 1024 * 1024 } });
 *   t.pause(); t.resume();                       // also survives a closed tab: the same file continues where it stopped
 *
 *   // many files, flaky wifi: waits while offline, carries on when the connection is back, notices a file that changed or vanished
 *   const q = FileValidator.uploadQueue({ url: '/upload', concurrency: 2, onChange: (item) => render(item) });   // item.status: queued | uploading | offline | retrying | done | failed | changed
 *   const item = q.add(file);  await item.promise;  item.replace(newFile);  q.retryFailed();
 *
 * Works in the browser (XMLHttpRequest for real upload progress, fetch when there is none) and in Node 18+ (fetch). Validate first with FileValidator.validateFile().
 *
 * Changelog
 *   1.1.0  uploadQueue(): concurrency, waits offline (not counted as a failure), FILE_CHANGED / FILE_UNREADABLE detection with replace(), retryFailed().
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['./fileValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, root.FileValidator || require('./fileValidator.js'));
    else factory(root, root.FileValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';
    if (!FV) throw new Error('fileValidator.upload.js needs FileValidator loaded first');

    const isFn = f => typeof f === 'function';
    const sleep = (ms, signal) => new Promise((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(abortError()); }, { once: true });
    });

    /** What an upload rejects with. code: 'ABORTED' | 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'PROTOCOL'; status and response are set for HTTP errors. */
    class UploadError extends Error {
        constructor(code, message, extra) {
            super(message);
            this.name = 'UploadError';
            this.code = code;
            if (extra) Object.assign(this, extra);
        }
        get aborted() { return this.code === 'ABORTED'; }
    }
    const abortError = () => new UploadError('ABORTED', 'The upload was cancelled.');

    // ---------------------------------------------------------------- one request: XMLHttpRequest (upload progress) or fetch
    function send(method, url, o) {
        const headers = Object.assign({}, o.headers);
        const canXhr = typeof root.XMLHttpRequest === 'function' && !o.forceFetch;
        if (o.signal && o.signal.aborted) return Promise.reject(abortError());
        if (canXhr) {
            return new Promise((resolve, reject) => {
                const xhr = new root.XMLHttpRequest();
                xhr.open(method, url, true);
                Object.keys(headers).forEach(k => xhr.setRequestHeader(k, headers[k]));
                xhr.withCredentials = !!o.withCredentials;
                if (o.timeout) xhr.timeout = o.timeout;
                if (xhr.upload && isFn(o.onProgress)) xhr.upload.onprogress = e => o.onProgress(e.loaded, e.lengthComputable ? e.total : (o.size || 0));
                const onAbort = () => { try { xhr.abort(); } catch (e) { /* done already */ } };
                if (o.signal) o.signal.addEventListener('abort', onAbort, { once: true });
                const done = fn => v => { if (o.signal) o.signal.removeEventListener('abort', onAbort); fn(v); };
                xhr.onload = done(() => {
                    const h = {};
                    String(xhr.getAllResponseHeaders() || '').trim().split(/[\r\n]+/).forEach(line => { const i = line.indexOf(':'); if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); });
                    resolve({ status: xhr.status, headers: h, text: xhr.responseText || '' });
                });
                xhr.onerror = done(() => reject(new UploadError('NETWORK', 'Network error.')));
                xhr.ontimeout = done(() => reject(new UploadError('TIMEOUT', 'The upload timed out.')));
                xhr.onabort = done(() => reject(abortError()));
                xhr.send(o.body === undefined ? null : o.body);
            });
        }
        const doFetch = o.fetch || (typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
        if (!doFetch) return Promise.reject(new UploadError('NETWORK', 'No XMLHttpRequest or fetch available.'));
        const ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
        let timer = null, timedOut = false;
        if (o.timeout && ctrl) timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, o.timeout);
        const onAbort = () => ctrl && ctrl.abort();
        if (o.signal) o.signal.addEventListener('abort', onAbort, { once: true });
        if (isFn(o.onProgress)) o.onProgress(0, o.size || 0);   // fetch cannot report upload progress: start and end only
        return doFetch(url, { method, headers, body: o.body, credentials: o.withCredentials ? 'include' : 'same-origin', signal: ctrl ? ctrl.signal : undefined, duplex: 'half' }).then(async resp => {
            const h = {};
            if (resp.headers && isFn(resp.headers.forEach)) resp.headers.forEach((v, k) => { h[String(k).toLowerCase()] = v; });
            const text = await resp.text();
            if (isFn(o.onProgress)) o.onProgress(o.size || 0, o.size || 0);
            return { status: resp.status, headers: h, text };
        }, e => {
            if (timedOut) throw new UploadError('TIMEOUT', 'The upload timed out.');
            if (e && e.name === 'AbortError') throw abortError();
            throw new UploadError('NETWORK', (e && e.message) || 'Network error.');
        }).finally(() => { if (timer) clearTimeout(timer); if (o.signal) o.signal.removeEventListener('abort', onAbort); });
    }

    const parseBody = (text, type) => { if (type === 'text') return text; try { return text === '' ? null : JSON.parse(text); } catch (e) { return type === 'json' ? text : text; } };
    const retryable = e => !!e && (e.code === 'NETWORK' || e.code === 'TIMEOUT' || (e.code === 'HTTP' && (e.status === 408 || e.status === 409 || e.status === 423 || e.status === 429 || e.status >= 500)));
    /** Runs `attempt` again after network trouble, 408 / 429 / 5xx, with exponential backoff and jitter (Retry-After is honoured). */
    async function withRetry(attempt, o, signal) {
        const max = typeof o.retries === 'number' ? o.retries : 3;
        for (let n = 0; ; n++) {
            try { return await attempt(n); }
            catch (e) {
                const should = isFn(o.retryOn) ? o.retryOn(e, n) : retryable(e);
                if (!e || e.aborted || n >= max || !should) throw e;
                const ra = e.response && e.response.headers && Number(e.response.headers['retry-after']);
                const base = typeof o.retryDelayMs === 'number' ? o.retryDelayMs : 1000;
                const wait = ra && isFinite(ra) ? Math.min(ra * 1000, 60000) : Math.min(base * Math.pow(2, n), 30000) * (0.75 + Math.random() * 0.5);
                if (isFn(o.onRetry)) o.onRetry({ attempt: n + 1, delayMs: wait, error: e });
                await sleep(wait, signal);
            }
        }
    }
    const httpError = resp => new UploadError('HTTP', 'The server answered ' + resp.status + '.', { status: resp.status, response: resp });
    const progressObj = (loaded, total) => ({ loaded, total, percent: total > 0 ? Math.min(100, Math.round(loaded / total * 1000) / 10) : 0 });

    // ---------------------------------------------------------------- a plain upload (multipart POST, raw PUT, or what a presigned URL asks for)
    async function plain(file, o, signal, report) {
        let target = { url: o.url, method: o.method, headers: o.headers, fields: o.fields, fileField: o.fieldName };
        if (isFn(o.presign)) target = Object.assign({ method: 'PUT' }, await o.presign(file));
        if (!target.url) throw new UploadError('PROTOCOL', 'upload: url (or presign) is required.');
        const method = String(target.method || 'POST').toUpperCase();
        let headers = Object.assign({}, typeof target.headers === 'function' ? target.headers(file) : target.headers);
        let body;
        const wantsForm = method !== 'PUT' && o.raw !== true;
        if (wantsForm) {
            body = new root.FormData();
            Object.keys(target.fields || {}).forEach(k => body.append(k, target.fields[k]));   // policy fields come before the file (S3 requires it)
            body.append(target.fileField || 'file', file, file.name);
        } else {
            body = file;
            if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type') && file.type) headers['Content-Type'] = file.type;
        }
        const resp = await send(method, target.url, { headers, body, signal, withCredentials: o.withCredentials, timeout: o.timeout, size: file.size, fetch: o.fetch, forceFetch: o.forceFetch, onProgress: (l, t) => report(l, t || file.size) });
        if (resp.status < 200 || resp.status >= 300) throw httpError(resp);
        return { status: resp.status, headers: resp.headers, body: parseBody(resp.text, o.responseType), response: resp, url: target.url };
    }

    // ---------------------------------------------------------------- tus 1.0.0 (https://tus.io): create, resume with HEAD, PATCH in chunks
    const TUS = '1.0.0';
    const b64 = s => { try { return root.btoa(unescape(encodeURIComponent(s))); } catch (e) { return Buffer.from(String(s), 'utf8').toString('base64'); } };
    function tusStore(o) {
        try { const s = o.storage === 'local' ? root.localStorage : (o.storage === false ? null : root.localStorage); return s && isFn(s.getItem) ? s : null; } catch (e) { return null; }
    }
    const fingerprint = (file, o) => ['fv-tus', o.endpoint, file.name, file.size, file.lastModified || 0, file.type || ''].join(':');
    function tusTask(file, o, signal, report, ctl) {
        const t = o.tus;
        const chunkSize = Math.max(64 * 1024, typeof t.chunkSize === 'number' ? t.chunkSize : 5 * 1024 * 1024);
        const store = t.resume === false ? null : tusStore(t);
        const key = fingerprint(file, t);
        const hdr = extra => Object.assign({ 'Tus-Resumable': TUS }, typeof t.headers === 'function' ? t.headers(file) : t.headers, extra);
        const common = { withCredentials: t.withCredentials || o.withCredentials, timeout: t.timeout || o.timeout, fetch: o.fetch, forceFetch: o.forceFetch };
        const abs = (loc, base) => { try { return new URL(loc, base).href; } catch (e) { return loc; } };
        const retryOpts = Object.assign({}, o, t);
        let location = ctl.location || (store && store.getItem(key)) || null;   // ctl.location: the same session after a pause

        async function create() {
            const meta = Object.assign({ filename: file.name, filetype: file.type || 'application/octet-stream' }, t.metadata);
            const metadata = Object.keys(meta).filter(k => meta[k] !== undefined && meta[k] !== null).map(k => k + ' ' + b64(String(meta[k]))).join(',');
            const resp = await send('POST', t.endpoint, Object.assign({ headers: hdr({ 'Upload-Length': String(file.size), 'Upload-Metadata': metadata }), signal }, common));
            if (resp.status !== 201) throw resp.status === 413 ? Object.assign(httpError(resp), { response: resp }) : httpError(resp);
            const loc = resp.headers.location;
            if (!loc) throw new UploadError('PROTOCOL', 'The tus server answered 201 without a Location header.', { response: resp });
            location = abs(loc, t.endpoint); ctl.location = location;
            if (store) { try { store.setItem(key, location); } catch (e) { /* storage full */ } }
        }
        /** Where does the server stand? Returns the offset, or null when the upload is gone (a new one is created). */
        async function offsetFromServer() {
            const resp = await send('HEAD', location, Object.assign({ headers: hdr(), signal }, common));
            if (resp.status === 404 || resp.status === 410 || resp.status === 403) { if (store) { try { store.removeItem(key); } catch (e) { /* */ } } location = null; ctl.location = null; return null; }
            if (resp.status < 200 || resp.status >= 300) throw httpError(resp);
            const off = parseInt(resp.headers['upload-offset'], 10);
            if (!isFinite(off)) throw new UploadError('PROTOCOL', 'The tus server did not answer an Upload-Offset.', { response: resp });
            const len = parseInt(resp.headers['upload-length'], 10);
            if (isFinite(len) && len !== file.size) { if (store) { try { store.removeItem(key); } catch (e) { /* */ } } location = null; ctl.location = null; return null; }   // a different file under that name
            return off;
        }
        async function run() {
            let offset = 0;
            if (location) { offset = await withRetry(() => offsetFromServer(), retryOpts, signal); if (offset === null) offset = 0; }
            if (!location) { await withRetry(() => create(), retryOpts, signal); offset = 0; }
            report(offset, file.size);
            if (file.size === 0) { if (store) { try { store.removeItem(key); } catch (e) { /* */ } } return { status: 201, headers: {}, body: null, url: location, offset: 0, size: 0 }; }
            while (offset < file.size) {
                const end = Math.min(file.size, offset + chunkSize), start = offset;
                const chunk = file.slice(start, end);
                const attemptChunk = async () => {
                    const resp = await send('PATCH', location, Object.assign({ headers: hdr({ 'Upload-Offset': String(start), 'Content-Type': 'application/offset+octet-stream' }), body: chunk, signal, size: end - start,
                        onProgress: (l) => report(start + Math.min(l, end - start), file.size) }, common));
                    if (resp.status === 409) {   // the server is at another offset: ask it
                        const o2 = await offsetFromServer();
                        throw Object.assign(new UploadError('HTTP', 'Offset mismatch.', { status: 409, response: resp }), { resumeAt: o2 });
                    }
                    if (resp.status !== 204 && resp.status !== 200) throw httpError(resp);
                    const next = parseInt(resp.headers['upload-offset'], 10);
                    if (!isFinite(next)) throw new UploadError('PROTOCOL', 'The tus server did not answer an Upload-Offset.', { response: resp });
                    return next;
                };
                try {
                    offset = await withRetry(attemptChunk, Object.assign({}, retryOpts, { retryOn: e => (e.code === 'HTTP' && e.status === 409) || retryable(e) }), signal);
                } catch (e) {
                    if (e && e.status === 409 && typeof e.resumeAt === 'number') { offset = e.resumeAt; continue; }
                    throw e;
                }
                report(offset, file.size);
                if (isFn(t.onChunkComplete)) t.onChunkComplete(end - start, offset, file.size);
            }
            if (store) { try { store.removeItem(key); } catch (e) { /* */ } }
            return { status: 204, headers: {}, body: null, url: location, offset, size: file.size };
        }
        return run();
    }

    /**
     * FileValidator.upload(file, options) -> a Promise with abort() (and pause() / resume() for tus). Resolves to { status, body, headers, url, response }, rejects with an UploadError.
     * options: url, method ('POST'), fieldName ('file'), fields (extra form fields), headers (object or function(file)), withCredentials, timeout (ms), responseType ('json' | 'text'),
     *   onProgress({ loaded, total, percent }), signal (an AbortSignal), retries (3), retryDelayMs (1000), retryOn(error, attempt), onRetry({ attempt, delayMs, error }),
     *   presign (async file -> { url, method: 'PUT' | 'POST', headers, fields, fileField }), raw (true: send the file as the body even for POST),
     *   tus ({ endpoint, chunkSize, headers, metadata, resume: true, storage: 'local', onChunkComplete }), fetch (your own), validate (a FileValidator config: the file is checked first).
     */
    function upload(file, options) {
        const o = options || {};
        const state = { paused: false, cancelled: false, resumeWaiters: [], current: null, location: null };
        const external = o.signal;
        const cancel = () => { state.cancelled = true; state.paused = false; state.resumeWaiters.splice(0).forEach(r => r()); if (state.current) state.current.abort(); };
        if (external) { if (external.aborted) state.cancelled = true; else external.addEventListener('abort', cancel, { once: true }); }
        const report = (loaded, total) => { if (isFn(o.onProgress)) { try { o.onProgress(progressObj(loaded, total)); } catch (e) { /* your callback must not break the upload */ } } };
        const run = async () => {
            if (!file || typeof file.size !== 'number') throw new UploadError('PROTOCOL', 'upload: pass a File.');
            if (o.validate) {
                const v = await FV.validateFile(file, o.validate);
                if (!v.isValid) throw new UploadError('INVALID', 'The file did not pass validation: ' + (v.errors || []).join(', '), { errors: v.errors, messages: v.messages });
            }
            for (;;) {
                if (state.cancelled) throw abortError();
                // one controller per run: pausing aborts the request in flight, resuming starts a new run from where the server says it is
                const ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
                state.current = ctrl;
                const signal = ctrl ? ctrl.signal : undefined;
                try {
                    if (o.tus && o.tus.endpoint) return await tusTask(file, o, signal, report, state);
                    return await withRetry(() => plain(file, o, signal, report), o, signal);
                } catch (e) {
                    if (e && e.aborted && state.paused && !state.cancelled) {
                        await new Promise(r => state.resumeWaiters.push(r));
                        continue;
                    }
                    throw e;
                } finally { state.current = null; }
            }
        };
        const promise = new Promise((resolve, reject) => { Promise.resolve().then(run).then(resolve, reject); });
        promise.abort = cancel;
        promise.pause = () => { if (!(o.tus && o.tus.endpoint)) throw new Error('upload.pause: only tus uploads can be paused'); if (state.cancelled) return; state.paused = true; if (state.current) state.current.abort(); };
        promise.resume = () => { state.paused = false; state.resumeWaiters.splice(0).forEach(r => r()); };
        return promise;
    }
    // ---------------------------------------------------------------- the upload queue: offline waiting, retries, "the file changed on disk"
    const isOnline = () => !(root.navigator && root.navigator.onLine === false);
    /** Throws UploadError FILE_CHANGED (size / date differ from when it was queued) or FILE_UNREADABLE (it was moved, deleted or locked). */
    async function checkFileStillThere(file, snap) {
        if (file.size !== snap.size || (file.lastModified || 0) !== snap.lastModified) throw new UploadError('FILE_CHANGED', 'The file "' + (file.name || '') + '" changed after it was chosen. Choose it again.');
        if (isFn(file.slice) && file.size > 0) {
            try { await file.slice(0, 1).arrayBuffer(); }
            catch (e) { throw new UploadError('FILE_UNREADABLE', 'The file "' + (file.name || '') + '" cannot be read any more (moved, deleted or locked). Choose it again.'); }
        }
    }
    /**
     * FileValidator.uploadQueue(options) -> { add(file, overrides), items, pause(), resume(), retryFailed(), clear(), abortAll(), whenIdle(), destroy() }.
     * Several uploads with a limit, that wait while the device is offline and carry on when it is back, retry with backoff, and notice a file that changed or vanished.
     * options: every upload() option (url, headers, tus, presign, ...) plus concurrency (2), retries (3, only counts real failures; waiting offline is free),
     *   onChange(item, items), isOnline() (default navigator.onLine), onlineEvent (target with online / offline events, default window), checkFile (true).
     * An item: { id, file, status, progress, error, result, promise, abort(), retry(), replace(newFile) }.
     *   status: 'queued' | 'uploading' | 'offline' | 'retrying' | 'done' | 'failed' | 'aborted' | 'changed' (the file changed or vanished: replace() it, then it is queued again).
     */
    function uploadQueue(options) {
        const o = options || {};
        const limit = Math.max(1, typeof o.concurrency === 'number' ? Math.floor(o.concurrency) : 2);
        const online = isFn(o.isOnline) ? o.isOnline : isOnline;
        const target = o.onlineEvent || (typeof root.addEventListener === 'function' ? root : null);
        const items = [];
        let paused = false, destroyed = false, seq = 0, running = 0;
        const idle = [];
        const waitingOnline = new Set();
        const wake = () => { if (online()) Array.from(waitingOnline).forEach(f => { waitingOnline.delete(f); f(); }); pump(); };
        const onOnline = () => wake();
        if (target && isFn(target.addEventListener)) { target.addEventListener('online', onOnline); }

        const emit = it => { if (isFn(o.onChange)) { try { o.onChange(it, items.slice()); } catch (e) { /* your callback must not break the queue */ } } };
        const setStatus = (it, status, extra) => { it.status = status; if (extra) Object.assign(it, extra); emit(it); };
        const checkIdle = () => { if (!items.some(it => it.status === 'queued' || it.status === 'uploading' || it.status === 'offline' || it.status === 'retrying')) idle.splice(0).forEach(r => r(items.slice())); };

        function waitForOnline(it) {
            return new Promise((resolve, reject) => {
                const go = () => { it._reject = null; resolve(); };
                it._reject = reject;
                waitingOnline.add(go);
            });
        }
        async function process(it) {
            const snap = { size: it.file.size, lastModified: it.file.lastModified || 0 };
            let failures = 0;
            const max = typeof o.retries === 'number' ? o.retries : 3;
            for (;;) {
                if (it._aborted) throw abortError();
                if (!online()) { setStatus(it, 'offline'); await waitForOnline(it); if (it._aborted) throw abortError(); }
                if (o.checkFile !== false) await checkFileStillThere(it.file, snap);
                setStatus(it, 'uploading');
                const opts = Object.assign({}, o, it._overrides, { retries: 0, onRetry: undefined, concurrency: undefined, onChange: undefined, isOnline: undefined, onlineEvent: undefined, checkFile: undefined });
                const userProgress = (it._overrides && it._overrides.onProgress) || o.onProgress;
                opts.onProgress = p => { it.progress = p; if (isFn(userProgress)) userProgress(p, it); emit(it); };
                const task = upload(it.file, opts);
                it._task = task;
                try { return await task; }
                catch (e) {
                    if (e && e.aborted) throw e;
                    if (o.checkFile !== false && e && (e.code === 'NETWORK' || e.code === 'TIMEOUT')) await checkFileStillThere(it.file, snap);   // a vanished file looks like a network error to the browser
                    const should = isFn(o.retryOn) ? o.retryOn(e, failures) : retryable(e);
                    if (!should) throw e;
                    if (e.code === 'NETWORK' && !online()) continue;           // offline: wait for the connection, this is not a failed attempt
                    if (failures >= max) throw e;
                    const ra = e.response && e.response.headers && Number(e.response.headers['retry-after']);
                    const base = typeof o.retryDelayMs === 'number' ? o.retryDelayMs : 1000;
                    const wait = ra && isFinite(ra) ? Math.min(ra * 1000, 60000) : Math.min(base * Math.pow(2, failures), 30000) * (0.75 + Math.random() * 0.5);
                    failures++;
                    if (isFn(o.onRetry)) o.onRetry({ attempt: failures, delayMs: wait, error: e, item: it });
                    setStatus(it, 'retrying', { error: e });
                    await new Promise((res, rej) => { const t = setTimeout(res, wait); it._reject = err => { clearTimeout(t); rej(err); }; });
                    it._reject = null;
                } finally { it._task = null; }
            }
        }
        function start(it) {
            running++;
            it._settle = null;
            process(it).then(result => { setStatus(it, 'done', { result, error: null }); it._done(result); },
                e => {
                    const status = e && e.aborted ? 'aborted' : (e && (e.code === 'FILE_CHANGED' || e.code === 'FILE_UNREADABLE')) ? 'changed' : 'failed';
                    setStatus(it, status, { error: e });
                    it._fail(e);
                }).then(() => { running--; pump(); checkIdle(); });
        }
        function pump() {
            if (paused || destroyed) return;
            for (const it of items) { if (running >= limit) break; if (it.status === 'queued') start(it); }
        }
        function arm(it) {
            it.promise = new Promise((resolve, reject) => { it._done = resolve; it._fail = reject; });
            it.promise.catch(() => { /* a rejected item is reported through status and error; await item.promise yourself to handle it */ });
        }
        function add(file, overrides) {
            if (destroyed) throw new Error('uploadQueue: destroyed');
            if (!file || typeof file.size !== 'number') throw new UploadError('PROTOCOL', 'uploadQueue.add: pass a File.');
            const it = { id: ++seq, file, status: 'queued', progress: null, error: null, result: null, promise: null, _overrides: overrides || {}, _aborted: false, _task: null, _reject: null };
            it.abort = () => {
                if (['done', 'failed', 'aborted', 'changed'].indexOf(it.status) >= 0) return;
                it._aborted = true;
                if (it._task) it._task.abort();
                if (it._reject) it._reject(abortError());
                if (it.status === 'queued') { setStatus(it, 'aborted', { error: abortError() }); it._fail(it.error); checkIdle(); }
            };
            it.retry = () => {
                if (it.status !== 'failed' && it.status !== 'aborted' && it.status !== 'changed') return false;
                it._aborted = false; arm(it); setStatus(it, 'queued', { error: null, progress: null }); pump(); return true;
            };
            it.replace = newFile => {            // the person picked the file again after it changed: same slot, new content
                if (!newFile || typeof newFile.size !== 'number') throw new UploadError('PROTOCOL', 'replace: pass a File.');
                if (it.status === 'uploading' || it.status === 'offline' || it.status === 'retrying') { it._aborted = true; if (it._task) it._task.abort(); if (it._reject) it._reject(abortError()); }
                it.file = newFile; it._aborted = false;
                if (['failed', 'aborted', 'changed'].indexOf(it.status) >= 0) { arm(it); setStatus(it, 'queued', { error: null, progress: null }); pump(); }
                return it;
            };
            arm(it);
            items.push(it);
            emit(it);
            pump();
            return it;
        }
        return {
            add, items,
            pause() { paused = true; },
            resume() { paused = false; pump(); },
            retryFailed() { return items.filter(it => it.retry()).length; },
            abortAll() { items.slice().forEach(it => it.abort()); },
            clear() { for (let i = items.length - 1; i >= 0; i--) if (['done', 'failed', 'aborted', 'changed'].indexOf(items[i].status) >= 0) items.splice(i, 1); },
            whenIdle() { return new Promise(res => { idle.push(res); checkIdle(); }); },
            get online() { return online(); },
            destroy() { destroyed = true; this.abortAll(); if (target && isFn(target.removeEventListener)) { target.removeEventListener('online', onOnline); } waitingOnline.clear(); }
        };
    }
    uploadQueue.checkFile = checkFileStillThere;

    upload.UploadError = UploadError;

    FV.upload = upload;
    FV.uploadQueue = uploadQueue;
    FV.UploadError = UploadError;
    return upload;
});
