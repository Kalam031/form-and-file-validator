# FileValidator v2.6.0 — Documentation

## Overview

FileValidator decides whether selected files are safe and acceptable before you upload them. It returns a clear list of problems per file, with human-readable messages. It has no dependencies and also runs in Node 18+ (Node 20+ has `File` built in).

**What it can do**

- Allow or block by extension and MIME type (wildcards like `image/*` work).
- Size limits per file, minimum size, total size, and empty-file detection.
- Count limits, minimum files, and duplicate-name detection.
- Blocks dangerous files: `.exe`, `.bat`, `.ps1`, `.php`, `.js` and more, in any letter case.
- Catches disguised names: `invoice.exe.pdf`, right-to-left tricks, path separators, control characters.
- Reads the file's real content, so a renamed `.exe` or a fake `.png` is rejected.
- Blocks SVG files that contain scripts.
- Looks inside PDF, Office and ZIP files: cut-off or damaged files, macros, JavaScript and launch actions in PDFs, embedded programs, zip bombs and unsafe paths.
- A hook for a malware scanner (`scan`), and folder-upload checks (path depth and safety, junk files like `.DS_Store`).
- An optional upload widget: drag and drop, dropped folders, paste, thumbnails, resizing big images, and an accessible file list.
- Image checks: readable image, max and min width and height, aspect ratio.
- Per-type limits (a bigger limit for video than for images).
- Friendly messages with real numbers, custom messages, and an easy `bind()` helper for file inputs.
- Your own checks (`addMethod`, inline `custom`), server-side checks (`remote`), duplicate-content detection, and audio and video duration limits.

**Loading it**

```html
<script src="dist/fileValidator.js"></script>
<script src="dist/fileValidator.widget.js"></script>   <!-- optional: the upload widget -->
```

Or load everything (FormValidator, FileValidator, the widget and the jQuery layer) as one file: `<script src="dist/validator.min.js"></script>`.

With CommonJS or a bundler: `const FileValidator = require('./dist/fileValidator.js')`. In Node, image dimension checks are skipped unless you supply a `readImageSize` function. Check the version with `FileValidator.version` (currently 2.6.0). The optional upload widget (`fileValidator.widget.js`) is version 1.1.0..

## Quick start

Call `validateFiles` with the selected files and a config. It always resolves, and never throws on odd input.

```js
const input = document.querySelector('#upload');

input.addEventListener('change', async () => {
  const result = await FileValidator.validateFiles(input.files, {
    accept: '.jpg,.png,application/pdf',
    maxFileSizeMB: 5,
    maxFiles: 3
  });

  if (!result.isValid) {
    showErrors(FileValidator.summary(result));
    // ["photo.png: This file is 6 MB but the maximum is 5 MB."]
    input.value = '';
  }
});
```

The first argument can be a `FileList`, an array of `File`, a single `File`, or the `<input>` element itself.

The shortest route is `bind()`, which does the listening, the message and the clearing for you:

```js
FileValidator.bind('#upload', { accept: '.jpg,.png', maxFileSizeMB: 5 },
  { messageElement: '#upload-msg', clearOnInvalid: true });
```

## What it checks

A check is on when you give it a value. To switch one off, set `validate: { <name>: false }` in the config. Every failing file is reported, not only the first one.

**Names**

- Dangerous extensions, in any letter case: `.exe .bat .cmd .ps1 .sh .js .vbs .jar .dll .msi .scr .lnk .php .asp .jsp` and more. An extension you list in `allowedExtensions` is allowed on purpose.
- Disguised extensions such as `invoice.exe.pdf`. Harmless names like `example.com.pdf` and `backup.tar.gz` are fine.
- Control characters, right-to-left override tricks, path separators, trailing dots or spaces, and names over 255 characters.
- Optional strict pattern (`validate.filenamePattern`), Unicode friendly, with a custom `filenameRegex`.

**Type and size**

- Extension allow-list and MIME allow-list. FileValidator has its own extension registry, so an extension list alone is enough: the file's type must fit its extension. See "File types, MIME types and dangerous files".
- Maximum and minimum size per file, total size, and empty files.

**Content**

- The first bytes of the file are compared with its extension. PNG, JPEG, GIF, WebP, BMP, ICO, TIFF, HEIC, MP4/MOV, WebM/MKV, AVI, WAV, MP3, AAC, OGG, FLAC, PDF, ZIP (and DOCX/XLSX/PPTX), RAR, 7z, GZip and old Office files are recognised.
- A mismatch is rejected: a text file named `.png`, or a PNG named `.pdf`.
- Executable content (Windows, Linux, macOS programs and shell scripts) is rejected even under a harmless name.
- Plain text is never mistaken for a binary format, including UTF-16 text and files that start with letters like `MZ` or `BM`.
- SVG files containing scripts, event handlers, `javascript:` links or `foreignObject` are rejected.
- About 45 formats are recognised, including fonts, Photoshop, SQLite, XZ, ZSTD, CAB, FLV, WMV, MIDI, AIFF, TAR and JPEG 2000. WebAssembly, Windows shortcuts, compiled help and Android `dex` files count as programs.
- PDF, Office and ZIP files are read from the inside (see "Inside PDF, Office and ZIP files").

**Images**

