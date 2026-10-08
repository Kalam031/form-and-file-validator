# Recipes

Short, copy-ready answers to the questions that come up most. Every block marked `js test` is run by the test suite against the real library (`tests/recipes.test.js`), so what you read here works. The rules are plain data, so the same objects run in the browser, in Node on the server, and in tests.

```js test
// helper used by the recipes below: the names of the fields that fail
const failing = (data, rules) => Object.keys(FormValidator.checkValues(data, rules).errors).sort();
```

## Sign-up: email, password, confirmation

```js test
const rules = {
  email: ['required', 'email'],
  password: { required: true, minlength: 8 },
  confirm: { required: true, equalTo: 'password' }
};
assert.deepEqual(failing({ email: 'a@b.co', password: 'Secret123', confirm: 'Secret123' }, rules), []);
assert.deepEqual(failing({ email: 'nope', password: 'short', confirm: 'other' }, rules), ['confirm', 'email', 'password']);
```

In the page: `FormValidator.init({ form: '#signup', rules })`. The same `rules` object validates the request on the server (see "Same rules on the server").

## A field that is required only in some cases

```js test
const rules = { country: 'required', state: { requiredIf: { field: 'country', in: ['US', 'CA'] } } };
assert.deepEqual(failing({ country: 'US', state: '' }, rules), ['state']);
assert.deepEqual(failing({ country: 'DE', state: '' }, rules), []);
```

## A date range, and an age limit

```js test
const rules = { start: 'required', end: { required: true, dateAfter: { field: 'start' } }, age: { integer: true, range: [18, 120] } };
assert.deepEqual(failing({ start: '2030-05-01', end: '2030-04-01', age: 17 }, rules), ['age', 'end']);
assert.deepEqual(failing({ start: '2030-05-01', end: '2030-05-02', age: 18 }, rules), []);
```

## Postal code and phone that follow the chosen country

```js test
const rules = {
  country: 'required',
  zip: { required: true, postalCode: { countryField: 'country' } },
  phone: { phoneCountry: { countryField: 'country' } }
};
assert.deepEqual(failing({ country: 'GB', zip: 'SW1A 1AA', phone: '020 7946 0958' }, rules), []);
assert.deepEqual(failing({ country: 'US', zip: 'SW1A 1AA', phone: '12345' }, rules), ['phone', 'zip']);
```

The checks are plausibility checks (format and length), not a registry of real numbers. A country without a rule accepts anything.

## A repeating group (order lines) with unique codes

```js test
const rules = { 'lines[].sku': { required: true, unique: true }, 'lines[].qty': { required: true, integer: true, min: 1 }, lines: { minItems: 1 } };
assert.deepEqual(failing({ lines: [{ sku: 'a', qty: 1 }, { sku: 'b', qty: 2 }] }, rules), []);
assert.deepEqual(failing({ lines: [{ sku: 'a', qty: 1 }, { sku: 'a', qty: 0 }] }, rules), ['lines[0].sku', 'lines[1].qty', 'lines[1].sku']);
assert.deepEqual(failing({ lines: [] }, rules), ['lines']);
```

## Show the server's answer on the fields

Whatever the backend sends (RFC 9457 problem+json, ASP.NET `ModelState`, Laravel, Django REST, FastAPI, Zod, JSON:API) becomes field messages:

```js test
const body = { type: 'about:blank', title: 'Validation failed', errors: { Email: ['Already registered'], 'Items[0].Qty': ['Too many'] } };
const r = FormValidator.serverErrors(body);
assert.equal(r.errors.Email || r.errors.email, 'Already registered');
assert.ok(Object.keys(r.errors).some(k => /items\[0\]\.qty/i.test(k)));
```

In a page: `inst.setServerErrors(await response.json())`. Fields that are not on the form go to `r.form`.

## Same rules on the server

