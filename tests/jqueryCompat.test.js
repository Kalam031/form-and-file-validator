'use strict';
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// ---------------------------------------------------------------- environment: real jQuery on jsdom
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', {
    value() { for (let n = this; n && n.nodeType === 1; n = n.parentElement) if (n.hidden || n.style.display === 'none') return []; return [1]; }
});
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS, Node: w.Node, HTMLElement: w.HTMLElement });
globalThis.FormValidator = require('../src/formValidator.js');
globalThis.FileValidator = require('../src/fileValidator.js');
const $ = require(process.env.JQUERY_PKG || 'jquery'); // JQUERY_PKG=jquery3 runs the same tests on jQuery 3.x
globalThis.jQuery = $;
require('../src/formValidator.jquery.js');

const settle = (ms = 25) => new Promise(r => setTimeout(r, ms));
let n = 0;
function mount(html, options, formAttrs = '') {
    document.body.innerHTML = `<form id="f${++n}" ${formAttrs}>${html}<button type="submit" id="go">go</button><button type="submit" class="cancel" id="cancel">cancel</button></form>`;
    const $form = $('form');
    $form[0].native = 0;
    $form[0].requestSubmit = function (sub) {
        const ev = new w.Event('submit', { bubbles: true, cancelable: true });
        if (sub) Object.defineProperty(ev, 'submitter', { value: sub });
        if (this.dispatchEvent(ev)) this.native++;
    };
    $form[0].submit = () => { $form[0].native++; };
    const validator = options === undefined ? undefined : $form.validate(options);
    return { $form, form: $form[0], validator };
}
const submit = async (form, sub) => {
    const ev = new w.Event('submit', { bubbles: true, cancelable: true });
    if (sub) Object.defineProperty(ev, 'submitter', { value: sub });
    form.dispatchEvent(ev);
    await settle(40);
    return ev;
};
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
const errorsOf = form => $('.error, label.error', form).filter((i, e) => e.textContent).map((i, e) => e.textContent).get();

/** jQuery-Validation style check of one method: fresh field, rules {x: {method: param}} */
function checkMethod(method, param, valid, invalid, extraAttrs = '') {
    for (const [list, expected] of [[valid, true], [invalid, false]]) {
        for (const v of list) {
            const { $form } = mount(`<input name="x" id="x" ${extraAttrs}>`, { rules: { x: { [method]: param } } });
            $('#x').val(v);
            assert.equal($('#x').valid(), expected, `${method}(${JSON.stringify(param)}) with ${JSON.stringify(v)} should be ${expected ? 'valid' : 'invalid'}`);
            $form.data('validator').destroy();
        }
    }
}

// ================================================================ surface
test('plugin surface exists', () => {
    assert.equal(typeof $.fn.validate, 'function');
    assert.equal(typeof $.fn.valid, 'function');
    assert.equal(typeof $.fn.rules, 'function');
    for (const k of ['addMethod', 'addClassRules', 'setDefaults', 'format', 'messages', 'methods', 'defaults', 'classRuleSettings', 'normalizeRule', 'normalizeRules'])
        assert.ok($.validator[k], '$.validator.' + k);
    assert.equal($.validator.format('{0}-{1}', 'a', 'b'), 'a-b');
    assert.equal($.validator.format('Hi {0}', ['x']), 'Hi x');
    assert.equal($.validator.format('{0}{0}')('z'), 'zz');
});

test('validate() returns the validator, is idempotent, and warns on empty selections', () => {
    const { $form, validator } = mount('<input name="a">', {});
    assert.ok(validator.form);
    assert.equal($form.validate(), validator);
    assert.equal($form.data('validator'), validator);
    assert.ok($form[0].hasAttribute('novalidate'));
    const warn = console.warn; console.warn = () => {};
    try { assert.equal($('#nothing').validate({ debug: true }), undefined); } finally { console.warn = warn; }
});

// ================================================================ every method
test('method: required', () => checkMethod('required', true, ['a', '0'], ['', '   ']));
test('method: required=false is ignored', () => checkMethod('required', false, ['a', ''], []));
test('method: minlength / maxlength / rangelength', () => {
    checkMethod('minlength', 3, ['', 'abc', 'abcd'], ['ab']);
    checkMethod('maxlength', 3, ['', 'abc'], ['abcd']);
    checkMethod('rangelength', [2, 4], ['', 'ab', 'abcd'], ['a', 'abcde']);
    checkMethod('rangelength', '[2, 4]', ['ab'], ['a']);
});
test('method: min / max / range', () => {
    checkMethod('min', 5, ['', '5', '6.5'], ['4', 'abc']);
    checkMethod('max', 5, ['', '5', '-3'], ['5.1']);
    checkMethod('range', [1, 5], ['', '1', '5', '3.3'], ['0', '6']);
});
test('method: step', () => {
    checkMethod('step', 5, ['', '0', '10', '-15'], ['3', '10.5']);
    checkMethod('step', 0.1, ['0.3', '0.7'], ['0.35']);
});
test('method: email (jQuery Validation semantics)', () => checkMethod('email', true,
    ['', 'a@b.co', 'first.last+tag@sub.example.org', 'a@b'], ['a', '@b.co', 'a b@c.de', 'a@@b.co']));
test('method: url', () => checkMethod('url', true,
    ['', 'http://example.com', 'https://a.bc/c?d=1#e', 'ftp://ftp.example.org/file', '//example.com', 'http://user:pw@example.com:8080/x'],
    ['example.com', 'www.example.com', 'http://', 'http://localhost', 'javascript:alert(1)', 'http://exa mple.com']));