- The image must be readable. HEIC, TIFF and AVIF are exempt from this because many browsers cannot decode them.
- Maximum and minimum width and height, and aspect ratio.

**The whole selection**

- Maximum and minimum number of files, duplicate names (case-insensitive), and total size.

## Options reference

All options are optional. Numbers may be given as numeric strings (`'5'`), and lists as comma-separated strings (`'jpg, png'`). Unknown option names log one console warning, which catches typos.

**Type and name**

| Option | Default | Meaning |
| --- | --- | --- |
| `allowedExtensions` | none | Allowed extensions. Case-insensitive, dot optional. Also overrides the dangerous list for those extensions. Without `allowedMimeTypes`, the MIME types come from the built-in registry. |
| `allowedMimeTypes` | none | Allowed MIME types, `image/*` wildcards work. When given, this list decides and the registry is not used. |
| `mimeByExtension` | none | `{ '.xyz': 'application/x-xyz' }`: MIME types for extensions, for this call (overrides the registry). A value may be a list. |
| `accept` | none | HTML-style string like `'.jpg,image/*,application/pdf'`. Fills the two options above when they are not set. |
| `allowUnknownMime` | `false` | Do not report a file whose MIME type cannot be determined (`UNKNOWN_MIME`, or `INVALID_MIME` when `allowedMimeTypes` is set) |
| `dangerousExtensions` | built-in list | Replaces the block list. `FileValidator.constants.DEFAULT_DANGEROUS_EXTENSIONS` shows the default. |
| `dangerousMimeTypes` | built-in list | Replaces the list of program and script MIME types. `FileValidator.constants.DEFAULT_DANGEROUS_MIME_TYPES` shows the default. |
| `maxFilenameLength` | `255` | Longest allowed file name |
| `filenameRegex` | none | Custom pattern the name must match. Also turns on the name check. |
| `allowExecutables` | `false` | Do not reject executable content |

**Size and count**

| Option | Default | Meaning |
| --- | --- | --- |
| `maxFileSizeMB` / `maxFileSize` | none | Largest file, in MB or in bytes |
| `minFileSizeKB` / `minFileSize` | none | Smallest file, in KB or in bytes |
| `maxTotalSizeMB` | none | Largest combined size of all files |
| `maxFiles` / `minFiles` | none | Count limits |
| `allowEmpty` | `false` | Accept zero-byte files |
| `allowNoFiles` | `false` | An empty selection counts as valid |
| `duplicateNames` | `false` | Reject two files with the same name (case-insensitive) |

**Images**

| Option | Default | Meaning |
| --- | --- | --- |
| `maxImageWidth`, `maxImageHeight` | none | Largest pixel size |
| `minImageWidth`, `minImageHeight` | none | Smallest pixel size |
| `aspectRatio` | none | `{ min, max }`, a number like `1.5`, or `'16:9'` |
| `aspectRatioTolerance` | `0.01` | Allowed difference for a fixed ratio |
| `imageDecode` | `true` | Set `false` to skip decoding the image (faster on huge photos) |
| `imageTimeoutMs` | `10000` | Give up decoding after this long |
| `readImageSize` | built in | `async (file) => ({ width, height })` to supply your own reader, for example in Node |
| `scanSvg` | `true` | Set `false` to skip the SVG script check |

**Folders and documents**

| Option | Default | Meaning |
| --- | --- | --- |
| `maxPathDepth` | none | Deepest folder allowed for files picked from a folder or dropped as a folder |
| `maxPathLength` | none | Longest allowed relative path |
| `ignoreFiles` | none | `true` skips `.DS_Store`, `Thumbs.db`, `desktop.ini`, `~$` lock files and `._` files. Or a list of names and regular expressions. Skipped files are listed in `result.ignored`. |
| `documents` | on | `false` switches off the PDF, Office and ZIP inspection. Or an object with the options below. |
| `documents.checkStructure` | `true` | Report damaged, cut-off or fake Office/ZIP/PDF files (`CORRUPT_FILE`) |
| `documents.blockMacros` | `true` | Reject Office files with macros (`.docx` with `vbaProject.bin`, LibreOffice Basic/Scripts, old `.doc`/`.xls`/`.ppt` macros) |
| `documents.blockEmbeddedPrograms` | `true` | Reject Office files with ActiveX or embedded `.exe`/`.js`/... and PDFs with an embedded program |
| `documents.blockUnsafePaths` | `true` | Reject archives with `..` or absolute paths inside (zip slip) |
| `documents.blockPdfJavaScript` | `true` | Reject PDFs with JavaScript |
| `documents.blockPdfLaunch` | `true` | Reject PDFs with a launch action |
| `documents.maxUncompressedMB` | `2048` | Archive would expand to more than this: `ARCHIVE_BOMB` |
| `documents.maxCompressionRatio` | `250` | Compression ratio of large archives above this: `ARCHIVE_BOMB` |
| `documents.maxEntries` | `20000` | More files than this inside an archive: `ARCHIVE_BOMB` |
| `documents.maxScanMB` | `25` | How much of a PDF or old Office file is scanned (larger files: the start and the end) |
| `scan` | none | Your malware scanner, see "Malware scanning" |
| `scanTimeout` | `30000` | Milliseconds before a scan counts as failed |
| `scanFailOpen` | `false` | Let files through when the scanner fails or times out |

