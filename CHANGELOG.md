# Changelog

Versions of the package follow semver. Each source file also keeps its own changelog in its header.

## 3.13.0
- **Field arrays and nested data** (FormValidator 2.14.0): rule keys can be paths and wildcards, `'user.email'`, `'items[].qty'` (also `items.*.qty`), in `checkValues()`, `schema()` and on forms with repeated rows (rows added later are covered, removed rows stop counting). New rules: `unique` (no two rows share a value, `ignoreCase` optional, works live on a form), `minItems`, `maxItems` (in all 13 language packs). `schema()` output is nested like the input; issues carry token paths (`['items', 1, 'qty']`) and `errors` are keyed by the concrete path (`items[1].qty`). `parseFormData()` + `schema()` validates a repeater form end to end. Flat schemas behave exactly as before.

## 3.12.0
- **`<fv-field>`** (element 1.0.0, in the bundle and as `dist/formValidator.element.js`): any FormValidator rule as native constraint validation in plain HTML, no init call. The rules reach the input through `setCustomValidity()`, so `checkValidity()`, `reportValidity()`, a blocked submit, `:user-invalid` / `:user-valid`, and the browser's bubble follow them. Reward early, punish late: the inline message appears after the user leaves a changed field or tries to submit, and goes the moment the value is right. Cross-field rules, radio and checkbox groups, selects, textareas, language packs, `server="/url"` (Precognition), custom states (`:state(user-invalid)`), the `fv-validate` event. Tested in jsdom and in Chromium, Firefox and WebKit.
- **Angular Signal Forms** (`form-and-file-validator/angular-signals` 1.0.0): `fvSchema(rules)` for `form()` (cross-field `equalTo`, nested paths), `fvValidate`, `fvPrecognition` (async validation with debounce and cancellation), `fvServerErrors` for `submit()`; `validateStandardSchema(p, FormValidator.schema(...))` works as well. Tested on real Angular 22 Signal Forms. Angular bindings 1.1.0: `fvTargets`.

## 3.11.0
- **ASP.NET MVC / Razor unobtrusive validation** (FormValidator 2.13.0): `FormValidator.unobtrusive.auto()` (or `parse()`, or `unobtrusive: true`) validates Razor forms from the `data-val-*` attributes the model produces: `required`, `length`, `minlength`, `maxlength`, `range`, `regex`, `equalto` (with `*.` model prefixes), `email`, `url`, `phone`, `creditcard`, `number`, `digits`, `date`, `fileextensions` and `remote` (GET query string or POST form body, `additionalfields`, server message wins). Messages come from your model; `data-valmsg-for`, `data-valmsg-replace`, `data-valmsg-summary` and the `field-validation-*`, `input-validation-*`, `validation-summary-*` classes work as before. Custom adapters use `adapters.add / addBool / addSingleVal / addMinMax`; the jQuery layer gets `$.validator.unobtrusive.parse` and the same adapters, so `jquery.validate.unobtrusive.js` can be removed. Bad adapters, unknown `data-val-*` and regexes JavaScript cannot compile are reported once and ignored.
- jQuery layer: rules that do not come from jQuery-style settings no longer break message selection.

## 3.10.0
- **Reward early, punish late** (FormValidator 2.12.0): `validateOn` takes presets (`'smart'` is the default behaviour, `'blur'` never nags fields that were only tabbed through, `'input'`, `'submit'`, `'all'`), and `validClass: 'is-valid'` marks a field valid as soon as its value is, while typing; an error is still shown only after the user leaves the field. An `'input'` entry in a `validateOn` list used to be ignored for fields without an error; it now works.
- **Stable error codes**: every message has a code that survives translation: the rule type, `badInput`, `server`, or a rule's own `code`. In `data-code`, `getErrors()`, `onError`, `checkValue()`, `checkValues().details` and schema issues.
- **Accessible error summary**: `errorSummary: true` (or a container) lists every problem with a link to its field, takes focus after a failed submit, follows the form as errors are fixed, and is part of the axe audit. The title is translated in all 13 language packs.
- **autoAttributes**: sets `type`, `inputmode`, `autocomplete` and `aria-required` from the rules and field names (never overriding yours; never `type="number"` for digits), and `inst.lint()` / one console warning flags `autocomplete="off"` on logins, password fields without `autocomplete`, and `type="number"` for codes and phone numbers.