test('method: date / dateISO', () => {
    checkMethod('date', true, ['', '2024-02-29', 'Jan 5, 2024'], ['nope', 'NaN']);
    checkMethod('dateISO', true, ['', '2024-02-29', '2024/2/9'], ['2024-13-01', '02-29-2024', 'x']);
});
test('method: number / digits / integer', () => {
    checkMethod('number', true, ['', '1', '-1.5', '1,234.5', '.5'], ['abc', '1,5', '1.2.3']);
    checkMethod('digits', true, ['', '123'], ['-1', '1.5', 'a']);
    checkMethod('integer', true, ['', '12', '-12'], ['1.5', 'a']);
});
test('method: equalTo / notEqualTo (selector)', () => {
    const { $form } = mount('<input id="pw" name="pw" value="secret"><input id="pw2" name="pw2" value="secret">', { rules: { pw2: { equalTo: '#pw' } } });
    assert.equal($('#pw2').valid(), true);
    $('#pw2').val('other');
    assert.equal($('#pw2').valid(), false);
    assert.equal(errorsOf($form[0])[0], 'Please enter the same value again.');
    const m2 = mount('<input id="a" name="a" value="x"><input id="b" name="b" value="y">', { rules: { b: { notEqualTo: '#a' } } });
    assert.equal($('#b').valid(), true);
    $('#b').val('x');
    assert.equal($('#b').valid(), false);
});
test('method: creditcard', () => checkMethod('creditcard', true, ['', '4111111111111111', '4111-1111-1111-1111', '5500 0000 0000 0004'], ['4111111111111112', '1234', 'abcd']));
test('method: extension', () => {
    checkMethod('extension', 'png|jpe?g', ['', 'a.png', 'a.JPEG', 'x.jpg'], ['a.gif', 'a.png.exe']);
    checkMethod('extension', 'pdf,docx', ['a.pdf', 'a.DOCX'], ['a.txt']);
    checkMethod('extension', true, ['a.gif', 'a.png'], ['a.pdf']);
});
test('method: pattern (string and RegExp)', () => {
    checkMethod('pattern', '[A-Z]{2}\\d{3}', ['', 'AB123'], ['ab123', 'AB1234']);
    checkMethod('pattern', /^abc$/, ['abc'], ['ABC']);
});
test('method: word counts', () => {
    checkMethod('maxWords', 3, ['', 'one two three'], ['one two three four']);
    checkMethod('minWords', 2, ['', 'one two'], ['one']);
    checkMethod('rangeWords', [2, 3], ['one two', 'a b c'], ['one', 'a b c d']);
});
test('method: text shape checks', () => {
    checkMethod('lettersonly', true, ['', 'abc'], ['abc1', 'a b']);
    checkMethod('letterswithbasicpunc', true, ['', "Hello, world (it's)"], ['abc1']);
    checkMethod('alphanumeric', true, ['', 'abc_123'], ['a b', 'a-b']);
    checkMethod('nowhitespace', true, ['', 'abc'], ['a b']);
});
test('method: network and time formats', () => {
    checkMethod('ipv4', true, ['', '192.168.0.1', '8.8.8.8'], ['256.1.1.1', '1.2.3', 'a.b.c.d']);
    checkMethod('ipv6', true, ['', '::1', '2001:db8::ff00:42:8329', 'fe80::1', '::ffff:192.168.0.1'], ['12345::1', '1::2::3', 'abcd', ':::']);
    checkMethod('time', true, ['', '0:00', '13:45', '23:59:59'], ['24:00', '12:60', 'ab']);
    checkMethod('time12h', true, ['', '1:30 PM', '12:00am'], ['13:00 PM', '1:30']);
});
test('method: phoneUS / iban', () => {
    checkMethod('phoneUS', true, ['', '(212) 555-1234', '212-555-1234', '+1 212 555 1234'], ['123', '(112) 555-1234', 'abc']);
    checkMethod('iban', true, ['', 'DE89 3704 0044 0532 0130 00', 'GB82WEST12345698765432'], ['DE89 3704 0044 0532 0130 01', 'XX']);
});
test('method: require_from_group / skip_or_fill_minimum', () => {
    const html = '<input class="grp" name="p1" id="p1"><input class="grp" name="p2" id="p2"><input class="grp" name="p3" id="p3">';
    let m = mount(html, { rules: { p1: { require_from_group: [2, '.grp'] }, p2: { require_from_group: [2, '.grp'] }, p3: { require_from_group: [2, '.grp'] } } });
    assert.equal(m.validator.form(), false);
    $('#p1').val('a'); $('#p2').val('b');
    assert.equal(m.validator.form(), true);
    m = mount(html, { rules: { p1: { skip_or_fill_minimum: [2, '.grp'] }, p2: { skip_or_fill_minimum: [2, '.grp'] } } });
    assert.equal(m.validator.form(), true, 'skipping all is fine');
    $('#p1').val('a');
    assert.equal(m.validator.form(), false, 'one of two is not enough');
    $('#p2').val('b');
    assert.equal(m.validator.form(), true);
});
test('method: accept on file inputs', () => {
    const { $form } = mount('<input type="file" name="f" id="f">', { rules: { f: { accept: 'image/*,application/pdf' } } });
    const set = files => Object.defineProperty($('#f')[0], 'files', { value: files, configurable: true });
    Object.defineProperty($('#f')[0], 'value', { get: () => 'C:\\fakepath\\a.png', configurable: true });
    set([new File(['x'], 'a.png', { type: 'image/png' })]);
    assert.equal($('#f').valid(), true);
    set([new File(['x'], 'a.pdf', { type: 'application/pdf' })]);
    assert.equal($('#f').valid(), true);
    set([new File(['x'], 'a.txt', { type: 'text/plain' })]);
    assert.equal($('#f').valid(), false);
});

// ================================================================ selects, radios, checkboxes
test('required on select, radio group and checkbox; minlength/maxlength count checked boxes and selected options', () => {
    const { $form, validator } = mount(`
        <select name="s" id="s"><option value="">-</option><option value="1">1</option></select>
        <input type="radio" name="r" value="a"><input type="radio" name="r" value="b">
        <input type="checkbox" name="c" value="1"><input type="checkbox" name="c" value="2"><input type="checkbox" name="c" value="3">
        <select name="m" multiple id="m"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>`,
        { rules: { s: 'required', r: 'required', c: { required: true, minlength: 2, maxlength: 2 }, m: { minlength: 2 } } });
    assert.equal(validator.form(), false);
    assert.equal(validator.numberOfInvalids(), 3);
    $('#s').val('1');
    $('[name=r]').eq(1).prop('checked', true);
    $('[name=c]').eq(0).prop('checked', true);
    assert.equal(validator.form(), false, 'one checkbox is too few');
    $('[name=c]').eq(1).prop('checked', true);
    $('#m option').eq(0).prop('selected', true);
    assert.equal(validator.form(), false, 'multi-select needs 2');
    $('#m option').eq(1).prop('selected', true);
    assert.equal(validator.form(), true);
    $('[name=c]').eq(2).prop('checked', true);
    assert.equal(validator.form(), false, 'three boxes is too many');
});