**Custom checks, server checks and media**

| Option | Default | Meaning |
| --- | --- | --- |
| `methods` | none | `{ name: param }` for methods registered with `addMethod` |
| `custom` | none | Your own check as a function `(file, ctx)`, an array of them, or `{ name: fn }` |
| `customAll` | none | `(files, ctx)` check on the whole selection |
| `remote` | none | `'/url'` or `{ url, method, send, field, data, headers, timeout, cache, failOpen, credentials, parse }` |
| `duplicateContent` | `false` | Reject files with identical content in one selection (SHA-256) |
| `duplicateContentMaxMB` | `50` | Bigger files are not hashed |
| `maxDurationSec`, `minDurationSec` | none | Length limits for audio and video |
| `readMediaInfo` | built in | `async (file) => ({ duration })` to supply your own reader, for example in Node |
| `requireMediaInfo` | `false` | Report `INVALID_MEDIA` when the duration cannot be read (otherwise the check is skipped) |

**Other**

| Option | Default | Meaning |
| --- | --- | --- |
| `categories` | none | Overrides per kind of file: `{ image: {...}, video: {...}, audio: {...}, file: {...} }` |
| `messages` | none | Custom text per error code |
| `concurrency` | `4` | How many files are checked at once |
| `validate` | none | Switches: `{ dangerousExt, extension, mimeType, maxFileSize, minFileSize, signature, empty, imageDecode, filenamePattern, duplicateNames, ... }`. Set a name to `false` to turn that check off. |

## Results and messages

`validateFiles` resolves to this object:

```js
{
  isValid: false,
  errors: ['SIZE_TOO_LARGE', 'EMPTY_FILE'],      // unique codes, easy to test for
  details: [                                    // one entry per problem
    { code: 'SIZE_TOO_LARGE', fileName: 'a.png', file: File, message: 'This file is 6 MB but the maximum is 5 MB.',
      params: { max: '5 MB', size: '6 MB' } }
  ],
  files: [                                      // one entry per file, in order
    { file: File, name: 'a.png', isValid: false, errors: ['SIZE_TOO_LARGE'], details: [...] }
  ]
}
```

Problems about the whole selection, such as too many files, have `fileName: null`.

**Error codes**

| Code | Meaning | Params |
| --- | --- | --- |
| `INVALID_EXTENSION` | Extension not in the allow-list | `extension`, `allowed` |
| `INVALID_MIME` | MIME type not in `allowedMimeTypes` (or cannot be determined) | `mime` |
| `MIME_MISMATCH` | The reported type does not fit the extension (extension list without a MIME list) | `mime`, `extension` |
| `UNKNOWN_MIME` | The extension is not in the registry and no MIME was given | `extension` |
| `SIZE_TOO_LARGE` / `SIZE_TOO_SMALL` | Outside the size limits | `size`, `max` or `min` |
| `TOTAL_SIZE_EXCEEDED` | All files together are too large | `size`, `max` |
| `EMPTY_FILE` | Zero bytes | |
| `INVALID_FILENAME` | Control characters, right-to-left tricks, path separators, trailing dot, or failed name pattern | |
| `FILENAME_TOO_LONG` | Longer than the limit | `max` |
| `DANGEROUS_FILE_TYPE` | Blocked extension | `extension` |
| `HIDDEN_EXTENSION` | Disguised extension such as `x.exe.pdf` | |
| `DANGEROUS_CONTENT` | Executable program or SVG with scripts | `detected` |
| `SIGNATURE_MISMATCH` | Content does not match the extension | `extension`, `detected` |
| `INVALID_IMAGE` | Image is corrupted or unreadable | |
| `WIDTH_EXCEEDED` / `HEIGHT_EXCEEDED` | Image too large | `width` or `height`, `max` |
| `WIDTH_TOO_SMALL` / `HEIGHT_TOO_SMALL` | Image too small | `width` or `height`, `min` |
| `INVALID_ASPECT_RATIO` | Image proportions not allowed | `ratio` |
| `TOO_MANY_FILES` / `TOO_FEW_FILES` | File count outside the limits | `max` or `min` |
| `DUPLICATE_FILENAMES` | Two files share a name | |
| `NO_FILES` | Nothing selected | |
| `INVALID_IMAGE_TYPE` / `INVALID_FILE_TYPE` | Wrong kind of file for the selected scope or target | |
| `SINGLE_FILE_LIMIT_EXCEEDED` | More than one file where only one is allowed | |
| `CUSTOM` | One of your own checks failed (a result object can supply another `code`) | `method`, `param` |
| `REMOTE_REJECTED` | The server said no (or its own `code`) | |
| `REMOTE_ERROR` | The server could not be reached or answered badly | |
| `DUPLICATE_FILES` | Files with identical content in one selection | `names` |
| `DURATION_TOO_LONG` / `DURATION_TOO_SHORT` | Audio or video length outside the limits | `duration`, `max` or `min` |
| `INVALID_MEDIA` | Audio or video cannot be read (with `requireMediaInfo`) | |
| `INVALID_PATH` | Folder path with `..`, an absolute or backslash path, or hidden characters | |
| `PATH_TOO_DEEP` / `PATH_TOO_LONG` | Folder depth or path length over the limit | `depth`, `max` |
| `CORRUPT_FILE` | PDF, Office or ZIP file that is damaged, cut off or not what its extension says | `kind`, `reason` |
| `ARCHIVE_BOMB` | Archive that would expand hugely or holds far too many files | `reason` |
| `MALWARE_DETECTED` | Your scanner flagged the file | `threat` |
| `SCAN_ERROR` | The scanner failed or timed out | |

