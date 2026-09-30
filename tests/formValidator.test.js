'use strict';
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// ---------------------------------------------------------------- environment
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
// jsdom has no layout: emulate "rendered" = not hidden by [hidden] / display:none up the tree
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', {
    value() { for (let n = this; n && n.nodeType === 1; n = n.parentElement) if (n.hidden || n.style.display === 'none') return []; return [1]; }
});
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const settle = (ms = 25) => new Promise(r => setTimeout(r, ms));
const errs = form => $$('.error', form).map(e => e.getAttribute('data-error-for') + ': ' + e.textContent);
const errFor = (form, name) => $$(`.error[data-error-for="${name}"]`, form).map(e => e.textContent);

let n = 0;
/** Build a form, stub submission so we can count "native" submits. */
function mount(html, attrs = '') {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}" ${attrs}>${html}<button type="submit" id="go">Go</button><button type="submit" id="draft" formnovalidate>Draft</button></form>`;
    const form = document.getElementById(id);
    form.native = 0;
    form.requestSubmit = function (sub) {
        const ev = new w.Event('submit', { bubbles: true, cancelable: true });
        if (sub) Object.defineProperty(ev, 'submitter', { value: sub });
        if (this.dispatchEvent(ev)) this.native++;
    };
    form.submit = () => { form.native++; };
    return form;
}
async function submit(form, submitter) {
    const ev = new w.Event('submit', { bubbles: true, cancelable: true });
    if (submitter) Object.defineProperty(ev, 'submitter', { value: submitter });
    form.dispatchEvent(ev);
    await settle(40);
    return ev;
}
const setFiles = (input, files) => Object.defineProperty(input, 'files', { value: files, configurable: true });
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
const type = async (el, value, evt = 'input') => { el.value = value; fire(el, evt); await settle(30); };

// Runs one rule against a list of values on a fresh text field.
async function check(rule, valid, invalid, config) {
    for (const [list, expected] of [[valid, true], [invalid, false]]) {
        for (const v of list) {
            const form = mount('<input name="x">');
            $('[name=x]').value = v;
            const r = await FormValidator.validate(form.id, { x: [Object.assign({ type: 'x' }, rule)] });
            assert.equal(r, expected, `${rule.type} ${JSON.stringify(v)} should be ${expected ? 'valid' : 'invalid'}`);
        }
    }
}
const rule = (type, extra) => Object.assign({ type }, extra);

// ================================================================ API
test('exposes version and API', () => {
    assert.match(FormValidator.version, /^\d+\.\d+\.\d+$/);
    for (const k of ['init', 'validate', 'registerRule', 'messages', 'defaults', 'getInstance']) assert.ok(FormValidator[k], k);
});

test('init errors: unknown form, and validate() before init', async () => {
    assert.throws(() => FormValidator.init({ formId: 'nope', rules: {} }), /not found/);
    const form = mount('<input name="a">');
    await assert.rejects(FormValidator.validate(form.id), /not initialized/);
    await assert.rejects(FormValidator.validate('nope', {}), /not found/);
});

test('form target may be id, element, selector, or an array', async () => {
    const form = mount('<input name="a">');
    const i1 = FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    assert.equal(FormValidator.getInstance(form), i1);
    const i2 = FormValidator.init({ form: form, rules: { a: ['required'] } });
    assert.notEqual(i2, i1);
    FormValidator.init({ form: '#' + form.id, rules: { a: ['required'] } });
    document.body.innerHTML = '<form id="p"><input name="a"></form><form id="q"><input name="a"></form>';
    const list = FormValidator.init({ formId: ['p', 'q'], rules: { a: ['required'] } });
    assert.equal(list.length, 2);
    assert.equal(await list[0].validate({ focus: false }), false);
});

// ================================================================ submit behaviour
test('invalid submit is blocked and hidden from other submit handlers', async () => {
    const form = mount('<input name="a">');
    let seen = 0; form.addEventListener('submit', () => seen++);
    FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    const ev = await submit(form);
    assert.equal(ev.defaultPrevented, true);
    assert.equal(form.native, 0);
    assert.equal(seen, 0, 'other handlers must not see an invalid submit');
    assert.deepEqual(errs(form), ['a: This field is required.']);
});

test('valid submit goes through exactly once and other handlers see it once', async () => {
    const form = mount('<input name="a" value="x">');
    let seen = 0; form.addEventListener('submit', () => seen++);
    FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    await submit(form);
    assert.equal(form.native, 1);
    assert.equal(seen, 1);
});

test('submitter is preserved on the re-submit', async () => {
    const form = mount('<input name="a" value="x">');
    let submitter = null; form.addEventListener('submit', e => { submitter = e.submitter; });
    FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    await submit(form, $('#go'));
    assert.equal(submitter, $('#go'));
});

test('formnovalidate button skips validation', async () => {
    const form = mount('<input name="a">');
    FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    await submit(form, $('#draft'));
    assert.equal(errs(form).length, 0);
});

test('submitHandler replaces the native submit', async () => {
    const form = mount('<input name="a" value="x">');
    let called = 0;
    FormValidator.init({ formId: form.id, rules: { a: ['required'] }, config: { submitHandler: f => { called++; assert.equal(f, form); } } });
    await submit(form);
    assert.equal(called, 1);
    assert.equal(form.native, 0);
});

test('double submit while validation is pending is ignored', async () => {
    const form = mount('<input name="a" value="x">');
    let calls = 0;
    FormValidator.init({ formId: form.id, rules: { a: [{ type: 'custom', validate: async () => { calls++; await settle(60); return true; } }] } });
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await settle(150);
    assert.equal(calls, 1);
    assert.equal(form.native, 1);
});

test('novalidate is set and restored', () => {
    const form = mount('<input name="a">');
    const inst = FormValidator.init({ formId: form.id, rules: {} });
    assert.equal(form.noValidate, true);
    inst.destroy();
    assert.equal(form.noValidate, false);
});

test('destroy removes listeners, errors, and legacy hooks; re-init does not double up', async () => {
    const form = mount('<input name="a">');
    let calls = 0;
    const r = { a: [{ type: 'custom', validate: () => { calls++; return false; } }] };
    FormValidator.init({ formId: form.id, rules: r });
    FormValidator.init({ formId: form.id, rules: r });   // replaces the first
    await submit(form);
    assert.equal(calls, 1);
    const inst = FormValidator.getInstance(form);
    inst.destroy();
    assert.equal(errs(form).length, 0);
    assert.equal(form._fvInstance, undefined);
    await submit(form);
    assert.equal(calls, 1, 'no validation after destroy');
    assert.equal(form.native, 0, 'form is not blocked by us after destroy (jsdom default action aside)');
});

test('legacy: form._manualValidate exists', async () => {
    const form = mount('<input name="a">');
    FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    assert.equal(typeof form._manualValidate, 'function');
    assert.equal(await form._manualValidate(), false);
});

