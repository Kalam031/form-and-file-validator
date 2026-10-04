'use strict';
// Writes spec/file-rules.vectors.json: files (as base64) + a config + what the JavaScript FileValidator answers. The .NET port must give the same
// error codes and messages for every case (dotnet/FormAndFileValidator.Tests/FileConformanceTests.cs).  Run: node spec/make-file-vectors.js
const fs = require('fs');
const path = require('path');
const FV = require('../src/fileValidator.js');

// ---------------------------------------------------------------- fixture builders
const u16 = n => [n & 255, (n >> 8) & 255];
const u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const be32 = n => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const ascii = s => Array.from(s).map(c => c.charCodeAt(0));
const utf16 = s => Array.from(s).flatMap(c => [c.charCodeAt(0), 0]);
const pad = (arr, n) => arr.concat(new Array(Math.max(0, n - arr.length)).fill(0));
const B = (...parts) => Uint8Array.from([].concat(...parts));

const png = (w, h) => B([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), ascii('IHDR'), be32(w), be32(h), [8, 2, 0, 0, 0], [0, 0, 0, 0], be32(0), ascii('IEND'), [0, 0, 0, 0]);
const gif = (w, h) => B(ascii('GIF89a'), u16(w), u16(h), [0, 0, 0], ascii(';'));
const jpeg = (w, h) => B([0xff, 0xd8, 0xff, 0xe0], [0, 16], ascii('JFIF'), [0, 1, 1, 0, 0, 1, 0, 1, 0, 0], [0xff, 0xc0, 0, 17, 8], [h >> 8, h & 255, w >> 8, w & 255], [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], [0xff, 0xd9]);
const webpX = (w, h) => B(ascii('RIFF'), u32(22), ascii('WEBP'), ascii('VP8X'), u32(10), [0, 0, 0, 0], [(w - 1) & 255, ((w - 1) >> 8) & 255, (w - 1) >> 16], [(h - 1) & 255, ((h - 1) >> 8) & 255, (h - 1) >> 16]);
const bmp = (w, h) => B(ascii('BM'), u32(54 + 4), u32(0), u32(54), u32(40), u32(w), u32(h), u16(1), u16(24), pad([], 24), [0, 0, 0, 0]);
const text = s => Uint8Array.from(Buffer.from(s, 'utf8'));
const exe = () => B(ascii('MZ'), pad([], 58), u32(0x80), pad([], 64));
const elf = () => B([0x7f, 0x45, 0x4c, 0x46], pad([], 60));
const pdf = body => text('%PDF-1.4\n' + (body || '1 0 obj\n<< /Type /Catalog >>\nendobj\n') + 'trailer\n<< /Root 1 0 R >>\n%%EOF\n');

/** A ZIP with stored entries: [{ name, data, usize? }]. usize/csize can be faked to build a "bomb". */
function zip(entries, opts) {
    opts = opts || {};
    const local = [], central = [];
    let off = 0;
    for (const e of entries) {
        const data = e.data ? Array.from(e.data) : [];
        const name = ascii(e.name);
        const usize = e.usize !== undefined ? e.usize : data.length, csize = e.csize !== undefined ? e.csize : data.length;
        const lh = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0), u32(csize), u32(usize), u16(name.length), u16(0), name, data);
        central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0), u32(csize), u32(usize), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), name));
        local.push(lh);
        off += lh.length;
    }
    const cd = [].concat(...central);
    const eocd = [].concat(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(off), u16(0));
    let all = [].concat(...local, cd, eocd);
    if (opts.cut) all = all.slice(0, all.length - opts.cut);
    return Uint8Array.from(all);
}
const ooxml = (prefix, extra) => zip([{ name: '[Content_Types].xml', data: text('<Types/>') }, { name: prefix + 'document.xml', data: text('<doc/>') }].concat(extra || []));
const oleWithMacro = () => B([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], pad([], 100), utf16('_VBA_PROJECT'), pad([], 50));
const oleClean = () => B([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], pad([], 200));

// ---------------------------------------------------------------- the cases
const cases = [];
let file = (name, bytes, type, extra) => Object.assign({ name, type: type === undefined ? '' : type, bytes: bytes || new Uint8Array(0) }, extra);
const add = (id, files, config, extra) => cases.push(Object.assign({ id, files: [].concat(files), config: config || {} }, extra));
const IMG = { allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] };

