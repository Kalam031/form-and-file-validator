# Benchmarks

Measured with `npm run bench` (the script is in `bench/run.mjs`) on Node v24.18.1, 11th Gen Intel(R) Core(TM) i7-1185G7 @ 3.00GHz, 8 cores, win32 10.0.26300, on 2026-10-05.
Absolute numbers depend on the machine: compare the rows with each other, and run `npm run bench` yourself.

## Bundle size (minified + gzip)

| Library | Version | Size | Note |
| --- | --- | --- | --- |
| form-and-file-validator core (checkValue, schema, 47 rules) | 3.14.0 | 12.5 KB | no DOM |
| form-and-file-validator form engine | 3.14.0 | 26.7 KB | DOM forms, 55 rules, 13 messages sets are separate |
| form-and-file-validator everything | 3.14.0 | 72.0 KB | forms + files + widget + jQuery layer |
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
| ajv | 10,753,844 | 0.9 |
| zod | 4,401,796 | 2.3 |
| valibot | 3,905,487 | 2.6 |
| form-and-file-validator | 1,018,807 | 9.8 |
| yup | 190,161 | 52.6 |

**20% invalid**

| Library | Objects / second | ms per 10000 |
| --- | --- | --- |
| ajv | 5,764,686 | 1.7 |
| zod | 1,916,333 | 5.2 |
| valibot | 1,265,326 | 7.9 |
| form-and-file-validator | 912,101 | 11.0 |
| yup | 39,299 | 254.5 |

## Validating a form of 300 fields in the DOM (jsdom, milliseconds, lower is better)

| Library | First validation | Validating again |
| --- | --- | --- |
| form-and-file-validator | 23.5 | 24.8 |
| form-and-file-validator (sync) | 18.7 | 19.6 |
| jQuery Validation | 257.7 | 230.3 |
| Pristine | 64.0 | 28.9 |

## What this measures, and what it does not

- **Size** is the minified and gzipped code a page has to download for a three-field schema (tree-shaken where the library supports it). The form engine, the file validator, the upload widget and the 13 language packs are separate files; the "core" row is the DOM-free part that servers and Server Actions need.
- **Objects**: one schema per library, the same rules (name 2 to 50 characters, a valid email, digits), run on 10000 plain objects. form-and-file-validator reports the first message per field in a language-pack-aware, trimmed form, which is more work than a bare boolean; zod, yup and valibot are asked for their error lists, ajv for its error array. Validation of one object in microseconds is rarely a bottleneck: a form posts once.
- **Forms**: 300 fields in jsdom with required / minlength / email / digits rules. jsdom makes DOM work slower than a browser for everybody, so only the ratios mean something. jQuery Validation and Pristine validate in place; form-and-file-validator also keeps focus, ARIA state and message elements up to date.
- Not measured: bundle sizes of libraries that need a UI framework (React Hook Form, VeeValidate, TanStack Form), memory, time to first render, real browsers.
- A faster library is not a better one for your case: ask which rules you need (files, photo privacy, ASP.NET, Angular, server answers), not only how many objects per second.