```js test
const rules = { email: ['required', 'email'], age: { integer: true, range: [18, 99] } };
const posted = FormValidator.parseFormData(new URLSearchParams('email=a%40b.co&age=17'), { coerce: true });
assert.deepEqual(posted, { email: 'a@b.co', age: 17 });
const result = FormValidator.checkValues(posted, rules);
assert.equal(result.valid, false);
assert.deepEqual(Object.keys(result.errors), ['age']);
```

For Express, Fastify, Hono, Next.js route handlers, Remix and SvelteKit actions there are ready-made wrappers in [Server and frameworks](Server-and-Frameworks.md).

## Your own rule (also asynchronous)

```js test
FormValidator.registerRule('evenNumber', v => Number(v) % 2 === 0);
FormValidator.registerRule('freeUsername', async v => (await Promise.resolve(['admin', 'root'])).indexOf(v) < 0);
FormValidator.messages.evenNumber = 'Please enter an even number.';
assert.equal(FormValidator.checkValue('4', ['evenNumber']).valid, true);
const bad = FormValidator.checkValue('5', ['evenNumber']);
assert.equal(bad.valid, false);
assert.equal(bad.message, 'Please enter an even number.');
```

An asynchronous rule runs only after the synchronous ones pass, and a stale answer is dropped when the user keeps typing. The form waits for it on submit.

## Messages in the visitor's language

```js test
FormValidator.registerMessages('de', { minlength: 'Mindestens {0} Zeichen.' });
const r = FormValidator.checkValue('ab', { minlength: 3 }, { lang: 'de' });
assert.equal(r.valid, false);
assert.equal(r.message, 'Mindestens 3 Zeichen.');
assert.equal(FormValidator.checkValue('ab', { minlength: 3 }).message, 'Please enter at least 3 characters.');
```

`lang` is per call, so one page (or one server) can answer in many languages. The 18 ready-made packs are separate files (`form-and-file-validator/locales/de.mjs`), so a bundler ships only the languages you import. `FormValidator.explain(value, rules)` lists every rule with the reason it passed or failed, which is the quickest way to debug a surprising result.

## Images up to 5 MB, nothing disguised

```js test
const cfg = { allowedExtensions: ['.jpg', '.png', '.webp'], maxFileSizeMB: 5 };
const png = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'a.png', { type: 'image/png' });
assert.equal((await FileValidator.validateFile(png, cfg)).isValid, true);
const fake = new File([Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0])], 'holiday.png', { type: 'image/png' });
const verdict = await FileValidator.validateFile(fake, cfg);
assert.equal(verdict.isValid, false, 'a Windows program renamed to .png is rejected by its content, not its name');
```

The name and the browser's `file.type` are what the client claims; the library reads the first bytes. Check again on the server: the [upload security checklist](FileValidator.md) lists what to verify there.

## Storybook

A story needs nothing special: initialise the validator in a play function and assert on the messages.

```js
// Signup.stories.js
export const InvalidSubmit = {
  render: () => signupFormElement(),               // your component, containing <form id="signup">
  play: async ({ canvasElement, userEvent }) => {
    FormValidator.init({ form: canvasElement.querySelector('#signup'), rules: { email: ['required', 'email'] } });
    await userEvent.click(canvasElement.querySelector('button[type=submit]'));
    // the message sits in an element with role="alert", linked to the input with aria-describedby
  }
};
```

`FormValidator.init` returns an instance with `destroy()`; call it in the story's cleanup so stories do not leak listeners. For rules-only components use `FormValidator.checkValues` in unit tests and skip the DOM.

## Playwright

```js
import { test, expect } from '@playwright/test';

test('shows the error and blocks the submit', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText('valid email');
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
});

test('uploads are checked by content', async ({ page }) => {
  await page.goto('/profile');
  await page.setInputFiles('input[type=file]', { name: 'holiday.png', mimeType: 'image/png', buffer: Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]) });
  await expect(page.getByRole('alert')).toBeVisible();
});
```

Errors are real `role="alert"` regions with `aria-invalid` on the field, so the accessible queries above find them without test ids. `form-and-file-validator/testing` has `fillAndSubmit` and `expectError` helpers for jsdom and unit tests.
