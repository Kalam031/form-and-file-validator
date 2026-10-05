'use strict';
/*
 * node tools/make-sbom.js   writes sbom.cdx.json: a CycloneDX 1.5 software bill of materials for this package.
 * The package has NO runtime dependencies, so the list holds only the package itself, a SHA-256 hash of every file in dist/,
 * and the optional peer integrations (React, Vue, ...) as "optional" components. Run it after `node build.js`.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function make() {
    const ref = pkg.name + '@' + pkg.version;
    const files = walk(path.join(ROOT, 'dist')).sort().map(f => ({
        type: 'file',
        'bom-ref': 'file:' + path.relative(ROOT, f).split(path.sep).join('/'),
        name: path.relative(ROOT, f).split(path.sep).join('/'),
        hashes: [{ alg: 'SHA-256', content: sha256(f) }]
    }));
    const peers = Object.keys(pkg.peerDependencies || {}).sort().map(n => ({
        type: 'library', 'bom-ref': 'peer:' + n, name: n, version: pkg.peerDependencies[n], scope: 'optional',
        description: 'Optional peer: only needed when you use the matching integration'
    }));
    return {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        version: 1,
        metadata: {
            component: { type: 'library', 'bom-ref': ref, name: pkg.name, version: pkg.version, licenses: [{ license: { id: pkg.license } }], purl: 'pkg:npm/' + pkg.name + '@' + pkg.version },
            properties: [{ name: 'runtime-dependencies', value: String(Object.keys(pkg.dependencies || {}).length) }]
        },
        components: files.concat(peers),
        dependencies: [{ ref, dependsOn: [] }]
    };
}

if (require.main === module) {
    const out = path.join(ROOT, 'sbom.cdx.json');
    fs.writeFileSync(out, JSON.stringify(make(), null, 2) + '\n');
    console.log('wrote ' + path.relative(process.cwd(), out));
}
module.exports = { make };
