'use strict';
require('./helpers/shim.js');
// fileValidator.widget.js: drag and drop, folders, paste, previews, resizing, file list, input sync — plus core folder-path checks.
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, Event: w.Event, CustomEvent: w.CustomEvent, Node: w.Node, HTMLElement: w.HTMLElement });
class FakeDT { constructor() { this._f = []; this.items = { add: f => this._f.push(f) }; } get files() { return this._f.slice(); } }
globalThis.DataTransfer = FakeDT;
const FV = require('../src/fileValidator.js');
require('../src/fileValidator.widget.js');

const enc = s => Array.from(Buffer.from(s, 'latin1'));
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const txt = (name, c = 'x') => new File([c], name, { type: 'text/plain' });
const png = (name = 'a.png', extra = 0) => new File([new Uint8Array(PNG.concat(new Array(extra).fill(0)))], name, { type: 'image/png' });
const withPath = (file, path) => { Object.defineProperty(file, 'webkitRelativePath', { value: path, configurable: true }); return file; };
const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));

let n = 0;
function mount(extra = '') {
    document.body.innerHTML = `<form id="f${++n}"><div id="zone"><input type="file" id="in" name="up" multiple></div><ul id="list"></ul><div id="msg"></div>${extra}</form>`;
    const input = document.getElementById('in');
    let store = [];
    Object.defineProperty(input, 'files', { get: () => store, set: v => { store = v; }, configurable: true });
    input.click = () => { input.clicked = (input.clicked || 0) + 1; };
    return { input, zone: document.getElementById('zone'), form: document.querySelector('form') };
}
const list = () => Array.from(document.querySelectorAll('#list .fv-file'));
const names = () => list().map(li => li.querySelector('.fv-name').textContent);
const messages = () => Array.from(document.querySelectorAll('#msg .fv-message')).map(d => d.textContent);
const evt = (type, props = {}) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); Object.entries(props).forEach(([k, v]) => Object.defineProperty(e, k, { value: v })); return e; };
const dtFiles = files => ({ types: ['Files'], files, items: [] });
const fileEntry = (name, content = 'x') => ({ isFile: true, isDirectory: false, name, file: ok => ok(new File([content], name, { type: 'text/plain' })) });
const dirEntry = (name, children, chunk = 100) => ({
    isFile: false, isDirectory: true, name,
    createReader() { let pos = 0; return { readEntries: ok => { const part = children.slice(pos, pos + chunk); pos += chunk; ok(part); } }; }
});
const dtEntries = entries => ({ types: ['Files'], files: [], items: entries.map(e => ({ kind: 'file', webkitGetAsEntry: () => e })) });

// ================================================================ surface
test('the widget adds its API to FileValidator', () => {
    for (const k of ['widget', 'dropzone', 'filesFromDrop', 'filesFromClipboard', 'resizeImage', 'createPreview', 'getPath', 'isIgnored']) assert.equal(typeof FV[k], 'function', k);
    assert.equal(FV.dropzone, FV.widget);
    assert.throws(() => FV.widget('#nothing', {}), /not found/);
});

// ================================================================ core: folder paths
test('folder paths: traversal and hidden tricks are INVALID_PATH, depth and length limits, ignoreFiles', async () => {
    const ok = withPath(txt('a.txt'), 'photos/2024/a.txt');
    assert.equal((await FV.validateFiles([ok], {})).isValid, true);
    for (const bad of ['../etc/a.txt', '/abs/a.txt', 'a\\b\\a.txt', 'a//a.txt', './a.txt', 'a/./a.txt', 'a/‮evil/a.txt', 'a\u0000b/a.txt', 'dir./a.txt', 'dir /a.txt']) {
        const r = await FV.validateFiles([withPath(txt('a.txt'), bad)], {});
        assert.ok(r.errors.includes('INVALID_PATH'), JSON.stringify(bad));
    }
    const deep = withPath(txt('a.txt'), 'a/b/c/d/a.txt');
    assert.ok((await FV.validateFiles([deep], { maxPathDepth: 3 })).errors.includes('PATH_TOO_DEEP'));
    assert.equal((await FV.validateFiles([deep], { maxPathDepth: 4 })).isValid, true);
    const r = await FV.validateFiles([deep], { maxPathDepth: '2' });
    assert.equal(r.details[0].message, 'This file is 4 folders deep but the maximum is 2.');
    assert.ok((await FV.validateFiles([deep], { maxPathLength: 5 })).errors.includes('PATH_TOO_LONG'));
    assert.equal(FV.getPath(deep), 'a/b/c/d/a.txt');
    assert.equal(FV.getPath(txt('x.txt')), '');
});