**Custom messages**

```js
FileValidator.validateFiles(files, {
  maxFileSizeMB: 2,
  messages: {
    SIZE_TOO_LARGE: 'Please pick something under {max} (yours is {size}).',
    EMPTY_FILE: p => 'That file is empty.'      // a function receives the params
  }
});
```

`FileValidator.summary(result)` returns ready-to-show lines with the file name in front. Pass `{ fileNames: false }` to leave the names out. The old static text map is still available as `FileValidator.errorMessages`.

## Helpers

**`bind(input, config, options)`** connects a file input to validation and returns a function that removes it again.

```js
const unbind = FileValidator.bind('#avatar', { accept: '.png,.jpg', maxFileSizeMB: 2 }, {
  messageElement: '#avatar-msg',   // receives the first message, or '' when valid
  clearOnInvalid: true,            // empties the input when the choice is rejected
  onResult: (result, input) => { /* your code */ }
});
```

It also calls `input.setCustomValidity(message)`, so the browser's own form validation reports the problem too. If the user picks again before an earlier check finishes, the older check is ignored.

**`validateFile(file, config)`** checks one file and returns `{ isValid, errors, details }`.

**`summary(result, { fileNames })`** turns a result into a list of strings for display.

**`getMessage(code, params, config)`** builds one message, for example `getMessage('SIZE_TOO_LARGE', { size: '6 MB', max: '5 MB' })`.

**`detectSignature(file)`** reads the file's first bytes and returns the matching format (`{ name, mime, exts, executable }`), `null` when no known format matches, or `undefined` when the file cannot be read.

**`getCategory(file)`** returns `'image'`, `'video'`, `'audio'` or `'file'`.

**`formatBytes(n)`** turns `3145728` into `'3 MB'`.

**Inside FormValidator.** Use the `file` rule, and pass FileValidator options right in the rule. Its message is shown under the field.

```js
FormValidator.init({ formId: 'profile', rules: {
  avatar: [{ type: 'file', accept: '.png,.jpg', maxFileSizeMB: 2, minImageWidth: 100 }]
}});
```

Load `fileValidator.js` before `formValidator.js` (or in any order, as long as both load before `init` runs).

**Inside the jQuery Validation plugin (or the compatibility layer).** `formValidator.jquery.js` adds a `fileValidator` method, so FileValidator works like any other jQuery Validation method, including per-field messages and `data-` attributes:

```js
$('#profile').validate({
  rules: {
    avatar: { required: true, fileValidator: { accept: '.png,.jpg', maxFileSizeMB: 2, minImageWidth: 200 } }
  },
  messages: { avatar: { fileValidator: 'Please choose a PNG or JPG under 2 MB' } }   // optional: replaces the detailed message
});

$('#avatar').rules('add', { fileValidator: { accept: 'image/*' } });   // or add it later
```

```html
<input type="file" name="avatar" data-rule-filevalidator='{"maxFileSizeMB": 2}' data-msg-filevalidator="Too big">
```

Notes: the check is asynchronous, so `$('#avatar').valid()` counts it as valid until the answer arrives (then the message appears), exactly like `remote`. On form submit the check is awaited. An empty file selection is optional unless you add `required`. With several files, the message starts with the file name (`bad.exe: ...`). Without a per-field message, the detailed FileValidator message is shown. The method is also available as `$.validator.methods.fileValidator`.

## Upload widget

`fileValidator.widget.js` (version 1.1.0) adds drag and drop, folder drops, paste, thumbnails, resizing and a file list on top of FileValidator. It is a separate optional file, and part of the one-file bundle.

```html
<div id="zone"><label for="in">Choose files</label> <input type="file" id="in" name="up" multiple> or drop them here</div>
<div id="status"></div><div id="errors"></div><ul id="list" aria-label="Selected files"></ul>

<script>
  const zone = FileValidator.widget('#zone', { accept: 'image/*', maxFiles: 5, maxFileSizeMB: 5 }, {
    list: '#list',               // renders the accepted files with size, thumbnail and a remove button
    messageElement: '#errors',   // rejected files and why (role="alert")
    statusElement: '#status',    // "2 files added. 1 file not accepted. 3 selected." for screen readers
    preview: true,               // thumbnails for images
    resize: true,                // shrink too-big images to the config limits instead of rejecting them
    paste: true                  // Ctrl+V of a screenshot
  });
</script>
```

**How it works.** Files are accepted one at a time with the same checks as `validateFiles`, including the running limits (`maxFiles`, `maxTotalSizeMB`, `duplicateNames`, `duplicateContent`) counted against what is already selected. A mixed drop is not thrown away as a whole: each rejected file is reported with its reasons and the rest is kept. `await zone.validate()` runs the full-selection check at the end (`minFiles`, scopes, `customAll`).

