'use strict';
// Real (minimal) file contents for the tests: PDFs, ZIP archives and Office documents that pass the structure checks.
const enc = s => Array.from(Buffer.from(s, 'latin1'));

const PDF = enc('%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const pdfWith = extra => enc('%PDF-1.7\n1 0 obj\n<< /Type /Catalog ' + extra + ' >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const le16 = n => [n & 255, (n >> 8) & 255];
const le32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

/**
 * A ZIP archive with "stored" entries. entries: { name: content } or { name: { data, usize, csize } } to forge sizes (zip-bomb tests).
 * Returns an array of bytes.
 */
function makeZip(entries) {
    const out = [], central = [];
    Object.keys(entries || {}).forEach(name => {
        const v = entries[name], forged = v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array);
        const data = Array.from(Buffer.from(forged ? (v.data || '') : v, 'latin1'));
        const nameBytes = Array.from(Buffer.from(name, 'utf8'));
        const offset = out.length, crc = crc32(data);
        const csize = forged && v.csize !== undefined ? v.csize : data.length, usize = forged && v.usize !== undefined ? v.usize : data.length;
        out.push(0x50, 0x4b, 3, 4, ...le16(20), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(nameBytes.length), ...le16(0), ...nameBytes, ...data);
        central.push(0x50, 0x4b, 1, 2, ...le16(20), ...le16(20), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(crc), ...le32(csize), ...le32(usize),
            ...le16(nameBytes.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(offset), ...nameBytes);
    });
    const count = Object.keys(entries || {}).length, cdOffset = out.length;
    return out.concat(central, [0x50, 0x4b, 5, 6], le16(0), le16(0), le16(count), le16(count), le32(central.length), le32(cdOffset), le16(0));
}

const EMPTY_ZIP = makeZip({});
const ZIP = makeZip({ 'readme.txt': 'hello' });
const office = (prefix, extra) => makeZip(Object.assign({ '[Content_Types].xml': '<Types/>', [prefix + 'document.xml']: '<doc/>' }, extra));
const docx = extra => office('word/', extra);
const xlsx = extra => office('xl/', extra);
const pptx = extra => office('ppt/', extra);

module.exports = { enc, PDF, pdfWith, makeZip, EMPTY_ZIP, ZIP, docx, xlsx, pptx, crc32 };