// names
add('clean text file', file('notes.txt', text('hello'), 'text/plain'));
add('exe by name', file('setup.exe', exe(), 'application/x-msdownload'));
['setup.EXE', 'run.bat', 'x.ps1', 'a.sh', 'w.js', 'a.vbs', 'a.jar', 'a.dll', 'a.msi', 'a.scr', 'a.lnk', 'a.php', 'a.asp', 'a.jsp', 'a.htaccess', 'a.apk', 'a.docm', 'a.xlsm']
    .forEach(n => add('dangerous name ' + n, file(n, text('x'), '')));
add('explicit allow overrides dangerous', file('tool.exe', text('plain text'), ''), { allowedExtensions: ['exe'] });
add('hidden double extension', file('invoice.exe.pdf', pdf(), 'application/pdf'));
add('example.com.pdf is fine', file('example.com.pdf', pdf(), 'application/pdf'));
add('backup.tar.gz is fine', file('backup.tar.gz', B([0x1f, 0x8b], pad([], 30)), 'application/gzip'));
add('trailing dot', file('a.txt.', text('x'), ''));
add('trailing space', file('a.txt ', text('x'), ''));
add('control char in name', file('a\u0001.txt', text('x'), ''));
add('bidi override', file('a\u202etxt.exe', text('x'), ''));
add('slash in name', file('a/b.txt', text('x'), ''));
add('backslash in name', file('a\\b.txt', text('x'), ''));
add('empty name', file('', text('x'), ''));
add('name too long', file('a'.repeat(300) + '.txt', text('x'), ''));
add('custom max filename length', file('abcdefghijkl.txt', text('x'), ''), { maxFilenameLength: 10 });
add('filename pattern ok', file('my file (1).txt', text('x'), ''), { filenameRegex: undefined, validate: { filenamePattern: true } });
add('filename pattern bad char', file('a$b.txt', text('x'), ''), { validate: { filenamePattern: true } });
add('filename pattern reserved', file('con.txt', text('x'), ''), { validate: { filenamePattern: true } });
add('filename pattern unicode', file('Ünïcode-文件.txt', text('x'), ''), { validate: { filenamePattern: true } });
add('filename pattern leading dot', file('.hidden.txt', text('x'), ''), { validate: { filenamePattern: true } });
add('dangerous mime under harmless name', file('photo.jpg', jpeg(10, 10), 'application/x-msdownload'));
add('dangerous mime allowed explicitly', file('photo.jpg', jpeg(10, 10), 'application/x-msdownload'), { allowedMimeTypes: ['application/x-msdownload'] });

// folder paths
add('path ok', file('a.txt', text('x'), 'text/plain', { fvPath: 'docs/2024/a.txt' }), { maxPathDepth: 3 });
add('path too deep', file('a.txt', text('x'), 'text/plain', { fvPath: 'a/b/c/d/a.txt' }), { maxPathDepth: 2 });
add('path too long', file('a.txt', text('x'), 'text/plain', { fvPath: 'docs/2024/a.txt' }), { maxPathLength: 5 });
add('path dotdot', file('a.txt', text('x'), 'text/plain', { fvPath: 'docs/../a.txt' }));
add('path absolute', file('a.txt', text('x'), 'text/plain', { fvPath: '/etc/a.txt' }));
add('path backslash', file('a.txt', text('x'), 'text/plain', { fvPath: 'docs\\a.txt' }));
add('path empty segment', file('a.txt', text('x'), 'text/plain', { fvPath: 'docs//a.txt' }));