**The `<input>` stays in sync.** Accepted files are put back into the file input (through `DataTransfer`, which every current browser supports), and a `change` event is fired, so a normal form submit and FormValidator's `file` rule see the accepted files. Where `DataTransfer` is missing, use `zone.files` or `zone.appendTo(formData, 'files')`.

**Options**

| Option | Default | Meaning |
| --- | --- | --- |
| `input` | first file input inside | The `<input type="file">` to use and keep in sync |
| `dropzone` | the target element | The element that accepts drops |
| `multiple` | `true` | `false`: a single file, the newest replaces the old one |
| `append` | `true` | `false`: every new selection replaces the previous one |
| `list` | none | Element that receives the file list. `renderItem(entry, helpers)` replaces the default item. |
| `messageElement` | none | Element for the rejection messages (gets `role="alert"`, `aria-live="polite"`) |
| `statusElement` | none | Element for polite status announcements (gets `role="status"`). `statusText(kind, info, total)` replaces the wording. |
| `preview` | `false` | `true` or `{ maxWidth: 160, maxHeight: 160, type, quality, thumbnail }` |
| `resize` | none | `true` (limits from `maxImageWidth`, `maxImageHeight`, `maxFileSizeMB`) or `{ maxWidth, maxHeight, maxSizeMB, quality, type }` |
| `folder` | `false` | `true` also ignores junk files like `.DS_Store` in folders |
| `paste` | `false` | `true` listens on the zone, `'document'` on the whole page |
| `browse` | `true` | Clicking the zone opens the file dialog |
| `keyboard` | auto | Make the zone a keyboard-operable button. Automatic only when the real input cannot be reached by keyboard. |
| `syncInput` | `true` | Put accepted files back into the input |
| `dragClass` | `'fv-dragover'` | Class on the zone while files are dragged over it |
| `maxShownMessages` | `5` | How many rejection lines to show |
| `onChange(files, entries)`, `onReject(rejected)` | none | Callbacks. The zone also fires `fv:widget-change` and `fv:widget-reject` DOM events. |

**The controller**

| Member | What it does |
| --- | --- |
| `add(files)` | Add files by code (returns `{ accepted, rejected, ignored }`) |
| `remove(entry \| index \| file)`, `clear()` | Remove one or all files |
| `files`, `entries` | The accepted files, and entries with `id`, `file`, `path`, `preview`, `resized` |
| `validate()` | Full check of the selection |
| `appendTo(formData, name)` | Append the files to a `FormData`. Folder files keep their path as the file name. |
| `destroy()` | Remove listeners, revoke previews, clear the list |

**Folders.** Dropping a folder reads everything inside it (`FileValidator.filesFromDrop`), and each file keeps its relative path (`photos/2024/a.jpg`), just like `<input webkitdirectory>`. The folder checks apply: `maxPathDepth`, `maxPathLength`, and `INVALID_PATH` for `..` or absolute paths.

**Resizing.** `FileValidator.resizeImage(file, options)` shrinks an image to fit `maxWidth`, `maxHeight` and `maxSizeMB` (it lowers the quality first, then the size), and returns a new `File`, or the same file when nothing needed changing. GIF and SVG are left alone (animation, vectors), a resize never makes a file bigger, and `file.fvResized` tells you the before and after. It uses the browser's canvas, so it needs a browser (or your own `readImage` and `render` functions).

**Previews.** `FileValidator.createPreview(file)` returns `{ url, kind, revoke() }`: a small thumbnail for images, an object URL for video and audio, and a badge label for documents. The widget revokes them when files are removed.

**Helpers you can use alone:** `FileValidator.filesFromDrop(dataTransfer)` (call it inside the drop handler), `filesFromClipboard(clipboardData)` (names unnamed screenshots `pasted-2025-01-31T12-00-00.png`), `resizeImage`, `createPreview`.

**Accessibility.** The list, the live regions, the remove buttons and the focus handling are covered in `Accessibility.md`. Keep the file input available: dragging is not possible with a keyboard.

## Common recipes

**Profile photo**

```js
{ accept: '.jpg,.jpeg,.png,.webp', maxFileSizeMB: 5,
  minImageWidth: 200, minImageHeight: 200, aspectRatio: 1 }     // square, at least 200 px
```

**One PDF, under 10 MB**

```js
{ allowedExtensions: ['.pdf'], allowedMimeTypes: ['application/pdf'], maxFileSizeMB: 10, maxFiles: 1 }
```

**Photo gallery, up to 12 images**

```js
{ accept: 'image/*', maxFiles: 12, minFiles: 1, maxTotalSizeMB: 60, duplicateNames: true,
  maxImageWidth: 8000, maxImageHeight: 8000 }
```

**Images and video, different limits**

```js
{ accept: 'image/*,video/*',
  maxFileSizeMB: 10,
  categories: { video: { maxFileSizeMB: 500 } } }
```

**Documents only (no images)**

```js
{ allowedExtensions: ['.pdf', '.docx', '.xlsx'], validateTarget: { files: true } }   // images are rejected
```

**Allow something normally blocked.** List the extension explicitly:

```js
{ allowedExtensions: ['.js'] }       // an extension you list is not blocked as dangerous
{ validate: { dangerousExt: false } } // or turn the block list off entirely
```

