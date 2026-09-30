'use strict';
// Runs the jQuery-compat and accessibility tests against jQuery 3.x (installed as the "jquery3" alias). Usage: npm run test:jquery3
const { spawnSync } = require('child_process');
const r = spawnSync(process.execPath, ['--test', 'tests/jqueryCompat.test.js', 'tests/a11y.test.js'], {
    stdio: 'inherit',
    env: Object.assign({}, process.env, { JQUERY_PKG: 'jquery3' })
});
process.exit(r.status === null ? 1 : r.status);
