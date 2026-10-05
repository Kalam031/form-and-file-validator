'use strict';
// validateOn presets + valid class (reward early, punish late), stable error codes, accessible error summary, autoAttributes + lint.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, Element: w.Element });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');
require('../src/locales/de.js');
const locales = require('../src/locale.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
let n = 0;
function mount(html, extra = '') {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}">${extra}${html}<button type="submit" id="go">Go</button></form>`;
    return document.getElementById(id);
}
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));
const typeIn = (el, v) => { el.value = v; fire(el, 'input'); };
const leave = (el) => { fire(el, 'change'); fire(el, 'focusout'); };
const err = (form, name) => { const e = form.querySelector(`.error[data-error-for="${name}"]`); return e ? e.textContent : null; };
const init = (form, rules, config, extra) => FormValidator.init(Object.assign({ form, rules, config }, extra));

// ---------------------------------------------------------------- validateOn presets
test('default (smart): nothing while typing, error after leaving an edited field, live fix while it is invalid', async () => {
    const form = mount('<input name="email">');
    init(form, { email: ['required', 'email'] }, { debounce: 0 });
    const el = form.elements.email;
    typeIn(el, 'a@'); await settle();
    assert.equal(err(form, 'email'), null, 'punish late: no error while typing');
    leave(el); await settle();
    assert.ok(err(form, 'email'));
    typeIn(el, 'a@b.co'); await settle();
    assert.equal(err(form, 'email'), null, 'reward early: the error leaves as soon as the value is right');
    typeIn(el, 'a@b.c'); await settle();
    assert.equal(err(form, 'email'), null, 'a field that was valid is not nagged while typing again');
});
test("validateOn: 'blur' checks on focusout but does not nag fields that were only tabbed through", async () => {
    const form = mount('<input name="a"><input name="b">');
    init(form, { a: 'required', b: 'required' }, { validateOn: 'blur' });
    fire(form.elements.a, 'focusout'); await settle();
    assert.equal(err(form, 'a'), null, 'empty and untouched: no error');
    form.elements.b.value = 'x'; form.elements.b.value = ''; fire(form.elements.b, 'focusout'); await settle();
    assert.equal(err(form, 'b'), null, 'still empty until the first submit');
    form.querySelector('#go').click(); await settle(60);
    assert.ok(err(form, 'a') && err(form, 'b'), 'submit reports both');
});
test("validateOn: 'blur' flags a bad value on focusout", async () => {
    const form = mount('<input name="a">');
    init(form, { a: { minlength: 5 } }, { validateOn: 'blur' });
    form.elements.a.value = 'ab'; fire(form.elements.a, 'focusout'); await settle();
    assert.ok(err(form, 'a'));
});
test("validateOn: 'input' checks while typing (debounced); an 'input' entry in a list works too", async () => {
    for (const v of ['input', ['input'], ['change', 'input']]) {
        const form = mount('<input name="a">');
        init(form, { a: { minlength: 5 } }, { validateOn: v, debounce: 0 });
        typeIn(form.elements.a, 'ab'); await settle();
        assert.ok(err(form, 'a'), JSON.stringify(v));
        typeIn(form.elements.a, 'abcdef'); await settle();
        assert.equal(err(form, 'a'), null);
    }
});
test("validateOn: 'submit' shows nothing until the first submit, then fixes live", async () => {
    const form = mount('<input name="a">');
    init(form, { a: { minlength: 5 } }, { validateOn: 'submit', debounce: 0 });
    form.elements.a.value = 'ab'; leave(form.elements.a); await settle();
    assert.equal(err(form, 'a'), null);
    form.querySelector('#go').click(); await settle(60);
    assert.ok(err(form, 'a'));
    typeIn(form.elements.a, 'abcdef'); await settle();
    assert.equal(err(form, 'a'), null);
});
test("validateOn: 'all' and unknown strings; arrays with junk still work", async () => {
    let form = mount('<input name="a">');
    assert.deepEqual(init(form, { a: 'required' }, { validateOn: 'all' }).config.validateOn, ['change', 'blur', 'input']);
    form = mount('<input name="a">');
    assert.deepEqual(init(form, { a: 'required' }, { validateOn: 'nonsense' }).config.validateOn, ['change']);
    form = mount('<input name="a">');
    assert.deepEqual(init(form, { a: 'required' }, { validateOn: ['blur', 5, null] }).config.validateOn, ['blur']);
});
test('validClass: appears while typing once the value is valid, leaves when it turns invalid on blur, never shows an error on input', async () => {
    const form = mount('<input name="email">');
    init(form, { email: ['required', 'email'] }, { validClass: 'is-valid', debounce: 0 });
    const el = form.elements.email;
    typeIn(el, 'a@b'); await settle();
    assert.equal(el.classList.contains('is-valid'), false);
    assert.equal(err(form, 'email'), null);
    typeIn(el, 'a@b.co'); await settle();
    assert.equal(el.classList.contains('is-valid'), true, 'reward early');
    typeIn(el, 'a@b'); await settle();
    assert.equal(el.classList.contains('is-valid'), false);
    assert.equal(err(form, 'email'), null, 'punish late');
    leave(el); await settle();
    assert.ok(err(form, 'email'));
    assert.equal(el.classList.contains('is-valid'), false);
    typeIn(el, 'a@b.co'); await settle();
    assert.equal(el.classList.contains('is-valid'), true);
    assert.equal(el.classList.contains('is-invalid'), false);
});
test('validClass: empty optional fields are not marked, rewardOnInput:false waits for a real check, reset clears it', async () => {
    const form = mount('<input name="a"><input name="b">');
    const inst = init(form, { a: { minlength: 2 }, b: { minlength: 2 } }, { validClass: 'ok', rewardOnInput: false, debounce: 0 });
    typeIn(form.elements.a, 'abc'); await settle();
    assert.equal(form.elements.a.classList.contains('ok'), false);
    leave(form.elements.a); await settle();
    assert.equal(form.elements.a.classList.contains('ok'), true);
    leave(form.elements.b); await settle();
    assert.equal(form.elements.b.classList.contains('ok'), false, 'empty');
    inst.resetForm();
    assert.equal(form.elements.a.classList.contains('ok'), false);
});

