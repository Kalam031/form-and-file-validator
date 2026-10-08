# Server companion and framework bindings

## Server (Node 18+)

Browser checks help your visitors; **the server must check again**, because anyone can send a request without your page. The server companion runs the same FileValidator rules on the uploaded files: extension and type rules, size limits, content signatures (a program renamed to `.png` is caught), dangerous types, ZIP / Office / PDF inspection, duplicate content, and your `scan` hook.

```js
const express = require('express');
const multer = require('multer');
const { middleware, validate } = require('form-and-file-validator/server');

const rules = { allowedExtensions: ['.jpg', '.png', '.pdf'], maxFileSizeMB: 5, maxFiles: 3 };   // the same object your browser code uses
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.array('files'), middleware(rules), (req, res) => {
  res.json({ ok: true });                       // only reached when every file passed
});
```

A failing request gets **422** with JSON: `{ ok: false, errors: [...], files: [{ name, isValid, errors, details: [{ code, message }] }] }`.

### Options

```js
middleware(rulesOrFunction, {
  status: 422,            // response code
  field: 'avatar',        // validate only req.files.avatar
  allowNoFiles: false,    // a request without files is an error (NO_FILES) unless true
  removeFailed: true,     // delete failed uploads from disk (multer disk storage, formidable)
  respond: (req, res, result) => res.status(400).send('Bad upload')   // your own answer
});
middleware(req => req.user.isPro ? proRules : freeRules);           // rules that depend on the request
```

On success `req.fileValidation` holds the full result. Without Express, call it yourself:

```js
const result = await validate(req.files, rules);       // { isValid, errors, details, files }
```

### What it accepts

multer (memory and disk), @koa/multer, formidable (`filepath`), express-fileupload (`data`, `tempFilePath`), Fastify `@fastify/multipart` parts (`req.files()` or `attachFieldsToBody`), Hono / Workers / Bun / Deno / Next.js route handlers (the `File`s from `formData()` or `parseBody()`), busboy-style `{ filename, buffer }`, `Buffer`s, file paths and Web `File`/`Blob` objects, single or in arrays / field maps.

### Frameworks that are tested

The test suite uploads real multipart requests to Express (with multer, express-fileupload and formidable 3), Fastify (`@fastify/multipart`), Koa (`@koa/multer`) and Hono, and validates a Web `Request` body. `middleware()` is Express / Connect style; for the others call `validate()` yourself and send the answer your framework's way:

```js
// Fastify
const parts = []; for await (const p of req.files()) { await p.toBuffer(); parts.push(p); }
const result = await validate(parts, rules);
if (!result.isValid) return reply.code(422).send({ errors: result.errors });

// Hono / Web standard
const body = await c.req.parseBody({ all: true });
const result = await validate(body.files, rules);
```

### Good to know

- Image pixel sizes (`maxImageWidth`…) need a browser and are skipped on the server; everything else runs.
- Files are read into memory for the checks: keep a request size limit in your upload library (multer `limits`).
- The languages of the messages: see [Languages](Languages.md), `require('form-and-file-validator/server').locales`.
- Never trust the browser's MIME type. The companion checks the content, not only the name.

## Plain form values on the server

The same rules object that runs in the browser can run on the server, so the two can never disagree. Three helpers in `form-and-file-validator/server`:

| Helper | For |
| --- | --- |
| `validateRequest(request, rules, options)` | Fetch-API frameworks: Next.js, Remix / React Router, SvelteKit, Nuxt (H3), Astro, Hono, Cloudflare Workers, Bun, Deno |
| `bodyValidator(rules, options)` | Express, Connect and Fastify middleware |
| `renderErrors(result)` | pages that must work without JavaScript |

```js
import { validateRequest } from 'form-and-file-validator/server';
import { signupRules } from './rules.js';          // the same object the browser form uses

export async function POST(request) {              // Next.js route handler, SvelteKit +server.js, Astro endpoint, Hono, Workers ...
  const result = await validateRequest(request, signupRules);
  if (!result.ok) return result.response();        // 422 application/problem+json; read it back in the browser with FormValidator.serverErrors()
  await createUser(result.data);                   // trimmed text, nested like the field names ('user.name' -> { user: { name } })
  return Response.json({ ok: true });
}
```

