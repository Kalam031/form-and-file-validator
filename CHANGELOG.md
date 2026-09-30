# Changelog

Versions of the package follow semver. Each source file also keeps its own changelog in its header.

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
