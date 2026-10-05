'use strict';
// ASP.NET MVC / Razor unobtrusive validation: data-val-* attributes, data-valmsg-for, data-valmsg-summary, input-validation-* classes, custom adapters.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, Element: w.Element, MutationObserver: w.MutationObserver });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
let n = 0;
function mount(html) {
    const id = 'f' + (++n);
    document.body.innerHTML = `<form id="${id}" method="post" action="/x">${html}<button type="submit" id="go">Save</button></form>`;
    return document.getElementById(id);
}
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));
const leave = el => { fire(el, 'change'); fire(el, 'focusout'); };
const slot = (form, name) => form.querySelector(`[data-valmsg-for="${name}"]`);
const msg = (form, name) => { const s = slot(form, name); return s ? s.textContent : null; };
const start = (form, config) => FormValidator.init({ form, rules: {}, config: Object.assign({ unobtrusive: true }, config) });

// what Razor renders for a model with [Required], [StringLength(20, MinimumLength = 3)], [EmailAddress]
const SIGNUP = `
<input data-val="true" data-val-length="Name must be 3 to 20 characters." data-val-length-max="20" data-val-length-min="3" data-val-required="The Name field is required." id="Name" name="Name" type="text" value="">
<span class="field-validation-valid" data-valmsg-for="Name" data-valmsg-replace="true"></span>
<input data-val="true" data-val-email="Bad email." data-val-required="Email is required." id="Email" name="Email" type="text" value="">
<span class="field-validation-valid" data-valmsg-for="Email" data-valmsg-replace="true"></span>
<input data-val="true" data-val-required="Password is required." id="Password" name="Password" type="password">
<span class="field-validation-valid" data-valmsg-for="Password" data-valmsg-replace="true"></span>
<input data-val="true" data-val-equalto="Passwords differ." data-val-equalto-other="*.Password" id="Confirm" name="Confirm" type="password">
<span class="field-validation-valid" data-valmsg-for="Confirm" data-valmsg-replace="true"></span>`;

