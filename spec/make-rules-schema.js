'use strict';
/* Writes schemas/rules.schema.json: a JSON Schema of the rules object ({ field: rules }) with every built-in rule name and its parameter, for editors (VS Code "json.schemas"
 * or a "$schema" key). Run: node spec/make-rules-schema.js   (the test suite checks that the committed file is up to date). */
const fs = require('fs');
const path = require('path');
const { FormValidator } = require('../dist/validator.js');

const num = { type: 'number' }, int = { type: 'integer' }, str = { type: 'string' }, bool = { type: 'boolean' };
const pair = { type: 'array', items: num, minItems: 2, maxItems: 2 };
const strOrRe = { type: 'string', description: 'A regular expression source' };
const fieldList = { type: 'array', items: str };
const withField = extra => ({ oneOf: [str, { type: 'object', properties: Object.assign({ field: str }, extra), required: ['field'] }] });
const PARAMS = {
    required: { oneOf: [{ const: true }, { type: 'string', description: 'A CSS selector: required only when it matches' }] },
    minlength: int, maxlength: int, rangelength: pair, range: pair, min: num, max: num, step: num, minWords: int, maxWords: int, minItems: int, maxItems: int,
    minChecked: int, maxChecked: int, minFiles: int, maxFiles: int, pattern: strOrRe,
    mask: { type: 'string', description: "'9' digit, 'a' letter, '*' letter or digit, backslash escapes: (999) 999-9999" },
    oneOf: { type: 'array' }, notOneOf: { type: 'array' }, equalTo: { type: 'string', description: 'The name of the other field (or a CSS selector)' }, notEqualTo: str,
    requiredIf: withField({ equals: {}, in: { type: 'array' }, notEquals: {} }),
    dateAfter: withField({ inclusive: bool, format: str }), dateBefore: withField({ inclusive: bool, format: str }),
    atLeastOne: { oneOf: [fieldList, { type: 'object', properties: { fields: fieldList }, required: ['fields'] }] },
    sumEquals: { type: 'object', properties: { fields: fieldList, total: num }, required: ['fields', 'total'] },
    unique: { oneOf: [{ const: true }, { type: 'object', properties: { ignoreCase: bool } }] },
    pwcheck: { oneOf: [int, { type: 'object', properties: { minLength: int, maxLength: int, requireUppercase: bool, requireLowercase: bool, requireDigit: bool, requireSpecialChar: bool, noWhitespace: bool } }] },
    pwscore: { oneOf: [{ type: 'integer', minimum: 0, maximum: 4 }, { type: 'object', properties: { min: { type: 'integer', minimum: 0, maximum: 4 }, userFields: fieldList } }] },
    pwned: { oneOf: [{ const: true }, { type: 'object', properties: { maxCount: int, timeout: int, failOpen: bool } }] },
    date: { oneOf: [{ const: true }, { type: 'object', properties: { format: str, strict: bool } }] },
    minDate: { oneOf: [str, { type: 'object', properties: { min: str, format: str } }] },
    maxDate: { oneOf: [str, { type: 'object', properties: { max: str, format: str } }] },
    remote: { oneOf: [str, { type: 'object', properties: { url: str, method: str, data: { type: 'object' }, failOpen: bool, timeout: int, cache: bool }, required: ['url'] }] }
};
const FLAGS = new Set(['email', 'url', 'number', 'digits', 'alpha', 'alphanumeric', 'phone', 'creditcard', 'integer', 'uuid', 'hexColor', 'slug', 'ipv4', 'ipv6', 'iban', 'time', 'domain', 'base64', 'mac', 'latitude', 'longitude']);

function build() {
    const names = FormValidator.ruleNames().sort();
    const ruleProps = {};
    names.forEach(n => { ruleProps[n] = PARAMS[n] || (FLAGS.has(n) ? { oneOf: [{ const: true }, str], description: 'true, or your own message' } : {}); });
    const ruleObject = { type: 'object', properties: Object.assign({ message: { description: 'Your message for this rule' }, code: str, messages: { type: 'object', additionalProperties: str } }, ruleProps), additionalProperties: true };
    const typed = { type: 'object', properties: { type: { enum: names, description: 'The rule name' }, message: {}, code: str }, required: ['type'], additionalProperties: true };
    return {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'https://unpkg.com/form-and-file-validator/schemas/rules.schema.json',
        title: 'form-and-file-validator rules',
        description: 'The rules of a form: { fieldName: rules }. A field takes a rule name, a list, or a map of rules to parameters. Field names may be paths (user.email, items[].qty).',
        type: 'object',
        additionalProperties: { oneOf: [{ enum: names }, ruleObject, { type: 'array', items: { oneOf: [{ enum: names }, typed] } }] },
        'x-fv-rule-names': names
    };
}
module.exports = { build };
if (require.main === module) {
    fs.mkdirSync(path.join(__dirname, '..', 'schemas'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '..', 'schemas', 'rules.schema.json'), JSON.stringify(build(), null, 2) + '\n');
    console.log('schemas/rules.schema.json written');
}
