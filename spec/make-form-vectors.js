'use strict';
/*
 * Builds spec/form-rules.vectors.json: language-neutral conformance vectors for the FormValidator rules.
 * Every implementation (browser, Node, Angular, .NET) must give the same valid / failedRule for each case.
 * The expected results are written by hand here (from the documented behaviour), not generated from the code,
 * so a disagreement means a bug or a decision to make. Run:  node spec/make-form-vectors.js
 */
const fs = require('fs');
const path = require('path');
const C = [];
const add = (rule, pass, fail, extra) => {
    pass.forEach(v => C.push(Object.assign({ rule, value: v, valid: true }, extra)));
    fail.forEach(v => C.push(Object.assign({ rule, value: v, valid: false }, extra)));
};

// blank values skip every rule except required
add({ type: 'required' }, ['a', '0', 'é', '😀'], ['', '   ', '\t\n']);
add({ type: 'email' }, ['', 'a@b.co', 'first.last+tag@sub.example.org', 'ü@bücher.de', 'a@b.museum', 'x@y.zz', '  a@b.co  '], ['a@b', 'a b@c.de', '@b.co', 'a@@b.co', 'a@b.c', 'plain', 'a@b .co']);
add({ type: 'url' }, ['https://example.com', 'http://example.com/a?b=c#d', 'www.example.com/x', 'example.com', 'https://sub.example.co.uk:8080/p'], ['ftp://x.com', 'not a url', 'http://', 'http://exa mple.com', 'https://.com', 'javascript:alert(1)']);
const BS = String.fromCharCode(92);   // a backslash, written this way so no tool can mangle it
add({ type: 'url' }, ['https://user:pw@example.com', 'http://example.com:65535', 'http://example.com:', 'http://example.com:0080', 'http://EXAMPLE.com', 'HTTP://example.com',
    'https://例え.jp', 'https://xn--r8jz45g.jp', 'http://a_b.com', 'http://ex%41mple.com', 'http://example..com', 'https://example.com' + BS + 'path',
    'http://1.2.3.4', 'http://0x7f.0.0.1', 'http://3232235777', 'http://1.2.3', 'http://0xffffffff', 'http://[::1]'.replace('[::1]', 'example.org'), 'https://a.b/c?d=e#f'],
  ['http://example.com:65536', 'http://example.com:abc', 'http://example.com:-1', 'http://example.com.', 'http://.example.com', 'http://exa<mple.com', 'http://exa|mple.com', 'http://exa%20mple.com',
    'http://256.1.1.1', 'http://999.1.1.1', 'http://1.2.3.4.5', 'http://0x100000000', 'http://example.123', 'http://08.1.1.1', 'http://-', 'https://', 'http://:80',
    'http://[::1]', 'http://exa mple.com', 'https:/example.com', 'http//example.com']);
add({ type: 'url', allowLocal: true }, ['http://localhost:3000', 'http://intranet', 'http://intranet:3000/x', 'http://[::1]', 'http://[::1]:8080', 'http://[2001:db8::1]/p', 'http://.com', 'http://[::]', 'http://[::ffff:1.2.3.4]', 'http://[1:2:3:4:5:6:7:8]', 'http://[1::]', 'http://[::1]/path?q=1'],
  ['http://[::1', 'http://[zz]', 'http://[::1]x', 'http://:80', 'http://[1:2:3:4:5:6:7:8:9]', 'http://[:::1]', 'http://[1::2::3]', 'http://[12345::1]', 'http://[fe80::1%25eth0]', 'http://[::1.2.3.256]', 'http://[]']);
