'use strict';
// FormValidator.parseFormData(): flat form fields -> the nested object a schema expects.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { FormValidator } = require('../dist/validator.js');

const parse = (entries, o) => FormValidator.parseFormData(entries, o);

test('dots and brackets make nested objects and arrays', () => {
    assert.deepEqual(parse([['user.email', 'a@b.co'], ['user.name.first', 'Ann'], ['items[0].qty', '2'], ['items[0].sku', 'x'], ['items[1].qty', '5']]),
        { user: { email: 'a@b.co', name: { first: 'Ann' } }, items: [{ qty: '2', sku: 'x' }, { qty: '5' }] });
    assert.deepEqual(parse([['a[b][c]', '1'], ['tags[]', 'x'], ['tags[]', 'y']]), { a: { b: { c: '1' } }, tags: ['x', 'y'] });
    assert.deepEqual(parse([['rows[].n', '1'], ['rows[].n', '2']]), { rows: [{ n: '1' }, { n: '2' }] });
});

test('the same name twice (checkbox group, multi-select) becomes an array', () => {
    assert.deepEqual(parse([['color', 'red'], ['color', 'blue'], ['color', 'green'], ['one', 'x']]), { color: ['red', 'blue', 'green'], one: 'x' });
});

test('accepts FormData, URLSearchParams and plain objects', () => {
    const fd = new FormData(); fd.append('a.b', '1'); fd.append('a.c', '2');
    assert.deepEqual(parse(fd), { a: { b: '1', c: '2' } });
    assert.deepEqual(parse(new URLSearchParams('x[0]=1&x[1]=2&y=z')), { x: ['1', '2'], y: 'z' });
    assert.deepEqual(parse({ 'a.b': 1, c: 2 }), { a: { b: 1 }, c: 2 });
    assert.deepEqual(parse(null), {});
});

test('File values pass through untouched', () => {
    const f = new File(['x'], 'a.txt');
    assert.equal(parse([['docs[0].file', f]]).docs[0].file, f);
});

test('coerce turns numbers and booleans into real ones but keeps text such as zip codes', () => {
    assert.deepEqual(parse([['n', '42'], ['f', '3.5'], ['neg', '-7'], ['t', 'true'], ['no', 'false'], ['zip', '01234'], ['phone', '+4915'], ['empty', ''], ['big', '12345678901234567890']], { coerce: true }),
        { n: 42, f: 3.5, neg: -7, t: true, no: false, zip: '01234', phone: '+4915', empty: '', big: '12345678901234567890' });
    assert.deepEqual(parse([['n', '42']]), { n: '42' });
});

test('hostile keys cannot pollute prototypes or allocate huge arrays', () => {
    const out = parse([['__proto__.polluted', 'yes'], ['constructor.prototype.x', '1'], ['a.__proto__.y', '1'], ['a[__proto__][z]', '1'], ['items[100000]', 'x'], ['ok', '1']]);
    assert.deepEqual(out, { ok: '1' });
    assert.equal({}.polluted, undefined);
    assert.equal({}.x, undefined);
    assert.deepEqual(parse([['[0]', 'x'], ['a]b', 'x'], ['a..b', 'x'], ['', 'x'], ['a[', 'x'], ['.a', 'x']]), {});
    assert.deepEqual(parse([[Array(30).fill('a').join('.'), 'x']]), {});
});

test('a later nested key replaces an earlier plain value instead of crashing', () => {
    assert.deepEqual(parse([['a', 'x'], ['a.b', 'y']]), { a: { b: 'y' } });
    assert.deepEqual(parse([['a.b', 'y'], ['a', 'x']]), { a: [{ b: 'y' }, 'x'] });
});

test('works together with schema()', () => {
    const s = FormValidator.schema({ email: ['required', 'email'] });
    const r = s.safeParse(parse([['email', 'a@b.co']]));
    assert.equal(r.success, true);
});
