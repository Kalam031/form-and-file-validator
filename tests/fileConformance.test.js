'use strict';
// The shared FileValidator vectors (spec/file-rules.vectors.json) and the generated .NET tables must be current with the JavaScript FileValidator.
// The .NET port runs the very same vectors, so a change in the JavaScript behaviour that is not regenerated fails here, and one that is regenerated
// but not ported fails in the .NET tests.
require('./helpers/shim.js');   // File on Node 18
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('../spec/make-file-vectors.js');
const tables = require('../spec/make-file-tables.js');
const metadata = require('../spec/make-metadata-vectors.js');

test('spec/file-rules.vectors.json is what the JavaScript FileValidator answers (run: node spec/make-file-vectors.js)', async () => {
    const onDisk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spec', 'file-rules.vectors.json'), 'utf8'));
    const fresh = JSON.parse(JSON.stringify(await build()));
    assert.ok(fresh.length > 150);
    assert.equal(onDisk.cases.length, fresh.length, 'the number of cases changed: regenerate the vectors');
    for (let i = 0; i < fresh.length; i++) assert.deepEqual(onDisk.cases[i], fresh[i], 'vector "' + fresh[i].id + '" is stale: run node spec/make-file-vectors.js');
});

test('dotnet/FormAndFileValidator/FileTables.g.cs is generated from the JavaScript tables (run: node spec/make-file-tables.js)', () => {
    const onDisk = fs.readFileSync(tables.file, 'utf8').replace(/\r\n/g, '\n');
    assert.equal(onDisk, tables.generate(), 'FileTables.g.cs is stale: run node spec/make-file-tables.js');
});

test('spec/metadata-vectors.json is what the JavaScript stripMetadata produces (run: node spec/make-metadata-vectors.js)', async () => {
    const onDisk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spec', 'metadata-vectors.json'), 'utf8'));
    const fresh = JSON.parse(JSON.stringify(await metadata.build()));
    assert.equal(onDisk.cases.length, fresh.length);
    for (let i = 0; i < fresh.length; i++) assert.deepEqual(onDisk.cases[i], fresh[i], 'metadata vector "' + fresh[i].id + '" is stale');
});