add({ type: 'url', protocols: ['ftp:', 'http:'] }, ['ftp://files.example.com', 'http://example.com'], ['https://example.com', 'sftp://files.example.com']);
add({ type: 'url', requireProtocol: true }, ['https://example.com'], ['example.com', 'www.example.com']);
add({ type: 'number' }, ['1', '-1.5', '.5', '1e3', '+7', '0', '1.', '-0.0'], ['abc', '1,5', '1.2.3', '1 2', '--1', 'Infinity', '0x10', 'NaN', '１２']);
add({ type: 'digits' }, ['123', '0', '007'], ['-1', '1.5', '1 2', 'a1', '١٢٣']);
add({ type: 'alpha' }, ['abc', 'ÄÖÜ', 'Ünal', '日本語', 'مرحبا', 'Привет', 'ñ'], ['ab c', 'ab1', 'ab-c', "o'neil", '😀']);
add({ type: 'alphanumeric' }, ['abc123', 'Ünal7', '日本語2', 'مرحبا١'], ['ab c', 'a_b', 'a-b', '😀1']);
add({ type: 'phone' }, ['+1 (555) 123-4567', '555-1234', '+44 20 7946 0958', '(02) 1234 5678', '+8801712345678'], ['123', 'abc', '+', '12345', '+1234567890123456', '555-ABCD']);
add({ type: 'creditcard' }, ['4111111111111111', '4111 1111 1111 1111', '4111-1111-1111-1111', '5500005555555559', '378282246310005'], ['4111111111111112', '1234', 'abcdabcdabcdabcd', '41111111111111111111']);
add({ type: 'minlength', min: 3 }, ['abc', 'abcd', '日本語'], ['ab', '日本']);
add({ type: 'maxlength', max: 3 }, ['ab', 'abc'], ['abcd']);
add({ type: 'rangelength', min: 2, max: 4 }, ['ab', 'abcd'], ['a', 'abcde']);
add({ type: 'min', min: 5 }, ['5', '5.0', '10', '1e2'], ['4.99', '-1', 'abc']);
add({ type: 'max', max: 5 }, ['5', '-3', '4.99'], ['5.01', 'abc']);
add({ type: 'range', min: 1, max: 5 }, ['1', '3.5', '5'], ['0', '5.1', 'x']);
add({ type: 'step', step: 5 }, ['0', '5', '-10', '25'], ['3', '5.5', 'x']);
add({ type: 'step', step: 0.1 }, ['0.3', '0.7', '1.1'], ['0.35']);
add({ type: 'step', step: 5, base: 2 }, ['2', '7', '12'], ['5', '10']);
add({ type: 'oneOf', values: ['red', 'green', 'blue'] }, ['red', 'blue'], ['Red', 'yellow']);
add({ type: 'oneOf', values: [1, 2, 3] }, ['1', '3'], ['4', '01']);
add({ type: 'pattern', pattern: '^[A-Z]{2}\\d{3}$' }, ['AB123'], ['ab123', 'AB12', 'AB1234']);
add({ type: 'pattern', pattern: '^[a-z]+$', flags: 'i' }, ['abc', 'ABC'], ['ab1']);
add({ type: 'pwcheck', minLength: 8, requireUppercase: true, requireLowercase: true, requireDigit: true, requireSpecialChar: true, noWhitespace: true },
    ['Abcdef1!', 'Zz9$aaaaaa', 'Üpper1!aa'], ['Abcdef1', 'abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdef1! x', 'Ab1!']);
add({ type: 'pwcheck', minLength: 6 }, ['abcdef', 'a b c d'], ['abcde']);
add({ type: 'pwcheck', minLength: 6, maxLength: 10 }, ['abcdef', 'abcdefghij'], ['abcdefghijk']);

