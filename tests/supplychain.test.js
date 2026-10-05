'use strict';
// Supply chain: zero runtime dependencies, no install scripts, shipped scripts only require Node built-ins, and the SBOM matches dist/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { builtinModules } = require('module');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

test('no runtime dependencies and no install-time scripts', () => {
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.optionalDependencies, undefined);
    for (const k of ['preinstall', 'install', 'postinstall', 'prepare']) assert.equal((pkg.scripts || {})[k], undefined, k);
    for (const n of Object.keys(pkg.peerDependencies || {})) assert.equal(pkg.peerDependenciesMeta[n].optional, true, n + ' must be an optional peer');
});

test('shipped source only requires Node built-ins or its own files', () => {
    const builtins = new Set(builtinModules.concat(builtinModules.map(m => 'node:' + m)));
    for (const f of walk(path.join(ROOT, 'src')).filter(f => /\.(m?js)$/.test(f))) {
        const text = fs.readFileSync(f, 'utf8');
        for (const m of text.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            const id = m[1];
            if (id.startsWith('.') || builtins.has(id)) continue;
            // the optional peers are only required inside integrations/ (React, Vue, ...), which declare them as peers
            const peer = id === 'jquery' || id.startsWith(pkg.name) || Object.keys(pkg.peerDependencies || {}).some(p => id === p || id.startsWith(p + '/'));
            assert.ok(peer, path.relative(ROOT, f) + ' requires "' + id + '"');
        }
        for (const m of text.matchAll(/^\s*import\s[^'"]*from\s*['"]([^'"]+)['"]/gm)) {
            const id = m[1];
            if (id.startsWith('.') || builtins.has(id)) continue;
            assert.ok(Object.keys(pkg.peerDependencies || {}).some(p => id === p || id.startsWith(p + '/')) || id.startsWith('form-and-file-validator'), path.relative(ROOT, f) + ' imports "' + id + '"');
        }
    }
});

test('sbom.cdx.json lists the package and hashes every dist file (run: node tools/make-sbom.js)', () => {
    const sbom = JSON.parse(fs.readFileSync(path.join(ROOT, 'sbom.cdx.json'), 'utf8'));
    assert.equal(sbom.bomFormat, 'CycloneDX');
    assert.equal(sbom.metadata.component.version, pkg.version);
    assert.deepEqual(sbom.dependencies, [{ ref: pkg.name + '@' + pkg.version, dependsOn: [] }]);
    const files = sbom.components.filter(c => c.type === 'file');
    assert.equal(files.length, walk(path.join(ROOT, 'dist')).length);
    for (const c of files) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, c.name))).digest('hex');
        assert.equal(c.hashes[0].content, hash, c.name + ' changed: regenerate sbom.cdx.json');
    }
});