// allow lists and types
add('extension not allowed', file('a.gif', gif(2, 2), 'image/gif'), { allowedExtensions: ['png', 'jpg'] });
add('extension allowed, dot and case', file('A.PNG', png(2, 2), 'image/png'), { allowedExtensions: ['.png'] });
add('extension list as comma string', file('a.png', png(2, 2), 'image/png'), { allowedExtensions: 'jpg, png' });
add('accept string', file('a.gif', gif(2, 2), 'image/gif'), { accept: '.png,.jpg' });
add('mime not allowed', file('a.png', png(2, 2), 'image/png'), { allowedMimeTypes: ['application/pdf'] });
add('mime wildcard', file('a.png', png(2, 2), 'image/png'), { allowedMimeTypes: ['image/*'] });
add('mime from extension when none reported', file('a.png', png(2, 2), ''), { allowedMimeTypes: ['image/png'] });
add('mime octet-stream falls back to extension', file('a.pdf', pdf(), 'application/octet-stream'), { allowedMimeTypes: ['application/pdf'] });
add('mime unknown allowed', file('a.xyz', text('x'), ''), { allowedMimeTypes: ['image/*'], allowUnknownMime: true });
add('mime unknown not allowed', file('a.xyz', text('x'), ''), { allowedMimeTypes: ['image/*'] });
add('extension only: mime mismatch', file('a.png', png(2, 2), 'application/pdf'), { allowedExtensions: ['png'] });
add('extension only: matching mime', file('a.png', png(2, 2), 'image/png'), { allowedExtensions: ['png'] });
add('extension only: x-png alias', file('a.png', png(2, 2), 'image/x-png'), { allowedExtensions: ['png'] });
add('extension only: unknown extension', file('a.qqq', text('x'), 'text/plain'), { allowedExtensions: ['qqq'] });
add('extension only: unknown allowed', file('a.qqq', text('x'), 'text/plain'), { allowedExtensions: ['qqq'], allowUnknownMime: true });
add('mimeByExtension', file('a.qqq', text('x'), 'application/x-qqq'), { allowedExtensions: ['qqq'], mimeByExtension: { '.qqq': 'application/x-qqq' } });
add('validate mimeType off', file('a.png', png(2, 2), 'application/pdf'), { allowedExtensions: ['png'], validate: { mimeType: false } });
add('validate dangerousExt off', file('a.exe', text('x'), ''), { validate: { dangerousExt: false } });
add('custom dangerous list', file('a.txt', text('x'), ''), { dangerousExtensions: ['txt'] });

// size
add('too large', file('a.txt', new Uint8Array(3 * 1048576), 'text/plain'), { maxFileSizeMB: 2 });
add('too large bytes', file('a.txt', new Uint8Array(2000), 'text/plain'), { maxFileSize: 1500 });
add('size ok', file('a.txt', new Uint8Array(1000), 'text/plain'), { maxFileSizeMB: 2 });
add('too small kb', file('a.txt', new Uint8Array(500), 'text/plain'), { minFileSizeKB: 1 });
add('too small bytes', file('a.txt', new Uint8Array(5), 'text/plain'), { minFileSize: 10 });
add('empty file', file('a.txt', new Uint8Array(0), 'text/plain'));
add('empty allowed', file('a.txt', new Uint8Array(0), 'text/plain'), { allowEmpty: true });
add('empty and min size', file('a.txt', new Uint8Array(0), 'text/plain'), { minFileSizeKB: 1 });
add('size text 1.5 KB', file('a.txt', new Uint8Array(3000), 'text/plain'), { maxFileSize: 1000 });
add('size text bytes', file('a.txt', new Uint8Array(900), 'text/plain'), { maxFileSize: 100 });
add('size text GB limit', file('a.txt', new Uint8Array(10), 'text/plain'), { minFileSize: 3 * 1073741824 });