// whitespace is JavaScript's: tab, newline, no-break space, line/paragraph separator, BOM, all the Unicode space separators. NEL (U+0085) is NOT whitespace.
add({ type: 'required' }, ['\u0085', 'a b'], [' ', '\ufeff', ' 　', '\u2028', '   \ufeff ']);
add({ type: 'email' }, [], ['a @b.co', 'a@b .co', 'a@b.co\u0085x z']);
add({ type: 'phone' }, ['555 1234', '+49 151 2345 6789'], []);
add({ type: 'creditcard' }, ['4111 1111 1111 1111'], ['4111\u0085111111111111']);
// letters outside the basic plane are one letter (JavaScript with the u flag, and .NET by Rune); combining marks are not letters
add({ type: 'alpha' }, ['𠮷', '𠮷野家', '𝒜𝒷'], ['á', '𠮷1', '́']);
add({ type: 'alphanumeric' }, ['𠮷1', '٣a'], ['á', '𠮷_']);
// string length counts UTF-16 code units everywhere
add({ type: 'minlength', min: 4 }, ['😀😀'], ['😀']);
add({ type: 'maxlength', max: 2 }, ['😀'], ['😀a']);
// numbers: plain decimals only
add({ type: 'min', min: 5 }, [], ['0x10', 'Infinity', '٣', '1_000']);
add({ type: 'max', max: 5 }, [], ['Infinity', '-Infinity']);
add({ type: 'range', min: 0, max: 100 }, ['1e1', '+5', '.5', '5.'], ['0b11', '٥']);
add({ type: 'number' }, [], ['1_000', '٣', '1e', 'e1', '+', '.']);
// passwords: capital letters, small letters, digits and symbols of every script
add({ type: 'pwcheck', minLength: 4, requireUppercase: true }, ['İaaa', 'Éaaa', 'Дaaa', 'Σaaa'], ['ǅaaa', 'ßaaa', 'aaaa', '１aaa']);
add({ type: 'pwcheck', minLength: 4, requireLowercase: true }, ['Aaaa', 'ÀÀÀà', 'ДДДд'], ['AAAA', 'ǅAAA']);
add({ type: 'pwcheck', minLength: 4, requireDigit: true }, ['aaa٣', 'aaa5', 'aaa５'], ['aaaa', 'aaaⅣ']);
add({ type: 'pwcheck', minLength: 4, requireSpecialChar: true }, ['abc€', 'abc!', 'abc😀', 'abć'], ['abcé', 'abcД', 'abc٣', 'a b c']);

// dates. An explicit format means the same thing everywhere. strict = ISO 8601. No format = the browser's Date.parse (legacy, not in these vectors).
const F = f => ({ type: 'date', format: f });
add(F('d/M/y'), ['5/3/2024', '05/03/2024', '29/2/2024', '31/12/1999', '1/1/0001'], ['29/2/2023', '31/4/2024', '0/1/2024', '1/0/2024', '1/13/2024', '5-3-2024', '5/3/24', '5/3', 'a/b/c', '32/1/2024', '1/1/10000']);
add(F('dd/MM/yyyy'), ['05/03/2024', '31/12/1999'], ['5/3/2024', '05/03/24', '5/03/2024']);
add(F('MM/dd/yyyy'), ['02/29/2024', '12/31/1999'], ['13/01/2024', '02/30/2024', '2/9/2024']);
add(F('yyyy-MM-dd'), ['2024-02-29', '1999-12-31'], ['2024-2-9', '2024-13-45', '2023-02-29', '24-02-29']);
add(F('d.M.yyyy'), ['5.3.2024', '31.12.2024'], ['5/3/2024', '31.2.2024']);
add(F('d/M/yy'), ['5/3/24', '1/1/70', '1/1/69'], ['5/3/2024', '5/3/4']);
add(F('d/M/y HH:mm'), ['5/3/2024 14:30', '1/1/2024 00:00', '1/1/2024 23:59'], ['5/3/2024 24:00', '5/3/2024 14:60', '5/3/2024 1:30', '5/3/2024']);
add(F('yyyy-MM-dd HH:mm:ss'), ['2024-02-29 23:59:59'], ['2024-02-29 23:59:60', '2024-02-29T23:59:59']);
add({ type: 'date', strict: true }, ['2024-02-29', '2024-02-29T23:59:59', '2024-02-29T00:00', '0001-01-01', '9999-12-31'],
    ['Jan 5 2020', '2024-13-45', '2023-02-29', '2024-2-9', '2024/02/29', '29-02-2024', '2024-02-29T24:00', '2024-02-29T10:00Z', '2024-02-29T10:00:00.5']);
add({ type: 'minDate', format: 'd/M/y', min: '01/03/2024' }, ['1/3/2024', '2/3/2024', '1/1/2025'], ['29/2/2024', '31/12/2023', '31/2/2025']);
add({ type: 'maxDate', format: 'd/M/y', max: '01/03/2024' }, ['1/3/2024', '29/2/2024'], ['2/3/2024', '31/2/2023']);
add({ type: 'minDate', strict: true, min: '2024-02-29' }, ['2024-02-29', '2024-03-01', '2024-02-29T00:01'], ['2024-02-28', '2024-02-28T23:59:59']);
add({ type: 'maxDate', strict: true, max: '2024-02-29' }, ['2024-02-29', '2024-02-28'], ['2024-03-01']);
add({ type: 'minDate', format: 'yyyy-MM-dd', min: '2000-01-01' }, ['2000-01-01'], ['1999-12-31']);

