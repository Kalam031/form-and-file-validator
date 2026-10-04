# FormValidator v2.7.0 — Documentation

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
| `oneOf` | `values` | one of the listed values | anything else |
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
| `validateOn` | `['change']` | Events that check a field that has no error yet: `'change'`, `'blur'`, `'input'` |
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

The message keys are the rule names: `required`, `email`, `url`, `number`, `digits`, `alpha`, `alphanumeric`, `phone`, `date`, `minDate`, `maxDate`, `creditcard`, `pattern`, `maxlength`, `minlength`, `rangelength`, `range`, `max`, `min`, `step`, `oneOf`, `notEqualTo`, `equalTo`, `pwcheck`, `minChecked`, `maxChecked`, `minFiles`, `maxFiles`, `fileType`, `fileSize`, `file`, `remote`, `custom`, plus `badInput` for an unparseable number field.

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

## Live validation and dynamic forms

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

- **2.7.0**: named date formats (`format`, `strict`), `checkValue()` / `checkValues()` without a DOM, a `url` rule that is the same in every browser, Unicode-aware `pwcheck`, plain-decimal `min` / `max` / `range` / `step`.
- **2.6.0**: error messages carry `dir="auto"`; language packs.
- **2.5.2**: hardening: a bad CSS selector, an option of the wrong type or a user callback that throws no longer breaks the form.
- **2.5.1**: a click is never lost when a blur removes an error message and the layout shifts (the change waits until the pointer is released).
- **2.5.0**: `remote` sends `GET` by default, `POST` configurable; jQuery-style `addMethod`, `data-msg-*` and `data-rule-*`.
