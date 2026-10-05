# FormValidator v2.15.0 — Documentation

## Overview

FormValidator checks an HTML form before it is submitted, shows a clear message under each bad field, and lets the form through only when everything is valid. It has no dependencies. jQuery, Select2 and Bootstrap are optional.

**What it can do**

- Blocks invalid submits, including when you validate asynchronously (server checks, custom rules).
- 30+ built-in rules: required, email, url, number, phone, date ranges, credit card, pattern, lengths, ranges, password strength, equal-to, checkbox counts, file rules, and more.
- Skips blank values for optional fields, so an empty optional email is not an error.
- Validates every kind of control: text, textarea, select, multi-select, checkbox and radio groups, file inputs.
- Live feedback: an error clears or updates as the user fixes the field.
- Server-side checks with the `remote` rule (timeout, caching, stale-request cancel).
- Validates uploads with FileValidator through the `file` rule.
- Accessible errors: `aria-invalid`, `aria-describedby`, `role="alert"`, focus on the first bad field.
- Works with fields added after page load, several forms at once, and Bootstrap, input groups and Select2 layouts.
- Custom rules, conditional rules, translated messages, and callbacks and DOM events.

**Loading it**

```html
<script src="dist/fileValidator.js"></script>  <!-- optional: needed only for the "file" rule -->
<script src="dist/formValidator.js"></script>
```

One-file alternative: `<script src="dist/validator.min.js"></script>` carries FormValidator, FileValidator, the upload widget and the jQuery layer. With CommonJS or a bundler: `const FormValidator = require('./dist/formValidator.js')`. Check the loaded version with `FormValidator.version` (currently 2.7.0). It is also the successor of the jQuery Validation plugin: see [Migrating-from-jQuery-Validate.md](Migrating-from-jQuery-Validate.md).

## Quick start

Give the form an id, then call `FormValidator.init` with the rules for each field, keyed by the field's `name`.

```html
<form id="signup" action="/register" method="post">
  <input name="email">
  <input name="password" type="password">
  <input name="confirm" type="password">
  <label><input type="checkbox" name="terms" value="1"> I accept the terms</label>
  <button type="submit">Create account</button>
</form>

<script>
  FormValidator.init({
    formId: 'signup',
    rules: {
      email:    ['required', 'email'],
      password: [{ type: 'pwcheck', minLength: 8, requireDigit: true }],
      confirm:  [{ type: 'equalTo', target: 'password', message: 'Passwords do not match.' }],
      terms:    [{ type: 'required', message: 'Please accept the terms.' }]
    }
  });
</script>
```

**What happens on submit**

1. The submit is stopped, and other submit handlers do not see an invalid attempt.
2. Every field is checked. Each bad field gets a message under it and the first one is focused.
3. If all fields are valid, the form is submitted normally. If you set `config.submitHandler`, it is called instead, which is the place for AJAX submits.
4. After that, each error updates as the user edits the field.

Rules can be written as a string (`'required'`), an object (`{ type: 'minlength', min: 3 }`), or a list of either. `formId` can also be an element, a CSS selector, or an array of forms.

## Submitting: direct, AJAX and the validated values

Every form ends in one of two ways: the browser posts it (**direct submit**), or your code sends it (**AJAX**: fetch, axios, `$.ajax`, an HttpClient). Both need the check first, and AJAX needs the validated values. This is all of it:

| You want | Use | Returns |
| --- | --- | --- |
| A valid form posts normally, an invalid one is blocked | `FormValidator.init({ formId, rules })` and nothing else | |
| A true / false right now (like jQuery's `valid()`) | `FormValidator.isValid(form)` | `boolean` (sync) |
| A true / false that waits for remote and file checks | `await FormValidator.validate(form)` | `boolean` |
| AJAX in one step | `config.onSubmit(values, event, inst)` | your function may return `{ errors: { field: message } }` |
| AJAX with your own event wiring (React, Vue, Angular, `addEventListener`) | `inst.handleSubmit(fn)` | an event handler |
| The values to send | `inst.getValues()` or `await inst.validateAndGetValues()` | `{ field: value }` / `{ valid, values, errors }` |
| Show messages that your server sent back | `inst.setErrors({ email: 'Already registered' })` | names that matched no field |

```js
const inst = FormValidator.init({ formId: 'signup', rules: { email: ['required', 'email'] } });

// 1. Direct submit: nothing more to write. A valid form is posted by the browser, an invalid one is blocked and the messages show.

// 2. Check yourself, true / false:
form.addEventListener('submit', e => { if (!FormValidator.isValid(form)) e.preventDefault(); });   // direct, your own listener
if (FormValidator.isValid(form)) { /* ... */ }                                                      // before your own AJAX call

// 3. AJAX, the short way: called only for a valid form, with the validated values
FormValidator.init({ formId: 'signup', rules: { email: ['required', 'email'] }, config: {
  onSubmit: async (values) => {
    const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) return await res.json();            // { errors: { email: 'Already registered' } } is shown on the field
  }
} });

// 4. AJAX with your own wiring (any framework): handleSubmit stops the native submit, validates, calls you only for a valid form
form.addEventListener('submit', inst.handleSubmit(async (values, event) => { await api.post('/signup', values); }));
```

**What `getValues()` returns.** Text is trimmed the way the validation saw it (passwords never are). A checkbox group and a multiple select give an array, a radio group its chosen value, a file field the `File` objects. Like a native submit, unchecked boxes and unchosen radios are left out and disabled fields are skipped. Send it as JSON, or build a `FormData` for files.

**The server's answer.** Return (or pass to `setErrors`) the messages your server produced, keyed by the field `name`; they appear in the same place and style as the browser's own messages. Names are matched exactly, then ignoring case, so an ASP.NET `Email` finds `email`.

**Two things to know.** While an `onSubmit` request runs, a second click is ignored. And in a framework where you attach your own `onSubmit` (React, Vue), call `handleSubmit(...)` while rendering, as the examples do: the wrapper then switches off the engine's own submit interception, otherwise it would swallow the event before your handler sees it.

The jQuery layer has the same abilities in jQuery's own style: `submitHandler(form, event, values)`, `onSubmit`, `validator.getValues()`, `validator.handleSubmit(fn)` and `validator.showErrors({...})`.

## Rules reference

Blank values skip every rule except `required`, `equalTo`, `custom`, `minFiles` and `minChecked`. That is what lets an optional field stay empty. Put `required` first to make a field mandatory. Rules run in order and the first failure is shown.

| Rule | Options | Passes | Fails |
| --- | --- | --- | --- |
| `required` | | any non-blank value, a checked box or radio, a chosen option, a selected file | blank or whitespace only, nothing checked |
| `email` | | `a@b.co`, `first.last+tag@sub.example.org` | `a@b`, `a b@c.de`, `@b.co` |
| `url` | `requireProtocol`, `allowLocal`, `protocols` | `https://example.com`, `www.example.com/x` | `ftp://x.com` (unless allowed), `not a url` |
| `number` | | `1`, `-1.5`, `.5`, `1e3` | `abc`, `1,5`, `1.2.3` |
| `digits` | | `123` | `-1`, `1.5` |
| `alpha`, `alphanumeric` | | letters (any language), letters and digits | spaces, symbols |
| `phone` | | `+1 (555) 123-4567`, `555-1234` | `123`, `abc` |
| `date` | `format`, `strict` | `2024-02-29`; with `format: 'd/M/y'`: `5/3/2024` | `2024-13-45`; `31/4/2024` |
| `minDate`, `maxDate` | `min` / `max` (date or `'today'`) | on or after / before the limit | outside the limit |
| `creditcard` | | numbers that pass the Luhn check | `4111111111111112` |
| `pattern` | `pattern` (string or RegExp), `flags` | matches the pattern | does not match |
| `minlength`, `maxlength`, `rangelength` | `min`, `max` | length within the limit | too short or long |
| `min`, `max`, `range` | `min`, `max` | number within the limit | outside the limit, or not a number |
| `step` | `step`, `base` | multiples of the step | `3` with step 5 |
| `oneOf`, `notOneOf` | `values` | one of the listed values / none of them | anything else / a listed value |
| `integer` | | `0`, `-5`, `+7`, `007` | `1.5`, `1e3`, `0x10` |
| `uuid` | | `123e4567-e89b-12d3-a456-426614174000` (versions 1-8, any letter case) | missing hyphens, a wrong version or variant |
| `hexColor` | | `#fff`, `#FFFF`, `#a1b2c3`, `#A1B2C3D4` | `fff`, `#ff`, `#ggg` |
| `slug` | | `hello-world`, `2024` | `Hello`, `a--b`, `-a`, `a_b` |
| `ipv4`, `ipv6` | | `192.168.1.1`; `::1`, `2001:db8::1`, `::ffff:1.2.3.4` | `256.1.1.1`, `01.2.3.4`; `1::2::3` |
| `iban` | | `DE89 3704 0044 0532 0130 00` (spaces and any letter case; the mod-97 check) | a wrong check digit or length |
| `time` | | `09:05`, `23:59:59` | `24:00`, `9:05`, `12:60` |
| `domain` | | `example.com`, `sub.example.co.uk`, `xn--p1ai.xn--p1ai` | `example`, `a..com`, `-a.com`, `http://example.com` |
| `base64` | | `aGVsbG8=`, `YQ==` | `aGVsbG8`, `YQ=`, `a GVs` |
| `mac` | | `00:1A:2b:3C:4d:5E`, `00-1a-2b-3c-4d-5e` | mixed separators, a wrong length |
| `latitude`, `longitude` | | `-90`, `45.5`; `-180`, `-122.4194` | `90.1`; `180.1` |
| `startsWith`, `endsWith`, `contains` | `value` | the text starts / ends with / includes it (case matters; use `pattern` for more) | otherwise |
| `minWords`, `maxWords` | `min` / `max` | pieces between whitespace that hold a letter or digit of any script (`a b c` is 3) | too few / too many |
| `equalTo`, `notEqualTo` | `target` (field name) | same / different from the target field | mismatch; blank confirm when the target is filled |
| `pwcheck` | `minLength`, `maxLength`, `requireUppercase`, `requireLowercase`, `requireDigit`, `requireSpecialChar`, `noWhitespace` | meets all listed requirements | any requirement missing |
| `minChecked`, `maxChecked` | `min` / `max` | enough / not too many ticked boxes or selected options | outside the count |
| `minFiles`, `maxFiles` | `min` / `max` | file count in range | outside the range |
| `fileType` | `types` (extensions or MIME, `image/*`) | allowed type | other types |
| `fileSize` | `maxSize` (bytes) or `maxSizeMB` | every file within the limit | a file is too large |
| `file` | any FileValidator option | passes every FileValidator check | see the FileValidator doc |
| `remote` | `url`, `method`, `field`, `data`, `headers`, `timeout`, `cache`, `failOpen`, `parse` | server says valid | server says invalid, or network error |
| `custom` | `validate(value, context, field)` | your function returns true | returns false, a message string, or throws |

### Dates: name the format

`05/03/2024` is the 5th of March in one country and the 3rd of May in another, so the `date`, `minDate` and `maxDate` rules never guess. Say what you expect:

```js
rules: {
  born:  { date: { format: 'd/M/y' } },                                   // 5/3/2024, 05/03/2024, 29/2/2024 (leap year checked)
  start: { date: { format: 'MM/dd/yyyy' }, minDate: { format: 'MM/dd/yyyy', min: 'today' } },
  slot:  { date: { format: 'yyyy-MM-dd HH:mm' } },
  iso:   { date: { strict: true } }                                       // only yyyy-MM-dd or yyyy-MM-ddTHH:mm[:ss]
}
```

| Token | Meaning |
| --- | --- |
| `yyyy`, `y` | four-digit year (0001 to 9999) |
| `yy` | two-digit year: 00-69 is 20xx, 70-99 is 19xx |
| `MM` / `M`, `dd` / `d` | month, day: two digits / one or two digits |
| `HH` / `H`, `mm` / `m`, `ss` / `s` | hour (0-23), minute, second |

Any other character is literal. The calendar is checked (`31/4`, `29/2/2023` fail). The answer is identical in every browser, in Node, in Angular and in the .NET package. A `date` rule with neither `format` nor `strict` keeps the old behaviour (the browser's own `Date.parse`), which differs between browsers, so use one of the two in shared rules. `min` / `max` are written in the same format; `'today'` is the current calendar date.

### Checking values without a form

```js
FormValidator.checkValue('a@b', ['required', 'email']);
// { valid: false, rule: 'email', message: 'Please enter a valid email address.' }

FormValidator.checkValues(body, {                      // a JSON body, a model, a unit test
  email: ['required', 'email'],
  pw:    { required: true, pwcheck: { minLength: 8, requireUppercase: true } },
  pw2:   { equalTo: 'pw' }
});
// { valid, errors: { pw2: 'Values do not match.' }, details: { pw2: { rule: 'equalTo', message: '...' } } }
```

No DOM is needed, so this runs in Node, in tests and in the Angular validators. File, checkbox-count and remote rules need a form or a server and throw. Options: `trim`, `values` (the other fields), `messages` (per rule type).

### <fv-field>: rules in plain HTML, as native validation

`<fv-field>` wraps a native input and gives it any FormValidator rule, **without an init call**. The rules are handed to the browser with `setCustomValidity()`, so `form.checkValidity()`, `reportValidity()`, a blocked submit, the native `:user-invalid` / `:user-valid` pseudo-classes and the browser's bubble all follow them. It is part of the bundle and registers itself (`dist/formValidator.element.js` is the same code on its own).

```html
<form>
  <fv-field rules="required email">
    <label for="e">Email</label>
    <input id="e" name="email">
  </fv-field>
  <input type="password" name="pw">
  <fv-field rules="required equalTo:pw"><label>Repeat <input type="password" name="pw2"></label></fv-field>
  <fv-field rules="required minlength:3 pattern:^[A-Z]+$"><input name="code"></fv-field>
  <fv-field rules='[{"type":"minDate","min":"2020-01-01","message":"Too early"}]'><input name="since"></fv-field>
  <fv-field rules="required" server="/signup"><input name="username"></fv-field>   <!-- asks your endpoint when the user leaves it -->
  <button>Save</button>
</form>
```

- **Rules**: names separated by spaces, with an optional parameter after a colon (`minlength:3`, `range:1,10`, `pattern:^[A-Z]+$`); or JSON, a list or the map shorthand (`{"minlength":3}`). Properties `el.rules`, `el.messages` do the same from script.
- **Reward early, punish late**: the browser's validity is always up to date, but the message under the field (`<div class="fv-error" role="alert">`) appears after the user leaves a field they changed (or after a submit attempt, `reportValidity()`), never for a field they only tabbed through, and disappears the moment the value is right. A cancelled `invalid` event means our message replaces the browser's bubble; add `native-bubble` to keep the bubble.
- **Cross-field**: `equalTo` / `notEqualTo` read the other fields of the form, and the field is re-checked when they change.
- **Inputs**: text-like inputs, textareas, selects, checkbox and radio groups (`control="#id"` picks one when there are several inputs). Rules that need files or a form object are ignored with one console warning.
- **Server**: `server="/url"` runs the Precognition request (`server-encoding="json"`, `server-delay`) after the field passes the browser rules, was visited and holds a value; its message blocks the submit until the value changes. A failed check changes nothing.
- **Styling and scripting**: `.fv-error`, `fv-field[data-state="invalid"]`, `[data-shown]`, `input:user-invalid`, and `fv-field:state(user-invalid)` where the browser has custom states. Event `fv-validate` (`detail: { valid, rule, code, message, shown }`), methods `validate()`, `reportValidity()`, `reset()`, `setServerError(text)`. Language packs and message overrides (`messages='{"required":"Fill me"}'`) work as everywhere.
- Like the native pseudo-classes, `checkValidity()` fires `invalid`, so a field that gets one shows its message.
- Another tag name: `FormValidator.fieldElement.define('my-field')`.

### Input masks

`FormValidator.mask(input, pattern, options)` formats a text field while the user types: `9` a digit, `a` a letter (any alphabet), `*` a letter or digit, `\` makes the next character a literal.

```js
const phone = FormValidator.mask(document.querySelector('#phone'), '(999) 999-9999', { onComplete: (value, raw) => console.log(raw) });
phone.value;     // '(555) 123-4567'
phone.raw;       // '5551234567'
phone.complete;  // true
phone.update('99-99');  phone.destroy();
```

It keeps the caret where the user is (also when typing in the middle), handles paste (formatted or not, with extra characters, over a selection), backspace over a literal, IME composition (nothing is touched until the composition ends) and very long pastes. `trailing: true` shows the literals before the next character is typed. Validate with the **`mask` rule**: `{ mask: '(999) 999-9999' }` (a complete value; empty is left to `required`), read the typed characters with `FormValidator.unmaskValue(value, pattern)` and get the regular expression with `FormValidator.maskPattern(pattern)`. `<fv-field mask="...">` and `data-fv-mask="..."` (below) do both.

### Declarative forms: data-fv, for CMS pages and plain HTML

No script of your own: put the rules in the markup and add one attribute to the script tag.

```html
<form data-fv data-fv-config='{"errorSummary":true,"validClass":"is-valid"}'>
  <input name="email" data-fv="required email" data-msg-required="Tell us your email">
  <input name="zip" data-fv="required digits minlength:5" data-fv-mask="99999">
  <input name="note">                                       <!-- no data-fv: not validated -->
  <button>Send</button>
</form>
<script src="validator.min.js" data-fv-auto></script>      <!-- or: FormValidator.auto() -->
```

- **Rules** use the same text format as `<fv-field rules>`: names with optional parameters (`minlength:3`, `range:1,10`, `pattern:^a:b$`), or JSON (`data-fv='["required",{"type":"email"}]'`). `FormValidator.parseRules(text)` does the parsing.
- **Config** for a form is JSON in `data-fv-config`; `FormValidator.auto(config)` takes a base config for all of them. `data-msg-<rule>` sets messages as everywhere.
- **Forms added later** (AJAX, modals, partial views) are started by themselves; `auto()` returns a function that stops it. A form that already has a validator is left alone.

### Password strength and breached passwords

`FormValidator.passwordStrength(password, { userInputs })` is a fast, **offline** estimate for a strength meter or a minimum (about 1 KB of common passwords; nothing is downloaded or sent):

```js
FormValidator.passwordStrength('Tr0ub4dor&3', { userInputs: [email, name] });
// { score: 3, label: 'good', bits: 72.3, length: 11, feedback: [] }       score 0 very weak ... 4 strong
FormValidator.passwordStrength('P@ssw0rd');   // { score: 0, feedback: ['common', 'add-length'], ... }
FormValidator.watchPasswordStrength(input, r => { meter.value = r.score; hint.textContent = r.label; }, { userInputs: () => [email.value] });   // returns stop()
```

Characters in a keyboard run (`qwerty`, `12345`, `abcd`), a repeat, a year or a piece of what the site knows about the user count as about one bit; a common password, also written with substitutions (`P@ssw0rd`) or a few characters added, scores 0. Feedback codes: `too-short`, `common`, `sequence`, `repeated`, `user-input`, `only-letters`, `only-digits`, `add-length` (translate them in your UI). It has no dictionary of ordinary words, so it is a guide, not a guarantee.

As rules (the add-on is in the bundle; `dist/formValidator.password.js` on its own):

```js
rules: { password: { pwcheck: { minLength: 8 }, pwscore: 3, pwned: true } }
rules: { password: { pwscore: { min: 3, userFields: ['email', 'name'] } } }   // those fields' values do not count as secret
```

- **`pwscore`** needs at least that score (default 3, "good"); messages in all 13 language packs.
- **`pwned`** asks Have I Been Pwned's range API whether the password appeared in a known breach. **Only the first 5 characters of the SHA-1 hash are sent** (k-anonymity), never the password, and the request asks for padded answers. It is asynchronous: a form waits for it on submit and skips it while typing; `checkValue` cannot run it (use `await FormValidator.pwned(password)` on a server: it answers the count, `0`, or `null` when it could not check). Options: `maxCount` (allowed times seen, default 0), `timeout` (5000 ms), `failOpen` (default `true`: when the service cannot be reached the user is not blocked; `false` blocks), `url` for your own mirror.
- Passwords are never trimmed by any of these rules, in `checkValue` and `schema()` too.

### Cross-field rules, state, wizard steps and explain

**Rules that look at other fields** (the other values come from the form, or from `checkValue(value, rules, { values })`, or from the data in `checkValues` / `schema`, same row first):

| Rule | Example | Meaning |
| --- | --- | --- |
| `requiredIf` | `{ requiredIf: 'country' }`, `{ requiredIf: { field: 'country', equals: 'US' } }`, `{ field, in: ['US', 'CA'] }`, `{ field, notEquals: 'x' }` | Required when the other field is filled in / equals / is one of / differs. A checkbox group counts as filled in when something is checked. |
| `dateAfter`, `dateBefore` | `{ dateAfter: 'start' }`, `{ dateAfter: { field: 'start', inclusive: true, format: 'd/M/y' } }` | This date is later / earlier than the other field's (no opinion while the other is empty). |
| `atLeastOne` | `{ atLeastOne: ['phone', 'email'] }` | This field or one of the listed fields is filled in. |
| `sumEquals` | `{ sumEquals: { fields: ['p2', 'p3'], total: 100 } }` | This value plus the listed fields add up to `total` (empty counts as 0). |

On a form, a field with such a rule is checked again when one of the fields it looks at changes. Messages exist in all 13 language packs (`requiredIf` says "required").

**`inst.state`** (or `inst.getState()`): what a UI needs without keeping its own bookkeeping.

```js
inst.state;
// { valid, errorCount, dirty, pristine, touched, validating, submitCount, submitted,
//   fields: { email: { value, dirty, pristine, touched, pending, valid, error, code } } }
const stop = inst.onStateChange(state => render(state));   // once per tick when errors, touched, dirty, pending or the submit count change
```

`dirty` compares with the value the form had when the validator started (or after `resetForm()`), so typing something and then back is pristine again; `touched` is set when the user leaves a field; `pending` while a remote check runs; `submitCount` counts submit attempts. `resetForm()` starts over.

**Wizard steps**: `await inst.validateStep('#step1')` (an element, a selector or a list of field names) validates only the fields inside the step, shows the messages, focuses the first invalid one and answers `true` or `false`; it fires `onError` / `fv:invalid` for that step. Fields in hidden steps are skipped, so `validate()` at the end still checks everything.

**`FormValidator.explain(value, rules, options)`** answers "why does this value fail?" rule by rule, without stopping at the first failure:

```js
FormValidator.explain('ab', ['required', { type: 'minlength', min: 3 }, 'email']);
// [ { rule: 'required', code: 'required', passed: true },
//   { rule: 'minlength', code: 'minlength', param: [3], passed: false, message: 'Please enter at least 3 characters.' },
//   { rule: 'email', code: 'email', passed: false, message: 'Please enter a valid email address.' } ]
```

A rule that is skipped says why (`skipped: 'empty value: ...'`, a `when` that said no, `unknown rule`, a rule that needs a form).

### Smaller builds: the core and your own subset

Most servers, serverless functions, React Server Actions and tests only need to check values, not drive a `<form>`. Two ways to ship less:

**`form-and-file-validator/core`** (about 12 KB gzip against 27 KB for the form engine, 73 KB for the whole bundle): the DOM-free part with every rule that needs no form.

```js
import { checkValue, checkValues, schema, action, serverErrors, precognition, parseFormData } from 'form-and-file-validator/core';
```

It has no `init()`, `validate()`, `isValid()`, `unobtrusive` and no jQuery layer, and leaves out the rules that need a form, files or a server (`file`, `fileType`, `fileSize`, `minFiles`, `maxFiles`, `minChecked`, `maxChecked`, `remote`). Everything else gives the same answers as the full build (the shared vectors are run against both). A script-tag version is `dist/formValidator.core.min.js`.

**Your own subset**: keep only the rules you use.

```sh
npm i -D terser acorn          # the builder needs them; the library itself has no dependencies
node node_modules/form-and-file-validator/tools/build-subset.js --rules=required,email,minlength,pattern --no-engine --format=esm --out=src/fv.min.mjs
node node_modules/form-and-file-validator/tools/build-subset.js --list      # every rule name
```

Options: `--rules=a,b,c` (default all), `--no-engine` (drop the form engine), `--format=umd|esm`, `--out=file`. From code: `const { build } = require('form-and-file-validator/tools/build-subset.js'); const { code, rules, size, gzip } = await build({ rules: [...], engine: false })`. A rule you leave out answers `unknown rule "name"`. Size is guarded in the test suite (gzip budgets for every file of `dist/`), so a release cannot grow without anyone noticing.

### ASP.NET MVC and Razor: data-val-* (unobtrusive validation)

Drop-in for `jquery.validate.unobtrusive.js`, without jQuery. Razor renders the model's attributes (`[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`, `[Compare]`, `[RegularExpression]`, `[Remote]` ...) as `data-val-*` attributes and `data-valmsg-for` / `data-valmsg-summary` placeholders; this reads them, so a Razor form validates in the browser with the messages from your model and no JavaScript of your own.

```html
<script src="~/Scripts/validator.min.js"></script>
<script>FormValidator.unobtrusive.auto();</script>   <!-- every form with data-val fields, now and when added later (partial views, AJAX, modals) -->
```

```js
FormValidator.unobtrusive.parse();                    // once, for forms that are on the page now (document, a selector or an element)
FormValidator.unobtrusive.parse('#modal', { focusInvalid: false });   // with your own config
FormValidator.init({ formId: 'f', rules: {}, config: { unobtrusive: true } });   // or for one form
```

Supported adapters (the ones MVC ships): `required`, `length` (`min` / `max`), `minlength`, `maxlength`, `range`, `regex` (the whole value must match, like MVC), `equalto` (`*.Password` is resolved against the model prefix of the field, `Model.Confirm` finds `Model.Password`), `email`, `url`, `phone`, `creditcard`, `number`, `digits`, `date`, `fileextensions`, and `remote` (`url`, `type`, `additionalfields`; sent as a query string for GET and as a form body for POST, your `[Remote]` action answers `true`, `false` or a message, and a message the server returns replaces the attribute's).

- **Messages** come from the attributes; an empty `data-val-x=""` uses the library's default.
- **Markup and classes MVC's CSS already knows**: the message goes into `<span data-valmsg-for="Email">` (with `field-validation-valid` / `field-validation-error`), the field gets `input-validation-error` / `input-validation-valid`, `data-valmsg-replace="false"` keeps your static text, and `<div data-valmsg-summary="true"><ul>` becomes the list of messages with `validation-summary-errors` / `validation-summary-valid`. Your own `errorClass`, `invalidClass`, `errorElement` still win.
- **Checkboxes** (`CheckBoxFor` renders a hidden twin), radio groups, selects, file inputs and optional empty fields work.
- **Server errors**: `inst.setServerErrors(modelStateJson)` reads classic `ModelState` and ValidationProblemDetails into the same spans.
- **Custom adapters** use the API you already know: `FormValidator.unobtrusive.adapters.add('name', ['p'], options => { options.rules.myRule = options.params.p; options.messages.myRule = options.message; })`, `addBool`, `addSingleVal`, `addMinMax`. The rule itself is registered with `FormValidator.addMethod(name, (value, element, param) => ...)` (or `registerRule`). An adapter that uses a rule that is not registered, an unknown `data-val-x`, a regex that JavaScript cannot compile and an adapter that throws are each reported once in the console and ignored; the rest of the form keeps working.
- **jQuery pages**: `$.validator.unobtrusive.parse(selector)` and `$.validator.unobtrusive.adapters.add / addBool / addSingleVal / addMinMax` exist with the same signatures, `$('form').valid()` works. It is not run automatically; call `parse` on ready (and after AJAX), like `jquery.validate.unobtrusive.js` asked you to.

### Server errors: one reader for every backend

`FormValidator.serverErrors(body)` turns what your backend answered into `{ errors, all, form }`, whatever framework wrote it. It never throws; unreadable input gives empty results.

```js
const r = FormValidator.serverErrors(await response.json());
r.errors;  // { email: 'Already registered', 'items[0].qty': 'Must be at least 1' }   first message per field
r.all;     // { email: ['Already registered', 'Not a valid address'], ... }              every message
r.form;    // ['Try again later']                                                       messages that belong to no field
r.format;  // 'problem+json' | 'errors-map' | 'aspnet-modelstate' | 'issues' | 'fastapi' | 'zod' | 'field-map' | 'generic' | 'none'
```

Understood without any setting: RFC 9457 problem+json and ASP.NET Core `ValidationProblemDetails`, classic ASP.NET `ModelState` (the `model.` prefix is removed), Laravel and Rails (`{ errors: { field: [..] } }`, dotted paths such as `items.0.name`), Django REST framework (field lists, `non_field_errors`, nested serializers, list serializers), FastAPI / Pydantic (`{ detail: [{ loc, msg }] }`, the `body` / `query` prefix is dropped), Zod (`issues`, `flatten()`), Standard Schema issue lists, express-validator, JSON:API (`source.pointer`) and Ajv (`instancePath`). A body that names no field (`{ message: 'Server error' }`, problem+json without `errors`) goes to `form`. Force a layout with `{ format: 'laravel' }` if a body is ambiguous.

Field keys are written one way, `items[0].qty`, so `items.0.qty`, `items[0][qty]` and `['items', 0, 'qty']` are the same field. Keys such as `__proto__` are dropped.

On a form, show the answer on the fields in one call:

```js
const inst = FormValidator.getInstance(form);
const r = inst.setServerErrors(await response.json());   // { errors, all, form, format, missed }
r.form;     // show these yourself, near the submit button
r.missed;   // field names that match no input
inst.clearServerErrors();                                 // or setServerErrors(body, { clear: true })
```

`setErrors(map)` now also matches a field written another way (`items.0.qty` finds the input named `items[0].qty` or `items[0][qty]`).

### Ask the server: Precognition

Some rules only the server can answer ("is this username taken", "does this coupon exist"), and you do not want a second copy of the rules. `precognition` sends the values to the same endpoint your form posts to, with the header `Precognition: true`, and the endpoint validates and stops (Laravel does this out of the box; any backend can: answer `204` for "would pass" or `422` with errors). Nothing is saved.

```js
const r = await FormValidator.precognition('/signup', { email, name }, { only: ['email'] });
r.valid;   // true: the server accepts it | false: r.errors names the fields | null: could not check (r.error), or cancelled (r.aborted)
r.errors;  // { email: 'Already registered' }  only the fields you asked about

// on a form: shows the answer on the fields, cancels an older request, keeps the browser's own messages
await inst.validateOnServer('/signup', { only: ['email'] });
const stop = inst.watchServer('/signup', { exclude: ['coupon'] });   // checks each field when the user leaves it
```

- **Headers**: `Precognition: true`, `Precognition-Validate-Only: email,name` (when `only` is set), `Accept: application/json`. Add your own with `headers` (CSRF token) and `credentials`.
- **Body**: JSON by default, `encoding: 'form'` for a classic form body, `'multipart'` (automatic when a `File` is among the values), or `method: 'GET'` for the query string.
- **Never throws**: network errors, timeouts (`timeout`, 10 s), 5xx and unreadable answers give `valid: null`, so a broken endpoint never blocks the user and never shows a false error. Your real submit still validates.
- **`watchServer`** checks a field only when it holds a value, passes the browser rules and is not excluded; passwords are never sent unless you set `excludePasswords: false`; only that field's errors are shown.
- Answers from `422`, `400` and `409` are read with `serverErrors`, so every backend listed above works.

### React 19, Server Actions and any FormData handler

`FormValidator.action(rules, serverFn)` is one function for `useActionState`, Server Actions and plain `FormData` handlers. It reads the fields, checks them with the rules (the same engine as `schema()`), and only for valid input calls your function.

```jsx
// actions.js  ('use server' works too: the same function runs on the server, so the form works before JavaScript loads)
export const signup = FormValidator.action(
  { email: ['required', 'email'], password: { required: true, pwcheck: { minLength: 8 } } },
  async (values, formData) => {
    const user = await db.users.create(values);          // values: validated, trimmed text
    return user.exists ? { errors: { email: 'Already registered' } } : { id: user.id };
  });

// Signup.jsx
const [state, formAction, pending] = useActionState(signup, signup.initialState);
<form action={formAction}>
  <input name="email" defaultValue={state.values.email} />     {/* typed values come back: React clears the form after an action */}
  <p>{state.errors.email}</p>
  <input name="password" type="password" />                     {/* passwords are never handed back */}
  <button disabled={pending}>Sign up</button>
</form>
```

State: `{ ok, values, errors, form, result }`. Invalid input never reaches your function. The function may return `{ errors: {...} }` or any backend body `serverErrors` understands (they land in `errors` / `form`); other return values arrive as `result`. Errors you throw are not swallowed (React's error boundary sees them). Repeated fields (checkbox groups) arrive joined with `,` (`join` option). `omitValues: ['field']` keeps more fields out of `values`. You may pass an existing `FormValidator.schema(...)` instead of rules.

### Field arrays and nested data: wildcard rules, unique rows, minItems

Rules can point into nested objects and arrays, in `checkValues()`, `schema()` and on forms with repeated rows:

```js
const order = FormValidator.schema({
  title:          'required',
  'user.email':   ['required', 'email'],                                   // a nested path
  'items[].sku':  ['required', { type: 'unique', ignoreCase: true }],      // every row; no two rows may share a SKU
  'items[].qty':  ['required', 'digits'],
  items:          { minItems: 1, maxItems: 20 }                            // the array itself
});
const r = order.safeParse(await request.json());           // JSON body
const r2 = order.safeParse(FormValidator.parseFormData(new FormData(form)));   // a repeater form posted as flat fields (items[0].sku ...)
r.errors;   // { 'items[1].qty': 'Please enter digits only.', 'items[0].sku': 'This value is used more than once.', ... }
r.issues;   // [{ path: ['items', 1, 'qty'], message, rule, code }]   (Standard Schema paths, indexes are numbers)
r.data;     // { title, user: { email }, items: [{ sku, qty }, ...] }    trimmed, nested like the input; only validated paths are kept
```

- **Path keys**: `user.email`, `items[0].qty`, `items.0.qty`; wildcards for every row: `items[].qty`, `items.*.qty`, `items[*].qty`. A wildcard over a missing or empty array checks nothing (use `minItems` for "at least one row"); a plain path through missing data is a blank value.
- **Row rules**: `unique` (`ignoreCase: true` optional) fails every row that repeats a value in its column, empty values are not compared, values are compared trimmed; it also works for a list of plain values (`'tags[]': 'unique'`). `minItems` / `maxItems` check the array at that path. Messages exist in all 13 language packs.
- **equalTo / notEqualTo** inside a row look at the same row first (`'rows[].confirm': { equalTo: 'pw' }` compares with `rows[i].pw`), then at an absolute path.
- A key that really is a field name in your data (`'a.b'`, PHP's `'items[]'`) still wins over path reading; keys such as `__proto__` are ignored.
- **On a form**: `rules: { 'items[].sku': ['required', 'unique'], 'items[].qty': 'digits' }` applies to every field named `items[0].sku`, `items[1].sku`... (or `items.0.sku`), including rows added later; removed rows stop counting; `unique` compares with the other rows live. Whole-array rules (`minItems`) are for data: run the schema on `parseFormData(new FormData(form))`.
- TypeScript: a schema with path keys has loose types (`Record<string, any>`); flat schemas keep the exact types.

### parseFormData: flat form fields to a nested object

`FormValidator.parseFormData(input, options?)` turns a `<form>`, `FormData`, `URLSearchParams`, a list of `[name, value]` pairs or a plain object into the nested object your schema or API expects. Use it in a server action, a Next.js route or the browser.

```js
FormValidator.parseFormData(new FormData(form));
// name="user.email", name="items[0].qty", name="items[1].qty", name="tags[]" (twice), name="color" (checkboxes, twice)
// -> { user: { email }, items: [{ qty }, { qty }], tags: [..], color: ['red', 'blue'] }

FormValidator.parseFormData(formData, { coerce: true }); // "42" -> 42, "3.5" -> 3.5, "true" -> true; "01234" and "+4915" stay text
```

- `a.b`, `a[b]` and `a[0]` nest; `a[]` appends; the same name twice makes an array. A later nested key replaces an earlier plain value.
- `File` values pass through untouched.
- Safe on untrusted input: `__proto__`, `constructor`, `prototype`, indexes above 999, more than 20 levels and malformed keys are dropped.

### Schema: one definition for any library (Standard Schema)

`FormValidator.schema(rules)` turns the rules of an object into **one schema** that follows the [Standard Schema](https://standardschema.dev) specification, the interface that React Hook Form, TanStack Form, Hono, tRPC and others read. You write the rules once; no resolver package of ours, no adapter of yours.

```js
const signup = FormValidator.schema({
  email:    ['required', 'email'],
  password: { required: true, pwcheck: { minLength: 8, requireDigit: true } },
  confirm:  { equalTo: 'password' },
  nick:     { minlength: 3 }
});

signup.parse(req.body);          // { email, password, confirm, nick } as trimmed text, or throws ValidationError
const r = signup.safeParse(req.body);
r.success;                       // false
r.errors;                        // { confirm: 'Values do not match.' }
r.issues;                        // [{ message, path: ['confirm'], rule: 'equalTo' }]
signup['~standard'].validate(x); // what other libraries call: { value } or { issues }
```

- **Same engine as `checkValues()`**: the same rules, messages, language packs and answers (also in the .NET package). File, checkbox-count and `remote` rules need a form or a server and throw, like in `checkValues()`.
- **Values** are text, trimmed (passwords exactly as typed; `trim: false` keeps spaces). Numbers, booleans and `null` are read like a form reads them (`21` is `'21'`, `null` is blank). A field that is missing counts as blank; fields that are not in the rules are dropped.
- **Options** (second argument): `messages`, `trim`, `passwordStrength`, `context`, as in `checkValues()`.
- **`parse()`** throws a `ValidationError` with `issues` (Standard Schema issues plus the failed `rule`) and `errors` (`{ field: message }`). **`safeParse()`** never throws for invalid data.

React Hook Form (tested with its official `standardSchemaResolver`):

```js
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
const { register, handleSubmit, formState: { errors } } = useForm({ resolver: standardSchemaResolver(signup) });
```

**Typed in TypeScript.** The rules give the types, nothing is written twice: fields with a `required` rule are required keys, the others optional, and error keys are the field names.

```ts
import type { InferInput, InferOutput, InferErrors } from 'form-and-file-validator';
type SignupIn = InferInput<typeof signup>;     // { email: string; password: string } & { confirm?: string; nick?: string }
type SignupErrors = InferErrors<typeof signup>; // { email?: string; password?: string; confirm?: string; nick?: string }
const result = signup.safeParse(body);
if (!result.success) result.errors.email;       // string | undefined, a misspelt field name does not compile
```

### One answer on every platform

`spec/form-rules.vectors.json` lists hundreds of values with the expected result for every rule (letters of every script, JavaScript's whitespace, URL edge cases, leap years, passwords). The JavaScript engine, the Angular package and the [.NET package](Server-and-Frameworks.md#net-aspnet-core) all run that same file in their tests.

Passwords are never trimmed. All other values are trimmed before checking unless you set `config.trim` to `false`.

## Configuration options

`FormValidator.init` takes these top-level keys:

| Key | Meaning |
| --- | --- |
| `formId` (or `form`) | Form id, CSS selector, element, or an array of these |
| `rules` | Object keyed by field `name`; each value is a rule or a list of rules |
| `config` | The options in the table below |
| `context` | Your own object, passed to `custom` rules next to `form` |
| `messages` | Message overrides by rule type, same as `config.messages` |

Options inside `config`:

| Option | Default | Meaning |
| --- | --- | --- |
| `trim` | `true` | Trim values before checking. Passwords are never trimmed. |
| `novalidate` | `true` | Sets `novalidate` on the form so browser pop-ups do not clash with yours. Restored on `destroy()`. |
| `focusInvalid` | `true` | Focus and scroll to the first invalid field after a failed submit |
| `validateHidden` | `false` | Also check fields that are hidden, `type="hidden"`, or not rendered |
| `ignore` | `null` | CSS selector of fields to skip |
| `validateOn` | `'smart'` (= `['change']`) | When a field with no error yet is checked: a preset (`'smart'`, `'blur'`, `'input'`, `'submit'`, `'all'`) or a list of `'change'`, `'blur'`, `'input'`. See Live validation |
| `validClass` | `''` | Class for a field that holds a valid value (`'is-valid'`); appears while typing, an error never does |
| `rewardOnInput` | `true` | `false`: `validClass` only after a real check |
| `errorSummary` | `false` | `true`, a selector, an element or `{ container, title, focus, withLabel, headingLevel, className }`: the accessible list of all problems |
| `unobtrusive` | `false` | Read ASP.NET `data-val-*` attributes and use `data-valmsg-for` / `data-valmsg-summary` (see ASP.NET MVC and Razor) |
| `autoAttributes` | `false` | `true` or `{ type, inputmode, autocomplete, ariaRequired, lint }`: set autofill and keyboard attributes, lint the markup |
| `debounce` | `150` | Milliseconds to wait while typing before re-checking a field that has an error |
| `errorElement` | `'div'` | Tag used for the message |
| `errorClass` | `'text-danger error'` | Class of the message element |
| `invalidClass` | `'is-invalid'` | Class added to invalid fields. Use `''` to turn off. |
| `messages` | `{}` | Per-form message text by rule type |
| `passwordStrength` | `{}` | Defaults for `pwcheck` (`minLength`, `requireDigit`, ...) |
| `errorPlacement` | `null` | `(errorEl, field, fields) => void` to place the message yourself |
| `submitHandler` | `null` | `(form, event) => void`, called instead of a normal submit when the form is valid |
| `onError` | `null` | Called with `[{ name, field, message }]` after a failed check |
| `onSuccess` | `null` | Called after a successful check |
| `autoRules` | `false` | Also build rules from HTML attributes and `data-rule-*` (see Live validation) |
| `classRules` | `null` | `{ className: rules }`, applied to fields that carry the class (see the jQuery-style API section) |
| `pendingClass` | `'fv-pending'` | Class (and `aria-busy`) on a field while a server or async check runs. `''` turns it off. |
| `focusCleanup` | `false` | Clear a field's error when it receives focus |
| `skipEmptyUntilSubmit` | `false` | Do not check an empty field on blur or change until the first submit attempt |
| `validateAfterSubmit` | `false` | After the first submit attempt, re-check every field as the user types |
| `liveInput` | `true` | `false` stops re-checking while typing (only change and blur) |
| `interceptSubmit` | `true` | `false` leaves the form's submit event alone, so you call `validate()` yourself |
| `skipSubmitter` | `null` | CSS selector of submit buttons that skip validation, like `formnovalidate` |
| `highlight`, `unhighlight` | `null` | `(field, unit) => void`, called when a field turns invalid or is cleared |
| `onFieldValid` | `null` | `(field, unit) => void`, called after a field was checked and passed |
| `fieldRules` | `null` | `(field, unit) => rules[]`, extra rules worked out at check time |
| `resolveMessage` | `null` | `(rule, env, dynamicMessage) => string`, takes over choosing the message |

Global defaults for all forms can be changed in `FormValidator.defaults`.

## Messages and translations

Every rule has a friendly default message. Messages are set as plain text, so they can never inject HTML. The message shown is the first of these that exists:

1. `message` on the rule, as text or as a function `(field, rule, env) => string`.
2. `data-msg-<rule>` on the field, for example `data-msg-required="Please tell us your name"`.
3. A message returned by the check itself, such as a `remote` server reply or a FileValidator error.
4. `data-msg` on the field: one message used for every rule of that field.
5. `config.messages[ruleType]` for this form.
6. `FormValidator.messages[ruleType]`, the global defaults.

Text can use placeholders taken from the rule's own options:

```js
rules: {
  bio:   [{ type: 'maxlength', max: 200, message: 'At most {max} characters, please.' }],
  price: [{ type: 'range', min: 5, max: 50 }]   // default: "Please enter a value between 5 and 50."
}
```

**Messages in the HTML.** As in jQuery Validation, a field can carry its own messages, so the markup is self-contained:

```html
<input name="fullname" required data-msg-required="Please tell us your name">
<input name="email" type="email" required
       data-msg-required="We need your email" data-msg-email="That does not look like an email">
<input name="age" data-msg="Please check this field">      <!-- used for any rule of this field -->
```

Combine it with `config.autoRules: true` to get rules and messages from the HTML alone. The attribute name is the rule name in lower case, or with dashes for camelCase rules (`data-msg-mindate` or `data-msg-min-date`). Placeholders such as `{min}` work in these messages too, and the text is always set as plain text.

**Language packs.** 13 ready-made languages (de, fr, es, pt, it, nl, tr, ru, pl, ar, hi, zh, ja) translate these messages, the FileValidator messages, the upload widget and the jQuery messages in one call: load `dist/locales/de.min.js`, then `FVLocales.use('de')` (or `FVLocales.auto()` for the visitor's browser language). See [Languages.md](Languages.md). Error messages carry `dir="auto"`, so right-to-left text reads correctly inside a left-to-right page.

**Translating everything once, by hand**

```js
Object.assign(FormValidator.messages, {
  required: 'Pflichtfeld',
  email: 'Bitte eine gültige E-Mail-Adresse eingeben.',
  minlength: 'Mindestens {min} Zeichen.'
});
```

The message keys are the rule names: `required`, `email`, `url`, `number`, `digits`, `alpha`, `alphanumeric`, `phone`, `date`, `minDate`, `maxDate`, `creditcard`, `pattern`, `maxlength`, `minlength`, `rangelength`, `range`, `max`, `min`, `step`, `oneOf`, `notOneOf`, `integer`, `uuid`, `hexColor`, `slug`, `ipv4`, `ipv6`, `iban`, `time`, `domain`, `base64`, `mac`, `latitude`, `longitude`, `startsWith`, `endsWith`, `contains`, `minWords`, `maxWords`, `notEqualTo`, `equalTo`, `pwcheck`, `minChecked`, `maxChecked`, `minFiles`, `maxFiles`, `fileType`, `fileSize`, `file`, `remote`, `custom`, plus `badInput` for an unparseable number field.

## Error display and accessibility

**Where the message appears**

| Field type | Message goes |
| --- | --- |
| Text, textarea, select, file | right after the field |
| Field inside `.input-group` or `.form-floating` | after that wrapper |
| Select2 dropdown | after the `.select2` container |
| Radio or checkbox group | after the group container (`.answer`, `.btn-group`, `.option-group`, `.choice-group`, `.checkbox-group`), else after the last option |

There is only ever one message per field, and re-checking replaces it instead of adding another. To place messages yourself, use `errorPlacement`:

```js
config: { errorPlacement: (errorEl, field) => document.querySelector('#errors').appendChild(errorEl) }
```

**What is added to the page**

- The message element gets the classes in `errorClass` (default `text-danger error`), the attribute `data-error-for="<field name>"`, an id, and `role="alert"`. A `<label>` message gets `aria-live="polite"` instead, because ARIA does not allow `role="alert"` on a label. Accessibility is covered in `Accessibility.md`.
- The invalid field gets the class in `invalidClass` (default `is-invalid`), `aria-invalid="true"`, and the message id added to `aria-describedby`. Existing `aria-describedby` values are kept.
- When the field is fixed, all of this is removed again.

**Focus**

After a failed submit, the first invalid field in page order is focused and scrolled into view. Turn this off with `focusInvalid: false`.

**Which fields are checked**

Disabled fields, hidden fields (`hidden` attribute or `display: none`, including inside a hidden parent), `type="hidden"` inputs and fields matching `ignore` are skipped, and any stale message on them is removed. Set `validateHidden: true` to check them anyway. Fields with the same `name` (like `items[]`) are each checked on their own.

Style the messages with your own CSS; the library adds no stylesheet.

### Stable error codes

Every message has a code that does not change when you translate or reword it: the rule type (`required`, `email`, `minlength`, `equalTo` ...), `badInput` for letters typed into a number field, and `server` for messages from `setError` / `setServerErrors`. Give a rule its own code with `code`:

```js
rules: { coupon: [{ type: 'pattern', pattern: '^[A-Z0-9]+$', code: 'coupon.format', message: 'Use capital letters and digits.' }] }
```

Where you find it: `data-code` on the message element (for tests and analytics), `code` and `rule` in `getErrors()` and in the list given to `onError`, `code` in `checkValue()`, `checkValues().details` and the issues of `schema()`. `setError(name, message, code)` takes one too.

### Accessible error summary

`errorSummary` adds the pattern GOV.UK and the WCAG techniques recommend for long forms: after a failed submit, focus moves to one list of every problem, each a link to its field.

```js
FormValidator.init({ formId: 'signup', rules, config: { errorSummary: true } });                  // builds the box at the top of the form
FormValidator.init({ formId: 'signup', rules, config: { errorSummary: '#problems' } });          // or fills your own container
FormValidator.init({ formId: 'signup', rules, config: { errorSummary: { title: 'Please fix these', headingLevel: 3, focus: 'field', withLabel: false } } });
```

- **Markup**: a focusable container (`tabindex="-1"`, `aria-labelledby` its heading), a heading, a list of links. Each link goes to the field, which gets an `id` if it has none; a radio or checkbox group goes to its first input. The field's label is put in front of the message (`Email: This field is required.`) so the list makes sense out of context (`withLabel: false` to turn that off).
- **It follows the form**: when the user fixes a field its line disappears, when none are left the box hides. It is rebuilt with fresh nodes (and only when something changed) so screen readers announce what is new, not the whole list again.
- **Focus**: by default the summary takes the focus; `focus: 'field'` keeps the classic move to the first invalid field.
- **When**: after a failed submit or `validate({ submit: true })`. Calling `inst.showSummary(true)` shows it on demand.
- Messages are put in as text, never HTML. The title is translated (`FormValidator.messages.errorSummary`, all 13 language packs) unless you pass `title`.

### autoAttributes: autofill and the right keyboard

Browsers fill forms and phones choose a keyboard from `type`, `inputmode` and `autocomplete`. Most forms get them wrong (`type="number"` for a postcode, `autocomplete="off"` on a login). `autoAttributes: true` sets them from your rules and the field names, and never replaces an attribute you wrote:

| You have | It sets |
| --- | --- |
| `email` rule | `type="email"`, `inputmode="email"`, `autocomplete="email"` (`username` when the name says login or user) |
| `url`, `phone` rules | `type="url"` / `type="tel"`, matching `inputmode` and `autocomplete` |
| `digits` rule | `inputmode="numeric"` (never `type="number"`: it drops leading zeros and reacts to the mouse wheel) |
| `number` rule | `inputmode="decimal"` |
| `creditcard` rule, or a name like `card_number`, `cvc` | `inputmode="numeric"`, `autocomplete="cc-number"` / `cc-csc` |
| password field | `new-password` when it has a `pwcheck` or `equalTo` rule, there is more than one password field, or the name says new / confirm / signup; otherwise `current-password` |
| names such as `first_name`, `lastName`, `zip`, `city`, `otp`, `country` | `given-name`, `family-name`, `postal-code`, `address-level2`, `one-time-code` (+ numeric keypad), `country-name` ... |
| a `required` rule | `aria-required="true"` (not `required`: the browser would show its own bubbles) |

`type` is only changed on a field that has none or `text`. Turn parts off with `autoAttributes: { type: false, ariaRequired: false }`. Fields added later are set up when they first get focus (or call `inst.refreshAttributes()`); `inst.attributeChanges` lists what was set.

**Lint.** With `autoAttributes` on, one `console.warn` lists markup problems: `autocomplete="off"` on logins, emails and addresses (browsers and password managers ignore it and it blocks autofill), a password field without `autocomplete`, and `type="number"` on codes, zip codes, phone and card numbers. `inst.lint()` returns them as `{ field, name, code, message, fix }`; `autoAttributes: { lint: false }` silences the warning.

## Live validation and dynamic forms

**Reward early, punish late (`validateOn`).** Research on form UX is consistent: show success as soon as it is true, show errors only when the user has moved on. That is the default (`'smart'`): nothing is said while a field is typed into, the check runs when the user leaves an edited field, and a field that already shows an error is re-checked as they type, so the message disappears the moment it is fixed. Choose another timing with a preset, or a list of events:

| `validateOn` | Behaviour |
| --- | --- |
| `'smart'` (default, same as `['change']`) | Check after the user leaves an edited field or picks an option; live fixing of fields in error. |
| `'blur'` | Check on every blur, but never nag a field the user only tabbed through (empty fields wait for the first submit). |
| `'input'` | Check while typing (after `debounce`). The most aggressive; fine for usernames, pointless for emails. |
| `'submit'` | Nothing until the first submit; afterwards fields in error are fixed live. |
| `'all'` | `change`, `blur` and `input`. |
| `['change', 'input']` | Your own list. (An `'input'` entry works now: in 2.11 and before it was ignored for fields without an error.) |

Set `validClass: 'is-valid'` to reward early: a field gets the class as soon as its value is valid, **while typing**, and an error is still never shown on input. A field that turns invalid while typing just loses the class and gets its message when the user leaves it. `rewardOnInput: false` adds the class only after a real check. Empty fields are never marked valid, and `resetForm()` clears the class.

**While the user types**

- A field with no error is left alone while typing, so nobody is scolded halfway through an email address.
- It is checked when the events in `validateOn` fire (default: `change`, which is when the user leaves a text box after editing it, or picks an option).
- Once a field shows an error, it is re-checked as the user types (after the `debounce` delay) and the message updates or disappears.
- `remote` rules run on change and submit, never on every keystroke.

**Confirm-password style fields.** If a rule uses `equalTo` or `notEqualTo`, changing the target field re-checks the dependent field, even when the target has no rules of its own.

**Fields added later.** Listeners sit on the form, so inputs added or replaced after `init` get validated on submit and get live feedback with no extra work. Removed fields are simply ignored. Rules can be changed at any time:

```js
const form = FormValidator.init({ formId: 'order', rules: {} });
form.addRules('coupon', ['required', { type: 'pattern', pattern: /^[A-Z0-9]{6}$/ }]);
form.removeRules('coupon');
```

**Buttons that skip validation.** A submit button with the `formnovalidate` attribute, such as "Save draft", submits without validating.

**Rules from HTML attributes.** With `autoRules: true` the library also reads the markup:

| Attribute | Rule added |
| --- | --- |
| `required` | `required` |
| `type="email"`, `"url"`, `"number"`, `"date"` | `email`, `url`, `number`, `date` |
| `minlength`, `maxlength` | `minlength`, `maxlength` |
| `min`, `max` on number/range | `min`, `max` |
| `pattern` (with `title` as the message) | `pattern`, anchored like HTML |
| `accept` on a file input | `file` |

A rule you list yourself for the same type wins over the one from the markup.

**Number fields.** When a browser reports unparseable input in a `type="number"` field (for example letters), it is reported with the `badInput` message instead of passing as blank.

**Reset.** A form `reset` clears all messages.

## Custom and conditional rules

**One-off rule with `custom`.** The function receives the value, your context object (which includes `form`), the field element, and an environment object. It may be sync or async.

```js
rules: {
  username: [{ type: 'custom', validate: (value, ctx, field) => !value.includes(' '), message: 'No spaces.' }],
  coupon:   [{ type: 'custom', validate: async (v) => (await api.checkCoupon(v)) || 'Coupon not valid' }]
}
```

What the function may return:

| Return value | Result |
| --- | --- |
| `true` | valid |
| `false`, `undefined`, or an exception | invalid, with the rule's message |
| a non-empty string | invalid, and the string is the message |
| `{ valid: false, message: '...' }` | invalid with that message |

**Reusable rule with `registerRule`.** Register once, then use the name anywhere.

```js
FormValidator.registerRule('evenNumber', (value, rule, env) => Number(value) % 2 === 0);
FormValidator.messages.evenNumber = 'Please enter an even number.';

FormValidator.init({ formId: 'f', rules: { qty: ['required', 'evenNumber'] } });
```

By default a rule is skipped for blank values. Pass `{ runOnEmpty: true }` as the third argument when your rule must also run on blank fields. The `env` object gives you `field`, `fields` (all boxes of a group), `form`, `config`, `context`, `empty`, `count` (ticked boxes, chosen options, or files) and `files`.

**Conditional rules with `when`.** The rule applies only when the function returns true.

```js
rules: {
  company: [{ type: 'required', when: () => document.querySelector('[name=type]').value === 'business' }]
}
```

**Other ways to write rules.** A whole field can be one string (`email: 'required'`) or a map (`email: { required: true, email: 'Bad address' }`, where a string value is the message and an object value holds the options).

## Server checks and file fields

**The `remote` rule** asks your server whether a value is acceptable, for example whether a username is free.

```js
rules: {
  username: ['required', { type: 'remote', url: '/api/username-free', message: 'That name is taken.' }]
}
```

By default it sends a `GET` request with the value in the query string (`/api/username-free?username=bob`), like jQuery Validation. For a `POST`, set `method: 'POST'` on the rule: the body is JSON `{ "username": "bob" }`, or a classic form body with `encoding: 'form'`. To make `POST` the default for every remote rule, set `FormValidator.remoteDefaults.method = 'POST'` (and `.encoding = 'form'` if you want form bodies). The server answers with JSON:

| Response | Result |
| --- | --- |
| `true` or `"true"` | valid |
| `false` or `"false"` | invalid, with the rule's message |
| `{ "valid": false, "message": "Taken" }` | invalid, with the server's message |
| any other text, like `"Already registered"` | invalid, with that text as the message |

Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `url` | required | Endpoint to call |
| `method` | `'GET'` | `'GET'` puts the value in the query string, `'POST'` sends it in the body. Global default: `FormValidator.remoteDefaults.method`. |
| `encoding` | `'json'` | Body of a `POST`: `'json'` or `'form'` (`application/x-www-form-urlencoded`). Global default: `FormValidator.remoteDefaults.encoding`. |
| `field` | field name | Key that carries the value |
| `data` | none | Extra fields, or a function `(value, env) => object` |
| `headers`, `credentials` | none | Passed to `fetch` |
| `timeout` | `10000` | Milliseconds before the request is cancelled |
| `cache` | `true` | Reuse the answer for the same value |
| `parse` | none | `(json, response) => result` to adapt a different response shape |
| `failOpen` | `false` | Treat network or server errors as valid. By default they block the form. |

The check never runs for blank values or while the user is typing. A newer request cancels an older one, and a slow answer for an old value is ignored.

**File fields.** Use the `file` rule to apply every FileValidator check, or the lighter `fileType`, `fileSize`, `minFiles` and `maxFiles` rules:

```js
rules: {
  resume: ['required', { type: 'file', accept: '.pdf,.docx', maxFileSizeMB: 5 }],
  photos: [{ type: 'minFiles', min: 1 }, { type: 'maxFiles', max: 6 }, { type: 'fileType', types: ['image/*'] }]
}
```

The first FileValidator message is shown under the field (with several files it starts with the file name, like `bad.exe: ...`), and the check also runs as soon as the user picks files. In the jQuery compatibility layer the same checks are available as the `fileValidator` method. The full FileValidator options are described in its own document ([FileValidator.md](FileValidator.md)).

## Instance API, callbacks and events

`FormValidator.init(...)` returns an instance for one form, or an array when `formId` is an array.

| Method | What it does |
| --- | --- |
| `validate(options)` | Checks the whole form. Resolves to `true` or `false`. `{ focus: false }` skips focusing the first error. |
| `validateSync(options)` | Synchronous check of the whole form. Answers from asynchronous rules (`remote`, `file`, async `custom`) count as valid until they arrive, then the message appears. |
| `validateField(name)` | Checks one field by name |
| `validateElement(el)`, `validateElementSync(el)` | Checks the field that contains this element |
| `getErrors()` | Current errors as `[{ name, field, fields, message }]` |
| `setError(name, message)`, `clearError(name)` | Show or remove a message by hand, for example from a server reply |
| `resetForm()` | Clears messages and forgets that a submit was attempted |
| `clearErrors()` | Removes all messages and invalid marks |
| `setRules(name, rules)`, `addRules(name, rules)`, `removeRules(name)` | Change rules at any time |
| `destroy()` | Removes listeners and messages, restores `novalidate`, and lets you `init` again |

Static functions on `FormValidator`:

| Function | What it does |
| --- | --- |
| `init(options)` | Set up one or more forms. Calling it again on the same form replaces the old setup. |
| `validate(formId)` | Check an initialised form |
| `validate(formId, rules)` | Check any form against ad-hoc rules, using the form's config if it has been set up |
| `getInstance(formId)` | Get the instance of a form, or `null` |
| `registerRule(name, fn, options)` | Add a rule (engine style: `fn(value, rule, env)`) |
| `getRule(name)` | The registered rule function, or `null` |
| `locales` | (one-file bundle) The language pack registry, same object as `FVLocales`: `use`, `auto`, `register`, `list` |
| `useJQuery($)` | Install the jQuery Validation layer on a jQuery that loaded after the bundle |
| `addMethod(name, fn, message)` | Add a rule, jQuery style: `fn.call(this, value, element, param)` |
| `addClassRules(name, rules)` | Rules for every field that has a CSS class |
| `format(text, ...params)` | Fill `{0}`, `{1}`; with one argument it returns a message function |
| `setDefaults(options)` | Change the global config defaults |
| `messages`, `defaults`, `version` | Global messages, global defaults, and the version string |

The older `form._manualValidate()` hook still works.

**Callbacks**

```js
config: {
  onError:   errors => console.log(errors),   // [{ name, field, message }, ...]
  onSuccess: () => console.log('all good')
}
```

**DOM events** fire on the form, and bubble, which suits frameworks and analytics:

```js
form.addEventListener('fv:invalid', e => console.log(e.detail.errors));
form.addEventListener('fv:valid', () => console.log('valid'));
```

**Submitting.** With no `submitHandler`, a valid form is submitted with `form.requestSubmit()`, so the button that was clicked, its name and value, and your other submit listeners are all preserved. With `submitHandler`, only your function runs.

## jQuery-style API on the native engine

If you know the jQuery Validation plugin, the native `FormValidator` speaks the same language, without jQuery.

**Scalar rule parameters**

```js
FormValidator.init({ formId: 'signup', rules: {
  email:    { required: true, email: true, remote: '/api/email-free' },
  password: { minlength: 8, normalizer: v => v.trim() },
  confirm:  { equalTo: '#password' },                 // a selector, or a field name: equalTo: 'password'
  age:      { range: [18, 99] },                      // or '18,99'
  role:     { oneOf: ['admin', 'user'] },
  code:     { pattern: '^[A-Z]{3}\\d+$', messages: { pattern: 'Three capitals and digits' } },
  company:  { required: '#is-business:checked' },     // a dependency: required only when the selector matches
  vat:      { minlength: { param: 9, depends: () => needsVat() } }
}});
```

`required` is always checked first and `remote` last. A string value on a rule that has no parameter, such as `email: 'Not an email'`, is the message. The object form `{ minlength: { min: 3, message: '...' } }` still works.

**Your own methods with `addMethod`**

```js
FormValidator.addMethod('multipleOf', function (value, element, param) {
  return this.optional(element) || value % param === 0;   // this.optional(el): blank fields pass
}, FormValidator.format('Multiples of {0} only'));

FormValidator.init({ formId: 'f', rules: { qty: { multipleOf: 5 }, size: { between: [1, 9] } } });
```

The method gets `(value, element, param)`. Like in jQuery it also runs on blank values unless it calls `this.optional(element)`. It may return `true`, `false`, a message string, `{ valid, message }`, or a Promise, and `'dependency-mismatch'` skips the rule. The message can be text with `{0}`/`{1}` placeholders, or a function `(param, element) => string`.

**Class rules and `data-rule-*`**

```js
FormValidator.addClassRules('zip', { required: true, digits: true, minlength: 5, maxlength: 5 });
FormValidator.init({ formId: 'f', rules: {}, config: { classRules: { phone: { phone: true } } } });
```

```html
<input name="zip" class="zip">
<input name="age" data-rule-required data-rule-range="[18,99]" data-msg-range="Between {0} and {1}">
```

Class rules work without any other option. `data-rule-*` needs `autoRules: true`. Later sources win for the same rule type: class rules, then HTML and `data-rule-*`, then the rules you list in `init`.

**Messages per field**

```js
FormValidator.init({ formId: 'f', rules: { /* ... */ }, messages: {
  email:    { required: 'We need your email', email: 'That is not an email' },   // per field, per rule
  nickname: 'Please fix your nickname',                                           // one message for the whole field
  required: 'This field is required.'                                             // by rule type, as before
}});
```

Order: `message` on the rule, then per-field `messages`, `data-msg-<rule>`, a message returned by the check, `data-msg`, per-type `messages`, the global defaults.

**Remote checks, jQuery style**

```js
rules: { user: { remote: '/check' } }                    // GET /check?user=bob
rules: { user: { remote: { url: '/check', type: 'post', data: { token: () => csrf() }, dataFilter: r => r.ok } } }   // POST
```

`type` is the HTTP method, values in `data` may be functions, and `dataFilter` adapts the response. While a check runs the field gets the class `fv-pending` and `aria-busy="true"` (configurable with `pendingClass`), so you can show a spinner. Stale requests are cancelled, answers are cached per value, and a network error blocks unless `failOpen: true`.

## Replacing the jQuery Validation plugin

`formValidator.jquery.js` is a compatibility layer that gives sites running the jQuery Validation plugin the same API on top of this engine. Load it after jQuery and `formValidator.js`, and remove `jquery.validate.js` and `additional-methods.js`:

```html
<script src="jquery.js"></script>
<script src="dist/formValidator.js"></script>
<script src="dist/formValidator.jquery.js"></script>
```

```js
$('#signup').validate({
  rules: { email: { required: true, email: true }, confirm: { equalTo: '#password' } },
  messages: { email: { required: 'We need your email' } },
  submitHandler: function (form) { form.submit(); }
});
$('#signup').valid();                  // synchronous, like the original
$('#email').rules('add', { minlength: 3 });
$.validator.addMethod('even', function (value, element) { return this.optional(element) || value % 2 === 0; }, 'Even numbers only');
```

It supports `$.fn.validate`, `valid` and `rules`, `$.validator.addMethod`, `addClassRules`, `setDefaults`, `format`, `messages` and `methods`, all built-in and additional methods, per-field messages, `data-rule-*`, `data-msg-*`, class and attribute rules, `depends`, `normalizer`, `remote`, and the options `errorPlacement`, `highlight`, `unhighlight`, `success`, `invalidHandler`, `submitHandler`, `onfocusout`, `onkeyup`, `onclick`, `ignore`, `focusCleanup`, `debug`, `errorContainer`, `errorLabelContainer` and `wrapper`. The `groups` and `showErrors` options are supported too. The full list, the differences, and a step-by-step migration are in [Migrating-from-jQuery-Validate.md](Migrating-from-jQuery-Validate.md).

## Migrating from v1

Existing pages keep working: `FormValidator.init({ formId, rules, config, context })`, `FormValidator.validate(id, rules)` and `form._manualValidate()` are unchanged. These behaviours are different, on purpose:

| Version 1 | Now | To get the old behaviour |
| --- | --- | --- |
| Invalid forms could still submit, because the handler called `preventDefault()` too late | Invalid forms are blocked | none needed |
| A blank optional email, url or number was an error | Blank optional fields pass. Only `required` demands a value. | Add `required` where a value is needed |
| `pwcheck` did nothing unless `passwordStrength.enabled` was set | `pwcheck` runs whenever it is listed | Set `passwordStrength: { enabled: false }` or `enabled: false` on the rule |
| jQuery was needed for any `<select>` | jQuery is optional | none needed |
| Passwords were trimmed | Passwords are never trimmed | none needed |
| `validate(id, rules)` ignored the form's config | It reuses the form's config | none needed |
| Field names with `[`, `]` or quotes broke selectors | They work | none needed |
| Errors were only removed while typing | Errors are re-checked while typing, and confirm fields are re-checked | none needed |
| `init` returned nothing | `init` returns an instance | none needed |
| Radio and checkbox errors were placed only for Bootstrap `btn-check` inputs | Placed after the group for all radios and checkboxes | Use `errorPlacement` |
| The `url` rule accepted odd strings | It parses the URL properly and needs a dotted host (or `localhost`) | `allowLocal: true` for intranet names |

A rule without a message now shows a default English sentence (version 1 showed nothing useful). A message you write always wins.

## Troubleshooting and limits

| Symptom | Cause and fix |
| --- | --- |
| Nothing happens on submit, or the form submits without checks | The form id in `init` does not match, or `init` ran before the form existed. `init` throws `Form "id" not found` when the form is missing, so check the console. |
| No message appears for a field | The rules key must equal the field's `name` attribute, not its `id`. |
| A field is never validated | It is hidden, disabled, `type="hidden"`, or matches `ignore`. Use `validateHidden: true` if it should be checked. |
| Message appears in the wrong place | Use `errorPlacement`, or wrap the field in a container the library knows (`.input-group`, `.form-floating`, `.answer`, ...). |
| A blank field passes `email` | By design. Add `'required'` first. |
| `Unknown rule "x"` in the console | The rule name is misspelt, or `registerRule` has not run yet. The rule is ignored. |
| The `file` rule does nothing and logs a warning | `fileValidator.js` is not loaded. Add its script tag. |
| A `remote` check keeps blocking | A network or HTTP error blocks by default. Fix the endpoint or set `failOpen: true`. |
| Your own submit listener runs twice | It should run once: only valid submits reach other listeners. Make sure `init` was not called on two different wrappers of the same form. |
| Page code sets `form.noValidate = false` later | Browser pop-ups will appear again. Set `novalidate: false` in `config` if you want the browser's own checks too. |

**Limits**

- Validation runs in the browser only. Repeat the checks on the server.
- There is no built-in translation of number formats: `1,5` is not a number. Normalise input, or add a `custom` rule.
- The `phone` rule checks shape and digit count, not that the number exists.
- Hidden-field detection uses layout, so a field inside a collapsed panel is skipped until the panel is shown.

**Running the tests**

```
npm install
npm test
```

The project is tested three ways. `npm test` runs about 370 tests in jsdom (every option and error code, false-positive guards, odd and hostile inputs, a fuzz and ReDoS suite, axe accessibility audits, the bundle, the language packs, the server companion, React / Vue / Alpine) and checks the TypeScript typings. `npm run test:jquery3` repeats the jQuery tests on jQuery 3.x. `npm run test:browser` runs 116 tests in real Chrome, Edge, Firefox and WebKit (headless Playwright): real file choosers, drag and drop, image decoding, hashing, focus, and an axe audit with colour contrast. Open `demo.html` or `demo-jquery.html` to try the libraries in a browser, or the live playground on the docs site.

## Version history

The newest entries (each source file also keeps its own changelog in its header; the package changelog is `CHANGELOG.md`):

- **2.15.0**: `requiredIf`, `dateAfter`, `dateBefore`, `atLeastOne`, `sumEquals`; `inst.state` / `getState()` / `onStateChange()`; `inst.validateStep()`; `FormValidator.explain()`.
- **2.14.0**: field arrays and nested data: wildcard rule keys (`items[].qty`) and nested paths in `checkValues()` / `schema()` / forms, rules `unique`, `minItems`, `maxItems`; schema output is nested.
- **2.15.0 (continued)**: `FormValidator.mask()`, the `mask` rule, `maskPattern()`, `unmaskValue()`, `parseRules()`, `FormValidator.auto()` / `data-fv` attributes / `data-fv-auto` script attribute.
- **password add-on 1.0.0**: `passwordStrength()`, `pwned()`, `watchPasswordStrength()`, rules `pwscore` and `pwned` (`dist/formValidator.password.js`).
- **element 1.0.0**: `<fv-field>`, FormValidator rules as native constraint validation in plain HTML (not a FormValidator version: `dist/formValidator.element.js`).
- **2.13.0**: ASP.NET `data-val-*` (unobtrusive validation): `unobtrusive: true`, `FormValidator.unobtrusive.parse()` / `.auto()` / `.adapters`, `$.validator.unobtrusive` on the jQuery layer.
- **2.12.0**: `validateOn` presets (`'smart'`, `'blur'`, `'input'`, `'submit'`, `'all'`; an `'input'` entry now works) and `validClass` (reward early, punish late); stable error codes (`data-code`, `code` in `getErrors()`, `checkValue`, schema issues, a rule's own `code`); `errorSummary` (accessible list with links and focus); `autoAttributes` and `inst.lint()`.
- **2.11.0**: `FormValidator.serverErrors()` (any backend's validation answer), `precognition()` / `validateOnServer()` / `watchServer()`, `action()` for React 19 and Server Actions, `setServerErrors()`; `setErrors()` matches `items.0.qty` to `items[0].qty`.
- **2.10.0**: `FormValidator.parseFormData()`, `FormValidator.ruleNames()`, a ReDoS fuzz test for every rule.
- **2.9.0**: `FormValidator.schema(rules)`: the rules as a Standard Schema with `parse`, `safeParse` and typed values and errors.
- **2.8.0**: 19 new rules (`integer`, `uuid`, `hexColor`, `slug`, `ipv4`, `ipv6`, `iban`, `time`, `domain`, `base64`, `mac`, `latitude`, `longitude`, `startsWith`, `endsWith`, `contains`, `notOneOf`, `minWords`, `maxWords`), also in the .NET package and all language packs.
- **2.7.0**: named date formats (`format`, `strict`), `checkValue()` / `checkValues()` without a DOM, a `url` rule that is the same in every browser, Unicode-aware `pwcheck`, plain-decimal `min` / `max` / `range` / `step`.
- **2.6.0**: error messages carry `dir="auto"`; language packs.
- **2.5.2**: hardening: a bad CSS selector, an option of the wrong type or a user callback that throws no longer breaks the form.
- **2.5.1**: a click is never lost when a blur removes an error message and the layout shifts (the change waits until the pointer is released).
- **2.5.0**: `remote` sends `GET` by default, `POST` configurable; jQuery-style `addMethod`, `data-msg-*` and `data-rule-*`.