// ---------------------------------------------------------------- stable error codes
test('error codes: on the message element, getErrors(), onError, custom rule code, badInput, server', async () => {
    const form = mount('<input name="email"><input name="age" type="number"><input name="coupon">');
    let reported;
    const inst = init(form, {
        email: ['required', 'email'], age: { min: 18 },
        coupon: [{ type: 'pattern', pattern: '^[A-Z]+$', code: 'coupon.format' }]
    }, { onError: list => { reported = list; } });
    form.elements.coupon.value = 'abc';
    await inst.validate();
    assert.equal(form.querySelector('.error[data-error-for=email]').getAttribute('data-code'), 'required');
    assert.equal(form.querySelector('.error[data-error-for=coupon]').getAttribute('data-code'), 'coupon.format');
    assert.deepEqual(inst.getErrors().map(e => [e.name, e.code, e.rule]).sort(), [['coupon', 'coupon.format', 'coupon.format'], ['email', 'required', 'required']]);
    assert.deepEqual(reported.map(e => e.code).sort(), ['coupon.format', 'required']);
    form.elements.email.value = 'bad'; await inst.validate({ focus: false });
    assert.equal(inst.getErrors().find(e => e.name === 'email').code, 'email');
    inst.setError('email', 'Taken');
    assert.equal(form.querySelector('.error[data-error-for=email]').getAttribute('data-code'), 'server');
    inst.setError('email', 'Custom', 'email.taken');
    assert.equal(inst.getErrors().find(e => e.name === 'email').code, 'email.taken');
    inst.setServerErrors({ errors: { email: ['x'] } });
    assert.equal(inst.getErrors().find(e => e.name === 'email').code, 'server');
});
test('error codes: checkValue, checkValues and schema issues carry the code', () => {
    assert.deepEqual(FormValidator.checkValue('x', ['email']), { valid: false, rule: 'email', code: 'email', message: 'Please enter a valid email address.' });
    assert.equal(FormValidator.checkValue('x', [{ type: 'email', code: 'mail.bad' }]).code, 'mail.bad');
    assert.equal(FormValidator.checkValue('a@b.co', ['email']).code, null);
    const r = FormValidator.checkValues({ e: 'x' }, { e: ['email'] });
    assert.equal(r.details.e.code, 'email');
    const s = FormValidator.schema({ e: ['email'] }).safeParse({ e: 'x' });
    assert.equal(s.issues[0].code, 'email');
});