`request` can be a Web `Request` (JSON, `multipart/form-data` or `application/x-www-form-urlencoded`), `FormData`, `URLSearchParams`, a string or an already parsed object. An unreadable body gives **400**, an unsupported content type **415**, invalid values **422**; nothing throws. Keys such as `__proto__` are dropped. File fields: `{ files: { avatar: { allowedExtensions: ['.png'], maxFileSizeMB: 1 } } }` checks the uploaded `File`s in that field with the same rules as `FileValidator`; the result is in `result.files.avatar` and a failure adds `errors.avatar`.

Result: `{ ok, status, data, values, errors, issues, files, problem, response(), html() }`. Options: `status`, `files`, `lang` (messages in another language for this call), `omit`, `title`.

```js
// Express
app.post('/signup', express.json(), express.urlencoded({ extended: true }), bodyValidator(signupRules), (req, res) => res.json(req.validated));

// Fastify (with @fastify/formbody for urlencoded)
app.post('/signup', { preHandler: (req, reply, done) => bodyValidator(signupRules)(req, reply, done) }, async req => req.validated);
```

`bodyValidator` answers **422 `application/problem+json`** and puts the result on `req.validation`; `{ respond(req, res, result) }` sends your own answer, `{ source: 'query' }` validates the query string.

### Without JavaScript: `renderErrors`

```js
const result = await validateRequest(request, rules);
if (!result.ok) {
  const e = result.html();                       // or renderErrors(result, { idPrefix: 'f-' })
  return html(`
    <form method="post" novalidate>
      ${e.summary}                               <!-- role="alert", links to every invalid field, focus it with the id fv-summary -->
      <label for="email">Email</label>
      <input id="email" name="email" value="${e.value('email')}"${e.attrs('email')}>
      ${e.error('email')}
    </form>`, 422);
}
```

Everything is HTML-escaped, `value()` puts the visitor's input back (never for password, token, card, otp or pin fields, and not for names in `options.omit`), and `attrs()` gives `aria-invalid` and `aria-describedby` that point at the message.

### Framework recipes

```js
// Next.js server action (React 19): the same rules for the browser, JavaScript or not
'use server';
export async function signup(prev, formData) {
  const r = await validateRequest(formData, signupRules);
  return r.ok ? { ok: true } : { ok: false, errors: r.errors };
}

// Remix / React Router action
export async function action({ request }) {
  const r = await validateRequest(request, signupRules);
  return r.ok ? redirect('/welcome') : r.response();
}

// SvelteKit form action
export const actions = { default: async ({ request }) => {
  const r = await validateRequest(request, signupRules);
  return r.ok ? { success: true } : fail(r.status, { errors: r.errors, values: r.values });
} };

// Nuxt / H3
export default defineEventHandler(async event => {
  const r = await validateRequest(toWebRequest(event), signupRules);
  if (!r.ok) throw createError({ statusCode: r.status, data: r.problem });
  return r.data;
});

// Astro endpoint
export async function POST({ request }) { const r = await validateRequest(request, signupRules); return r.ok ? Response.json(r.data) : r.response(); }
```

## .NET (ASP.NET Core)

The NuGet package `FormAndFileValidator` (folder `dotnet/`) runs the **same form rules with the same answers** as the browser. Both sides are tested against `spec/form-rules.vectors.json`, so a form the browser accepts is accepted by your API, and the other way round.

```csharp
using FormAndFileValidator;

var rules = FormValidator.ParseRules("""["required", {"type":"date","format":"d/M/y"}]""");   // the very JSON the browser uses
var result = FormValidator.CheckValue(dto.BirthDate, rules);
if (!result.Valid) return Results.UnprocessableEntity(new { result.Rule, result.Message });
```

