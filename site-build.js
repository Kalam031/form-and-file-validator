'use strict';
/*
 * Docs site: node site-build.js   (or: npm run site)
 *
 * Turns README.md and docs/*.md into static HTML pages inside docs/ (GitHub Pages: Settings -> Pages -> Deploy from a branch -> main, /docs)
 * and adds a live playground. The pages carry their own copy of the built library (docs/assets/), so nothing is loaded from other sites.
 * Run `npm run build` first (npm run site does it).
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = __dirname, DOCS = path.join(ROOT, 'docs'), ASSETS = path.join(DOCS, 'assets');
const pkg = require('./package.json');
const REPO = 'https://github.com/Kalam031/form-and-file-validator';

const PAGES = [
    { file: 'index.html', title: 'Overview', src: 'README.md' },
    { file: 'form.html', title: 'FormValidator', src: 'docs/FormValidator.md' },
    { file: 'file.html', title: 'FileValidator', src: 'docs/FileValidator.md' },
    { file: 'server-and-frameworks.html', title: 'Server & frameworks', src: 'docs/Server-and-Frameworks.md' },
    { file: 'languages.html', title: 'Languages', src: 'docs/Languages.md' },
    { file: 'migrating.html', title: 'Migrating from jQuery Validate', src: 'docs/Migrating-from-jQuery-Validate.md' },
    { file: 'accessibility.html', title: 'Accessibility', src: 'docs/Accessibility.md' },
    { file: 'benchmarks.html', title: 'Benchmarks', src: 'docs/Benchmarks.md' },
    { file: 'playground.html', title: 'Playground', src: null }
];
const LINKS = {
    'docs/FormValidator.md': 'form.html', 'FormValidator.md': 'form.html', 'docs/FileValidator.md': 'file.html', 'FileValidator.md': 'file.html',
    'docs/Languages.md': 'languages.html', 'Languages.md': 'languages.html', 'docs/Server-and-Frameworks.md': 'server-and-frameworks.html', 'Server-and-Frameworks.md': 'server-and-frameworks.html',
    'docs/Migrating-from-jQuery-Validate.md': 'migrating.html', 'Migrating-from-jQuery-Validate.md': 'migrating.html',
    'docs/Accessibility.md': 'accessibility.html', 'Accessibility.md': 'accessibility.html', 'docs/Benchmarks.md': 'benchmarks.html', 'Benchmarks.md': 'benchmarks.html',
    'CONTRIBUTING.md': REPO + '/blob/main/CONTRIBUTING.md', 'SECURITY.md': REPO + '/blob/main/SECURITY.md'
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

function render(md) {
    const renderer = new marked.Renderer();
    renderer.heading = function ({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        return '<h' + depth + ' id="' + slug(text) + '">' + text + '</h' + depth + '>\n';
    };
    let html = marked.parse(md, { renderer, gfm: true });
    html = html.replace(/href="([^"#]+?\.md)(#[^"]*)?"/g, (m, f, hash) => LINKS[f] ? 'href="' + LINKS[f] + (hash || '') + '"' : m);
    html = html.replace(/<pre>/g, '<pre tabindex="0">');   // scrollable code blocks must be reachable with the keyboard
    let tables = 0;
    html = html.replace(/<table>/g, () => '<div class="tablewrap" role="region" aria-label="Table ' + (++tables) + '" tabindex="0"><table>').replace(/<\/table>/g, '</table></div>');
    return html;
}

const layout = (page, body, extraHead) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} · form-and-file-validator</title>
<meta name="description" content="Dependency-free form validation (successor of jQuery Validation) and file validation with an upload widget.">
<link rel="stylesheet" href="assets/site.css">
${extraHead || ''}
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="top">
  <a class="brand" href="index.html">form-and-file-validator <span>v${pkg.version}</span></a>
  <a class="gh" href="${REPO}">GitHub</a>
</header>
<div class="wrap">
  <nav aria-label="Documentation">
    <ul>
${PAGES.map(p => `      <li><a href="${p.file}"${p.file === page.file ? ' aria-current="page"' : ''}>${esc(p.title)}</a></li>`).join('\n')}
    </ul>
  </nav>
  <main id="content">
${body}
  </main>
</div>
<footer>MIT licensed · <a href="${REPO}/blob/main/CHANGELOG.md">Changelog</a> · <a href="${REPO}/blob/main/CONTRIBUTING.md">Contribute</a></footer>
</body>
</html>
`;

const CSS = `:root{--bg:#fff;--fg:#1c2330;--muted:#5b6678;--line:#dfe4ec;--accent:#1a5fd0;--code:#f3f5f9;--side:#f7f8fb;--err:#b3261e}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#12161d;--fg:#e6eaf2;--muted:#9aa5b8;--line:#2a3140;--accent:#7fb0ff;--code:#1b212c;--side:#161b24;--err:#ff8a80}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.skip{position:absolute;left:-999px}.skip:focus{left:8px;top:8px;background:var(--bg);padding:8px;z-index:9}
.top{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
.brand{font-weight:700;color:var(--fg);text-decoration:none}.brand span{font-weight:400;color:var(--muted);font-size:.85em;margin-left:6px}
.gh{color:var(--accent)}
.wrap{display:flex;gap:32px;max-width:1180px;margin:0 auto;padding:0 16px}
nav{flex:0 0 220px;padding:20px 0}nav ul{list-style:none;margin:0;padding:0;position:sticky;top:16px}
nav a{display:block;padding:6px 10px;border-radius:6px;color:var(--fg);text-decoration:none}
nav a:hover{background:var(--side)}nav a[aria-current=page]{background:var(--side);font-weight:600;color:var(--accent)}
main{flex:1;min-width:0;padding:20px 0 60px}
h1,h2,h3{line-height:1.25}h2{margin-top:2em;padding-top:.6em;border-top:1px solid var(--line)}
a{color:var(--accent)}
pre{background:var(--code);padding:14px;border-radius:8px;overflow:auto;font-size:.88em;line-height:1.5}
code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:.9em}pre code{background:none;padding:0}
table{border-collapse:collapse}.tablewrap{overflow:auto;max-width:100%}th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}th{background:var(--side)}
blockquote{margin:1em 0;padding:.2em 1em;border-left:4px solid var(--accent);background:var(--side)}
footer{border-top:1px solid var(--line);padding:20px 16px;text-align:center;color:var(--muted)}
.pg{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}
.card{border:1px solid var(--line);border-radius:10px;padding:16px}
.card label{display:block;margin:10px 0 2px;font-weight:600}
.card input[type=text],.card input[type=email],.card input[type=password],.card select{width:100%;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);font:inherit}
.card button{margin-top:12px;padding:8px 16px;border:0;border-radius:6px;background:var(--accent);color:var(--bg);font:inherit;cursor:pointer}
.error{color:var(--err);font-size:.9em}input.error{border-color:var(--err)}
.fv-zone{border:2px dashed var(--line);border-radius:10px;padding:16px;text-align:center}.fv-dragover{border-color:var(--accent);background:var(--side)}
.fv-list{list-style:none;padding:0;text-align:left}.fv-file{display:flex;align-items:center;gap:8px;padding:4px 0}.fv-preview{width:40px;height:40px;object-fit:cover;border-radius:4px}
.fv-message{color:var(--err);text-align:left}
#result{white-space:pre-wrap}
@media (max-width:760px){.wrap{flex-direction:column;gap:0}nav{flex:none}nav ul{display:flex;flex-wrap:wrap;position:static}}
`;

const PLAYGROUND = `<h1>Playground</h1>
<p>Everything on this page runs in your browser with the same library you install. Try a wrong value, a renamed program, a huge file, and another language.</p>
<p><label for="lang"><strong>Language</strong></label> <select id="lang"></select></p>
<div class="pg">
  <section class="card" aria-labelledby="h-form">
    <h2 id="h-form" style="margin-top:0;border:0;padding:0">FormValidator</h2>
    <form id="demo-form" novalidate>
      <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email">
      <label for="name">Name (3 to 20 characters)</label><input id="name" name="name" type="text" autocomplete="off">
      <label for="pw">Password (at least 8)</label><input id="pw" name="pw" type="password" autocomplete="new-password">
      <label for="pw2">Repeat password</label><input id="pw2" name="pw2" type="password" autocomplete="new-password">
      <button type="submit">Check</button>
    </form>
  </section>
  <section class="card" aria-labelledby="h-file">
    <h2 id="h-file" style="margin-top:0;border:0;padding:0">FileValidator upload widget</h2>
    <p>Images and PDFs up to 1 MB, at most 3 files. Drop, browse or paste (Ctrl+V).</p>
    <div id="zone" class="fv-zone">
      <label for="files">Choose files</label> <input id="files" type="file" name="files" multiple>
      <ul id="list" class="fv-list"></ul>
      <div id="messages" class="fv-messages" role="alert"></div>
      <div id="status" aria-live="polite" class="error" style="color:var(--muted)"></div>
    </div>
  </section>
</div>
<h2>Result</h2>
<pre id="result" aria-live="polite" tabindex="0">Press "Check" or add a file.</pre>
<script src="assets/validator.min.js"></script>
<script src="assets/locales.all.min.js"></script>
<script src="assets/playground.js"></script>`;

const PLAYGROUND_JS = `(function () {
  var sel = document.getElementById('lang'), result = document.getElementById('result');
  FVLocales.list().forEach(function (l) { var o = document.createElement('option'); o.value = l.code; o.textContent = l.name + ' (' + l.code + ')'; sel.appendChild(o); });
  var form = FormValidator.init({
    form: '#demo-form',
    rules: { email: ['required', 'email'], name: ['required', { type: 'rangelength', min: 3, max: 20 }], pw: ['required', { type: 'minlength', min: 8 }], pw2: ['required', { type: 'equalTo', field: 'pw' }] },
    config: {
      onError: function (errors) { show({ formValid: false, errors: errors.map(function (x) { return x.name + ': ' + x.message; }) }); },
      submitHandler: function () { show({ formValid: true, note: 'Nothing is sent anywhere: this is a demo.' }); }
    }
  });
  var zone = FileValidator.widget('#zone', { allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'], maxFileSizeMB: 1, maxFiles: 3 }, {
    input: '#files', list: '#list', messageElement: '#messages', statusElement: '#status', preview: true, paste: 'document',
    onChange: function (files) { show({ selected: files.map(function (f) { return f.name + ' (' + FileValidator.formatBytes(f.size) + ')'; }) }); },
    onReject: function (rejected) { show({ rejected: rejected.map(function (r) { return { file: r.file.name, reasons: r.errors }; }) }); }
  });
  function show(o) { result.textContent = JSON.stringify(o, null, 2); }
  sel.addEventListener('change', function () {
    FVLocales.use(sel.value, { document: true });
    zone.clear(); form.clearErrors();
    show({ language: sel.value, note: 'Submit the form or add a file to see the messages in this language.' });
  });
  var auto = FVLocales.auto('en', { document: true }); sel.value = auto.code;
})();`;

function build() {
    fs.mkdirSync(ASSETS, { recursive: true });
    fs.writeFileSync(path.join(ASSETS, 'site.css'), CSS);
    fs.writeFileSync(path.join(ASSETS, 'playground.js'), PLAYGROUND_JS);
    const dist = name => path.join(ROOT, 'dist', name);
    if (!fs.existsSync(dist('validator.min.js'))) throw new Error('site-build: run "npm run build" first');
    fs.copyFileSync(dist('validator.min.js'), path.join(ASSETS, 'validator.min.js'));
    fs.copyFileSync(dist('locales/all.min.js'), path.join(ASSETS, 'locales.all.min.js'));
    fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');
    const made = [];
    for (const page of PAGES) {
        const body = page.src ? render(fs.readFileSync(path.join(ROOT, page.src), 'utf8')) : PLAYGROUND;
        fs.writeFileSync(path.join(DOCS, page.file), layout(page, body));
        made.push(page.file);
    }
    return made;
}

module.exports = { build, PAGES };
if (require.main === module) console.log('Site pages:', build().join(', '));
