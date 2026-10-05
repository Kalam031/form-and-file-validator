// Svelte, Lit and Solid bindings: the scenarios run in a child process with --conditions=browser, because Solid's reactive build is the "browser" one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
test('Svelte, Lit and Solid bindings on the real libraries', { timeout: 120000 }, () => {
    const r = spawnSync(process.execPath, ['--conditions=browser', path.join(dir, 'helpers', 'frameworks2.child.mjs')], { encoding: 'utf8', timeout: 110000, cwd: path.join(dir, '..'), env: Object.assign({}, process.env, { NODE_TEST_CONTEXT: '' }) });
    const out = (r.stdout || '') + (r.stderr || '');
    assert.equal(r.status, 0, out.split('\n').filter(l => /not ok|✖|Error|expected|actual|at .*child/.test(l)).slice(0, 30).join('\n') || out.slice(-3000));
    assert.match(out, /(pass 5|ℹ pass 5)/);
});