// signatures
add('png named txt', file('a.txt', png(2, 2), 'text/plain'));
add('text named png', file('a.png', text('just text'), 'image/png'));
add('png named jpg', file('a.jpg', png(2, 2), 'image/jpeg'));
add('exe content named jpg', file('a.jpg', exe(), 'image/jpeg'));
add('elf content named txt', file('a.txt', elf(), 'text/plain'));
add('shebang script named txt', file('a.txt', text('#!/bin/sh\necho hi\n'), 'text/plain'));
add('shebang script named sh blocked by name', file('a.sh', text('#!/bin/sh\necho hi\n'), ''));
add('executables allowed', file('a.txt', elf(), 'text/plain'), { allowExecutables: true });
add('signature off', file('a.png', text('just text'), 'image/png'), { validate: { signature: false, imageDecode: false } });
add('wasm content', file('a.dat', B([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0], pad([], 20)), ''));
add('pdf named pdf', file('a.pdf', pdf(), 'application/pdf'));
add('pdf named png', file('a.png', pdf(), 'image/png'));
add('mp3 id3', file('a.mp3', B(ascii('ID3'), [3, 0, 0, 0, 0, 0, 10], pad([], 20)), 'audio/mpeg'));
add('mp4 ftyp', file('a.mp4', B([0, 0, 0, 24], ascii('ftypisom'), pad([], 20)), 'video/mp4'));
add('mp4 named mp3', file('a.mp3', B([0, 0, 0, 24], ascii('ftypisom'), pad([], 20)), 'audio/mpeg'));
add('wav riff', file('a.wav', B(ascii('RIFF'), u32(36), ascii('WAVE'), pad([], 30)), 'audio/wav'));
add('webm matroska', file('a.webm', B([0x1a, 0x45, 0xdf, 0xa3], pad([], 30)), 'video/webm'));
add('gz named zip', file('a.zip', B([0x1f, 0x8b], pad([], 30)), 'application/zip'));
add('ttf weak signature', file('a.ttf', B([0, 1, 0, 0, 0, 10], pad([], 20)), 'font/ttf'));
add('ttf signature as other ext', file('a.bin', B([0, 1, 0, 0, 0, 10], pad([], 20)), ''));
add('rar', file('a.rar', B(ascii('Rar!'), pad([], 30)), 'application/vnd.rar'));
add('7z', file('a.7z', B([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], pad([], 30)), 'application/x-7z-compressed'));
add('sqlite', file('a.sqlite', B(ascii('SQLite format 3'), [0], pad([], 30)), ''));
add('lnk content', file('a.dat', B([0x4c, 0, 0, 0, 1, 0x14, 2, 0], pad([], 30)), ''));
add('tar', file('a.tar', B(pad([], 257), ascii('ustar'), pad([], 20)), 'application/x-tar'));
add('rtf', file('a.rtf', text('{\\rtf1 hello}'), 'application/rtf'));
add('unknown binary with unknown ext', file('a.zzz', B([1, 2, 3, 4, 5]), ''));
add('unknown binary named png', file('a.png', B([1, 2, 3, 4, 5, 6, 7, 8, 9]), 'image/png'));
add('bmp content', file('a.bmp', bmp(4, 3), 'image/bmp'), { imageDecode: false });
add('text starting with MZ', file('a.txt', text('MZ is a plain text file'), 'text/plain'));
add('text starting with BM', file('a.txt', text('BM is a plain text file, not a bitmap at all.'), 'text/plain'));

// images (the dimensions are injected into the JS side; .NET reads them from the header)
const withDims = (id, f, w, h, config) => add(id, f, Object.assign({}, config), { dims: [{ width: w, height: h }] });
withDims('png ok', file('a.png', png(100, 50), 'image/png'), 100, 50, { maxImageWidth: 200 });
withDims('png too wide', file('a.png', png(500, 50), 'image/png'), 500, 50, { maxImageWidth: 200 });
withDims('png too tall', file('a.png', png(50, 500), 'image/png'), 50, 500, { maxImageHeight: 200 });
withDims('png too narrow', file('a.png', png(50, 50), 'image/png'), 50, 50, { minImageWidth: 100 });
withDims('png too short', file('a.png', png(50, 50), 'image/png'), 50, 50, { minImageHeight: 100 });
withDims('jpeg all limits', file('a.jpg', jpeg(800, 600), 'image/jpeg'), 800, 600, { maxImageWidth: 640, maxImageHeight: 480, minImageWidth: 900, minImageHeight: 700 });
withDims('gif size', file('a.gif', gif(30, 20), 'image/gif'), 30, 20, { maxImageWidth: 10 });
withDims('webp size', file('a.webp', webpX(1000, 400), 'image/webp'), 1000, 400, { maxImageWidth: 800 });
withDims('bmp size', file('a.bmp', bmp(64, 32), 'image/bmp'), 64, 32, { maxImageWidth: 32 });
withDims('aspect 16:9 ok', file('a.png', png(1600, 900), 'image/png'), 1600, 900, { aspectRatio: '16:9' });
withDims('aspect 16:9 bad', file('a.png', png(1000, 1000), 'image/png'), 1000, 1000, { aspectRatio: '16:9' });
withDims('aspect 1.5 tolerance', file('a.png', png(153, 100), 'image/png'), 153, 100, { aspectRatio: '3/2', aspectRatioTolerance: 0.05 });
withDims('aspect 4:3 bad', file('a.jpg', jpeg(100, 100), 'image/jpeg'), 100, 100, { aspectRatio: '4:3' });