// ================================================================ rule sources
test('class rules, HTML attributes and data-rule-* all feed the rules', () => {
    const { $form, validator } = mount(`
        <input name="a" id="a" class="required email">
        <input name="b" id="b" required minlength="3" maxlength="5">
        <input name="c" id="c" type="email">
        <input name="d" id="d" type="number" min="5" max="9">
        <input name="e" id="e" data-rule-required="true" data-rule-minlength="4" data-rule-email="true">
        <input name="f" id="f" pattern="[A-Z]+">`, {});
    assert.deepEqual(Object.keys($('#a').rules()).sort(), ['email', 'required']);
    assert.deepEqual($('#b').rules(), { required: true, minlength: 3, maxlength: 5 });
    assert.ok($('#c').rules().email);
    assert.deepEqual([$('#d').rules().min, $('#d').rules().max], [5, 9]);
    assert.deepEqual($('#e').rules().minlength, 4);
    assert.equal($('#f').rules().pattern, '[A-Z]+');
    assert.equal(validator.form(), false);
    $('#a').val('a@b.co'); $('#b').val('abcd'); $('#c').val('c@d.co'); $('#d').val('7'); $('#e').val('long@mail.co'); $('#f').val('ABC');
    assert.equal(validator.form(), true);
    $('#f').val('abc');
    assert.equal($('#f').valid(), false);
});

test('maxlength="-1" style defaults are ignored', () => {
    mount('<input name="a" id="a" maxlength="524288">', {});
    assert.equal($('#a').rules().maxlength, undefined);
});

test('required is always first and remote last; aria-required is set', () => {
    mount('<input name="a" id="a">', { rules: { a: { remote: '/x', email: true, required: true } } });
    assert.deepEqual(Object.keys($('#a').rules()), ['required', 'email', 'remote']);
    assert.equal($('#a').attr('aria-required'), 'true');
});

test('depends: selector, function, and required as selector/function', () => {
    const { validator } = mount('<input type="checkbox" id="chk"><input name="a" id="a"><input name="b" id="b"><input name="c" id="c">', {
        rules: {
            a: { required: '#chk:checked' },
            b: { minlength: { param: 5, depends: () => $('#chk').is(':checked') } },
            c: { required: () => $('#chk').is(':checked') }
        }
    });
    assert.equal(validator.form(), true, 'nothing depends yet');
    $('#chk').prop('checked', true);
    assert.equal(validator.form(), false);
    $('#a').val('x'); $('#c').val('y');
    assert.equal(validator.form(), true, 'b is empty, so minlength does not apply');
    $('#b').val('abc');
    assert.equal(validator.form(), false);
    $('#b').val('abcde');
    assert.equal(validator.form(), true);
});

test('normalizer runs before the methods', () => {
    const { validator } = mount('<input name="a" id="a">', { rules: { a: { required: true, minlength: 3, normalizer: v => v.replace(/-/g, '') } } });
    $('#a').val('a-b');
    assert.equal(validator.form(), false, '"a-b" normalises to "ab", 2 characters');
    $('#a').val('a-b-c');
    assert.equal(validator.form(), true);
});

// ================================================================ messages
test('default messages, {0} placeholders, and $.validator.messages overrides', () => {
    const { $form, validator } = mount('<input name="a" id="a" value="x"><input name="b" id="b" value="99"><input name="c" id="c" value="z">', {
        rules: { a: { minlength: 3 }, b: { range: [1, 10] }, c: { rangelength: [2, 3] } }
    });
    validator.form();
    assert.deepEqual(errorsOf($form[0]), ['Please enter at least 3 characters.', 'Please enter a value between 1 and 10.', 'Please enter a value between 2 and 3 characters long.']);
    const saved = $.validator.messages.required;
    $.extend($.validator.messages, { required: 'Pflichtfeld' });
    const m = mount('<input name="a">', { rules: { a: 'required' } });
    m.validator.form();
    assert.equal(errorsOf(m.form)[0], 'Pflichtfeld');
    $.validator.messages.required = saved;
});

test('per-field messages: string, per-method object, function; data-msg; title; ignoreTitle', () => {
    const { $form, validator } = mount(`<input name="a" id="a"><input name="b" id="b" value="x"><input name="c" id="c"><input name="d" id="d" data-msg-required="From data-msg-required">
        <input name="e" id="e" data-msg="Generic data-msg"><input name="f" id="f" title="From title">`, {
        rules: { a: 'required', b: { minlength: 3, email: true }, c: { required: true }, d: 'required', e: 'required', f: 'required' },
        messages: { a: 'Whole-field message', b: { minlength: $.validator.format('Need {0} chars ({0})!') }, c: { required: () => 'A function message' } }
    });
    validator.form();
    assert.deepEqual(errorsOf($form[0]), ['Whole-field message', 'Need 3 chars (3)!', 'A function message', 'From data-msg-required', 'Generic data-msg', 'From title']);
    const m = mount('<input name="f" title="From title">', { rules: { f: 'required' }, ignoreTitle: true });
    m.validator.form();
    assert.equal(errorsOf(m.form)[0], 'This field is required.');
});

test('label errors reference their field and use the configured element and class', () => {
    const { $form, validator } = mount('<input name="a" id="a">', { rules: { a: 'required' } });
    validator.form();
    const $err = $form.find('label.error');
    assert.equal($err.length, 1);
    assert.equal($err.attr('for'), 'a');
    assert.ok($('#a').hasClass('error'));
    $('#a').val('x');
    validator.form();
    assert.equal($form.find('label.error').length, 0);
    assert.ok(!$('#a').hasClass('error'));
    assert.ok($('#a').hasClass('valid'));
    const m = mount('<input name="a" id="a2">', { rules: { a: 'required' }, errorElement: 'span', errorClass: 'bad', validClass: 'good' });
    m.validator.form();
    assert.equal($('span.bad', m.form).length, 1);
    assert.ok($('#a2').hasClass('bad'));
});