// ================================================================ required on all control kinds
test('required: text, whitespace-only, textarea, select, checkbox, radio, multi-select, file', async () => {
    const form = mount(`
        <input name="t"><input name="ws" value="   "><textarea name="ta"></textarea>
        <select name="s"><option value="">-</option><option value="1">1</option></select>
        <select name="ms" multiple><option value="">-</option><option value="1">1</option></select>
        <input type="checkbox" name="cb" value="y">
        <input type="radio" name="r" value="a"><input type="radio" name="r" value="b">
        <input type="file" name="fl">`);
    const rules = {}; ['t', 'ws', 'ta', 's', 'ms', 'cb', 'r', 'fl'].forEach(k => rules[k] = ['required']);
    const inst = FormValidator.init({ formId: form.id, rules });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.equal(errs(form).length, 8);

    $('[name=t]').value = 'x'; $('[name=ws]').value = 'x'; $('[name=ta]').value = 'x';
    $('[name=s]').value = '1'; $('[name=ms]').options[1].selected = true;
    $('[name=cb]').checked = true; $$('[name=r]')[1].checked = true;
    setFiles($('[name=fl]'), [new File(['x'], 'a.txt')]);
    assert.equal(await inst.validate({ focus: false }), true);
    assert.equal(errs(form).length, 0);
});

test('checkbox/radio groups produce one error, placed after the group', async () => {
    const form = mount('<div class="answer"><label><input type="radio" name="r" value="a">A</label><label><input type="radio" name="r" value="b">B</label></div><p id="after"></p>');
    const inst = FormValidator.init({ formId: form.id, rules: { r: ['required'] } });
    await inst.validate({ focus: false });
    await inst.validate({ focus: false });
    assert.equal(errFor(form, 'r').length, 1);
    assert.equal($('.answer').nextElementSibling.classList.contains('error'), true);
});

// ================================================================ optional fields (regression: blank optional fields)
test('non-required rules accept blank values', async () => {
    const types = { email: {}, url: {}, number: {}, digits: {}, alpha: {}, alphanumeric: {}, phone: {}, date: {}, creditcard: {},
        minlength: { min: 3 }, rangelength: { min: 3, max: 5 }, range: { min: 1, max: 5 }, min: { min: 1 }, max: { max: 5 }, step: { step: 2 },
        pattern: { pattern: '^a+$' }, oneOf: { values: ['a'] }, minDate: { min: '2020-01-01' }, maxDate: { max: '2020-01-01' }, pwcheck: { minLength: 8 },
        notEqualTo: { target: 'other' } };
    for (const [t, extra] of Object.entries(types)) {
        const form = mount('<input name="x"><input name="other" value="q">');
        assert.equal(await FormValidator.validate(form.id, { x: [rule(t, extra)] }), true, t + ' must skip empty values');
    }
});

// ================================================================ every built-in rule
test('rule: required', async () => check(rule('required'), ['a', '0'], ['', '   ']));
test('rule: email', async () => check(rule('email'), ['a@b.co', 'first.last+tag@sub.example.org', 'ünï@exämple.de'],
    ['a', 'a@b', 'a@@b.co', '@b.co', 'a@b.', 'a b@c.de', 'a@b.c']));
test('rule: url', async () => check(rule('url'), ['https://example.com', 'http://a.b/c?d=1#e', 'example.com', 'www.example.com/path', 'https://sub.example.co.uk:8080/x'],
    ['not a url', 'http://', 'ftp://example.com', 'http://exa mple.com', 'javascript:alert(1)', 'example', 'http://.com']));
test('rule: url options', async () => {
    await check(rule('url', { requireProtocol: true }), ['https://a.com'], ['a.com']);
    await check(rule('url', { allowLocal: true }), ['http://intranet', 'http://localhost:3000'], ['not a url']);
    await check(rule('url', { protocols: ['ftp:'] }), ['ftp://a.com'], ['http://a.com']);
});
test('rule: number', async () => check(rule('number'), ['1', '-1', '1.5', '.5', '+3', '1e3', '-2.5E-2', '5.'], ['abc', '1,5', '1.2.3', '--1', '1e', '0x10']));
test('rule: digits', async () => check(rule('digits'), ['0', '123'], ['-1', '1.5', 'a', '1 2']));
test('rule: alpha / alphanumeric (unicode)', async () => {
    await check(rule('alpha'), ['abc', 'Ünïcode', '日本語'], ['abc1', 'a b', 'a-b']);
    await check(rule('alphanumeric'), ['abc1', 'Ünï9', '日本語1'], ['a b', 'a_b', 'a!']);
});
test('rule: phone', async () => check(rule('phone'), ['+1 (555) 123-4567', '5551234567', '+44 20 7946 0958', '555-1234'], ['abc', '123', '12345678901234567890', '++1234567']));
test('rule: date / minDate / maxDate', async () => {
    await check(rule('date'), ['2024-02-29', '2024-01-01'], ['nope', '2024-13-45']);
    await check(rule('minDate', { min: '2024-06-01' }), ['2024-06-01', '2025-01-01'], ['2024-05-31', 'nope']);
    await check(rule('maxDate', { max: '2024-06-01' }), ['2024-06-01', '2020-01-01'], ['2024-06-02', 'nope']);
    const future = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), past = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
    await check(rule('minDate', { min: 'today' }), [future], [past]);
    await check(rule('maxDate', { max: 'today' }), [past], [future]);
});
test('rule: creditcard (Luhn)', async () => check(rule('creditcard'), ['4111111111111111', '4111 1111 1111 1111', '5500-0000-0000-0004'], ['4111111111111112', '1234', 'abcd efgh ijkl mnop']));
test('rule: pattern (string, RegExp, flags)', async () => {
    await check(rule('pattern', { pattern: '^[A-Z]{2}\\d{3}$' }), ['AB123'], ['ab123', 'AB12']);
    await check(rule('pattern', { pattern: /^abc$/ }), ['abc'], ['ABC']);
    await check(rule('pattern', { pattern: /^abc$/g }), ['abc', 'abc', 'abc'], ['x'], undefined);   // global flag must not carry lastIndex state
    await check(rule('pattern', { pattern: '^abc$', flags: 'i' }), ['ABC', 'abc'], ['abcd']);
});
test('rule: lengths', async () => {
    await check(rule('minlength', { min: 3 }), ['abc', 'abcd'], ['ab']);
    await check(rule('maxlength', { max: 3 }), ['abc', 'a'], ['abcd']);
    await check(rule('rangelength', { min: 2, max: 4 }), ['ab', 'abcd'], ['a', 'abcde']);
    await check(rule('minlength', { min: '3' }), ['abc'], ['ab']);
});
test('rule: numeric ranges', async () => {
    await check(rule('min', { min: 5 }), ['5', '5.1', '100'], ['4.99', '-1', 'abc']);
    await check(rule('max', { max: 5 }), ['5', '-100', '4.9'], ['5.01', 'abc']);
    await check(rule('range', { min: 1, max: 10 }), ['1', '10', '5.5'], ['0.99', '10.01', 'x']);
    await check(rule('step', { step: 5 }), ['0', '10', '-15'], ['3', '10.5', 'x']);
    await check(rule('step', { step: 0.1 }), ['0.3', '0.7'], ['0.35']);
    await check(rule('step', { step: 5, base: 2 }), ['2', '7', '12'], ['5']);
});
test('rule: oneOf', async () => check(rule('oneOf', { values: ['a', 1, 'c'] }), ['a', '1', 'c'], ['b', 'A']));