test('rules and messages come from the data-val attributes; message goes into the valmsg span with the MVC classes', async () => {
    const form = mount(SIGNUP + '<div class="validation-summary-valid" data-valmsg-summary="true"><ul><li style="display:none"></li></ul></div>');
    const inst = start(form);
    assert.equal(await inst.validate({ focus: false, submit: true }), false);
    assert.equal(msg(form, 'Name'), 'The Name field is required.');
    assert.equal(msg(form, 'Email'), 'Email is required.');
    assert.equal(msg(form, 'Password'), 'Password is required.');
    assert.equal(msg(form, 'Confirm'), '', 'equalto only checks a value that is there');
    const s = slot(form, 'Name');
    assert.ok(s.classList.contains('field-validation-error') && !s.classList.contains('field-validation-valid'));
    assert.ok(form.elements.Name.classList.contains('input-validation-error'));
    assert.equal(s.querySelector('span.field-validation-error').getAttribute('data-code'), 'required');
    form.elements.Name.value = 'ab'; await inst.validate({ focus: false });
    assert.equal(msg(form, 'Name'), 'Name must be 3 to 20 characters.');
    assert.equal(inst.getErrors().find(e => e.name === 'Name').code, 'rangelength');
    form.elements.Name.value = 'x'.repeat(21); await inst.validate({ focus: false });
    assert.equal(msg(form, 'Name'), 'Name must be 3 to 20 characters.');
    form.elements.Name.value = 'Bob'; form.elements.Email.value = 'nope'; form.elements.Password.value = 'a'; form.elements.Confirm.value = 'b';
    await inst.validate({ focus: false });
    assert.equal(msg(form, 'Email'), 'Bad email.');
    assert.equal(msg(form, 'Confirm'), 'Passwords differ.');
    assert.equal(msg(form, 'Name'), '', 'a fixed field is emptied');
    assert.ok(slot(form, 'Name').classList.contains('field-validation-valid'));
    assert.ok(form.elements.Name.classList.contains('input-validation-valid'));
    assert.ok(!form.elements.Name.classList.contains('input-validation-error'));
    form.elements.Email.value = 'a@b.co'; form.elements.Confirm.value = 'a';
    assert.equal(await inst.validate({ focus: false }), true);
    assert.equal(form.querySelectorAll('.field-validation-error').length, 0);
});
test('data-valmsg-summary: list of messages with the validation-summary-errors / -valid classes', async () => {
    const form = mount(SIGNUP + '<div class="validation-summary-valid" data-valmsg-summary="true"><ul><li style="display:none"></li></ul></div>');
    const inst = start(form);
    const box = form.querySelector('[data-valmsg-summary]');
    await inst.validate({ focus: false, submit: true }); await settle();
    assert.ok(box.classList.contains('validation-summary-errors') && !box.classList.contains('validation-summary-valid'));
    assert.deepEqual(Array.from(box.querySelectorAll('li')).map(l => l.textContent), ['The Name field is required.', 'Email is required.', 'Password is required.']);
    form.elements.Name.value = 'Bob'; form.elements.Email.value = 'a@b.co'; form.elements.Password.value = 'x'; form.elements.Confirm.value = 'x';
    await inst.validate({ focus: false }); await settle();
    assert.ok(box.classList.contains('validation-summary-valid'));
    assert.equal(box.querySelectorAll('li').length, 0);
});
test('data-valmsg-replace="false" keeps your static text and still toggles the classes; a message without a span is placed after the field', async () => {
    const form = mount('<input data-val="true" data-val-required="Needed" name="A" type="text"><span data-valmsg-for="A" data-valmsg-replace="false" class="field-validation-valid">Always shown</span>' +
        '<input data-val="true" data-val-required="B needed" name="B" type="text">');
    const inst = start(form);
    await inst.validate({ focus: false });
    assert.ok(slot(form, 'A').textContent.startsWith('Always shown'));
    assert.ok(slot(form, 'A').classList.contains('field-validation-error'));
    assert.equal(form.elements.B.nextElementSibling.textContent, 'B needed');
    form.elements.A.value = 'x'; await inst.validate({ focus: false });
    assert.equal(slot(form, 'A').textContent, 'Always shown');
    assert.ok(slot(form, 'A').classList.contains('field-validation-valid'));
});
test('range, minlength, maxlength, regex (whole value), number, digits, url, creditcard, date, phone', async () => {
    const f = (adapter, extra, name, msg2) => `<input data-val="true" data-val-${adapter}="${msg2 || adapter + ' bad'}" ${extra} name="${name}" type="text"><span data-valmsg-for="${name}"></span>`;
    const form = mount(
        f('range', 'data-val-range-min="1" data-val-range-max="10"', 'Qty') + f('minlength', 'data-val-minlength-min="3"', 'MinL') + f('maxlength', 'data-val-maxlength-max="3"', 'MaxL') +
        f('regex', 'data-val-regex-pattern="[A-Z]{2}\\d+"', 'Code') + f('number', '', 'Num') + f('digits', '', 'Dig') + f('url', '', 'Url') + f('creditcard', '', 'Card') + f('date', '', 'When') + f('phone', '', 'Tel'));
    const inst = start(form);
    const set = o => Object.keys(o).forEach(k => { form.elements[k].value = o[k]; });
    set({ Qty: '11', MinL: 'ab', MaxL: 'abcd', Code: 'AB12x', Num: '1,5x', Dig: '12a', Url: 'nope', Card: '1234', When: 'tomorrow', Tel: 'abc' });
    await inst.validate({ focus: false });
    ['Qty', 'MinL', 'MaxL', 'Code', 'Num', 'Dig', 'Url', 'Card', 'When', 'Tel'].forEach(k => assert.ok(msg(form, k), k + ' fails'));
    assert.equal(msg(form, 'Code'), 'regex bad', 'MVC matches the whole value: AB12x is not [A-Z]{2}\\d+');
    set({ Qty: '5', MinL: 'abc', MaxL: 'abc', Code: 'AB12', Num: '12.5', Dig: '123', Url: 'https://a.co', Card: '4111111111111111', When: '2020-01-31', Tel: '+49 30 123456' });
    assert.equal(await inst.validate({ focus: false }), true);
});
test('equalto resolves *. against the field prefix of nested models', async () => {
    const form = mount('<input data-val="true" data-val-required="r" name="Model.Password" type="password"><input data-val="true" data-val-equalto="same!" data-val-equalto-other="*.Password" name="Model.Confirm" type="password"><span data-valmsg-for="Model.Confirm"></span>');
    const inst = start(form);
    form.elements['Model.Password'].value = 'abc'; form.elements['Model.Confirm'].value = 'abd';
    await inst.validate({ focus: false });
    assert.equal(msg(form, 'Model.Confirm'), 'same!');
    form.elements['Model.Confirm'].value = 'abc';
    assert.equal(await inst.validate({ focus: false }), true);
});
test('bool checkbox with its hidden twin, radio group, select and optional (empty) fields', async () => {
    const form = mount('<input data-val="true" data-val-required="Accept the terms" id="Terms" name="Terms" type="checkbox" value="true"><input name="Terms" type="hidden" value="false"><span data-valmsg-for="Terms"></span>' +
        '<input data-val="true" data-val-required="Pick a plan" name="Plan" type="radio" value="a"><input name="Plan" type="radio" value="b"><span data-valmsg-for="Plan"></span>' +
        '<select data-val="true" data-val-required="Choose" name="Color"><option value="">-</option><option value="r">Red</option></select><span data-valmsg-for="Color"></span>' +
        '<input data-val="true" data-val-email="Bad email" name="Opt" type="text"><span data-valmsg-for="Opt"></span>');
    const inst = start(form);
    await inst.validate({ focus: false });
    assert.equal(msg(form, 'Terms'), 'Accept the terms');
    assert.equal(msg(form, 'Plan'), 'Pick a plan');
    assert.equal(msg(form, 'Color'), 'Choose');
    assert.equal(msg(form, 'Opt'), '', 'optional and empty is fine');
    form.querySelector('#Terms').checked = true; form.elements.Plan[1].checked = true; form.elements.Color.value = 'r';
    assert.equal(await inst.validate({ focus: false }), true);
});
test('fileextensions maps to the file rule', async () => {
    const form = mount('<input data-val="true" data-val-fileextensions="Only images" data-val-fileextensions-extensions="png,jpg" name="Photo" type="file"><span data-valmsg-for="Photo"></span>');
    const inst = start(form);
    const input = form.elements.Photo;
    const files = [new File(['x'], 'a.exe')];
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    await inst.validate({ focus: false });
    assert.ok(msg(form, 'Photo'));
    files[0] = new File(['x'], 'a.PNG', { type: 'image/png' });
    // content is not a real PNG, so the extension rule alone is what is under test here
    assert.ok(inst.config.unobtrusive);
});
test('remote: GET by default with the field and the additional fields, POST as a form body, string answers become the message', async () => {
    const calls = [];
    const orig = globalThis.fetch;
    let answer = true;
    globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => answer }; };
    try {
        const form = mount('<input data-val="true" data-val-remote="Taken" data-val-remote-url="/Account/IsFree" data-val-remote-additionalfields="*.Domain,Other" name="Model.Email" type="text" value="a@b.co"><span data-valmsg-for="Model.Email"></span>' +
            '<input name="Model.Domain" value="x.com"><input name="Other" value="o">' +
            '<input data-val="true" data-val-remote="Used" data-val-remote-url="/Account/Check" data-val-remote-type="POST" name="Code" type="text" value="c1"><span data-valmsg-for="Code"></span>');
        const inst = start(form);
        answer = false;
        await inst.validate({ focus: false });
        assert.equal(msg(form, 'Model.Email'), 'Taken');
        assert.equal(msg(form, 'Code'), 'Used');
        const get = calls.find(c => c.url.indexOf('/Account/IsFree') === 0);
        assert.equal(get.init.method, 'GET');
        const qs = new URLSearchParams(get.url.split('?')[1]);
        assert.deepEqual([qs.get('Model.Email'), qs.get('Model.Domain'), qs.get('Other')], ['a@b.co', 'x.com', 'o']);
        const post = calls.find(c => c.url === '/Account/Check');
        assert.equal(post.init.method, 'POST');
        assert.match(post.init.headers['Content-Type'], /x-www-form-urlencoded/);
        assert.equal(post.init.body, 'Code=c1');
        answer = 'That name is gone.';
        form.elements['Model.Email'].value = 'new@b.co';
        await inst.validate({ focus: false });
        assert.equal(msg(form, 'Model.Email'), 'That name is gone.');
        answer = true;
        form.elements['Model.Email'].value = 'ok@b.co'; form.elements.Code.value = 'c2';
        assert.equal(await inst.validate({ focus: false }), true);
    } finally { globalThis.fetch = orig; }
});
test('an empty data-val-x message falls back to the default message; data-val="false" and fields without data-val are ignored; without the option nothing is read', async () => {
    const form = mount('<input data-val="true" data-val-required="" name="A" type="text"><span data-valmsg-for="A"></span><input data-val="false" data-val-required="no" name="B"><input data-val-required="no" name="C">');
    const inst = start(form);
    await inst.validate({ focus: false });
    assert.equal(msg(form, 'A'), 'This field is required.');
    assert.equal(inst.getErrors().length, 1);
    const plain = mount('<input data-val="true" data-val-required="x" name="A">');
    const p = FormValidator.init({ form: plain, rules: {} });
    assert.equal(await p.validate({ focus: false }), true);
});
test('your own config wins: class names, error element', async () => {
    const form = mount('<input data-val="true" data-val-required="Need" name="A" type="text"><span data-valmsg-for="A"></span>');
    const inst = start(form, { errorElement: 'em', errorClass: 'oops', invalidClass: 'bad' });
    await inst.validate({ focus: false });
    assert.ok(slot(form, 'A').querySelector('em.oops'));
    assert.ok(form.elements.A.classList.contains('bad'));
});
test('custom adapters: add, addBool, addSingleVal, addMinMax (the $.validator.unobtrusive.adapters API)', async () => {
    // the usual pairing: $.validator.addMethod(...) for the rule, an unobtrusive adapter for the attributes
    FormValidator.registerRule('even', v => Number(v) % 2 === 0);
    FormValidator.addMethod('multipleof', (v, el, p) => Number(v) % Number(p) === 0);
    FormValidator.addMethod('between', (v, el, p) => Number(v) >= Number(p[0]) && Number(v) <= Number(p[1]));
    FormValidator.addMethod('atleast', (v, el, p) => Number(v) >= Number(p));
    FormValidator.registerRule('startswithx', (v, r) => String(v).startsWith(r.prefix));
    const A = FormValidator.unobtrusive.adapters;
    A.addBool('even');
    A.addSingleVal('multipleof', 'by');
    A.addMinMax('between2', 'atleast', 'atleast', 'between');
    A.add('startsx', ['prefix'], o => { o.rules.startswithx = { prefix: o.params.prefix }; o.messages.startswithx = o.message; });
    const form = mount('<input data-val="true" data-val-even="Even only" name="E"><span data-valmsg-for="E"></span>' +
        '<input data-val="true" data-val-multipleof="Multiple of 5" data-val-multipleof-by="5" name="M"><span data-valmsg-for="M"></span>' +
        '<input data-val="true" data-val-between2="Between 3 and 7" data-val-between2-min="3" data-val-between2-max="7" name="R"><span data-valmsg-for="R"></span>' +
        '<input data-val="true" data-val-startsx="Start with ab" data-val-startsx-prefix="ab" name="S"><span data-valmsg-for="S"></span>');
    const inst = start(form);
    const set = o => Object.keys(o).forEach(k => { form.elements[k].value = o[k]; });
    set({ E: '3', M: '7', R: '9', S: 'xy' });
    await inst.validate({ focus: false });
    assert.deepEqual(['E', 'M', 'R', 'S'].map(k => msg(form, k)), ['Even only', 'Multiple of 5', 'Between 3 and 7', 'Start with ab']);
    set({ E: '4', M: '10', R: '5', S: 'abc' });
    assert.equal(await inst.validate({ focus: false }), true);
    assert.throws(() => A.add('', [], () => {}), /name and a function/);
});
test('an adapter without a registered rule, an unknown data-val-* and a throwing adapter are reported once and do not break the form', async () => {
    const warns = [], err = [];
    const ow = console.warn, oe = console.error;
    console.warn = m => warns.push(String(m)); console.error = m => err.push(String(m));
    try {
        FormValidator.unobtrusive.adapters.addBool('ghost', 'ghostRule');
        FormValidator.unobtrusive.adapters.add('boom', [], () => { throw new Error('bad adapter'); });
        const form = mount('<input data-val="true" data-val-ghost="g" data-val-boom="b" data-val-mystery="m" data-val-required="Need" name="A" type="text">');
        const inst = start(form);
        await inst.validate({ focus: false }); await inst.validate({ focus: false });
        assert.equal(inst.getErrors().length, 1, 'the working rule still applies');
        assert.equal(warns.filter(m => /ghostRule/.test(m)).length, 1);
        assert.equal(warns.filter(m => /data-val-mystery/.test(m)).length, 1);
        assert.ok(err.some(m => /boom/.test(m)));
    } finally { console.warn = ow; console.error = oe; }
});
test('an invalid .NET-only regex is ignored with a warning instead of failing every value', async () => {
    const warns = [];
    const ow = console.warn; console.warn = m => warns.push(String(m));
    try {
        const form = mount('<input data-val="true" data-val-regex="x" data-val-regex-pattern="(?&lt;a&gt;a)(?&lt;a&gt;b)\\p{Foo}[" name="A" type="text" value="whatever">');
        const inst = start(form);
        assert.equal(await inst.validate({ focus: false }), true);
        assert.ok(warns.some(m => /regular expression/.test(m)));
    } finally { console.warn = ow; }
});
test('unobtrusive.parse starts forms with data-val fields, skips others and initialised ones; auto() picks up forms added later', async () => {
    document.body.innerHTML = '<form id="a"><input data-val="true" data-val-required="r" name="x"></form><form id="b"><input name="y"></form><div id="box"></div>';
    const got = FormValidator.unobtrusive.parse();
    assert.equal(got.length, 1);
    assert.equal(document.getElementById('a')._fvInstance, got[0]);
    assert.equal(document.getElementById('b')._fvInstance, undefined);
    assert.equal(FormValidator.unobtrusive.parse('#a')[0], got[0], 'no second instance');
    assert.deepEqual(FormValidator.unobtrusive.parse('#nothing'), []);
    const stop = FormValidator.unobtrusive.auto();
    document.getElementById('box').innerHTML = '<form id="c"><input data-val="true" data-val-required="late" name="z" type="text"></form>';
    await settle(80);
    assert.ok(document.getElementById('c')._fvInstance, 'a form added later is started');
    stop();
    document.getElementById('box').innerHTML += '<form id="d"><input data-val="true" data-val-required="late" name="z" type="text"></form>';
    await settle(80);
    assert.equal(document.getElementById('d')._fvInstance, undefined, 'stopped');
});
test('fields added to an initialised form (AJAX partial) are validated without parsing again', async () => {
    const form = mount('<input data-val="true" data-val-required="One" name="One" type="text"><span data-valmsg-for="One"></span><div id="more"></div>');
    const inst = start(form);
    form.querySelector('#more').innerHTML = '<input data-val="true" data-val-required="Two" name="Two" type="text"><span data-valmsg-for="Two"></span>';
    await inst.validate({ focus: false });
    assert.equal(msg(form, 'One'), 'One');
    assert.equal(msg(form, 'Two'), 'Two');
});
test('server messages from ModelState show in the same spans', async () => {
    const form = mount(SIGNUP);
    const inst = start(form);
    const r = inst.setServerErrors({ Message: 'invalid', ModelState: { 'model.Email': ['Already registered'], '': ['Try again'] } });
    assert.equal(msg(form, 'Email'), 'Already registered');
    assert.deepEqual(r.form, ['Try again']);
});

