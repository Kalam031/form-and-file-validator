'use strict';
// Hand-built JPEG, PNG and WebP files with metadata, for the metadata and widget tests.
const ascii = s => Array.from(s).map(c => c.charCodeAt(0));
const be16 = n => [(n >> 8) & 255, n & 255];
const be32 = n => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const le16 = n => [n & 255, (n >> 8) & 255];
const le32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const cat = (...parts) => Uint8Array.from([].concat(...parts.map(p => Array.from(p))));
const mkFile = (bytes, name, type) => new File([bytes], name, { type, lastModified: 1700000000000 });
const bytesOf = async f => new Uint8Array(await f.arrayBuffer());
const has = (hay, text) => { const n = ascii(text); outer: for (let i = 0; i + n.length <= hay.length; i++) { for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer; return true; } return false; };

/** A little-endian TIFF block: Orientation (if given) and a GPS IFD with latitude and longitude (if gps). */
function tiff(orientation, gps) {
    const entries = [];
    if (orientation) entries.push({ tag: 0x0112, type: 3, count: 1, value: [orientation, 0, 0, 0] });
    if (gps) entries.push({ tag: 0x8825, type: 4, count: 1, value: null });
    const ifdSize = 2 + entries.length * 12 + 4;
    const gpsAt = 8 + ifdSize;
    const gpsIfd = gps ? [].concat(le16(2), [].concat(le16(2), le16(5), le32(3), le32(gpsAt + 2 + 24 + 4)), [].concat(le16(4), le16(5), le32(3), le32(gpsAt + 2 + 24 + 4 + 24)), le32(0), new Array(48).fill(7)) : [];
    const ifd = [].concat(le16(entries.length), ...entries.map(e => [].concat(le16(e.tag), le16(e.type), le32(e.count), e.value || le32(gpsAt))), le32(0));
    return Uint8Array.from([].concat(ascii('II'), le16(42), le32(8), ifd, gpsIfd));
}
const seg = (marker, payload) => cat([0xff, marker], be16(payload.length + 2), payload);

/** A JPEG that is a real file structure (JFIF, a frame header, a scan) with metadata segments around it. */
function jpeg(opts) {
    const o = opts || {};
    const parts = [[0xff, 0xd8], seg(0xe0, cat(ascii('JFIF\0'), [1, 1, 0, 0, 1, 0, 1, 0, 0]))];
    if (o.exif) parts.push(seg(0xe1, cat(ascii('Exif\0\0'), tiff(o.orientation, o.gps))));
    if (o.xmp) parts.push(seg(0xe1, cat(ascii('http://ns.adobe.com/xap/1.0/\0'), ascii('<x:xmpmeta/>'))));
    if (o.iptc) parts.push(seg(0xed, cat(ascii('Photoshop 3.0\0'), ascii('8BIM'))));
    if (o.comment) parts.push(seg(0xfe, Uint8Array.from(ascii('shot with a secret camera'))));
    if (o.icc) parts.push(seg(0xe2, cat(ascii('ICC_PROFILE\0'), [1, 1], new Array(20).fill(5))));
    parts.push(seg(0xdb, new Array(65).fill(3)));
    parts.push(seg(0xc0, [8, 0, 10, 0, 20, 1, 1, 0x11, 0]));
    parts.push([0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0], new Array(40).fill(0x55), [0xff, 0xd9]);
    return cat(...parts);
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = bytes => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => cat(be32(data.length), ascii(type), data, be32(crc(cat(ascii(type), data))));
function png(opts) {
    const o = opts || {};
    const parts = [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk('IHDR', cat(be32(4), be32(4), [8, 2, 0, 0, 0]))];
    if (o.exif) parts.push(chunk('eXIf', tiff(o.orientation, o.gps)));
    if (o.text) parts.push(chunk('tEXt', cat(ascii('Comment\0'), ascii('private note'))));
    if (o.xmp) parts.push(chunk('iTXt', cat(ascii('XML:com.adobe.xmp\0\0\0\0\0'), ascii('<x:xmpmeta/>'))));
    if (o.time) parts.push(chunk('tIME', [7, 232, 1, 2, 3, 4, 5]));
    parts.push(chunk('gAMA', be32(45455)), chunk('IDAT', new Array(30).fill(9)), chunk('IEND', []));
    return cat(...parts);
}

function webp(opts) {
    const o = opts || {};
    const flags = (o.exif ? 0x08 : 0) | (o.xmp ? 0x04 : 0);
    const chunks = [cat(ascii('VP8X'), le32(10), [flags, 0, 0, 0], [9, 0, 0], [9, 0, 0])];
    chunks.push(cat(ascii('VP8L'), le32(6), [0x2f, 1, 2, 3, 4, 5]));
    if (o.exif) { const t = tiff(o.orientation, o.gps); chunks.push(cat(ascii('EXIF'), le32(t.length), t, t.length & 1 ? [0] : [])); }
    if (o.xmp) chunks.push(cat(ascii('XMP '), le32(12), ascii('<x:xmpmeta/>')));
    const body = cat(...chunks);
    return cat(ascii('RIFF'), le32(body.length + 4), ascii('WEBP'), body);
}

module.exports = { ascii, be16, be32, le16, le32, cat, mkFile, bytesOf, has, tiff, seg, jpeg, crc, chunk, png, webp };