// ================================================================ methods, class rules, defaults
test('addMethod: this.optional, message, class rule (arity < 3), params', () => {
    $.validator.addMethod('even', function (value, element, param) { return this.optional(element) || value % 2 === 0; }, 'Even numbers only');
    $.validator.addMethod('multipleOf', function (value, element, param) { return this.optional(element) || value % param === 0; }, $.validator.format('Multiples of {0} only'));
    $.validator.addMethod('alwaysRuns', function (value) { return value === 'ok'; }, 'Must be ok');
    let m = mount('<input name="a" id="a"><input name="b" id="b"><input name="c" id="c" class="alwaysRuns" value="ok">', { rules: { a: { even: true }, b: { multipleOf: 3 } } });
    assert.equal(m.validator.form(), true, 'optional empty fields pass');
    $('#a').val('3'); $('#b').val('4');
    assert.equal(m.validator.form(), false);
    assert.deepEqual(errorsOf(m.form), ['Even numbers only', 'Multiples of 3 only']);
    $('#a').val('4'); $('#b').val('9');
    assert.equal(m.validator.form(), true);
    $('#c').val('nope');
    assert.equal(m.validator.form(), false, 'a 2-argument method becomes a class rule and also runs on empty values by itself');
});

test('addClassRules and classRuleSettings', () => {
    $.validator.addClassRules('zip', { required: true, digits: true, minlength: 5, maxlength: 5 });
    const { validator } = mount('<input name="z" id="z" class="zip">', {});
    assert.equal(validator.form(), false);
    $('#z').val('1234');
    assert.equal(validator.form(), false);
    $('#z').val('12345');
    assert.equal(validator.form(), true);
    $.validator.addClassRules({ upper: { pattern: '[A-Z]+' } });
    assert.ok($.validator.classRuleSettings.upper);
});

test('setDefaults applies to validators created afterwards', () => {
    $.validator.setDefaults({ errorClass: 'oops' });
    try {
        const { validator, $form } = mount('<input name="a">', { rules: { a: 'required' } });
        validator.form();
        assert.equal($form.find('label.oops').length, 1);
    } finally { $.validator.setDefaults({ errorClass: 'error' }); }
});

// ================================================================ rules() API
test('rules("add"), rules("remove") and their messages', () => {
    const { validator, $form } = mount('<input name="a" id="a" value="x">', {});
    assert.equal(validator.form(), true);
    $('#a').rules('add', { minlength: 3, messages: { minlength: 'Way too short' } });
    assert.equal($('#a').valid(), false);
    assert.equal(errorsOf($form[0])[0], 'Way too short');
    const removed = $('#a').rules('remove', 'minlength');
    assert.equal(removed.minlength, 3);
    assert.equal($('#a').valid(), true);
    $('#a').rules('add', 'required email');
    assert.deepEqual(Object.keys($('#a').rules()).sort(), ['email', 'required']);
    $('#a').rules('remove');
    assert.deepEqual($('#a').rules(), {});
});

// ================================================================ callbacks
test('errorPlacement gets jQuery objects', () => {
    const seen = [];
    const { validator, $form } = mount('<div id="wrap"><input name="a" id="a"></div><div id="slot"></div>', {
        rules: { a: 'required' },
        errorPlacement: function (error, element) { seen.push([error.jquery ? 'jq' : 'raw', element.jquery ? 'jq' : 'raw', element.attr('name')]); error.appendTo('#slot'); }
    });
    validator.form();
    assert.deepEqual(seen, [['jq', 'jq', 'a']]);
    assert.equal($('#slot label.error').length, 1);
});

test('highlight / unhighlight / success', () => {
    const log = [];
    const { validator, $form } = mount('<input name="a" id="a"><input name="b" id="b" value="ok">', {
        rules: { a: 'required', b: 'required' },
        highlight: function (el, errorClass, validClass) { log.push(['hl', el.name, errorClass, validClass]); $(el).addClass('hot'); },
        unhighlight: function (el, errorClass, validClass) { log.push(['un', el.name]); $(el).removeClass('hot'); },
        success: function (label, element) { label.text('OK ' + element.name).addClass('yay'); }
    });
    validator.form();
    assert.ok($('#a').hasClass('hot'));
    assert.ok(log.some(l => l[0] === 'hl' && l[1] === 'a' && l[2] === 'error' && l[3] === 'valid'));
    assert.equal($('label.yay').text(), 'OK b');
    $('#a').val('now');
    validator.form();
    assert.ok(!$('#a').hasClass('hot'));
    assert.equal($('label.yay').length, 2);

    const m = mount('<input name="a" id="a" value="x">', { rules: { a: 'required' }, success: 'fine' });
    m.validator.form();
    assert.equal($('label.valid.fine').length, 1);
});

test('submitHandler / invalidHandler / onsubmit / debug / cancel / formnovalidate', async () => {
    const calls = { submit: 0, invalid: 0, args: null };
    let m = mount('<input name="a" id="a">', {
        rules: { a: 'required' },
        submitHandler: function (form, event) { calls.submit++; calls.args = [form, event && event.type, this === $(form).data('validator')]; },
        invalidHandler: function (event, validator) { calls.invalid++; calls.event = event.type; calls.validator = validator; }
    });
    await submit(m.form, $('#go')[0]);
    assert.deepEqual([calls.submit, calls.invalid, calls.event], [0, 1, 'invalid-form']);
    assert.equal(calls.validator, m.validator);
    $('#a').val('x');
    await submit(m.form, $('#go')[0]);
    assert.equal(calls.submit, 1);
    assert.equal(calls.args[0], m.form);
    assert.equal(calls.args[1], 'submit');
    assert.equal(calls.args[2], true, 'this is the validator');
    assert.equal(m.form.native, 0, 'submitHandler replaces the native submit');

    // no submitHandler: native submit happens after a valid form
    m = mount('<input name="a" id="a" value="x">', { rules: { a: 'required' } });
    await submit(m.form);
    assert.equal(m.form.native, 1);

    // cancel class and formnovalidate skip validation
    m = mount('<input name="a" id="a"><button id="nv" formnovalidate>x</button>', { rules: { a: 'required' } });
    await submit(m.form, $('#cancel')[0]);
    assert.equal(errorsOf(m.form).length, 0);
    await submit(m.form, $('#nv')[0]);
    assert.equal(errorsOf(m.form).length, 0);

    // onsubmit: false leaves the submit event alone
    m = mount('<input name="a" id="a">', { rules: { a: 'required' }, onsubmit: false });
    await submit(m.form);
    assert.equal(errorsOf(m.form).length, 0);

    // debug: never submits
    const log = console.log; console.log = () => {};
    try {
        m = mount('<input name="a" id="a" value="x">', { rules: { a: 'required' }, debug: true });
        await submit(m.form);
        assert.equal(m.form.native, 0);
    } finally { console.log = log; }
});