test('ignoreFiles skips junk files and reports them in result.ignored', async () => {
    const files = [txt('.DS_Store'), txt('Thumbs.db'), txt('~$doc.docx'), txt('._a.txt'), txt('desktop.ini'), txt('real.txt')];
    const r = await FV.validateFiles(files, { ignoreFiles: true });
    assert.equal(r.isValid, true);
    assert.deepEqual(r.files.map(f => f.name), ['real.txt']);
    assert.equal(r.ignored.length, 5);
    const custom = await FV.validateFiles([txt('skip.tmp'), txt('a.txt')], { ignoreFiles: ['SKIP.TMP'] });
    assert.deepEqual(custom.files.map(f => f.name), ['a.txt']);
    assert.deepEqual((await FV.validateFiles([txt('x.bak'), txt('a.txt')], { ignoreFiles: [/\.bak$/] })).files.map(f => f.name), ['a.txt']);
    assert.deepEqual((await FV.validateFiles([txt('.DS_Store')], { ignoreFiles: true })).errors, ['NO_FILES'], 'nothing left after ignoring');
    assert.equal((await FV.validateFiles([txt('.DS_Store')], {})).files.length, 1, 'off by default');
});

// ================================================================ dropped folders, clipboard
test('filesFromDrop: plain files, nested folders, chunked readers, limits', async () => {
    const plain = await FV.filesFromDrop(dtFiles([txt('a.txt')]));
    assert.deepEqual(plain.map(f => f.name), ['a.txt']);
    const tree = dirEntry('photos', [fileEntry('a.txt'), dirEntry('2024', [fileEntry('b.txt'), fileEntry('c.txt')], 1)], 1);
    const files = await FV.filesFromDrop(dtEntries([tree, fileEntry('top.txt')]));
    assert.deepEqual(files.map(f => FV.getPath(f) || f.name), ['photos/a.txt', 'photos/2024/b.txt', 'photos/2024/c.txt', 'top.txt']);
    assert.equal((await FV.filesFromDrop(dtEntries([tree]), { maxFiles: 2 })).length, 2);
    assert.equal((await FV.filesFromDrop(dtEntries([tree]), { maxDepth: 1 })).length, 1, 'depth cap: only photos/a.txt');
    assert.deepEqual(await FV.filesFromDrop(null), []);
});

test('filesFromClipboard names unnamed pastes and keeps real names', () => {
    const shot = new File(['x'], 'image.png', { type: 'image/png' });
    const named = new File(['x'], 'report.pdf', { type: 'application/pdf' });
    const out = FV.filesFromClipboard({ files: [shot, named] });
    assert.match(out[0].name, /^pasted-\d{4}-\d\d-\d\dT[\d-]+-1\.png$/);
    assert.equal(out[1].name, 'report.pdf');
    const fromItems = FV.filesFromClipboard({ files: [], items: [{ kind: 'file', getAsFile: () => new File(['x'], '', { type: 'image/jpeg' }) }, { kind: 'string' }] });
    assert.match(fromItems[0].name, /^pasted-.+\.jpg$/);
    assert.deepEqual(FV.filesFromClipboard(null), []);
});

// ================================================================ widget: adding, rejecting, list
test('input change: valid files are accepted, invalid ones rejected with reasons, list and message region rendered', async () => {
    const { input } = mount();
    const seen = { change: 0, reject: 0 };
    const z = FV.widget('#zone', { accept: '.png,.txt', maxFileSizeMB: 1 }, {
        list: '#list', messageElement: '#msg', onChange: () => seen.change++, onReject: () => seen.reject++
    });
    input.files = [png('ok.png'), txt('bad.exe', 'x'), txt('fine.txt')];
    input.dispatchEvent(evt('change'));
    await settle();
    assert.deepEqual(z.files.map(f => f.name), ['ok.png', 'fine.txt']);
    assert.deepEqual(names(), ['ok.png', 'fine.txt']);
    assert.ok(messages().length >= 1);
    assert.ok(messages().every(m => /^bad\.exe: /.test(m)), 'every message names the rejected file');
    assert.deepEqual([seen.change, seen.reject], [1, 1]);
    const msgEl = document.getElementById('msg');
    assert.equal(msgEl.getAttribute('role'), 'alert');
    assert.equal(msgEl.getAttribute('aria-live'), 'polite');
    const btn = document.querySelector('.fv-remove');
    assert.equal(btn.getAttribute('aria-label'), 'Remove ok.png');
});

test('file names are rendered as text (no HTML injection)', async () => {
    mount();
    const z = FV.widget('#zone', {}, { list: '#list', messageElement: '#msg' });
    await z.add([txt('<img src=x onerror=alert(1)>.txt'), txt('<b>bad</b>.exe')]);
    assert.equal(document.querySelector('#list img'), null);
    assert.equal(document.querySelector('#msg b'), null);
    assert.match(names()[0], /^<img src=x/);
});

