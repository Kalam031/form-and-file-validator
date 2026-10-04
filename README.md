# FormValidator + FileValidator

Two dependency-free libraries for validating forms and file uploads in the browser (and, for files, in Node). They work as plain `<script>` tags or with a bundler. jQuery, Select2 and Bootstrap are optional.

## Install

```
npm install form-and-file-validator
```

| You use | Import |
| --- | --- |
| Plain `<script>` tag | `dist/validator.min.js` (or the CDN below) |
| A bundler or ES modules | `import { FormValidator, FileValidator } from 'form-and-file-validator'` |
| Node / CommonJS | `const { FormValidator, FileValidator } = require('form-and-file-validator')` |
| Node server (uploads and plain values) | `require('form-and-file-validator/server')` and `FormValidator.checkValue()` |
| Angular (Reactive Forms) | `import { fvValidator, fvControls } from 'form-and-file-validator/angular'` |
| React / Vue / Alpine | `form-and-file-validator/react`, `/vue`, `/alpine` |
| .NET (ASP.NET MVC 5, ASP.NET Core) | the `FormAndFileValidator` package in `dotnet/` (same form rules and file checks, same answers) |

TypeScript types are included.

## Which file do I load?

**One file: `dist/validator.min.js`** (127 KB minified; gzip is about a third of that).

```html
<script src="dist/validator.min.js"></script>
```

It holds FormValidator, FileValidator, the upload widget, the jQuery Validation layer and the language registry (`FVLocales`). The jQuery layer switches on by itself when jQuery was loaded first. If jQuery loads after it, call `FormValidator.useJQuery(jQuery)`. With a bundler or Node: `const { FormValidator, FileValidator } = require('./dist/validator.js')`.

**Project layout**

| Folder | What is in it |
| --- | --- |
| `dist/` | Everything you load or ship: the bundle, each part, `locales/` (13 languages), `integrations/` (React, Vue, Alpine), `server.js`, `SRI.json`. Do not edit. |
| `src/` | The source files (four parts, the language registry, `locales/`, `integrations/`, `server.js`). Edit these, then run `npm run build`. |
| `docs/` | Documentation as Markdown, and the same pages as a static site with a live playground (`docs/index.html`, GitHub Pages). |
| `types/` | TypeScript typings. |
| `tests/`, `browser-tests/` | jsdom tests, and the real-browser tests (Chrome, Edge, Firefox, WebKit). |

**Why does `src/` have four main files?** They are four separate jobs with different dependencies, so a page that needs only one part can load only that part (`dist/` has each one on its own, readable and minified):

| Part | What it is | Needs | Minified |
| --- | --- | --- | --- |
| `formValidator` | Form validation | nothing | 31 KB |
| `fileValidator` | File checks. Works without any form, and in Node. | nothing | 49 KB |
| `fileValidator.widget` | Upload widget: drag and drop, folders, paste, previews, resizing, file list | `fileValidator` | 16 KB |
| `formValidator.jquery` | The jQuery Validation plugin API (`$('#f').validate(...)`), for migrating old sites | jQuery, `formValidator` | 25 KB |

If you do not care about size, ignore them and use the one file.

## The four parts, with examples

All four are in `dist/validator.min.js`. Pick by what your page has:

| Your page has... | Use | Example |
| --- | --- | --- |
| a form to validate | **FormValidator** | [1](#1-formvalidator-validate-a-form) |
| file inputs or uploads (with or without a form, or on a server) | **FileValidator** | [2](#2-filevalidator-check-files) |
| a drop area for files | **Upload widget** (on top of FileValidator) | [3](#3-upload-widget-a-drop-area) |
| an old site that already uses `$('#form').validate(...)` | **jQuery layer** | [4](#4-jquery-layer-keep-old-jquery-validation-code) |

### 1. FormValidator: validate a form

```html
<form id="signup">
  <label>Email <input name="email"></label>
  <label>Password <input name="password" type="password"></label>
  <label>Repeat <input name="confirm" type="password"></label>
  <label><input type="checkbox" name="terms" value="1"> I accept the terms</label>
  <button>Create account</button>
</form>

<script src="dist/validator.min.js"></script>
<script>
  FormValidator.init({
    formId: 'signup',
    rules: {
      email:    ['required', 'email'],
      password: ['required', { type: 'pwcheck', minLength: 8, requireDigit: true, message: 'Use 8+ characters with a digit.' }],
      confirm:  ['required', { type: 'equalTo', target: 'password', message: 'Passwords do not match.' }],
      terms:    [{ type: 'required', message: 'Please accept the terms.' }]
    },
    config: { submitHandler: function (form) { /* send it with fetch(), then show a thank-you */ } }
  });
</script>
```

What it does:
- Pressing "Create account" on the empty form is **blocked**. A message appears under each of the four fields (`This field is required.`, ..., `Please accept the terms.`) and the first bad field gets focus.
- With a password of `abcdefg` the only message left is `Use 8+ characters with a digit.` It disappears as soon as the user types a valid one.
- When everything is valid, `submitHandler` runs and the messages are gone. Leave `submitHandler` out to submit the form normally.
- Fields you do not mark `required` may stay empty, so an empty optional email is not an error.

### 2. FileValidator: check files

In a browser, with one line:

```html
<input type="file" id="cv" multiple>
<p id="cv-msg"></p>

<script src="dist/validator.min.js"></script>
<script>
  FileValidator.bind('#cv', { accept: '.pdf,.docx', maxFileSizeMB: 5, maxFiles: 3 },
    { messageElement: '#cv-msg', clearOnInvalid: true });
</script>
```

Or in your own code (also in Node, where there is no page):

```js
const result = await FileValidator.validateFiles(input.files, { accept: '.pdf', maxFileSizeMB: 5 });
if (!result.isValid) alert(FileValidator.summary(result).join('\n'));
```

What it does for files the user picks (the message goes into `#cv-msg` and the input is cleared):

| File | Result |
| --- | --- |
| a normal `cv.pdf` | accepted, no message |
| `setup.exe` | `setup.exe: Files of this type (.exe) can't be uploaded for security reasons.` |
| `invoice.exe.pdf` | `invoice.exe.pdf: The file name has a disguised extension.` |
| a PDF that contains JavaScript | `form.pdf: This file contains JavaScript in a PDF, which can't be uploaded.` |
| a PNG renamed to `photo.pdf` | `photo.pdf: The file's content doesn't match its extension (.pdf); it looks like png.` |
| `pic.png` when only PDF and Word are allowed | `pic.png: This file type (.png) isn't allowed. Allowed types: .pdf, .docx.` |
| four files when the limit is 3 | `Please select no more than 3 file(s).` |

It reads the file's real content, not only its name. See `docs/FileValidator.md` for every option (sizes, image dimensions, macros in Office files, a malware-scanner hook, server checks).

### 3. Upload widget: a drop area

```html
<div id="zone">
  <label for="files">Choose files</label> <input type="file" id="files" multiple> or drop them here
</div>
<div id="status"></div>
<div id="errors"></div>
<ul id="list"></ul>

<script src="dist/validator.min.js"></script>
<script>
  const zone = FileValidator.widget('#zone',
    { accept: '.pdf,.png', maxFiles: 2, maxFileSizeMB: 2 },          // the same checks as example 2
    { list: '#list', messageElement: '#errors', statusElement: '#status', preview: true, resize: true, paste: true });

  // when the user clicks "Send":
  const data = zone.appendTo(new FormData(), 'files');                // only the accepted files
  fetch('/upload', { method: 'POST', body: data });
</script>
```

What it does when a user drops `a.pdf`, `bad.exe`, `b.pdf` and `c.pdf` on the zone (or picks them, or pastes them):
- `a.pdf` and `b.pdf` are **accepted** and appear in the list, each with its size and a remove button (images also get a thumbnail).
- `bad.exe` and `c.pdf` are **rejected**, and each one is reported: `bad.exe: Files of this type (.exe) can't be uploaded for security reasons.` and `c.pdf: Please select no more than 2 file(s).` The good files are not thrown away because of the bad ones.
- Screen reader users hear `2 files added. 2 files not accepted. 2 selected.`
- Dropping a folder adds every file inside it. With `resize: true`, a photo that is too large is shrunk to fit instead of being rejected. With `paste: true`, Ctrl+V of a screenshot adds it.
- The real `<input>` is kept in sync, so a normal form submit and FormValidator's `file` rule see the accepted files.

### 4. jQuery layer: keep old jQuery Validation code

For a site that already uses the jQuery Validation plugin, replace its scripts and change nothing else:

```html
<!-- before -->
<script src="jquery.js"></script>
<script src="jquery.validate.js"></script>
<script src="additional-methods.js"></script>

<!-- after -->
<script src="jquery.js"></script>
<script src="dist/validator.min.js"></script>
```

```js
// your existing code, unchanged:
$.validator.addMethod('notTest', function (value, element) {
  return this.optional(element) || value.toLowerCase() !== 'test@test.com';
}, 'Please use your real email.');

$('#signup').validate({
  rules:    { email: { required: true, email: true, notTest: true } },
  messages: { email: { required: 'We need your email' } }
});

$('#email').valid();   // true or false, right away, like the original
```

What it does:
- `$('#email').valid()` on an empty field returns `false` and shows `We need your email` (your own message).
- With `test@test.com` it returns `false` and shows `Please use your real email.` from your custom method.
- With a real address it returns `true` and the message is removed.
- The same code now runs on the new engine: accessible error messages (`aria-invalid`, `aria-describedby`), fields added later are validated, and a new `fileValidator` method is available for uploads: `rules: { cv: { fileValidator: { accept: '.pdf', maxFileSizeMB: 5 } } }`.

### Combining them

- **Form with an upload:** add `cv: ['required', { type: 'file', accept: '.pdf', maxFileSizeMB: 5 }]` to the FormValidator rules of example 1. The file is checked with all of FileValidator's checks and the message shows under the field.
- **Form with a drop area:** use example 1 for the form and example 3 for the zone. The widget puts the accepted files into the input, so FormValidator's `required` and `file` rules see them.

## Documentation

`docs/FormValidator.md`, `docs/FileValidator.md` (including the upload widget), `docs/Server-and-Frameworks.md`, `docs/Languages.md`, `docs/Migrating-from-jQuery-Validate.md` and `docs/Accessibility.md`. The same pages are a static site with a live playground: open `docs/index.html`, or turn on GitHub Pages for the `/docs` folder.

Demos to open in a browser: `demo.html` (a form), `demo-upload.html` (the upload widget), `demo-jquery.html` (the jQuery-style API).

## FormValidator

```js
FormValidator.init({
  formId: 'signup',                 // id, selector, element, or an array of them
  rules: {
    email:   ['required', 'email'],
    pw:      [{ type: 'pwcheck', minLength: 8, requireDigit: true }],
    confirm: [{ type: 'equalTo', target: 'pw' }],
    avatar:  [{ type: 'file', allowedExtensions: ['.png', '.jpg'], maxFileSizeMB: 2 }],
    user:    [{ type: 'remote', url: '/api/username-free' }],   // GET by default; method: 'POST' for a POST
  },
  config: { submitHandler(form) { /* ajax */ } },   // omit to use the normal submit
});
```

- Blank optional fields are fine. Only `required` (and `equalTo`, `custom`, `minFiles`, `minChecked`) look at empty values.
- Rules: `required email url number digits alpha alphanumeric phone date minDate maxDate creditcard pattern minlength maxlength rangelength range min max step oneOf equalTo notEqualTo pwcheck minChecked maxChecked minFiles maxFiles fileType fileSize file remote custom`.
- Add your own with `FormValidator.registerRule(...)`, or the jQuery way: `FormValidator.addMethod(name, fn(value, element, param), message)`.
- jQuery-style rules natively: `{ minlength: 3, equalTo: '#pw', remote: '/check' }`, `depends`, `normalizer`, class rules, `data-rule-*`, per-field `messages`.
- Messages can live in the HTML: `<input name="n" required data-msg-required="Please tell us your name">`.
- Accessible errors (`aria-invalid`, `aria-describedby`, focus on the first invalid field). See `docs/Accessibility.md`.
- Live validation, fields added later, `remote` server checks with a `fv-pending` state, `formnovalidate` buttons, `autoRules` from HTML attributes.
- Instance methods: `validate()`, `validateSync()`, `validateField(name)`, `clearErrors()`, `addRules/setRules/removeRules`, `destroy()`. Events: `fv:valid`, `fv:invalid`.

## Replacing the jQuery Validation plugin

FormValidator is the successor of the jQuery Validation plugin. Load the bundle after jQuery (or `dist/formValidator.js` and `dist/formValidator.jquery.js`) and your existing code keeps working:

```html
<script src="jquery.js"></script>
<script src="dist/validator.min.js"></script>   <!-- replaces jquery.validate.js + additional-methods.js -->
```

`$('#f').validate({...})`, `$('#f').valid()`, `$('#x').rules('add', ...)`, `$.validator.addMethod(...)`, all built-in and additional methods, `messages`, `data-rule-*`, class rules, `depends`, `remote`, `groups`, `showErrors`, `highlight`, `errorPlacement`, `submitHandler` and the rest of the API are supported. See `docs/Migrating-from-jQuery-Validate.md`. Uploads get one more method there: `fileValidator`.

## FileValidator

```js
const result = await FileValidator.validateFiles(input.files, {
  accept: '.jpg,.png,application/pdf',   // or allowedExtensions / allowedMimeTypes
  maxFileSizeMB: 5, maxFiles: 3, maxImageWidth: 4000,
});
// result.isValid, result.errors (codes), result.details [{ code, fileName, message, params }], result.files
FileValidator.summary(result);           // ["photo.png: This file is 6 MB but the maximum is 5 MB."]
FileValidator.bind('#upload', config, { messageElement: '#msg', clearOnInvalid: true });
```

**Checked by default, with no configuration**
- dangerous extensions and dangerous MIME types, in any letter case (`.exe`, `.php`, `application/x-msdownload`, ...)
- disguised names (`invoice.exe.pdf`, right-to-left tricks, path separators)
- file content that does not match the extension, and programs renamed to other types (about 45 formats are recognised)
- SVG files that contain scripts
- inside PDF, Office and ZIP files: cut-off or fake files, macros, PDF JavaScript, embedded programs, zip bombs, unsafe paths

**On request**
- its own extension registry (about 110 extensions and their MIME types): `allowedExtensions` alone verifies the file's type, and unknown types are reported
- sizes, counts, total size, empty files, duplicate names and duplicate content, image size and shape, audio and video length
- folder uploads (path depth and safety, junk files like `.DS_Store`)
- your own checks (`FileValidator.addMethod`, `custom`), a malware-scanner hook (`scan`), and server checks (`remote`, sending metadata, a hash, or the file)
- the upload widget: `FileValidator.widget('#zone', config, { list: '#list', preview: true, resize: true, paste: true })`

Every option is listed at the bottom of `src/fileValidator.js` and in `docs/FileValidator.md`.

## Development

```
npm install
npm run build        # src/ -> dist/: the one-file bundle and each part on its own (readable and minified)
npm test             # builds, then runs all tests (jsdom; jQuery 4)
npm run test:jquery3 # the jQuery and accessibility tests again on jQuery 3.x
npm run test:browser # real Chrome, Edge, Firefox and WebKit (needs: npx playwright install)
npm run site         # rebuild docs/*.html from the Markdown docs
```

## Languages

13 language packs ship in `dist/locales/` (de, fr, es, pt, it, nl, tr, ru, pl, ar, hi, zh, ja). One script per language, loaded after the bundle:

```html
<script src="dist/validator.min.js"></script>
<script src="dist/locales/de.min.js"></script>   <!-- or dist/locales/all.min.js -->
<script>
  FVLocales.use('de');                    // FormValidator, FileValidator, the upload widget and the jQuery messages
  // FVLocales.auto();                    // the visitor's browser language, English if there is no pack
  // FVLocales.use('ar', { document: true });   // also sets <html lang="ar" dir="rtl">
</script>
```

In a module project: `import { locales } from 'form-and-file-validator'; import 'form-and-file-validator/locales/de.js'; locales.use('de');`.
Add your own with `FVLocales.register('sv', { name: 'Svenska', form: { required: '...' } })`; anything missing stays English, and `FVLocales.keys()` lists every text a full pack needs.
The packs are machine-quality translations: please have a native speaker check them before shipping to end users.

## Use from a CDN (jsDelivr)

Always pin the exact version and keep the `integrity` attribute, so the file your visitors load can never change:

```html
<script src="https://cdn.jsdelivr.net/gh/Kalam031/form-and-file-validator@3.5.0/dist/validator.min.js"
        integrity="sha384-FXAqBrwzTsTnohplJi7hKPBFXaW4qZcJgCQeNaVwNkrfvXB+8YpfqIgP1wIJ6QKM" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/gh/Kalam031/form-and-file-validator@3.5.0/dist/locales/de.min.js"
        integrity="sha384-WZlzRM5oT0KaCoNtwqY2Rc0XPz+573RflEm/7VmVe+lDXGmIMJIwmRSy/2EbJvsz" crossorigin="anonymous"></script>
<script>FVLocales.use('de');</script>
```

Hashes for every file are in `dist/SRI.json` (they are for version 3.5.0; new releases get new hashes). Available languages: `locales/<code>.min.js` for de, fr, es, pt, it, nl, tr, ru, pl, ar, hi, zh, ja, or `locales/all.min.js`.

## Contributing

Anyone can contribute: fork, change `src/`, open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md). Only reviewed pull requests reach `main`.

## Server, React, Vue, Alpine

- **Server (Node):** `require('form-and-file-validator/server')`: `middleware(rules)` for Express (multer, formidable, express-fileupload) runs the same file rules on the uploaded files and answers 422 with JSON.
- **.NET (ASP.NET Core):** the NuGet package in `dotnet/` runs the same form rules with the same answers as the browser; both are tested against shared vectors (`spec/form-rules.vectors.json`), and the package validates uploaded files too (`FileValidator`, `[FileRules]`; `spec/file-rules.vectors.json`).
- **Angular:** `import { fvValidator, fvControls, fvWatch, fvMessage } from 'form-and-file-validator/angular'`: validators for Reactive Forms, tested on real `@angular/forms`.
- **React:** `import { useFormValidator, FileDropzone } from 'form-and-file-validator/react'`
- **Vue 3:** `import { useFormValidator, FileDropzone, vFormValidator } from 'form-and-file-validator/vue'`
- **Alpine.js:** `dist/integrations/alpine.min.js` adds `x-validate` and `x-dropzone`.

Full examples: [Server and frameworks](docs/Server-and-Frameworks.md), languages: [Languages](docs/Languages.md). A live playground is in the docs site (`docs/playground.html`).

## Known limits

What the package does not do, so you do not rely on it for more than it gives:

- **A file check is not a virus scan.** Content (magic-byte) checks catch renamed files and many disguised types, but cannot prove a file is safe. Scan uploads on the server (the `scan` hook is for that). Many formats cannot be fully verified from their first bytes.
- **Browser checks are a convenience, never the only check.** Repeat the rules on the server with `form-and-file-validator/server`.
- **Image pixel sizes and audio duration need a browser.** On the server they are skipped. In a browser that cannot decode the media (e.g. WebKit builds without codecs) the check is skipped unless you set `requireMediaInfo`.
- **Files are read into memory** for the checks: set an upload size limit in your upload library.
- **Folder picking differs by browser.** For example, Playwright's WebKit on Linux does not pass hidden files such as `.DS_Store` from a picked folder.
- **Country-specific rules** (phone numbers, postcodes, national IDs) are only as complete as the rules built in; add a custom rule for your market.
- **Tested** on Node 18, 20, 22, 24 and 26; Chromium, Firefox and WebKit on Windows and Linux; iPhone and Pixel emulation; Express, Fastify, Koa and Hono. Not tested on real phones, old browsers, or Deno / Bun.

## Tests

`npm test` (jsdom, TypeScript typings, fuzz / ReDoS, real Express / Fastify / Koa / Hono uploads), `npm run test:jquery3`, and `npm run test:browser` (Chrome, Edge, Firefox and WebKit plus iPhone and Pixel emulation, headless, with an axe accessibility audit). CI runs them on every push and pull request.