**Server-side in Node.** Wrap uploads as `File` objects (a global in Node 20+; on Node 18 use `require('buffer').File`) and pass your own image reader, for example one built on `sharp`:

```js
const FileValidator = require('./dist/fileValidator.js');
const result = await FileValidator.validateFiles([new File([buffer], 'a.png', { type: 'image/png' })], {
  accept: '.png', maxImageWidth: 4000,
  readImageSize: async (file) => { const m = await sharp(Buffer.from(await file.arrayBuffer())).metadata(); return { width: m.width, height: m.height }; }
});
```

Without `readImageSize`, Node skips image dimension checks and all other checks still run.

## File types, MIME types and dangerous files

FileValidator carries its own extension registry: about 110 extensions with the MIME types browsers and operating systems really report for them, including aliases (`.csv` is also reported as `application/vnd.ms-excel` on Windows, `.jpg` as `image/pjpeg`, `.zip` as `application/x-zip-compressed`).

**Dangerous files are blocked by default.** No configuration is needed:

- Dangerous extensions such as `.exe .bat .cmd .ps1 .sh .js .vbs .jar .dll .msi .scr .lnk .php .asp .jsp`, in any letter case.
- Disguised names such as `invoice.exe.pdf`.
- Dangerous MIME types such as `application/x-msdownload`, `application/x-sh`, `application/java-archive` and `application/x-httpd-php`, even under a harmless name like `photo.jpg`.
- Program content (see What it checks).

To allow one on purpose, list it: `allowedExtensions: ['.jar']` or `allowedMimeTypes: ['application/java-archive']`. To change the lists use `dangerousExtensions` and `dangerousMimeTypes`, or switch the whole check off with `validate: { dangerousExt: false }`.

**How the type of a file is decided**

| You give | What is checked |
| --- | --- |
| nothing about types | only the dangerous checks and the content check |
| `allowedExtensions` only | the extension must be in the list, and the MIME type must fit it. The allowed types are taken from the registry for that extension. |
| `allowedMimeTypes` (with or without extensions) | the file's MIME type must be in that list. The registry is not used. |
| `mimeByExtension` | your MIME types replace the registry's for those extensions |

"The file's MIME type" is what the browser reports. If it reports nothing, or the generic `application/octet-stream`, the type is worked out from the extension, and for files without a known extension from the file's content.

**When the type cannot be found**

An extension that is not in the registry cannot be verified, so a file with it gets an error (`UNKNOWN_MIME`) instead of passing silently. Tell FileValidator what to expect in any of these ways:

```js
FileValidator.addExtension('.dxf', 'application/dxf');                       // teach the registry once, for every call
{ allowedExtensions: ['.dxf'], mimeByExtension: { '.dxf': ['application/dxf', 'image/vnd.dxf'] } }   // for one call
{ allowedExtensions: ['.dxf'], allowedMimeTypes: ['application/dxf'] }       // the MIME list decides
{ allowedExtensions: ['.dxf'], allowUnknownMime: true }                      // do not verify
```

**Reading the registry:** `FileValidator.getMimeTypes('.pdf')` returns the known types (`['application/pdf', 'application/x-pdf']`) and `FileValidator.constants.EXTENSIONS()` returns a copy of the whole table.

## Your own checks and server checks

**A reusable method, like `$.validator.addMethod`**

```js
FileValidator.addMethod('maxLines', async function (file, param, ctx) {
  return (await file.text()).split('\n').length <= param;
}, 'At most {0} lines');

FileValidator.validateFiles(files, { methods: { maxLines: 100 } });
```

A method gets `(file, param, ctx)` where `ctx` has `config`, `ext`, `category`, `files` and `index`. It returns `true`, `false`, a message string, `{ valid, message, code }` or a Promise. The message is text with `{0}` for the parameter, or a function `(param, file) => string`.

**A one-off check**

```js
{ custom: (file, ctx) => file.name.includes(' ') ? 'No spaces in file names' : true }
{ custom: { noSpaces: f => !f.name.includes(' '), sizeOk: async f => f.size > 0 } }   // several, by name
{ customAll: files => files.length % 2 === 0 || 'Please select pairs of files' }       // the whole selection
```

**Ask your server, like jQuery's `remote`**

```js
{ remote: '/api/files/check' }
{ remote: { url: '/api/files/check', send: 'hash', headers: { 'X-CSRF': token } } }
```

| `send` | What the server receives |
| --- | --- |
| `'meta'` (default) | `name`, `size`, `type`, `lastModified`, plus your `data`: in the query string for `GET` (the default), as JSON for `POST` |
| `'hash'` | the same, plus the SHA-256 `hash` of the content, so the server can say "already uploaded" |
| `'file'` | the file itself as multipart form data under `field` (default `file`). Always sent with `POST`. |

By default the request is a `GET`, like jQuery Validation. Use `method: 'POST'` to send a JSON body instead, or `FileValidator.remoteDefaults.method = 'POST'` to make it the default everywhere.

The server answers `true` or `"true"` (accepted), `false` (rejected), a text (rejected, and the text is the message), or `{ "valid": false, "message": "...", "code": "..." }`. `parse` adapts other shapes. Network or server errors block the file (`REMOTE_ERROR`) unless `failOpen: true`. Answers are cached per file and URL (`cache: false` to disable), and the server is only asked about files that passed every other check. Order of checks: built-in checks, `methods`, `custom`, then `remote`.