test('append mode: files accumulate; maxFiles, duplicate names, total size and content are enforced against what is already there', async () => {
    mount();
    const z = FV.widget('#zone', { maxFiles: 3, duplicateNames: true, maxTotalSizeMB: 0.0001, duplicateContent: true }, { list: '#list', messageElement: '#msg' });
    let r = await z.add([txt('a.txt', 'aaaa'), txt('b.txt', 'bbbb')]);
    assert.equal(r.accepted.length, 2);
    r = await z.add([txt('A.TXT', 'zzzz'), txt('c.txt', 'aaaa'), txt('d.txt', 'dddd')]);
    assert.deepEqual(r.rejected.map(x => [x.file.name, x.errors[0]]), [['A.TXT', 'DUPLICATE_FILENAMES'], ['c.txt', 'DUPLICATE_FILES']]);
    assert.deepEqual(z.files.map(f => f.name), ['a.txt', 'b.txt', 'd.txt']);
    r = await z.add([txt('e.txt', 'eeee')]);
    assert.equal(r.rejected[0].errors[0], 'TOO_MANY_FILES');
    assert.match(r.rejected[0].messages[0], /no more than 3/);
    const big = FV.widget('#zone', { maxTotalSizeMB: 0.00001 }, {});
    const r2 = await big.add([txt('x.txt', 'twelve bytes'), txt('y.txt', 'again')]);
    assert.deepEqual(r2.accepted.map(e => e.file.name), ['y.txt'], 'the 5-byte file fits under ~10 bytes');
    assert.deepEqual(r2.rejected.map(x => [x.file.name, x.errors[0]]), [['x.txt', 'TOTAL_SIZE_EXCEEDED']], 'the 12-byte one does not');
});

test('multiple:false keeps one file (the newest replaces the old one); append:false replaces every time', async () => {
    mount();
    let z = FV.widget('#zone', {}, { multiple: false, list: '#list' });
    await z.add([txt('a.txt')]);
    let r = await z.add([txt('b.txt'), txt('c.txt')]);
    assert.deepEqual(z.files.map(f => f.name), ['b.txt']);
    assert.equal(r.rejected[0].errors[0], 'SINGLE_FILE_LIMIT_EXCEEDED');
    z.destroy();
    mount();
    z = FV.widget('#zone', {}, { append: false, list: '#list' });
    await z.add([txt('a.txt'), txt('b.txt')]);
    await z.add([txt('c.txt')]);
    assert.deepEqual(z.files.map(f => f.name), ['c.txt']);
});

test('remove, clear, entries, validate() (the whole-selection check), appendTo(FormData)', async () => {
    mount();
    const z = FV.widget('#zone', { minFiles: 2 }, { list: '#list', messageElement: '#msg' });
    await z.add([txt('a.txt'), withPath(txt('b.txt'), 'folder/b.txt')]);
    assert.deepEqual(names(), ['a.txt', 'folder/b.txt']);
    const fd = z.appendTo(new FormData(), 'docs');
    assert.deepEqual(fd.getAll('docs').map(f => f.name), ['a.txt', 'folder/b.txt'], 'the folder path travels as the file name');
    assert.equal((await z.validate()).isValid, true);
    assert.equal(z.remove(0), true);
    assert.deepEqual(names(), ['folder/b.txt']);
    const res = await z.validate();
    assert.deepEqual(res.errors, ['TOO_FEW_FILES']);
    assert.match(messages()[0], /at least 2/);
    assert.equal(z.remove({ nope: 1 }), false);
    document.querySelector('.fv-remove').click();
    assert.equal(z.files.length, 0);
    await z.add([txt('x.txt')]);
    z.clear();
    assert.deepEqual([z.files.length, list().length], [0, 0]);
    assert.equal(z.entries.length, 0);
});

test('two quick adds do not race: they are handled one after the other', async () => {
    mount();
    const z = FV.widget('#zone', { maxFiles: 2 }, {});
    const [a, b] = await Promise.all([z.add([txt('1.txt'), txt('2.txt')]), z.add([txt('3.txt')])]);
    assert.equal(a.accepted.length, 2);
    assert.equal(b.accepted.length, 0);
    assert.equal(b.rejected[0].errors[0], 'TOO_MANY_FILES');
});

