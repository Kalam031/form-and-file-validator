# Languages

Every text the library shows can be translated: FormValidator messages, FileValidator messages, file sizes (`MB`, `Mo`…), the sentences of the upload widget (with plural rules) and the jQuery Validation messages.

13 packs ship: **de, fr, es, pt, it, nl, tr, ru, pl, ar (right to left), hi, zh, ja**. English is built in.

> The packs are machine-quality translations. Please have a native speaker read them before you show them to customers, and send corrections as a pull request (`src/locales/<code>.js`).

## In a page

```html
<script src="dist/validator.min.js"></script>
<script src="dist/locales/de.min.js"></script>      <!-- or dist/locales/all.min.js for every language -->
<script>
  FVLocales.use('de');                 // now everything is German
  FVLocales.use('ar', { document: true });   // also sets <html lang="ar" dir="rtl">
  FVLocales.auto();                    // the visitor's browser language (de-AT → de), English when there is no pack
  FVLocales.use('en');                 // back to English
</script>
```

## In a module project

```js
import { locales } from 'form-and-file-validator';
import 'form-and-file-validator/locales/de.js';    // registers the pack
locales.use('de');
```

## On the server

The server companion has its own registry, because it runs its own FileValidator:

```js
const { validate, locales } = require('form-and-file-validator/server');
require('form-and-file-validator/locales/de.js');
locales.use('de');                       // or a language per request: locales.use(req.language) before validate()
```

## Your own language

```js
FVLocales.register('sv', {
  name: 'Svenska',
  form: { required: 'Fältet är obligatoriskt.' },      // only what you have; the rest stays English
  file: { EMPTY_FILE: 'Filen är tom.' },
  units: { B: 'B', KB: 'kB', MB: 'MB', GB: 'GB' }
});
FVLocales.use('sv');
console.log(FVLocales.keys());          // every key a complete pack needs: { form: [...], file: [...], phrases: [...] }
```

A pack is `{ name, dir: 'ltr' | 'rtl', form, file, phrases, units, jquery }`.

| Part | Keys | Placeholders |
| --- | --- | --- |
| `form` | rule type (`required`, `email`, `maxlength`…) | `{min}` `{max}` `{step}` |
| `file` | error code (`SIZE_TOO_LARGE`…) | as in the English text, for example `{size}` `{max}` |
| `phrases` | the English fragment (`'macros'`, `'{n} selected.'`) | as in the English fragment |
| `phrases['status.added']`, `['status.rejected']` | plural objects: `one`, `few`, `many`, `other` (and `zero`, `two` for Arabic) | `{n}` |
| `units` | `B` `KB` `MB` `GB` | — |
| `jquery` | jQuery Validation method name | `{0}` `{1}` |

Form messages are also used for the jQuery layer methods with the same name (`{min}` `{max}` `{step}` become `{0}` `{1}`), so one pack covers both.

Plural forms follow the language's CLDR rules through `Intl.PluralRules`.

## Testing a pack

The test suite checks that every pack has every key, that no text is empty and that every `{placeholder}` of the English text is still there, so a typo cannot break a message at run time.