**Duplicates and media length**

```js
{ duplicateContent: true }                    // "These files have identical content: a.png, copy.png."
{ maxDurationSec: 600, minDurationSec: 5 }    // audio and video: "This recording is 12:30 long but the maximum is 10:00."
```

Content hashing needs `crypto.subtle`, which browsers only offer on HTTPS pages (and localhost). Without it, `duplicateContent` and `send: 'hash'` skip the hash.

**Global defaults.** `FileValidator.setDefaults({ maxFileSizeMB: 10, messages: { ... } })` applies to every later call. Options you pass explicitly win.

## Inside PDF, Office and ZIP files

For files that really are PDF, ZIP or Office (found by their content, so a renamed file is not fooled), the library reads the structure of the file. It does not unpack or open the document, and it does not run anything.

**ZIP, Office (`.docx .xlsx .pptx` and macro/template variants) and OpenDocument**

- The ZIP directory at the end of the file is read. A missing or damaged directory means the file is cut off or not a real archive: `CORRUPT_FILE`.
- A file named `.docx`, `.xlsx` or `.pptx` must contain `[Content_Types].xml` and the `word/`, `xl/` or `ppt/` part. A ZIP renamed to `.docx` fails.
- Macros: `vbaProject.bin` in an Office file, or `Basic/` or `Scripts/` in an OpenDocument file, gives `DANGEROUS_CONTENT` ("This file contains macros").
- ActiveX controls and embedded programs (`.exe`, `.dll`, `.js`, `.vbs`, ...) inside an Office file are blocked. Embedded documents (for example an Excel sheet in a Word file) are fine.
- Zip bombs: the sizes in the directory are added up. Too big when expanded, too high a compression ratio, or too many files gives `ARCHIVE_BOMB`. Nothing is unpacked to find out.
- Zip slip: `..` segments, absolute paths and drive letters inside the archive are blocked.
- Macro-enabled extensions (`.docm .xlsm .pptm .dotm .xlam ...`) are dangerous by default. If you allow the extension explicitly (`allowedExtensions: ['.docm']`), its macros are allowed too.

**PDF**

- The end of the file must contain `%%EOF`, or it is reported as cut off.
- JavaScript (`/JavaScript`, `/JS`), launch actions (`/Launch`) and embedded programs are blocked. Names written with `#` escapes (`/J#61vaScript`) are decoded first, so that simple hiding does not work. Ordinary PDFs, links, forms without scripts and attached documents pass.
- Trade-off: PDF forms with JavaScript are rejected by default. Use `documents: { blockPdfJavaScript: false }` if you accept them.

**Old Office files (`.doc .xls .ppt`)** are searched for the macro storage name, which finds macros in the usual case.

**What this cannot see:** content inside compressed streams (JavaScript in a compressed PDF object stream), encrypted files, and anything a scanner would find by running or emulating code. Use `scan` with an antivirus for that.

```js
{ documents: { blockPdfJavaScript: false, maxUncompressedMB: 500 } }   // adjust
{ documents: false }                                                     // switch the inspection off
```

## Malware scanning

FileValidator does not contain an antivirus. The `scan` option connects yours (ClamAV, a cloud scanning API, your own service). It runs for files that passed every other check, before `remote`.

```js
{
  scan: async (file, ctx) => {
    const res = await fetch('/api/scan', { method: 'POST', body: file });
    const out = await res.json();
    return out.clean ? true : { valid: false, threat: out.virusName };   // or: return false / 'Eicar-Test-Signature'
  },
  scanTimeout: 20000
}
```

| The function returns | Result |
| --- | --- |
| `true` | clean |
| `false` | `MALWARE_DETECTED` ("This file was flagged as malware and can't be uploaded.") |
| a text | `MALWARE_DETECTED`, with the text as the threat name |
| `{ valid: false, threat, message, code }` | flagged, with your details |

If the scanner throws, or does not answer within `scanTimeout`, the file is blocked with `SCAN_ERROR`. Set `scanFailOpen: true` to let files through in that case. `ctx` holds `config`, `ext`, `category`, `files` and `index`.

A scan in the browser only helps honest users, so scan again on the server before you store or serve a file.

## Legacy config style

Configs written for version 1 keep working. In version 1 a check only ran when its `validate` flag was `true`. Now a check runs whenever its value is set, and a flag set to `false` turns it off.

```js
{
  validate: { extension: true, mimeType: true, maxFileSize: true, duplicateNames: true },
  allowedExtensions: ['.png', '.jpg'],
  allowedMimeTypes: ['image/png', 'image/jpeg'],
  maxFileSizeMB: 5,
  validateTarget: { images: true },       // which kinds of file are accepted
  validateScope: 'images',                 // how many and what kind of selection
  imageLimit: 5
}
```

**`validateTarget`.** `{ images: true }` accepts only images, `{ files: true }` accepts only non-images, and `{ allowMixed: true }` accepts anything. Video and audio count as `files` unless you set `videos` or `audios`.

**`validateScope`**

| Value | Requires |
| --- | --- |
| `'file'` | one file that is not an image (`SINGLE_FILE_LIMIT_EXCEEDED` if more) |
| `'files'` | at least two files, none of them images |
| `'image'` | one image |
| `'images'` | at least two images |
| `'mixed'` or unset | no scope rule |