test('submit button name/value is available inside submitHandler', async () => {
    let seen;
    const m = mount('<input name="a" value="x"><button type="submit" name="action" value="save" id="save">save</button>', {
        rules: { a: 'required' }, submitHandler: form => { seen = $(form).serialize(); }
    });
    await submit(m.form, $('#save')[0]);
    assert.match(seen, /action=save/);
    assert.equal($(m.form).find('input[name=action]').length, 0, 'hidden helper is removed afterwards');
});

// ================================================================ validator object
test('validator API: form, element, errorList, errorMap, size, invalidElements, validElements, showErrors, resetForm, destroy, elements', () => {
    const { $form, form, validator } = mount('<input name="a" id="a"><input name="b" id="b" value="ok"><input name="untracked" id="u">', { rules: { a: 'required', b: 'required' } });
    assert.equal(validator.elements().length, 2);
    assert.equal(validator.form(), false);
    assert.equal(validator.size(), 1);
    assert.equal(validator.numberOfInvalids(), 1);
    assert.equal(validator.valid(), false);
    assert.equal(validator.errorList.length, 1);
    assert.equal(validator.errorList[0].element, $('#a')[0]);
    assert.equal(validator.errorList[0].message, 'This field is required.');
    assert.deepEqual(validator.errorMap, { a: 'This field is required.' });
    assert.equal(validator.invalidElements().length, 1);
    assert.equal(validator.validElements().length, 1);
    assert.equal(validator.element('#a'), false);
    $('#a').val('x');
    assert.equal(validator.element('#a'), true);
    assert.equal(validator.valid(), true);

    validator.showErrors({ b: 'Server says no' });
    assert.equal(errorsOf(form)[0], 'Server says no');
    validator.resetForm();
    assert.equal(errorsOf(form).length, 0);
    assert.ok(!$('#b').hasClass('error'));

    validator.form();
    validator.destroy();
    assert.equal($form.data('validator'), undefined);
    assert.equal(errorsOf(form).length, 0);
});

test('$.fn.valid on a single field, several fields, and the form', () => {
    const { $form } = mount('<input name="a" id="a" class="required"><input name="b" id="b" class="required" value="x">', {});
    assert.equal($('#a').valid(), false);
    assert.equal($('#b').valid(), true);
    assert.equal($('#a, #b').valid(), false);
    assert.equal($form.valid(), false);
    $('#a').val('x');
    assert.equal($form.valid(), true);
});

test('valid() is synchronous: focuses the first invalid field and fires invalid-form', () => {
    let fired = 0;
    const { $form, validator } = mount('<input name="a" id="a"><input name="b" id="b">', { rules: { a: 'required', b: 'required' } });
    $form.on('invalid-form', () => fired++);
    assert.equal($form.valid(), false);
    assert.equal(fired, 1);
    assert.equal(document.activeElement, $('#a')[0]);
    const m = mount('<input name="a" id="a">', { rules: { a: 'required' }, focusInvalid: false });
    document.activeElement && document.activeElement.blur();
    m.$form.valid();
    assert.notEqual(document.activeElement, $('#a')[0]);
});

// ================================================================ containers / wrapper / focusCleanup / ignore
test('errorLabelContainer + wrapper + errorContainer', () => {
    const { $form, validator } = mount('<div id="box" style="display:none"><ul id="list"></ul></div><input name="a" id="a"><input name="b" id="b">', {
        rules: { a: 'required', b: 'required' },
        errorContainer: '#box', errorLabelContainer: '#list', wrapper: 'li'
    });
    validator.settings.errorContainer = $('#box'); validator.settings.errorLabelContainer = $('#list');
    assert.equal(validator.form(), false);
    assert.equal($('#list li label.error').length, 2);
    assert.equal($('#box').css('display'), 'block');
    $('#a').val('x'); $('#b').val('y');
    assert.equal(validator.form(), true);
    assert.equal($('#list li').length, 0, 'wrappers are cleaned up');
    assert.equal($('#box').css('display'), 'none');
});

test('focusCleanup removes the error on focus', () => {
    const { $form, validator } = mount('<input name="a" id="a">', { rules: { a: 'required' }, focusCleanup: true, focusInvalid: false }); // as in the original: do not combine with focusInvalid
    validator.form();
    assert.equal(errorsOf($form[0]).length, 1);
    fire($('#a')[0], 'focusin');
    assert.equal(errorsOf($form[0]).length, 0);
});

test('ignore: hidden fields skipped by default; ignore: [] validates them; custom selector', () => {
    const html = '<input name="a" id="a"><div style="display:none"><input name="h" id="h"></div><input name="i" id="i" class="skip">';
    let m = mount(html, { rules: { a: 'required', h: 'required', i: 'required' }, ignore: '.skip, :hidden' });
    m.validator.form();
    assert.deepEqual(m.validator.invalidElements().map(function () { return this.name; }).get(), ['a']);
    m = mount(html, { rules: { a: 'required', h: 'required', i: 'required' }, ignore: [] });
    m.validator.form();
    assert.equal(m.validator.size(), 3);
    m = mount(html, { rules: { a: 'required', h: 'required', i: 'required' }, ignore: '.skip' });
    m.validator.form();
    assert.equal(m.validator.size(), 2);
    m = mount(html, { rules: { a: 'required', h: 'required', i: 'required' } });
    m.validator.form();
    assert.equal(m.validator.size(), 2);
});

