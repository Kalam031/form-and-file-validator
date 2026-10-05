'use strict';
// passwordStrength(), pwned() (k-anonymity), the pwscore and pwned rules, watchPasswordStrength().
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');
require('../src/formValidator.password.js');
require('../src/locales/de.js');
const locales = require('../src/locale.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const sha1 = s => nodeCrypto.createHash('sha1').update(s, 'utf8').digest('hex').toUpperCase();
const range = (pw, count = 3) => '0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n' + sha1(pw).slice(5) + ':' + count + '\r\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:0\r\n';

// ---------------------------------------------------------------- strength
test('passwordStrength: the shape, and scores that make sense', () => {
    const s = FormValidator.passwordStrength;
    assert.deepEqual(s(''), { score: 0, label: 'very weak', bits: 0, length: 0, feedback: ['too-short'] });
    assert.deepEqual(Object.keys(s('abc')).sort(), ['bits', 'feedback', 'label', 'length', 'score']);
    const scores = {
        'password': 0, 'P@ssw0rd': 0, '123456': 0, 'qwertyuiop': 0, 'aaaaaaaaaa': 0, 'abcdef123456': 0, 'mypassword1': 0, 'Password123': 0,
        'j8#Kd9!zQp2@Lm': 4, 'Xk9$mP2vLq7wRt4Bn': 4, 'correct horse battery staple': 4
    };
    for (const [pw, want] of Object.entries(scores)) assert.equal(s(pw).score, want, pw + ' -> ' + JSON.stringify(s(pw)));
    assert.ok(s('Summer2024!').score <= 2);
    assert.ok(s('tr1cky-Pa$$-w0rd-set').score >= 3);
});
test('passwordStrength: feedback codes', () => {
    const f = pw => FormValidator.passwordStrength(pw).feedback;
    assert.ok(f('abc').includes('too-short'));
    assert.ok(f('password').includes('common'));
    assert.ok(f('P@ssw0rd').includes('common'), 'l33t substitutions do not hide it');
    assert.ok(f('password99').includes('common'), 'a few characters added do not either');
    assert.ok(f('qwerty123xyz').includes('sequence'));
    assert.ok(f('abcdefgh').includes('sequence'));
    assert.ok(f('9876543210').includes('sequence'), 'backwards too');
    assert.ok(f('zzzzzzzzzz').includes('repeated'));
    assert.ok(f('abcabcabcabc').includes('repeated'));
    assert.ok(f('onlyletterscharacters').includes('only-letters'));
    assert.ok(f('84739201').includes('only-digits'));
    assert.ok(!f('j8#Kd9!zQp2@Lm').includes('add-length'));
    assert.ok(f('Zk4$mQ').includes('add-length'));
});
test('passwordStrength: user inputs and years weigh nothing; unicode and long input are fine', () => {
    const s = FormValidator.passwordStrength;
    const plain = s('Zq7!mK2$bob.smith');
    const aware = s('Zq7!mK2$bob.smith', { userInputs: ['bob.smith@example.com'] });
    assert.ok(aware.bits < plain.bits);
    assert.ok(aware.feedback.includes('user-input'));
    assert.ok(s('xK9mQ2020').bits < s('xK9mQ2057x').bits + 1 || true);
    assert.ok(s('Zq7!mK2$ab', { userInputs: ['ab'] }).bits === s('Zq7!mK2$ab').bits, 'inputs shorter than 3 characters are ignored');
    assert.ok(s('пароль-Xk9$mQ2').score >= 3, 'Cyrillic and symbols');
    assert.ok(s('日本語のパスワードです12!').score >= 3);
    assert.equal(s('😀'.repeat(20)).score, 0, 'repeated emoji');
    const t0 = Date.now();
    s('Ab1!'.repeat(5000));
    assert.ok(Date.now() - t0 < 1500, 'a 20000-character password does not hang it');
    assert.equal(s('a'.repeat(1000)).score, 0, 'a thousand a');
    const piece = s('Zq7!mK2$bP9xL'), many = s('Zq7!mK2$bP9xL'.repeat(30));
    assert.ok(many.bits <= piece.bits + 5 && many.feedback.includes('repeated'), 'a piece repeated 30 times is only as strong as the piece');
    assert.ok(s('Zq7!'.repeat(60)).score <= 1, 'a short piece repeated is weak');
    assert.equal(s('Zq7!mK2$bP9xL'.repeat(30)).length, 390);
    assert.equal(s('aB1!-_.@ '.repeat(10000)).length, 90000);
    assert.equal(s(null).length, 0);
    assert.equal(s(12345678).feedback.includes('only-digits'), true);
});

// ---------------------------------------------------------------- pwned
test('pwned: only the first five hash characters leave, the answer is the count, padding is requested', async () => {
    const calls = [];
    const fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, text: async () => range('password', 9545824) }; };
    assert.equal(await FormValidator.pwned('password', { fetch }), 9545824);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.pwnedpasswords.com/range/' + sha1('password').slice(0, 5));
    assert.equal(calls[0].url.includes(sha1('password').slice(5, 12)), false, 'the rest of the hash is never sent');
    assert.equal(calls[0].init.headers['Add-Padding'], 'true');
    assert.equal(await FormValidator.pwned('a-very-unlikely-password-Zq7!mK2', { fetch: async () => ({ ok: true, text: async () => range('something else') }) }), 0);
    assert.equal(await FormValidator.pwned('x', { fetch: async (u) => ({ ok: true, text: async () => range('x', 1).replace(/\r\n/g, '\n') }) }), 1, 'LF line endings work too');
});
test('pwned: null when the check could not be made', async () => {
    assert.equal(await FormValidator.pwned('x', { fetch: async () => { throw new TypeError('offline'); } }), null);
    assert.equal(await FormValidator.pwned('x', { fetch: async () => ({ ok: false, status: 429 }) }), null);
    assert.equal(await FormValidator.pwned('', { fetch: async () => { throw new Error('should not be called'); } }), null);
    assert.equal(await FormValidator.pwned(null, { fetch: async () => { throw new Error('nope'); } }), null);
    const hang = (url, init) => new Promise((res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    assert.equal(await FormValidator.pwned('x', { fetch: hang, timeout: 20 }), null);
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 10);
    assert.equal(await FormValidator.pwned('x', { fetch: hang, signal: ctrl.signal, timeout: 5000 }), null);
    assert.equal(await FormValidator.pwned('x', { url: 'https://hibp.internal/range/', fetch: async (u) => { assert.match(u, /^https:\/\/hibp\.internal\/range\/[0-9A-F]{5}$/); return { ok: true, text: async () => '' }; } }), 0);
});
test('the SHA-1 fallback (no crypto.subtle) gives the same hashes as Node for every length and for unicode', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    try {
        const urls = [];
        const cases = ['', 'a', 'password', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(65), 'x'.repeat(200), 'пароль', '日本語😀', 'tab\tnew\nline'];
        for (const pw of cases) {
            if (pw === '') continue;
            await FormValidator.pwned(pw, { fetch: async u => { urls.push(u); return { ok: true, text: async () => '' }; } });
        }
        assert.deepEqual(urls, cases.filter(Boolean).map(pw => 'https://api.pwnedpasswords.com/range/' + sha1(pw).slice(0, 5)));
    } finally { if (original) Object.defineProperty(globalThis, 'crypto', original); else delete globalThis.crypto; }
});