// ---------------------------------------------------------------- error summary
const SUMMARY_FORM = '<label for="email">Email *</label><input id="email" name="email"><label>Name<input name="nick"></label>' +
    '<fieldset><legend>Plan</legend><label><input type="radio" name="plan" value="a"> A</label><label><input type="radio" name="plan" value="b"> B</label></fieldset>';
const SUMMARY_RULES = { email: ['required', 'email'], nick: { required: true }, plan: 'required' };

test('errorSummary: true builds an accessible list with links, focuses it on a failed submit, and labels each message', async () => {
    const form = mount(SUMMARY_FORM);
    const inst = init(form, SUMMARY_RULES, { errorSummary: true });
    form.querySelector('#go').click(); await settle(60);
    const box = form.querySelector('.fv-summary');
    assert.ok(box, 'created inside the form');
    assert.equal(form.firstElementChild, box);
    assert.equal(box.hidden, false);
    assert.equal(box.getAttribute('tabindex'), '-1');
    assert.equal(document.activeElement, box, 'focus goes to the summary');
    const h = box.querySelector('h2');
    assert.equal(h.textContent, 'Please fix the following:');
    assert.equal(box.getAttribute('aria-labelledby'), h.id);
    const links = Array.from(box.querySelectorAll('li a'));
    assert.equal(links.length, 3);
    assert.deepEqual(links.map(a => a.textContent), ['Email: This field is required.', 'Name: This field is required.', 'Plan: This field is required.']);
    assert.equal(links[0].getAttribute('href'), '#email');
    assert.ok(links[1].getAttribute('href').startsWith('#fv-field-'), 'a field without an id gets one');
    links[1].click();
    assert.equal(document.activeElement, form.elements.nick, 'the link focuses its field');
    links[2].click();
    assert.equal(document.activeElement, form.elements.plan[0], 'a radio group focuses its first input');
    inst.destroy();
    assert.equal(form.querySelector('.fv-summary'), null, 'destroy removes what it created');
});
test('errorSummary: it follows the errors as they are fixed and hides when none are left, without rebuilding unchanged lists', async () => {
    const form = mount(SUMMARY_FORM);
    init(form, SUMMARY_RULES, { errorSummary: true, debounce: 0 });
    form.querySelector('#go').click(); await settle(60);
    const box = form.querySelector('.fv-summary');
    const firstList = box.querySelector('ul');
    form.elements.nick.value = 'bob'; leave(form.elements.nick); await settle(40);
    assert.equal(box.querySelectorAll('li').length, 2);
    form.elements.email.value = 'a@b.co'; leave(form.elements.email);
    form.elements.plan[0].checked = true; fire(form.elements.plan[0], 'change'); await settle(40);
    assert.equal(box.hidden, true);
    assert.equal(box.querySelector('ul'), null);
    assert.notEqual(box.querySelector('ul'), firstList);
    form.elements.nick.value = ''; leave(form.elements.nick); await settle(40);
    assert.equal(box.hidden, true, 'a new error on blur does not reopen the summary before a submit');
});
test('errorSummary: own container by selector, custom title, heading level, no label, focus on the field, message text is not HTML', async () => {
    const form = mount('<input name="a" id="a">', '<div id="mine"></div>');
    init(form, { a: [{ type: 'required', message: '<img src=x onerror=alert(1)> Required' }] }, { errorSummary: { container: '#mine', title: 'Problems', headingLevel: 3, withLabel: false, focus: 'field' } });
    form.querySelector('#go').click(); await settle(60);
    const box = document.getElementById('mine');
    assert.ok(box.classList.contains('fv-summary'));
    assert.equal(box.querySelector('h3').textContent, 'Problems');
    assert.equal(box.querySelector('a').textContent, '<img src=x onerror=alert(1)> Required');
    assert.equal(box.querySelector('img'), null);
    assert.equal(document.activeElement, form.elements.a, "focus: 'field' keeps the classic behaviour");
});
test('errorSummary: a user container survives destroy (emptied and hidden); element and selector both work; no summary without the option', async () => {
    const form = mount('<input name="a">', '<div id="mine2"></div>');
    const el = document.getElementById('mine2');
    const inst = init(form, { a: 'required' }, { errorSummary: el });
    form.querySelector('#go').click(); await settle(60);
    assert.equal(el.querySelectorAll('li').length, 1);
    inst.destroy();
    assert.ok(document.getElementById('mine2'));
    assert.equal(el.hidden, true);
    assert.equal(el.querySelector('ul'), null);
    const form2 = mount('<input name="a">');
    init(form2, { a: 'required' }, {});
    form2.querySelector('#go').click(); await settle(60);
    assert.equal(form2.querySelector('.fv-summary'), null);
});
test('errorSummary: showSummary() on demand, validate() without submit does not open it, the title follows the language', async () => {
    const form = mount('<input name="a">');
    const inst = init(form, { a: 'required' }, { errorSummary: true });
    await inst.validate();
    assert.equal(form.querySelector('.fv-summary'), null, 'only submit (or showSummary) opens it');
    const box = inst.showSummary(true);
    assert.equal(box.querySelectorAll('li').length, 1);
    locales.use('de');
    inst.showSummary();
    assert.equal(box.querySelector('h2').textContent, 'Bitte korrigieren Sie Folgendes:');
    locales.use('en');
});
test('errorSummary: a submit that is valid never shows it', async () => {
    const form = mount('<input name="a" value="x">');
    init(form, { a: 'required' }, { errorSummary: true, submitHandler: () => {} });
    form.querySelector('#go').click(); await settle(60);
    const box = form.querySelector('.fv-summary');
    assert.ok(!box || box.hidden);
});