test('rule: equalTo / notEqualTo (whitespace kept for passwords)', async () => {
    let form = mount('<input name="a" value="secret"><input name="b" value="secret">');
    assert.equal(await FormValidator.validate(form.id, { b: [rule('equalTo', { target: 'a' })] }), true);
    $('[name=b]').value = 'other';
    assert.equal(await FormValidator.validate(form.id, { b: [rule('equalTo', { target: 'a' })] }), false);
    form = mount('<input type="password" name="a" value=" pw "><input type="password" name="b" value=" pw ">');
    assert.equal(await FormValidator.validate(form.id, { b: [rule('equalTo', { target: 'a' })] }), true);
    $('[name=b]').value = 'pw';
    assert.equal(await FormValidator.validate(form.id, { b: [rule('equalTo', { target: 'a' })] }), false);
    form = mount('<input name="a" value="x"><input name="b" value="">');
    assert.equal(await FormValidator.validate(form.id, { b: [rule('equalTo', { target: 'a' })] }), false, 'empty confirm vs filled original');
    form = mount('<input name="a" value=""><input name="b" value="">');
    assert.equal(await FormValidator.validate(form.id, { b: [rule('equalTo', { target: 'a' })] }), true);
    form = mount('<input name="a" value="x"><input name="b" value="y">');
    assert.equal(await FormValidator.validate(form.id, { b: [rule('notEqualTo', { target: 'a' })] }), true);
    $('[name=b]').value = 'x';
    assert.equal(await FormValidator.validate(form.id, { b: [rule('notEqualTo', { target: 'a' })] }), false);
    assert.equal(await FormValidator.validate(form.id, { b: [rule('equalTo', { target: 'missing' })] }), false, 'missing target');
});

test('rule: pwcheck options', async () => {
    await check(rule('pwcheck'), ['abcdef'], ['abcde']);                                             // default minLength 6
    await check(rule('pwcheck', { minLength: 8, requireUppercase: true, requireLowercase: true, requireDigit: true, requireSpecialChar: true }),
        ['Abcdef1!'], ['abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdef12', 'Ab1!']);
    await check(rule('pwcheck', { noWhitespace: true }), ['abcdef'], ['abc def']);
    await check(rule('pwcheck', { maxLength: 8 }), ['abcdefgh'], ['abcdefghi']);
    await check(rule('pwcheck', { enabled: false }), ['a'], []);
    await check(rule('pwcheck', { requireSpecialChar: true }), ['abcde_1', 'abcde$'], ['abcdef', 'abcde 1']);
});
test('pwcheck reads config.passwordStrength defaults', async () => {
    const form = mount('<input type="password" name="p" value="abc1">');
    const inst = FormValidator.init({ formId: form.id, rules: { p: ['pwcheck'] }, config: { passwordStrength: { minLength: 4, requireDigit: true } } });
    assert.equal(await inst.validate({ focus: false }), true);
    $('[name=p]').value = 'abcd';
    assert.equal(await inst.validate({ focus: false }), false);
});
test('passwords are never trimmed', async () => {
    const form = mount('<input type="password" name="p" value="  a  ">');
    assert.equal(await FormValidator.validate(form.id, { p: [rule('minlength', { min: 5 })] }), true);
    const f2 = mount('<input name="p" value="  a  ">');
    assert.equal(await FormValidator.validate(f2.id, { p: [rule('minlength', { min: 5 })] }), false, 'normal text is trimmed');
});
test('config.trim = false keeps whitespace', async () => {
    const form = mount('<input name="p" value="  a  ">');
    const inst = FormValidator.init({ formId: form.id, rules: { p: [rule('minlength', { min: 5 })] }, config: { trim: false } });
    assert.equal(await inst.validate({ focus: false }), true);
});

test('rules: min/maxChecked on checkbox groups and multi-selects', async () => {
    const form = mount('<input type="checkbox" name="c" value="1"><input type="checkbox" name="c" value="2"><input type="checkbox" name="c" value="3">');
    const boxes = $$('[name=c]');
    const run = () => FormValidator.validate(form.id, { c: [rule('minChecked', { min: 2 }), rule('maxChecked', { max: 2 })] });
    assert.equal(await run(), false);
    boxes[0].checked = true; assert.equal(await run(), false);
    boxes[1].checked = true; assert.equal(await run(), true);
    boxes[2].checked = true; assert.equal(await run(), false);
    const f2 = mount('<select name="m" multiple><option value="1">1</option><option value="2">2</option></select>');
    const sel = $('[name=m]');
    assert.equal(await FormValidator.validate(f2.id, { m: [rule('minChecked', { min: 1 })] }), false);
    sel.options[0].selected = true;
    assert.equal(await FormValidator.validate(f2.id, { m: [rule('minChecked', { min: 1 })] }), true);
});

// ================================================================ file rules
const F = (name, size = 10, type = '') => new File([new Uint8Array(size)], name, { type });
test('rules: minFiles / maxFiles / fileType / fileSize', async () => {
    const form = mount('<input type="file" name="f" multiple>');
    const input = $('[name=f]');
    const v = rules => FormValidator.validate(form.id, { f: rules });
    setFiles(input, []);
    assert.equal(await v([rule('minFiles', { min: 1 })]), false);
    assert.equal(await v([rule('maxFiles', { max: 1 })]), true, 'no files satisfies max');
    setFiles(input, [F('a.png', 10, 'image/png'), F('b.JPG', 10, 'image/jpeg')]);
    assert.equal(await v([rule('minFiles', { min: 2 })]), true);
    assert.equal(await v([rule('maxFiles', { max: 1 })]), false);
    assert.equal(await v([rule('fileType', { types: ['png', '.jpg'] })]), true);
    assert.equal(await v([rule('fileType', { types: ['png'] })]), false);
    assert.equal(await v([rule('fileType', { types: ['image/*'] })]), true);
    assert.equal(await v([rule('fileType', { types: ['application/pdf'] })]), false);
    assert.equal(await v([rule('fileSize', { maxSize: 10 })]), true);
    assert.equal(await v([rule('fileSize', { maxSize: 9 })]), false);
    assert.equal(await v([rule('fileSize', { maxSizeMB: 1 })]), true);
});

test('rule: file delegates to FileValidator and shows its message', async () => {
    const form = mount('<input type="file" name="f">');
    const input = $('[name=f]');
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'a.png', { type: 'image/png' });
    const inst = FormValidator.init({ formId: form.id, rules: { f: [{ type: 'file', allowedExtensions: ['.png'], maxFileSizeMB: 1 }] } });
    setFiles(input, [png]);
    assert.equal(await inst.validate({ focus: false }), true);
    setFiles(input, [F('a.exe', 10)]);
    assert.equal(await inst.validate({ focus: false }), false);
    assert.match(errs(form)[0], /f: .*(security|allowed)/i);
    const f2 = mount('<input type="file" name="f">');
    setFiles($('[name=f]'), [F('a.exe', 10)]);
    FormValidator.init({ formId: f2.id, rules: { f: [{ type: 'file', message: 'Nope' }] } });
    await FormValidator.getInstance(f2).validate({ focus: false });
    assert.deepEqual(errs(f2), ['f: Nope'], 'rule.message wins');
});

