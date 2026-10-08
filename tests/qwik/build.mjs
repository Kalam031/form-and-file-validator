// Builds the Qwik sample component (Signup.tsx) with Qwik's own optimizer and esbuild:
//   node tests/qwik/build.mjs client <outDir>   -> index.html + app.js (client render, qwikloader runs the visible task)
//   node tests/qwik/build.mjs ssr <outDir>      -> ssr.mjs exporting html(): the server-rendered page
import { createOptimizer } from '@builder.io/qwik/optimizer';
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const [mode, outArg] = process.argv.slice(2);
const out = path.resolve(outArg || path.join(here, '.out'));
fs.mkdirSync(out, { recursive: true });

const opt = await createOptimizer();
const code = fs.readFileSync(path.join(here, 'Signup.tsx'), 'utf8');
const r = await opt.transformModules({ input: [{ path: 'Signup.tsx', code }], srcDir: here, entryStrategy: { type: mode === 'ssr' ? 'segment' : 'inline' }, minify: 'none', transpileTs: true, transpileJsx: true, mode: 'prod' });
const work = path.join(out, 'src'); fs.mkdirSync(work, { recursive: true });
for (const m of r.modules) fs.writeFileSync(path.join(work, m.path), m.code);
const define = { 'import.meta.env': '{"BASE_URL":"/","DEV":false,"PROD":true}' };
const alias = { 'form-and-file-validator/qwik': path.join(root, 'dist', 'integrations', 'qwik.mjs'), 'form-and-file-validator': path.join(root, 'dist', 'validator.mjs') };
const common = { bundle: true, alias, format: 'esm', logLevel: 'error', define, absWorkingDir: root };

if (mode === 'ssr') {
    fs.writeFileSync(path.join(work, 'entry.mjs'), "import { renderToString } from '@builder.io/qwik/server'; import { jsx } from '@builder.io/qwik'; import { Signup } from './Signup.js'; export const html = async () => (await renderToString(jsx(Signup, {}), { containerTagName: 'div', base: '/build/', manifest: { mapping: {}, bundles: {}, version: '1', core: '', preloader: '', bundleGraph: [], injections: [] }, preloader: false, symbolMapper: sym => ['./' + sym + '.js', sym] })).html;");
    await esbuild.build({ ...common, entryPoints: [path.join(work, 'entry.mjs')], platform: 'node', outfile: path.join(out, 'ssr.mjs'), nodePaths: [path.join(root, 'node_modules')],
        plugins: [{ name: 'manifest-stub', setup(b) { b.onResolve({ filter: /^@qwik-client-manifest$/ }, () => ({ path: 'manifest', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const manifest = undefined; export default undefined;', loader: 'js' })); } }] });
} else {
    fs.writeFileSync(path.join(work, 'entry.mjs'), "import { render, jsx } from '@builder.io/qwik'; import { Signup } from './Signup.js'; render(document.getElementById('root'), jsx(Signup, {}));");
    await esbuild.build({ ...common, entryPoints: [path.join(work, 'entry.mjs')], platform: 'browser', outfile: path.join(out, 'app.js'), nodePaths: [path.join(root, 'node_modules')] });
    fs.copyFileSync(path.join(root, 'node_modules', '@builder.io', 'qwik', 'dist', 'qwikloader.js'), path.join(out, 'qwikloader.js'));
    fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Qwik sample</title><script>window.qwikevents=["qinit","click","input"];</script></head><body><div id="root"></div>'
        + '<script type="module" src="app.js"></script><script type="module" src="qwikloader.js"></script></body></html>');
}