## 3.9.0
- **Server errors in one reader** (FormValidator 2.11.0): `FormValidator.serverErrors(body)` understands problem+json, ASP.NET Core ValidationProblemDetails and classic ModelState, Laravel / Rails, Django REST framework (nested and list serializers, `non_field_errors`), FastAPI / Pydantic, Zod, Standard Schema issues, express-validator, JSON:API and Ajv, and answers `{ errors, all, form }` with one key style (`items[0].qty`). `inst.setServerErrors(body)` shows it on the fields; `setErrors()` now matches `items.0.qty` to the input `items[0].qty`.
- **Precognition**: `FormValidator.precognition(url, values, { only })`, `inst.validateOnServer(url)` and `inst.watchServer(url)` ask your real endpoint "would this pass?" (Laravel Precognition protocol: `Precognition` headers, 204 / 422) without saving anything; stale requests are cancelled and a broken endpoint never shows a false error.
- **React 19 / Server Actions**: `FormValidator.action(rules, serverFn)` returns the `(state, formData) => state` function for `useActionState`; typed values come back so inputs refill after React resets the form; passwords never do. Tested with real React 19. React bindings 1.1.0: `setServerErrors(body)` and `validateOnServer(url)` on `useFormValidator`.

## 3.8.0
- **ReDoS guarantee** (FormValidator 2.10.0): a fuzz test in CI feeds 50,000-character hostile strings to every built-in rule and every jQuery-layer method (country and bank checks included) and fails if one takes longer than 250 ms. New rules are covered automatically through the new `FormValidator.ruleNames()`.
- **SVG hardening** (FileValidator 2.10.0): the SVG scan now also rejects `<!DOCTYPE>` / `<!ENTITY>` (XXE, entity bombs), external `href` / `xlink:href` (remote `<use>`, `<image>`, tracking pixels), CSS `@import` and `url(http...)`, `xml-stylesheet`, and `javascript:` hidden by character references or whitespace. `#id` references, `data:image` pictures and `<a href="https://...">` links stay allowed. It is a linear scan, tested on hostile input.
- **`FormValidator.parseFormData(formData, { coerce })`**: flat fields (`user.email`, `items[0].qty`, `tags[]`, repeated names) become the nested object a schema expects; `File` values pass through; `__proto__` keys and huge indexes are dropped.
- Security fix: the jQuery-layer `strippedminlength` method passed user text to `$()`, which could run `<img onerror>`; it now reads the text in an inert document.

## 3.7.0
- **Standard Schema** (FormValidator 2.9.0): `FormValidator.schema(rules)` turns the rules of an object into one schema that React Hook Form, TanStack Form, Hono, tRPC and every other Standard Schema consumer accepts, with no resolver or adapter of ours. `parse()`, `safeParse()`, `check()` and `['~standard'].validate()` use the same engine, messages and language packs as `checkValues()`.
- **Typed rules**: TypeScript infers the values and the errors from the rules: `InferInput`, `InferOutput`, `InferErrors`. Fields with a `required` rule are required keys, the others optional, and a misspelt field name in `result.errors` does not compile. Checked against the official `@standard-schema/spec` types.
- Tested with React Hook Form's official `standardSchemaResolver` (a dev dependency).
- Types: `versions` lists `formValidator.additional`.

## 3.6.0
- **.NET: server-side file validation.** `FileValidator.Validate` / `ValidateRaw` check `IFormFile`, `HttpPostedFileBase`, streams and bytes with the same checks, error codes and messages as the JavaScript `FileValidator` (dangerous and disguised names, program content under a harmless name, ~45 magic-byte signatures, macros / scripts / bombs in PDF, Office and ZIP, scripts in SVG, image size from the header, limits, allow lists, `Scan` and `Custom` hooks). `[FileRules]` puts the rules on a model property (`ModelState`), `ModelFileRules.ToJson` / `Html.FileRulesJson()` give the matching browser config. Tested against `spec/file-rules.vectors.json` (167 files) on .NET 8, 10, netstandard2.0 and .NET Framework 4.8.
- **19 new form rules** (FormValidator 2.8.0): `integer`, `uuid`, `hexColor`, `slug`, `ipv4`, `ipv6`, `iban`, `time`, `domain`, `base64`, `mac`, `latitude`, `longitude`, `startsWith`, `endsWith`, `contains`, `notOneOf`, `minWords`, `maxWords`. The same answers in JavaScript, Angular and .NET (230 new shared vectors), messages in all 13 language packs.
- **Photo privacy** (FileValidator 2.9.0, widget 1.4.0): `FileValidator.readMetadata(file)` shows what a JPEG, PNG or WebP gives away (EXIF, GPS position, XMP, IPTC, comments); `stripMetadata(file)` removes it without re-encoding and keeps the orientation so photos stay upright; `stripMetadata: true` in the upload widget. .NET: `PhotoPrivacy.Read` / `Strip`, byte for byte the same (`spec/metadata-vectors.json`).
- Tests: the generated .NET tables and all shared vectors are checked for staleness by the JavaScript suite.