```csharp
var r = FormValidator.CheckValues(body, new Dictionary<string, IReadOnlyList<Rule>> {
    ["email"] = new[] { Rule.Required(), Rule.Email() },
    ["pw"]    = new[] { Rule.Required(), Rule.PwCheck(minLength: 8, requireUppercase: true) },
    ["pw2"]   = new[] { Rule.EqualTo("pw") } });
```

### ASP.NET MVC 5 (.NET Framework) and ASP.NET Core MVC: one definition for server and browser

Put the rules on the model once. They run in `ModelState` on the server (plain DataAnnotations) and are written to the page for the browser, so the two can never drift apart.

```csharp
public class SignupModel
{
    [FormRules("[\"required\", \"email\"]")]
    public string Email { get; set; }

    [FormRules("[\"required\", {\"type\":\"pwcheck\",\"minLength\":8,\"requireUppercase\":true,\"requireDigit\":true}]")]
    public string Password { get; set; }

    [FormRules("[{\"type\":\"equalTo\",\"target\":\"Password\"}]")]
    public string ConfirmPassword { get; set; }

    // keep dates as the text the user typed and name the format
    [FormRules("[\"required\", {\"type\":\"date\",\"format\":\"d/M/y\"}]")]
    public string BirthDate { get; set; }
}

// controller: nothing special
[HttpPost] public ActionResult Signup(SignupModel m) { if (!ModelState.IsValid) return View(m); ... }
```

```cshtml
@* Razor view (MVC 5): add the package FormAndFileValidator.Mvc5, then *@
<script src="~/Scripts/validator.min.js"></script>
@using (Html.BeginForm("Signup", "Account", FormMethod.Post, new { id = "signup" })) { ... }
@Html.FormValidatorInit("signup")      @* FormValidator.init({ formId: "signup", rules: { Email: [...], ... } }) *@
```

Outside MVC, `ModelRules.For<SignupModel>()` gives the rules and `ModelRules.ToJson<SignupModel>()` the JSON. Field names are the property names, which is what MVC puts in the `name` attribute. The libraries are tested on the real .NET Framework 4.8 (Windows), .NET 8 and .NET 10; `FormAndFileValidator` targets netstandard2.0 (.NET Framework 4.6.1 and up), the helpers package `FormAndFileValidator.Mvc5` targets .NET Framework 4.8.

Supported: all text, number, date, password, pattern, format (uuid, ipv4, ipv6, iban, domain, mac, hexColor, slug, time, base64, latitude, longitude, integer, startsWith, endsWith, contains, minWords, maxWords, notOneOf) and choice rules (not file, checkbox-count or remote rules). Keep `pattern` rules portable (write `[0-9]`, not `\d`) because regular expression engines differ slightly.

## React

```jsx
import { useFormValidator, FileDropzone } from 'form-and-file-validator/react';

function Signup() {
  const { ref, handleSubmit, errors } = useFormValidator({ rules: { email: ['required', 'email'] } });
  // AJAX: called only for a valid form, with the validated values. Return { errors: {...} } from your server to show its messages on the fields.
  const onSubmit = handleSubmit(async values => {
    const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) return await res.json();          // { errors: { email: 'Already registered' } }
  });
  return (
    <form ref={ref} onSubmit={onSubmit}>
      <input name="email" />
      <FileDropzone name="photos" label="Drop photos here"
        config={{ accept: 'image/*', maxFiles: 3, maxFileSizeMB: 5 }} options={{ preview: true }}
        onChange={files => setFiles(files)} />
      <button>Send</button>
    </form>
  );
}
```

