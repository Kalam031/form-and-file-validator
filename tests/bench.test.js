'use strict';
// The benchmark script must keep working (a quick run): sizes, objects and a DOM form against the other libraries.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('npm run bench (quick) prints the three tables', { timeout: 180000 }, () => {
    const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'bench', 'run.mjs'), '--quick'], { encoding: 'utf8', timeout: 170000 });
    assert.match(out, /## Bundle size/);
    assert.match(out, /\| zod \(object with 3 fields\)/);
    assert.match(out, /## Validating objects/);
    assert.match(out, /form-and-file-validator \| [\d,]+ \|/);
    assert.match(out, /## Validating a form of 60 fields/);
    assert.match(out, /\| jQuery Validation \|/);
});
