/*!
 * FormValidator password add-on v1.0.0 — a strength estimate, a minimum-strength rule and a breached-password check.
 *
 *   FormValidator.passwordStrength('Tr0ub4dor&3', { userInputs: [email, name] })   // { score: 0..4, label, bits, length, feedback: ['common', 'sequence', ...] }
 *   FormValidator.watchPasswordStrength(input, result => meter.value = result.score)
 *   await FormValidator.pwned(password)                                            // times seen in known breaches (0 = never, null = could not check)
 *   rules: { password: { pwcheck: { minLength: 8 }, pwscore: 3, pwned: true } }    // "good" or better, and not in a breach
 *
 * Part of the one-file bundle; on its own it needs formValidator.js loaded first. The strength estimate runs offline (about 1 KB of common passwords, no downloads);
 * the breach check sends only the first 5 characters of the password's SHA-1 hash to the Have I Been Pwned range API (k-anonymity), never the password.
 *
 * Changelog
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['./formValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, require('./formValidator.js'));
    else factory(root, root.FormValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';
    if (!FV) throw new Error('formValidator.password.js needs FormValidator loaded first');

    const isNum = v => typeof v === 'number' && isFinite(v);
    const COMMON_PASSWORDS = new Set(('password 123456 12345678 qwerty abc123 monkey letmein dragon 111111 baseball iloveyou trustno1 sunshine master welcome shadow ashley football jesus michael ninja ' +
        'mustang password1 123456789 12345 1234567 1234567890 qwertyuiop 123123 654321 superman 1qaz2wsx 7777777 121212 000000 qazwsx 123qwe killer jordan jennifer zxcvbnm asdfgh hunter buster ' +
        'soccer harley batman andrew tigger charlie robert thomas hockey ranger daniel starwars 112233 george computer michelle jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass ' +
        'maggie 159753 aaaaaa ginger princess joshua cheese amanda summer love nicole chelsea biteme matthew access yankees 987654321 dallas austin thunder taylor matrix admin administrator root toor ' +
        'passw0rd welcome1 qwerty123 changeme default login guest test letmein1 football1 iloveyou1 monkey1 dragon1 abc12345 qwerty1 password123 pa55word 1q2w3e4r 1q2w3e 123321 666666 696969 ' +
        'secret hello hello123 whatever internet service canada hello1 flower passw0rd1 azerty loveme lovely 1234 12345678910 nothing starwars1 qwe123 samsung google').split(' '));
    const COMMON_LIST = Array.from(COMMON_PASSWORDS).filter(c => c.length >= 5);
    const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'qazwsxedcrfvtgbyhnujmikolp'];
    const LEET = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '+': 't' };
    const LABELS = ['very weak', 'weak', 'fair', 'good', 'strong'];

    /**
     * A fast, offline estimate of how hard a password is to guess. Returns
     *   { score: 0..4, label, bits, length, feedback: ['too-short', 'common', 'sequence', 'repeated', 'user-input', 'only-letters', 'only-digits', 'add-length'] }
     * Characters in a keyboard run (qwerty, 12345, abcd), a repeat (aaaa), a year or a piece of what you tell it about the user (options.userInputs: email, name ...) count
     * as about one bit instead of a free choice, and a common password (also with l33t substitutions or a few characters added) scores 0. Score thresholds on `bits`: 28 / 36 / 60 / 80.
     * It is a guide for a meter and a minimum, not a guarantee: it has no dictionary of words, so an ordinary word with substitutions can score higher than it deserves.
     */
    function passwordStrength(password, options) {
        const o = options || {};
        const full = password === null || password === undefined ? '' : String(password);
        // a password of 256 characters is judged on its first 256: anything longer than that is strong unless it repeats, and repeats show up in the first 256 too
        const pw = full.length > 256 ? full.slice(0, 256) : full;
        const chars = Array.from(pw), n = chars.length;
        const feedback = [];
        if (!n) return { score: 0, label: LABELS[0], bits: 0, length: 0, feedback: ['too-short'] };
        let pool = 0;
        if (/\p{Ll}/u.test(pw)) pool += 26;
        if (/\p{Lu}/u.test(pw)) pool += 26;
        if (/\p{Nd}/u.test(pw)) pool += 10;
        if (/[ -\/:-@\[-`{-~]/.test(pw)) pool += 33;
        if (/[^\x00-\x7f]/.test(pw)) pool += 50;   // letters and symbols of other alphabets
        pool = Math.max(pool, 10);
        const per = Math.log2(pool);
        const lower = pw.toLowerCase(), lowerChars = Array.from(lower);
        const covered = new Array(n).fill(false);   // characters that are a pattern, not a free choice
        const cover = (from, len) => { for (let i = from; i < from + len && i < n; i++) covered[i] = true; };
        const note = f => { if (feedback.indexOf(f) < 0) feedback.push(f); };
        for (let i = 0; i < n;) { let j = i; while (j < n && chars[j] === chars[i]) j++; if (j - i >= 3) { cover(i, j - i); note('repeated'); } i = Math.max(j, i + 1); }   // aaaa
        for (let len = 2; len <= 4; len++) for (let i = 0; i + len * 3 <= n; i++) {                                                                                          // abababab
            const unit = lowerChars.slice(i, i + len).join('');
            if (lowerChars.slice(i + len, i + 2 * len).join('') === unit && lowerChars.slice(i + 2 * len, i + 3 * len).join('') === unit) { cover(i, len * 3); note('repeated'); }
        }
        for (let i = 0; i + 3 <= n; i++) {   // abc, 987
            const a = lowerChars[i].codePointAt(0), b = lowerChars[i + 1].codePointAt(0), c = lowerChars[i + 2].codePointAt(0);
            if (b - a === c - b && Math.abs(b - a) === 1) {
                let j = i + 2; const d = b - a;
                while (j + 1 < n && lowerChars[j + 1].codePointAt(0) - lowerChars[j].codePointAt(0) === d) j++;
                cover(i, j - i + 1); note('sequence'); i = j - 1;
            }
        }
        KEYBOARD_ROWS.forEach(row => {   // qwerty, poiuy
            [row, row.split('').reverse().join('')].forEach(r => {
                for (let i = 0; i + 3 <= n; i++) {
                    const start = r.indexOf(lower.slice(i, i + 3));
                    if (start < 0) continue;
                    let k = 0;
                    while (i + k < n && start + k < r.length && lower[i + k] === r[start + k]) k++;
                    if (k >= 3) { cover(i, k); note('sequence'); }
                }
            });
        });
        for (const m of pw.matchAll(/(?:19|20)\d{2}/g)) cover(m.index, 4);   // years
        [].concat(o.userInputs || []).forEach(u => {   // what the site knows about the user
            const t = String(u === null || u === undefined ? '' : u).toLowerCase().trim();
            const parts = t.length >= 3 ? [t].concat(t.split(/[^\p{L}\p{N}]+/u).filter(x => x.length >= 3)) : [];
            parts.forEach(p => { const at = lower.indexOf(p); if (at >= 0) { cover(at, p.length); note('user-input'); } });
        });
        // free characters cost `per` bits each; a whole run of pattern characters (qwerty, aaaa, abcd) costs about ten bits however long it is
        let bits = 0, run = 0;
        const endRun = () => { if (run) { bits += 3 + 1.2 * Math.min(run, 6); run = 0; } };
        covered.forEach(c => { if (c) run++; else { endRun(); bits += per; } });
        endRun();
        // a password that is one short piece repeated over and over is only as strong as that piece
        for (let p = 1; p * 3 <= n; p++) {
            let same = true;
            for (let i = 0; i + p < n; i++) if (lowerChars[i] !== lowerChars[i + p]) { same = false; break; }
            if (same) { bits = Math.min(bits, p * per + 4); note('repeated'); break; }
        }
        // a common password (also with l33t substitutions or a few characters added) is not a secret
        const plain = lower.replace(/[01345 7@$!+]/g, ch => LEET[ch] || ch), stripped = lower.replace(/[^\p{L}\p{N}]/gu, '');
        const isCommon = w => COMMON_PASSWORDS.has(w) || (w.length >= 5 && COMMON_LIST.some(c => w.indexOf(c) === 0 && w.length <= c.length + 3 || (w.length <= c.length + 3 && w.slice(-c.length) === c)));
        if (isCommon(lower) || isCommon(plain) || isCommon(stripped)) { bits = Math.min(bits, 12); note('common'); }
        if (n < 8) note('too-short');
        if (/^\p{L}+$/u.test(pw)) note('only-letters');
        if (/^\p{Nd}+$/u.test(pw)) note('only-digits');
        if (n < 12 && bits < 60) note('add-length');
        bits = Math.round(bits * 10) / 10;
        const score = bits < 28 ? 0 : bits < 36 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
        return { score, label: LABELS[score], bits, length: full.length > 256 ? Array.from(full).length : n, feedback };
    }

    // a small SHA-1 for pages without crypto.subtle (plain http)
    function sha1Hex(text) {
        const bytes = Array.from(new TextEncoder().encode(text));
        const l = bytes.length * 8;
        bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
        for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
        let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
        const rol = (x, n) => (x << n) | (x >>> (32 - n));
        for (let off = 0; off < bytes.length; off += 64) {
            const w = [];
            for (let i = 0; i < 16; i++) w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
            for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
            let a = h0, b = h1, c = h2, d = h3, e = h4;
            for (let i = 0; i < 80; i++) {
                const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
                const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
                const t = (rol(a, 5) + f + e + k + w[i]) >>> 0;
                e = d; d = c; c = rol(b, 30) >>> 0; b = a; a = t;
            }
            h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
        }
        return [h0, h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('').toUpperCase();
    }
    async function sha1(text) {
        const subtle = root.crypto && root.crypto.subtle;
        if (subtle && typeof subtle.digest === 'function') {
            try { return Array.from(new Uint8Array(await subtle.digest('SHA-1', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); } catch (e) { /* fall back */ }
        }
        return sha1Hex(text);
    }

    /**
     * How often a password appeared in known data breaches (Have I Been Pwned "Pwned Passwords", k-anonymity): only the first 5 characters of the SHA-1 hash are sent,
     * never the password. Resolves to the count (0 = not found) or null when the check could not be made (offline, blocked, timeout, empty password).
     * options: url (default 'https://api.pwnedpasswords.com/range/'), timeout (5000 ms), fetch, signal.
     */
    async function pwned(password, options) {
        const o = options || {};
        const doFetch = o.fetch || (typeof fetch === 'function' ? fetch : null);
        if (!doFetch || password === null || password === undefined || password === '') return null;
        const hash = await sha1(String(password));
        const prefix = hash.slice(0, 5), suffix = hash.slice(5);
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), o.timeout || 5000) : null;
        if (o.signal && ctrl) { if (o.signal.aborted) ctrl.abort(); else if (o.signal.addEventListener) o.signal.addEventListener('abort', () => ctrl.abort(), { once: true }); }
        try {
            const resp = await doFetch((o.url || 'https://api.pwnedpasswords.com/range/') + prefix, { headers: { 'Add-Padding': 'true' }, signal: ctrl ? ctrl.signal : undefined });
            if (!resp.ok) return null;
            const text = await resp.text();
            for (const line of String(text).split(/\r?\n/)) {
                const i = line.indexOf(':');
                if (i > 0 && line.slice(0, i).trim().toUpperCase() === suffix) { const c = parseInt(line.slice(i + 1), 10); return isFinite(c) ? c : 1; }
            }
            return 0;
        } catch (e) { return null; } finally { if (timer) clearTimeout(timer); }
    }

    /** Calls fn(result) with passwordStrength() whenever the input changes (and once now): for a strength meter. Returns a function that stops it. */
    function watchPasswordStrength(input, fn, options) {
        if (!input || typeof input.addEventListener !== 'function') throw new Error('watchPasswordStrength: pass the password input');
        const run = () => {
            const o = options || {};
            fn(passwordStrength(input.value, { userInputs: [].concat(typeof o.userInputs === 'function' ? o.userInputs() : (o.userInputs || [])) }));
        };
        input.addEventListener('input', run);
        run();
        return () => input.removeEventListener('input', run);
    }

    const otherValue = (env, name) => {   // another field of the form / the data, as text
        const vals = env.values || (env.inst && typeof env.inst.getValues === 'function' ? env.inst.getValues() : null);
        const v = vals ? vals[name] : undefined;
        return v === undefined || v === null ? '' : String(Array.isArray(v) ? v.join(' ') : v).trim();
    };
    // pwscore: { pwscore: 3 } = at least "good"; { type: 'pwscore', min: 3, userFields: ['email', 'name'] } also treats those fields' values as guessable
    FV.registerRule('pwscore', (v, r, env) => {
        const users = [].concat(r.userFields || []).map(name => otherValue(env, name)).filter(Boolean).concat(r.userInputs || []);
        return passwordStrength(v, { userInputs: users }).score >= (r.min !== undefined ? Number(r.min) : (Number(r.param) || 3));
    }, { raw: true });
    // pwned: { pwned: true } | { pwned: { maxCount: 0, timeout: 5000, failOpen: true } }   (asynchronous: a form waits for it, it is skipped while typing; checkValue cannot run it)
    FV.registerRule('pwned', async (v, r) => {
        const count = await pwned(v, { timeout: r.timeout, fetch: r.fetch, url: r.url });
        if (count === null) return r.failOpen === false ? false : true;   // could not ask: do not block the user
        return count <= (isNum(r.maxCount) ? r.maxCount : 0);
    }, { raw: true, remote: true });
    if (!FV.messages.pwscore) FV.messages.pwscore = 'Please choose a stronger password.';
    if (!FV.messages.pwned) FV.messages.pwned = 'This password has appeared in a data breach. Please choose another one.';

    FV.passwordStrength = passwordStrength;
    FV.pwned = pwned;
    FV.watchPasswordStrength = watchPasswordStrength;
    return { passwordStrength, pwned, watchPasswordStrength };
});