// several rules in order: the first failure wins; blank skips everything except required
C.push({ rule: ['required', 'email'], value: '', valid: false, failedRule: 'required' });
C.push({ rule: ['email', { type: 'maxlength', max: 3 }], value: '', valid: true });
C.push({ rule: [{ type: 'required' }, { type: 'minlength', min: 5 }, { type: 'email' }], value: 'a@b', valid: false, failedRule: 'minlength' });
C.push({ rule: [{ type: 'required' }, { type: 'minlength', min: 3 }, { type: 'email' }], value: 'a@b', valid: false, failedRule: 'email' });
C.push({ rule: ['required', 'email'], value: '  a@b.co  ', valid: true });
// identifiers and formats (ASCII only: the same answer in JavaScript, .NET and every other port)
const NBSP = String.fromCharCode(0xa0), EMSP = String.fromCharCode(0x2003), ZWSP = String.fromCharCode(0x200b), ARABIC_ONE = String.fromCharCode(0x661), FULLWIDTH_ONE = String.fromCharCode(0xff11);
add({ type: 'integer' }, ['0', '-5', '+7', '007', '12345678901234567890'], ['1.5', '1e3', '--1', ARABIC_ONE, '5-', '0x10', '1 2', ',5']);
add({ type: 'uuid' }, ['123e4567-e89b-12d3-a456-426614174000', '123E4567-E89B-42D3-A456-426614174000', '018f3a3c-7b3e-7cc1-8f5a-0c1d2e3f4a5b'],
  ['123e4567-e89b-02d3-a456-426614174000', '123e4567-e89b-92d3-a456-426614174000', '123e4567-e89b-12d3-c456-426614174000', '123e4567e89b12d3a456426614174000',
    '123e4567-e89b-12d3-a456-42661417400', 'g23e4567-e89b-12d3-a456-426614174000', '{123e4567-e89b-12d3-a456-426614174000}']);