// ---------------------------------------------------------------- autoAttributes + lint
const attrs = (el, ...names) => names.map(a => el.getAttribute(a));
test('autoAttributes: type, inputmode, autocomplete and aria-required from the rules', () => {
    const form = mount('<input name="email"><input name="site"><input name="mobile"><input name="qty"><input name="amount"><input name="pw" type="password"><input name="pw2" type="password"><input name="card">');
    init(form, {
        email: ['required', 'email'], site: ['url'], mobile: ['phone'], qty: ['digits'], amount: ['number'],
        pw: { required: true, pwcheck: { minLength: 8 } }, pw2: { equalTo: 'pw' }, card: ['creditcard']
    }, { autoAttributes: true });
    const f = form.elements;
    assert.deepEqual(attrs(f.email, 'type', 'inputmode', 'autocomplete', 'aria-required'), ['email', 'email', 'email', 'true']);
    assert.deepEqual(attrs(f.site, 'type', 'inputmode', 'autocomplete'), ['url', 'url', 'url']);
    assert.deepEqual(attrs(f.mobile, 'type', 'inputmode', 'autocomplete'), ['tel', 'tel', 'tel']);
    assert.deepEqual(attrs(f.qty, 'type', 'inputmode', 'autocomplete'), [null, 'numeric', null], 'digits: numeric keypad, never type=number');
    assert.deepEqual(attrs(f.amount, 'inputmode'), ['decimal']);
    assert.deepEqual(attrs(f.pw, 'autocomplete'), ['new-password']);
    assert.deepEqual(attrs(f.pw2, 'autocomplete'), ['new-password']);
    assert.deepEqual(attrs(f.card, 'inputmode', 'autocomplete'), ['numeric', 'cc-number']);
});
test('autoAttributes: names give autocomplete tokens; existing attributes are never overwritten', () => {
    const form = mount('<input name="first_name"><input name="lastName"><input name="zip"><input name="otp"><input name="city"><input name="username"><input name="email" autocomplete="work email"><input name="mobile" type="tel" inputmode="text"><select name="country"><option>x</option></select><textarea name="note"></textarea><input type="checkbox" name="terms">');
    init(form, { first_name: 'required', otp: ['digits'], username: 'required', note: 'required', terms: 'required' }, { autoAttributes: { lint: false } });
    const f = form.elements;
    assert.equal(f.first_name.getAttribute('autocomplete'), 'given-name');
    assert.equal(f.lastName.getAttribute('autocomplete'), 'family-name');
    assert.equal(f.zip.getAttribute('autocomplete'), 'postal-code');
    assert.deepEqual(attrs(f.otp, 'autocomplete', 'inputmode'), ['one-time-code', 'numeric']);
    assert.equal(f.city.getAttribute('autocomplete'), 'address-level2');
    assert.equal(f.username.getAttribute('autocomplete'), 'username');
    assert.equal(f.email.getAttribute('autocomplete'), 'work email', 'kept');
    assert.deepEqual(attrs(f.mobile, 'type', 'inputmode', 'autocomplete'), ['tel', 'text', 'tel'], 'inputmode was set by the author');
    assert.equal(f.country.getAttribute('autocomplete'), 'country-name');
    assert.equal(f.note.getAttribute('autocomplete'), null);
    assert.equal(f.note.getAttribute('aria-required'), 'true');
    assert.equal(f.terms.getAttribute('autocomplete'), null);
    assert.equal(f.terms.getAttribute('aria-required'), 'true');
});
test('autoAttributes: a lone password is a login (current-password); only text fields change type; options switch parts off; late fields on focus', () => {
    const form = mount('<input name="user"><input name="password" type="password"><input name="mail" type="search"><input name="late">');
    const inst = init(form, { user: 'required', password: 'required', mail: ['email'] }, { autoAttributes: { type: false, ariaRequired: false, lint: false } });
    assert.equal(form.elements.password.getAttribute('autocomplete'), 'current-password');
    assert.equal(form.elements.mail.getAttribute('type'), 'search');
    assert.equal(form.elements.user.getAttribute('aria-required'), null);
    assert.equal(form.elements.mail.getAttribute('inputmode'), 'email');
    inst.addRules('late', ['url']);
    form.elements.late.dispatchEvent(new w.Event('focusin', { bubbles: true }));
    assert.equal(form.elements.late.getAttribute('inputmode'), 'url');
    assert.ok(inst.attributeChanges.length > 4);
});
test('autoAttributes lint: autocomplete=off, missing password autocomplete, type=number for codes; one console warning; off with lint:false', () => {
    const form = mount('<input name="email" autocomplete="off"><input name="pw" type="password"><input name="otp" type="number"><input name="age" type="number"><input name="ok" type="password" autocomplete="current-password">');
    const warns = [];
    const orig = console.warn; console.warn = m => warns.push(m);
    let inst;
    try { inst = init(form, { otp: ['digits'] }, { autoAttributes: { type: false, inputmode: false, autocomplete: false, ariaRequired: false } }); }
    finally { console.warn = orig; }
    const codes = inst.lintIssues.map(i => i.name + ':' + i.code).sort();
    assert.deepEqual(codes, ['email:autocomplete-off', 'otp:type-number', 'pw:password-autocomplete']);
    assert.equal(warns.length, 1);
    assert.match(warns[0], /autocomplete-off/);
    const quiet = [];
    console.warn = m => quiet.push(m);
    try { init(mount('<input name="e" autocomplete="off">'), {}, { autoAttributes: { lint: false } }); } finally { console.warn = orig; }
    assert.equal(quiet.length, 0);
    assert.equal(inst.lint().length, 3, 'inst.lint() runs it again');
});
test('autoAttributes is off by default: no attribute is touched', () => {
    const form = mount('<input name="email"><input name="pw" type="password">');
    init(form, { email: ['required', 'email'] }, {});
    assert.equal(form.elements.email.getAttribute('type'), null);
    assert.equal(form.elements.email.getAttribute('aria-required'), null);
    assert.equal(form.elements.pw.getAttribute('autocomplete'), null);
});