// ================================================================ messages
test('messages: rule.message (string / function), config.messages, global messages, placeholders', async () => {
    const form = mount('<input name="a"><input name="b" value="x"><input name="c" value="x"><input name="d" value="x">');
    const inst = FormValidator.init({
        formId: form.id,
        rules: {
            a: [{ type: 'required', message: 'Custom A' }],
            b: [{ type: 'minlength', min: 5 }],
            c: [{ type: 'minlength', min: 5, message: (field, r) => `${field.name} needs ${r.min}` }],
            d: [{ type: 'minlength', min: 5 }]
        },
        config: { messages: { minlength: 'Per-instance {min}' } }
    });
    await inst.validate({ focus: false });
    assert.equal(errFor(form, 'a')[0], 'Custom A');
    assert.equal(errFor(form, 'b')[0], 'Per-instance 5');
    assert.equal(errFor(form, 'c')[0], 'c needs 5');
    inst.destroy();
    const saved = FormValidator.messages.required;
    FormValidator.messages.required = 'Pflichtfeld';
    const f2 = mount('<input name="a">');
    const i2 = FormValidator.init({ formId: f2.id, rules: { a: ['required'] } });
    await i2.validate({ focus: false });
    assert.equal(errFor(f2, 'a')[0], 'Pflichtfeld');
    FormValidator.messages.required = saved;
});

test('every default message resolves its placeholders', async () => {
    const cases = { minlength: { min: 3 }, maxlength: { max: 1 }, rangelength: { min: 3, max: 4 }, range: { min: 1, max: 2 }, min: { min: 9 }, max: { max: 0 },
        step: { step: 5 }, minDate: { min: '2030-01-01' }, maxDate: { max: '2000-01-01' } };
    for (const [t, extra] of Object.entries(cases)) {
        const form = mount('<input name="x" value="5000-x">');
        $('[name=x]').value = t.includes('Date') ? '2015-05-05' : (t === 'min' || t === 'max' || t === 'range' || t === 'step' ? '7.5' : 'zz');
        if (t === 'minlength') $('[name=x]').value = 'z';
        if (t === 'maxlength') $('[name=x]').value = 'zzz';
        if (t === 'rangelength') $('[name=x]').value = 'z';
        const inst = FormValidator.init({ formId: form.id, rules: { x: [rule(t, extra)] } });
        await inst.validate({ focus: false });
        const msg = errFor(form, 'x')[0];
        assert.ok(msg, t + ' produced no error');
        assert.ok(!/\{\w+\}/.test(msg), `${t}: ${msg}`);
    }
});

// ================================================================ rule definitions
test('rule shorthands: string, map, single object', async () => {
    const form = mount('<input name="a"><input name="b" value="x"><input name="c">');
    const inst = FormValidator.init({ formId: form.id, rules: {
        a: 'required',
        b: { required: true, minlength: { min: 3, message: 'short' }, email: 'Not an email' },
        c: { type: 'required', message: 'C!' }
    } });
    await inst.validate({ focus: false });
    assert.equal(errFor(form, 'a')[0], 'This field is required.');
    assert.equal(errFor(form, 'b')[0], 'short');
    assert.equal(errFor(form, 'c')[0], 'C!');
});

test('rules run in order and stop at the first failure', async () => {
    const form = mount('<input name="a" value="x">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: [{ type: 'minlength', min: 5, message: 'first' }, { type: 'email', message: 'second' }] } });
    await inst.validate({ focus: false });
    assert.deepEqual(errFor(form, 'a'), ['first']);
});

test('when: conditional rules', async () => {
    const form = mount('<input name="a"><input name="b" value="">');
    const rules = { b: [{ type: 'required', when: () => $('[name=a]').value === 'yes' }] };
    assert.equal(await FormValidator.validate(form.id, rules), true);
    $('[name=a]').value = 'yes';
    assert.equal(await FormValidator.validate(form.id, rules), false);
});

test('custom rule: sync/async, boolean/string/object results, context, throwing, missing fn', async () => {
    const form = mount('<input name="a" value="hi">');
    const run = validate => FormValidator.validate(form.id, { a: [{ type: 'custom', validate }] });
    assert.equal(await run(() => true), true);
    assert.equal(await run(() => false), false);
    assert.equal(await run(async () => { await settle(5); return true; }), true);
    assert.equal(await run(() => { throw new Error('boom'); }), false, 'exceptions count as invalid');
    let args;
    await run((v, ctx, field) => { args = { v, ctx, field }; return true; });
    assert.equal(args.v, 'hi'); assert.equal(args.ctx.form, form); assert.equal(args.field.name, 'a');

    const inst = FormValidator.init({ formId: form.id, rules: { a: [{ type: 'custom', validate: () => 'Server says no' }] } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.equal(errFor(form, 'a')[0], 'Server says no');
    inst.setRules('a', [{ type: 'custom', validate: () => ({ valid: false, message: 'Object msg' }) }]);
    await inst.validate({ focus: false });
    assert.equal(errFor(form, 'a')[0], 'Object msg');
    inst.setRules('a', [{ type: 'custom' }]);
    const warn = console.warn; console.warn = () => {};
    try { assert.equal(await inst.validate({ focus: false }), true); } finally { console.warn = warn; }
});

test('custom rule receives user context', async () => {
    const form = mount('<input name="a" value="x">');
    let ctx;
    const inst = FormValidator.init({ formId: form.id, rules: { a: [{ type: 'custom', validate: (v, c) => { ctx = c; return true; } }] }, context: { userId: 7 } });
    await inst.validate({ focus: false });
    assert.equal(ctx.userId, 7);
});

test('registerRule adds new rules (optionally running on empty values)', async () => {
    FormValidator.registerRule('even', v => Number(v) % 2 === 0);
    FormValidator.registerRule('nonBlankMarker', (v, r, env) => env.empty ? { valid: false, message: 'was empty' } : true, { runOnEmpty: true });
    let form = mount('<input name="a" value="4">');
    assert.equal(await FormValidator.validate(form.id, { a: [rule('even')] }), true);
    $('[name=a]').value = '5';
    assert.equal(await FormValidator.validate(form.id, { a: [rule('even')] }), false);
    $('[name=a]').value = '';
    assert.equal(await FormValidator.validate(form.id, { a: [rule('even')] }), true, 'skipped for empty');
    assert.equal(await FormValidator.validate(form.id, { a: [rule('nonBlankMarker')] }), false);
    assert.throws(() => FormValidator.registerRule('bad', 'nope'), /function/);
});

test('unknown rule type warns and is ignored', async () => {
    const form = mount('<input name="a" value="x">');
    const warn = console.warn; const seen = []; console.warn = m => seen.push(m);
    try { assert.equal(await FormValidator.validate(form.id, { a: [rule('doesNotExist')] }), true); } finally { console.warn = warn; }
    assert.ok(seen.some(m => /doesNotExist/.test(m)));
});

// ================================================================ remote
function mockFetch(handler) {
    const calls = [];
    globalThis.fetch = async (url, opts) => { calls.push({ url, opts }); return handler(url, opts, calls.length); };
    return calls;
}
const json = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

test('remote: true / "true" / false / object / string responses', async () => {
    const bodies = [[true, true], ['true', true], [false, false], ['false', false], [{ valid: true }, true], [{ valid: false, message: 'Taken' }, false], ['Already used', false]];
    for (const [body, expected] of bodies) {
        mockFetch(() => json(body));
        const form = mount('<input name="u" value="bob">');
        const inst = FormValidator.init({ formId: form.id, rules: { u: [{ type: 'remote', url: '/check', cache: false }] } });
        assert.equal(await inst.validate({ focus: false }), expected, JSON.stringify(body));
        if (typeof body === 'object' && body.message) assert.equal(errFor(form, 'u')[0], body.message);
        if (body === 'Already used') assert.equal(errFor(form, 'u')[0], 'Already used');
    }
});

test('remote: request shape (POST json when asked, custom field / extra data / headers, GET query)', async () => {
    let calls = mockFetch(() => json(true));
    let form = mount('<input name="u" value="bob">');
    await FormValidator.init({ formId: form.id, rules: { u: [{ type: 'remote', url: '/c', method: 'POST', field: 'username', data: { csrf: 't' }, headers: { 'X-A': '1' } }] } }).validate({ focus: false });
    assert.equal(calls[0].opts.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].opts.body), { username: 'bob', csrf: 't' });
    assert.equal(calls[0].opts.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].opts.headers['X-A'], '1');

    calls = mockFetch(() => json(true));
    form = mount('<input name="u" value="bob">');
    await FormValidator.init({ formId: form.id, rules: { u: [{ type: 'remote', url: '/c?x=1', method: 'get' }] } }).validate({ focus: false });
    assert.equal(calls[0].opts.method, 'GET');
    assert.equal(calls[0].url, '/c?x=1&u=bob');
    assert.equal(calls[0].opts.body, undefined);
});

