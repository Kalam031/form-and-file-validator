'use strict';
/* Recomputes dist/SRI.json after a build and replaces the old hashes in README.md. Run:  node spec/update-sri.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const sriFile = path.join(root, 'dist', 'SRI.json');
const sri = JSON.parse(fs.readFileSync(sriFile, 'utf8'));
let readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
let changed = 0;
for (const f of Object.keys(sri)) {
    const now = 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(path.join(root, 'dist', f))).digest('base64');
    if (now !== sri[f]) { readme = readme.split(sri[f]).join(now); sri[f] = now; changed++; console.log('updated', f); }
}
fs.writeFileSync(sriFile, JSON.stringify(sri, null, 1) + '\n');
fs.writeFileSync(path.join(root, 'README.md'), readme);
console.log(changed + ' hash(es) changed');