// ================================================================ live events
test('onfocusout validates non-empty fields, leaves empty ones until submit; onkeyup re-checks invalid fields', async () => {
    const { $form, validator, form } = mount('<input name="a" id="a"><input name="b" id="b">', { rules: { a: { email: true, required: true }, b: 'required' } });
    fire($('#b')[0], 'focusout'); await settle();
    assert.equal(errorsOf(form).length, 0, 'empty and untouched: no error yet');
    $('#a').val('nope'); fire($('#a')[0], 'focusout'); await settle();
    assert.equal(errorsOf(form).length, 1);
    $('#a').val('a@b.co'); fire($('#a')[0], 'input'); await settle();
    assert.equal(errorsOf(form).length, 0, 'keyup fixes the error');
    fire($('#b')[0], 'input'); await settle();
    assert.equal(errorsOf(form).length, 0);
    await submit(form);
    assert.equal(errorsOf(form).length, 1, 'after submit the empty required field is flagged');
    $('#b').val('x'); fire($('#b')[0], 'input'); await settle();
    assert.equal(errorsOf(form).length, 0);
    $('#b').val(''); fire($('#b')[0], 'input'); await settle();
    assert.equal(errorsOf(form).length, 1, 'after a submit attempt, every keystroke is checked');
});

test('onfocusout:false / onkeyup:false / onclick', async () => {
    let m = mount('<input name="a" id="a">', { rules: { a: 'email' }, onfocusout: false });
    $('#a').val('bad'); fire($('#a')[0], 'focusout'); await settle();
    assert.equal(errorsOf(m.form).length, 0);

    m = mount('<input name="a" id="a">', { rules: { a: 'email' }, onkeyup: false });
    await submit(m.form);
    $('#a').val('bad'); fire($('#a')[0], 'focusout'); await settle();
    assert.equal(errorsOf(m.form).length, 1);
    $('#a').val('a@b.co'); fire($('#a')[0], 'input'); await settle();
    assert.equal(errorsOf(m.form).length, 1, 'no live re-check while typing');

    m = mount('<input type="checkbox" name="c" id="c" value="1">', { rules: { c: 'required' } });
    await submit(m.form);
    assert.equal(errorsOf(m.form).length, 1);
    $('#c').prop('checked', true); fire($('#c')[0], 'change'); await settle();
    assert.equal(errorsOf(m.form).length, 0);
});

test('changing the equalTo target re-checks the dependent field', async () => {
    const { validator, form } = mount('<input id="pw" name="pw" value="one"><input id="pw2" name="pw2" value="one">', { rules: { pw2: { equalTo: '#pw' } } });
    $('#pw').val('two'); fire($('#pw')[0], 'change'); await settle();
    assert.equal(errorsOf(form).length, 1);
    $('#pw').val('one'); fire($('#pw')[0], 'change'); await settle();
    assert.equal(errorsOf(form).length, 0);
});

// ================================================================ remote
function mockFetch(handler) {
    const calls = [];
    globalThis.fetch = async (url, opts) => { calls.push({ url, opts }); return handler(url, opts); };
    return calls;
}
const json = body => ({ ok: true, status: 200, json: async () => body });

test('remote: GET by default with form-style query, valid()/form() answer synchronously and update when the server replies', async () => {
    const calls = mockFetch(() => json(false));
    const { validator, form } = mount('<input name="user" id="user" value="bob">', { rules: { user: { remote: '/check' } } });
    assert.equal($('#user').valid(), true, 'pending counts as valid, like the original');
    await settle(40);
    assert.equal(calls[0].url, '/check?user=bob');
    assert.equal(calls[0].opts.method, 'GET');
    assert.equal(errorsOf(form)[0], 'Please fix this field.', 'answer arrives later');
});

test('remote: POST form-encoded with data functions, server message and true response', async () => {
    let calls = mockFetch(() => json('Already taken'));
    const { validator, form } = mount('<input name="user" id="user" value="bob"><input id="tok" value="T1">', {
        rules: { user: { remote: { url: '/check', type: 'post', data: { token: () => $('#tok').val(), fixed: 'F' } } } }
    });
    await validator.fv.validate({ focus: false });
    assert.equal(calls[0].opts.method, 'POST');
    assert.match(calls[0].opts.headers['Content-Type'], /x-www-form-urlencoded/);
    const params = new URLSearchParams(calls[0].opts.body);
    assert.deepEqual([params.get('user'), params.get('token'), params.get('fixed')], ['bob', 'T1', 'F']);
    assert.equal(errorsOf(form)[0], 'Already taken');

    calls = mockFetch(() => json(true));
    const m = mount('<input name="user" id="user" value="bob">', { rules: { user: { remote: '/check' } } });
    assert.equal(await m.validator.fv.validate({ focus: false }), true);
});

test('remote: form submit waits for the server, and per-field remote message overrides the default', async () => {
    mockFetch(() => json(false));
    let submitted = 0;
    const m = mount('<input name="user" id="user" value="bob">', {
        rules: { user: { remote: '/check' } }, messages: { user: { remote: 'Sorry, taken' } },
        submitHandler: () => { submitted++; }
    });
    await submit(m.form, $('#go')[0]);
    assert.equal(submitted, 0);
    assert.equal(errorsOf(m.form)[0], 'Sorry, taken');
    mockFetch(() => json(true));
    $('#user').val('alice');
    await submit(m.form, $('#go')[0]);
    assert.equal(submitted, 1);
});

test('remote is skipped for empty fields', async () => {
    const calls = mockFetch(() => json(false));
    const m = mount('<input name="user" id="user">', { rules: { user: { remote: '/check' } } });
    assert.equal($('#user').valid(), true);
    await settle(30);
    assert.equal(calls.length, 0);
});

// ================================================================ interop
test('whitespace-only counts as empty for required, text is trimmed (trim:false restores the original)', () => {
    let m = mount('<input name="a" id="a" value="   ">', { rules: { a: 'required' } });
    assert.equal(m.validator.form(), false);
    m = mount('<input name="a" id="a" value="  ab  ">', { rules: { a: { minlength: 5 } } });
    assert.equal(m.validator.form(), false);
    m = mount('<input name="a" id="a" value="  ab  ">', { rules: { a: { minlength: 5 } }, trim: false });
    assert.equal(m.validator.form(), true);
});

test('fields added after validate() are picked up, removed fields are ignored', async () => {
    const { validator, form } = mount('<input name="a" id="a" value="x"><div id="slot"></div>', { rules: { a: 'required', late: 'required' } });
    assert.equal(validator.form(), true);
    $('#slot').append('<input name="late" id="late">');
    assert.equal(validator.form(), false);
    $('#late').remove();
    assert.equal(validator.form(), true);
});