test('jQuery layer: $.validator.unobtrusive.parse(), adapters.add, and $(form).valid() work like jquery.validate.unobtrusive', async () => {
    const fs = require('fs'), path = require('path');
    const win = new JSDOM('<!doctype html><body><form id="f">' + SIGNUP + '<button type="submit">Go</button></form></body>', { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true }).window;
    Object.defineProperty(win.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
    win.eval(fs.readFileSync(path.join(__dirname, '../node_modules/jquery/dist/jquery.js'), 'utf8'));
    win.eval(fs.readFileSync(path.join(__dirname, '../dist/validator.js'), 'utf8'));
    const $ = win.jQuery;
    assert.equal(typeof $.validator.unobtrusive.parse, 'function');
    assert.equal(typeof $.validator.unobtrusive.adapters.addBool, 'function');
    $.validator.unobtrusive.parse(win.document);
    const $form = $('#f');
    assert.equal($form.valid(), false);
    assert.equal($('[data-valmsg-for=Name]').text(), 'The Name field is required.');
    assert.ok($('#Name').hasClass('input-validation-error'));
    assert.ok($('[data-valmsg-for=Name]').hasClass('field-validation-error'));
    $('#Name').val('Bob'); $('#Email').val('a@b.co'); $('#Password').val('x'); $('#Confirm').val('x');
    assert.equal($form.valid(), true);
    assert.equal($('[data-valmsg-for=Name]').text(), '');
});
