/*!
 * FileValidator image add-on v1.0.0 — convert (HEIC to JPEG), crop, rotate, flip, a keyboard-friendly cropper dialog and a camera / chooser helper.
 *
 *   const jpeg = await FileValidator.convertImage(file, { type: 'image/jpeg', quality: 0.85, maxWidth: 2000 });     // iPhone HEIC -> JPEG where the browser can decode it
 *   const out  = await FileValidator.transformImage(file, { crop: { x: 10, y: 10, width: 400, height: 300 }, rotate: 90, flipH: true, maxWidth: 800 });
 *   const cropped = await FileValidator.cropper(file, { aspectRatio: 1, maxWidth: 512 });                          // a dialog; resolves to a File, or null when cancelled
 *   const photo = await FileValidator.capture({ camera: 'environment', maxWidth: 2000 });                          // the phone camera (or a file chooser on a desktop)
 *   FileValidator.widget('#drop', rules, { convert: true, crop: { aspectRatio: 1 } });                             // the upload widget uses the same helpers
 *
 * Needs fileValidator.js; part of the one-file bundle. Everything happens in the browser: nothing is uploaded. Decoding uses createImageBitmap (EXIF rotation applied), so a HEIC
 * file converts where the browser decodes HEIC (Safari, recent Chromium on macOS / Windows with the codec); elsewhere pass `decoder: async file => blobOrBitmap` to plug in a library
 * such as heic-to or libheif-js. Without a decoder an undecodable file throws an error with code 'IMAGE_DECODE_FAILED' (the widget keeps the original and lets the normal checks decide).
 *
 * Changelog
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['fileValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, root.FileValidator || require('./fileValidator.js'));
    else factory(root, root.FileValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';
    if (!FV || !FV.validateFile) throw new Error('fileValidator.image.js needs fileValidator.js loaded first');
    if (FV.transformImage && FV.transformImage.__fv) return FV;

    const isFn = f => typeof f === 'function';
    const isNum = v => typeof v === 'number' && isFinite(v);
    const D = () => root.document;
    const fail = (message, code) => Object.assign(new Error(message), { code });
    const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

    // ------------------------------------------------------------------ decoding
    /** { source, width, height, close } for a File / Blob (EXIF orientation applied) or whatever options.decoder returns. */
    async function decode(file, o) {
        let input = file;
        if (isFn(o.decoder)) {
            input = await o.decoder(file);
            if (!input) throw fail('The decoder returned nothing for "' + (file && file.name) + '".', 'IMAGE_DECODE_FAILED');
            if (input.source && input.width > 0 && input.height > 0) return { source: input.source, width: input.width, height: input.height, close: input.close || (() => {}) };
        }
        if (typeof root.createImageBitmap === 'function') {
            let bmp = null;
            try { bmp = await root.createImageBitmap(input, { imageOrientation: 'from-image' }); }
            catch (e) { try { bmp = await root.createImageBitmap(input); } catch (e2) { bmp = null; } }
            if (bmp) return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close && bmp.close() };
        }
        if (D() && root.Image && root.URL && isFn(root.URL.createObjectURL) && typeof input.slice === 'function') {
            const url = root.URL.createObjectURL(input), img = new root.Image();
            try {
                await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('decode')); img.src = url; });
                return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => root.URL.revokeObjectURL(url) };
            } catch (e) { root.URL.revokeObjectURL(url); }
        }
        throw fail('This browser cannot decode "' + (file && file.name) + '"' + (/hei[cf]/i.test((file && file.type) + ' ' + (file && file.name)) ? ' (HEIC needs Safari or a decoder: see the decoder option)' : '') + '.', 'IMAGE_DECODE_FAILED');
    }
    function makeCanvas(w, h) {
        if (root.OffscreenCanvas) return new root.OffscreenCanvas(w, h);
        if (!D()) throw fail('No canvas is available here.', 'NO_CANVAS');
        return Object.assign(D().createElement('canvas'), { width: w, height: h });
    }
    function toBlob(canvas, type, quality) {
        return canvas.convertToBlob ? canvas.convertToBlob({ type, quality }) : new Promise(res => canvas.toBlob(res, type, quality));
    }
    function nameFor(name, type) {
        const ext = MIME_EXT[type] || 'jpg', i = String(name || 'image').lastIndexOf('.');
        return (i > 0 ? String(name).slice(0, i) : String(name || 'image')) + '.' + ext;
    }
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    /**
     * Draws a source with crop, rotation, flips and a size limit onto a new canvas. `src` is { source, width, height }.
     * crop { x, y, width, height } is in source pixels; rotate is a multiple of 90 degrees, clockwise.
     */
    function render(src, o) {
        const c = o.crop || {};
        const cx = clamp(Math.round(isNum(c.x) ? c.x : 0), 0, src.width - 1), cy = clamp(Math.round(isNum(c.y) ? c.y : 0), 0, src.height - 1);
        const cw = clamp(Math.round(isNum(c.width) ? c.width : src.width - cx), 1, src.width - cx), ch = clamp(Math.round(isNum(c.height) ? c.height : src.height - cy), 1, src.height - cy);
        const turns = ((Math.round((isNum(o.rotate) ? o.rotate : 0) / 90) % 4) + 4) % 4;
        const sideways = turns % 2 === 1;
        const fullW = sideways ? ch : cw, fullH = sideways ? cw : ch;
        const scale = Math.min(1, isNum(o.maxWidth) && o.maxWidth > 0 ? o.maxWidth / fullW : 1, isNum(o.maxHeight) && o.maxHeight > 0 ? o.maxHeight / fullH : 1);
        const outW = Math.max(1, Math.round(fullW * scale)), outH = Math.max(1, Math.round(fullH * scale));
        const canvas = makeCanvas(outW, outH), ctx = canvas.getContext('2d');
        if (!ctx) throw fail('The canvas has no 2d context.', 'NO_CANVAS');
        if (o.background) { ctx.fillStyle = o.background; ctx.fillRect(0, 0, outW, outH); }
        ctx.save();
        ctx.translate(outW / 2, outH / 2);
        ctx.rotate(turns * Math.PI / 2);
        ctx.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1);
        const dw = (sideways ? outH : outW), dh = (sideways ? outW : outH);
        ctx.drawImage(src.source, cx, cy, cw, ch, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
        return { canvas, width: outW, height: outH };
    }

    function pickType(file, o) {
        if (o.type) return o.type;
        const t = String(file.type || '').toLowerCase();
        return t === 'image/png' || t === 'image/webp' ? t : 'image/jpeg';
    }

    /**
     * Crop, rotate, flip and / or shrink an image; always re-encodes. Returns a new File with `fvTransformed = { from: {width,height,size}, to: {...}, type }`.
     * options: { crop: {x,y,width,height}, rotate: 90, flipH, flipV, maxWidth, maxHeight, type, quality = 0.85, decoder }
     * SVG and GIF are returned unchanged (a canvas would flatten them). Throws { code: 'IMAGE_DECODE_FAILED' } when the file cannot be decoded.
     */
    async function transformImage(file, options) {
        const o = options || {};
        if (!file || typeof file.arrayBuffer !== 'function') throw new TypeError('transformImage: expected a File');
        if (/svg|gif/i.test((file.type || '') + ' ' + (file.name || '')) && !o.type) return file;
        const src = await decode(file, o);
        try {
            const type = pickType(file, o);
            const { canvas, width, height } = render(src, Object.assign({}, o, { background: type === 'image/jpeg' ? '#fff' : o.background }));
            const blob = await toBlob(canvas, type, isNum(o.quality) ? o.quality : 0.85);
            if (!blob) throw fail('The browser could not encode the image as ' + type + '.', 'IMAGE_ENCODE_FAILED');
            const out = new File([blob], nameFor(file.name, blob.type || type), { type: blob.type || type, lastModified: file.lastModified || Date.now() });
            Object.defineProperty(out, 'fvTransformed', { value: { from: { width: src.width, height: src.height, size: file.size }, to: { width, height, size: blob.size }, type: out.type } });
            return out;
        } finally { if (src.close) src.close(); }
    }

    const isHeic = f => /hei[cf]/i.test(String(f && f.type)) || /\.(heic|heif)$/i.test(String(f && f.name || ''));
    /**
     * Re-encode an image as another type (default JPEG), for example an iPhone HEIC photo. options as transformImage plus
     * onlyHeic (true: other formats are returned untouched), onFail ('throw' | 'keep'; keep returns the original when it cannot be decoded).
     */
    async function convertImage(file, options) {
        const o = options || {};
        if (o.onlyHeic && !isHeic(file)) return file;
        try { return await transformImage(file, Object.assign({ type: 'image/jpeg' }, o)); }
        catch (e) { if (o.onFail === 'keep') return file; throw e; }
    }

    // ------------------------------------------------------------------ the cropper dialog
    const TEXTS = { title: 'Crop photo', apply: 'Apply', cancel: 'Cancel', rotateLeft: 'Rotate left', rotateRight: 'Rotate right', flip: 'Flip', reset: 'Reset',
        help: 'Drag the frame or press the arrow keys to move it. Hold Shift for bigger steps. Use + and - to change its size.' };
    const CSS = '.fv-crop-back{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:8px}'
        + '.fv-crop{background:#fff;color:#111;border-radius:8px;max-width:min(96vw,720px);width:100%;max-height:96vh;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;font:14px/1.4 system-ui,sans-serif}'
        + '.fv-crop h2{margin:0;font-size:16px}.fv-crop-help{margin:0;color:#555;font-size:12px}'
        + '.fv-crop-stage{position:relative;overflow:hidden;background:#222;touch-action:none;align-self:center;max-width:100%}'
        + '.fv-crop-stage canvas{display:block;max-width:100%;max-height:60vh;width:auto;height:auto}'
        + '.fv-crop-box{position:absolute;box-sizing:border-box;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.55);cursor:move;outline-offset:2px}'
        + '.fv-crop-box:focus-visible{outline:3px solid #4da3ff}'
        + '.fv-crop-handle{position:absolute;width:20px;height:20px;background:#fff;border:2px solid #333;box-sizing:border-box;border-radius:50%;touch-action:none}'
        + '.fv-crop-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between}.fv-crop-row button{font:inherit;padding:6px 12px;border:1px solid #888;border-radius:6px;background:#f4f4f4;cursor:pointer}'
        + '.fv-crop-row .fv-crop-apply{background:#0b5fff;color:#fff;border-color:#0b5fff}';

    /**
     * A dialog to crop (and rotate / flip) one image. Resolves to the new File, or null when the person cancels (Esc or the Cancel button).
     * options: { aspectRatio: 1 | 16/9 | 'free' (default free), maxWidth, maxHeight, type, quality, decoder, texts: { title, apply, cancel, rotateLeft, rotateRight, flip, reset, help }, parent }
     * Keyboard: arrows move the frame (Shift: 10x), + and - resize it, Enter applies, Esc cancels, Tab stays inside the dialog.
     */
    async function cropper(file, options) {
        const o = options || {};
        const doc = D();
        if (!doc) throw fail('cropper needs a browser.', 'NO_DOCUMENT');
        const T = Object.assign({}, TEXTS, o.texts);
        const src = await decode(file, o);
        const ratio = isNum(o.aspectRatio) && o.aspectRatio > 0 ? o.aspectRatio : null;
        let canvas = null;       // the full image with the rotation / flip applied
        let turns = 0, flipH = false;
        let crop = { x: 0, y: 0, w: 1, h: 1 };   // fractions of the canvas
        const rebuild = () => {
            canvas = render(src, { rotate: turns * 90, flipH, maxWidth: 2400, maxHeight: 2400 }).canvas;
            const cw = canvas.width, ch = canvas.height;
            let w = 0.8, h = 0.8;
            if (ratio) { const r = (ratio * ch) / cw; if (r > 1) { w = 0.8; h = 0.8 / r; } else { h = 0.8; w = 0.8 * r; } }
            crop = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
        };
        rebuild();

        const back = doc.createElement('div'); back.className = 'fv-crop-back';
        const style = doc.createElement('style'); style.textContent = CSS; back.appendChild(style);
        const dlg = doc.createElement('div'); dlg.className = 'fv-crop'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true');
        const titleId = 'fv-crop-title-' + Math.random().toString(36).slice(2, 8);
        dlg.setAttribute('aria-labelledby', titleId);
        const h2 = doc.createElement('h2'); h2.id = titleId; h2.textContent = T.title;
        const help = doc.createElement('p'); help.className = 'fv-crop-help'; help.id = titleId + '-help'; help.textContent = T.help;
        const stage = doc.createElement('div'); stage.className = 'fv-crop-stage';
        const view = doc.createElement('canvas');
        const box = doc.createElement('div'); box.className = 'fv-crop-box'; box.tabIndex = 0; box.setAttribute('role', 'group');
        box.setAttribute('aria-label', T.title); box.setAttribute('aria-describedby', help.id);
        const live = doc.createElement('div'); live.setAttribute('aria-live', 'polite'); live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';
        const handles = ['nw', 'ne', 'sw', 'se'].map(pos => {
            const hd = doc.createElement('div'); hd.className = 'fv-crop-handle'; hd.setAttribute('data-handle', pos); hd.setAttribute('aria-hidden', 'true');
            hd.style.cssText = (pos[0] === 'n' ? 'top:-10px;' : 'bottom:-10px;') + (pos[1] === 'w' ? 'left:-10px;cursor:nwse-resize' : 'right:-10px;cursor:nesw-resize');
            if (pos === 'ne' || pos === 'sw') hd.style.cursor = 'nesw-resize'; else hd.style.cursor = 'nwse-resize';
            box.appendChild(hd); return hd;
        });
        stage.appendChild(view); stage.appendChild(box); stage.appendChild(live);
        const row = doc.createElement('div'); row.className = 'fv-crop-row';
        const mk = (text, cls) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = text; if (cls) b.className = cls; return b; };
        const bLeft = mk(T.rotateLeft), bRight = mk(T.rotateRight), bFlip = mk(T.flip), bReset = mk(T.reset), bCancel = mk(T.cancel), bApply = mk(T.apply, 'fv-crop-apply');
        const tools = doc.createElement('span'), actions = doc.createElement('span');
        [bLeft, bRight, bFlip, bReset].forEach(b => { tools.appendChild(b); tools.appendChild(doc.createTextNode(' ')); });
        [bCancel, bApply].forEach(b => { actions.appendChild(b); actions.appendChild(doc.createTextNode(' ')); });
        row.appendChild(tools); row.appendChild(actions);
        [h2, help, stage, row].forEach(n => dlg.appendChild(n));
        back.appendChild(dlg);

        function paint() {
            view.width = canvas.width; view.height = canvas.height;
            const vctx = view.getContext('2d');
            if (vctx) vctx.drawImage(canvas, 0, 0);
            place();
        }
        function place() {
            box.style.left = crop.x * 100 + '%'; box.style.top = crop.y * 100 + '%'; box.style.width = crop.w * 100 + '%'; box.style.height = crop.h * 100 + '%';
            live.textContent = Math.round(crop.w * canvas.width) + ' by ' + Math.round(crop.h * canvas.height) + ' pixels';
        }
        function fit() {                       // keep the box inside the canvas and (when asked) at the aspect ratio
            crop.w = clamp(crop.w, 0.05, 1); crop.h = clamp(crop.h, 0.05, 1);
            crop.x = clamp(crop.x, 0, 1 - crop.w); crop.y = clamp(crop.y, 0, 1 - crop.h);
        }
        function resizeBy(dw, dh, anchor) {   // anchor: which corner stays still ('nw' = top-left fixed)
            let w = crop.w + dw, h = crop.h + dh;
            if (ratio) { const r = (ratio * canvas.height) / canvas.width; h = w / r; if (h > 1) { h = 1; w = r; } if (w > 1) { w = 1; h = 1 / r; } }
            w = clamp(w, 0.05, 1); h = clamp(h, 0.05, 1);
            const right = crop.x + crop.w, bottom = crop.y + crop.h;
            crop.w = w; crop.h = h;
            if (anchor[1] === 'e') crop.x = right - w;
            if (anchor[0] === 's') crop.y = bottom - h;
            fit(); place();
        }
        let drag = null;
        const rect = () => view.getBoundingClientRect();
        const onDown = e => {
            const handle = e.target && e.target.getAttribute && e.target.getAttribute('data-handle');
            drag = { mode: handle ? 'resize' : 'move', handle, x: e.clientX, y: e.clientY, start: Object.assign({}, crop) };
            if (box.setPointerCapture && e.pointerId !== undefined) { try { box.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event */ } }
            e.preventDefault(); box.focus();
        };
        const onMove = e => {
            if (!drag) return;
            const r = rect(); if (!r.width || !r.height) return;
            const dx = (e.clientX - drag.x) / r.width, dy = (e.clientY - drag.y) / r.height;
            if (drag.mode === 'move') { crop.x = drag.start.x + dx; crop.y = drag.start.y + dy; fit(); place(); return; }
            crop = Object.assign({}, drag.start);
            const east = drag.handle[1] === 'e', south = drag.handle[0] === 's';
            resizeBy(east ? dx : -dx, south ? dy : -dy, (south ? 'n' : 's') + (east ? 'w' : 'e'));
        };
        const onUp = () => { drag = null; };
        box.addEventListener('pointerdown', onDown); box.addEventListener('pointermove', onMove); box.addEventListener('pointerup', onUp); box.addEventListener('pointercancel', onUp);

        const onKey = e => {
            const step = (e.shiftKey ? 0.1 : 0.01);
            if (e.target === box) {
                if (e.key === 'ArrowLeft') { crop.x -= step; fit(); place(); e.preventDefault(); }
                else if (e.key === 'ArrowRight') { crop.x += step; fit(); place(); e.preventDefault(); }
                else if (e.key === 'ArrowUp') { crop.y -= step; fit(); place(); e.preventDefault(); }
                else if (e.key === 'ArrowDown') { crop.y += step; fit(); place(); e.preventDefault(); }
                else if (e.key === '+' || e.key === '=') { resizeBy(step, step, 'nw'); e.preventDefault(); }
                else if (e.key === '-' || e.key === '_') { resizeBy(-step, -step, 'nw'); e.preventDefault(); }
            }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); }
            else if (e.key === 'Enter' && e.target === box) { e.preventDefault(); apply(); }
            else if (e.key === 'Tab') {        // keep focus inside the dialog
                const items = Array.from(dlg.querySelectorAll('button,[tabindex="0"]')).filter(n => !n.disabled);
                if (!items.length) return;
                const first = items[0], last = items[items.length - 1];
                if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };

        const previous = doc.activeElement;
        let done = null;
        const result = new Promise(res => { done = res; });
        function finish(file2) {
            doc.removeEventListener('keydown', onKey, true);
            if (back.parentNode) back.parentNode.removeChild(back);
            if (src.close) src.close();
            if (previous && previous.focus) { try { previous.focus(); } catch (e) { /* gone */ } }
            done(file2);
        }
        async function apply() {
            bApply.disabled = true;
            try {
                const type = pickType(file, o);
                const out = render({ source: canvas, width: canvas.width, height: canvas.height }, {
                    crop: { x: crop.x * canvas.width, y: crop.y * canvas.height, width: crop.w * canvas.width, height: crop.h * canvas.height },
                    maxWidth: o.maxWidth, maxHeight: o.maxHeight, background: type === 'image/jpeg' ? '#fff' : undefined
                });
                const blob = await toBlob(out.canvas, type, isNum(o.quality) ? o.quality : 0.85);
                if (!blob) throw new Error('encode');
                const f = new File([blob], nameFor(file.name, blob.type || type), { type: blob.type || type, lastModified: Date.now() });
                Object.defineProperty(f, 'fvTransformed', { value: { from: { width: src.width, height: src.height, size: file.size }, to: { width: out.width, height: out.height, size: blob.size }, type: f.type, rotate: turns * 90, flipH } });
                finish(f);
            } catch (e) { bApply.disabled = false; finish(null); }
        }
        bApply.addEventListener('click', apply);
        bCancel.addEventListener('click', () => finish(null));
        bLeft.addEventListener('click', () => { turns = (turns + 3) % 4; rebuild(); paint(); });
        bRight.addEventListener('click', () => { turns = (turns + 1) % 4; rebuild(); paint(); });
        bFlip.addEventListener('click', () => { flipH = !flipH; rebuild(); paint(); });
        bReset.addEventListener('click', () => { turns = 0; flipH = false; rebuild(); paint(); });
        back.addEventListener('mousedown', e => { if (e.target === back) finish(null); });
        doc.addEventListener('keydown', onKey, true);
        (o.parent || doc.body).appendChild(back);
        paint();
        box.focus();
        return result;
    }

    // ------------------------------------------------------------------ camera / chooser
    /**
     * Opens the phone camera (or the file chooser on a computer) and resolves to a File, or null when nothing was taken.
     * options: { accept: 'image/*', camera: 'environment' | 'user' | false, multiple: false, ...transformImage options (maxWidth, quality, type) when `process` is not false }
     * Must be called from a click or another user gesture. `multiple: true` resolves to an array.
     */
    function capture(options) {
        const o = options || {};
        const doc = D();
        if (!doc) return Promise.reject(fail('capture needs a browser.', 'NO_DOCUMENT'));
        return new Promise((resolve, reject) => {
            const input = doc.createElement('input');
            input.type = 'file'; input.accept = o.accept || 'image/*'; input.multiple = !!o.multiple;
            if (o.camera !== false) input.setAttribute('capture', o.camera === 'user' ? 'user' : 'environment');
            input.style.cssText = 'position:fixed;left:-9999px;opacity:0';
            input.setAttribute('aria-hidden', 'true'); input.tabIndex = -1;
            let settled = false;
            const cleanup = () => { if (input.parentNode) input.parentNode.removeChild(input); };
            const settle = v => { if (settled) return; settled = true; cleanup(); resolve(v); };
            input.addEventListener('change', async () => {
                const files = Array.from(input.files || []);
                if (!files.length) return settle(o.multiple ? [] : null);
                try {
                    const wants = o.maxWidth || o.maxHeight || o.type || o.crop || o.rotate;
                    const processed = o.process === false ? files : await Promise.all(files.map(f => (/^image\//.test(f.type) || isHeic(f)) && (wants || isHeic(f)) ? convertImage(f, Object.assign({ onFail: 'keep' }, o, { type: o.type || (isHeic(f) ? 'image/jpeg' : undefined) })) : f));
                    settle(o.multiple ? processed : processed[0]);
                } catch (e) { if (!settled) { settled = true; cleanup(); reject(e); } }
            });
            input.addEventListener('cancel', () => settle(o.multiple ? [] : null));
            doc.body.appendChild(input);
            input.click();
        });
    }

    transformImage.__fv = true;
    Object.assign(FV, { transformImage, convertImage, convertHeic: (file, o) => convertImage(file, Object.assign({ onlyHeic: true }, o)), cropper, capture, isHeic });
    return FV;
});
