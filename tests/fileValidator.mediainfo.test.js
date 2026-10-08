'use strict';
// FileValidator.readMediaInfo(): duration from the file header, no <audio> / <video> element. Files are built byte by byte here.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { FileValidator } = require('../dist/validator.js');

const be32 = n => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const le32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const le16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const box = (type, ...parts) => { const body = Buffer.concat(parts); return Buffer.concat([be32(8 + body.length), Buffer.from(type), body]); };
const file = (buf, name, type) => new File([buf], name, { type });
const near = (a, b, eps = 0.02) => assert.ok(Math.abs(a - b) <= eps, a + ' is not near ' + b);

function mp4({ seconds, timescale = 1000, moovFirst = true, w = 0, h = 0, version = 0 }) {
    const mvhd = version === 1
        ? box('mvhd', Buffer.from([1, 0, 0, 0]), Buffer.alloc(16), be32(timescale), Buffer.concat([be32(0), be32(Math.round(seconds * timescale))]), Buffer.alloc(80))
        : box('mvhd', Buffer.from([0, 0, 0, 0]), Buffer.alloc(8), be32(timescale), be32(Math.round(seconds * timescale)), Buffer.alloc(80));
    const tkhd = box('tkhd', Buffer.from([0, 0, 0, 3]), Buffer.alloc(72), be32(w * 65536), be32(h * 65536));
    const moov = box('moov', mvhd, box('trak', tkhd));
    const ftyp = box('ftyp', Buffer.from('isom'), be32(512), Buffer.from('isom'));
    const mdat = box('mdat', Buffer.alloc(400000, 7));
    return Buffer.concat(moovFirst ? [ftyp, moov, mdat] : [ftyp, mdat, moov]);
}
function wav(seconds, rate = 8000, channels = 1) {
    const align = channels * 2, data = Math.round(seconds * rate) * align;
    return Buffer.concat([Buffer.from('RIFF'), le32(36 + data), Buffer.from('WAVE'), Buffer.from('fmt '), le32(16), le16(1), le16(channels), le32(rate), le32(rate * align), le16(align), le16(16), Buffer.from('data'), le32(data), Buffer.alloc(Math.min(data, 5000))]);
}
function flac(seconds, rate = 44100) {
    const samples = Math.round(seconds * rate), si = Buffer.alloc(34);
    si[10] = (rate >> 12) & 255; si[11] = (rate >> 4) & 255; si[12] = ((rate & 15) << 4) | (1 << 1); si[13] = (0xF << 4) | 0;   // 16 bit, 2 channels: bits only matter for the upper nibble of the sample count
    si[13] = (si[13] & 0xF0) | (Math.floor(samples / 4294967296) & 15);
    si.writeUInt32BE(samples >>> 0, 14);
    return Buffer.concat([Buffer.from('fLaC'), Buffer.from([0x80, 0, 0, 34]), si]);
}
function ogg(seconds, { opus = true, rate = 48000 } = {}) {
    const page = (granule, payload, flags) => { const h = Buffer.alloc(27); h.write('OggS'); h[5] = flags; h.writeBigUInt64LE(BigInt(granule), 6); h[26] = 1; return Buffer.concat([h, Buffer.from([payload.length]), payload]); };
    let first;
    if (opus) { const p = Buffer.alloc(19); p.write('OpusHead'); p[8] = 1; p[9] = 2; p.writeUInt16LE(312, 10); first = page(0, p, 2); }
    else { const p = Buffer.alloc(30); p[0] = 1; p.write('vorbis', 1); p.writeUInt32LE(0, 7); p[11] = 2; p.writeUInt32LE(rate, 12); first = page(0, p, 2); }
    const total = Math.round(seconds * (opus ? 48000 : rate)) + (opus ? 312 : 0);
    return Buffer.concat([first, Buffer.alloc(100000, 1), page(total, Buffer.alloc(10), 4)]);
}
function ebmlInt(n, len) { const b = Buffer.alloc(len); for (let i = len - 1, v = n; i >= 0; i--, v = Math.floor(v / 256)) b[i] = v & 255; return b; }
const size = n => { if (n < 127) return Buffer.from([0x80 | n]); return Buffer.from([0x40 | (n >> 8), n & 255]); };
const el = (idBytes, body) => Buffer.concat([Buffer.from(idBytes), size(body.length), body]);
function webm(seconds, scale = 1000000) {
    const dur = Buffer.alloc(4); dur.writeFloatBE(seconds * 1e9 / scale);
    const info = el([0x15, 0x49, 0xA9, 0x66], Buffer.concat([el([0x2A, 0xD7, 0xB1], ebmlInt(scale, 3)), el([0x44, 0x89], dur)]));
    const header = el([0x1A, 0x45, 0xDF, 0xA3], el([0x42, 0x82], Buffer.from('webm')));
    return Buffer.concat([header, Buffer.from([0x18, 0x53, 0x80, 0x67, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]), info, Buffer.alloc(2000, 0)]);
}
function mp3(seconds, { xing = false } = {}) {
    // MPEG1 layer III, 128 kbps, 44.1 kHz: frame = 417 bytes (padding 0), 1152 samples
    const frameBytes = 417, frames = Math.round(seconds * 44100 / 1152);
    const frame = Buffer.alloc(frameBytes); frame[0] = 0xFF; frame[1] = 0xFB; frame[2] = 0x90; frame[3] = 0x00;
    if (xing) { frame.write('Xing', 36); frame.writeUInt32BE(1, 40); frame.writeUInt32BE(frames, 44); }
    const id3 = Buffer.concat([Buffer.from('ID3'), Buffer.from([3, 0, 0, 0, 0, 0, 20]), Buffer.alloc(20)]);
    return Buffer.concat([id3, xing ? frame : Buffer.alloc(0), Buffer.concat(Array.from({ length: xing ? 2 : frames }, () => frame))]);
}

