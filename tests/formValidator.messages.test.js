'use strict';
// ICU plurals and {label} in messages, { lang } per call, formatErrors / problem details, suggestEmail, FVLocales.missing().
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS });
const { FormValidator, FileValidator, locales } = require('../dist/validator.js');
require('../src/locales/de.js'); require('../src/locales/ar.js'); require('../src/locales/ru.js'); require('../src/locales/sv.js');

test.afterEach(() => locales.use('en'));

// ---------------------------------------------------------------- ICU
test('plural: one / other, =N, offset, # and the language of the page', () => {
    const m = '{min, plural, one {# character} other {# characters}} needed';
    assert.equal(FormValidator.checkValue('', { minlength: { min: 1, message: m } }).valid, true);
    const msg = n => FormValidator.checkValue('a', { type: 'minlength', min: n, message: m }).message;
    assert.equal(msg(2), '2 characters needed');
    assert.equal(FormValidator.checkValue('', { type: 'required', message: '{x, plural, =0 {none} one {# item} other {# items}}', x: 0 }).message, 'none');
    const eq = FormValidator.checkValue('', { type: 'required', n: 0, message: '{n, plural, =0 {nothing} =1 {just one} other {many: #}}' }).message;
    assert.equal(eq, 'nothing');
    assert.equal(FormValidator.checkValue('', { type: 'required', n: 5, message: '{n, plural, offset:1 =0 {no one} one {just you} other {you and # others}}' }).message, 'you and 4 others');
    assert.equal(FormValidator.checkValue('', { type: 'required', n: 2, message: '{n, plural, offset:1 =0 {no one} one {you and one other} other {you and # others}}' }).message, 'you and one other');
});
test('plural categories follow the language: Russian (one / few / many), Arabic (zero / two), and select', () => {
    const t = '{n, plural, one {# файл} few {# файла} many {# файлов} other {# файла}}';
    const ru = n => { locales.use('ru'); return FormValidator.checkValue('', { type: 'required', n, message: t }).message; };
    assert.deepEqual([ru(1), ru(3), ru(5), ru(21)], ['1 файл', '3 файла', '5 файлов', '21 файл']);
    locales.use('ar');
    assert.equal(FormValidator.locale, 'ar');
    const ar = n => FormValidator.checkValue('', { type: 'required', n, message: '{n, plural, zero {لا شيء} two {اثنان} other {#}}' }).message;
    assert.deepEqual([ar(0), ar(2), ar(7)], ['لا شيء', 'اثنان', '7']);
    locales.use('en');
    assert.equal(FormValidator.locale, 'en');
    const sel = g => FormValidator.checkValue('', { type: 'required', g, message: '{g, select, f {She must} m {He must} other {They must}} agree' }).message;
    assert.deepEqual([sel('f'), sel('m'), sel('x'), sel(undefined)], ['She must agree', 'He must agree', 'They must agree', 'They must agree']);
});
test('ICU edge cases: nesting, unbalanced braces, plain placeholders, junk never throws', () => {
    const m = (message, extra) => FormValidator.checkValue('', Object.assign({ type: 'required', message }, extra)).message;
    assert.equal(m('{n, plural, one {{n, select, a {A#} other {x}}} other {many}}', { n: 1 }), 'x');
    assert.equal(m('{n, plural, one {# one} other {# other', { n: 1 }), '{n, plural, one {# one} other {# other', 'unbalanced: left as written');
    assert.equal(m('Only {min} left', { min: 3 }), 'Only 3 left');
    assert.equal(m('{n, plural, other {a}} and {n}', { n: 2 }), 'a and 2');
    assert.equal(m('{n, plural, one {x}}', { n: 5 }), '', 'no matching branch and no other');
    assert.equal(m('{n, plural, one {x} other {y}}', { n: 'abc' }), 'y', 'a non-number takes other');
    assert.equal(m('{ n , plural , one { # } other { # } }'.replace(/ /g, ' '), { n: 1 }), ' 1 ');
    assert.doesNotThrow(() => m('{{{, plural, , }}} {a, select,', {}));
    assert.equal(m('{unknown}', {}), '{unknown}');
});
test('plain messages with {0}-style or {min} placeholders are unchanged, and the config path (forms) uses ICU too', async () => {
    assert.equal(FormValidator.checkValue('a', { minlength: 3 }).message, 'Please enter at least 3 characters.');
    const form = document.body.appendChild(document.createElement('form'));
    form.innerHTML = '<input name="a" value="x">';
    const inst = FormValidator.init({ form, rules: { a: [{ type: 'minlength', min: 3, message: '{min, plural, one {# char} other {# chars}} please' }] } });
    await inst.validate({ focus: false });
    assert.equal(form.querySelector('.error').textContent, '3 chars please');
});