// documents: ZIP, Office, PDF, OLE
add('zip ok', file('a.zip', zip([{ name: 'a.txt', data: text('hi') }]), 'application/zip'));
add('zip unsafe path', file('a.zip', zip([{ name: '../evil.txt', data: text('hi') }]), 'application/zip'));
add('zip absolute path', file('a.zip', zip([{ name: '/etc/passwd', data: text('hi') }]), 'application/zip'));
add('zip drive path', file('a.zip', zip([{ name: 'C:/x.txt', data: text('hi') }]), 'application/zip'));
add('zip cut off', file('a.zip', zip([{ name: 'a.txt', data: text('hello world') }], { cut: 8 }), 'application/zip'));
add('zip too many entries', file('a.zip', zip(Array.from({ length: 30 }, (_, i) => ({ name: 'f' + i + '.txt', data: text('x') }))), 'application/zip'), { documents: { maxEntries: 20 } });
add('zip expands too much', file('a.zip', zip([{ name: 'big.bin', data: text('x'), usize: 3 * 1073741824 }]), 'application/zip'), { documents: { maxUncompressedMB: 1000 } });
add('zip ratio bomb', file('a.zip', zip([{ name: 'big.bin', data: text('x'), usize: 400 * 1048576, csize: 1000 }]), 'application/zip'));
add('zip inspection off', file('a.zip', zip([{ name: '../evil.txt', data: text('hi') }]), 'application/zip'), { documents: false });
add('docx ok', file('a.docx', ooxml('word/'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
add('docx missing parts', file('a.docx', zip([{ name: 'readme.txt', data: text('x') }]), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
add('docx with macro', file('a.docx', ooxml('word/', [{ name: 'word/vbaProject.bin', data: text('x') }]), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
add('docm macro blocked by name', file('a.docm', ooxml('word/', [{ name: 'word/vbaProject.bin', data: text('x') }]), ''));
add('docm macro allowed', file('a.docm', ooxml('word/', [{ name: 'word/vbaProject.bin', data: text('x') }]), 'application/vnd.ms-word.document.macroenabled.12'), { allowedExtensions: ['docm'] });
add('xlsx activex', file('a.xlsx', ooxml('xl/', [{ name: 'xl/activeX/activeX1.xml', data: text('x') }]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
add('pptx embedded exe', file('a.pptx', ooxml('ppt/', [{ name: 'ppt/embeddings/tool.exe', data: text('x') }]), 'application/vnd.openxmlformats-officedocument.presentationml.presentation'));
add('docx blockMacros off', file('a.docx', ooxml('word/', [{ name: 'word/vbaProject.bin', data: text('x') }]), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), { documents: { blockMacros: false } });
add('odt macro', file('a.odt', zip([{ name: 'mimetype', data: text('application/vnd.oasis.opendocument.text') }, { name: 'Basic/Standard/Module1.xml', data: text('x') }]), 'application/vnd.oasis.opendocument.text'));
add('odt ok', file('a.odt', zip([{ name: 'mimetype', data: text('application/vnd.oasis.opendocument.text') }]), 'application/vnd.oasis.opendocument.text'));
add('pdf javascript', file('a.pdf', pdf('1 0 obj\n<< /S /JavaScript /JS (app.alert(1)) >>\nendobj\n'), 'application/pdf'));
add('pdf hex-escaped javascript', file('a.pdf', pdf('1 0 obj\n<< /S /J#61vaScript >>\nendobj\n'), 'application/pdf'));
add('pdf launch', file('a.pdf', pdf('1 0 obj\n<< /S /Launch /F (cmd.exe) >>\nendobj\n'), 'application/pdf'));
add('pdf embedded exe', file('a.pdf', pdf('1 0 obj\n<< /Type /EmbeddedFile >>\n<< /F (setup.exe) >>\nendobj\n'), 'application/pdf'));
add('pdf cut off', file('a.pdf', text('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n'), 'application/pdf'));
add('pdf checkStructure off', file('a.pdf', text('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n'), 'application/pdf'), { documents: { checkStructure: false } });
add('pdf blockPdfJavaScript off', file('a.pdf', pdf('1 0 obj\n<< /S /JavaScript >>\nendobj\n'), 'application/pdf'), { documents: { blockPdfJavaScript: false } });
add('doc with macro', file('a.doc', oleWithMacro(), 'application/msword'));
add('doc clean', file('a.doc', oleClean(), 'application/msword'));
add('xls with macro blocked', file('a.xls', oleWithMacro(), 'application/vnd.ms-excel'));

// svg
add('svg clean', file('a.svg', text('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'), 'image/svg+xml'), { imageDecode: false });
add('svg script', file('a.svg', text('<svg><script>alert(1)</script></svg>'), 'image/svg+xml'));
add('svg onload', file('a.svg', text('<svg onload="alert(1)"></svg>'), 'image/svg+xml'));
add('svg javascript link', file('a.svg', text('<svg><a href="javascript:alert(1)"/></svg>'), 'image/svg+xml'));
add('svg foreignObject', file('a.svg', text('<svg><foreignObject/></svg>'), 'image/svg+xml'));
add('svg scan off', file('a.svg', text('<svg><script>1</script></svg>'), 'image/svg+xml'), { scanSvg: false, imageDecode: false });

// whole selection
const t = (n, s) => file(n, text(s || 'x'), 'text/plain');
add('no files', [], {}, { expectNoFiles: true });
add('no files allowed', [], { allowNoFiles: true }, { expectNoFiles: true });
add('too many files', [t('a.txt'), t('b.txt'), t('c.txt')], { maxFiles: 2 });
add('too few files', [t('a.txt')], { minFiles: 2 });
add('total size', [file('a.txt', new Uint8Array(1500000), 'text/plain'), file('b.txt', new Uint8Array(1500000), 'text/plain')], { maxTotalSizeMB: 2 });
add('duplicate names', [t('a.txt'), t('A.TXT')], { duplicateNames: true });
add('duplicate names off by default', [t('a.txt'), t('A.TXT')]);
add('several files, several problems', [t('a.txt'), file('b.exe', exe(), ''), file('c.png', text('nope'), 'image/png'), file('d.txt', new Uint8Array(0), 'text/plain')], { maxFiles: 3 });
add('ignore junk files', [t('a.txt'), file('.DS_Store', text('x'), ''), file('Thumbs.db', text('x'), ''), file('~$lock.docx', text('x'), ''), file('._a.txt', text('x'), '')], { ignoreFiles: true });
add('junk files validated when not ignored', [t('a.txt'), file('Thumbs.db', text('x'), '')], {});

// messages
add('custom message', file('a.txt', new Uint8Array(3 * 1048576), 'text/plain'), { maxFileSizeMB: 1, messages: { SIZE_TOO_LARGE: 'Too big: {size} > {max}' } });

// ---------------------------------------------------------------- run the JavaScript reference
async function build() {
    const out = [];
    for (const c of cases) {
        const files = c.files.map(f => { const o = new File([f.bytes], f.name, { type: f.type }); if (f.fvPath) o.fvPath = f.fvPath; return o; });
        const config = Object.assign({}, c.config);
        if (c.dims) {
            let i = 0;
            config.readImageSize = async () => c.dims[Math.min(i++, c.dims.length - 1)];
        }
        const r = await FV.validateFiles(files, config);
        const group = r.details.filter(d => d.fileName === null).map(d => d.code);
        out.push({
            id: c.id,
            files: c.files.map(f => ({ name: f.name, type: f.type, path: f.fvPath || '', base64: Buffer.from(f.bytes).toString('base64') })),
            config: c.config,
            dims: c.dims,    // image sizes the JavaScript side was told (a browser would decode them); other ports read them from the header
            expected: {
                valid: r.isValid,
                errors: r.errors,
                group,
                perFile: r.files.map(f => f.details.map(d => d.code)),
                messages: r.details.map(d => d.message)
            }
        });
    }
    return out;
}

module.exports = { build };
if (require.main === module) {
    build().then(cs => {
        const sigs = FV.constants.SIGNATURES.map(s => ({ name: s.name, exts: s.exts, executable: s.executable }));
        const json = JSON.stringify({ comment: 'Generated by spec/make-file-vectors.js from the JavaScript FileValidator. Do not edit.', signatures: sigs, cases: cs }, null, 1);
        fs.writeFileSync(path.join(__dirname, 'file-rules.vectors.json'), json + '\n');
        const bad = cs.filter(c => c.expected.errors.length === 0).length;
        console.log(cs.length + ' cases written (' + bad + ' valid, ' + (cs.length - bad) + ' with errors)');
    });
}
