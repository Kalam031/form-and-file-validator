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

multer (memory and disk), formidable (`filepath`), express-fileupload (`data`, `tempFilePath`), busboy-style `{ filename, buffer }`, `Buffer`s, file paths and Web `File`/`Blob` objects, single or in arrays / field maps.

### Good to know

- Image pixel sizes (`maxImageWidth`…) need a browser and are skipped on the server; everything else runs.
- Files are read into memory for the checks: keep a request size limit in your upload library (multer `limits`).
- The languages of the messages: see [Languages](Languages.md), `require('form-and-file-validator/server').locales`.
- Never trust the browser's MIME type. The companion checks the content, not only the name.

## React

```jsx
import { useFormValidator, FileDropzone } from 'form-and-file-validator/react';

function Signup() {
  const { ref, validate, errors } = useFormValidator({ rules: { email: ['required', 'email'] } });
  return (
    <form ref={ref} onSubmit={async e => { e.preventDefault(); if (await validate()) send(); }}>
      <input name="email" />
      <FileDropzone name="photos" label="Drop photos here"
        config={{ accept: 'image/*', maxFiles: 3, maxFileSizeMB: 5 }} options={{ preview: true }}
        onChange={files => setFiles(files)} />
      <button>Send</button>
    </form>
  );
}
```

`useFormValidator(options, deps)` creates the validator when the form appears and destroys it when it goes away; pass `deps` if your rules change. `errors` is refreshed after each `validate()`. `<FileDropzone>` gives a ref with `files`, `validate()`, `clear()`, `add(files)` and `appendTo(formData)`.

## Vue 3

```vue
<script setup>
import { useFormValidator, FileDropzone } from 'form-and-file-validator/vue';
const { formRef, validate, errors } = useFormValidator({ rules: { email: ['required', 'email'] } });
</script>
<template>
  <form ref="formRef" @submit.prevent="validate().then(ok => ok && send())">
    <input name="email" />
    <FileDropzone name="photos" :config="{ accept: 'image/*', maxFiles: 3 }" :options="{ preview: true }" @change="files => (picked = files)" />
  </form>
</template>
```

Also available: the directive `v-form-validator="{ rules: {...} }" ` (register with `app.directive('form-validator', vFormValidator)` or `app.use(FormValidatorPlugin)`).

## Alpine.js

```html
<script src="dist/validator.min.js"></script>
<script src="dist/integrations/alpine.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>

<form x-data x-validate="{ rules: { email: ['required', 'email'] } }">
  <input name="email"> <button>Send</button>
</form>

<div x-data="{ files: [] }" x-dropzone="{ config: { accept: 'image/*', maxFiles: 3 }, options: { preview: true } }"
     @fv-change="files = $event.detail.files">
  <input type="file" name="photos">
  <ul class="fv-list"></ul><div class="fv-messages"></div><div class="fv-status" aria-live="polite"></div>
</div>
```

With a bundler: `import Alpine from 'alpinejs'; window.FVAlpine(Alpine); Alpine.start();` (after loading the validator bundle).
