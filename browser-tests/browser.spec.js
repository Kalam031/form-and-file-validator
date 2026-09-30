'use strict';
/*
 * Real-browser tests: the same suite runs in Chrome, Edge, Firefox and WebKit (Safari's engine), headless.
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
const { chromium, firefox, webkit } = require('playwright');
const { start } = require('./server.js');
const files = require('./files.js');

const ALL = [
    { name: 'chrome', launch: () => chromium.launch({ channel: 'chrome' }) },
    { name: 'msedge', launch: () => chromium.launch({ channel: 'msedge' }) },
    { name: 'firefox', launch: () => firefox.launch() },
    { name: 'webkit', launch: () => webkit.launch() }
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
            const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
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
            assert.deepEqual(r.ignored, ['.DS_Store', 'Thumbs.db']);
            assert.deepEqual(r.errors, ['PATH_TOO_DEEP']);
            assert.deepEqual(r.bad, ['b.txt: PATH_TOO_DEEP']);
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
        it2('axe (with colour contrast): docs site pages', async page => {
            await axeRun(page, 'docs/index.html');
            for (const f of ['form.html', 'file.html', 'languages.html', 'server-and-frameworks.html', 'playground.html']) {
                await page.goto(srv.url + '/docs/' + f);
                await axeRun(page, 'docs/' + f);
            }
        }, '/docs/index.html');
    });
}
