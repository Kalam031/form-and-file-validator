'use strict';
// docs/Recipes.md: every fenced block tagged "js test" is run against the real library, so the cookbook cannot drift from the code.
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FormValidator, FileValidator } = require('../dist/validator.js');

const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'Recipes.md'), 'utf8').replace(/\r\n/g, '\n');
const blocks = [];
md.replace(/^```js test\n([\s\S]*?)^```/gm, (m, code, offset) => {
    const before = md.slice(0, offset).split('\n').filter(l => /^## /.test(l)).pop() || 'prelude';
    blocks.push({ title: before.replace(/^## /, ''), code });
    return m;
});
const AsyncFunction = Object.getPrototypeOf(async function () { /* constructor holder */ }).constructor;

test('the cookbook has recipes', () => assert.ok(blocks.length >= 10, 'found ' + blocks.length));
const prelude = blocks.length ? blocks[0].code : '';
blocks.slice(1).forEach(b => {
    test('recipe: ' + b.title, async () => {
        await new AsyncFunction('FormValidator', 'FileValidator', 'assert', prelude + '\n{\n' + b.code + '\n}')(FormValidator, FileValidator, assert);
    });
});