test('remote: GET is the default (like jQuery), POST is one option away, per rule or globally, JSON or form encoded', async () => {
    let calls = mockFetch(() => json(true));
    let form = mount('<input name="u" value="bob">');
    await FormValidator.init({ formId: form.id, rules: { u: [{ type: 'remote', url: '/c' }] } }).validate({ focus: false });
    assert.equal(calls[0].opts.method, 'GET');
    assert.equal(calls[0].url, '/c?u=bob');
    assert.equal(calls[0].opts.body, undefined);
    assert.equal(calls[0].opts.headers['Content-Type'], undefined);

    // per rule: POST + form encoding
    calls = mockFetch(() => json(true));
    form = mount('<input name="u" value="bob">');
    await FormValidator.init({ formId: form.id, rules: { u: [{ type: 'remote', url: '/c', method: 'post', encoding: 'form', data: { a: 1 } }] } }).validate({ focus: false });
    assert.equal(calls[0].opts.method, 'POST');
    assert.match(calls[0].opts.headers['Content-Type'], /x-www-form-urlencoded/);
    assert.equal(calls[0].opts.body, 'u=bob&a=1');

    // globally
    const saved = Object.assign({}, FormValidator.remoteDefaults);
    FormValidator.remoteDefaults.method = 'POST';
    try {
        calls = mockFetch(() => json(true));
        form = mount('<input name="u" value="bob">');
        await FormValidator.init({ formId: form.id, rules: { u: { remote: '/c' } } }).validate({ focus: false });
        assert.equal(calls[0].opts.method, 'POST');
        assert.deepEqual(JSON.parse(calls[0].opts.body), { u: 'bob' });
        calls = mockFetch(() => json(true));
        form = mount('<input name="u" value="bob">');
        await FormValidator.init({ formId: form.id, rules: { u: { remote: { url: '/c', type: 'get' } } } }).validate({ focus: false });
        assert.equal(calls[0].opts.method, 'GET', 'a rule can still choose GET');
    } finally { Object.assign(FormValidator.remoteDefaults, saved); }
    assert.equal(FormValidator.remoteDefaults.method, 'GET');
});

test('remote: caches by value, refetches on change, skips empty values, `parse` hook', async () => {
    const calls = mockFetch(() => json({ ok: true }));
    const form = mount('<input name="u" value="bob">');
    const inst = FormValidator.init({ formId: form.id, rules: { u: [{ type: 'remote', url: '/c', parse: r => r.ok }] } });
    assert.equal(await inst.validate({ focus: false }), true);
    assert.equal(await inst.validate({ focus: false }), true);
    assert.equal(calls.length, 1, 'cached');
    $('[name=u]').value = 'alice';
    await inst.validate({ focus: false });
    assert.equal(calls.length, 2);
    $('[name=u]').value = '';
    await inst.validate({ focus: false });
    assert.equal(calls.length, 2, 'empty value never hits the server');
});

test('remote: network / HTTP errors fail closed unless failOpen', async () => {
    for (const [handler, failOpen, expected] of [
        [() => { throw new Error('offline'); }, false, false],
        [() => { throw new Error('offline'); }, true, true],
        [() => json({}, false), false, false],
        [() => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }), false, false]
    ]) {
        mockFetch(handler);
        const form = mount('<input name="u" value="bob">');
        const inst = FormValidator.init({ formId: form.id, rules: { u: [{ type: 'remote', url: '/c', failOpen }] } });
        assert.equal(await inst.validate({ focus: false }), expected);
    }
});

test('remote: not called while typing (input events), only on change/submit', async () => {
    const calls = mockFetch(() => json(true));
    const form = mount('<input name="u" value="">');
    FormValidator.init({ formId: form.id, rules: { u: ['required', { type: 'remote', url: '/c' }] }, config: { debounce: 0 } });
    await submit(form);                                   // required error shown
    calls.length = 0;
    await type($('[name=u]'), 'bo', 'input');
    assert.equal(calls.length, 0, 'no request on input');
    await type($('[name=u]'), 'bob', 'change');
    assert.equal(calls.length, 1);
});

// ================================================================ error display
test('error placement: default, input-group, form-floating, select2 sibling, custom', async () => {
    const form = mount(`<input name="a">
        <div class="input-group" id="ig"><span>@</span><input name="b"></div>
        <div class="form-floating" id="ff"><input name="c"><label>C</label></div>
        <select name="d"><option value="">-</option></select><span class="select2"></span>`);
    const inst = FormValidator.init({ formId: form.id, rules: { a: ['required'], b: ['required'], c: ['required'], d: ['required'] } });
    await inst.validate({ focus: false });
    assert.ok($('[name=a]').nextElementSibling.classList.contains('error'));
    assert.ok($('#ig').nextElementSibling.classList.contains('error'));
    assert.ok($('#ff').nextElementSibling.classList.contains('error'));
    assert.ok($('.select2').nextElementSibling.classList.contains('error'));
    inst.destroy();

    const f2 = mount('<input name="a"><div id="slot"></div>');
    const i2 = FormValidator.init({ formId: f2.id, rules: { a: ['required'] }, config: { errorPlacement: (el) => $('#slot').appendChild(el) } });
    await i2.validate({ focus: false });
    assert.equal($('#slot').children.length, 1);
});