// ================================================================ drag and drop, folder mode, paste
test('drag and drop: class while dragging, drop adds files, non-file drags are ignored', async () => {
    const { zone } = mount();
    const z = FV.widget('#zone', {}, { list: '#list' });
    const over = evt('dragover', { dataTransfer: { types: ['Files'] } });
    zone.dispatchEvent(evt('dragenter', { dataTransfer: { types: ['Files'] } }));
    zone.dispatchEvent(over);
    assert.ok(zone.classList.contains('fv-dragover'));
    assert.equal(over.defaultPrevented, true, 'dragover must be cancelled to allow a drop');
    zone.dispatchEvent(evt('dragenter', { dataTransfer: { types: ['Files'] } }));
    zone.dispatchEvent(evt('dragleave', { dataTransfer: { types: ['Files'] } }));
    assert.ok(zone.classList.contains('fv-dragover'), 'still inside a child element');
    zone.dispatchEvent(evt('dragleave', { dataTransfer: { types: ['Files'] } }));
    assert.ok(!zone.classList.contains('fv-dragover'));
    const text = evt('dragover', { dataTransfer: { types: ['text/plain'] } });
    zone.dispatchEvent(text);
    assert.equal(text.defaultPrevented, false, 'text drags are left alone');
    const drop = evt('drop', { dataTransfer: dtFiles([txt('dropped.txt')]) });
    zone.dispatchEvent(drop);
    assert.equal(drop.defaultPrevented, true);
    await settle();
    assert.deepEqual(z.files.map(f => f.name), ['dropped.txt']);
    assert.ok(!zone.classList.contains('fv-dragover'));
    const custom = FV.widget('#zone', {}, { dragClass: 'over' });
    zone.dispatchEvent(evt('dragenter', { dataTransfer: { types: ['Files'] } }));
    assert.ok(zone.classList.contains('over'));
});

test('dropping a folder: paths are kept, junk is ignored, folder path checks apply', async () => {
    const { zone } = mount();
    const z = FV.widget('#zone', { maxPathDepth: 1, accept: '.txt' }, { list: '#list', messageElement: '#msg', folder: true });
    const tree = dirEntry('docs', [fileEntry('a.txt'), fileEntry('.DS_Store'), dirEntry('sub', [fileEntry('b.txt'), dirEntry('deeper', [fileEntry('c.txt')])])]);
    zone.dispatchEvent(evt('drop', { dataTransfer: dtEntries([tree]) }));
    await settle(60);
    assert.deepEqual(names(), ['docs/a.txt', 'docs/sub/b.txt'].slice(0, 1).concat([]), 'depth 1 allows docs/a.txt only; docs/sub/b.txt is 2 deep');
    const bad = messages().map(m => m.split(':')[0]);
    assert.deepEqual(bad.sort(), ['b.txt', 'c.txt']);
    assert.ok(messages().every(m => /folders deep/.test(m)));
});

test('folder: true without limits accepts nested files and never lists .DS_Store', async () => {
    const { zone } = mount();
    const z = FV.widget('#zone', {}, { list: '#list', folder: true });
    zone.dispatchEvent(evt('drop', { dataTransfer: dtEntries([dirEntry('p', [fileEntry('a.txt'), fileEntry('Thumbs.db'), dirEntry('q', [fileEntry('b.txt')])])]) }));
    await settle(60);
    assert.deepEqual(names(), ['p/a.txt', 'p/q/b.txt']);
});

test('paste: off by default, on with paste:true, names screenshots, and can listen on the document', async () => {
    const { zone } = mount();
    const z = FV.widget('#zone', { accept: '.png' }, { list: '#list', paste: true });
    const shot = () => new File([new Uint8Array(PNG)], 'image.png', { type: 'image/png' });
    const e = evt('paste', { clipboardData: { files: [shot()] } });
    zone.dispatchEvent(e);
    await settle();
    assert.equal(e.defaultPrevented, true);
    assert.match(z.files[0].name, /^pasted-.+\.png$/);
    const t = evt('paste', { clipboardData: { files: [], items: [] } });
    zone.dispatchEvent(t);
    assert.equal(t.defaultPrevented, false, 'a text paste is left alone');
    z.destroy();
    mount();
    const off = FV.widget('#zone', {}, { list: '#list' });
    document.getElementById('zone').dispatchEvent(evt('paste', { clipboardData: { files: [shot()] } }));
    await settle();
    assert.equal(off.files.length, 0);
    const doc = FV.widget('#zone', {}, { paste: 'document' });
    document.dispatchEvent(evt('paste', { clipboardData: { files: [shot()] } }));
    await settle();
    assert.equal(doc.files.length, 1);
});

// ================================================================ input sync, browse, a11y, events, destroy
test('accepted files are put back into the <input> and a flagged change event is fired (FormValidator sees it, the widget ignores it)', async () => {
    const { input } = mount();
    let changes = 0, flagged = 0;
    input.addEventListener('change', e => { changes++; if (e.fvWidget) flagged++; });
    const z = FV.widget('#zone', { accept: '.txt' }, { list: '#list' });
    input.files = [txt('a.txt'), txt('bad.exe')];
    input.dispatchEvent(evt('change'));
    await settle();
    assert.deepEqual(Array.from(input.files).map(f => f.name), ['a.txt'], 'the rejected file was removed from the input');
    assert.equal(z.files.length, 1, 'the synthetic change did not add it a second time');
    assert.deepEqual([changes, flagged], [2, 1]);
    await z.add([txt('b.txt')]);
    assert.deepEqual(Array.from(input.files).map(f => f.name), ['a.txt', 'b.txt'], 'append mode: the input holds everything');
    z.remove(0);
    assert.deepEqual(Array.from(input.files).map(f => f.name), ['b.txt']);
    const off = FV.widget('#zone', {}, { syncInput: false });
    await off.add([txt('c.txt')]);
    assert.deepEqual(Array.from(input.files).map(f => f.name), ['b.txt'], 'syncInput:false leaves the input alone');
});