add({ type: 'hexColor' }, ['#fff', '#FFFF', '#a1b2c3', '#A1B2C3D4'], ['fff', '#ff', '#fffff', '#ggg', '#12345g', '##fff', '#1234567']);
add({ type: 'slug' }, ['a', 'hello-world', 'a1-b2-c3', '2024'], ['Hello', '-a', 'a-', 'a--b', 'a_b', 'a b', 'caf' + String.fromCharCode(0xe9), 'a-B']);
add({ type: 'ipv4' }, ['0.0.0.0', '255.255.255.255', '192.168.1.1', '1.2.3.4'], ['256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', '1.2.3.04', 'a.b.c.d', '1.2.3.', '.1.2.3', FULLWIDTH_ONE + '.2.3.4']);
add({ type: 'ipv6' }, ['::1', '::', '2001:db8::1', '2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'fe80::1', '::ffff:192.168.1.1', '1::', '1:2:3:4:5:6:7:8', '1:2:3:4:5:6:1.2.3.4', 'ABCD:EF01::2'],
  ['1:2:3:4:5:6:7:8:9', '1::2::3', ':::1', '12345::1', 'g::1', '1:2:3:4:5:6:7', '::ffff:256.1.1.1', '1.2.3.4', '::1.2.3', '1:2:3:4:5:6:7::8', ':1:2:3:4:5:6:7']);
add({ type: 'iban' }, ['DE89370400440532013000', 'DE89 3704 0044 0532 0130 00', 'gb82west12345698765432', 'GB82 WEST 1234 5698 7654 32', 'FR1420041010050500013M02606', 'NL91ABNA0417164300', 'BE68539007547034', 'CH9300762011623852957'],
  ['DE89370400440532013001', 'DE8937040044053201300', 'XX00', '1234567890123456', 'DE89-3704-0044-0532-0130-00', 'GB82WEST1234569876543', 'de89370400440532013000x']);
add({ type: 'time' }, ['00:00', '23:59', '09:05', '12:30:45', '23:59:59'], ['24:00', '9:05', '12:60', '12:30:60', '12:3', '1230', '12:30:', 'noon', '12' + String.fromCharCode(0xff1a) + '30']);
add({ type: 'domain' }, ['example.com', 'sub.example.co.uk', 'a-b.example.org', 'xn--p1ai.xn--p1ai', 'EXAMPLE.COM', '1.example.com', 'a'.repeat(63) + '.com'],
  ['example', 'example.c', '-a.com', 'a-.com', 'a..com', 'example.com.', 'exa mple.com', 'ex' + String.fromCharCode(0xe4) + 'mple.com', 'http://example.com', 'example.123', 'a'.repeat(64) + '.com', ('a'.repeat(60) + '.').repeat(5) + 'com']);
add({ type: 'base64' }, ['aGVsbG8=', 'aGVsbG8gd29ybGQ=', 'YWJj', 'YQ==', 'YWI='], ['aGVsbG8', 'aGVsbG8==', 'a', 'YQ=', 'YQ===', 'a GVs', 'aGVs bG8=', 'YWJj!']);
add({ type: 'mac' }, ['00:1A:2b:3C:4d:5E', '00-1a-2b-3c-4d-5e', 'FF:FF:FF:FF:FF:FF'], ['00:1A:2b:3C:4d', '00:1A:2b:3C:4d:5E:6F', '00:1A-2b:3C:4d:5E', '001A.2b3C.4d5E', 'GG:1A:2b:3C:4d:5E', '0:1A:2b:3C:4d:5E']);
add({ type: 'latitude' }, ['0', '45.5', '-90', '90', '90.000', '+12.3456', '-0.5', '89.999999'], ['90.1', '-90.5', '91', 'abc', '45.', '.5', '1e2', '180']);
add({ type: 'longitude' }, ['0', '-180', '180', '180.0', '179.99', '-122.4194', '+5', '99.5', '100'], ['180.1', '-181', '181', 'abc', '1e2', '200', '.5']);
add({ type: 'startsWith', value: 'AB' }, ['AB', 'ABC', 'ABAB'], ['aB', 'xAB', 'A']);
add({ type: 'endsWith', value: '.pdf' }, ['a.pdf', '.pdf'], ['a.PDF', 'pdf', 'a.pdfx']);
add({ type: 'contains', value: '@' }, ['a@b', '@'], ['ab']);
add({ type: 'notOneOf', values: ['admin', 'root'] }, ['user', 'Admin', 'administrator'], ['admin', 'root']);
add({ type: 'minWords', min: 3 }, ['one two three', 'a b c d', 'a' + NBSP + 'b' + EMSP + 'c', "it's a dog", String.fromCharCode(0x41f, 0x440, 0x438, 0x432, 0x435, 0x442) + ' ' + String.fromCharCode(0x43c, 0x438, 0x440) + ' ' + String.fromCharCode(0x434, 0x43e, 0x431, 0x440, 0x44b, 0x439)],
  ['one two', 'hello', '!!! ... ???', 'a  b', 'a' + ZWSP + 'b c', 'x - y']);
add({ type: 'maxWords', max: 2 }, ['one', 'one two', 'one  two', '!!! one', 'a' + NBSP + 'b'], ['one two three', 'a b c', 'a' + NBSP + 'b' + EMSP + 'c']);
// rules that look at another field
add({ type: 'equalTo', target: 'password' }, ['Secret1!'], ['secret1!', 'Secret1', ''], { values: { password: 'Secret1!' } });
add({ type: 'notEqualTo', target: 'oldPassword' }, ['new-one'], ['old-one'], { values: { oldPassword: 'old-one' } });

fs.writeFileSync(path.join(__dirname, 'form-rules.vectors.json'), JSON.stringify({
    description: 'Language-neutral conformance vectors for the FormValidator rules. Every implementation (browser, Node, Angular, .NET) must give the same valid / failedRule for each case. rule is a rule object, a rule name or a list of them; values holds the other fields for equalTo / notEqualTo.',
    version: 1,
    cases: C
}, null, 1) + '\n');
console.log(C.length + ' cases');