test('the modern engine underneath is reachable: accessible errors and events', () => {
    const { validator, form } = mount('<input name="a" id="a">', { rules: { a: 'required' } });
    let ev = 0;
    form.addEventListener('fv:invalid', () => ev++);
    validator.form();
    assert.equal(ev, 1);
    assert.equal($('#a').attr('aria-invalid'), 'true');
    assert.ok($('#a').attr('aria-describedby'));
    assert.equal($('label.error').attr('role'), undefined, 'role=alert is not allowed on <label>');
    assert.equal($('label.error').attr('aria-live'), 'polite');
});

// ================================================================ FileValidator inside jQuery Validation
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const png = (name = 'a.png') => new File([new Uint8Array(PNG_BYTES)], name, { type: 'image/png' });
const exe = (name = 'run.exe') => new File([new Uint8Array([1, 2, 3, 4])], name, { type: '' });
const setFiles = (el, files) => Object.defineProperty(el, 'files', { value: files, configurable: true });

test('fileValidator is a registered method with a default message', () => {
    assert.equal(typeof $.validator.methods.fileValidator, 'function');
    assert.equal($.validator.messages.fileValidator, 'Please choose a valid file.');
});

test('fileValidator: accepts good files, rejects bad ones with FileValidator\'s own message', async () => {
    const { validator, form } = mount('<input type="file" name="f" id="f">', { rules: { f: { fileValidator: { accept: '.png,.jpg', maxFileSizeMB: 1 } } } });
    setFiles($('#f')[0], [png()]);
    assert.equal(await validator.fv.validate({ focus: false }), true);
    assert.equal(errorsOf(form).length, 0);
    setFiles($('#f')[0], [exe()]);
    assert.equal(await validator.fv.validate({ focus: false }), false);
    assert.match(errorsOf(form)[0], /security|isn't allowed/i);
});

test('fileValidator: valid() is synchronous, the answer arrives afterwards', async () => {
    const { validator, form } = mount('<input type="file" name="f" id="f">', { rules: { f: { fileValidator: { accept: '.png' } } } });
    setFiles($('#f')[0], [exe()]);
    assert.equal($('#f').valid(), true, 'pending counts as valid, as with remote');
    await settle(60);
    assert.equal(errorsOf(form).length, 1);
    assert.equal($('#f').valid(), true, 'second sync call still pending, never throws');
});

test('fileValidator: empty selection is optional, and required makes it mandatory', async () => {
    const m = mount('<input type="file" name="f" id="f">', { rules: { f: { fileValidator: { accept: '.png' } } } });
    setFiles($('#f')[0], []);
    assert.equal(await m.validator.fv.validate({ focus: false }), true);
    const r = mount('<input type="file" name="f" id="f">', { rules: { f: { required: true, fileValidator: { accept: '.png' } } } });
    setFiles($('#f')[0], []);
    assert.equal(await r.validator.fv.validate({ focus: false }), false);
    assert.equal(errorsOf(r.form)[0], 'This field is required.');
});

test('fileValidator: per-field messages win over FileValidator\'s detailed message; data-msg too', async () => {
    let m = mount('<input type="file" name="f" id="f">', { rules: { f: { fileValidator: { accept: '.png' } } }, messages: { f: { fileValidator: 'Only PNG please' } } });
    setFiles($('#f')[0], [exe()]);
    await m.validator.fv.validate({ focus: false });
    assert.equal(errorsOf(m.form)[0], 'Only PNG please');
    m = mount('<input type="file" name="f" id="f" data-msg-filevalidator="From data attribute" data-rule-filevalidator=\'{"accept":".png"}\'>', {});
    setFiles($('#f')[0], [exe()]);
    await m.validator.fv.validate({ focus: false });
    assert.equal(errorsOf(m.form)[0], 'From data attribute');
});

test('fileValidator: configured from data-rule-filevalidator (JSON) and via rules("add")', async () => {
    let m = mount('<input type="file" name="f" id="f" data-rule-filevalidator=\'{"maxFileSize": 2}\'>', {});
    setFiles($('#f')[0], [new File([new Uint8Array([97, 97, 97, 97, 97])], 'a.txt', { type: 'text/plain' })]);
    assert.equal(await m.validator.fv.validate({ focus: false }), false);
    assert.match(errorsOf(m.form)[0], /maximum/);
    m = mount('<input type="file" name="f" id="f">', {});
    $('#f').rules('add', { fileValidator: { accept: '.png' }, messages: { fileValidator: 'Added rule message' } });
    setFiles($('#f')[0], [exe()]);
    assert.equal(await m.validator.fv.validate({ focus: false }), false);
    assert.equal(errorsOf(m.form)[0], 'Added rule message');
});

test('fileValidator: several files name the offending file; validates on change; blocks the submit', async () => {
    let submitted = 0;
    const { validator, form } = mount('<input type="file" name="f" id="f" multiple>', {
        rules: { f: { fileValidator: { accept: '.png' } } }, submitHandler: () => { submitted++; }
    });
    setFiles($('#f')[0], [png('ok.png'), exe('bad.exe')]);
    fire($('#f')[0], 'change'); await settle(60);
    assert.match(errorsOf(form)[0], /^bad\.exe: /);
    await submit(form, $('#go')[0]);
    assert.equal(submitted, 0);
    setFiles($('#f')[0], [png('ok.png')]);
    fire($('#f')[0], 'change'); await settle(60);
    assert.equal(errorsOf(form).length, 0);
    await submit(form, $('#go')[0]);
    assert.equal(submitted, 1);
});

test('fileValidator options that need the DOM (image size) can use a custom reader', async () => {
    const { validator, form } = mount('<input type="file" name="f" id="f">', {
        rules: { f: { fileValidator: { accept: '.png', maxImageWidth: 100, readImageSize: async () => ({ width: 500, height: 500 }) } } }
    });
    setFiles($('#f')[0], [png()]);
    assert.equal(await validator.fv.validate({ focus: false }), false);
    assert.match(errorsOf(form)[0], /500px wide/);
});

// ================================================================ pending class and the new FileValidator options inside jQuery Validation
test('remote: the "pending" class is set while the request runs and removed afterwards', async () => {
    mockFetch(async () => { await settle(40); return json(true); });
    const { validator } = mount('<input name="user" id="user" value="bob">', { rules: { user: { remote: '/c' } } });
    const p = validator.fv.validate({ focus: false });
    await settle(10);
    assert.ok($('#user').hasClass('pending'));
    await p;
    assert.ok(!$('#user').hasClass('pending'));
    const m = mount('<input name="user" id="user" value="bob">', { rules: { user: { remote: '/c' } }, pendingClass: 'checking' });
    const p2 = m.validator.fv.validate({ focus: false });
    await settle(10);
    assert.ok($('#user').hasClass('checking'));
    await p2;
});

test('fileValidator method: registered methods, custom checks, remote and duplicate content all work through it', async () => {
    FileValidator.addMethod('noSpaces', f => !f.name.includes(' '), 'No spaces in file names');
    let m = mount('<input type="file" name="f" id="f" multiple>', { rules: { f: { fileValidator: { methods: { noSpaces: true } } } } });
    setFiles($('#f')[0], [png('a b.png')]);
    assert.equal(await m.validator.fv.validate({ focus: false }), false);
    assert.equal(errorsOf(m.form)[0], 'No spaces in file names');

    mockFetch(() => json('Already uploaded'));
    m = mount('<input type="file" name="f" id="f">', { rules: { f: { fileValidator: { remote: '/exists' } } } });
    setFiles($('#f')[0], [png('fresh1.png')]);
    assert.equal(await m.validator.fv.validate({ focus: false }), false);
    assert.equal(errorsOf(m.form)[0], 'Already uploaded');

    m = mount('<input type="file" name="f" id="f" multiple>', { rules: { f: { fileValidator: { duplicateContent: true } } } });
    setFiles($('#f')[0], [png('one.png'), png('two.png')]);
    assert.equal(await m.validator.fv.validate({ focus: false }), false);
    assert.match(errorsOf(m.form)[0], /identical content/);
});

// ================================================================ groups and the showErrors option
test('groups: one visible message per group; the next one shows when the first is fixed', async () => {
    const { validator, form } = mount('<input name="fname" id="fname"><input name="lname" id="lname"><input name="other" id="other">', {
        rules: { fname: 'required', lname: 'required', other: 'required' },
        groups: { username: 'fname lname' }
    });
    assert.equal(validator.form(), false);
    const labels = $(form).find('label.error').toArray();
    assert.equal(labels.length, 3, 'all three fields are invalid');
    const visible = labels.filter(l => !l.hidden).map(l => l.getAttribute('for'));
    assert.deepEqual(visible, ['fname', 'other'], 'lname belongs to the group of fname and is hidden');
    assert.equal(validator.numberOfInvalids(), 3);
    $('#fname').val('x');
    validator.element('#fname');
    assert.deepEqual($(form).find('label.error').toArray().filter(l => !l.hidden).map(l => l.getAttribute('for')), ['lname', 'other'], 'the second one takes over');
    $('#lname').val('y'); $('#other').val('z');
    assert.equal(validator.form(), true);
    assert.equal($(form).find('label.error').length, 0);
});

test('groups also work with the live events (blur/typing after a submit)', async () => {
    const { validator, form } = mount('<input name="a" id="a"><input name="b" id="b">', { rules: { a: 'required', b: 'required' }, groups: { both: 'a b' } });
    await submit(form);
    assert.deepEqual($(form).find('label.error').toArray().map(l => l.hidden), [false, true]);
    $('#a').val('x'); fire($('#a')[0], 'input'); await settle();
    assert.deepEqual($(form).find('label.error').toArray().map(l => [l.getAttribute('for'), l.hidden]), [['b', false]]);
});

test('showErrors option: called with (errorMap, errorList) and `this` = validator; nothing is rendered until defaultShowErrors()', async () => {
    const calls = [];
    const { validator, form } = mount('<input name="a" id="a"><input name="b" id="b" value="ok"><div id="summary"></div>', {
        rules: { a: 'required', b: 'required' },
        showErrors: function (errorMap, errorList) {
            calls.push({ self: this === validator, map: errorMap, list: errorList.map(e => [e.element.name, e.message]) });
            $('#summary').text(errorList.length + ' problem(s): ' + errorList.map(e => e.message).join(' | '));
        }
    });
    assert.equal(validator.form(), false);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { self: true, map: { a: 'This field is required.' }, list: [['a', 'This field is required.']] });
    assert.equal($('#summary').text(), '1 problem(s): This field is required.');
    assert.equal($(form).find('label.error').length, 0, 'no label is placed in the page');
    assert.ok($('#a').hasClass('error'), 'highlight still works');
    $('#a').val('x');
    assert.equal(validator.element('#a'), true);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].map, {});
    assert.equal($('#summary').text(), '0 problem(s): ');
});