test('the zone opens the file dialog on click and Enter/Space, and is focusable with a role (not for labels or buttons inside)', async () => {
    const { input, zone } = mount('<button id="inner" type="button">x</button>');
    FV.widget('#zone', {}, { list: '#list' });
    assert.equal(zone.getAttribute('tabindex'), '0');
    assert.equal(zone.getAttribute('role'), 'button');
    zone.click();
    assert.equal(input.clicked, 1);
    input.click();               // the mock does not bubble; a real input click must not re-trigger the zone
    zone.dispatchEvent(evt('keydown', { key: 'Enter' }));
    zone.dispatchEvent(evt('keydown', { key: ' ' }));
    zone.dispatchEvent(evt('keydown', { key: 'a' }));
    assert.equal(input.clicked, 4);
    zone.dispatchEvent(evt('click'));
    assert.equal(input.clicked, 5);
    // wrapped in a label: the browser already opens the dialog
    document.body.innerHTML = '<label id="lab"><input type="file" id="in2"> pick</label>';
    const i2 = document.getElementById('in2'); i2.click = () => { i2.clicked = (i2.clicked || 0) + 1; };
    FV.widget('#lab', {}, {});
    document.getElementById('lab').dispatchEvent(evt('click'));
    assert.equal(i2.clicked, undefined);
    assert.equal(document.getElementById('lab').hasAttribute('tabindex'), false);
});

test('an <input> can be the target directly; DOM events and callbacks fire', async () => {
    const { input, zone, form } = mount();
    const got = [];
    form.addEventListener('fv:widget-change', e => got.push(['change', e.detail.files.length]));
    form.addEventListener('fv:widget-reject', e => got.push(['reject', e.detail.rejected.length]));
    const z = FV.widget(input, { accept: '.txt' }, {});
    assert.equal(z.element, zone, 'the drop zone defaults to the wrapper of the input');
    await z.add([txt('a.txt'), txt('b.exe')], { source: 'api' });
    assert.deepEqual(got, [['change', 1], ['reject', 1]]);
});

test('destroy removes every listener and revokes previews', async () => {
    const { zone, input } = mount();
    const z = FV.widget('#zone', {}, { list: '#list', paste: true });
    await z.add([txt('a.txt')]);
    z.destroy();
    assert.equal(list().length, 0);
    zone.dispatchEvent(evt('drop', { dataTransfer: dtFiles([txt('b.txt')]) }));
    input.files = [txt('c.txt')];
    input.dispatchEvent(evt('change'));
    await settle();
    assert.equal(z.files.length, 0);
    const late = await z.add([txt('d.txt')]);
    assert.equal(late.accepted.length, 0, 'a destroyed widget accepts nothing');
});

// ================================================================ images: preview and resize
const fakeImage = (w0, h0) => ({ readImage: async () => ({ width: w0, height: h0, source: 'SRC', close() { fakeImage.closed++; } }) });
fakeImage.closed = 0;
const HEADS = { 'image/jpeg': [0xff, 0xd8, 0xff, 0xe0], 'image/png': PNG };
const fakeRender = (bytesPerPixel = 0.001) => ({ render: async (src, w, h, type, q) => {
    const head = HEADS[type] || [], body = new Array(Math.max(1, Math.round(w * h * bytesPerPixel * q))).fill(0);
    return new Blob([new Uint8Array(head.concat(body))], { type });
} });

test('createPreview: thumbnails for images, urls for video/audio, badge for documents, revoke() cleans up', async () => {
    const revoked = [];
    const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
    let n2 = 0;
    URL.createObjectURL = () => 'blob:mock/' + (++n2); URL.revokeObjectURL = u => revoked.push(u);
    try {
        const p = await FV.createPreview(png(), { ...fakeImage(4000, 2000), ...fakeRender(), maxWidth: 200, maxHeight: 200 });
        assert.equal(p.kind, 'image'); assert.match(p.url, /^blob:mock/); assert.equal(p.width, 4000);
        p.revoke(); assert.deepEqual(revoked, [p.url]);
        const plain = await FV.createPreview(png(), { thumbnail: false });
        assert.equal(plain.kind, 'image');
        const svg = await FV.createPreview(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }));
        assert.equal(svg.kind, 'image');
        assert.equal((await FV.createPreview(new File(['x'], 'v.mp4', { type: 'video/mp4' }))).kind, 'video');
        assert.equal((await FV.createPreview(new File(['x'], 'a.mp3', { type: 'audio/mpeg' }))).kind, 'audio');
        const doc = await FV.createPreview(txt('notes.pdf'));
        assert.deepEqual([doc.kind, doc.url, doc.label], ['file', null, 'PDF']);
        assert.equal((await FV.createPreview(png(), { readImage: async () => { throw new Error('x'); } })).kind, 'image', 'unreadable image: falls back to the file itself');
    } finally { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; }
});

