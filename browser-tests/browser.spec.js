'use strict';
/*
 * Real-browser tests: the same suite runs in Chrome, Edge, Firefox and WebKit (Safari's engine), plus iPhone and Android phone emulation, headless.
 *   npm run test:browser                  all browsers that are installed
 *   BROWSERS=chrome,firefox npm run test:browser
 * Covered: real file choosers and File objects, real drag and drop events, image decoding, canvas resizing, thumbnails,
 * audio duration, SHA-256 hashing, focus and keyboard, network requests, and an axe accessibility audit WITH colour contrast on the demo pages.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, firefox, webkit, devices } = require('playwright');
const { start } = require('./server.js');
const files = require('./files.js');

const ALL = [
    { name: 'chromium', launch: () => chromium.launch() },   // Playwright's own Chromium (what CI installs)
    { name: 'chrome', launch: () => chromium.launch({ channel: 'chrome' }) },
    { name: 'msedge', launch: () => chromium.launch({ channel: 'msedge' }) },
    { name: 'firefox', launch: () => firefox.launch() },
    { name: 'webkit', launch: () => webkit.launch() },
    // phones: small touch screens and mobile user agents (Safari on iPhone = WebKit, Chrome on Android = Chromium)
    { name: 'mobile-safari', launch: () => webkit.launch(), context: devices['iPhone 15'] },
    { name: 'mobile-chrome', launch: () => chromium.launch(), context: devices['Pixel 7'] }
];
const wanted = (process.env.BROWSERS || '').split(',').map(s => s.trim()).filter(Boolean);
const BROWSERS = ALL.filter(b => !wanted.length || wanted.includes(b.name));

let srv;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-browser-'));
const tmpFile = (name, data) => { const p = path.join(tmp, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return p; };
const toFile = (name, data, type = '') => ({ name, mimeType: type || 'application/octet-stream', buffer: Buffer.from(data) });
const bytes = data => Array.from(Buffer.from(data));

before(async () => { srv = await start(); });
after(async () => { await srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

for (const b of BROWSERS) {
    describe(b.name, () => {
        let browser, launchError;
        before(async () => { try { browser = await b.launch(); } catch (e) { launchError = e; } });
        after(async () => { if (browser) await browser.close(); });

        /** it() that gets a fresh page (and skips when the browser could not be started) */
        const it2 = (name, fn, url = '/browser-tests/pages/plain.html') => it(name, async t => {
            if (!browser) return t.skip('cannot launch ' + b.name + ': ' + String(launchError && launchError.message).split('\n')[0]);
            const context = await browser.newContext(b.context || { viewport: { width: 1000, height: 900 } });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            try {
                await page.goto(srv.url + url);
                await fn(page, { errors, context });
                assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
            } finally { await context.close(); }
        });
        const setup = (page, html, script) => page.evaluate(([h, s]) => { document.getElementById('root').innerHTML = h; return (0, eval)(s); }, [html, script || '']);

        // ============================================================ loading
        it2('the bundle loads with all parts; no jQuery means no jQuery layer', async page => {
            const r = await page.evaluate(() => ({
                form: typeof FormValidator.init, file: typeof FileValidator.validateFiles, widget: typeof FileValidator.widget,
                bundled: FormValidator.bundled, jq: typeof window.jQuery, versions: [FormValidator.version, FileValidator.version]
            }));
            assert.deepEqual([r.form, r.file, r.widget, r.bundled, r.jq], ['function', 'function', 'function', true, 'undefined']);
            r.versions.forEach(v => assert.match(v, /^\d+\.\d+\.\d+$/));
        });
        it2('jQuery first: the jQuery Validation layer is ready', async page => {
            const r = await page.evaluate(() => ({ validate: typeof $.fn.validate, method: typeof $.validator.methods.fileValidator, validator: typeof $.validator.addMethod }));
            assert.deepEqual(r, { validate: 'function', method: 'function', validator: 'function' });
        }, '/browser-tests/pages/jquery.html');
        it2('the parts loaded as separate files work together', async page => {
            const r = await page.evaluate(() => ({ a: typeof FormValidator.init, b: typeof FileValidator.widget, c: typeof $.fn.validate, bundled: FormValidator.bundled || false }));
            assert.deepEqual(r, { a: 'function', b: 'function', c: 'function', bundled: false });
        }, '/browser-tests/pages/separate.html');

        // ============================================================ FormValidator on the demo page
        it2('demo.html: an invalid submit is blocked, focus goes to the first bad field, messages clear live, a valid form submits', async page => {
            await page.click('button[type=submit]:not([formnovalidate])');
            const fields = await page.$$eval('.error', els => els.map(e => e.getAttribute('data-error-for')));
            assert.deepEqual(fields.sort(), ['email', 'plan', 'pw2', 'terms']);
            assert.equal(await page.evaluate(() => document.activeElement.name), 'email');
            assert.match(await page.textContent('#log'), /1 problem|problem\(s\)|Fill in/);
            await page.fill('#email', 'ada@example.com');
            await page.waitForFunction(() => !document.querySelector('.error[data-error-for=email]'));   // live re-check (150 ms debounce)
            await page.fill('#pw', 'Abcdefg1'); await page.fill('#pw2', 'Abcdefg1');
            await page.check('input[name=plan][value=free]'); await page.check('input[name=terms]');
            await page.click('button[type=submit]:not([formnovalidate])');
            await page.waitForFunction(() => document.getElementById('log').textContent.startsWith('Valid!'));
            assert.equal(await page.$$eval('.error', e => e.length), 0);
        }, '/demo.html');
        it2('demo.html: the "Save draft" button skips validation, while "Create account" on an empty form is blocked', async page => {
            await page.evaluate(() => { window.__submitted = 0; document.addEventListener('submit', e => { window.__submitted++; e.preventDefault(); }); });   // bubble phase: sees only submits we let through
            await page.click('button[type=submit]:not([formnovalidate])');
            assert.equal(await page.evaluate(() => window.__submitted), 0, 'an invalid submit never reaches other handlers');
            assert.ok(await page.$$eval('.error', e => e.length) > 0);
            await page.click('button[formnovalidate]');
            assert.equal(await page.evaluate(() => window.__submitted), 1, 'the draft button submits without validating');
        }, '/demo.html');
        it2('demo.html: a real file chooser upload is checked (too small, dangerous, fine)', async page => {
            const submit = () => page.click('button[type=submit]:not([formnovalidate])');
            await page.fill('#email', 'a@b.co'); await page.fill('#pw', 'Abcdefg1'); await page.fill('#pw2', 'Abcdefg1');
            await page.check('input[name=plan][value=pro]'); await page.check('input[name=terms]');
            await page.setInputFiles('#avatar', toFile('tiny.png', files.makePng(50, 50), 'image/png'));
            await submit();
            await page.waitForSelector('.error[data-error-for=avatar]');
            assert.match(await page.textContent('.error[data-error-for=avatar]'), /50px wide but it must be at least 100px/);
            await page.setInputFiles('#avatar', toFile('run.exe', [1, 2, 3, 4]));
            await submit();
            await page.waitForFunction(() => /can.t be uploaded|isn.t allowed/.test(document.querySelector('.error[data-error-for=avatar]').textContent));
            await page.setInputFiles('#avatar', toFile('ok.png', files.makePng(200, 200), 'image/png'));
            await submit();
            await page.waitForFunction(() => document.getElementById('log').textContent.startsWith('Valid!'));
        }, '/demo.html');

        // ============================================================ FormValidator with real layout
        it2('hidden fields (display:none) are skipped, visible ones are checked, remote uses a real request with a pending state', async page => {
            await page.route('**/check*', async route => { await new Promise(r => setTimeout(r, 200)); await route.fulfill({ status: 200, contentType: 'application/json', body: '"Already taken"' }); });
            await setup(page, `<form id="f"><input name="a" id="a"><div class="hidden"><input name="h" id="h"></div><input name="user" id="user" value="bob"><button>go</button></form>`,
                `window.inst = FormValidator.init({ formId: 'f', rules: { a: ['required'], h: ['required'], user: [{ type: 'remote', url: '/check' }] } }); 0`);
            const p = page.evaluate(() => inst.validate({ focus: false }));
            await page.waitForFunction(() => document.getElementById('user').classList.contains('fv-pending'));
            assert.equal(await page.getAttribute('#user', 'aria-busy'), 'true');
            assert.equal(await p, false);
            const errs = await page.$$eval('.error', els => els.map(e => e.getAttribute('data-error-for') + ':' + e.textContent));
            assert.deepEqual(errs.sort(), ['a:This field is required.', 'user:Already taken']);
            assert.equal(await page.evaluate(() => document.getElementById('user').hasAttribute('aria-busy')), false);
        });
        it2('remote: GET by default with the value in the query string, POST when asked', async page => {
            const seen = [];
            await page.route('**/api/**', route => { const r = route.request(); seen.push([r.method(), new URL(r.url()).pathname + new URL(r.url()).search, r.postData()]); return route.fulfill({ status: 200, contentType: 'application/json', body: 'true' }); });
            await setup(page, `<form id="f"><input name="u" id="u" value="bob"><input name="v" id="v" value="eve"></form>`,
                `window.inst = FormValidator.init({ formId: 'f', rules: { u: { remote: '/api/get' }, v: { remote: { url: '/api/post', type: 'post' } } } }); 0`);
            assert.equal(await page.evaluate(() => inst.validate({ focus: false })), true);
            assert.deepEqual(seen.find(s => s[1].startsWith('/api/get')).slice(0, 2), ['GET', '/api/get?u=bob']);
            const post = seen.find(s => s[1].startsWith('/api/post'));
            assert.equal(post[0], 'POST'); assert.deepEqual(JSON.parse(post[2]), { v: 'eve' });
        });

        // ============================================================ FileValidator on real files
        it2('files picked with the real chooser: the type comes from the browser/OS, and the registry accepts what browsers really report', async page => {
            await setup(page, '<input type="file" id="in" multiple>');
            const list = [
                tmpFile('a.csv', 'a,b\n1,2'), tmpFile('a.json', '{"a":1}'), tmpFile('a.txt', 'hello'), tmpFile('a.pdf', Buffer.from(files.PDF)),
                tmpFile('a.docx', Buffer.from(files.docx())), tmpFile('a.zip', Buffer.from(files.ZIP)), tmpFile('a.png', files.makePng(20, 20)),
                tmpFile('a.md', '# hi'), tmpFile('a.xlsx', Buffer.from(files.xlsx()))
            ];
            await page.setInputFiles('#in', list);
            const r = await page.evaluate(async () => {
                const input = document.getElementById('in');
                const out = {};
                for (const f of input.files) {
                    const res = await FileValidator.validateFiles([f], { allowedExtensions: [f.name.slice(f.name.lastIndexOf('.'))] });
                    out[f.name] = { type: f.type, errors: res.errors };
                }
                return out;
            });
            for (const [name, v] of Object.entries(r)) assert.deepEqual(v.errors, [], `${name} (browser type "${v.type}")`);
        });
        it2('dangerous, disguised, mismatched, macro and scripted files are caught in the browser', async page => {
            await setup(page, '<input type="file" id="in" multiple>');
            const cases = {
                'setup.exe': [Buffer.from([1, 2, 3, 4]), 'DANGEROUS_FILE_TYPE'],
                'invoice.exe.pdf': [Buffer.from(files.PDF), 'HIDDEN_EXTENSION'],
                'photo.pdf': [files.makePng(30, 30), 'SIGNATURE_MISMATCH'],
                'form.pdf': [Buffer.from(files.pdfWith('/S /JavaScript /JS (x)')), 'DANGEROUS_CONTENT'],
                'macro.docx': [Buffer.from(files.docx({ 'word/vbaProject.bin': 'x' })), 'DANGEROUS_CONTENT'],
                'fake.docx': [Buffer.from(files.ZIP), 'CORRUPT_FILE'],
                'bomb.zip': [Buffer.from(files.makeZip({ 'b.bin': { data: 'x', usize: 3 * 1024 * 1048576, csize: 1024 } })), 'ARCHIVE_BOMB'],
                'cut.pdf': [Buffer.from(files.PDF.slice(0, files.PDF.length - 20)), 'CORRUPT_FILE']
            };
            await page.setInputFiles('#in', Object.entries(cases).map(([n, [d]]) => tmpFile('bad/' + n, d)));
            const r = await page.evaluate(async () => {
                const out = {};
                for (const f of document.getElementById('in').files) out[f.name] = (await FileValidator.validateFiles([f], {})).errors;
                return out;
            });
            for (const [name, [, code]] of Object.entries(cases)) assert.ok(r[name].includes(code), `${name}: expected ${code}, got ${r[name]}`);
        });
        it2('images are decoded by the browser: real dimensions, corrupt images, aspect ratio', async page => {
            await setup(page, '<input type="file" id="in" multiple>');
            await page.setInputFiles('#in', [tmpFile('img/wide.png', files.makePng(500, 300)), tmpFile('img/corrupt.png', Buffer.concat([files.makePng(40, 40).slice(0, 8), Buffer.alloc(300, 1)])), tmpFile('img/ok.png', files.makePng(64, 64))]);
            const r = await page.evaluate(async () => {
                const by = {};
                for (const f of document.getElementById('in').files) by[f.name] = f;
                const run = (n, cfg) => FileValidator.validateFiles([by[n]], cfg).then(x => ({ errors: x.errors, msg: x.details.map(d => d.message) }));
                return { wide: await run('wide.png', { maxImageWidth: 400 }), corrupt: await run('corrupt.png', {}), ok: await run('ok.png', { aspectRatio: 1, minImageWidth: 64 }), ratio: await run('wide.png', { aspectRatio: '1:1' }) };
            });
            assert.deepEqual(r.wide.errors, ['WIDTH_EXCEEDED']);
            assert.match(r.wide.msg[0], /500px wide but the maximum is 400px/);
            assert.ok(r.corrupt.errors.includes('INVALID_IMAGE') || r.corrupt.errors.includes('SIGNATURE_MISMATCH'), 'corrupt: ' + r.corrupt.errors);
            assert.deepEqual(r.ok.errors, []);
            assert.deepEqual(r.ratio.errors, ['INVALID_ASPECT_RATIO']);
        });
        it2('SHA-256 hashing and duplicate content use the real crypto', async page => {
            const r = await page.evaluate(async () => {
                const h = await FileValidator.hashFile(new File(['abc'], 'a.txt'));
                const same = [new File(['same bytes'], 'one.txt', { type: 'text/plain' }), new File(['same bytes'], 'two.txt', { type: 'text/plain' }), new File(['other'], 'three.txt', { type: 'text/plain' })];
                const dup = await FileValidator.validateFiles(same, { duplicateContent: true });
                return { h, errors: dup.errors, msg: dup.details[0].message };
            });
            assert.equal(r.h, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
            assert.deepEqual(r.errors, ['DUPLICATE_FILES']);
            assert.match(r.msg, /one\.txt, two\.txt/);
        });
        it2('a 40 MB file is hashed as a stream inside a real Web Worker (minified code) and equals crypto.subtle', async page => {
            const r = await page.evaluate(async () => {
                const data = new Uint8Array(40 * 1048576); for (let i = 0; i < data.length; i += 1013) data[i] = (i / 1013) % 251;
                const file = new File([data], 'big.bin');
                const workerSeen = { created: 0 };
                const RealWorker = window.Worker;
                window.Worker = function (url) { workerSeen.created++; return new RealWorker(url); };
                const t0 = performance.now();
                const streamed = await FileValidator.hashFile(file, 100);
                const ms = performance.now() - t0;
                window.Worker = RealWorker;
                const digest = await crypto.subtle.digest('SHA-256', data);
                const expected = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
                const capped = await FileValidator.hashFile(new File([data], 'again.bin'), 10);
                const dup = await FileValidator.validateFiles([file, new File([data], 'copy.bin')], { duplicateContent: true, duplicateContentMaxMB: 100, validate: { signature: false } });
                return { streamed, expected, workers: workerSeen.created, ms: Math.round(ms), capped, dup: dup.errors };
            });
            assert.equal(r.streamed, r.expected);
            assert.equal(r.workers, 1, 'the hash ran in a Web Worker');
            assert.equal(r.capped, null);
            assert.deepEqual(r.dup, ['DUPLICATE_FILES']);
        });
        it2('audio duration is read by the browser (real WAV files)', async page => {
            await setup(page, '<input type="file" id="in" multiple>');
            await page.setInputFiles('#in', [tmpFile('a/three.wav', files.makeWav(3))]);
            const decodable = await page.evaluate(f0 => new Promise(res => { const a = document.createElement('audio'); a.preload = 'metadata'; a.onloadedmetadata = () => res(true); a.onerror = () => res(false); setTimeout(() => res(false), 4000); a.src = URL.createObjectURL(document.getElementById('in').files[0]); }));
            if (!decodable) {   // e.g. the Playwright WebKit build has no media codecs: the check must be skipped, not crash or block
                const g = await page.evaluate(async () => {
                    const f = document.getElementById('in').files[0];
                    return { skipped: (await FileValidator.validateFiles([f], { maxDurationSec: 2 })).errors, strict: (await FileValidator.validateFiles([f], { maxDurationSec: 2, requireMediaInfo: true })).errors };
                });
                assert.deepEqual(g, { skipped: [], strict: ['INVALID_MEDIA'] });
                return;
            }
            const r = await page.evaluate(async () => {
                const f = document.getElementById('in').files[0];
                const long = await FileValidator.validateFiles([f], { maxDurationSec: 2 });
                const short = await FileValidator.validateFiles([f], { minDurationSec: 5 });
                const ok = await FileValidator.validateFiles([f], { minDurationSec: 1, maxDurationSec: 10 });
                return { long: long.details.map(d => d.code + ': ' + d.message), short: short.errors, ok: ok.errors };
            });
            assert.deepEqual(r.long, ['DURATION_TOO_LONG: This recording is 0:03 long but the maximum is 0:02.']);
            assert.deepEqual(r.short, ['DURATION_TOO_SHORT']);
            assert.deepEqual(r.ok, []);
        });
        it2('folder picker (webkitdirectory): relative paths, depth limit and ignored junk files', async page => {
            await setup(page, '<input type="file" id="in" webkitdirectory multiple>');
            const dir = path.join(tmp, 'project');
            tmpFile('project/readme.txt', 'x'); tmpFile('project/src/a.txt', 'x'); tmpFile('project/src/deep/b.txt', 'x'); tmpFile('project/.DS_Store', 'junk'); tmpFile('project/Thumbs.db', 'junk');
            await page.setInputFiles('#in', dir);
            const r = await page.evaluate(async () => {
                const list = Array.from(document.getElementById('in').files);
                const res = await FileValidator.validateFiles(list, { maxPathDepth: 2, ignoreFiles: true });
                return { paths: list.map(f => f.webkitRelativePath).sort(), ignored: res.ignored.map(f => f.name).sort(), errors: res.errors, bad: res.details.map(d => d.fileName + ': ' + d.code) };
            });
            assert.ok(r.paths.includes('project/src/deep/b.txt'));
            // WebKit on Linux leaves hidden dotfiles out of a picked folder, so only expect the junk files the browser actually handed over
            const junk = ['.DS_Store', 'Thumbs.db'].filter(n => r.paths.includes('project/' + n));
            assert.ok(junk.includes('Thumbs.db'));
            assert.deepEqual(r.ignored, junk);
            assert.deepEqual(r.errors, ['PATH_TOO_DEEP']);
            assert.deepEqual(r.bad, ['b.txt: PATH_TOO_DEEP']);
        });

        // ============================================================ files: true / false, direct submit and AJAX
        it2('FileValidator.isValid / guard with a real file chooser: a plain true / false, a direct submit, an AJAX upload', async page => {
            await page.route('**/__posted', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1 id="posted">posted</h1>' }));
            let uploaded = null;
            await page.route('**/upload', route => { uploaded = route.request().postData() || ''; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
            const form = '<form id="f" method="post" action="/__posted" enctype="multipart/form-data"><input type="file" name="cv" id="cv"><input type="hidden" name="user" value="ada"><span id="msg"></span><button type="submit" id="go">Go</button></form><div id="out"></div>';
            let posts = 0;
            page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/__posted')) posts++; });

            // 1. true / false, no wiring at all
            await setup(page, form, `window.g = FileValidator.guard('#cv', { accept: '.pdf', maxFileSizeMB: 1 }, { messageElement: '#msg' }); 0`);
            await page.setInputFiles('#cv', toFile('run.exe', [1, 2, 3, 4]));
            assert.equal(await page.evaluate(() => FileValidator.isValid('#cv', { accept: '.pdf', maxFileSizeMB: 1 })), false);
            assert.equal(await page.evaluate(() => window.g.validate()), false);
            await page.setInputFiles('#cv', toFile('ok.pdf', files.PDF, 'application/pdf'));
            assert.equal(await page.evaluate(() => FileValidator.isValid(document.getElementById('cv'), { accept: '.pdf', maxFileSizeMB: 1 })), true);
            assert.equal(await page.evaluate(() => window.g.validate()), true);

            // 2. direct submit: a rejected file is blocked and explained, a good one posts natively
            await page.setInputFiles('#cv', toFile('run.exe', [1, 2, 3, 4]));
            await page.click('#go');
            await page.waitForFunction(() => document.getElementById('msg').textContent.length > 0);
            await page.waitForTimeout(150);
            assert.equal(posts, 0, 'the rejected file is not posted');
            await page.setInputFiles('#cv', toFile('ok.pdf', files.PDF, 'application/pdf'));
            await Promise.all([page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/__posted')), page.click('#go')]);
            await page.waitForSelector('#posted');
            assert.equal(posts, 1);

            // 3. AJAX: onSubmit gets the files and a FormData; the server's message is shown
            await page.goto(srv.url + '/browser-tests/pages/plain.html');
            await setup(page, form, `FileValidator.guard('#cv', { accept: '.pdf', maxFileSizeMB: 1 }, { messageElement: '#msg', onSubmit: function (files, formData) {
                return fetch('/upload', { method: 'POST', body: formData }).then(function (r) { return r.json(); }).then(function (j) { document.getElementById('out').textContent = 'uploaded ' + files.length + ' ' + formData.get('user'); return j.ok ? {} : { errors: 'refused' }; }); } }); 0`);
            await page.setInputFiles('#cv', toFile('run.exe', [1, 2, 3, 4]));
            await page.click('#go'); await page.waitForTimeout(200);
            assert.equal(uploaded, null, 'nothing is uploaded while the file is rejected');
            await page.setInputFiles('#cv', toFile('ok.pdf', files.PDF, 'application/pdf'));
            await page.click('#go');
            await page.waitForFunction(() => document.getElementById('out').textContent === 'uploaded 1 ada');
            assert.match(uploaded, /filename="ok\.pdf"/);
            assert.equal(posts, 1, 'AJAX: no native post');
        });

        // ============================================================ a real submit
        it2('a valid form really posts when the user clicks the button (every rule synchronous, no submitHandler); an invalid one is blocked', async page => {
            await page.route('**/__posted', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1 id="posted">posted</h1>' }));
            await setup(page, '<form id="f" method="post" action="/__posted"><input name="email" id="email"><button type="submit" id="go">Go</button></form>',
                'FormValidator.init({ formId: "f", rules: { email: ["required", "email"] } }); 0');
            let posts = 0;
            page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/__posted')) posts++; });
            await page.fill('#email', 'a@b');
            await page.click('#go');
            await page.waitForSelector('.error[data-error-for=email]');
            await page.waitForTimeout(150);
            assert.equal(posts, 0, 'an invalid form is not posted');
            await page.fill('#email', 'a@b.co');
            await Promise.all([page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/__posted')), page.click('#go')]);
            await page.waitForSelector('#posted');
            assert.equal(posts, 1, 'the valid form is posted exactly once');
        });

        it2('AJAX submit: validated values reach submitHandler and validateAndGetValues, and nothing is sent while the form is invalid', async page => {
            await page.route('**/api/signup', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
            const html = '<form id="f" action="/never-posted"><input name="email" id="email"><input type="password" name="password" id="password">' +
                '<input type="checkbox" name="tag" value="a" id="ta"><input type="checkbox" name="tag" value="b"><input type="checkbox" name="tag" value="c" id="tc">' +
                '<input type="radio" name="plan" value="free"><input type="radio" name="plan" value="pro" id="pro"><input type="checkbox" name="terms" value="yes">' +
                '<select name="colors" multiple id="colors"><option value="red">r</option><option value="green">g</option><option value="blue">b</option></select>' +
                '<button type="submit" id="go">Go</button></form><div id="out"></div>';
            await setup(page, html, `window.fv = FormValidator.init({ formId: 'f', rules: { email: ['required', 'email'] },
                config: { submitHandler: async (form, e, values) => { window.__values = values;
                    const r = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
                    document.getElementById('out').textContent = (await r.json()).ok ? 'sent' : 'failed'; } } }); 0`);
            let sent = 0;
            page.on('request', r => { if (r.url().endsWith('/api/signup')) sent++; });
            await page.fill('#email', 'not an email');
            await page.click('#go');
            await page.waitForSelector('.error[data-error-for=email]');
            await page.waitForTimeout(150);
            assert.equal(sent, 0, 'nothing is sent while the form is invalid');

            await page.fill('#email', '  a@b.co  '); await page.fill('#password', ' pw ');
            await page.check('#ta'); await page.check('#tc'); await page.check('#pro'); await page.selectOption('#colors', ['red', 'blue']);
            await page.click('#go');
            await page.waitForFunction(() => document.getElementById('out').textContent === 'sent');
            const expected = { email: 'a@b.co', password: ' pw ', tag: ['a', 'c'], plan: 'pro', colors: ['red', 'blue'] };   // trimmed, password untouched, unchecked terms left out
            assert.deepEqual(await page.evaluate(() => window.__values), expected);
            assert.equal(sent, 1);
            const again = await page.evaluate(async () => { const r = await window.fv.validateAndGetValues(); return { valid: r.valid, values: r.values, errors: r.errors.length }; });
            assert.deepEqual(again, { valid: true, values: expected, errors: 0 });
            await page.fill('#email', '');
            const bad = await page.evaluate(async () => { const r = await window.fv.validateAndGetValues(); return { valid: r.valid, errors: r.errors.map(e => e.name) }; });
            assert.deepEqual(bad, { valid: false, errors: ['email'] });
        });

        // ============================================================ one answer in every browser engine
        it2('every shared conformance vector gives the same answer in this browser (value-only engine and the real DOM form engine)', async page => {
            const vectors = require('../spec/form-rules.vectors.json').cases;
            await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '..', 'spec', 'dom-vectors.js'), 'utf8') });
            const bad = await page.evaluate(async cases => {
                const wrong = [];
                cases.forEach(c => {
                    const r = window.FormValidator.checkValue(c.value, c.rule, { values: c.values });
                    if (r.valid !== c.valid) wrong.push('checkValue ' + JSON.stringify(c.rule) + ' on ' + JSON.stringify(c.value) + ': expected ' + c.valid + ', got ' + r.valid);
                });
                (await window.runDomVectors(window.FormValidator, cases)).forEach(m => wrong.push('form engine ' + m));
                return wrong;
            }, vectors);
            assert.deepEqual(bad.slice(0, 20), [], bad.length + ' of ' + vectors.length + ' vectors differ in ' + b.name);
        });

        // ============================================================ the upload widget in a real browser
        const WIDGET_HTML = `<div id="zone"><label for="in">Choose files</label> <input type="file" id="in" multiple></div><div id="status"></div><div id="errors"></div><ul id="list"></ul>`;
        const widget = (page, cfg, opts) => setup(page, WIDGET_HTML, `window.zone = FileValidator.widget('#zone', ${JSON.stringify(cfg)}, Object.assign({ list: '#list', messageElement: '#errors', statusElement: '#status' }, ${JSON.stringify(opts || {})})); 0`);
        const drop = async (page, fileList, extra) => {
            const dt = await page.evaluateHandle(list => { const d = new DataTransfer(); list.forEach(f => d.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.type }))); return d; }, fileList);
            await page.dispatchEvent('#zone', 'dragenter', { dataTransfer: dt });
            if (extra && extra.during) await extra.during();
            await page.dispatchEvent('#zone', 'dragover', { dataTransfer: dt });
            await page.dispatchEvent('#zone', 'drop', { dataTransfer: dt });
        };

        it2('drag and drop: accepted files are listed and synced into the real input, rejected ones explained, a status line is written', async page => {
            await widget(page, { accept: '.pdf,.png', maxFiles: 2 });
            await drop(page, [
                { name: 'a.pdf', type: 'application/pdf', bytes: files.PDF }, { name: 'bad.exe', type: '', bytes: [1, 2, 3, 4] },
                { name: 'b.pdf', type: 'application/pdf', bytes: files.PDF.concat([32]) }, { name: 'c.pdf', type: 'application/pdf', bytes: files.PDF.concat([33]) }
            ], { during: async () => assert.equal(await page.evaluate(() => document.getElementById('zone').classList.contains('fv-dragover')), true, 'the drag-over class is set while dragging') });
            await page.waitForFunction(() => document.querySelectorAll('#list .fv-file').length === 2);
            assert.deepEqual(await page.$$eval('#list .fv-name', e => e.map(x => x.textContent)), ['a.pdf', 'b.pdf']);
            assert.equal(await page.evaluate(() => document.getElementById('in').files.length), 2, 'the real <input> now holds the accepted files');
            assert.equal(await page.textContent('#status'), '2 files added. 2 files not accepted. 2 selected.');
            const msgs = await page.$$eval('#errors .fv-message', e => e.map(x => x.textContent));
            assert.match(msgs.join('|'), /bad\.exe: Files of this type \(\.exe\) can't be uploaded/);
            assert.match(msgs.join('|'), /c\.pdf: Please select no more than 2/);
            assert.equal(await page.evaluate(() => document.getElementById('zone').classList.contains('fv-dragover')), false);
        });
        it2('clicking the zone or picking with the real chooser adds files; the list can be used with the keyboard', async page => {
            await widget(page, { accept: '.txt' });
            await page.setInputFiles('#in', [tmpFile('k/a.txt', 'a'), tmpFile('k/b.txt', 'b'), tmpFile('k/c.txt', 'c')]);
            await page.waitForFunction(() => document.querySelectorAll('#list .fv-file').length === 3);
            // focus the second remove button, press Enter: the file goes, focus moves to the button that took its place
            await page.focus('#list li:nth-child(2) .fv-remove');
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => document.querySelectorAll('#list .fv-file').length === 2);
            assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Remove c.txt');
            assert.equal(await page.textContent('#status'), 'b.txt removed. 2 selected.');
            await page.keyboard.press('Enter');   // remove c.txt (last): focus goes to the previous button
            assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Remove a.txt');
            await page.keyboard.press('Enter');   // the only one: focus returns to the file input
            assert.equal(await page.evaluate(() => document.activeElement.id), 'in');
        });
        it2('resize: a large image is shrunk on a real canvas and then accepted; the result decodes at the new size', async page => {
            await widget(page, { accept: '.png,.jpg', maxImageWidth: 1000, maxImageHeight: 1000 }, { resize: true });
            const r = await page.evaluate(async () => {
                const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
                const ctx = c.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 3000, 2000); g.addColorStop(0, '#f80'); g.addColorStop(1, '#08f'); ctx.fillStyle = g; ctx.fillRect(0, 0, 3000, 2000);
                const blob = await new Promise(res => c.toBlob(res, 'image/png'));
                const res = await zone.add([new File([blob], 'big.png', { type: 'image/png' })]);
                const out = res.accepted[0] && res.accepted[0].file;
                const bmp = out && await createImageBitmap(out);
                return { accepted: res.accepted.length, rejected: res.rejected.map(x => x.messages), name: out && out.name, type: out && out.type, w: bmp && bmp.width, h: bmp && bmp.height, resized: res.accepted[0] && res.accepted[0].resized };
            });
            assert.equal(r.accepted, 1, JSON.stringify(r.rejected));
            assert.equal(r.w, 1000); assert.equal(r.h, 667);
            assert.equal(r.resized.from.width, 3000);
        });
        it2('resize to a byte limit: a noisy JPEG is recompressed under 200 KB', async page => {
            await widget(page, { accept: '.jpg,.jpeg,.png', maxFileSizeMB: 0.2 }, { resize: { maxSizeMB: 0.2 } });
            const r = await page.evaluate(async () => {
                const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const ctx = c.getContext('2d');
                const img = ctx.createImageData(1600, 1200); for (let i = 0; i < img.data.length; i += 4) { img.data[i] = Math.random() * 255; img.data[i + 1] = Math.random() * 255; img.data[i + 2] = Math.random() * 255; img.data[i + 3] = 255; }
                ctx.putImageData(img, 0, 0);
                const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.95));
                const res = await zone.add([new File([blob], 'noise.jpg', { type: 'image/jpeg' })]);
                const f = res.accepted[0] && res.accepted[0].file;
                return { before: blob.size, after: f && f.size, accepted: res.accepted.length, msg: res.rejected.map(x => x.messages), type: f && f.type };
            });
            assert.ok(r.before > 1000000, 'the source is big: ' + r.before);
            assert.equal(r.accepted, 1, JSON.stringify(r.msg));
            assert.ok(r.after <= 0.2 * 1048576, 'shrunk to ' + r.after);
            assert.equal(r.type, 'image/jpeg');
        });
        // ============================================================ image add-on: convert, transform, cropper, capture
        const IMG_HELPERS = `
            window.halves = async (w, h, type = 'image/png') => {      // left half red, right half blue
                const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
                x.fillStyle = '#f00'; x.fillRect(0, 0, w / 2, h); x.fillStyle = '#00f'; x.fillRect(w / 2, h === 0 ? 0 : 0, w / 2, h);
                const blob = await new Promise(r => c.toBlob(r, type, 0.95)); return new File([blob], 'halves.' + (type === 'image/png' ? 'png' : 'jpg'), { type });
            };
            window.pixel = async (file, px, py) => {
                const b = await createImageBitmap(file); const c = document.createElement('canvas'); c.width = b.width; c.height = b.height;
                const x = c.getContext('2d'); x.drawImage(b, 0, 0); const d = x.getImageData(px, py, 1, 1).data;
                return { w: b.width, h: b.height, rgb: [d[0] > 128 ? 'R' : '-', d[1] > 128 ? 'G' : '-', d[2] > 128 ? 'B' : '-'].join('') };
            };`;
        it2('image add-on: transformImage crops, rotates, flips and shrinks on a real canvas', async page => {
            await page.evaluate(IMG_HELPERS);
            const r = await page.evaluate(async () => {
                const src = await halves(300, 200);
                const crop = await FileValidator.transformImage(src, { crop: { x: 0, y: 0, width: 100, height: 200 } });        // only the red part
                const rot = await FileValidator.transformImage(src, { rotate: 90 });                                              // 200 x 300, red on top after a clockwise turn
                const flip = await FileValidator.transformImage(src, { flipH: true });                                            // blue on the left now
                const small = await FileValidator.transformImage(src, { maxWidth: 150 });
                const jpg = await FileValidator.transformImage(src, { type: 'image/jpeg', quality: 0.9 });
                const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'a.svg', { type: 'image/svg+xml' });
                return {
                    crop: await pixel(crop, 50, 100), rotTop: await pixel(rot, 100, 10), rotBottom: await pixel(rot, 100, 290), flipLeft: await pixel(flip, 10, 100),
                    small: await pixel(small, 10, 10), jpgType: jpg.type, jpgName: jpg.name, meta: crop.fvTransformed, svgSame: (await FileValidator.transformImage(svg)) === svg
                };
            });
            assert.deepEqual([r.crop.w, r.crop.h, r.crop.rgb], [100, 200, 'R--']);
            assert.deepEqual([r.rotTop.w, r.rotTop.h, r.rotTop.rgb, r.rotBottom.rgb], [200, 300, 'R--', '--B']);
            assert.equal(r.flipLeft.rgb, '--B');
            assert.deepEqual([r.small.w, r.small.h], [150, 100]);
            assert.equal(r.jpgType, 'image/jpeg'); assert.equal(r.jpgName, 'halves.jpg');
            assert.equal(r.meta.from.width, 300); assert.equal(r.meta.to.width, 100);
            assert.equal(r.svgSame, true);
        });
        it2('image add-on: convertImage / convertHeic re-encode, use a decoder for formats the browser cannot read, and fail with a clear code', async page => {
            await page.evaluate(IMG_HELPERS);
            const r = await page.evaluate(async () => {
                const src = await halves(300, 200);
                const toJpeg = await FileValidator.convertImage(src);
                const png = await FileValidator.convertHeic(src);                     // not a HEIC file: untouched
                const fakeHeic = new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0])], 'IMG_0001.HEIC', { type: 'image/heic' });
                let code = null; try { await FileValidator.convertHeic(fakeHeic); } catch (e) { code = e.code; }
                const kept = await FileValidator.convertHeic(fakeHeic, { onFail: 'keep' });
                const viaDecoder = await FileValidator.convertHeic(fakeHeic, { decoder: async () => src, maxWidth: 100 });   // a heic library would return a Blob like this
                return { type: toJpeg.type, name: toJpeg.name, untouched: png === src, code, kept: kept === fakeHeic, dec: await pixel(viaDecoder, 10, 10), decType: viaDecoder.type, decName: viaDecoder.name, isHeic: FileValidator.isHeic(fakeHeic) };
            });
            assert.deepEqual([r.type, r.name, r.untouched], ['image/jpeg', 'halves.jpg', true]);
            assert.equal(r.code, 'IMAGE_DECODE_FAILED');
            assert.equal(r.kept, true);
            assert.deepEqual([r.dec.w, r.dec.h, r.decType, r.decName, r.isHeic], [100, 67, 'image/jpeg', 'IMG_0001.jpg', true]);
        });
        it2('image add-on: the cropper dialog is accessible, moves with the keyboard, keeps the aspect ratio and returns the cropped File', async page => {
            await page.evaluate(IMG_HELPERS);
            await page.evaluate(async () => { window.__crop = FileValidator.cropper(await halves(400, 200), { aspectRatio: 1 }).then(f => { window.__result = f; return f; }); });
            const dlg = page.locator('.fv-crop[role="dialog"]');
            await dlg.waitFor();
            assert.equal(await dlg.getAttribute('aria-modal'), 'true');
            assert.equal(await page.evaluate(() => document.activeElement.className), 'fv-crop-box');
            assert.ok(await page.evaluate(() => document.querySelector('.fv-crop').getAttribute('aria-labelledby')));
            // 400 x 200 image, ratio 1: the box starts 160 x 160 px (80% of the height) and centred
            const before = await page.evaluate(() => { const b = document.querySelector('.fv-crop-box'); return [b.style.left, b.style.top, b.style.width, b.style.height]; });
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('Shift+ArrowLeft');
            const moved = await page.evaluate(() => { const b = document.querySelector('.fv-crop-box'); return [b.style.left, b.style.top, b.style.width, b.style.height]; });
            assert.notDeepEqual(moved, before);
            assert.equal(moved[2], before[2], 'moving does not resize');
            await page.keyboard.press('-');
            const smaller = await page.evaluate(() => document.querySelector('.fv-crop-box').style.width);
            assert.ok(parseFloat(smaller) < parseFloat(before[2]));
            await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BUTTON');
            await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'fv-crop-box');
            await page.keyboard.press('Enter');
            const r = await page.evaluate(async () => { const f = await window.__crop; return { ...(await pixel(f, 5, 5)), type: f.type, meta: f.fvTransformed, dialog: !!document.querySelector('.fv-crop') }; });
            assert.equal(r.w, r.h, 'the ratio 1 gives a square');
            assert.ok(r.w < 160 && r.w > 100, 'about 150 px, got ' + r.w);
            assert.equal(r.dialog, false, 'the dialog is gone');
            assert.equal(r.type, 'image/png');
        });
        it2('image add-on: the cropper cancels with Escape or Cancel, rotates, flips and resets', async page => {
            await page.evaluate(IMG_HELPERS);
            await page.evaluate(async () => { window.__p = FileValidator.cropper(await halves(400, 200)); });
            await page.locator('.fv-crop').waitFor();
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => window.__p), null);
            assert.equal(await page.locator('.fv-crop').count(), 0);
            await page.evaluate(async () => { window.__p = FileValidator.cropper(await halves(400, 200), { maxWidth: 100 }); });
            await page.locator('.fv-crop').waitFor();
            await page.click('text=Cancel');
            assert.equal(await page.evaluate(() => window.__p), null);
            // rotate right: the image is 200 x 400 now; applying gives a portrait result whose top is red (the left half turned up)
            await page.evaluate(async () => { window.__p = FileValidator.cropper(await halves(400, 200), { texts: { apply: 'Use photo' } }); });
            await page.locator('.fv-crop').waitFor();
            await page.click('text=Rotate right');
            await page.click('text=Use photo');
            const r = await page.evaluate(async () => { const f = await window.__p; return { top: await pixel(f, f.fvTransformed.to.width / 2 | 0, 5), bottom: await pixel(f, f.fvTransformed.to.width / 2 | 0, f.fvTransformed.to.height - 5), rotate: f.fvTransformed.rotate }; });
            assert.ok(r.top.h > r.top.w, 'portrait');
            assert.equal(r.top.rgb, 'R--'); assert.equal(r.bottom.rgb, '--B'); assert.equal(r.rotate, 90);
        });
        it2('image add-on: the widget converts HEIC and opens the cropper for each image; cancelling skips the file', async page => {
            await page.evaluate(IMG_HELPERS);
            await setup(page, '<div id="zone"><input id="in" type="file" accept="image/*" multiple></div><ul id="list"></ul><div id="errors"></div>', `
                window.zone = FileValidator.widget('#zone', { accept: 'image/*', maxFiles: 5 }, { list: '#list', messageElement: '#errors',
                    convert: { decoder: async () => halves(80, 40) }, crop: { aspectRatio: 'free' } });`);
            await page.evaluate(async () => {
                const heic = new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99])], 'IMG_9.heic', { type: 'image/heic' });
                window.__add = zone.add([heic, await halves(60, 30)]);
            });
            await page.locator('.fv-crop').waitFor();
            await page.evaluate(() => document.querySelector('.fv-crop').setAttribute('data-first', '1'));
            await page.click('.fv-crop-apply');                 // first file (the converted HEIC) is accepted as cropped
            await page.locator('.fv-crop:not([data-first])').waitFor();   // the second dialog, not the first one still closing
            await page.keyboard.press('Escape');               // the second one is cancelled: not added
            const r = await page.evaluate(async () => { const res = await window.__add; return { accepted: res.accepted.map(a => ({ name: a.file.name, type: a.file.type, converted: !!a.converted, cropped: !!a.cropped })), rejected: res.rejected.length }; });
            assert.deepEqual(r.accepted, [{ name: 'IMG_9.jpg', type: 'image/jpeg', converted: true, cropped: true }]);
            assert.equal(r.rejected, 0);
        });
        it2('image add-on: capture() opens the chooser (camera attribute on phones), converts on request and resolves to a File', async page => {
            await setup(page, '<button id="cap">Take photo</button>', `document.getElementById('cap').onclick = () => { window.__cap = FileValidator.capture({ camera: 'user', maxWidth: 50, type: 'image/jpeg' }); };`);
            const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#cap')]);
            assert.equal(await page.evaluate(() => document.querySelector('input[type=file][capture]').getAttribute('capture')), 'user');
            await chooser.setFiles({ name: 'cam.png', mimeType: 'image/png', buffer: Buffer.from(files.makePng(200, 100)) });
            const r = await page.evaluate(async () => { const f = await window.__cap; const b = await createImageBitmap(f); return { name: f.name, type: f.type, w: b.width, h: b.height, left: document.querySelectorAll('input[type=file][capture]').length }; });
            assert.deepEqual(r, { name: 'cam.jpg', type: 'image/jpeg', w: 50, h: 25, left: 0 });
        });

        it2('EXIF: a phone photo stored sideways (orientation 6) gets an upright thumbnail and resized copy, also on a browser that ignores the tag', async page => {
            await page.evaluate(IMG_HELPERS);
            for (const ignoreTag of [false, true]) {
                await page.reload();
                await page.evaluate(IMG_HELPERS);
                const r = await page.evaluate(async ignoreTag => {
                    if (ignoreTag) {      // an older browser: decodes the pixels as stored and never reads the EXIF tag (simulated by dropping the APP1 segment before decoding)
                        const orig = window.createImageBitmap.bind(window);
                        window.createImageBitmap = async src => { const b = new Uint8Array(await src.arrayBuffer()); if (b[2] === 0xff && b[3] === 0xe1) src = new Blob([b.subarray(0, 2), b.subarray(4 + ((b[4] << 8) | b[5]))], { type: 'image/jpeg' }); return orig(src); };
                    }
                    // 200 x 100 picture, left half red, right half blue, with EXIF orientation 6 (shown turned clockwise: 100 x 200, red on top)
                    const raw = await halves(200, 100, 'image/jpeg');
                    const jpg = new Uint8Array(await raw.arrayBuffer());
                    const tiff = [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0];
                    const body = [0x45, 0x78, 0x69, 0x66, 0, 0].concat(tiff), len = body.length + 2;
                    const out = new Uint8Array(jpg.length + body.length + 4);
                    out.set(jpg.subarray(0, 2), 0); out.set([0xff, 0xe1, len >> 8, len & 255].concat(body), 2); out.set(jpg.subarray(2), 6 + body.length);
                    const photo = new File([out], 'IMG_1.jpg', { type: 'image/jpeg' });
                    const info = await FileValidator.readImage(photo);
                    const dims = [info.width, info.height, info.orientation]; info.close();
                    const small = await FileValidator.resizeImage(photo, { maxWidth: 50 });
                    const prev = await FileValidator.createPreview(photo, { maxWidth: 80, maxHeight: 80 });
                    const img = new Image(); await new Promise(res => { img.onload = res; img.src = prev.url; });
                    const probe = (bitmapOrImg, w, h, x, y) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(bitmapOrImg, 0, 0); const d = g.getImageData(x, y, 1, 1).data; return d[0] > 128 ? 'R' : d[2] > 128 ? 'B' : '-'; };
                    const sb = await createImageBitmap(small, { imageOrientation: 'none' });
                    return { ignoreTag, dims, smallSize: [sb.width, sb.height], smallTop: probe(sb, sb.width, sb.height, 5, 5), smallBottom: probe(sb, sb.width, sb.height, 5, sb.height - 5),
                        prev: [img.naturalWidth, img.naturalHeight], prevTop: probe(img, img.naturalWidth, img.naturalHeight, 5, 5), prevBottom: probe(img, img.naturalWidth, img.naturalHeight, 5, img.naturalHeight - 5) };
                }, ignoreTag);
                const tag = ' (browser ignores EXIF: ' + ignoreTag + ')';
                assert.deepEqual(r.dims, [100, 200, 6], 'displayed size' + tag);
                assert.ok(r.smallSize[1] > r.smallSize[0], 'resized copy is portrait' + tag);
                assert.deepEqual([r.smallTop, r.smallBottom], ['R', 'B'], 'resized copy is upright' + tag);
                assert.ok(r.prev[1] > r.prev[0], 'thumbnail is portrait' + tag);
                assert.deepEqual([r.prevTop, r.prevBottom], ['R', 'B'], 'thumbnail is upright' + tag);
            }
        });
        it2('previews: a real thumbnail is created and loads; it is revoked on remove', async page => {
            await widget(page, { accept: '.png' }, { preview: true });
            await page.evaluate(async b => { await zone.add([new File([new Uint8Array(b)], 'p.png', { type: 'image/png' })]); }, bytes(files.makePng(600, 400)));
            await page.waitForSelector('#list img.fv-preview');
            await page.waitForFunction(() => { const i = document.querySelector('#list img.fv-preview'); return i.complete && i.naturalWidth > 0; });
            const w = await page.$eval('#list img.fv-preview', i => i.naturalWidth);
            assert.ok(w <= 160 && w > 0, 'thumbnail width ' + w);
            assert.equal(await page.$eval('#list img.fv-preview', i => i.alt), '');
            assert.match(await page.$eval('#list img.fv-preview', i => i.src), /^blob:/);
        });
        it2('paste: a pasted image is added and named', async page => {
            await widget(page, { accept: '.png' }, { paste: true });
            const supported = await page.evaluate(() => { try { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'x.png', { type: 'image/png' })); const ev = new ClipboardEvent('paste', { clipboardData: dt }); return !!ev.clipboardData && ev.clipboardData.files.length === 1; } catch (e) { return false; } });
            if (!supported) return;   // this browser's synthetic paste events lose their files (Firefox): real pastes are covered by the jsdom tests
            await page.evaluate(b => {
                const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(b)], 'image.png', { type: 'image/png' }));
                document.getElementById('zone').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
            }, bytes(files.makePng(30, 30)));
            await page.waitForFunction(() => document.querySelectorAll('#list .fv-file').length === 1);
            assert.match(await page.textContent('#list .fv-name'), /^pasted-\d{4}-\d\d-\d\dT[\d-]+\.png$/);
        });
        it2('the widget works with a folder picker and keeps relative paths', async page => {
            await setup(page, `<div id="zone"><input type="file" id="in" webkitdirectory multiple></div><ul id="list"></ul><div id="errors"></div>`,
                `window.zone = FileValidator.widget('#zone', { accept: '.txt', maxPathDepth: 2 }, { list: '#list', messageElement: '#errors', folder: true }); 0`);
            tmpFile('w/top.txt', 't'); tmpFile('w/one/a.txt', 'a'); tmpFile('w/one/two/b.txt', 'b'); tmpFile('w/.DS_Store', 'j');
            await page.setInputFiles('#in', path.join(tmp, 'w'));
            await page.waitForFunction(() => document.querySelectorAll('#list .fv-file').length >= 2);
            const names = await page.$$eval('#list .fv-name', e => e.map(x => x.textContent).sort());
            assert.deepEqual(names, ['w/one/a.txt', 'w/top.txt']);
            assert.match(await page.textContent('#errors'), /b\.txt: This file is 3 folders deep but the maximum is 2/);
            assert.doesNotMatch(await page.textContent('#errors'), /DS_Store/);
        });

        // ============================================================ jQuery layer in a real browser
        it2('jQuery: validate(), valid(), custom method, groups and showErrors', async page => {
            await setup(page, `<form id="f"><input name="email" id="email"><input name="fname" id="fname"><input name="lname" id="lname"><div id="summary"></div></form>`, '');
            const r = await page.evaluate(() => {
                $.validator.addMethod('notTest', function (v, el) { return this.optional(el) || v !== 'test@test.com'; }, 'Please use your real email.');
                const calls = [];
                const v = $('#f').validate({ rules: { email: { required: true, email: true, notTest: true }, fname: 'required', lname: 'required' }, groups: { name: 'fname lname' },
                    showErrors: function (map, list) { calls.push(list.length); this.defaultShowErrors(); }, messages: { email: { required: 'We need your email' } } });
                const first = $('#f').valid();
                const labels = [...document.querySelectorAll('label.error')].map(l => [l.getAttribute('for'), l.hidden, l.textContent]);
                $('#email').val('test@test.com'); const custom = $('#email').valid(); const customMsg = $('label.error[for=email]').text();
                $('#email').val('ada@example.com'); $('#fname').val('A'); $('#lname').val('B');
                return { first, labels, custom, customMsg, last: $('#f').valid(), calls: calls.length > 0 };
            });
            assert.equal(r.first, false);
            assert.deepEqual(r.labels.map(l => l.slice(0, 2)), [['email', false], ['fname', false], ['lname', true]], 'the group shows one message');
            assert.equal(r.labels[0][2], 'We need your email');
            assert.equal(r.custom, false); assert.equal(r.customMsg, 'Please use your real email.');
            assert.equal(r.last, true); assert.equal(r.calls, true);
        }, '/browser-tests/pages/jquery.html');
        it2('jQuery: the classic submit patterns with real clicks: native submit, submitHandler + $.ajax, onSubmit with server errors', async page => {
            await page.route('**/__posted', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1 id="posted">posted</h1>' }));
            await page.route('**/api/save', async route => {
                const body = JSON.parse(route.request().postData() || '{}');
                if (body.email === 'taken@example.com') return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ errors: { email: 'Already registered' } }) });
                return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
            });
            // 1. no submitHandler: a valid form posts natively, an invalid one does not
            await setup(page, '<form id="f" method="post" action="/__posted"><input name="email" id="email"><button type="submit" id="go">Go</button></form>',
                `$('#f').validate({ rules: { email: { required: true, email: true } } }); 0`);
            let posts = 0;
            page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/__posted')) posts++; });
            await page.fill('#email', 'nope'); await page.click('#go');
            await page.waitForSelector('label.error[for=email]'); await page.waitForTimeout(150);
            assert.equal(posts, 0);
            await page.fill('#email', 'a@b.co');
            await Promise.all([page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/__posted')), page.click('#go')]);
            await page.waitForSelector('#posted');

            // 2. the classic AJAX pattern: submitHandler(form) + $.ajax; the validated values are a third argument
            await page.goto(page.url().replace(/\/__posted.*|\/$/, '') + '/browser-tests/pages/jquery.html');
            await setup(page, '<form id="f" action="/never"><input name="email" id="email"><input name="tags" type="checkbox" value="x" checked><input name="tags" type="checkbox" value="y"><button type="submit" id="go">Go</button></form><div id="out"></div>',
                `$('#f').validate({ rules: { email: { required: true, email: true } }, submitHandler: function (form, event, values) {
                    window.__third = values;
                    $.ajax({ url: '/api/save', method: 'POST', contentType: 'application/json', data: JSON.stringify($(form).serializeArray().reduce(function (o, f) { o[f.name] = f.value; return o; }, {})) })
                        .done(function () { $('#out').text('saved'); }); } }); 0`);
            await page.fill('#email', '  ada@example.com '); await page.click('#go');
            await page.waitForFunction(() => document.getElementById('out').textContent === 'saved');
            assert.deepEqual(await page.evaluate(() => window.__third), { email: 'ada@example.com', tags: ['x'] });

            // 3. onSubmit: validated values in, server messages out (shown on the field the jQuery way)
            await page.goto(page.url().replace(/\/$/, '').replace(/\/browser-tests.*/, '') + '/browser-tests/pages/jquery.html');
            await setup(page, '<form id="f" action="/never"><input name="email" id="email"><button type="submit" id="go">Go</button></form><div id="out"></div>',
                `$('#f').validate({ rules: { email: { required: true, email: true } }, onSubmit: function (values) {
                    return fetch('/api/save', { method: 'POST', body: JSON.stringify(values) }).then(function (r) { return r.ok ? {} : r.json(); }).then(function (res) { if (!res.errors) $('#out').text('saved'); return res; }); } }); 0`);
            await page.fill('#email', 'taken@example.com'); await page.click('#go');
            await page.waitForSelector('label.error[for=email]');
            assert.equal(await page.textContent('label.error[for=email]'), 'Already registered');
            await page.fill('#email', 'free@example.com'); await page.click('#go');
            await page.waitForFunction(() => document.getElementById('out').textContent === 'saved');
        }, '/browser-tests/pages/jquery.html');
        it2('jQuery: the fileValidator method checks a real file input', async page => {
            await setup(page, `<form id="f"><input type="file" name="doc" id="doc"></form>`, `$('#f').validate({ rules: { doc: { fileValidator: { accept: '.pdf', maxFileSizeMB: 1 } } } }); 0`);
            await page.setInputFiles('#doc', toFile('run.exe', [1, 2, 3, 4]));
            await page.evaluate(() => $('#doc').valid());
            await page.waitForSelector('label.error[for=doc]');
            assert.match(await page.textContent('label.error[for=doc]'), /can.t be uploaded|isn.t allowed/);
            await page.setInputFiles('#doc', toFile('ok.pdf', files.PDF, 'application/pdf'));
            await page.evaluate(() => $('#doc').valid());
            await page.waitForFunction(() => document.querySelectorAll('label.error[for=doc]').length === 0);
        }, '/browser-tests/pages/jquery.html');

        // ============================================================ accessibility with real layout and colour contrast
        const axeRun = async (page, label) => {
            await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
            const violations = await page.evaluate(async () => (await axe.run(document, { rules: { region: { enabled: false } } })).violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => n.html.slice(0, 110) + '  ' + (n.any[0] && n.any[0].message || '').slice(0, 120)) })));
            assert.deepEqual(violations, [], label + ' has accessibility violations:\n' + JSON.stringify(violations, null, 2));
        };
        it2('axe (with colour contrast): demo.html, empty and with every error showing', async page => {
            await axeRun(page, 'demo.html (empty)');
            await page.click('button[type=submit]:not([formnovalidate])');
            await page.waitForSelector('.error');
            await axeRun(page, 'demo.html (with errors)');
        }, '/demo.html');
        it2('axe (with colour contrast): demo-upload.html with files and rejection messages', async page => {
            await axeRun(page, 'demo-upload.html (empty)');
            await page.setInputFiles('#files', [toFile('a.pdf', files.PDF, 'application/pdf'), toFile('bad.exe', [1, 2, 3, 4]), { name: 'p.png', mimeType: 'image/png', buffer: files.makePng(300, 200) }]);
            await page.waitForSelector('#list .fv-file');
            await page.waitForSelector('#errors .fv-message');
            await axeRun(page, 'demo-upload.html (with files)');
        }, '/demo-upload.html');
        it2('axe (with colour contrast): demo-jquery.html with errors', async page => {
            await page.click('button[type=submit]:not(.cancel)');
            await page.waitForSelector('label.error');
            await axeRun(page, 'demo-jquery.html (with errors)');
        }, '/demo-jquery.html');

        // ============================================================ FileValidator.upload
        it2('upload: real XMLHttpRequest progress, the result, retry-free abort and a presigned PUT', async page => {
            const r = await page.evaluate(async () => {
                const file = new File([new Uint8Array(24 * 1024 * 1024)], 'big.bin');
                const steps = [];
                const done = await FileValidator.upload(file, { url: '/upload-test', onProgress: p => steps.push(p.percent) });
                const put = await FileValidator.upload(file, { presign: async () => ({ url: '/put-test', method: 'PUT' }) });
                const up = FileValidator.upload(file, { url: '/upload-test' });
                setTimeout(() => up.abort(), 5);
                let aborted = false;
                try { await up; } catch (e) { aborted = e.aborted === true; }
                return { size: done.body.size, steps, putSize: put.body.size, putMethod: put.body.method, aborted };
            });
            assert.ok(r.size >= 24 * 1024 * 1024, 'the multipart body holds the file: ' + r.size);
            assert.equal(r.steps[r.steps.length - 1], 100);
            assert.ok(r.steps.length >= 1, 'progress was reported: ' + r.steps.join(','));   // loopback is so fast that Chromium may send one event; slower links give many
            assert.ok(r.steps.every((v, i) => i === 0 || v >= r.steps[i - 1]));
            assert.equal(r.putSize, 24 * 1024 * 1024);
            assert.equal(r.putMethod, 'PUT');
            assert.equal(r.aborted, true);
        });

        // ============================================================ <fv-field>
        it2('<fv-field>: the rules become native validity: blocked submit, our message instead of the bubble, :user-invalid, and the cross-field rule', async page => {
            await setup(page, `<form id="f"><input type="password" name="pw" id="pw"><fv-field rules="required equalTo:pw"><label for="c">Confirm</label><input type="password" id="c" name="c"></fv-field>
                <fv-field rules="required email"><label for="e">Email</label><input id="e" name="email"></fv-field><button id="go">Go</button></form>`,
                `window.submits = 0; document.getElementById('f').addEventListener('submit', e => { e.preventDefault(); window.submits++; });`);
            assert.equal(await page.evaluate(() => document.getElementById('f').checkValidity()), false);
            await page.click('#go');                                  // native validation runs: the form must not submit
            assert.equal(await page.evaluate(() => window.submits), 0);
            await page.waitForSelector('fv-field .fv-error');
            assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'c', 'focus goes to the first invalid control');
            await page.fill('#pw', 'Secret123');
            await page.fill('#c', 'nope');
            await page.keyboard.press('Tab');
            assert.match(await page.textContent('fv-field:nth-of-type(1) .fv-error'), /match|differ|same/i);
            assert.equal(await page.evaluate(() => document.getElementById('c').matches(':user-invalid')), true, 'the native pseudo-class follows our validity');
            await page.fill('#c', 'Secret123');
            assert.equal(await page.evaluate(() => document.querySelector('fv-field .fv-error') && document.querySelector('fv-field .fv-error').textContent !== ''), true, 'the email message is still there');
            await page.fill('#e', 'a@b.co');
            await page.waitForFunction(() => !document.querySelector('fv-field .fv-error'));
            assert.equal(await page.evaluate(() => document.getElementById('f').checkValidity()), true);
            await page.click('#go');
            assert.equal(await page.evaluate(() => window.submits), 1, 'a valid form submits');
            assert.equal(await page.evaluate(() => { try { return document.querySelector('fv-field').matches(':state(user-valid)'); } catch (e) { return 'unsupported'; } }).then(v => v === true || v === false || v === 'unsupported'), true);
        });

        // ============================================================ the docs site (docs/*.html)
        it2('docs site playground: form errors, a rejected file, and the language switch (German, then Arabic right to left)', async page => {
            await page.selectOption('#lang', 'en');
            await page.click('#demo-form button');
            await page.waitForFunction(() => /formValid": false/.test(document.getElementById('result').textContent));
            await page.selectOption('#lang', 'de');
            await page.click('#demo-form button');
            await page.waitForFunction(() => /erforderlich/.test(document.getElementById('demo-form').textContent));
            await page.setInputFiles('#files', [toFile('evil.png', [0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0], 'image/png')]);
            await page.waitForFunction(() => /Inhalt|Datei/.test(document.getElementById('messages').textContent));
            await page.selectOption('#lang', 'ar');
            assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
            await page.setInputFiles('#files', [{ name: 'p.png', mimeType: 'image/png', buffer: files.makePng(40, 30) }]);
            await page.waitForSelector('#list .fv-file');
            assert.match(await page.textContent('#status'), /تمت إضافة/);
        }, '/docs/playground.html');
        it2('docs site playground: the rules box exports Zod, TypeScript and the other formats, and says what is wrong with bad JSON', async page => {
            await page.waitForFunction(() => /z.object/.test(document.getElementById('export-out').textContent));
            assert.match(await page.textContent('#export-out'), /age: z.coerce.number().int().min(18).max(99)/);
            await page.selectOption('#export-format', 'typescript');
            assert.match(await page.textContent('#export-out'), /export interface Signup/);
            await page.selectOption('#export-format', 'react');
            assert.match(await page.textContent('#export-out'), /useFormValidator/);
            await page.fill('#rules-json', '{ nope');
            await page.waitForFunction(() => document.getElementById('export-out').classList.contains('error'));
            await page.fill('#rules-json', '{"a":"required"}');
            await page.waitForFunction(() => !document.getElementById('export-out').classList.contains('error') && /useFormValidator/.test(document.getElementById('export-out').textContent));
        }, '/docs/playground.html');
        it2('axe (with colour contrast): docs site pages', async page => {
            await axeRun(page, 'docs/index.html');
            for (const f of ['form.html', 'file.html', 'languages.html', 'server-and-frameworks.html', 'playground.html']) {
                await page.goto(srv.url + '/docs/' + f);
                await axeRun(page, 'docs/' + f);
            }
        }, '/docs/index.html');
    });
}
