# Changelog

Versions of the package follow semver. Each source file also keeps its own changelog in its header.

## Unreleased
- **Dates with a named format**: `date`, `minDate`, `maxDate` take `format` (`d/M/y`, `MM/dd/yyyy`, `yyyy-MM-dd HH:mm`...) or `strict: true` (ISO 8601). Same result in every browser, Node, Angular and .NET. The old `Date.parse` behaviour stays when neither is given.
- **`FormValidator.checkValue()` / `checkValues()`**: check values with the form rules and no DOM (Node, servers, tests, Angular).
- Fix: `pwcheck` counted only A-Z, a-z and 0-9; capital letters, small letters, digits and symbols of every script now count (`Ü`, `Д`, `٣`, `€`), and accented letters are no longer "special characters".
- Fix: `min`, `max`, `range`, `step` no longer accept `0x10`, `Infinity` or other non-decimal numbers (same grammar as `number`).
- **.NET Framework and ASP.NET MVC 5**: the .NET package targets netstandard2.0 (and net8.0, net10.0), has a `[FormRules]` model attribute (one definition for `ModelState` and the browser) and a Razor helper package `FormAndFileValidator.Mvc5`; the vectors pass on the real .NET Framework 4.8.
- **Shared conformance vectors** (`spec/form-rules.vectors.json`, 400 cases) and a **.NET port** (`dotnet/`, NuGet `FormAndFileValidator`) that passes all of them on .NET 8 and 10.

## 3.3.2
- Fix (server): `validate()` crashed with "Maximum call stack size exceeded" on Fastify `@fastify/multipart` parts. They are now read through `toBuffer()`, and a too deeply nested or circular input gives a clear error. Server companion 1.0.1.
- Tests: real HTTP uploads to Express (multer, express-fileupload, formidable), Fastify, Koa and Hono; iPhone and Pixel emulation in the browser suite and CI.
- Docs: tested frameworks and a "Known limits" section.

## 3.3.1
- Fix: PDF scanning with a fractional byte range (small `maxScanMB`) crashed Node 20 (`Blob.slice` assertion). FileValidator 2.7.1.
- CI now passes on Node 18, 20 and 22; links use the repository's final name `form-and-file-validator`.

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