## 3.5.0
- **Complete jQuery Validation successor**: every method of the plugin's `additional-methods.js` is now built in (44 country and bank checks that were missing: `cpfBR`, `cnpjBR`, `bic`, `nifES`, `nieES`, `cifES`, `phoneUK`, `postcodeUK`, `postalCodeCA`, `zipcodeUS`, `vinUS`, `abaRoutingNumber`, `currency`, `greaterThan`, `lessThan`, `maxsize`, `maxfiles`, ...) with the same names, parameters and messages. `dist/formValidator.additional.js` (export `./jquery-additional`) is the same set for people who load the separate files. A new test runs the real plugin and this package on the same inputs and requires identical answers.
- jQuery layer: the `onfocusin` and `ariaDescribedByCleanup` settings, `$.validator.normalizeAttributeRule`, and the validator helpers `errorsFor`, `idOrName`, `escapeCssMeta`, `objectLength`, `findLastActive`.
- **Submitting, direct or AJAX**: `FormValidator.isValid(form)`, `config.onSubmit(values, event, inst)`, `inst.handleSubmit(fn)`, `inst.getValues()`, `inst.validateAndGetValues()` and `inst.setErrors()` for server messages, in the core, the jQuery layer, React, Vue and Angular. See "Submitting" in docs/FormValidator.md.
- .NET and MVC 5: `Html.FormValidatorInit("signup", "{ onSubmit: ... }")` takes a config script, and `ModelState.ToErrorMap()` answers AJAX requests in the shape the browser shows; a runnable MVC 5 sample (Mono in Docker, browser-vs-server e2e) is in `examples/mvc5`.
- Fix: the MVC 5 helper XML documentation was incomplete, which failed the build with CS1573.

## 3.4.1
- Docs: an Install section in the README (npm, bundlers, Node, Angular, React / Vue / Alpine, .NET).
- Releases are now published from GitHub Actions with npm trusted publishing (signed provenance, no tokens).

## 3.4.0
- **Dates with a named format**: `date`, `minDate`, `maxDate` take `format` (`d/M/y`, `MM/dd/yyyy`, `yyyy-MM-dd HH:mm`...) or `strict: true` (ISO 8601). Same result in every browser, Node, Angular and .NET. The old `Date.parse` behaviour stays when neither is given.
- **`FormValidator.checkValue()` / `checkValues()`**: check values with the form rules and no DOM (Node, servers, tests, Angular).
- Fix: `pwcheck` counted only A-Z, a-z and 0-9; capital letters, small letters, digits and symbols of every script now count (`Ü`, `Д`, `٣`, `€`), and accented letters are no longer "special characters".
- Fix: `min`, `max`, `range`, `step` no longer accept `0x10`, `Infinity` or other non-decimal numbers (same grammar as `number`).
- **.NET Framework and ASP.NET MVC 5**: the .NET package targets netstandard2.0 (and net8.0, net10.0), has a `[FormRules]` model attribute (one definition for `ModelState` and the browser) and a Razor helper package `FormAndFileValidator.Mvc5`; the vectors pass on the real .NET Framework 4.8.
- **Angular** (`form-and-file-validator/angular`): `fvValidator`, `fvControls`, `fvGroupValidator`, `fvWatch`, `fvMessage` for Reactive Forms, tested on real `@angular/forms` against the shared vectors.
- Fix: the `url` rule no longer asks the browser's `new URL()`: Chrome accepted `http://exa%20mple.com` while Firefox, Safari and Node rejected it. It now follows the URL standard in code that is the same in every browser, Node and .NET.
- Tests: the vectors also run through the real DOM form engine in Chromium, Firefox, WebKit and the iPhone and Pixel profiles.
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