// ---------------------------------------------------------------- {label}
test('{label} and {name}: from checkValues labels, the key itself, and the form label', async () => {
    const rules = { email: [{ type: 'required', message: '{label} is needed' }], 'user.age': [{ type: 'required', message: '{label} missing ({name})' }] };
    const r = FormValidator.checkValues({}, rules, { labels: { email: 'Your email' } });
    assert.equal(r.errors.email, 'Your email is needed');
    assert.equal(r.errors['user.age'], 'user.age missing (user.age)');
    assert.equal(FormValidator.checkValue('', { type: 'required', message: '{label}!' }, { label: 'Name' }).message, 'Name!');
    document.body.innerHTML = '<form><label for="e">E-mail address *</label><input id="e" name="email"></form>';
    const inst = FormValidator.init({ form: document.querySelector('form'), rules: { email: [{ type: 'required', message: '{label} is required, thanks' }] } });
    await inst.validate({ focus: false });
    assert.equal(document.querySelector('.error').textContent, 'E-mail address is required, thanks');
});

// ---------------------------------------------------------------- lang per call
test('{ lang } translates one call without switching the page, for checkValue, checkValues, schema and forms', async () => {
    assert.equal(FormValidator.checkValue('', 'required', { lang: 'de' }).message, 'Dieses Feld ist erforderlich.');
    assert.equal(FormValidator.checkValue('', 'required').message, 'This field is required.', 'the page language is untouched');
    assert.equal(FormValidator.checkValue('ab', { minlength: 3 }, { lang: 'sv' }).message, 'Ange minst 3 tecken.');
    assert.equal(FormValidator.checkValue('', 'required', { lang: 'de-AT' }).message, 'Dieses Feld ist erforderlich.', 'a region falls back to the language');
    assert.equal(FormValidator.checkValue('', 'required', { lang: 'xx' }).message, 'This field is required.', 'an unknown language falls back to English');
    assert.equal(FormValidator.checkValues({ e: 'x' }, { e: 'email' }, { lang: 'de' }).errors.e, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
    assert.match(FormValidator.schema({ e: 'email' }, { lang: 'sv' }).safeParse({ e: 'x' }).errors.e, /e-postadress/);
    assert.equal(FormValidator.checkValue('', { required: { message: 'mine' } }, { lang: 'de' }).message, 'mine', 'your own message still wins');
    assert.equal(FormValidator.checkValue('', 'required', { lang: 'de', messages: { required: 'override' } }).message, 'override');
    const form = document.body.appendChild(document.createElement('form'));
    form.innerHTML = '<input name="a">';
    const inst = FormValidator.init({ form, rules: { a: 'required' }, config: { lang: 'sv' } });
    await inst.validate({ focus: false });
    assert.equal(form.querySelector('.error').textContent, 'Det här fältet är obligatoriskt.');
    locales.use('de');
    assert.equal(FormValidator.checkValue('', 'required', { lang: 'sv' }).message, 'Det här fältet är obligatoriskt.', 'lang beats the page language');
    assert.equal(FormValidator.checkValue('', 'required').message, 'Dieses Feld ist erforderlich.');
});
test('ICU plural in a per-call language uses that language\'s plural rules', () => {
    assert.equal(FormValidator.checkValue('', { type: 'required', n: 5, message: '{n, plural, one {# файл} few {# файла} many {# файлов} other {x}}' }, { lang: 'ru' }).message, '5 файлов');
    assert.equal(FormValidator.checkValue('', { type: 'required', n: 5, message: '{n, plural, one {# file} other {# files}}' }).message, '5 files');
});

// ---------------------------------------------------------------- formatErrors
const ERRS = { email: 'Bad email', 'items[0].qty': 'Required', 'items[1].qty': 'Digits only', 'user.name.first': 'Short' };
test('formatErrors: flat, tree, list, pretty', () => {
    const f = FormValidator.formatErrors;
    assert.deepEqual(f(ERRS), ERRS);
    assert.deepEqual(f(ERRS, 'flat'), ERRS);
    assert.deepEqual(f(ERRS, 'tree'), { email: 'Bad email', items: [{ qty: 'Required' }, { qty: 'Digits only' }], user: { name: { first: 'Short' } } });
    assert.deepEqual(f({ a: ['first', 'second'] }, 'list'), [{ field: 'a', message: 'first' }]);
    assert.equal(f(ERRS, 'pretty'), 'email: Bad email\nitems[0].qty: Required\nitems[1].qty: Digits only\nuser.name.first: Short');
    assert.deepEqual(f({ errors: { a: 'x' } }, 'flat'), { a: 'x' }, 'the result of checkValues is accepted');
    assert.deepEqual(f(null, 'tree'), {});
    assert.deepEqual(f(undefined, 'list'), []);
    assert.deepEqual(f(JSON.parse('{"__proto__":"x","ok":"y"}'), 'tree'), { ok: 'y' });
    assert.equal({}.x, undefined);
});
test('formatErrors "problem": an RFC 9457 body, and it round-trips through serverErrors', () => {
    const body = FormValidator.formatErrors(ERRS, 'problem', { title: 'Validation failed', status: 400, type: 'https://x/validation', instance: '/signup', detail: 'See errors' });
    assert.deepEqual([body.type, body.title, body.status, body.instance, body.detail], ['https://x/validation', 'Validation failed', 400, '/signup', 'See errors']);
    assert.deepEqual(body.errors.email, ['Bad email']);
    assert.equal(FormValidator.formatErrors({}, 'problem').status, 422);
    const back = FormValidator.serverErrors(body);
    assert.equal(back.format, 'problem+json');
    assert.deepEqual(back.errors, ERRS);
    const all = FormValidator.formatErrors(FormValidator.serverErrors({ errors: { a: ['one', 'two'] } }), 'problem');
    assert.deepEqual(all.errors.a, ['one', 'two'], 'every message of a field is kept');
});

// ---------------------------------------------------------------- suggestEmail
test('suggestEmail: typos in the domain and the ending, nothing for good or unknown addresses', () => {
    const s = FormValidator.suggestEmail;
    assert.equal(s('bob@gmial.com'), 'bob@gmail.com');
    assert.equal(s('bob@gmai.com'), 'bob@gmail.com');
    assert.equal(s('bob@gmail.con'), 'bob@gmail.com');
    assert.equal(s('bob@hotmial.com'), 'bob@hotmail.com');
    assert.equal(s('bob@yaho.com'), 'bob@yahoo.com');
    assert.equal(s('bob@outlok.com'), 'bob@outlook.com');
    assert.equal(s('Bob.Smith+tag@GMAIL.COM'), null, 'already right (any case)');
    assert.equal(s('bob@gmail.com'), null);
    assert.equal(s('bob@mycompany.com'), null);
    assert.equal(s('bob@company.cmo'), 'bob@company.com');
    assert.equal(s('bob@company.nte'), 'bob@company.net');
    assert.equal(s('bob@university.xyz'), null, 'a real but unusual ending is left alone');
    assert.equal(s('not an email'), null);
    assert.equal(s('@gmail.com'), null);
    assert.equal(s('bob@'), null);
    assert.equal(s(''), null);
    assert.equal(s(null), null);
    assert.equal(s('bob@mycompnay.com', { domains: ['mycompany.com'] }), 'bob@mycompany.com', 'your own domains');
    assert.equal(s('Bob@Gmial.com'), 'Bob@gmail.com', 'the part before the @ is never touched');
});

// ---------------------------------------------------------------- missing()
test('FVLocales.missing: what a language still lacks', () => {
    assert.deepEqual(locales.missing('de'), { form: [], file: [], phrases: [] });
    locales.register('fi', { name: 'Suomi', form: { required: 'Kenttä on pakollinen.' } });
    const m = locales.missing('fi');
    assert.ok(m.form.includes('email') && !m.form.includes('required'));
    assert.ok(m.file.includes('EMPTY_FILE'));
    assert.ok(m.phrases.length > 20);
    assert.throws(() => locales.missing('zz'), /unknown language/);
    locales.register('fi', { form: { email: 'x' } });
    assert.ok(!locales.missing('fi').form.includes('email'), 'registering more fills the gap');
});