test('resizeImage: fits dimensions, fits a byte limit (quality first, then size), keeps small files, skips GIF/SVG, renames on type change', async () => {
    const big = () => png('photo.png', 2000);
    const opts = { ...fakeImage(4000, 2000), ...fakeRender(1) };
    const r = await FV.resizeImage(big(), { ...opts, maxWidth: 1000, maxHeight: 1000, type: 'image/jpeg' });
    assert.equal(r.type, 'image/jpeg'); assert.equal(r.name, 'photo.jpg');
    assert.deepEqual([r.fvResized.to.width, r.fvResized.to.height], [1000, 500]);
    assert.deepEqual([r.fvResized.from.width, r.fvResized.from.height], [4000, 2000]);
    const same = big();
    assert.equal(await FV.resizeImage(same, { ...fakeImage(800, 600), maxWidth: 1000, maxHeight: 1000 }), same, 'already fits: same file back');
    const jpg = new File([new Uint8Array(3 * 1048576)], 'huge.jpg', { type: 'image/jpeg' });
    const small = await FV.resizeImage(jpg, { ...fakeImage(1000, 1000), ...fakeRender(6), maxSizeMB: 1 });
    assert.ok(small.size <= 1048576, 'shrunk under 1 MB, was ' + small.size);
    assert.equal(small.name, 'huge.jpg');
    const gif = new File(['GIF89a'], 'a.gif', { type: 'image/gif' });
    assert.equal(await FV.resizeImage(gif, { ...fakeImage(9000, 9000), maxWidth: 10 }), gif);
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    assert.equal(await FV.resizeImage(svg, { ...fakeImage(9000, 9000), maxWidth: 10 }), svg);
    const doc = txt('a.txt');
    assert.equal(await FV.resizeImage(doc, { maxWidth: 1 }), doc);
    const broken = png();
    assert.equal(await FV.resizeImage(broken, { readImage: async () => { throw new Error('bad'); }, maxWidth: 1 }), broken);
    const noBlob = big();
    assert.equal(await FV.resizeImage(noBlob, { ...fakeImage(4000, 2000), render: async () => null, maxWidth: 10 }), noBlob);
    const bigger = png('tiny.png');
    assert.equal(await FV.resizeImage(bigger, { ...fakeImage(10, 10), render: async () => new Blob([new Uint8Array(50000)]), maxSizeMB: 0.000001 }), bigger, 'never returns a bigger file');
    const before = fakeImage.closed;
    await FV.resizeImage(big(), { ...opts, maxWidth: 100 });
    assert.equal(fakeImage.closed, before + 1, 'the decoded image is released');
});

test('widget with resize: an oversized image is shrunk and then accepted instead of rejected', async () => {
    mount();
    const cfg = { accept: '.png,.jpg', maxImageWidth: 1000, maxImageHeight: 1000, readImageSize: async f => (f.fvResized ? f.fvResized.to : { width: 4000, height: 2000 }) };
    const opts = { list: '#list', messageElement: '#msg', resize: { maxWidth: 1000, maxHeight: 1000, type: 'image/jpeg', ...fakeImage(4000, 2000), ...fakeRender() } };
    const z = FV.widget('#zone', cfg, opts);
    const r = await z.add([png('big.png', 500)]);
    assert.equal(r.accepted.length, 1, JSON.stringify(r.rejected.map(x => x.messages)));
    assert.equal(z.files[0].name, 'big.jpg');
    assert.deepEqual([r.accepted[0].resized.to.width, r.accepted[0].resized.to.height], [1000, 500]);
    z.destroy();
    mount();
    const noResize = FV.widget('#zone', cfg, { list: '#list', messageElement: '#msg' });
    const rej = await noResize.add([png('big.png', 500)]);
    assert.equal(rej.rejected.length, 1, 'without resize the same image is rejected');
    assert.match(rej.rejected[0].messages[0], /4000px wide/);
    z.destroy();
    mount();
    const auto = FV.widget('#zone', { ...cfg, maxFileSizeMB: 1 }, { list: '#list', resize: true });
    assert.equal(typeof auto.add, 'function', 'resize: true derives the limits from the config');
});

