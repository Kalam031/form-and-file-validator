# Replacing the jQuery Validation plugin

FormValidator is the successor of the [jQuery Validation plugin](https://jqueryvalidation.org/). The compatibility layer `formValidator.jquery.js` gives you the same API on top of the new engine, so most sites switch by changing script tags only.

## 1. Swap the scripts

Before:

```html
<script src="jquery.js"></script>
<script src="jquery.validate.js"></script>
<script src="additional-methods.js"></script>
<script src="localization/messages_de.js"></script>
```

After:

```html
<script src="jquery.js"></script>
<script src="dist/formValidator.js"></script>
<script src="dist/formValidator.jquery.js"></script>
<script src="localization/messages_de.js"></script>   <!-- unchanged: it only fills $.validator.messages -->
```

`additional-methods.js` is no longer needed. Its common methods are built in (the list is in section 2). If you rely on a method that is not in that list, keep loading the original `additional-methods.js` after these scripts; it registers itself through `$.validator.addMethod`. The compatibility layer is tested with jQuery 3.7 and 4.0.

Your page code does not change:

```js
$('#signup').validate({
  rules: {
    email:    { required: true, email: true, remote: '/api/email-free' },
    password: { minlength: 8 },
    confirm:  { equalTo: '#password' }
  },
  messages: { email: { required: 'We need your email' } },
  errorPlacement: function (error, element) { error.insertAfter(element); },
  submitHandler: function (form) { form.submit(); }
});

$('#signup').valid();                       // synchronous
$('#email').rules('add', { minlength: 3 });
$.validator.addMethod('even', function (value, element, param) {
  return this.optional(element) || value % 2 === 0;
}, 'Even numbers only');
```

## 2. What is supported

| Area | Supported |
| --- | --- |
| Plugin functions | `$.fn.validate`, `$.fn.valid`, `$.fn.rules('add' / 'remove')` |
| `$.validator` | `addMethod`, `addClassRules`, `setDefaults`, `format`, `messages`, `methods`, `defaults`, `classRuleSettings`, `normalizeRule`, `normalizeRules`, `staticRules`, `classRules`, `attributeRules`, `dataRules`, `autoCreateRanges` |
| Methods | `required remote minlength maxlength rangelength min max range step email url date dateISO number digits equalTo creditcard accept extension pattern maxWords minWords rangeWords integer lettersonly letterswithbasicpunc alphanumeric nowhitespace ipv4 ipv6 time time12h phoneUS iban notEqualTo require_from_group skip_or_fill_minimum` |
| Rule sources | `rules` option, `class="required email"`, HTML attributes (`required`, `type`, `minlength`, `pattern`, ...), `data-rule-*` |
| Rule parameters | `depends` (function or selector), `required` as selector or function, parameters as functions, `normalizer`, range strings like `"[1,5]"` |
| Messages | `messages` option (string, per method, function), `data-msg-*`, `data-msg`, the `title` attribute, `ignoreTitle`, `$.validator.messages`, `$.validator.format` |
| Options | `rules messages errorClass validClass errorElement errorPlacement highlight unhighlight success invalidHandler submitHandler onsubmit onfocusout onkeyup onclick focusInvalid focusCleanup ignore ignoreTitle debug errorContainer errorLabelContainer wrapper groups showErrors` |
| Validator object | `form()`, `element()`, `valid()`, `size()`, `numberOfInvalids()`, `errorList`, `errorMap`, `defaultShowErrors()`, `invalidElements()`, `validElements()`, `elements()`, `showErrors(map)`, `hideErrors()`, `resetForm()`, `destroy()`, `checkable`, `findByName`, `getLength`, `optional`, `depend`, `elementValue`, `defaultMessage`, `settings`, `currentForm` |
| Events and buttons | the `invalid-form` event, `.cancel` submit buttons, `formnovalidate` |
| Custom methods | same signature `function (value, element, param)` with `this.optional(element)`, returning true or false |
| File checks beyond `accept` and `extension` | the extra `fileValidator` method runs every FileValidator check (content, size, image size, dangerous files); see the FileValidator document |

## 3. What is different

**Improvements you get for free**

- Invalid submits are stopped reliably, and other submit handlers never see an invalid attempt.
- Error messages are accessible: `role="alert"`, `aria-invalid`, `aria-describedby`.
- Fields added after page load are validated and get live feedback, with no `rules('add')` needed for markup-driven rules.
- `remote` cancels stale requests, times out after 10 s, and caches per value.
- Text values are trimmed, so `"   "` counts as empty for `required` and `"ab  "` has length 2. Set `trim: false` in the options to get the original behaviour.
- `url` uses the browser's URL parser plus the same rules as before: the scheme (`http`, `https`, `ftp` or `//`) is required, and the host needs a real top-level domain.

**Behaviours that follow the original exactly**

- Custom methods run on empty values unless they call `this.optional(element)`.
- Empty fields are not flagged on blur until the first submit, and after a submit every key press re-checks the field.
- `valid()` and `form()` are synchronous. A `remote` check that is still running counts as valid until it answers, then the message appears (or the pending submit continues).
- `focusCleanup` clears an error on focus. As in the original, do not combine it with `focusInvalid`.

**Small differences**

- `groups`: only the first message of a group is visible; the others are hidden (and not announced). The original could also merge the messages into one line.
- `showErrors`: called after `form()`, `element()` and after live validation (once per tick). While it is set, messages are not placed in the page until you call `this.defaultShowErrors()` or place them yourself.
- `onkeyup` or `onfocusout` given as your own function are treated as "on".

## 4. Step by step

1. Swap the scripts (section 1) and reload.
2. Open the browser console. `formValidator.jquery.js: replacing the jQuery Validation plugin` means the old plugin is still loaded; remove it.
3. Test your forms once. The most common difference is whitespace-only input now counting as empty.
4. When you are ready, move new forms to the native API without jQuery (see the FormValidator document). Both APIs can live on the same page and work on different forms.

## 5. Native API mapping

| jQuery Validation | FormValidator |
| --- | --- |
| `$('#f').validate({ rules })` | `FormValidator.init({ formId: 'f', rules })`. The rules can stay in the jQuery shape: `{ email: { required: true, minlength: 3, equalTo: '#pw', remote: '/check' } }` |
| `{ required: true, minlength: 3 }` | `['required', { type: 'minlength', min: 3 }]` |
| `messages: { a: { required: '...' } }` | `{ type: 'required', message: '...' }` |
| `$('#f').valid()` | `await instance.validate()` (or `instance.validateSync()`) |
| `$.validator.addMethod(name, fn(value, element, param), message)` | `FormValidator.addMethod(name, fn, message)`: same signature, `this.optional(element)` included. `registerRule` is the lower-level version. |
| `$.validator.addClassRules`, `$.validator.format`, `$.validator.setDefaults` | `FormValidator.addClassRules`, `.format`, `.setDefaults` |
| `messages: { a: { required: '...' } }`, `data-msg-*`, `data-rule-*` | the same, natively (`data-rule-*` with `autoRules: true`) |
| `remote` (default `GET`, `type: 'post'`) | the same defaults natively: `GET`; `type` or `method: 'POST'` for a POST; global `FormValidator.remoteDefaults` |
| `pendingClass`, `focusCleanup` | `config.pendingClass` (default `fv-pending`), `config.focusCleanup` |
| `submitHandler(form)` | `config.submitHandler(form, event)` |
| `invalidHandler` | `config.onError(errors)` or the `fv:invalid` event |
| `errorPlacement(error, element)` | `config.errorPlacement(errorEl, field)` |
| `highlight` / `unhighlight` | `config.highlight(field)` / `config.unhighlight(field)`, or the `invalidClass` option |
| `ignore` | `config.ignore`, `config.validateHidden` |
| `resetForm()` | `instance.resetForm()` |
| `showErrors({ a: 'msg' })` | `instance.setError('a', 'msg')` |
