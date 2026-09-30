# Changelog

Versions of the package follow semver. Each source file also keeps its own changelog in its header.

## 3.3.0
- **Server companion** (`form-and-file-validator/server`): Express / Connect middleware and `validate()` that run the same FileValidator rules on uploads from multer, formidable, express-fileupload, buffers, paths and Web Files. Has its own `locales`.
- **Framework bindings**: React (`useFormValidator`, `<FileDropzone>`), Vue 3 (composable, `v-form-validator`, `<FileDropzone>`, plugin), Alpine.js (`x-validate`, `x-dropzone`), with typings.
- **Docs site** (`docs/*.html`, GitHub Pages ready) generated from the Markdown docs, with a live playground and a language switch. `npm run site`.
- New docs: Languages, Server and frameworks. Site pages pass the axe audit in four browsers.
- Fix: `sideEffects` in package.json no longer lets bundlers drop language packs.
- Fix: several registries (bundle and server) can share the language pack queue.

## 3.2.0
- **Language packs**: `FVLocales` (`FormValidator.locales`, `FileValidator.locales`, ESM export `locales`) with 13 packs: de, fr, es, pt, it, nl, tr, ru, pl, ar (rtl), hi, zh, ja.
  Load `dist/locales/<code>.js` (or `all.js`) and call `FVLocales.use('de')` / `FVLocales.auto()`. Covers FormValidator messages, FileValidator messages, size units, the upload widget's sentences (with plural rules) and the jQuery layer messages. Translations are machine-quality: please have a native speaker review them.
- Types for the registry (`types/locales.d.ts`), `./locales/*` package export.
- Tests: pack completeness (every key, every placeholder), language switching, plural rules, `auto()`, jQuery messages.

## 3.1.0
- Hardening: linear-time filename trimming, sanitized configuration, guarded user callbacks, fuzz / ReDoS tests, Web Worker hashing for very large files.
- Real-browser test suite (Chromium, Firefox, WebKit) with `npm run test:browser`.
- ES module build (`dist/validator.mjs`), TypeScript typings and a package `exports` map.

## 3.0.0
- One-file bundle (`dist/validator.js`) with FormValidator 2.x, FileValidator 2.x, the upload widget and the jQuery Validation compatibility layer; sources moved to `src/`.

## 2.x / 1.x
- FormValidator became the successor of the jQuery Validation plugin (methods, `addMethod`, `data-msg-*`, remote validation with GET by default, groups, `showErrors`).
- FileValidator: extension/MIME registry, dangerous file blocking, content signatures, deep PDF / Office / ZIP checks, malware-scan hook, duplicate detection, folder paths, upload widget.
