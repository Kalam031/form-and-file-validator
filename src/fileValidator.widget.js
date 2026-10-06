/*!
 * FileValidator upload widget v1.5.0 — drag and drop, folders, paste, previews, resizing and a file list on top of FileValidator.
 *
 * Load order:  fileValidator.js (2.5+)  →  fileValidator.widget.js.  No other dependencies.
 *
 *   const zone = FileValidator.widget('#dropzone', { accept: 'image/*', maxFiles: 5, maxFileSizeMB: 5 }, {
 *       list: '#file-list',            // renders the accepted files (name, size, preview, remove button)
 *       messageElement: '#file-errors',// rejected files and why (a live region)
 *       statusElement: '#file-status', // polite live region: "2 files added. 3 selected." (for screen reader users)
 *       preview: true,                 // thumbnails for images
 *       resize: true,                  // shrink big images to the maxImageWidth/Height/maxFileSizeMB limits instead of rejecting them
 *       convert: true,                 // HEIC / HEIF photos become JPEG where the browser can decode them (needs fileValidator.image.js, in the bundle)
 *       crop: { aspectRatio: 1 },      // every accepted image opens in a crop dialog first (null result = the person cancelled: the file is not added)
 *       stripMetadata: true,           // remove EXIF / GPS / XMP / IPTC / comments from JPEG, PNG and WebP photos (orientation is kept)
 *       paste: true,                   // Ctrl+V of a screenshot
 *       folder: true,                  // accept dropped or picked folders, ignore .DS_Store / Thumbs.db
 *       onChange: (files, entries) => {}, onReject: rejected => {}
 *   });
 *   zone.files; zone.remove(entry); zone.clear(); await zone.validate(); zone.appendTo(formData, 'files');
 *
 * The widget accepts files one by one with the same checks as validateFiles (limits on the running total included) and reports each
 * rejected file with its reasons, so a mixed drop is not thrown away as a whole. `validate()` runs the full selection check at the end
 * (minFiles, scopes, customAll...). Accepted files are also put into the <input type="file"> when the browser allows it (DataTransfer),
 * so a normal form submit and FormValidator's `file` rule keep working.
 *
 * Helpers: FileValidator.filesFromDrop(dataTransfer), filesFromClipboard(clipboardData), resizeImage(file, options), createPreview(file, options).
 *
 * Changelog
 *   1.5.0  `convert` and `crop` options (with the image add-on); entries get `converted` and `cropped`.
 *   1.4.0  `stripMetadata` option: photos are listed without EXIF, GPS, XMP, IPTC and comments (entries get `stripped`).
 *   1.3.0  Every sentence the widget writes (status line, "...and N more", remove button labels) goes through FileValidator.phrase(),
 *          so a language pack can translate it; plural forms follow the language.
 *   1.2.0  File names, messages and status text get dir="auto" (right-to-left languages); `moreText(n)` option for the "...and N more" line.
 *   1.1.1  Fix found in WebKit: dropping plain files no longer depends on the file-system entry API (which never answered for some drops).
 *          `dataTransfer.files` is used directly unless a folder is in the drop, and entry reads have a timeout.
 *   1.1.0  Accessibility: focus moves to the next remove button (or the input) after a file is removed; `statusElement` announces
 *          "2 files added. 3 selected." to screen readers.
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['fileValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, root.FileValidator || require('./fileValidator.js'));
    else factory(root, root.FileValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';

    if (!FV || !FV.validateFile || !FV.getPath) throw new Error('fileValidator.widget.js needs fileValidator.js v2.5 or newer to be loaded first');
    if (FV.widget && FV.widget.__fv) return FV;

    const isFn = f => typeof f === 'function';
    const isNum = v => typeof v === 'number' && isFinite(v);
    const doc = () => root.document;
    const closeInfo = info => { if (info && isFn(info.close)) { try { info.close(); } catch (e) { /* already closed */ } } };

    function setPath(file, path) {
        try { Object.defineProperty(file, 'webkitRelativePath', { value: path, configurable: true }); }
        catch (e) { file.fvPath = path; }
    }

    // ------------------------------------------------------------------ dropped folders and pasted files
    /**
     * Files of a drop event, including everything inside dropped folders (each file gets its relative path, like <input webkitdirectory>).
     * Call it synchronously inside the drop handler: the browser only lets you read the entries during the event.
     * options: { maxFiles = 10000, maxDepth = 32 }
     */
    async function filesFromDrop(dt, options) {
        options = options || {};
        const limit = isNum(options.maxFiles) ? options.maxFiles : 10000, maxDepth = isNum(options.maxDepth) ? options.maxDepth : 32;
        // Everything that must be read while the event is running comes first (the browser empties the DataTransfer afterwards).
        const direct = Array.from((dt && dt.files) || []);
        const items = dt && dt.items ? Array.from(dt.items).filter(i => i.kind === 'file') : [];
        const entries = items.map(i => { try { return isFn(i.webkitGetAsEntry) ? i.webkitGetAsEntry() : null; } catch (e) { return null; } });
        const hasFolder = entries.some(e => e && e.isDirectory);
        if (!hasFolder && direct.length) return direct;                    // plain files: no need for the entry API
        if (!entries.length || entries.every(e => !e)) return direct;

        const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
        const out = [];
        const walk = async (entry, dir, depth) => {
            if (!entry || out.length >= limit) return;
            if (entry.isFile) {
                let f = null;
                try { f = await withTimeout(new Promise((res, rej) => entry.file(res, rej)), 5000); }
                catch (e) { f = direct.find(d => d.name === entry.name) || null; }   // the entry did not answer: use the plain file if there is one
                if (!f) return;
                if (dir) setPath(f, dir + f.name);
                out.push(f);
            } else if (entry.isDirectory && depth < maxDepth) {
                const reader = entry.createReader();
                let batch;
                do { // readEntries returns at most ~100 entries per call
                    batch = await withTimeout(new Promise((res, rej) => reader.readEntries(res, rej)), 10000);
                    for (const child of batch) await walk(child, dir + entry.name + '/', depth + 1);
                } while (batch.length && out.length < limit);
            }
        };
        for (const e of entries) { try { await walk(e, '', 0); } catch (err) { /* an unreadable folder: keep what was read */ } }
        return out.length ? out : direct;
    }

    let mimeToExt = null;
    function extForMime(type) {
        if (!mimeToExt) {
            mimeToExt = {};
            const all = FV.constants.EXTENSIONS();
            Object.keys(all).forEach(ext => { const m = all[ext][0]; if (!mimeToExt[m]) mimeToExt[m] = ext.slice(1); });
        }
        return mimeToExt[String(type || '').toLowerCase()] || 'bin';
    }

    /** Files from a paste event. Screenshots and unnamed images get a name like pasted-2025-01-31T12-00-00.png */
    function filesFromClipboard(cd) {
        if (!cd) return [];
        let list = Array.from(cd.files || []);
        if (!list.length && cd.items) list = Array.from(cd.items).filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return list.map((f, i) => (f.name && !/^image\.\w+$/i.test(f.name)) ? f
            : new File([f], 'pasted-' + stamp + (list.length > 1 ? '-' + (i + 1) : '') + '.' + extForMime(f.type), { type: f.type, lastModified: Date.now() }));
    }

    // ------------------------------------------------------------------ images: read, resize, preview
    async function defaultReadImage(file) {
        if (typeof root.createImageBitmap === 'function') {
            const bmp = await root.createImageBitmap(file);
            return { width: bmp.width, height: bmp.height, source: bmp, close: () => bmp.close && bmp.close() };
        }
        if (!root.Image || !root.URL || !isFn(root.URL.createObjectURL)) return null;
        const url = root.URL.createObjectURL(file), img = new root.Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('decode')); img.src = url; });
        return { width: img.naturalWidth, height: img.naturalHeight, source: img, close: () => root.URL.revokeObjectURL(url) };
    }

    function defaultRender(source, w, h, type, quality) {
        const canvas = root.OffscreenCanvas ? new root.OffscreenCanvas(w, h) : Object.assign(doc().createElement('canvas'), { width: w, height: h });
        const ctx = canvas.getContext('2d');
        if (!ctx) return Promise.resolve(null);
        if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); } // transparent PNG -> white, not black
        ctx.drawImage(source, 0, 0, w, h);
        return canvas.convertToBlob ? canvas.convertToBlob({ type, quality }) : new Promise(res => canvas.toBlob(res, type, quality));
    }

    function renamed(name, outType, srcType) {
        if (outType === srcType) return name;
        const ext = extForMime(outType), i = name.lastIndexOf('.');
        return (i > 0 ? name.slice(0, i) : name) + '.' + ext;
    }

    /**
     * Shrink an image to fit limits. Returns a new File, or the same file when it already fits (or cannot be resized: SVG, GIF, unreadable).
     * options: { maxWidth, maxHeight, maxSizeMB, quality = 0.85, type, readImage, render }
     * The result has `file.fvResized = { from: {width,height,size}, to: {width,height,size} }`.
     * `readImage(file) -> { width, height, source, close? }` and `render(source, w, h, type, quality) -> Blob` can be replaced (tests, Node).
     */
    async function resizeImage(file, options) {
        const o = options || {};
        if (!file || FV.getCategory(file) !== 'image' || /svg|gif/i.test((file.type || '') + ' ' + (file.name || ''))) return file;
        const read = o.readImage || defaultReadImage, render = o.render || defaultRender;
        let info = null;
        try { info = await read(file); } catch (e) { return file; }
        if (!info || !(info.width > 0) || !(info.height > 0)) { closeInfo(info); return file; }

        const scale = Math.min(1, isNum(o.maxWidth) ? o.maxWidth / info.width : 1, isNum(o.maxHeight) ? o.maxHeight / info.height : 1);
        const maxBytes = isNum(o.maxSizeMB) ? o.maxSizeMB * 1048576 : null;
        if (scale >= 1 && !(maxBytes !== null && file.size > maxBytes)) { closeInfo(info); return file; }

        const src = String(file.type || '').toLowerCase();
        const outType = o.type || (src === 'image/png' ? 'image/png' : src === 'image/webp' ? 'image/webp' : 'image/jpeg');
        const q0 = isNum(o.quality) ? o.quality : 0.85;
        const qualities = outType === 'image/png' ? [1] : (maxBytes !== null ? [q0, 0.75, 0.65, 0.55, 0.45].filter(q => q <= q0) : [q0]);
        let w = Math.max(1, Math.round(info.width * scale)), h = Math.max(1, Math.round(info.height * scale)), blob = null;
        try {
            for (let round = 0; round < 8; round++) { // lower the quality first, then the size
                for (const q of qualities) { blob = await render(info.source, w, h, outType, q); if (!blob || maxBytes === null || blob.size <= maxBytes) break; }
                if (!blob || maxBytes === null || blob.size <= maxBytes) break;
                w = Math.max(1, Math.round(w * 0.85)); h = Math.max(1, Math.round(h * 0.85));
            }
        } finally { closeInfo(info); }
        if (!blob || (scale >= 1 && blob.size >= file.size)) return file; // never make a file bigger
        const out = new File([blob], renamed(file.name, outType, src), { type: outType, lastModified: file.lastModified });
        out.fvResized = { from: { width: info.width, height: info.height, size: file.size }, to: { width: w, height: h, size: blob.size } };
        return out;
    }

    /**
     * A preview for a file: { url, kind: 'image' | 'video' | 'audio' | 'file', width, height, label, revoke() }.
     * Images become thumbnails (options: maxWidth = 160, maxHeight = 160, type = 'image/jpeg', quality = 0.8, thumbnail = true).
     * With no DOM (Node) url is null.
     */
    async function createPreview(file, options) {
        const o = Object.assign({ maxWidth: 160, maxHeight: 160, type: 'image/jpeg', quality: 0.8, thumbnail: true }, options);
        const make = blobOrFile => (root.URL && isFn(root.URL.createObjectURL)) ? root.URL.createObjectURL(blobOrFile) : null;
        const revoker = url => () => { if (url && root.URL && isFn(root.URL.revokeObjectURL)) root.URL.revokeObjectURL(url); };
        const cat = FV.getCategory(file);
        if (cat === 'image') {
            const isSvg = /svg/i.test((file.type || '') + (file.name || ''));
            if (!o.thumbnail || isSvg) { const url = make(file); return { url, kind: 'image', revoke: revoker(url) }; }
            let info = null;
            try { info = await (o.readImage || defaultReadImage)(file); } catch (e) { info = null; }
            if (!info) { const url = make(file); return { url, kind: 'image', revoke: revoker(url) }; }
            const scale = Math.min(1, o.maxWidth / info.width, o.maxHeight / info.height);
            const w = Math.max(1, Math.round(info.width * scale)), h = Math.max(1, Math.round(info.height * scale));
            let blob = null;
            try { blob = await (o.render || defaultRender)(info.source, w, h, o.type, o.quality); } catch (e) { blob = null; }
            closeInfo(info);
            const url = make(blob || file);
            return { url, kind: 'image', width: info.width, height: info.height, revoke: revoker(url) };
        }
        if (cat === 'video' || cat === 'audio') { const url = make(file); return { url, kind: cat, revoke: revoker(url) }; }
        const ext = (String(file.name || '').split('.').pop() || '').toUpperCase();
        return { url: null, kind: 'file', label: ext.length <= 5 ? ext : '', revoke() { } };
    }

    // ------------------------------------------------------------------ the widget
    function widget(target, config, options) {
        config = config || {};
        const D = doc();
        const el = typeof target === 'string' ? D.querySelector(target) : target;
        if (!el) throw new Error('FileValidator.widget: element not found');
        const opt = Object.assign({
            multiple: true, append: true, browse: true, paste: false, folder: false, syncInput: true,
            dragClass: 'fv-dragover', preview: false, resize: null, list: null, messageElement: null, maxShownMessages: 5
        }, options);
        const resolve = x => (typeof x === 'string' ? D.querySelector(x) : x);
        const isInput = el.tagName === 'INPUT' && el.type === 'file';
        const input = resolve(opt.input) || (isInput ? el : el.querySelector('input[type=file]'));
        const zone = resolve(opt.dropzone) || (isInput ? (el.closest('label, [data-fv-dropzone]') || el.parentElement || el) : el);
        const listEl = resolve(opt.list), msgEl = resolve(opt.messageElement), statusEl = resolve(opt.statusElement);

        const entries = [];
        const cleanups = [];
        let seq = 0, chain = Promise.resolve(), dragDepth = 0, destroyed = false;

        const on = (node, type, fn, o) => { if (!node) return; node.addEventListener(type, fn, o); cleanups.push(() => node.removeEventListener(type, fn, o)); };
        const emit = (type, detail) => { if (typeof root.CustomEvent === 'function') zone.dispatchEvent(new root.CustomEvent(type, { bubbles: true, detail })); };
        const norm = () => FV._internals.normalizeConfig(config);
        const msg = (code, params) => FV.getMessage(code, params, config);

        // ---- rendering
        function defaultItem(entry) {
            const li = D.createElement('li');
            li.className = 'fv-file';
            li.setAttribute('data-id', String(entry.id));
            if (entry.preview && entry.preview.url && entry.preview.kind === 'image') {
                const img = D.createElement('img');
                img.className = 'fv-preview'; img.alt = ''; img.src = entry.preview.url;
                li.appendChild(img);
            } else if (entry.preview && entry.preview.label) {
                const badge = D.createElement('span');
                badge.className = 'fv-badge'; badge.textContent = entry.preview.label;
                li.appendChild(badge);
            }
            const name = D.createElement('span');
            name.className = 'fv-name'; name.setAttribute('dir', 'auto'); name.textContent = entry.path || entry.file.name;
            const size = D.createElement('span');
            size.className = 'fv-size'; size.textContent = FV.formatBytes(entry.file.size);
            const btn = D.createElement('button');
            btn.type = 'button'; btn.className = 'fv-remove'; btn.textContent = '×';
            btn.setAttribute('aria-label', FV.phrase('Remove {name}', { name: entry.path || entry.file.name }));
            btn.addEventListener('click', () => {
                const i = entries.indexOf(entry);
                remove(entry);
                // keep keyboard focus in the widget: the next remove button, else the previous one, else the input or the zone
                const btns = listEl ? listEl.querySelectorAll('.fv-remove') : [];
                const target = btns[Math.min(i, btns.length - 1)] || input || zone;
                if (target && isFn(target.focus)) target.focus();
            });
            li.appendChild(name); li.appendChild(D.createTextNode(' ')); li.appendChild(size); li.appendChild(D.createTextNode(' ')); li.appendChild(btn);
            return li;
        }

        function render() {
            if (!listEl) return;
            listEl.textContent = '';
            entries.forEach(e => listEl.appendChild(isFn(opt.renderItem) ? opt.renderItem(e, { remove: () => remove(e), formatBytes: FV.formatBytes }) : defaultItem(e)));
        }

        function showMessages(lines) {
            if (!msgEl) return;
            msgEl.textContent = '';
            if (!msgEl.hasAttribute('role')) msgEl.setAttribute('role', 'alert');
            if (!msgEl.hasAttribute('aria-live')) msgEl.setAttribute('aria-live', 'polite');
            const shown = lines.slice(0, opt.maxShownMessages);
            shown.forEach(line => { const d = D.createElement('div'); d.className = 'fv-message'; d.setAttribute('dir', 'auto'); d.textContent = line; msgEl.appendChild(d); });
            if (lines.length > shown.length) { const d = D.createElement('div'); d.className = 'fv-message'; d.setAttribute('dir', 'auto'); d.textContent = (isFn(opt.moreText) ? opt.moreText(lines.length - shown.length) : FV.phrase('…and {n} more.', { n: lines.length - shown.length })); msgEl.appendChild(d); }
        }

        // ---- a polite status line for screen readers: what just happened and how many files there are
        function say(kind, info) {
            if (!statusEl) return;
            if (!statusEl.hasAttribute('role')) statusEl.setAttribute('role', 'status');
            if (!statusEl.hasAttribute('aria-live')) statusEl.setAttribute('aria-live', 'polite');
            let text;
            if (isFn(opt.statusText)) text = opt.statusText(kind, info, entries.length);
            else if (kind === 'add') {
                text = [info.accepted ? FV.phraseN('status.added', info.accepted, {}, { one: '{n} file added.', other: '{n} files added.' }) : '',
                    info.rejected ? FV.phraseN('status.rejected', info.rejected, {}, { one: '{n} file not accepted.', other: '{n} files not accepted.' }) : '',
                    FV.phrase('{n} selected.', { n: entries.length })].filter(Boolean).join(' ');
            }
            else if (kind === 'remove') text = FV.phrase('{name} removed. {n} selected.', { name: info.name, n: entries.length });
            else text = FV.phrase('All files removed.');
            statusEl.setAttribute('dir', 'auto');
            statusEl.textContent = '';   // clear first so an identical message is announced again
            statusEl.textContent = text;
        }

        function syncInput() {
            if (!opt.syncInput || !input || typeof root.DataTransfer !== 'function') return;
            try {
                const dt = new root.DataTransfer();
                entries.forEach(e => dt.items.add(e.file));
                input.files = dt.files;
            } catch (e) { return; } // not supported here: entries stay available through widget.files / appendTo()
            const ev = new root.Event('change', { bubbles: true });
            ev.fvWidget = true;      // our own event: the widget ignores it, FormValidator and your code see it
            input.dispatchEvent(ev);
        }

        function changed(extra) {
            render(); syncInput();
            const files = entries.map(e => e.file);
            if (isFn(opt.onChange)) opt.onChange(files, entries.slice(), extra);
            emit('fv:widget-change', { files, entries: entries.slice() });
        }

        function revoke(entry) { if (entry.preview && isFn(entry.preview.revoke)) entry.preview.revoke(); entry.preview = null; }

        // ---- adding files
        const mkReject = (file, code, params) => {
            const message = msg(code, params);
            return { file, path: FV.getPath(file), errors: [code], details: [{ code, fileName: file.name, file, params: params || {}, message }], messages: [message] };
        };

        async function doAdd(list, source) {
            const cfg = norm();
            let files = Array.from(list || []);
            const ignoreSetting = config.ignoreFiles !== undefined ? config.ignoreFiles : (opt.folder ? true : undefined);
            const ignored = files.filter(f => FV.isIgnored(f, ignoreSetting));
            files = files.filter(f => !ignored.includes(f));
            const accepted = [], rejected = [];

            if (!opt.multiple || !opt.append) {
                if (!opt.multiple && files.length > 1) files.slice(1).forEach(f => rejected.push(mkReject(f, 'SINGLE_FILE_LIMIT_EXCEEDED')));
                if (!opt.multiple) files = files.slice(0, 1);
                if (files.length) { entries.splice(0).forEach(revoke); }   // the newest selection replaces the old one
            }

            const running = entries.map(e => e.file);
            const maxFiles = isNum(cfg.maxFiles) ? cfg.maxFiles : (opt.multiple ? Infinity : 1);
            const dupNames = cfg.duplicateNames === true || !!(cfg.validate && cfg.validate.duplicateNames);
            const idOf = f => (FV.getPath(f) || f.name).toLowerCase();
            let total = running.reduce((s, f) => s + (f.size || 0), 0);

            for (let file of files) {
                let resized = null, converted = null, cropped = null;
                if (opt.convert && isFn(FV.convertHeic)) {
                    try {
                        const out = await FV.convertHeic(file, Object.assign({ onFail: 'keep' }, opt.convert === true ? {} : opt.convert));
                        if (out !== file) { file = out; converted = out.fvTransformed || { type: out.type }; }
                    } catch (e) { /* keep the original */ }
                }
                if (opt.crop && isFn(FV.cropper) && FV.getCategory(file) === 'image' && !/svg|gif/i.test((file.type || '') + ' ' + (file.name || ''))) {
                    let out = file;
                    try { out = await FV.cropper(file, opt.crop === true ? {} : opt.crop); } catch (e) { out = file; }   // an image the browser cannot decode goes on to the normal checks
                    if (out === null) continue;                 // the person cancelled: the file is not added
                    if (out !== file) { file = out; cropped = out.fvTransformed || { type: out.type }; }
                }
                if (opt.resize) {
                    try {
                        const ro = opt.resize === true ? { maxWidth: cfg.maxImageWidth, maxHeight: cfg.maxImageHeight, maxSizeMB: cfg.maxFileSizeMB } : opt.resize;
                        const out = await resizeImage(file, ro);
                        if (out !== file) { file = out; resized = out.fvResized || null; }
                    } catch (e) { /* keep the original */ }
                }
                let stripped = null;
                if (opt.stripMetadata && isFn(FV.stripMetadata)) {
                    try {
                        const out = await FV.stripMetadata(file, opt.stripMetadata === true ? {} : opt.stripMetadata);
                        if (out !== file) { file = out; stripped = out.fvStripped || null; }
                    } catch (e) { /* keep the original */ }
                }
                if (running.length >= maxFiles) { rejected.push(mkReject(file, 'TOO_MANY_FILES', { max: maxFiles })); continue; }
                if (dupNames && running.some(f => idOf(f) === idOf(file))) { rejected.push(mkReject(file, 'DUPLICATE_FILENAMES')); continue; }
                if (cfg.duplicateContent) {
                    const h = await FV.hashFile(file, cfg.duplicateContentMaxMB);
                    if (h) {
                        const hs = await Promise.all(running.map(f => FV.hashFile(f, cfg.duplicateContentMaxMB)));
                        if (hs.includes(h)) { rejected.push(mkReject(file, 'DUPLICATE_FILES', { names: file.name })); continue; }
                    }
                }
                if (isNum(cfg.maxTotalSizeMB) && total + file.size > cfg.maxTotalSizeMB * 1048576) {
                    rejected.push(mkReject(file, 'TOTAL_SIZE_EXCEEDED', { max: FV.formatBytes(cfg.maxTotalSizeMB * 1048576), size: FV.formatBytes(total + file.size) }));
                    continue;
                }
                const res = await FV.validateFile(file, config, { files: running.concat(file), index: running.length });
                if (!res.isValid) { rejected.push({ file, path: FV.getPath(file), errors: res.errors, details: res.details, messages: res.details.map(d => d.message) }); continue; }
                running.push(file); total += file.size;
                accepted.push({ id: ++seq, file, path: FV.getPath(file), resized, stripped, converted, cropped, preview: null });
            }

            entries.push(...accepted);
            if (opt.preview) {
                await Promise.all(accepted.map(async e => {
                    try { e.preview = await createPreview(e.file, opt.preview === true ? {} : opt.preview); } catch (err) { e.preview = null; }
                }));
            }

            const lines = [];
            rejected.forEach(r => r.messages.forEach(m => lines.push(r.file.name + ': ' + m)));
            showMessages(lines);
            if (files.length || rejected.length || ignored.length) { changed({ source, accepted, rejected, ignored }); say('add', { accepted: accepted.length, rejected: rejected.length }); }
            if (rejected.length) {
                if (isFn(opt.onReject)) opt.onReject(rejected, { source });
                emit('fv:widget-reject', { rejected, source });
            }
            return { accepted, rejected, ignored };
        }

        // one add at a time, so two quick drops cannot race each other
        function add(list, meta) {
            const run = chain.then(() => (destroyed ? { accepted: [], rejected: [], ignored: [] } : doAdd(list, (meta && meta.source) || 'api')));
            chain = run.catch(() => { /* keep the queue alive */ });
            return run;
        }

        function remove(x) {
            const i = typeof x === 'number' ? x : entries.findIndex(e => e === x || e.id === x || e.file === x);
            if (i < 0 || i >= entries.length) return false;
            const removed = entries[i];
            revoke(removed);
            entries.splice(i, 1);
            showMessages([]);
            changed({ source: 'remove' });
            say('remove', { name: removed.path || removed.file.name });
            return true;
        }

        function clear() {
            if (!entries.length) return;
            entries.splice(0).forEach(revoke);
            showMessages([]);
            changed({ source: 'clear' });
            say('clear', {});
        }

        async function validate() {
            const result = await FV.validateFiles(entries.map(e => e.file), config);
            showMessages(result.isValid ? [] : FV.summary(result));
            return result;
        }

        function appendTo(formData, name) {
            entries.forEach(e => formData.append(name || 'files', e.file, e.path || e.file.name));
            return formData;
        }

        // ---- events: the input, drag and drop, click and keyboard, paste
        if (input) on(input, 'change', e => { if (!e.fvWidget) add(Array.from(input.files || []), { source: 'input' }); });

        const hasFiles = e => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));
        on(zone, 'dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; zone.classList.add(opt.dragClass); });
        on(zone, 'dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (err) { /* read-only */ } });
        on(zone, 'dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) zone.classList.remove(opt.dragClass); });
        on(zone, 'drop', e => {
            if (!hasFiles(e)) return;
            e.preventDefault(); dragDepth = 0; zone.classList.remove(opt.dragClass);
            const p = filesFromDrop(e.dataTransfer, { maxFiles: opt.maxDropped, maxDepth: opt.maxDepth }); // starts synchronously, as required
            p.then(files => add(files, { source: 'drop' })).catch(() => { /* unreadable drop */ });
        });

        const wrappedInLabel = zone.tagName === 'LABEL' || !!zone.closest('label');
        if (opt.browse && input && zone !== input && !wrappedInLabel) {
            on(zone, 'click', e => { if (e.target === input || (e.target.closest && e.target.closest('button, a, input, select, textarea, .fv-file'))) return; input.click(); });
            on(zone, 'keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === zone) { e.preventDefault(); input.click(); } });
            // Keyboard access: when the real input can be reached with Tab it is the accessible control, and a button role on the zone would
            // nest interactive controls (an accessibility error). Only when the input is out of reach (hidden, aria-hidden, tabindex=-1) the
            // zone becomes the control. opt.keyboard = true / false forces it.
            const inputReachable = !input.hidden && input.getClientRects().length > 0 && input.getAttribute('tabindex') !== '-1' && input.getAttribute('aria-hidden') !== 'true';
            const hasOwnControls = !!(zone.querySelector('button, a[href], select, textarea') || (listEl && zone.contains(listEl)));
            const keyboard = opt.keyboard === undefined ? (!inputReachable && !hasOwnControls) : !!opt.keyboard;
            if (keyboard) {
                if (!zone.hasAttribute('tabindex')) zone.setAttribute('tabindex', '0');
                if (!zone.hasAttribute('role')) zone.setAttribute('role', 'button');
            }
        }

        if (opt.paste) {
            on(opt.paste === 'document' ? D : zone, 'paste', e => {
                const files = filesFromClipboard(e.clipboardData);
                if (!files.length) return;
                e.preventDefault();
                add(files, { source: 'paste' });
            });
        }

        function destroy() {
            destroyed = true;
            cleanups.splice(0).forEach(fn => fn());
            entries.splice(0).forEach(revoke);
            zone.classList.remove(opt.dragClass);
            if (listEl) listEl.textContent = '';
            showMessages([]);
            if (statusEl) statusEl.textContent = '';
        }

        return {
            add, remove, clear, validate, appendTo, destroy,
            get files() { return entries.map(e => e.file); },
            get entries() { return entries.slice(); },
            element: zone, input
        };
    }
    widget.__fv = true;

    Object.assign(FV, { widget, dropzone: widget, filesFromDrop, filesFromClipboard, resizeImage, createPreview });
    return FV;
});