`imageLimit` and `fileLimit` cap the count for a selection made of only images, or only non-images. New code can use `accept`, `maxFiles` and `minFiles` instead, which are simpler.

The old flag names `filenamePattern`, `dangerousExt`, `extension`, `mimeType`, `maxFileSize`, `minFileSize`, `imageWidth`, `imageHeight`, `aspectRatio`, `maxFiles` and `duplicateNames` are all still understood.

## Security notes and limits

**Always check again on the server.** Anything running in a browser can be changed or skipped by an attacker. FileValidator gives honest users fast feedback and stops obvious mistakes and simple tricks. It does not replace server-side checks.

**What the content check can do**

- Compare the first bytes of a file with its extension, and reject programs disguised as documents or images.
- Recognise the common formats listed in the What it checks section.

**What it cannot do**

- It has no antivirus of its own. The `scan` option connects one.
- It reads the structure of ZIP, Office and PDF files, but it does not unpack or run them. Content inside compressed streams (for example JavaScript in a compressed PDF object stream) and encrypted files cannot be seen.
- It does not verify that a whole image or PDF is well formed. Images are decoded when a browser can do so, but crafted files can still be valid images.
- A file whose extension is not in the known list (for example `.dwg`) is judged by name, type and size only.
- A polyglot file (valid as two formats at once) can look right to the check.
- Plain text files that begin with `#!/` are treated as shell scripts and rejected, which is a deliberate choice.

**Good practice on the server**

- Re-check size, extension and content there, with the same rules.
- Store uploads outside the web root or on a separate domain, and serve them with the correct `Content-Type` and `Content-Disposition`.
- Generate your own file names, never reuse the uploaded name.
- Re-encode images you display, and run a malware scanner on uploads.

**SVG.** SVG is allowed by default because it is a common image format, but it can carry scripts. The scan blocks obvious scripts and event handlers. If you serve user SVGs from your own domain, still sanitise them or serve them as downloads.

## Migrating from v1, troubleshooting and tests

**What changed from version 1**

- Every failing file is reported, not just the first. `errors` is still a list of codes, so old checks like `errors.includes('SIZE_TOO_LARGE')` keep working. The new `details` and `files` lists carry the file names and messages.
- Extension checks are case-insensitive. `virus.EXE` is now blocked.
- A check now runs when its value is set, without needing a `validate` flag.
- Files with no browser MIME type (like `.csv` on some systems) are no longer rejected. The type is worked out from the extension.
- Video and audio files are accepted by `validateTarget: { files: true }`.
- Empty files, content that does not match the extension, and executable content are now rejected by default. Use `allowEmpty`, `validate: { signature: false }` or `allowExecutables` to relax that.
- Messages are friendlier and carry numbers. `FileValidator.errorMessages` keeps the old text for anyone who used it directly.

**Troubleshooting**

| Symptom | Cause and fix |
| --- | --- |
| A real photo is rejected as `SIGNATURE_MISMATCH` | Its extension differs from its real format, for example a PNG named `.jpg`. Rename it, or set `validate: { signature: false }`. |
| `.js` or `.php` upload is blocked | It is on the block list. List it in `allowedExtensions`, or replace the list with `dangerousExtensions`. |
| `CORRUPT_FILE` for a real document | The end of the file is missing (an incomplete upload) or a ZIP-based file lacks the parts its extension needs. Re-save or re-upload it. `documents: { checkStructure: false }` turns it off. |
| A PDF is rejected for JavaScript | PDF forms and some exports contain JavaScript. Use `documents: { blockPdfJavaScript: false }` if you accept them. |
| A `.docm` or `.xlsm` is blocked | Macro-enabled extensions are dangerous by default. Allow them with `allowedExtensions: ['.docm']`. |
| `SCAN_ERROR` | Your `scan` function threw or timed out. Check the scanner, raise `scanTimeout`, or set `scanFailOpen: true`. |
| `UNKNOWN_MIME` for an extension you allowed | The registry does not know it. Add it with `FileValidator.addExtension`, or use `mimeByExtension`, `allowedMimeTypes` or `allowUnknownMime`. |
| `MIME_MISMATCH` for a real file | The browser reported another type than the registry lists for that extension. Add the alias with `mimeByExtension`, or give `allowedMimeTypes`. |
| A `.txt` starting with `#!/` is rejected | It looks like a shell script. Add `allowExecutables: true` if that is acceptable. |
| Image size limits are ignored in Node | Node cannot decode images. Pass `readImageSize`. |
| HEIC photos are not size-checked | Most browsers cannot decode HEIC, so those checks are skipped for HEIC, TIFF and AVIF. |
| One option seems ignored | Look for a console warning about an unknown option name. |
| Huge photos make the page slow | Set `imageDecode: false`, or lower `concurrency`. |

**Running the tests**

The project has 122 tests for this library (including the widget), 101 for FormValidator, 70 for the jQuery layer, 6 accessibility tests and 15 tests for the bundle. From the project folder run:

```
npm install
npm test
```

The tests cover every option, every error code, false-positive guards for plain text, and odd inputs that must not throw. Open `demo.html` in a browser to try the libraries by hand.