test('accessibility + classes: aria-invalid, aria-describedby, role=alert, invalid class; all cleaned on fix', async () => {
    const form = mount('<input name="a" aria-describedby="hint"><small id="hint">Hint</small>');
    const inst = FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    const input = $('[name=a]');
    await inst.validate({ focus: false });
    const err = $('.error', form);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.ok(input.getAttribute('aria-describedby').split(' ').includes(err.id));
    assert.ok(input.getAttribute('aria-describedby').split(' ').includes('hint'), 'existing describedby is kept');
    assert.equal(err.getAttribute('role'), 'alert');
    assert.ok(input.classList.contains('is-invalid'));
    input.value = 'ok';
    await inst.validate({ focus: false });
    assert.equal(input.hasAttribute('aria-invalid'), false);
    assert.equal(input.getAttribute('aria-describedby'), 'hint');
    assert.equal(input.classList.contains('is-invalid'), false);
    assert.equal($$('.error', form).length, 0);
});

test('config: errorClass, invalidClass (empty disables), errorElement', async () => {
    const form = mount('<input name="a">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: ['required'] }, config: { errorClass: 'msg bad error', invalidClass: '', errorElement: 'span' } });
    await inst.validate({ focus: false });
    const e = $('.error', form);
    assert.equal(e.tagName, 'SPAN'); assert.ok(e.classList.contains('bad'));
    assert.equal($('[name=a]').className, '');
});

test('error text is escaped (textContent, no HTML injection)', async () => {
    const form = mount('<input name="a">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: [{ type: 'required', message: '<img src=x onerror=alert(1)>' }] } });
    await inst.validate({ focus: false });
    assert.equal($('img', form), null);
    assert.equal($('.error', form).textContent, '<img src=x onerror=alert(1)>');
});

test('re-validating never duplicates error nodes', async () => {
    const form = mount('<input name="a">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    for (let i = 0; i < 5; i++) await inst.validate({ focus: false });
    assert.equal(errFor(form, 'a').length, 1);
});

test('same-named text inputs are validated individually', async () => {
    const form = mount('<input name="items[]" value="a"><input name="items[]" value=""><input name="items[]" value="">');
    const inst = FormValidator.init({ formId: form.id, rules: { 'items[]': ['required'] } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.equal(errFor(form, 'items[]').length, 2);
});

test('names with special characters work', async () => {
    const form = mount('<input name="user[0].email" value="bad"><input name=\'quo"te\' value="">');
    const inst = FormValidator.init({ formId: form.id, rules: { 'user[0].email': ['email'], 'quo"te': ['required'] } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.equal(errs(form).length, 2);
});

// ================================================================ visibility
test('skips disabled, hidden, type=hidden, ignored; validateHidden overrides', async () => {
    const html = '<input name="dis" disabled><div hidden><input name="hid"></div><input type="hidden" name="th"><input name="ign" class="skip"><input name="vis">';
    const rules = { dis: ['required'], hid: ['required'], th: ['required'], ign: ['required'], vis: ['required'] };
    let form = mount(html);
    let inst = FormValidator.init({ formId: form.id, rules, config: { ignore: '.skip' } });
    await inst.validate({ focus: false });
    assert.deepEqual(errs(form).map(e => e.split(':')[0]), ['vis']);
    inst.destroy();
    form = mount(html);
    inst = FormValidator.init({ formId: form.id, rules, config: { validateHidden: true } });
    await inst.validate({ focus: false });
    assert.deepEqual(errs(form).map(e => e.split(':')[0]).sort(), ['hid', 'ign', 'th', 'vis']);
});

test('a field that becomes hidden loses its stale error', async () => {
    const form = mount('<div id="box"><input name="a"></div>');
    const inst = FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    await inst.validate({ focus: false });
    assert.equal(errs(form).length, 1);
    $('#box').style.display = 'none';
    assert.equal(await inst.validate({ focus: false }), true);
    assert.equal(errs(form).length, 0);
});

// ================================================================ live behaviour
test('typing into an invalid field revalidates (debounced) and clears the error', async () => {
    const form = mount('<input name="a">');
    FormValidator.init({ formId: form.id, rules: { a: ['required', 'email'] }, config: { debounce: 5 } });
    await submit(form);
    assert.equal(errFor(form, 'a')[0], 'This field is required.');
    await type($('[name=a]'), 'abc', 'input');
    assert.equal(errFor(form, 'a')[0], 'Please enter a valid email address.');
    await type($('[name=a]'), 'a@b.co', 'input');
    assert.equal(errFor(form, 'a').length, 0);
});

test('a pristine field is not flagged while typing; validateOn controls change/blur', async () => {
    const form = mount('<input name="a">');
    FormValidator.init({ formId: form.id, rules: { a: ['email'] }, config: { debounce: 0 } });
    await type($('[name=a]'), 'abc', 'input');
    assert.equal(errs(form).length, 0);
    await type($('[name=a]'), 'abc', 'change');           // default validateOn: ['change']
    assert.equal(errs(form).length, 1);

    const f2 = mount('<input name="a">');
    FormValidator.init({ formId: f2.id, rules: { a: ['email'] }, config: { validateOn: ['blur'] } });
    await type($('[name=a]', f2), 'abc', 'change');
    assert.equal(errs(f2).length, 0);
    $('[name=a]', f2).value = 'abc';
    fire($('[name=a]', f2), 'focusout');
    await settle();
    assert.equal(errs(f2).length, 1);
});

test('changing the original re-checks the confirm field', async () => {
    const form = mount('<input type="password" name="p" value="one"><input type="password" name="c" value="one">');
    FormValidator.init({ formId: form.id, rules: { c: [{ type: 'equalTo', target: 'p' }] }, config: { debounce: 0 } });
    await type($('[name=p]'), 'two', 'change');
    assert.equal(errFor(form, 'c').length, 1, 'confirm now mismatches');
    await type($('[name=p]'), 'one', 'change');
    assert.equal(errFor(form, 'c').length, 0, 'and recovers');
});

test('radio / checkbox errors clear when the user picks something', async () => {
    const form = mount('<input type="radio" name="r" value="a" id="ra"><input type="radio" name="r" value="b" id="rb">');
    FormValidator.init({ formId: form.id, rules: { r: ['required'] } });
    await submit(form);
    assert.equal(errFor(form, 'r').length, 1);
    $('#rb').checked = true; fire($('#rb'), 'change'); await settle();
    assert.equal(errFor(form, 'r').length, 0);
});

test('fields added after init are validated and get live behaviour', async () => {
    const form = mount('<input name="a" value="x"><div id="slot"></div>');
    FormValidator.init({ formId: form.id, rules: { a: ['required'], late: ['required'] }, config: { debounce: 0 } });
    assert.equal(await FormValidator.getInstance(form).validate({ focus: false }), true);
    const late = document.createElement('input'); late.name = 'late'; $('#slot').appendChild(late);
    await submit(form);
    assert.equal(form.native, 1 - 1 + 0, 'blocked because the new required field is empty');
    assert.equal(errFor(form, 'late').length, 1);
    await type(late, 'now', 'input');
    assert.equal(errFor(form, 'late').length, 0, 'live clearing works on a late field');
    late.remove();
    assert.equal(await FormValidator.getInstance(form).validate({ focus: false }), true, 'removed fields are ignored');
});

test('addRules / setRules / removeRules', async () => {
    const form = mount('<input name="a" value="">');
    const inst = FormValidator.init({ formId: form.id, rules: {} });
    assert.equal(await inst.validate({ focus: false }), true);
    inst.addRules('a', ['required']);
    assert.equal(await inst.validate({ focus: false }), false);
    inst.removeRules('a');
    assert.equal(errs(form).length, 0);
    assert.equal(await inst.validate({ focus: false }), true);
});

test('validateField validates just one field', async () => {
    const form = mount('<input name="a"><input name="b">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: ['required'], b: ['required'] } });
    assert.equal(await inst.validateField('a'), false);
    assert.equal(errs(form).length, 1);
});

test('reset clears errors', async () => {
    const form = mount('<input name="a">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    await inst.validate({ focus: false });
    form.dispatchEvent(new w.Event('reset', { bubbles: true }));
    await settle();
    assert.equal(errs(form).length, 0);
});

// ================================================================ focus, callbacks, events
test('focuses the first invalid field in DOM order', async () => {
    const form = mount('<input name="a" value="ok"><input name="b"><input name="c">');
    FormValidator.init({ formId: form.id, rules: { c: ['required'], b: ['required'], a: ['required'] } });
    await submit(form);
    assert.equal(document.activeElement, $('[name=b]'));
    const f2 = mount('<input name="a">');
    FormValidator.init({ formId: f2.id, rules: { a: ['required'] }, config: { focusInvalid: false } });
    document.activeElement && document.activeElement.blur();
    await submit(f2);
    assert.notEqual(document.activeElement, $('[name=a]'));
});

test('onError / onSuccess callbacks and fv:invalid / fv:valid events', async () => {
    const form = mount('<input name="a">');
    const log = [];
    FormValidator.init({ formId: form.id, rules: { a: ['required'] }, config: {
        onError: list => log.push(['err', list.map(e => e.name + ':' + e.message)]),
        onSuccess: () => log.push(['ok'])
    } });
    form.addEventListener('fv:invalid', e => log.push(['ev-invalid', e.detail.errors.length]));
    form.addEventListener('fv:valid', () => log.push(['ev-valid']));
    await submit(form);
    $('[name=a]').value = 'x';
    await submit(form);
    assert.deepEqual(log, [['err', ['a:This field is required.']], ['ev-invalid', 1], ['ok'], ['ev-valid']]);
});

// ================================================================ browser quirks
test('type=number with unparseable text is reported (value reads as empty)', async () => {
    const form = mount('<input type="number" name="n">');
    const input = $('[name=n]');
    Object.defineProperty(input, 'validity', { value: { badInput: true } });
    const inst = FormValidator.init({ formId: form.id, rules: { n: [{ type: 'min', min: 1 }] } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.equal(errFor(form, 'n')[0], 'Please enter a valid value.');
});

test('autoRules derives rules from HTML attributes', async () => {
    const form = mount(`<input name="r" required><input name="e" type="email" value="bad"><input name="l" minlength="4" value="ab">
        <input name="n" type="number" min="5" max="9" value="12"><input name="p" pattern="[A-Z]{3}" title="Three capitals" value="ab1">`);
    const inst = FormValidator.init({ formId: form.id, rules: {}, config: { autoRules: true } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.equal(errs(form).length, 5);
    assert.equal(errFor(form, 'p')[0], 'Three capitals');
    $('[name=r]').value = 'x'; $('[name=e]').value = 'a@b.co'; $('[name=l]').value = 'abcd'; $('[name=n]').value = '7'; $('[name=p]').value = 'ABC';
    assert.equal(await inst.validate({ focus: false }), true);
});

test('autoRules: explicit rule of the same type wins', async () => {
    const form = mount('<input name="r" required>');
    const inst = FormValidator.init({ formId: form.id, rules: { r: [{ type: 'required', message: 'Mine' }] }, config: { autoRules: true } });
    await inst.validate({ focus: false });
    assert.equal(errFor(form, 'r')[0], 'Mine');
});

test('jQuery-style Select2 change events are picked up when jQuery exists', async () => {
    const handlers = [];
    globalThis.jQuery = () => ({ on: (ns, sel, fn) => handlers.push(fn), off: () => {} });
    try {
        const form = mount('<select name="s"><option value="">-</option><option value="1">1</option></select>');
        FormValidator.init({ formId: form.id, rules: { s: ['required'] } });
        await submit(form);
        assert.equal(errFor(form, 's').length, 1);
        $('[name=s]').value = '1';
        handlers.forEach(h => h({ target: $('[name=s]') }));
        await settle();
        assert.equal(errFor(form, 's').length, 0);
    } finally { delete globalThis.jQuery; }
});

test('works with no jQuery and select elements (regression: old code threw)', async () => {
    assert.equal(typeof globalThis.jQuery, 'undefined');
    const form = mount('<select name="s"><option value="">-</option></select>');
    const inst = FormValidator.init({ formId: form.id, rules: { s: ['required'] } });
    assert.equal(await inst.validate({ focus: false }), false);
});

test('validate(id, rules) reuses the initialised form config', async () => {
    const form = mount('<input name="a" value="">');
    FormValidator.init({ formId: form.id, rules: {}, config: { messages: { required: 'From config' } } });
    assert.equal(await FormValidator.validate(form.id, { a: ['required'] }), false);
    assert.equal(errFor(form, 'a')[0], 'From config');
});

test('rule: file names the offending file when several are selected, and validates live on change', async () => {
    const png = n => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], n, { type: 'image/png' });
    const form = mount('<input type="file" name="f" multiple>');
    const input = $('[name=f]');
    FormValidator.init({ formId: form.id, rules: { f: [{ type: 'file', accept: '.png' }] } });
    setFiles(input, [png('ok.png'), F('bad.exe', 10)]);
    fire(input, 'change'); await settle(60);
    assert.match(errFor(form, 'f')[0], /^bad\.exe: /);
    setFiles(input, [png('ok.png')]);
    fire(input, 'change'); await settle(60);
    assert.equal(errFor(form, 'f').length, 0);
});

// ================================================================ data-msg-* (same idea as jQuery Validation)
test('data-msg-<rule> sets the message for that rule; data-msg is the fallback for every rule of the field', async () => {
    const form = mount(`
        <input name="a" data-msg-required="Please tell us your name">
        <input name="b" value="x" data-msg-minlength="At least {min} characters, please" data-msg-email="Not an email">
        <input name="c" data-msg="One message for the whole field">
        <input name="d" value="x" data-msg-min-date="Too early" data-msg-maxdate="Too late">
        <input name="e" data-msg-required="Rule message wins">`);
    const inst = FormValidator.init({ formId: form.id, rules: {
        a: ['required'],
        b: [{ type: 'minlength', min: 5 }],
        c: ['required'],
        d: [{ type: 'date' }, { type: 'minDate', min: '2999-01-01' }],
        e: [{ type: 'required', message: 'Rule message wins over data-msg-required? no: the rule message is the strongest' }]
    } });
    $('[name=d]').value = '2020-01-01';
    await inst.validate({ focus: false });
    assert.equal(errFor(form, 'a')[0], 'Please tell us your name');
    assert.equal(errFor(form, 'b')[0], 'At least 5 characters, please');
    assert.equal(errFor(form, 'c')[0], 'One message for the whole field');
    assert.equal(errFor(form, 'd')[0], 'Too early', 'kebab-case attribute for a camelCase rule name');
    assert.match(errFor(form, 'e')[0], /^Rule message wins over/);
});

test('data-msg-required also works with autoRules (required attribute) and for radio groups and selects', async () => {
    const form = mount(`
        <input name="a" required data-msg-required="Name needed">
        <input name="m" type="email" value="bad" data-msg-email="Need a real email">
        <input type="radio" name="r" value="1" data-msg-required="Pick one"><input type="radio" name="r" value="2">
        <select name="s" required data-msg-required="Choose an option"><option value="">-</option></select>`);
    const inst = FormValidator.init({ formId: form.id, rules: {}, config: { autoRules: true } });
    $$('[name=r]').forEach(r => r.setAttribute('required', ''));
    await inst.validate({ focus: false });
    assert.equal(errFor(form, 'a')[0], 'Name needed');
    assert.equal(errFor(form, 'm')[0], 'Need a real email');
    assert.equal(errFor(form, 'r')[0], 'Pick one');
    assert.equal(errFor(form, 's')[0], 'Choose an option');
});

test('data-msg-<rule> beats a server or FileValidator message, the generic data-msg does not', async () => {
    const mk = attr => {
        const form = mount(`<input name="u" value="bob" ${attr}>`);
        globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => 'Server: taken' });
        return { form, inst: FormValidator.init({ formId: form.id, rules: { u: [{ type: 'remote', url: '/c', cache: false }] } }) };
    };
    let t = mk('data-msg-remote="From attribute"');
    await t.inst.validate({ focus: false });
    assert.equal(errFor(t.form, 'u')[0], 'From attribute');
    t = mk('data-msg="Generic"');
    await t.inst.validate({ focus: false });
    assert.equal(errFor(t.form, 'u')[0], 'Server: taken');
});

test('data-msg text is set as plain text (no HTML injection)', async () => {
    const form = mount('<input name="a" data-msg-required="&lt;b&gt;bold&lt;/b&gt;">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: ['required'] } });
    await inst.validate({ focus: false });
    assert.equal($('b', form), null);
    assert.equal(errFor(form, 'a')[0], '<b>bold</b>');
});

// ================================================================ pointer safety: no layout change while a pointer is down
test('a blur-triggered re-check waits for the click to finish (the page must not shift under the pointer)', async () => {
    const form = mount('<input name="a" id="pa" value="x"><input name="b" id="pb">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: [{ type: 'email', message: 'Not an email' }], b: ['required'] }, config: { debounce: 0 } });
    await inst.validate({ focus: false });
    assert.equal(errFor(form, 'a').length, 1);
    $('[name=a]').value = 'a@b.co';
    document.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));       // the mouse button goes down (this also blurs the field)
    fire($('[name=a]'), 'change');
    await settle(40);
    assert.equal(errFor(form, 'a').length, 1, 'the message is still there while the pointer is down');
    document.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
    document.dispatchEvent(new w.Event('click', { bubbles: true }));
    await settle(60);
    assert.equal(errFor(form, 'a').length, 0, 'and it is removed once the click is over');
    // without a pointer (keyboard) it is immediate
    $('[name=a]').value = 'bad'; fire($('[name=a]'), 'change'); await settle(40);
    assert.equal(errFor(form, 'a').length, 1);
    $('[name=a]').value = 'a@b.co'; fire($('[name=a]'), 'change'); await settle(40);
    assert.equal(errFor(form, 'a').length, 0);
});

test('a pointer that never sends a click (drag away) still releases the deferred update', async () => {
    const form = mount('<input name="a" id="pa" value="x">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: [{ type: 'email', message: 'Not an email' }] }, config: { debounce: 0 } });
    await inst.validate({ focus: false });
    $('[name=a]').value = 'a@b.co';
    document.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    fire($('[name=a]'), 'change');
    document.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
    await settle(250);
    assert.equal(errFor(form, 'a').length, 0);
    inst.destroy();
});

// ================================================================ hardening: bad selectors and throwing callbacks
test('an invalid CSS selector as a rule parameter is "no match", not a crash', async () => {
    const form = mount('<input name="a" value="x"><input name="b" value="y">');
    const inst = FormValidator.init({ formId: form.id, rules: { b: { equalTo: '[1,2]' }, a: { required: '[[bad' } } });
    assert.equal(await inst.validate({ focus: false }), false, 'equalTo an unknown target fails, and nothing throws');
});

test('errors thrown by your own callbacks are logged and ignored; the form keeps working', async () => {
    const seen = []; const err = console.error; console.error = (...a) => seen.push(String(a[0]));
    try {
        const form = mount('<input name="a" value="">');
        const boom = () => { throw new Error('bug in my code'); };
        const inst = FormValidator.init({ formId: form.id, rules: { a: [{ type: 'required', when: boom, message: boom, normalizer: boom }] },
            config: { resolveMessage: boom, errorPlacement: boom, highlight: boom, unhighlight: boom, onError: boom, onSuccess: boom, onFieldValid: boom, fieldRules: boom } });
        assert.equal(await inst.validate({ focus: false }), false, 'the rule still applies and fails');
        assert.equal(errFor(form, 'a').length, 1, 'a message is still shown (default text, default placement)');
        assert.equal(errFor(form, 'a')[0], 'This field is required.');
        $('[name=a]').value = 'x';
        assert.equal(await inst.validate({ focus: false }), true);
        assert.ok(seen.length > 3 && seen.every(s => /error in your/.test(s)), seen.join('|'));
    } finally { console.error = err; }
});

test('wrong-typed config values fall back to the defaults', async () => {
    const form = mount('<input name="a">');
    const inst = FormValidator.init({ formId: form.id, rules: { a: ['required'] }, config: { errorElement: ['x', 'y'], errorClass: 5, validateOn: 'change', debounce: 'fast', ignore: '[[', submitHandler: 'nope', onError: 1, classRules: 'x' } });
    assert.equal(await inst.validate({ focus: false }), false);
    assert.equal($('.error', form).tagName, 'DIV');
    assert.ok($('.error', form).classList.contains('text-danger'));
});