`useFormValidator(options, deps)` creates the validator when the form appears and destroys it when it goes away; pass `deps` if your rules change. `errors` is refreshed after each `validate()` / `handleSubmit`. It also returns `getValues()`, `setErrors(map)`, `setServerErrors(body)` (any backend's validation answer, see `FormValidator.serverErrors`) and `validateOnServer(url)` (Precognition). For React 19 `useActionState` and Server Actions see `FormValidator.action` in the FormValidator docs. **Direct submit** (the browser posts the form): leave out `onSubmit` and give the form `action` and `method`; a valid form posts, an invalid one is blocked. Call `handleSubmit(...)` while rendering, as above: it switches off the engine's own submit interception so your handler is the one that runs. `<FileDropzone>` gives a ref with `files`, `validate()`, `clear()`, `add(files)` and `appendTo(formData)`.

## Vue 3

```vue
<script setup>
import { useFormValidator, FileDropzone } from 'form-and-file-validator/vue';
const { formRef, handleSubmit, errors } = useFormValidator({ rules: { email: ['required', 'email'] } });
// AJAX: called only for a valid form, with the validated values; return { errors: {...} } from your server to show them
const onSubmit = handleSubmit(async values => {
  const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
  if (!res.ok) return await res.json();
});
</script>
<template>
  <form ref="formRef" @submit="onSubmit">
    <input name="email" />
    <FileDropzone name="photos" :config="{ accept: 'image/*', maxFiles: 3 }" :options="{ preview: true }" @change="files => (picked = files)" />
  </form>
</template>
```

`useFormValidator` also returns `getValues()` and `setErrors(map)`. For a **direct submit** leave out `@submit`: a valid form is posted by the browser, an invalid one is blocked. Call `handleSubmit(...)` in `setup`, as above.

Also available: the directive `v-form-validator="{ rules: {...} }" ` (register with `app.directive('form-validator', vFormValidator)` or `app.use(FormValidatorPlugin)`).

## Angular

Validators for Reactive Forms. They are plain functions (no decorators, no build step), so they work with any Angular version from 14, standalone or NgModule, and in unit tests. They give the same answers as the browser engine, Node and the .NET package.

```ts
import { FormBuilder, FormGroup } from '@angular/forms';
import { fvValidator, fvControls, fvWatch, fvMessage } from 'form-and-file-validator/angular';

const schema = {
  email: ['required', 'email'],
  born:  ['required', { type: 'date', format: 'd/M/y' }],
  pw:    { required: true, pwcheck: { minLength: 8, requireUppercase: true, requireDigit: true } },
  pw2:   { equalTo: 'pw' }                                  // looks at the sibling control named "pw"
};

form = this.fb.group(fvControls(schema, { email: '' }));    // or: new FormControl('', fvValidator(['required', 'email']))
private stop = fvWatch(this.form, schema);                  // re-check pw2 when pw changes; call this.stop() in ngOnDestroy
fvMessage = fvMessage;
```

```html
<input formControlName="email">
<small *ngIf="form.get('email')?.touched && form.get('email')?.errors">{{ fvMessage(form.get('email')) }}</small>
<small *ngIf="form.get('email')?.hasError('required')">Required</small>      <!-- hasError('<rule>') works too -->
```

- **Submit** (AJAX or not): `await fvSubmit(this.form, async values => { ... })` touches and checks every control, calls you only for a valid form with the trimmed values (`fvValues`), and shows messages you return as `{ errors: { email: 'Already registered' } }` (`fvSetErrors`). For a direct submit use the form's normal `action` and `method` with `(ngSubmit)` left out; `form.valid` is the true / false.
- A failed control has `errors = { <rule>: { message }, fv: { rule, message } }`.
- `null` / `undefined` is blank, numbers and booleans become text, a `Date` becomes its local `yyyy-MM-dd` (use a `format` or `strict` date rule with it).
- `fvGroupValidator(schema)` on the FormGroup returns every field's error at once.
- The same rules, written once as JSON, can be shared with the server (`checkValue` in Node, `FormAndFileValidator` in .NET).
- Template-driven forms: wrap `fvValidator` in a one-line directive (`NG_VALIDATORS`) in your app.
- **Server answers and Precognition**: `fvServerErrors(this.form, await res.json())` puts a backend's validation answer (problem+json, Laravel, Django REST, ASP.NET `ModelState`, FastAPI, Zod) on the matching controls and the rest on the group; `await fvPrecognition(this.form, '/api/signup', { only: ['email'] })` asks your real endpoint whether the values would pass and shows its field errors (`valid: null` = could not check, nothing is shown).

## Alpine.js

```html
<script src="dist/validator.min.js"></script>
<script src="dist/integrations/alpine.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>

<!-- direct submit: a valid form is posted by the browser, an invalid one is blocked -->
<form x-data x-validate="{ rules: { email: ['required', 'email'] } }" action="/signup" method="post">
  <input name="email"> <button>Send</button>
</form>

<!-- AJAX: onSubmit gets the validated values; return { errors: {...} } from your server to show them -->
<form x-data x-validate="{ rules: { email: ['required', 'email'] }, config: { onSubmit: async values => {
    const r = await fetch('/api/signup', { method: 'POST', body: JSON.stringify(values) });
    if (!r.ok) return await r.json();
} } }">
  <input name="email"> <button>Send</button>
</form>

<div x-data="{ files: [] }" x-dropzone="{ config: { accept: 'image/*', maxFiles: 3 }, options: { preview: true } }"
     @fv-change="files = $event.detail.files">
  <input type="file" name="photos">
  <ul class="fv-list"></ul><div class="fv-messages"></div><div class="fv-status" aria-live="polite"></div>
</div>
```

With a bundler: `import Alpine from 'alpinejs'; window.FVAlpine(Alpine); Alpine.start();` (after loading the validator bundle).

The magic **`$fv`** reaches the controller of the closest form from any element inside it: `$fv.errors()` (plain `{ name, message, code }`), `$fv.validate()`, `$fv.getValues()`, `$fv.setServerErrors(body)`, `$fv.validateOnServer(url)`, `$fv.reset()`, `$fv.instance()`. Alpine does not watch the engine, so read `$fv.errors()` in an event handler (for example `@click="n = $fv.errors().length"`) or use the messages the engine places next to the fields.

### .NET: uploaded files

The same package validates uploads on the server (`IFormFile` in ASP.NET Core, `HttpPostedFileBase` in MVC 5) with the same checks, error codes and messages as `FileValidator` in the browser and in Node. Both are tested against `spec/file-rules.vectors.json`.

```csharp
var result = FileValidator.ValidateRaw(files, new FileValidatorOptions { AllowedExtensions = { "jpg", "png" }, MaxFileSizeMB = 5 });
if (!result.IsValid) return BadRequest(result.Summary());
```

Or put `[FileRules(Extensions = "png,jpg", MaxSizeMB = 5, Required = true)]` on the model property and `ModelState.IsValid` covers it; `ModelFileRules.ToJson<T>()` (MVC 5: `Html.FileRulesJson()`) gives the matching browser configuration. Details in `dotnet/FormAndFileValidator/README.md`.

### Photos: strip EXIF and GPS on the server

Browsers can clean photos before upload (`stripMetadata` in the upload widget), but a server must not rely on that. In Node call `FileValidator.stripMetadata(file)` on the upload before you store it; in .NET use `PhotoPrivacy.Strip(UploadedFile.From(file))`. Both remove EXIF, GPS, XMP, IPTC and comments from JPEG, PNG and WebP without re-encoding the picture, keep the orientation, and give the same bytes (`spec/metadata-vectors.json`).

## HTMX, Turbo and other swapping frameworks

Pages that replace parts of the DOM (HTMX, Turbo, Unpoly, Livewire, Blazor enhanced navigation) need two things: forms that arrive later must start, and forms that leave must not leave listeners behind.

```html
<script src="dist/validator.min.js" data-fv-auto></script>      <!-- starts every form with data-fv attributes now and after every swap -->
<script>FormValidator.htmx();</script>                              <!-- HTMX only: an invalid form cancels its request -->

<form hx-post="/signup" hx-target="#result">
  <input name="email" data-fv="required email">
  <button>Sign up</button>
</form>
```

- `FormValidator.auto()` (or `data-fv-auto` on the script tag) watches the page: a swapped-in form is started, and a form that was removed is destroyed (its listeners and timers go with it).
- `FormValidator.htmx()` listens to `htmx:beforeRequest`: the request is cancelled and the messages are shown when the form is invalid. Without it HTMX would send the request anyway.
- Turbo (Drive and Frames) needs nothing extra: an invalid submit is stopped by the form's own handler before Turbo sees it. For forms you start yourself with `FormValidator.init()`, call it again after each render (`turbo:load`, `htmx:load`); starting a form twice replaces the old validator.
- Server-side errors that come back as HTML: use [`renderErrors`](#without-javascript-rendererrors). Errors that come back as JSON: `inst.setServerErrors(await response.json())`.

## Angular Signal Forms

`form-and-file-validator/angular-signals` gives Signal Forms (`form()` from `@angular/forms/signals`, Angular 21+) the same rules, messages and language packs:

```ts
import { signal } from '@angular/core';
import { form, submit } from '@angular/forms/signals';
import { fvSchema, fvPrecognition, fvServerErrors } from 'form-and-file-validator/angular-signals';

model = signal({ email: '', password: '', confirm: '' });
f = form(this.model, p => {
  fvSchema({
    email: ['required', 'email'],
    password: { required: true, pwcheck: { minLength: 8 } },
    confirm: { equalTo: 'password' }              // reads the other field from the model, re-checks when it changes
  })(p);
  fvPrecognition(p.email, '/signup', { name: 'email' });   // "is it taken?" to your real endpoint, after the sync rules pass
});
// template:  @for (e of f.email().errors(); track e.kind) { <small>{{ e.message }}</small> }
// submit:    submit(this.f, async () => { const res = await fetch('/signup', ...); if (!res.ok) return fvServerErrors(this.f, await res.json()); });
```

- **`fvSchema(rules)`** works as the schema of `form()` or inside your own schema next to Angular's `required()` and friends. Field names may be paths (`'address.zip'`). Errors are Signal Forms errors `{ kind, message, rule, code }`; `kind` is the rule's `code`, else its type (`required`, `email`, `minlength`, `equalTo`...). Numbers, booleans and `Date` values are read as text like the Reactive Forms bindings do.
- **`fvValidate(rules, { values })`** is the function for a single `validate(p.field, ...)`; `values` (an object or `ctx => ({ other: ctx.valueOf(p.other) })`) feeds `equalTo`.
- **`fvPrecognition(path, url, { name, values?, debounce? })`** is async validation through `validateAsync`: it waits for the sync rules, skips empty values, debounces (300 ms), cancels stale requests, and reports nothing when the check could not be made.
- **`fvServerErrors(form, body)`** turns a backend's validation answer (problem+json, Laravel, Django REST, ASP.NET, FastAPI, Zod...) into errors for `submit()`: each message lands on its field (`items[1].qty` finds `f.items[1].qty`), the rest on the form.
- **Standard Schema**: `validateStandardSchema(p, FormValidator.schema({...}))` from Angular also works, because `schema()` is a Standard Schema.
- Tested on real Signal Forms (Angular 22). The Reactive Forms bindings (`form-and-file-validator/angular`) are unchanged.

## Svelte

`form-and-file-validator/svelte` works with Svelte 3, 4 and 5 (an action and stores that follow the store contract; it does not import Svelte).

```svelte
<script>
  import { createFormValidator } from 'form-and-file-validator/svelte';
  const { form, errors, valid, submitting, handleSubmit } = createFormValidator({ rules: { email: ['required', 'email'] } });
  const save = handleSubmit(async values => { await fetch('/signup', { method: 'POST', body: JSON.stringify(values) }); });
</script>

<form use:form onsubmit={save}>            <!-- Svelte 3/4: on:submit={save} -->
  <input name="email">
  {#each $errors as e}<p>{e.name}: {e.message}</p>{/each}   <!-- or let the engine place the messages -->
  <button disabled={$submitting}>Save</button>
</form>
```

`errors` (`{ name, message, code, field }[]`), `valid` (`true` / `false` / `null` before the first check) and `submitting` are stores; they update while the user fixes fields, not only after a submit. Also `validate()`, `handleSubmit(fn)` (a handler that returns `{ errors }` from your server shows them), `getValues()`, `setServerErrors(body)`, `reset()`, `instance()`. For the action alone: `<form use:fvForm={{ rules, config }}>` (new options re-create the validator). Direct submit: leave out `onsubmit` and give the form `action` and `method`.

## Lit

`form-and-file-validator/lit` is a `ReactiveController` for `LitElement` (shadow DOM or light DOM):

```js
import { LitElement, html } from 'lit';
import { FvFormController } from 'form-and-file-validator/lit';

class SignupForm extends LitElement {
  fv = new FvFormController(this, { rules: { email: ['required', 'email'] } });   // options.form: '#selector' picks a form
  render() {
    return html`<form @submit=${this.fv.handleSubmit(async values => { await save(values); })}>
      <input name="email">
      ${this.fv.errors.map(e => html`<p>${e.name}: ${e.message}</p>`)}
      <button ?disabled=${this.fv.submitting}>Save</button>
    </form>`;
  }
}
```

The validator starts after the first render and is destroyed with the element; the host re-renders when `errors` change. Also `valid`, `validate()`, `getValues()`, `setServerErrors(body)`, `reset()`, `instance`.

## Solid

`form-and-file-validator/solid` gives `createFormValidator()` with accessors (reactive in effects and JSX):

```jsx
import { createFormValidator } from 'form-and-file-validator/solid';

function Signup() {
  const fv = createFormValidator({ rules: { email: ['required', 'email'] } });
  const save = fv.handleSubmit(async values => { await fetch('/signup', { method: 'POST', body: JSON.stringify(values) }); });
  return (
    <form ref={fv.ref} onSubmit={save}>
      <input name="email" />
      <For each={fv.errors()}>{e => <p>{e.name}: {e.message}</p>}</For>
      <button disabled={fv.submitting()}>Save</button>
    </form>
  );
}
```

`errors()`, `valid()` and `submitting()` are signals; the validator is created when the form gets its `ref` and destroyed with the owner (`onCleanup`). The three bindings are tested on the real libraries (Svelte's `get()`, a LitElement in jsdom, Solid's reactive build). **Qwik** has no binding: use the DOM-free core (`form-and-file-validator/core`) inside a `routeAction$` or `server$`, and `FormValidator.init` in `useVisibleTask$` on the client.

## Qwik and Qwik City

`form-and-file-validator/qwik` is plain functions with no Qwik import, so it works with `@builder.io/qwik` 1.x and `@qwik.dev/core`. Start the validator inside `useVisibleTask$` (it runs in the browser only, so server rendering never touches the DOM) and keep the errors in a signal:

```tsx
import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { fvQwik } from 'form-and-file-validator/qwik';

export default component$(() => {
  const errors = useSignal<{ name: string; message: string }[]>([]);
  const formRef = useSignal<HTMLFormElement>();
  useVisibleTask$(({ cleanup }) => {
    const fv = fvQwik(formRef.value!, { rules: { email: ['required', 'email'] }, onErrors: list => { errors.value = list; } });
    cleanup(() => fv.destroy());
  }, { strategy: 'document-ready' });
  return (
    <form ref={formRef} preventdefault:submit noValidate>
      <input name="email" />
      <ul>{errors.value.map(e => <li key={e.name}>{e.message}</li>)}</ul>
      <button>Save</button>
    </form>
  );
});
```

`fvQwik()` returns `{ errors(), valid(), validate(), handleSubmit(fn), getValues(), setServerErrors(body), validateOnServer(url), reset(), instance(), destroy() }`. The errors are plain data (no DOM nodes), so a signal can hold them. On the server (`routeAction$`, `server$`, endpoints) the same rules check the posted data: `const r = fvQwikCheck(rules, data); if (!r.ok) return fail(400, { errors: r.errors });`. The sample above is compiled by Qwik's own optimizer in the tests, rendered by Qwik's server renderer, and run in Chromium, Firefox and WebKit.
