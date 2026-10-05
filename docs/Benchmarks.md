# Benchmarks

Measured with `npm run bench` (the script is in `bench/run.mjs`) on Node v24.18.1, 11th Gen Intel(R) Core(TM) i7-1185G7 @ 3.00GHz, 8 cores, win32 10.0.26300, on 2026-10-05.
Absolute numbers depend on the machine: compare the rows with each other, and run `npm run bench` yourself.

## Bundle size (minified + gzip)

| Library | Version | Size | Note |
| --- | --- | --- | --- |
| form-and-file-validator core (checkValue, schema, 49 rules) | 3.23.0 | 15.9 KB | no DOM |
| form-and-file-validator form engine | 3.23.0 | 33.8 KB | DOM forms, 55 rules, 13 messages sets are separate |
| form-and-file-validator everything | 3.23.0 | 87.6 KB | forms + files + widget + jQuery layer |
| zod (object with 3 fields) | 4.6.5 | 90.5 KB | tree-shaken |
| yup (object with 3 fields) | 1.7.1 | 13.1 KB | tree-shaken |
| valibot (object with 3 fields) | 1.5.0 | 1.4 KB | tree-shaken |
| ajv (schema compiled in the browser) | 8.20.0 | 37.2 KB | no formats |
| jquery.validate + jQuery | 1.22.1 / 4.0.0 | 35.0 KB | both files |
| pristinejs | 1.1.0 | 2.6 KB |  |

## Validating objects (10000 objects with 3 fields; checks per second, higher is better)

**all valid**

| Library | Objects / second | ms per 10000 |
| --- | --- | --- |
| ajv | 11,147,029 | 0.9 |
| zod | 4,056,795 | 2.5 |
| valibot | 2,423,302 | 4.1 |
| form-and-file-validator | 1,118,556 | 8.9 |
| yup | 186,602 | 53.6 |

**20% invalid**

| Library | Objects / second | ms per 10000 |
| --- | --- | --- |
| ajv | 3,279,871 | 3.0 |
| zod | 1,992,072 | 5.0 |
| valibot | 1,755,710 | 5.7 |
| form-and-file-validator | 942,516 | 10.6 |
| yup | 44,493 | 224.8 |

## Validating a form of 300 fields in the DOM (jsdom, milliseconds, lower is better)

| Library | First validation | Validating again |
| --- | --- | --- |
| form-and-file-validator | 23.3 | 19.4 |
| form-and-file-validator (sync) | 21.8 | 27.2 |
| jQuery Validation | 198.9 | 196.9 |
| Pristine | 47.5 | 24.5 |

## What this measures, and what it does not

- **Size** is the minified and gzipped code a page has to download for a three-field schema (tree-shaken where the library supports it). The form engine, the file validator, the upload widget and the 13 language packs are separate files; the "core" row is the DOM-free part that servers and Server Actions need.
- **Objects**: one schema per library, the same rules (name 2 to 50 characters, a valid email, digits), run on 10000 plain objects. form-and-file-validator reports the first message per field in a language-pack-aware, trimmed form, which is more work than a bare boolean; zod, yup and valibot are asked for their error lists, ajv for its error array. Validation of one object in microseconds is rarely a bottleneck: a form posts once.
- **Forms**: 300 fields in jsdom with required / minlength / email / digits rules. jsdom makes DOM work slower than a browser for everybody, so only the ratios mean something. jQuery Validation and Pristine validate in place; form-and-file-validator also keeps focus, ARIA state and message elements up to date.
- Not measured: bundle sizes of libraries that need a UI framework (React Hook Form, VeeValidate, TanStack Form), memory, time to first render, real browsers.
- A faster library is not a better one for your case: ask which rules you need (files, photo privacy, ASP.NET, Angular, server answers), not only how many objects per second.