test('showErrors + this.defaultShowErrors() renders the normal labels (the way the original documents it)', async () => {
    const seen = [];
    const { validator, form } = mount('<input name="a" id="a"><input name="b" id="b">', {
        rules: { a: 'required', b: 'required' },
        showErrors: function (errorMap, errorList) { seen.push(Object.keys(errorMap)); this.defaultShowErrors(); }
    });
    validator.form();
    assert.deepEqual(seen, [['a', 'b']]);
    assert.deepEqual($(form).find('label.error').toArray().map(l => l.getAttribute('for')), ['a', 'b']);
    assert.equal($('#a').next()[0], $(form).find('label.error')[0], 'placed right after the field');
});

test('showErrors is also called for live validation (submit, blur, typing), once per tick', async () => {
    let n = 0; const maps = [];
    const { validator, form } = mount('<input name="a" id="a"><input name="b" id="b">', {
        rules: { a: 'required', b: 'required' },
        showErrors: function (map) { n++; maps.push(Object.keys(map).join(',')); }
    });
    await submit(form);
    assert.equal(n, 1, 'two invalid fields, one call');
    assert.equal(maps[0], 'a,b');
    $('#a').val('x'); fire($('#a')[0], 'input'); await settle();
    assert.equal(maps[maps.length - 1], 'b');
});

test('showErrors with errorPlacement: defaultShowErrors() uses your placement', async () => {
    const { validator } = mount('<input name="a" id="a"><div id="slot"></div>', {
        rules: { a: 'required' },
        errorPlacement: function (error, element) { error.appendTo('#slot'); },
        showErrors: function () { this.defaultShowErrors(); }
    });
    validator.form();
    assert.equal($('#slot label.error').length, 1);
});