test('MP4 / MOV: moov first or last, 32 and 64 bit durations, picture size', async () => {
    const a = await FileValidator.readMediaInfo(file(mp4({ seconds: 12.5, w: 1920, h: 1080 }), 'a.mp4', 'video/mp4'));
    near(a.duration, 12.5); assert.equal(a.width, 1920); assert.equal(a.height, 1080); assert.equal(a.format, 'mp4');
    near((await FileValidator.readMediaInfo(file(mp4({ seconds: 3600.25, moovFirst: false, timescale: 90000 }), 'b.mov', 'video/quicktime'))).duration, 3600.25);
    near((await FileValidator.readMediaInfo(file(mp4({ seconds: 7, version: 1 }), 'c.m4a', 'audio/mp4'))).duration, 7);
});
test('WAV, FLAC, Ogg Opus, Ogg Vorbis, WebM, MP3 (constant rate and Xing)', async () => {
    near((await FileValidator.readMediaInfo(file(wav(2.5), 'a.wav', 'audio/wav'))).duration, 2.5, 0.001);
    near((await FileValidator.readMediaInfo(file(wav(10, 44100, 2), 'b.wav', 'audio/wav'))).duration, 10, 0.001);
    near((await FileValidator.readMediaInfo(file(flac(215.4), 'a.flac', 'audio/flac'))).duration, 215.4, 0.001);
    near((await FileValidator.readMediaInfo(file(ogg(33.3), 'a.opus', 'audio/ogg'))).duration, 33.3, 0.001);
    near((await FileValidator.readMediaInfo(file(ogg(8, { opus: false, rate: 44100 }), 'a.ogg', 'audio/ogg'))).duration, 8, 0.001);
    near((await FileValidator.readMediaInfo(file(webm(61.5), 'a.webm', 'video/webm'))).duration, 61.5, 0.01);
    near((await FileValidator.readMediaInfo(file(webm(5, 100000), 'b.webm', 'video/webm'))).duration, 5, 0.01);
    near((await FileValidator.readMediaInfo(file(mp3(30), 'a.mp3', 'audio/mpeg'))).duration, 30, 0.1);
    near((await FileValidator.readMediaInfo(file(mp3(45, { xing: true }), 'b.mp3', 'audio/mpeg'))).duration, 45, 0.05);
});
test('junk, truncated and hostile input answers null and never throws', async () => {
    const junk = [Buffer.alloc(0), Buffer.from('hello world, not media at all'), Buffer.alloc(2000, 0xFF), mp4({ seconds: 5 }).subarray(0, 40), mp4({ seconds: 5 }).subarray(0, 100),
        Buffer.concat([be32(0xFFFFFFF0), Buffer.from('moov'), Buffer.alloc(100)]), Buffer.concat([be32(1), Buffer.from('moov'), Buffer.alloc(8, 255), Buffer.alloc(50)]), wav(1).subarray(0, 20), flac(5).subarray(0, 12), ogg(5).subarray(0, 30), webm(5).subarray(0, 25), Buffer.from('OggS' + 'x'.repeat(100))];
    for (const b of junk) assert.equal(await FileValidator.readMediaInfo(file(b, 'x.bin', '')), null);
    assert.equal(await FileValidator.readMediaInfo(null), null);
    assert.equal(await FileValidator.readMediaInfo({}), null);
});
test('maxDurationSec / minDurationSec use the header: no browser needed', async () => {
    const cfg = { allowedExtensions: ['.mp4', '.wav'], maxDurationSec: 10, minDurationSec: 1 };
    const long = await FileValidator.validateFile(file(mp4({ seconds: 25 }), 'long.mp4', 'video/mp4'), cfg);
    assert.equal(long.isValid, false);
    assert.equal(long.details[0].code, 'DURATION_TOO_LONG');
    const short = await FileValidator.validateFile(file(wav(0.2), 'short.wav', 'audio/wav'), cfg);
    assert.equal(short.details[0].code, 'DURATION_TOO_SHORT');
    assert.equal((await FileValidator.validateFile(file(wav(3), 'ok.wav', 'audio/wav'), cfg)).isValid, true);
});