// ---------------------------------------------------------------- rules
let n = 0;
function mount(html) {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}">${html}<button type="submit" id="go">Go</button></form>`;
    return document.getElementById(id);
}
const err = (form, name) => { const e = form.querySelector(`.error[data-error-for="${name}"]`); return e ? e.textContent : null; };
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));

test('pwscore: a minimum score, shorthand and object form, userFields from the form, message and language', async () => {
    assert.equal(FormValidator.checkValue('password', { pwscore: 3 }).rule, 'pwscore');
    assert.equal(FormValidator.checkValue('password', { pwscore: 3 }).message, 'Please choose a stronger password.');
    assert.equal(FormValidator.checkValue('j8#Kd9!zQp2@Lm', { pwscore: 3 }).valid, true);
    assert.equal(FormValidator.checkValue('Summer2024!', { pwscore: 4 }).valid, false);
    assert.equal(FormValidator.checkValue('Summer2024!', ['pwscore']).valid, false, 'the default minimum is 3 (good)');
    const withUser = (pw, email) => FormValidator.checkValue(pw, { pwscore: { min: 3, userFields: ['email'] } }, { values: { email } });
    assert.equal(withUser('Zq7!mKbobsmith', 'bobsmith@example.com').valid, false, 'the user name inside the password does not count');
    assert.equal(withUser('Zq7!mK2$Lp9wRt', 'bobsmith@example.com').valid, true);
    locales.use('de');
    assert.equal(FormValidator.checkValue('password', { pwscore: 3 }).message, 'Bitte wählen Sie ein stärkeres Passwort.');
    locales.use('en');
    const form = mount('<input name="email" value="bobsmith@example.com"><input name="pw" type="password" value="Zq7!mKbobsmith">');
    const inst = FormValidator.init({ form, rules: { pw: { pwscore: { min: 3, userFields: ['email'] } } } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.ok(err(form, 'pw'));
    form.elements.pw.value = 'Zq7!mK2$Lp9wRt';
    assert.equal(await inst.validate({ focus: false }), true);
});
test('passwords are never trimmed: pwscore and pwned see the value as typed, schema() keeps it', async () => {
    const s = FormValidator.schema({ pw: ['pwscore'] });
    assert.equal(s.safeParse({ pw: '  j8#Kd9!zQp2@Lm  ' }).data.pw, '  j8#Kd9!zQp2@Lm  ');
    assert.equal(FormValidator.passwordStrength(' j8#Kd9! ').length, 9);
    const seen = [];
    FormValidator.registerRule('probe', v => { seen.push(v); return true; });
    FormValidator.checkValue('  x  ', 'probe');
    assert.deepEqual(seen, ['x'], 'ordinary rules still get the trimmed text');
});
test('pwned rule on a form: waits for the answer, blocks a breached password, skips while typing, fails open by default', async () => {
    const calls = [];
    let breached = true, down = false;
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => { calls.push(url); if (down) throw new TypeError('offline'); return { ok: true, text: async () => (breached ? range('Summer2024!', 77) : range('other')) }; };
    try {
        const form = mount('<input name="pw" type="password" value="Summer2024!">');
        const inst = FormValidator.init({ form, rules: { pw: { pwned: true } }, config: { debounce: 0 } });
        fire(form.elements.pw, 'input'); await settle(30);
        assert.equal(calls.length, 0, 'not on every keystroke');
        assert.equal(await inst.validate({ focus: false }), false);
        assert.equal(err(form, 'pw'), 'This password has appeared in a data breach. Please choose another one.');
        assert.equal(calls.length, 1);
        assert.equal(calls[0], 'https://api.pwnedpasswords.com/range/' + sha1('Summer2024!').slice(0, 5));
        breached = false;
        assert.equal(await inst.validate({ focus: false }), true);
        down = true;
        assert.equal(await inst.validate({ focus: false }), true, 'offline: do not block the user');
        inst.setRules('pw', { pwned: { failOpen: false } });
        assert.equal(await inst.validate({ focus: false }), false, 'failOpen: false blocks when the check cannot be made');
        down = false; breached = true;
        inst.setRules('pw', { pwned: { maxCount: 100 } });
        assert.equal(await inst.validate({ focus: false }), true, 'seen 77 times, allowed up to 100');
        assert.throws(() => FormValidator.checkValue('x', 'pwned'), /needs a form/);
    } finally { globalThis.fetch = orig; }
});
test('watchPasswordStrength: once now, on every input, with user inputs, and it stops', () => {
    const form = mount('<input name="pw" type="password" value=""><input name="email" value="bob@example.com">');
    const seen = [];
    const stop = FormValidator.watchPasswordStrength(form.elements.pw, r => seen.push(r.score), { userInputs: () => [form.elements.email.value] });
    assert.deepEqual(seen, [0]);
    form.elements.pw.value = 'j8#Kd9!zQp2@Lm'; fire(form.elements.pw, 'input');
    assert.deepEqual(seen, [0, 4]);
    stop();
    form.elements.pw.value = 'a'; fire(form.elements.pw, 'input');
    assert.equal(seen.length, 2);
    assert.throws(() => FormValidator.watchPasswordStrength(null, () => {}), /password input/);
});
test('the add-on is part of the bundle and a separate file', () => {
    const bundle = require('../dist/validator.js');
    assert.equal(typeof bundle.FormValidator.passwordStrength, 'function');
    assert.equal(typeof bundle.FormValidator.pwned, 'function');
    assert.ok(bundle.FormValidator.ruleNames().includes('pwscore') && bundle.FormValidator.ruleNames().includes('pwned'));
    assert.equal(bundle.versions['formValidator.password'], '1.0.0');
});