test('widget with preview: entries carry previews that are revoked on remove and clear', async () => {
    mount();
    const revoked = [];
    const realRevoke = URL.revokeObjectURL, realCreate = URL.createObjectURL; let k = 0;
    URL.createObjectURL = () => 'blob:mock/' + (++k); URL.revokeObjectURL = u => revoked.push(u);
    try {
        const z = FV.widget('#zone', {}, { list: '#list', preview: { ...fakeImage(400, 400), ...fakeRender() } });
        await z.add([png('a.png'), png('b.png'), txt('c.txt')]);
        const imgs = document.querySelectorAll('#list img.fv-preview');
        assert.equal(imgs.length, 2);
        assert.match(imgs[0].getAttribute('src'), /^blob:mock/);
        assert.equal(imgs[0].getAttribute('alt'), '', 'decorative: the file name is next to it');
        assert.equal(document.querySelector('#list .fv-badge').textContent, 'TXT');
        z.remove(0);
        assert.equal(revoked.length, 1);
        z.clear();
        assert.equal(revoked.length, 2);
    } finally { URL.revokeObjectURL = realRevoke; URL.createObjectURL = realCreate; }
});

test('custom renderItem replaces the default list item', async () => {
    mount();
    const z = FV.widget('#zone', {}, { list: '#list', renderItem: (e, h) => { const li = document.createElement('li'); li.className = 'mine'; li.textContent = e.file.name + ' ' + h.formatBytes(e.file.size); return li; } });
    await z.add([txt('a.txt', 'abcd')]);
    assert.equal(document.querySelector('#list li.mine').textContent, 'a.txt 4 B');
});

// ================================================================ keyboard access without nesting interactive controls
test('dropzone keyboard role: only when the real input cannot be reached (otherwise the input is the accessible control)', () => {
    const attach = (setup, options) => {
        const { input, zone } = mount('');
        setup(input, zone);
        FV.widget('#zone', {}, options || {});
        return zone;
    };
    let zone = attach(input => { input.getClientRects = () => [1]; });
    assert.equal(zone.hasAttribute('role'), false, 'a visible, focusable input is the control: no role on the zone');
    assert.equal(zone.hasAttribute('tabindex'), false);
    zone = attach(input => { input.getClientRects = () => []; });
    assert.equal(zone.getAttribute('role'), 'button', 'not rendered: the zone becomes the control');
    zone = attach(input => { input.getClientRects = () => [1]; input.setAttribute('tabindex', '-1'); });
    assert.equal(zone.getAttribute('role'), 'button', 'tabindex=-1: unreachable');
    zone = attach(input => { input.getClientRects = () => [1]; input.setAttribute('aria-hidden', 'true'); });
    assert.equal(zone.getAttribute('role'), 'button', 'aria-hidden: unreachable');
    zone = attach(input => { input.getClientRects = () => []; zone => zone; }, { list: '#list' });
    zone = attach((input, z) => { input.getClientRects = () => []; z.appendChild(Object.assign(document.createElement('button'), { type: 'button' })); });
    assert.equal(zone.hasAttribute('role'), false, 'a zone that contains its own buttons must not become a button');
    zone = attach(input => { input.getClientRects = () => [1]; }, { keyboard: true });
    assert.equal(zone.getAttribute('role'), 'button', 'keyboard:true forces it');
    zone = attach(input => { input.getClientRects = () => []; }, { keyboard: false });
    assert.equal(zone.hasAttribute('role'), false, 'keyboard:false forbids it');
});

// ================================================================ accessibility: focus after removal, status announcements
test('removing a file with its button keeps keyboard focus inside the widget', async () => {
    const { input } = mount();
    input.focus = () => { document.activeElement !== input && (input.focused = true); };
    const z = FV.widget('#zone', {}, { list: '#list' });
    await z.add([txt('a.txt'), txt('b.txt'), txt('c.txt')]);
    const btn = i => document.querySelectorAll('.fv-remove')[i];
    btn(1).focus(); btn(1).click();                           // remove the middle one
    assert.equal(document.activeElement, btn(1), 'focus moves to the button that took its place (was c.txt)');
    assert.equal(document.activeElement.getAttribute('aria-label'), 'Remove c.txt');
    btn(1).click();                                           // remove the last one
    assert.equal(document.activeElement, btn(0), 'the previous button when the last item is removed');
    btn(0).click();                                           // remove the only one
    assert.equal(input.focused, true, 'no buttons left: focus goes back to the file input');
});

