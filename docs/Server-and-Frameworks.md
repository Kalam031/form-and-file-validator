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

Supported: all text, number, date, password, pattern and choice rules (not file, checkbox-count or remote rules). Keep `pattern` rules portable (write `[0-9]`, not `\d`) because regular expression engines differ slightly.

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

`useFormValidator(options, deps)` creates the validator when the form appears and destroys it when it goes away; pass `deps` if your rules change. `errors` is refreshed after each `validate()` / `handleSubmit`. It also returns `getValues()` and `setErrors(map)`. **Direct submit** (the browser posts the form): leave out `onSubmit` and give the form `action` and `method`; a valid form posts, an invalid one is blocked. Call `handleSubmit(...)` while rendering, as above: it switches off the engine's own submit interception so your handler is the one that runs. `<FileDropzone>` gives a ref with `files`, `validate()`, `clear()`, `add(files)` and `appendTo(formData)`.

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

### .NET: uploaded files

The same package validates uploads on the server (`IFormFile` in ASP.NET Core, `HttpPostedFileBase` in MVC 5) with the same checks, error codes and messages as `FileValidator` in the browser and in Node. Both are tested against `spec/file-rules.vectors.json`.

```csharp
var result = FileValidator.ValidateRaw(files, new FileValidatorOptions { AllowedExtensions = { "jpg", "png" }, MaxFileSizeMB = 5 });
if (!result.IsValid) return BadRequest(result.Summary());
```

Or put `[FileRules(Extensions = "png,jpg", MaxSizeMB = 5, Required = true)]` on the model property and `ModelState.IsValid` covers it; `ModelFileRules.ToJson<T>()` (MVC 5: `Html.FileRulesJson()`) gives the matching browser configuration. Details in `dotnet/FormAndFileValidator/README.md`.