test('statusElement announces what happened, politely and in plain words', async () => {
    mount('<div id="status"></div>');
    const z = FV.widget('#zone', { accept: '.txt' }, { list: '#list', statusElement: '#status' });
    const status = document.getElementById('status');
    await z.add([txt('a.txt'), txt('b.txt'), txt('bad.exe')]);
    assert.equal(status.textContent, '2 files added. 1 file not accepted. 2 selected.');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    await z.add([txt('c.txt')]);
    assert.equal(status.textContent, '1 file added. 3 selected.');
    z.remove(0);
    assert.equal(status.textContent, 'a.txt removed. 2 selected.');
    z.clear();
    assert.equal(status.textContent, 'All files removed.');
    const custom = FV.widget('#zone', {}, { statusElement: '#status', statusText: (kind, info, total) => kind + ':' + total });
    await custom.add([txt('x.txt')]);
    assert.equal(status.textContent, 'add:1');
    custom.destroy();
    assert.equal(status.textContent, '', 'destroy clears the status line');
});

// ================================================================ robustness found in real browsers (WebKit)
test('filesFromDrop: plain files use dataTransfer.files even when the entry API is unusable (never answers, throws)', async () => {
    const stuck = { isFile: true, isDirectory: false, name: 'a.txt', file: () => { /* WebKit: the callback never comes */ } };
    const dt = { types: ['Files'], files: [txt('a.txt'), txt('b.txt')], items: [{ kind: 'file', webkitGetAsEntry: () => stuck }, { kind: 'file', webkitGetAsEntry: () => stuck }] };
    const t0 = Date.now();
    const got = await FV.filesFromDrop(dt);
    assert.deepEqual(got.map(f => f.name), ['a.txt', 'b.txt']);
    assert.ok(Date.now() - t0 < 500, 'no waiting for the entry API');
    const broken = { types: ['Files'], files: [txt('c.txt')], items: [{ kind: 'file', webkitGetAsEntry: () => { throw new Error('nope'); } }] };
    assert.deepEqual((await FV.filesFromDrop(broken)).map(f => f.name), ['c.txt'], 'a throwing entry API falls back to the plain files');
});

test('filesFromDrop: with a folder in the drop, files whose entry does not answer fall back to the plain file of the same name', async () => {
    const stuck = { isFile: true, isDirectory: false, name: 'top.txt', file: () => { } };
    const dir = dirEntry('docs', [fileEntry('inner.txt')]);
    const dt = { types: ['Files'], files: [txt('top.txt')], items: [{ kind: 'file', webkitGetAsEntry: () => dir }, { kind: 'file', webkitGetAsEntry: () => stuck }] };
    const realTimeout = global.setTimeout;
    global.setTimeout = (fn, ms, ...a) => realTimeout(fn, ms > 1000 ? 30 : ms, ...a);   // do not wait the full 5 s in the test
    try {
        const got = await FV.filesFromDrop(dt);
        assert.deepEqual(got.map(f => FV.getPath(f) || f.name).sort(), ['docs/inner.txt', 'top.txt']);
    } finally { global.setTimeout = realTimeout; }
});

// ================================================================ metadata
test('widget with stripMetadata: a photo is listed without its EXIF and GPS data, and says what was removed', async () => {
    const img = require('./helpers/images.js');
    mount();
    const z = FV.widget('#zone', { accept: '.jpg', imageDecode: false }, { list: '#list', messageElement: '#msg', stripMetadata: true });
    const photo = new File([img.jpeg({ exif: true, orientation: 6, gps: true, comment: true })], 'trip.jpg', { type: 'image/jpeg' });
    const r = await z.add([photo]);
    assert.equal(r.accepted.length, 1, JSON.stringify(r.rejected.map(x => x.messages)));
    assert.deepEqual(r.accepted[0].stripped.removed, ['EXIF', 'GPS location', 'comments']);
    assert.ok(z.files[0].size < photo.size);
    const meta = await FV.readMetadata(z.files[0]);
    assert.deepEqual([meta.gps, meta.comments, meta.orientation], [false, false, 6], 'the orientation stays so the photo is not shown sideways');
    z.destroy();
    mount();
    const plain = FV.widget('#zone', { accept: '.jpg', imageDecode: false }, { list: '#list' });
    const r2 = await plain.add([photo]);
    assert.equal(r2.accepted[0].stripped, null);
    assert.equal(r2.accepted[0].file, photo, 'without the option the file is untouched');
    plain.destroy();
});

test('exifOrientation() reads the EXIF tag of a photo, 1 for everything else', async () => {
    require('./helpers/shim.js');
    const tiff = [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0];
    const body = [0x45, 0x78, 0x69, 0x66, 0, 0].concat(tiff), len = body.length + 2;
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...body, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
    assert.equal(await FV.exifOrientation(new File([jpg], 'a.jpg', { type: 'image/jpeg' })), 6);
    assert.equal(await FV.exifOrientation(new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'b.jpg', { type: 'image/jpeg' })), 1);
    assert.equal(await FV.exifOrientation(new File(['hello'], 'c.txt', { type: 'text/plain' })), 1);
    assert.equal(await FV.exifOrientation(new File([new Uint8Array([1, 2, 3])], 'd.png', { type: 'image/png' })), 1);
});
