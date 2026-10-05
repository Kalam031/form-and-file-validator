/*! FormValidator 2.15.0 + FileValidator 2.11.0 + upload widget 1.4.0 + jQuery Validation layer 1.2.0 | one-file bundle | see docs/ */
(function (root) {
    'use strict';
    var mods = {}, cache = {};
    mods["fileValidator"] = function (module, exports, require, define) {
/*!
 * FileValidator v2.11.0 — dependency-free file validation for browsers and Node (18+).
 *
 * Changelog
 *   2.11.0 Polyglots: a script, program or ZIP hidden in the head or tail of a picture is DANGEROUS_CONTENT (`polyglot` option). FileValidator.safeName(name) for storage, FileValidator.detect(file).
 *   2.10.0 SVG scan hardened: <!DOCTYPE>/<!ENTITY> (XXE, entity bombs), external href / xlink:href (remote <use>, <image>), CSS @import and url(http...),
 *          xml-stylesheet, and javascript: hidden by character references or whitespace are now DANGEROUS_CONTENT. #id, data:image and <a href=https> stay allowed.
 *   2.9.0  readMetadata() and stripMetadata(): see what a JPEG, PNG or WebP gives away (EXIF, GPS position, XMP, IPTC, comments) and remove it without
 *          re-encoding the picture; the EXIF orientation is kept so phone photos stay upright. Pure byte work: browser and Node.
 *   2.7.1  Fix: a fractional byte range (a small `maxScanMB` such as 0.0001) made Node 20 abort the whole process inside Blob.slice();
 *          ranges are whole numbers now.
 *   2.7.0  Translatable: the English fragments that end up inside messages ("macros", "the ZIP directory ... is missing") go through
 *          FileValidator.phrases, and sizes use FileValidator.units, so a language pack can translate whole sentences.
 *   2.6.2  Content hashing for big files without loading them into memory: files above 32 MB are hashed in 4 MB slices by a streaming
 *          SHA-256, in a Web Worker when the browser allows it (so the page does not freeze), else on the main thread with pauses.
 *   2.6.1  Hardening: trailing dot/space trimming no longer has quadratic worst-case time (a 200 KB name of dots took 30 s), very long names
 *          skip the pattern checks, and options of the wrong type are ignored with a warning instead of throwing.
 *   2.6.0  Deeper content checks: PDF (cut-off files, JavaScript, launch actions, embedded programs), Office and ZIP files (damaged
 *          archives, missing Office parts, macros, embedded programs, zip bombs, unsafe paths), legacy .doc/.xls/.ppt macros;
 *          a malware-scan hook (`scan`); ~25 more file signatures (fonts, PSD, SQLite, XZ, ZSTD, CAB, FLV, ASF, MIDI, AIFF, TAR, JP2, DWG ...).
 *   2.5.0  Folder uploads: paths are checked (INVALID_PATH for "..", absolute or backslash paths and hidden tricks in any folder name,
 *          PATH_TOO_DEEP / PATH_TOO_LONG via `maxPathDepth` / `maxPathLength`), and `ignoreFiles` skips junk such as .DS_Store and Thumbs.db.
 *          The optional add-on fileValidator.widget.js builds on this (drag and drop, paste, previews, resizing, file list).
 *   2.4.0  Built-in extension registry (extension -> MIME types, with the aliases browsers really report). Extension rules now work
 *          without a MIME list: the file's type must fit its extension (MIME_MISMATCH); an extension the registry does not know is
 *          reported (UNKNOWN_MIME) unless you provide `allowedMimeTypes`, `mimeByExtension`, FileValidator.addExtension() or
 *          `allowUnknownMime`. Dangerous MIME types (programs, shell scripts, jar, php) are blocked by default like dangerous extensions.
 *   2.3.0  `remote` now defaults to GET (metadata in the query string), like jQuery Validation. POST (JSON body) is one option away:
 *          `method: 'POST'` per call, or globally with FileValidator.remoteDefaults.method = 'POST'.
 *   2.2.0  Custom checks and server checks: FileValidator.addMethod(name, fn(file, param, ctx), message) + `methods: { name: param }`,
 *          inline `custom` / `customAll`, `remote` (ask your server per file: send metadata, the file, or its SHA-256 hash),
 *          `duplicateContent` (identical files in one selection), audio/video `maxDurationSec` / `minDurationSec`,
 *          FileValidator.setDefaults().
 *   2.1.0  Friendly messages with sizes/limits, `summary()` and `bind(input)` helpers, `accept` string + numeric-string options,
 *          unknown-option warnings, SVG script scan, stricter magic-byte checks (no false positives on plain text),
 *          tolerant decoding for HEIC/TIFF/AVIF, `readImageSize` hook.
 *   2.0.0  Rewrite: magic-byte checks, per-file details, categories, image min sizes, aspect ratio, total size, UMD.
 *   1.0.0  Original version (see _original_backup/).
 *
 * Works as a <script> (window.FileValidator), CommonJS, AMD or ESM-via-bundler.
 *
 *   const result = await FileValidator.validateFiles(input.files, {
 *       allowedExtensions: ['.jpg', '.png', '.pdf'],   // with or without the dot, any case
 *       allowedMimeTypes:  ['image/*', 'application/pdf'],
 *       maxFileSizeMB: 5,
 *       maxFiles: 3,
 *       maxImageWidth: 4000,
 *   });
 *   // result = { isValid, errors: ['SIZE_TOO_LARGE'], details: [{ code, fileName, message, params }], files: [...] }
 *
 * A rule is active when its value is configured. `config.validate = { maxFileSize: false }` switches a rule off.
 * The legacy style (`validate: { extension: true }, validateTarget: { images: true }`) still works.
 *
 * Full option list: see DEFAULTS_DOC at the bottom of this file.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define([], function () { return factory(root); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root);
    else root.FileValidator = factory(root);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
    'use strict';

    // ------------------------------------------------------------------ messages
    const errorMessages = {
        INVALID_EXTENSION: "❌ Invalid file extension.",
        INVALID_MIME: "❌ Invalid file type (MIME mismatch).",
        SIZE_TOO_LARGE: "❌ File size exceeds maximum allowed.",
        SIZE_TOO_SMALL: "❌ File size is too small.",
        TOTAL_SIZE_EXCEEDED: "❌ Total size of all files exceeds maximum allowed.",
        EMPTY_FILE: "❌ File is empty.",
        INVALID_FILENAME: "❌ Filename contains invalid characters.",
        FILENAME_TOO_LONG: "❌ Filename is too long.",
        WIDTH_EXCEEDED: "❌ Image width exceeds maximum allowed.",
        HEIGHT_EXCEEDED: "❌ Image height exceeds maximum allowed.",
        WIDTH_TOO_SMALL: "❌ Image width is below the minimum required.",
        HEIGHT_TOO_SMALL: "❌ Image height is below the minimum required.",
        INVALID_ASPECT_RATIO: "❌ Image aspect ratio is not allowed.",
        TOO_MANY_FILES: "❌ Too many files selected.",
        TOO_FEW_FILES: "❌ Not enough files selected.",
        DUPLICATE_FILENAMES: "❌ Duplicate filenames detected.",
        INVALID_IMAGE: "❌ Corrupted or invalid image file.",
        DANGEROUS_FILE_TYPE: "❌ Potentially dangerous file type blocked.",
        DANGEROUS_CONTENT: "❌ File content is an executable program.",
        HIDDEN_EXTENSION: "❌ Dangerous file extension detected.",
        SIGNATURE_MISMATCH: "❌ File content does not match its extension.",
        INVALID_IMAGE_TYPE: "❌ Only image files are allowed.",
        INVALID_FILE_TYPE: "❌ Only document files are allowed.",
        SINGLE_FILE_LIMIT_EXCEEDED: "❌ Only one file allowed.",
        NO_FILES: "❌ No files selected."
    };

    // Friendly templates used for `details[i].message`. {placeholders} are filled from `details[i].params`.
    const defaultMessages = {
        INVALID_EXTENSION: "This file type ({extension}) isn't allowed. Allowed types: {allowed}.",
        INVALID_MIME: "This kind of file ({mime}) isn't allowed.",
        SIZE_TOO_LARGE: "This file is {size} but the maximum is {max}.",
        SIZE_TOO_SMALL: "This file is {size} but it must be at least {min}.",
        TOTAL_SIZE_EXCEEDED: "The files add up to {size} but the maximum is {max}.",
        EMPTY_FILE: "This file is empty.",
        INVALID_FILENAME: "The file name contains characters that aren't allowed.",
        FILENAME_TOO_LONG: "The file name is too long (maximum {max} characters).",
        WIDTH_EXCEEDED: "This image is {width}px wide but the maximum is {max}px.",
        HEIGHT_EXCEEDED: "This image is {height}px tall but the maximum is {max}px.",
        WIDTH_TOO_SMALL: "This image is {width}px wide but it must be at least {min}px.",
        HEIGHT_TOO_SMALL: "This image is {height}px tall but it must be at least {min}px.",
        INVALID_ASPECT_RATIO: "This image's proportions ({ratio}) aren't allowed.",
        TOO_MANY_FILES: "Please select no more than {max} file(s).",
        TOO_FEW_FILES: "Please select at least {min} files.",
        DUPLICATE_FILENAMES: "Two or more files have the same name.",
        INVALID_IMAGE: "This image is corrupted or can't be read.",
        DANGEROUS_FILE_TYPE: "Files of this type ({extension}) can't be uploaded for security reasons.",
        DANGEROUS_CONTENT: "This file contains {detected}, which can't be uploaded.",
        HIDDEN_EXTENSION: "The file name has a disguised extension.",
        SIGNATURE_MISMATCH: "The file's content doesn't match its extension ({extension}); it looks like {detected}.",
        INVALID_IMAGE_TYPE: "Only image files are allowed.",
        INVALID_FILE_TYPE: "Images aren't allowed here; please choose a document.",
        SINGLE_FILE_LIMIT_EXCEEDED: "Please select only one file.",
        NO_FILES: "Please select a file.",
        CUSTOM: 'This file did not pass the "{method}" check.',
        REMOTE_REJECTED: "The server did not accept this file.",
        REMOTE_ERROR: "This file could not be checked with the server. Please try again.",
        DUPLICATE_FILES: "These files have identical content: {names}.",
        DURATION_TOO_LONG: "This recording is {duration} long but the maximum is {max}.",
        DURATION_TOO_SHORT: "This recording is {duration} long but it must be at least {min}.",
        INVALID_MEDIA: "This audio or video file can't be read.",
        MIME_MISMATCH: "The file's type ({mime}) doesn't match its extension ({extension}).",
        UNKNOWN_MIME: "The type of \"{extension}\" files is not known, so this file can't be verified.",
        INVALID_PATH: "The folder path of this file contains characters or parts that aren't allowed.",
        PATH_TOO_DEEP: "This file is {depth} folders deep but the maximum is {max}.",
        PATH_TOO_LONG: "The path of this file is too long (maximum {max} characters).",
        CORRUPT_FILE: "This {kind} looks damaged or incomplete: {reason}.",
        ARCHIVE_BOMB: "This archive looks suspicious: {reason}.",
        MALWARE_DETECTED: "This file was flagged as {threat} and can't be uploaded.",
        SCAN_ERROR: "This file could not be scanned. Please try again."
    };

    const KNOWN_OPTIONS = ['allowedExtensions', 'allowedMimeTypes', 'accept', 'allowUnknownMime', 'dangerousExtensions',
        'maxFileSizeMB', 'maxFileSize', 'minFileSizeKB', 'minFileSize', 'maxTotalSizeMB', 'maxFiles', 'minFiles',
        'allowNoFiles', 'allowEmpty', 'allowExecutables', 'maxFilenameLength', 'filenameRegex', 'duplicateNames',
        'maxImageWidth', 'maxImageHeight', 'minImageWidth', 'minImageHeight', 'imageTimeoutMs', 'imageDecode',
        'aspectRatio', 'aspectRatioTolerance', 'readImageSize', 'categories', 'messages', 'concurrency',
        'validate', 'validateTarget', 'validateScope', 'polyglot', 'polyglotScanKB', 'imageLimit', 'fileLimit', 'type', 'options', 'scanSvg', 'message', 'when',
        'methods', 'custom', 'customAll', 'remote', 'duplicateContent', 'duplicateContentMaxMB', 'maxDurationSec', 'minDurationSec', 'readMediaInfo', 'requireMediaInfo', 'mimeByExtension', 'dangerousMimeTypes', 'maxPathDepth', 'maxPathLength', 'ignoreFiles', 'documents', 'scan', 'scanFailOpen', 'scanTimeout'];

    const DEFAULT_DANGEROUS_EXTENSIONS = [
        '.exe', '.bat', '.cmd', '.ps1', '.psm1', '.sh', '.js', '.jse', '.vbs', '.vbe', '.wsf', '.wsh',
        '.jar', '.dll', '.msi', '.msp', '.scr', '.pif', '.com', '.cpl', '.hta', '.reg', '.lnk',
        '.php', '.phtml', '.asp', '.aspx', '.jsp', '.cgi', '.htaccess', '.apk', '.chm', '.wasm',
        // macro-enabled Office files
        '.docm', '.dotm', '.xlsm', '.xltm', '.xlam', '.pptm', '.potm', '.ppsm', '.ppam'
    ];

    // Extensions that are legitimate as an *intermediate* part of a name (archive.tar.gz, example.com.pdf)
    const SAFE_INTERMEDIATE = ['tar', 'gz', 'bz2', 'zip', 'min', 'com'];

    // ------------------------------------------------------------------ type tables
    // Built-in extension registry: extension -> the MIME types a browser or OS may report for it (first = the primary one).
    const EXT_TABLE = [
        ['.jpg .jpeg .jpe .jfif', 'image/jpeg image/pjpeg'], ['.png', 'image/png image/x-png'], ['.apng', 'image/apng image/png'], ['.gif', 'image/gif'],
        ['.webp', 'image/webp'], ['.bmp', 'image/bmp image/x-ms-bmp image/x-bmp'], ['.svg .svgz', 'image/svg+xml'],
        ['.ico .cur', 'image/x-icon image/vnd.microsoft.icon image/ico'], ['.tif .tiff', 'image/tiff'], ['.avif', 'image/avif'],
        ['.heic', 'image/heic image/heic-sequence'], ['.heif', 'image/heif image/heif-sequence'],
        ['.mp4 .m4v', 'video/mp4 video/x-m4v'], ['.mov', 'video/quicktime'], ['.webm', 'video/webm'], ['.mkv', 'video/x-matroska video/matroska'],
        ['.avi', 'video/x-msvideo video/avi video/msvideo'], ['.wmv', 'video/x-ms-wmv'], ['.mpg .mpeg', 'video/mpeg'], ['.3gp', 'video/3gpp'], ['.3g2', 'video/3gpp2'],
        ['.ogv', 'video/ogg'], ['.flv', 'video/x-flv'],
        ['.mp3', 'audio/mpeg audio/mp3 audio/x-mpeg'], ['.wav', 'audio/wav audio/x-wav audio/wave audio/vnd.wave'], ['.ogg .oga .opus', 'audio/ogg application/ogg audio/opus'],
        ['.flac', 'audio/flac audio/x-flac'], ['.m4a', 'audio/mp4 audio/x-m4a audio/m4a'], ['.aac', 'audio/aac audio/x-aac'], ['.weba', 'audio/webm'], ['.wma', 'audio/x-ms-wma'],
        ['.pdf', 'application/pdf application/x-pdf'], ['.txt .text .log', 'text/plain'],
        ['.csv', 'text/csv application/csv text/x-csv application/vnd.ms-excel text/plain'], ['.tsv', 'text/tab-separated-values text/plain'],
        ['.md .markdown', 'text/markdown text/x-markdown text/plain'], ['.json', 'application/json text/json'], ['.xml', 'application/xml text/xml'],
        ['.yaml .yml', 'application/yaml application/x-yaml text/yaml text/x-yaml text/plain'], ['.html .htm', 'text/html'], ['.css', 'text/css'],
        ['.rtf', 'application/rtf text/rtf'], ['.ics', 'text/calendar'], ['.vcf', 'text/vcard text/x-vcard'], ['.sql', 'application/sql text/x-sql text/plain'],
        ['.doc .dot', 'application/msword'], ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['.docm', 'application/vnd.ms-word.document.macroenabled.12'],
        ['.xls .xlt', 'application/vnd.ms-excel'], ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        ['.xlsm', 'application/vnd.ms-excel.sheet.macroenabled.12'],
        ['.ppt .pps', 'application/vnd.ms-powerpoint'], ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        ['.pptm', 'application/vnd.ms-powerpoint.presentation.macroenabled.12'],
        ['.odt', 'application/vnd.oasis.opendocument.text'], ['.ods', 'application/vnd.oasis.opendocument.spreadsheet'],
        ['.odp', 'application/vnd.oasis.opendocument.presentation'], ['.epub', 'application/epub+zip'],
        ['.zip', 'application/zip application/x-zip-compressed multipart/x-zip application/x-zip'],
        ['.rar', 'application/vnd.rar application/x-rar-compressed application/x-rar'], ['.7z', 'application/x-7z-compressed'],
        ['.gz', 'application/gzip application/x-gzip'], ['.tgz', 'application/gzip application/x-gzip application/x-compressed-tar'],
        ['.tar', 'application/x-tar'], ['.bz2', 'application/x-bzip2'],
        ['.ttf', 'font/ttf application/x-font-ttf'], ['.otf', 'font/otf application/x-font-opentype'], ['.woff', 'font/woff application/font-woff'], ['.woff2', 'font/woff2'],
        // programs and scripts (blocked by default, but known so an explicit allow works)
        ['.exe', 'application/x-msdownload application/vnd.microsoft.portable-executable application/x-dosexec application/octet-stream'],
        ['.dll', 'application/x-msdownload application/x-msdos-program application/octet-stream'], ['.com', 'application/x-msdos-program application/x-msdownload'],
        ['.msi', 'application/x-msi application/x-ole-storage application/octet-stream'], ['.bat .cmd', 'application/x-bat application/x-msdos-program text/plain'],
        ['.sh', 'application/x-sh application/x-shellscript text/x-shellscript text/plain'], ['.ps1 .psm1', 'application/x-powershell text/plain application/octet-stream'],
        ['.js .mjs', 'text/javascript application/javascript application/x-javascript'], ['.vbs .vbe', 'text/vbscript application/x-vbscript text/plain'],
        ['.jar', 'application/java-archive application/x-java-archive'], ['.php .phtml', 'application/x-httpd-php application/x-php text/x-php text/plain'],
        ['.py', 'text/x-python application/x-python-code text/plain'], ['.apk', 'application/vnd.android.package-archive'],
        ['.psd', 'image/vnd.adobe.photoshop image/x-photoshop'], ['.ps .eps', 'application/postscript'], ['.sqlite .sqlite3 .db3', 'application/vnd.sqlite3 application/x-sqlite3'],
        ['.xz', 'application/x-xz'], ['.zst', 'application/zstd'], ['.cab', 'application/vnd.ms-cab-compressed'], ['.mid .midi', 'audio/midi audio/x-midi'],
        ['.aif .aiff .aifc', 'audio/aiff audio/x-aiff'], ['.asf', 'video/x-ms-asf'], ['.vob', 'video/mpeg'], ['.dwg', 'image/vnd.dwg application/acad'],
        ['.jp2 .j2k', 'image/jp2'], ['.wasm', 'application/wasm'], ['.chm', 'application/vnd.ms-htmlhelp'],
        ['.dotx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'], ['.xltx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.template'],
        ['.potx', 'application/vnd.openxmlformats-officedocument.presentationml.template'], ['.ppsx', 'application/vnd.openxmlformats-officedocument.presentationml.slideshow'],
        ['.dotm', 'application/vnd.ms-word.template.macroenabled.12'], ['.xltm', 'application/vnd.ms-excel.template.macroenabled.12'], ['.xlam', 'application/vnd.ms-excel.addin.macroenabled.12'],
        ['.potm', 'application/vnd.ms-powerpoint.template.macroenabled.12'], ['.ppsm', 'application/vnd.ms-powerpoint.slideshow.macroenabled.12'], ['.ppam', 'application/vnd.ms-powerpoint.addin.macroenabled.12'],
        ['.lnk', 'application/x-ms-shortcut'], ['.hta', 'application/hta'], ['.reg', 'text/x-ms-regedit application/octet-stream'], ['.scr', 'application/x-msdownload application/octet-stream']
    ];
    const EXT_MIMES = {};     // '.pdf' -> ['application/pdf', 'application/x-pdf']
    const MIME_BY_EXT = {};   // '.pdf' -> 'application/pdf' (primary)
    EXT_TABLE.forEach(([exts, mimes]) => exts.split(' ').forEach(e => { EXT_MIMES[e] = mimes.split(' '); MIME_BY_EXT[e] = EXT_MIMES[e][0]; }));

    // MIME types that mean "program or script", even when the file name looks harmless.
    const DEFAULT_DANGEROUS_MIME_TYPES = [
        'application/x-msdownload', 'application/x-dosexec', 'application/vnd.microsoft.portable-executable', 'application/x-msdos-program',
        'application/x-executable', 'application/x-elf', 'application/x-mach-binary', 'application/x-sh', 'application/x-shellscript', 'text/x-shellscript',
        'application/x-bat', 'application/x-msi', 'application/java-archive', 'application/x-java-archive', 'application/x-httpd-php', 'application/x-php',
        'text/x-php', 'application/hta', 'application/x-ms-shortcut', 'application/x-powershell', 'application/x-vbscript', 'text/vbscript'
    ];

    const GENERIC_MIMES = ['', 'application/octet-stream', 'binary/octet-stream'];

    /** MIME types known for an extension: the per-call `mimeByExtension` config first, then the registry. */
    function mimesForExt(ext, cfg) {
        const custom = cfg && cfg.mimeByExtension;
        if (custom) {
            for (const k of Object.keys(custom)) {
                if (normExt(k) === ext) return [].concat(custom[k]).map(m => String(m).toLowerCase());
            }
        }
        return EXT_MIMES[ext] || [];
    }

    /** FileValidator.addExtension('.xyz', 'application/x-xyz')  or  ('.xyz', ['application/x-xyz', 'application/octet-stream']) */
    function addExtension(ext, mimes) {
        const e = normExt(ext), list = [].concat(mimes).map(m => String(m).toLowerCase()).filter(Boolean);
        if (!list.length) throw new Error('FileValidator.addExtension: give at least one MIME type');
        EXT_MIMES[e] = list;
        MIME_BY_EXT[e] = list[0];
    }

    const ascii = (b, off, s) => { for (let i = 0; i < s.length; i++) if (b[off + i] !== s.charCodeAt(i)) return false; return true; };
    const bytes = (b, arr, off) => { off = off || 0; for (let i = 0; i < arr.length; i++) if (b[off + i] !== arr[i]) return false; return true; };
    const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    const IMAGE_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif', 'avis'];

    // Magic-number table. `executable: true` entries are program files.
    const SIGNATURES = [
        { name: 'png', mime: 'image/png', exts: ['.png', '.apng'], test: b => bytes(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
        { name: 'jpeg', mime: 'image/jpeg', exts: ['.jpg', '.jpeg', '.jpe', '.jfif'], test: b => bytes(b, [0xff, 0xd8, 0xff]) },
        { name: 'gif', mime: 'image/gif', exts: ['.gif'], test: b => ascii(b, 0, 'GIF8') },
        { name: 'webp', mime: 'image/webp', exts: ['.webp'], test: b => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP') },
        { name: 'bmp', mime: 'image/bmp', exts: ['.bmp'], test: b => ascii(b, 0, 'BM') && b.length >= 18 && u32(b, 6) === 0 && [12, 40, 52, 56, 64, 108, 124].includes(u32(b, 14)) },
        { name: 'ico', mime: 'image/x-icon', exts: ['.ico', '.cur'], test: b => (bytes(b, [0, 0, 1, 0]) || bytes(b, [0, 0, 2, 0])) && b[4] > 0 && b[5] === 0 },
        { name: 'tiff', mime: 'image/tiff', exts: ['.tif', '.tiff'], test: b => bytes(b, [0x49, 0x49, 0x2a, 0]) || bytes(b, [0x4d, 0x4d, 0, 0x2a]) },
        { name: 'heif', mime: 'image/heif', exts: ['.heic', '.heif', '.avif'], test: b => ascii(b, 4, 'ftyp') && IMAGE_BRANDS.some(x => ascii(b, 8, x)) },
        { name: 'iso-bmff', mime: 'video/mp4', exts: ['.mp4', '.m4v', '.m4a', '.m4b', '.mov', '.3gp', '.3g2', '.f4v'],
            test: b => ascii(b, 4, 'ftyp') || ascii(b, 4, 'moov') },
        { name: 'matroska', mime: 'video/webm', exts: ['.webm', '.mkv', '.weba'], test: b => bytes(b, [0x1a, 0x45, 0xdf, 0xa3]) },
        { name: 'avi', mime: 'video/x-msvideo', exts: ['.avi'], test: b => ascii(b, 0, 'RIFF') && ascii(b, 8, 'AVI ') },
        { name: 'wav', mime: 'audio/wav', exts: ['.wav'], test: b => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE') },
        { name: 'ogg', mime: 'audio/ogg', exts: ['.ogg', '.oga', '.ogv', '.opus'], test: b => ascii(b, 0, 'OggS') },
        { name: 'flac', mime: 'audio/flac', exts: ['.flac'], test: b => ascii(b, 0, 'fLaC') },
        { name: 'mp3', mime: 'audio/mpeg', exts: ['.mp3'],
            test: b => (ascii(b, 0, 'ID3') && b[3] >= 2 && b[3] <= 4 && b[4] === 0 && (b[6] | b[7] | b[8] | b[9]) < 0x80) || (b[0] === 0xff && (b[1] & 0xe6) === 0xe2 && (b[1] & 0x18) !== 0x08) },
        { name: 'aac', mime: 'audio/aac', exts: ['.aac'], test: b => b[0] === 0xff && (b[1] & 0xf6) === 0xf0 },
        { name: 'pdf', mime: 'application/pdf', exts: ['.pdf'], test: b => ascii(b, 0, '%PDF') },
        { name: 'zip', mime: 'application/zip',
            exts: ['.zip', '.docx', '.xlsx', '.pptx', '.docm', '.xlsm', '.pptm', '.odt', '.ods', '.odp', '.epub', '.vsix', '.xpi', '.whl', '.jar', '.war', '.apk'],
            test: b => ascii(b, 0, 'PK') && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6) },
        { name: 'rar', mime: 'application/vnd.rar', exts: ['.rar'], test: b => ascii(b, 0, 'Rar!') },
        { name: '7z', mime: 'application/x-7z-compressed', exts: ['.7z'], test: b => bytes(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) },
        { name: 'gzip', mime: 'application/gzip', exts: ['.gz', '.tgz'], test: b => bytes(b, [0x1f, 0x8b]) },
        { name: 'ole', mime: 'application/msword', exts: ['.doc', '.xls', '.ppt', '.msg'], test: b => bytes(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) },
        { name: 'psd', mime: 'image/vnd.adobe.photoshop', exts: ['.psd'], test: b => ascii(b, 0, '8BPS') },
        { name: 'jp2', mime: 'image/jp2', exts: ['.jp2', '.j2k'], test: b => bytes(b, [0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a]) },
        { name: 'dwg', mime: 'image/vnd.dwg', exts: ['.dwg'], test: b => ascii(b, 0, 'AC10') },
        { name: 'rtf', mime: 'application/rtf', exts: ['.rtf'], test: b => ascii(b, 0, '{\\rtf') },
        { name: 'postscript', mime: 'application/postscript', exts: ['.ps', '.eps'], test: b => ascii(b, 0, '%!PS') || bytes(b, [0xc5, 0xd0, 0xd3, 0xc6]) },
        { name: 'sqlite', mime: 'application/vnd.sqlite3', exts: ['.sqlite', '.sqlite3', '.db3'], test: b => ascii(b, 0, 'SQLite format 3') && b[15] === 0 },
        { name: 'woff', mime: 'font/woff', exts: ['.woff'], test: b => ascii(b, 0, 'wOFF') },
        { name: 'woff2', mime: 'font/woff2', exts: ['.woff2'], test: b => ascii(b, 0, 'wOF2') },
        { name: 'otf', mime: 'font/otf', exts: ['.otf'], test: b => ascii(b, 0, 'OTTO') },
        { name: 'ttf', mime: 'font/ttf', exts: ['.ttf'], weak: true, test: b => bytes(b, [0, 1, 0, 0]) && b[4] === 0 && b[5] > 0 && b[5] < 64 },
        { name: 'xz', mime: 'application/x-xz', exts: ['.xz'], test: b => bytes(b, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0]) },
        { name: 'zstd', mime: 'application/zstd', exts: ['.zst'], test: b => bytes(b, [0x28, 0xb5, 0x2f, 0xfd]) },
        { name: 'bzip2', mime: 'application/x-bzip2', exts: ['.bz2'], test: b => ascii(b, 0, 'BZh') && b[3] >= 0x31 && b[3] <= 0x39 },
        { name: 'cab', mime: 'application/vnd.ms-cab-compressed', exts: ['.cab'], test: b => ascii(b, 0, 'MSCF') },
        { name: 'tar', mime: 'application/x-tar', exts: ['.tar'], test: b => ascii(b, 257, 'ustar') },
        { name: 'flv', mime: 'video/x-flv', exts: ['.flv'], test: b => ascii(b, 0, 'FLV') && b[3] === 1 },
        { name: 'asf', mime: 'video/x-ms-asf', exts: ['.wmv', '.wma', '.asf'], test: b => bytes(b, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]) },
        { name: 'midi', mime: 'audio/midi', exts: ['.mid', '.midi'], test: b => ascii(b, 0, 'MThd') },
        { name: 'aiff', mime: 'audio/aiff', exts: ['.aif', '.aiff', '.aifc'], test: b => ascii(b, 0, 'FORM') && (ascii(b, 8, 'AIFF') || ascii(b, 8, 'AIFC')) },
        { name: 'mpeg-ps', mime: 'video/mpeg', exts: ['.mpg', '.mpeg', '.vob'], test: b => bytes(b, [0, 0, 1, 0xba]) },
        // executables — flagged as DANGEROUS_CONTENT
        { name: 'exe', executable: true, exts: ['.exe', '.dll', '.sys', '.scr', '.com'], test: b => ascii(b, 0, 'MZ') && b.length >= 64 && u32(b, 60) >= 0x40 && u32(b, 60) < 0x100000 },
        { name: 'elf', executable: true, exts: [], test: b => bytes(b, [0x7f, 0x45, 0x4c, 0x46]) },
        { name: 'mach-o', executable: true, exts: [], test: b => bytes(b, [0xcf, 0xfa, 0xed, 0xfe]) || bytes(b, [0xfe, 0xed, 0xfa, 0xcf]) ||
            bytes(b, [0xce, 0xfa, 0xed, 0xfe]) || bytes(b, [0xfe, 0xed, 0xfa, 0xce]) || bytes(b, [0xca, 0xfe, 0xba, 0xbe]) },
        { name: 'wasm', executable: true, exts: ['.wasm'], test: b => bytes(b, [0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]) },
        { name: 'lnk', executable: true, exts: ['.lnk'], test: b => bytes(b, [0x4c, 0, 0, 0, 1, 0x14, 2, 0]) },
        { name: 'chm', executable: true, exts: ['.chm'], test: b => ascii(b, 0, 'ITSF') },
        { name: 'dex', executable: true, exts: [], test: b => ascii(b, 0, 'dex\n') },
        { name: 'shebang', executable: true, exts: ['.sh'], test: b => ascii(b, 0, '#!/') || ascii(b, 0, '#! /') }
    ];
    const SIGNATURE_EXTS = new Set();
    SIGNATURES.forEach(s => { if (!s.executable) s.exts.forEach(e => SIGNATURE_EXTS.add(e)); });

    // ------------------------------------------------------------------ helpers
    function getFileExtension(fileName) {
        const ext = getExt(fileName);
        return ext ? ext.slice(1) : '';
    }

    /** Removes trailing dots and whitespace in linear time (a regex like /[.\s]+$/ is quadratic on a long run of dots). */
    function trimTrailingDots(str) {
        let end = str.length;
        while (end > 0 && (str.charCodeAt(end - 1) === 46 || /\s/.test(str.charAt(end - 1)))) end--;
        return end === str.length ? str : str.slice(0, end);
    }

    function getExt(name) {
        name = trimTrailingDots(String(name || '')); // Windows ignores trailing dots / spaces
        const i = name.lastIndexOf('.');
        return i < 0 ? '' : name.slice(i).toLowerCase();
    }

    function normExt(e) { return '.' + String(e).trim().replace(/^\./, '').toLowerCase(); }

    function getCategory(file, sniffedMime) {
        let mime = (file.type || sniffedMime || MIME_BY_EXT[getExt(file.name)] || '').toLowerCase();
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        if (mime.startsWith('audio/')) return 'audio';
        return 'file';
    }
    const getMimeCategory = m => (m ? getCategory({ type: m, name: '' }) : '');

    const units = { B: 'B', KB: 'KB', MB: 'MB', GB: 'GB' };     // FileValidator.units: a language pack changes these
    const phrases = {};                                          // FileValidator.phrases: English fragment -> translation

    /**
     * True when SVG text can run code or reach outside the file: scripts, event handlers, javascript: URLs, foreignObject,
     * <!DOCTYPE>/<!ENTITY> (XXE, entity bombs), external href/xlink:href (remote <use>, <image>, <feImage>), CSS @import and url(http...).
     * Same-document references (#id) and embedded raster images (data:image/png|jpeg|gif|webp) stay allowed; <a href="http(s)://"> links are plain navigation.
     * Every check is a linear scan (no nested quantifiers), so hostile files cannot stall it.
     */
    function svgIsUnsafe(raw) {
        // decode numeric character references first so "&#106;avascript:" cannot hide the scheme
        const txt = raw.replace(/&#x([0-9a-f]{1,6});?/gi, (m, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
            .replace(/&#(\d{1,7});?/g, (m, d) => String.fromCodePoint(Math.min(+d, 0x10ffff)));
        if (/<script[\s>\/]|[\s"'\/]on\w+\s*=|<foreignObject|<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(txt)) return true;
        if (/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:|v\s*b\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i.test(txt)) return true;
        if (/@import|url\(\s*["']?\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(txt)) return true;
        for (let i = txt.indexOf('<'); i >= 0;) {   // walk the tags with indexOf: one pass, no backtracking
            const j = txt.indexOf('>', i);
            if (j < 0) break;
            const tag = txt.slice(i + 1, j), sp = tag.search(/[\s\/]/), name = (sp < 0 ? tag : tag.slice(0, sp)).toLowerCase();
            const attrRe = /(?:^|[\s"'])(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
            let a;
            while ((a = attrRe.exec(tag))) {
                const v = (a[1] !== undefined ? a[1] : a[2] !== undefined ? a[2] : a[3]).trim();
                if (v === '' || v.charAt(0) === '#') continue;
                if (/^data:image\/(?:png|jpe?g|gif|webp)[;,]/i.test(v)) continue;
                if (name === 'a' && /^(?:https?:|mailto:|tel:)/i.test(v)) continue;
                return true;
            }
            i = txt.indexOf('<', j);
        }
        return false;
    }

    /** A fragment of a message ("macros", "it holds {n} files"). Translated through FileValidator.phrases, then filled. */
    function phrase(text, values) { return fill(phrases[text] || text, values); }

    const localeState = { code: 'en' };
    /** Plural-aware phrase: phraseN('status.added', 2, {}, { one: '{n} file added.', other: '{n} files added.' }). {n} is filled with the count. */
    function phraseN(key, n, values, fallback) {
        const entry = phrases[key] !== undefined ? phrases[key] : fallback;
        let text = entry;
        if (entry && typeof entry === 'object') {
            let category = n === 1 ? 'one' : 'other';
            try { category = new Intl.PluralRules(localeState.code).select(n); } catch (e) { /* keep the simple rule */ }
            text = entry[category] !== undefined ? entry[category] : (entry.other !== undefined ? entry.other : '');
        }
        return fill(String(text), Object.assign({ n }, values));
    }

    function formatBytes(n) {
        if (n < 1024) return n + ' ' + units.B;
        if (n < 1024 * 1024) return +(n / 1024).toFixed(1) + ' ' + units.KB;
        if (n < 1024 * 1024 * 1024) return +(n / 1024 / 1024).toFixed(2) + ' ' + units.MB;
        return +(n / 1024 / 1024 / 1024).toFixed(2) + ' ' + units.GB;
    }

    function fill(tpl, params) {
        return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined ? params[k] : m));
    }

    function getMessage(code, params, config) {
        let tpl = config && config.messages && config.messages[code];
        if (tpl === undefined) tpl = defaultMessages[code] || errorMessages[code] || code;
        if (typeof tpl === 'function') tpl = tpl(params || {});
        return fill(tpl, params);
    }

    const globalDefaults = {};   // FileValidator.setDefaults({...})
    const warned = {};
    function warnOnce(key, msg) { if (!warned[key] && root.console) { warned[key] = true; console.warn('FileValidator: ' + msg); } }

    /** Accepts friendly input: numeric strings ("5"), comma lists ("jpg, png"), and an HTML-style `accept` string. */
    function normalizeConfig(config) {
        const c = Object.assign({}, globalDefaults, config);
        ['maxFileSizeMB', 'maxFileSize', 'minFileSizeKB', 'minFileSize', 'maxTotalSizeMB', 'maxFiles', 'minFiles',
            'maxImageWidth', 'maxImageHeight', 'minImageWidth', 'minImageHeight', 'imageLimit', 'fileLimit',
            'maxFilenameLength', 'aspectRatioTolerance', 'maxDurationSec', 'minDurationSec', 'duplicateContentMaxMB', 'maxPathDepth', 'maxPathLength'].forEach(k => {
            if (typeof c[k] === 'string' && c[k].trim() !== '' && isFinite(Number(c[k]))) c[k] = Number(c[k]);
        });
        ['allowedExtensions', 'allowedMimeTypes', 'dangerousExtensions'].forEach(k => {
            if (typeof c[k] === 'string') c[k] = c[k].split(',').map(x => x.trim()).filter(Boolean);
        });
        if (c.accept) { // like <input accept=".jpg,image/*,application/pdf">
            const parts = (Array.isArray(c.accept) ? c.accept : String(c.accept).split(',')).map(x => x.trim()).filter(Boolean);
            const exts = parts.filter(x => x.startsWith('.')), mimes = parts.filter(x => x.includes('/'));
            if (exts.length && !c.allowedExtensions) c.allowedExtensions = exts;
            if (mimes.length && !c.allowedMimeTypes) c.allowedMimeTypes = mimes;
        }
        if (c.duplicateNames === true) c.validate = Object.assign({ duplicateNames: true }, c.validate);
        if (c.imageDecode === false) c.validate = Object.assign({}, c.validate, { imageDecode: false });
        // options of the wrong type are ignored (with one warning) instead of crashing later
        ['allowedExtensions', 'allowedMimeTypes', 'dangerousExtensions', 'dangerousMimeTypes'].forEach(k => {
            if (c[k] != null && !Array.isArray(c[k])) { warnOnce('type:' + k, '"' + k + '" must be a list (or a comma-separated string), it was ignored'); delete c[k]; }
        });
        ['messages', 'validate', 'categories', 'mimeByExtension', 'methods', 'validateTarget'].forEach(k => {
            if (c[k] != null && (typeof c[k] !== 'object' || Array.isArray(c[k]))) { warnOnce('type:' + k, '"' + k + '" must be an object, it was ignored'); delete c[k]; }
        });
        if (c.documents != null && typeof c.documents !== 'boolean' && (typeof c.documents !== 'object' || Array.isArray(c.documents))) delete c.documents;
        if (c.ignoreFiles != null && typeof c.ignoreFiles !== 'boolean' && !Array.isArray(c.ignoreFiles)) { if (typeof c.ignoreFiles === 'string' || c.ignoreFiles instanceof RegExp) c.ignoreFiles = [c.ignoreFiles]; else delete c.ignoreFiles; }
        if (c.filenameRegex != null && !(c.filenameRegex instanceof RegExp)) delete c.filenameRegex;
        Object.keys(c).forEach(k => { if (!KNOWN_OPTIONS.includes(k)) warnOnce('opt:' + k, 'unknown option "' + k + '" (typo?)'); });
        return c;
    }

    function toArray(files) {
        if (!files) return [];
        let list;
        if (Array.isArray(files)) list = files;
        else if (typeof files.length === 'number' && typeof files !== 'string') list = Array.from(files); // FileList
        else if (files.files) list = Array.from(files.files);                                              // <input>
        else list = [files];
        return list.filter(Boolean);                                                                               // single File
    }

    /** A rule is on when its value is configured, unless config.validate[flag] === false. */
    function on(config, flag, hasValue) {
        const f = config.validate && config.validate[flag];
        if (f === false) return false;
        return f === true || hasValue;
    }
    const isFn = f => typeof f === 'function';
    const isNum = v => typeof v === 'number' && isFinite(v);
    const nonEmptyArr = v => Array.isArray(v) && v.length > 0;

    async function mapLimit(items, limit, fn) {
        const out = new Array(items.length);
        let next = 0;
        const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
        return out;
    }

    // ------------------------------------------------------------------ folder paths, ignored files
    const IGNORED_FILES = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '.localized', /^~\$/, /^\._/];   // ignoreFiles: true

    /** Relative path of a file picked from a folder ("photos/2024/a.jpg"), or ''. */
    function getPath(file) { return String((file && (file.webkitRelativePath || file.fvPath)) || ''); }

    function isIgnored(file, list) {
        if (!list) return false;
        const name = String((file && file.name) || '');
        return (list === true ? IGNORED_FILES : [].concat(list)).some(i => i instanceof RegExp ? i.test(name) : String(i).toLowerCase() === name.toLowerCase());
    }

    // ------------------------------------------------------------------ filename checks
    const BIDI = /[‎‏‪-‮⁦-⁩]/;
    const CONTROL = /[\u0000-\u001f\u007f]/;
    const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

    function isValidFilename(name, config) {
        if (config && config.filenameRegex instanceof RegExp) return config.filenameRegex.test(name);
        return /^[\p{L}\p{N}_\-][\p{L}\p{N}_\-. ()[\]]*$/u.test(name) && !/[. ]$/.test(name) && !RESERVED.test(name);
    }

    function hasSuspiciousExtension(filename, dangerous) {
        const parts = trimTrailingDots(String(filename).toLowerCase()).split('.');
        if (parts.length < 3) return false;
        const set = new Set((dangerous || DEFAULT_DANGEROUS_EXTENSIONS).map(normExt));
        return parts.slice(1, -1).some(p => !SAFE_INTERMEDIATE.includes(p) && set.has('.' + p.trim()));
    }

    // ------------------------------------------------------------------ content sniffing
    async function readHead(file, n) {
        if (!file || typeof file.slice !== 'function') return null;
        const blob = file.slice(0, n);
        try {
            if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
            if (root.FileReader) {
                return await new Promise((res, rej) => {
                    const r = new root.FileReader();
                    r.onload = () => res(new Uint8Array(r.result));
                    r.onerror = () => rej(r.error);
                    r.readAsArrayBuffer(blob);
                });
            }
        } catch (e) { /* unreadable */ }
        return null;
    }

    async function readRange(file, from, to) {
        from = Math.max(0, Math.floor(Number(from)) || 0);          // whole numbers only: Node 20 aborts the process on a fractional Blob.slice()
        to = Math.max(from, Math.floor(Number(to)) || 0);
        const blob = file.slice(from, to);
        if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
        if (root.FileReader) {
            return new Promise((res, rej) => { const r = new root.FileReader(); r.onload = () => res(new Uint8Array(r.result)); r.onerror = () => rej(r.error); r.readAsArrayBuffer(blob); });
        }
        return new Uint8Array(0);
    }

    // ---------------------------------------------------------------- metadata: what a photo gives away, and removing it
    // JPEG, PNG and WebP. Pure byte work (no canvas), so the picture is not re-encoded and the same code runs in the browser and in Node.
    // The EXIF Orientation tag is the one piece worth keeping: phones store photos sideways and rely on it, so it is rewritten into a
    // minimal EXIF block that holds nothing else (keepOrientation: false drops it too).
    const CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
        return t;
    })();
    function crc32(b, from, to) { let c = 0xffffffff; for (let i = from; i < to; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
    const be16 = (b, o) => (b[o] << 8) | b[o + 1];
    const be32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    const putBe32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const putLe32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    const concatBytes = parts => {
        const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
        let at = 0; parts.forEach(p => { out.set(p, at); at += p.length; });
        return out;
    };

    /** The TIFF block inside EXIF -> { orientation: 1-8 | null, hasGps } (GPS counts when a latitude or longitude is really there), or null. */
    function parseTiff(b, o, end) {
        if (end - o < 8) return null;
        const little = b[o] === 0x49 && b[o + 1] === 0x49;
        if (!little && !(b[o] === 0x4d && b[o + 1] === 0x4d)) return null;
        const r16 = p => little ? (b[p] | (b[p + 1] << 8)) : ((b[p] << 8) | b[p + 1]);
        const r32 = p => little ? ((b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0) : (((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0);
        if (r16(o + 2) !== 42) return null;
        const ifd = o + r32(o + 4);
        if (ifd + 2 > end) return null;
        const out = { orientation: null, hasGps: false };
        const n = r16(ifd);
        for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (e + 12 > end) break;
            const tag = r16(e);
            if (tag === 0x0112 && r16(e + 2) === 3) { const v = r16(e + 8); if (v >= 1 && v <= 8) out.orientation = v; }
            else if (tag === 0x8825) {
                const gps = o + r32(e + 8);
                if (gps + 2 <= end) {
                    const gn = r16(gps);
                    for (let j = 0; j < gn; j++) {
                        const ge = gps + 2 + j * 12;
                        if (ge + 12 > end) break;
                        const gt = r16(ge);
                        if (gt === 2 || gt === 4) out.hasGps = true;   // GPSLatitude / GPSLongitude
                    }
                }
            }
        }
        return out;
    }

    /** A TIFF block with nothing but the Orientation tag (26 bytes). */
    const orientationTiff = v => Uint8Array.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, v, 0, 0, 0, 0, 0, 0, 0]);

    const metaOf = () => ({ exif: false, gps: false, xmp: false, iptc: false, comments: false, orientation: null, other: false });
    const kindsOf = m => [m.exif && 'EXIF', m.gps && 'GPS location', m.xmp && 'XMP', m.iptc && 'IPTC / Photoshop', m.comments && 'comments', m.other && 'other'].filter(Boolean);

    function readExifInto(meta, tiff) {
        meta.exif = true;
        if (tiff) { if (tiff.orientation) meta.orientation = tiff.orientation; if (tiff.hasGps) meta.gps = true; }
    }

    /** -> { format, meta, parts, removed } where parts are the bytes to keep, or null when the file is not a readable JPEG. */
    function scanJpeg(b, keepOrientation, keepColorProfile) {
        if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
        const meta = metaOf(), kept = [], removed = [];
        let pos = 2, tail = null;
        while (pos + 2 <= b.length) {
            if (b[pos] !== 0xff) return null;
            const marker = b[pos + 1];
            if (marker === 0xff) { pos++; continue; }
            if (marker === 0xda || marker === 0xd9) { tail = b.subarray(pos); break; }
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { kept.push({ bytes: b.subarray(pos, pos + 2) }); pos += 2; continue; }
            if (pos + 4 > b.length) return null;
            const len = be16(b, pos + 2);
            if (len < 2 || pos + 2 + len > b.length) return null;
            const seg = b.subarray(pos, pos + 2 + len), at = pos + 4, end = pos + 2 + len;
            let drop = false;
            if (marker === 0xe1) {
                drop = true;
                if (ascii(b, at, 'Exif\0\0')) readExifInto(meta, parseTiff(b, at + 6, end));
                else if (ascii(b, at, 'http://ns.adobe.com/')) meta.xmp = true;
                else meta.other = true;
            } else if (marker === 0xe2) {
                if (!ascii(b, at, 'ICC_PROFILE\0') || !keepColorProfile) { drop = true; if (!ascii(b, at, 'ICC_PROFILE\0')) meta.other = true; }
            } else if (marker === 0xed) { drop = true; meta.iptc = true; }
            else if (marker === 0xfe) { drop = true; meta.comments = true; }
            else if ((marker >= 0xe3 && marker <= 0xec) || marker === 0xef) { drop = true; meta.other = true; }
            if (drop) removed.push(marker); else kept.push({ bytes: seg, app0: marker === 0xe0 });
            pos = end;
        }
        if (!tail) return null;
        const parts = [b.subarray(0, 2)];
        let inserted = false;
        const exifSeg = keepOrientation && meta.orientation && meta.orientation > 1
            ? concatBytes([Uint8Array.from([0xff, 0xe1, 0, 34]), Uint8Array.from(ascii0('Exif\0\0')), orientationTiff(meta.orientation)]) : null;
        kept.forEach(k => {
            if (exifSeg && !inserted && !k.app0) { parts.push(exifSeg); inserted = true; }
            parts.push(k.bytes);
        });
        if (exifSeg && !inserted) parts.push(exifSeg);
        parts.push(tail);
        return { format: 'jpeg', meta, parts, removed: removed.length };
    }
    const ascii0 = s => Array.from(s).map(c => c.charCodeAt(0));

    function scanPng(b, keepOrientation) {
        if (b.length < 33 || !bytes(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
        const meta = metaOf(), kept = [], removed = [];
        let pos = 8, sawEnd = false;
        while (pos + 12 <= b.length) {
            const size = be32(b, pos);
            if (pos + 12 + size > b.length) return null;
            const type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]);
            let drop = false;
            if (type === 'eXIf') { drop = true; readExifInto(meta, parseTiff(b, pos + 8, pos + 8 + size)); }
            else if (type === 'iTXt') { drop = true; if (ascii(b, pos + 8, 'XML:com.adobe.xmp')) meta.xmp = true; else meta.comments = true; }
            else if (type === 'tEXt' || type === 'zTXt') { drop = true; meta.comments = true; }
            else if (type === 'tIME') { drop = true; meta.other = true; }
            if (drop) removed.push(type); else kept.push({ type, bytes: b.subarray(pos, pos + 12 + size) });
            pos += 12 + size;
            if (type === 'IEND') { sawEnd = true; break; }
        }
        if (!sawEnd) return null;
        const parts = [b.subarray(0, 8)];
        let inserted = false;
        let exifChunk = null;
        if (keepOrientation && meta.orientation && meta.orientation > 1) {
            const body = concatBytes([Uint8Array.from(ascii0('eXIf')), orientationTiff(meta.orientation)]);
            exifChunk = concatBytes([Uint8Array.from(putBe32(26)), body, Uint8Array.from(putBe32(crc32(body, 0, body.length)))]);
        }
        kept.forEach(k => {
            if (exifChunk && !inserted && k.type === 'IDAT') { parts.push(exifChunk); inserted = true; }
            parts.push(k.bytes);
        });
        return { format: 'png', meta, parts, removed: removed.length };
    }

    function scanWebp(b, keepOrientation) {
        if (b.length < 16 || !ascii(b, 0, 'RIFF') || !ascii(b, 8, 'WEBP')) return null;
        const meta = metaOf(), kept = [], removed = [];
        let pos = 12, hasVp8x = false;
        while (pos + 8 <= b.length) {
            const id = String.fromCharCode(b[pos], b[pos + 1], b[pos + 2], b[pos + 3]);
            const size = u32(b, pos + 4), padded = size + (size & 1);
            if (pos + 8 + size > b.length) return null;
            let drop = false;
            if (id === 'EXIF') { drop = true; const off = ascii(b, pos + 8, 'Exif\0\0') ? 6 : 0; readExifInto(meta, parseTiff(b, pos + 8 + off, pos + 8 + size)); }
            else if (id === 'XMP ') { drop = true; meta.xmp = true; }
            if (id === 'VP8X') hasVp8x = true;
            if (drop) removed.push(id); else kept.push({ id, bytes: b.slice(pos, Math.min(b.length, pos + 8 + padded)) });
            pos += 8 + padded;
        }
        const exif = keepOrientation && meta.orientation && meta.orientation > 1 && hasVp8x;
        const parts = [];
        kept.forEach(k => {
            if (k.id === 'VP8X') {
                const flags = k.bytes[8];
                k.bytes[8] = (flags & ~0x0c) | (exif ? 0x08 : 0);   // clear the EXIF (0x08) and XMP (0x04) flags
                parts.push(k.bytes);
                if (exif) parts.push(concatBytes([Uint8Array.from(ascii0('EXIF')), Uint8Array.from(putLe32(26)), orientationTiff(meta.orientation)]));
            } else parts.push(k.bytes);
        });
        const body = concatBytes(parts);
        const out = concatBytes([Uint8Array.from(ascii0('RIFF')), Uint8Array.from(putLe32(body.length + 4)), Uint8Array.from(ascii0('WEBP')), body]);
        return { format: 'webp', meta, parts: [out], removed: removed.length };
    }

    function scanImage(b, o) {
        const ori = !o || o.keepOrientation !== false, icc = !o || o.keepColorProfile !== false;
        return scanJpeg(b, ori, icc) || scanPng(b, ori) || scanWebp(b, ori);
    }

    const METADATA_MAX_MB = 64;
    async function readWhole(file, maxMB) {
        if (!file || typeof file.slice !== 'function' || !(file.size > 0) || file.size > (maxMB || METADATA_MAX_MB) * 1048576) return null;
        try { return await readRange(file, 0, file.size); } catch (e) { return null; }
    }

    /**
     * What is hidden in a photo: `{ format, exif, gps, xmp, iptc, comments, orientation, kinds: ['EXIF', 'GPS location', ...] }`, or null for a file that
     * is not a readable JPEG, PNG or WebP. `gps` is true only when a latitude or longitude is really stored.
     */
    async function readMetadata(file, options) {
        const b = await readWhole(file, options && options.maxMB);
        const r = b && scanImage(b, options);
        if (!r) return null;
        const m = r.meta;
        return { format: r.format, exif: m.exif, gps: m.gps, xmp: m.xmp, iptc: m.iptc, comments: m.comments, orientation: m.orientation, kinds: kindsOf(m) };
    }

    /**
     * Removes EXIF (camera, date, GPS location), XMP, IPTC / Photoshop data and comments from a JPEG, PNG or WebP without re-encoding the picture.
     * Returns a new File (`file.fvStripped = { removed: ['EXIF', ...], from, to }`), or the same file when there is nothing to remove or the file is
     * not a readable JPEG, PNG or WebP. Options: `keepOrientation` (default true: phone photos stay upright), `keepColorProfile` (default true), `maxMB` (64).
     */
    async function stripMetadata(file, options) {
        const b = await readWhole(file, options && options.maxMB);
        const r = b && scanImage(b, options);
        if (!r || r.removed === 0) return file;
        const out = concatBytes(r.parts);
        if (out.length === b.length && r.meta.orientation == null && !kindsOf(r.meta).length) return file;
        const Ctor = root.File || (typeof File === 'function' ? File : null);
        const blobOpts = { type: file.type || '', lastModified: file.lastModified };
        const result = Ctor ? new Ctor([out], file.name, blobOpts) : new Blob([out], blobOpts);
        try { Object.defineProperty(result, 'fvStripped', { value: { removed: kindsOf(r.meta), from: file.size, to: out.length }, enumerable: false }); } catch (e) { /* frozen */ }
        if (file.fvPath) result.fvPath = file.fvPath;
        return result;
    }

    // ---------------------------------------------------------------- deeper checks: ZIP / Office, PDF, legacy Office macros
    const DOC_DEFAULTS = {
        checkStructure: true, blockMacros: true, blockEmbeddedPrograms: true, blockUnsafePaths: true,
        blockPdfJavaScript: true, blockPdfLaunch: true,
        maxScanMB: 25, maxUncompressedMB: 2048, maxCompressionRatio: 250, maxEntries: 20000
    };
    const OOXML_PREFIX = {
        '.docx': 'word/', '.docm': 'word/', '.dotx': 'word/', '.dotm': 'word/',
        '.xlsx': 'xl/', '.xlsm': 'xl/', '.xltx': 'xl/', '.xltm': 'xl/', '.xlam': 'xl/',
        '.pptx': 'ppt/', '.pptm': 'ppt/', '.potx': 'ppt/', '.potm': 'ppt/', '.ppsx': 'ppt/', '.ppsm': 'ppt/', '.ppam': 'ppt/'
    };
    const MACRO_EXTS = ['.docm', '.dotm', '.xlsm', '.xltm', '.xlam', '.pptm', '.potm', '.ppsm', '.ppam'];
    const ODF_EXTS = ['.odt', '.ods', '.odp'];
    const OLE_DOC_EXTS = ['.doc', '.dot', '.xls', '.xlt', '.ppt', '.pps', '.pot'];
    const u16 = (b, o) => b[o] | (b[o + 1] << 8);
    const EXEC_NAME = /\.(exe|dll|bat|cmd|vbs|vbe|js|jse|jar|scr|msi|ps1|com|hta|lnk|wsf)$/i;

    /** Reads the ZIP central directory (no decompression). -> { ok, reason, entries: [{ name, csize, usize }], skipped } */
    async function inspectZip(file) {
        const size = file.size;
        if (size < 22) return { ok: false, reason: 'the file is too short' };
        const tailLen = Math.min(size, 65557);
        const tail = await readRange(file, size - tailLen, size);
        let eocd = -1;
        for (let i = tail.length - 22; i >= 0; i--) {
            if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6 && i + 22 + u16(tail, i + 20) <= tail.length) { eocd = i; break; }
        }
        if (eocd < 0) return { ok: false, reason: 'the ZIP directory at the end of the file is missing (the file may be cut off)' };
        const count = u16(tail, eocd + 10), cdSize = u32(tail, eocd + 12), cdOff = u32(tail, eocd + 16);
        if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) return { ok: true, entries: [], skipped: 'zip64' };
        if (cdOff + cdSize > size) return { ok: false, reason: 'the ZIP directory points outside the file' };
        if (cdSize > 32 * 1048576) return { ok: true, entries: [], skipped: 'large' };
        const cd = await readRange(file, cdOff, cdOff + cdSize);
        const dec = typeof TextDecoder === 'function' ? new TextDecoder('utf-8') : null;
        const entries = [];
        let pos = 0;
        while (pos + 46 <= cd.length && entries.length < count) {
            if (u32(cd, pos) !== 0x02014b50) break;
            const nameLen = u16(cd, pos + 28), extraLen = u16(cd, pos + 30), commentLen = u16(cd, pos + 32);
            const raw = cd.subarray(pos + 46, pos + 46 + nameLen);
            entries.push({ name: dec ? dec.decode(raw) : String.fromCharCode.apply(null, raw), csize: u32(cd, pos + 20), usize: u32(cd, pos + 24) });
            pos += 46 + nameLen + extraLen + commentLen;
        }
        if (entries.length !== count) return { ok: false, reason: 'the ZIP directory is damaged' };
        return { ok: true, entries };
    }

    const latin1 = bytes => { let out = ''; for (let i = 0; i < bytes.length; i += 32768) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768)); return out; };
    const unhash = str => str.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));   // /J#61vaScript -> /JavaScript

    function indexOfUtf16(hay, text) {
        const needle = []; for (let i = 0; i < text.length; i++) { needle.push(text.charCodeAt(i), 0); }
        outer: for (let i = 0; i <= hay.length - needle.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return i; }
        return -1;
    }

    /** Looks inside PDF / Office / ZIP files. Adds problems through `add`. */
    async function inspectDocument(file, ext, sig, cfg, add, explicitlyAllowed) {
        const d = Object.assign({}, DOC_DEFAULTS, typeof cfg.documents === 'object' ? cfg.documents : null);
        const dangerous = detected => add('DANGEROUS_CONTENT', { detected });
        if (sig.name === 'zip') {
            const kind = phrase(OOXML_PREFIX[ext] ? 'Office document' : (ODF_EXTS.includes(ext) ? 'document' : 'ZIP archive'));
            const z = await inspectZip(file);
            if (!z.ok) { if (d.checkStructure) add('CORRUPT_FILE', { kind, reason: phrase(z.reason) }); return; }
            const names = z.entries.map(e => e.name);
            if (d.blockUnsafePaths && names.some(n => /(^|[\\/])\.\.([\\/]|$)/.test(n) || n.charAt(0) === '/' || /^[a-z]:/i.test(n))) dangerous(phrase('unsafe file paths inside the archive'));
            const usize = z.entries.reduce((sum, e) => sum + e.usize, 0), csize = z.entries.reduce((sum, e) => sum + e.csize, 0);
            if (z.entries.length > d.maxEntries) add('ARCHIVE_BOMB', { reason: phrase('it holds {n} files', { n: z.entries.length }) });
            else if (usize > d.maxUncompressedMB * 1048576) add('ARCHIVE_BOMB', { reason: phrase('it would expand to {size}', { size: formatBytes(usize) }) });
            else if (csize > 0 && usize > 50 * 1048576 && usize / csize > d.maxCompressionRatio) add('ARCHIVE_BOMB', { reason: phrase('it compresses {ratio} times, which is not normal for a real document', { ratio: Math.round(usize / csize) }) });
            const prefix = OOXML_PREFIX[ext];
            if (prefix && d.checkStructure && !z.skipped && (!names.includes('[Content_Types].xml') || !names.some(n => n.indexOf(prefix) === 0))) {
                add('CORRUPT_FILE', { kind, reason: phrase('required parts are missing, so it is not a real {type} file', { type: ext.slice(1).toUpperCase() }) });
            }
            if (d.blockMacros && !(explicitlyAllowed && MACRO_EXTS.includes(ext))) {
                const macro = (prefix || ext === '.xlam') && names.some(n => /(^|\/)vbaProject\.bin$/i.test(n));
                const odfMacro = ODF_EXTS.includes(ext) && names.some(n => /^(Basic|Scripts)\//.test(n));
                if (macro || odfMacro) dangerous(phrase('macros'));
            }
            if (d.blockEmbeddedPrograms && (prefix || ODF_EXTS.includes(ext)) && names.some(n => /(^|\/)activeX\//i.test(n) || (/(^|\/)(embeddings|Object \d+)\//i.test(n) && EXEC_NAME.test(n)))) dangerous(phrase('embedded programs'));
            return;
        }
        if (sig.name === 'pdf') {
            const size = file.size, cap = d.maxScanMB * 1048576;
            const tailBytes = await readRange(file, Math.max(0, size - 2048), size);
            if (d.checkStructure && latin1(tailBytes).indexOf('%%EOF') < 0) { add('CORRUPT_FILE', { kind: phrase('PDF'), reason: phrase('the end of the file is missing (it may be cut off)') }); return; }
            const body = size <= cap ? await readRange(file, 0, size) : null;
            const text = unhash(body ? latin1(body) : latin1(await readRange(file, 0, cap / 2)) + latin1(await readRange(file, size - cap / 2, size)));
            if (d.blockPdfJavaScript && /\/(JavaScript|JS)\b/.test(text)) dangerous(phrase('JavaScript in a PDF'));
            else if (d.blockPdfLaunch && /\/Launch\b/.test(text)) dangerous(phrase('a launch action in a PDF'));
            else if (d.blockEmbeddedPrograms && /\/EmbeddedFile\b/.test(text) && /\/(F|UF)\s*\(([^)]*\.(exe|dll|bat|cmd|vbs|js|jar|scr|msi|ps1|com|hta))\)/i.test(text)) dangerous(phrase('an embedded program in a PDF'));
            return;
        }
        if (sig.name === 'ole' && d.blockMacros && OLE_DOC_EXTS.includes(ext) && !(explicitlyAllowed && MACRO_EXTS.includes(ext))) {
            const cap = d.maxScanMB * 1048576;
            const bytes = await readRange(file, 0, Math.min(file.size, cap));
            if (indexOfUtf16(bytes, '_VBA_PROJECT') >= 0 || indexOfUtf16(bytes, 'VBA') >= 0 && indexOfUtf16(bytes, 'dir') >= 0 && indexOfUtf16(bytes, 'Macros') >= 0) dangerous(phrase('macros'));
        }
    }

    /** Returns the matching signature entry, `null` (readable, no match) or `undefined` (unreadable). */
    async function detectSignature(file) {
        const head = await readHead(file, 300);
        if (!head) return undefined;
        return SIGNATURES.find(s => s.test(head)) || null;
    }

    // ---------------------------------------------------------------- polyglots: a program, a script or an archive hidden inside a picture
    // A file can be a valid PNG / JPEG / GIF *and* a PHP script, an HTML page, a ZIP or an EXE. The signature check sees only the first bytes, so these are looked for in the
    // head and tail of the file (where metadata and appended payloads live). The patterns are long enough (5+ bytes of text, structured headers) not to fire on image data.
    const POLY_TEXT = ['<?php', '<script', '<html', '<!doctype html', '<%@ page', '#!/bin/', '#!/usr/bin/'];
    const lowerAscii = c => (c >= 65 && c <= 90 ? c + 32 : c);
    function indexOfText(b, text, from) {
        const n = text.length, end = b.length - n;
        const first = text.charCodeAt(0);
        for (let i = from || 0; i <= end; i++) {
            if (lowerAscii(b[i]) !== first) continue;
            let k = 1;
            while (k < n && lowerAscii(b[i + k]) === text.charCodeAt(k)) k++;
            if (k === n) return i;
        }
        return -1;
    }
    function indexOfBytes(b, pat, from) {
        const end = b.length - pat.length;
        for (let i = from || 0; i <= end; i++) {
            if (b[i] !== pat[0]) continue;
            let k = 1;
            while (k < pat.length && b[i + k] === pat[k]) k++;
            if (k === pat.length) return i;
        }
        return -1;
    }
    const DOS_STUB = Array.from('This program cannot be run in DOS mode').map(c => c.charCodeAt(0));
    /** What is hidden in these bytes: 'scripts', 'embedded programs', 'hidden extra data' or null. `pos0` is the offset of buffer[0] in the file. */
    function findHidden(b, pos0, fileSize, sigName, textToo) {
        if (textToo) for (const t of POLY_TEXT) if (indexOfText(b, t) >= 0) return 'scripts';
        if (indexOfBytes(b, DOS_STUB) >= 0) return 'embedded programs';
        for (let i = indexOfBytes(b, [0x7f, 0x45, 0x4c, 0x46]); i >= 0; i = indexOfBytes(b, [0x7f, 0x45, 0x4c, 0x46], i + 1)) {
            if ((pos0 + i > 0) && (b[i + 4] === 1 || b[i + 4] === 2) && (b[i + 5] === 1 || b[i + 5] === 2) && b[i + 6] === 1) return 'embedded programs';
        }
        if (sigName !== 'pdf') for (let i = indexOfBytes(b, [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]); i >= 0; i = indexOfBytes(b, [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e], i + 1)) { if (pos0 + i > 0) return 'hidden extra data'; }
        // a ZIP / JAR appended to the file: an end-of-central-directory record whose comment ends exactly at the end of the file and whose directory fits inside it
        for (let i = indexOfBytes(b, [0x50, 0x4b, 0x05, 0x06]); i >= 0; i = indexOfBytes(b, [0x50, 0x4b, 0x05, 0x06], i + 1)) {
            if (i + 22 > b.length) continue;
            const comment = b[i + 20] | (b[i + 21] << 8);
            const entries = b[i + 10] | (b[i + 11] << 8);
            const cdSize = (b[i + 12] | (b[i + 13] << 8) | (b[i + 14] << 16) | (b[i + 15] << 24)) >>> 0;
            const cdOff = (b[i + 16] | (b[i + 17] << 8) | (b[i + 18] << 16) | (b[i + 19] << 24)) >>> 0;
            if (pos0 + i + 22 + comment === fileSize && entries > 0 && cdOff + cdSize <= pos0 + i) return 'hidden extra data';
        }
        return null;
    }
    /** GIF whose width is two printable ASCII characters (8224 px or more): a script that is also a GIF, such as "GIF89a" followed by a JavaScript comment. */
    function gifIsScript(head) {
        if (!(ascii(head, 0, 'GIF87a') || ascii(head, 0, 'GIF89a')) || head.length < 10) return false;
        const printable = c => c >= 0x20 && c <= 0x7e;
        return printable(head[6]) && printable(head[7]);
    }

    // ---------------------------------------------------------------- file names for storage
    const RESERVED_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9]|conin\$|conout\$)$/i;
    // control characters, bidirectional overrides (the "photo-gpj.exe" trick), zero-width characters, line separators, byte order mark
    const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g;
    /**
     * A file name that is safe to store and to show: no path, no control or bidi characters, no characters that file systems or shells treat specially, no reserved
     * Windows names, no trailing dots or spaces, a bounded length with the extension kept, and (default) only the LAST dot left, so `invoice.php.jpg` cannot be
     * handled as PHP by a server that reads the first extension. Idempotent: safeName(safeName(x)) === safeName(x).
     * options: replacement ('_'), maxLength (100, counts characters), lowercase (false), ascii (false: strip accents and turn other characters into the replacement),
     * dots ('replace' (default) | 'keep'), fallback ('file' for a name that ends up empty), extensionMaxLength (16).
     */
    function safeName(name, options) {
        const o = options || {};
        const rep = typeof o.replacement === 'string' && !/[\\/:*?"<>|\u0000-\u001f.\s]/.test(o.replacement) ? o.replacement : '_';
        const max = isNum(o.maxLength) && o.maxLength >= 8 ? Math.floor(o.maxLength) : 100;
        const extMax = isNum(o.extensionMaxLength) && o.extensionMaxLength >= 2 ? Math.floor(o.extensionMaxLength) : 16;
        let s = String(name === null || name === undefined ? '' : name);
        try { s = s.normalize('NFC'); } catch (e) { /* very old engines */ }
        s = s.slice(Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')) + 1);          // no path
        s = s.replace(INVISIBLE, '');
        if (o.ascii) {
            try { s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* */ }
            s = s.replace(/[^\x20-\x7e]/g, rep);
        }
        s = s.replace(/[<>:"|?*\u0000-\u001f\\\/]/g, rep).replace(/\s+/g, ' ').trim();
        s = s.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');                         // no leading or trailing dots and spaces
        let base = s, ext = '';
        const dot = s.lastIndexOf('.');
        if (dot > 0 && dot < s.length - 1) { base = s.slice(0, dot); ext = s.slice(dot + 1); }
        if (ext.length > extMax || /\s/.test(ext)) { base = s; ext = ''; }          // "no.extension at all, just words" is not an extension
        if (o.dots !== 'keep') base = base.replace(/\./g, rep);
        base = base.replace(/^[.\s]+|[.\s]+$/g, '');
        if (!base) base = typeof o.fallback === 'string' && o.fallback ? o.fallback : 'file';
        if (RESERVED_NAMES.test(base)) base = rep + base;
        const room = max - (ext ? ext.length + 1 : 0);
        if (Array.from(base).length > room) base = Array.from(base).slice(0, Math.max(1, room)).join('').replace(/[.\s]+$/g, '') || 'file';
        let out = ext ? base + '.' + ext : base;
        if (o.lowercase) out = out.toLowerCase();
        return out;
    }
    /** What the content says the file is: { type, mime, extensions, executable } or null when no known signature matches (undefined: unreadable). Never trust file.type or the name. */
    async function detect(file) {
        const s = await detectSignature(file);
        if (s === undefined || s === null) return s;
        return { type: s.name, mime: s.mime || null, extensions: (s.exts || []).slice(), executable: !!s.executable };
    }

    // ------------------------------------------------------------------ image inspection
    async function readImageSize(file, timeoutMs) {
        if (typeof root.document === 'undefined' && typeof root.createImageBitmap !== 'function') return null; // no DOM (Node)
        const isSvg = (file.type === 'image/svg+xml') || getExt(file.name) === '.svg';
        if (!isSvg && typeof root.createImageBitmap === 'function') {
            try {
                const bmp = await root.createImageBitmap(file);
                const size = { width: bmp.width, height: bmp.height };
                if (bmp.close) bmp.close();
                return size;
            } catch (e) { /* fall back to <img> for a definitive answer */ }
        }
        // no <img> or no object URLs (some test environments): the image cannot be measured here, so the size checks are skipped
        if (typeof root.Image === 'undefined' || !root.URL || !isFn(root.URL.createObjectURL)) return null;
        return new Promise((resolve, reject) => {
            const url = root.URL.createObjectURL(file);
            const img = new root.Image();
            const timer = setTimeout(() => done(new Error('timeout')), timeoutMs);
            function done(err, size) {
                clearTimeout(timer);
                if (isFn(root.URL.revokeObjectURL)) root.URL.revokeObjectURL(url);
                img.onload = img.onerror = null;
                err ? reject(err) : resolve(size);
            }
            img.onload = () => done(null, { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
            img.onerror = () => done(new Error('decode'));
            img.src = url;
        });
    }

    function parseRatio(r) {
        if (isNum(r)) return r;
        const m = /^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/.exec(String(r));
        return m ? m[1] / m[2] : NaN;
    }

    // ------------------------------------------------------------------ custom methods, hashing, server checks, media
    const registry = {};   // FileValidator.addMethod

    /** addMethod('maxLines', async function (file, param, ctx) { return (await file.text()).split('\n').length <= param; }, 'At most {0} lines')
     *  then use it:  { methods: { maxLines: 100 } }.  Return true | false | 'message' | { valid, message, code } | Promise. */
    function addMethod(name, fn, message) {
        if (!isFn(fn)) throw new Error('FileValidator.addMethod: the method must be a function');
        registry[name] = { fn, message };
    }

    function methodMessage(c, file) {
        let m = c.message;
        if (isFn(m)) return m(c.param, file);
        if (!m) return '';
        const ps = [].concat(c.param);
        return fill(String(m).replace(/\{(\d+)\}/g, (x, i) => (ps[i] !== undefined ? ps[i] : x)), { method: c.name, param: c.param });
    }

    async function runCustomChecks(file, cfg, add, ctx) {
        const checks = [];
        if (cfg.methods) {
            Object.keys(cfg.methods).forEach(n => {
                if (cfg.methods[n] === false) return;
                if (!registry[n]) { warnOnce('method:' + n, 'unknown method "' + n + '" (register it with FileValidator.addMethod)'); return; }
                checks.push({ name: n, fn: registry[n].fn, param: cfg.methods[n], message: registry[n].message });
            });
        }
        if (isFn(cfg.custom)) checks.push({ name: cfg.custom.name || 'custom', fn: cfg.custom, inline: true });
        else if (Array.isArray(cfg.custom)) cfg.custom.forEach((fn, i) => { if (isFn(fn)) checks.push({ name: fn.name || 'custom' + (i + 1), fn, inline: true }); });
        else if (cfg.custom && typeof cfg.custom === 'object') Object.keys(cfg.custom).forEach(n => { if (isFn(cfg.custom[n])) checks.push({ name: n, fn: cfg.custom[n], inline: true }); });

        for (const c of checks) {
            let res;
            const context = Object.assign({ config: cfg }, ctx);
            try {
                res = c.inline ? c.fn.call(null, file, context) : c.fn.call({ format: (src, ...ps) => src.replace(/\{(\d+)\}/g, (_, i) => ps[i]) }, file, c.param, context);
                if (res && isFn(res.then)) res = await res;
            } catch (e) { if (root.console) console.error(e); res = false; }
            if (res === true || res === 'dependency-mismatch') continue;
            const params = { method: c.name, param: c.param };
            if (res && typeof res === 'object') { if (!res.valid) add(res.code || 'CUSTOM', params, res.message || methodMessage(c, file)); }
            else if (typeof res === 'string' && res) add('CUSTOM', params, res);
            else add('CUSTOM', params, methodMessage(c, file));
        }
    }

    const hashCache = new WeakMap();

    /**
     * An incremental SHA-256: h = sha256Stream(); h.update(bytes) ...; h.digest() -> hex.
     * Self-contained on purpose: its source is also sent to a Web Worker.
     */
    function sha256Stream() {
        const K = new Uint32Array([
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
        const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
        const w = new Uint32Array(64), buf = new Uint8Array(64);
        let bufLen = 0, total = 0;
        const rotr = (x, n) => (x >>> n) | (x << (32 - n));
        function block(b, o) {
            for (let i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
            }
            let a = h[0], b1 = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
            for (let i = 0; i < 64; i++) {
                const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
                const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b1) ^ (a & c) ^ (b1 & c))) | 0;
                hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b1; b1 = a; a = (t1 + t2) | 0;
            }
            h[0] = (h[0] + a) | 0; h[1] = (h[1] + b1) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
        }
        return {
            update(bytes) {
                total += bytes.length;
                let i = 0;
                if (bufLen) { while (bufLen < 64 && i < bytes.length) buf[bufLen++] = bytes[i++]; if (bufLen === 64) { block(buf, 0); bufLen = 0; } }
                for (; i + 64 <= bytes.length; i += 64) block(bytes, i);
                while (i < bytes.length) buf[bufLen++] = bytes[i++];
            },
            digest() {
                const bits = total * 8;
                buf[bufLen++] = 0x80;
                if (bufLen > 56) { while (bufLen < 64) buf[bufLen++] = 0; block(buf, 0); bufLen = 0; }
                while (bufLen < 56) buf[bufLen++] = 0;
                const hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
                for (let k = 0; k < 4; k++) { buf[56 + k] = (hi >>> (24 - 8 * k)) & 255; buf[60 + k] = (lo >>> (24 - 8 * k)) & 255; }
                block(buf, 0);
                let hex = '';
                for (let k = 0; k < 8; k++) hex += ('00000000' + (h[k] >>> 0).toString(16)).slice(-8);
                return hex;
            }
        };
    }

    const SLICE = 4 * 1048576;
    /** Hashes a file in 4 MB slices: constant memory. A Web Worker does it when possible, so the page stays responsive. */
    async function hashStreaming(file) {
        if (root.Worker && root.Blob && root.URL && isFn(root.URL.createObjectURL)) {
            try {
                const src = 'const sha256Stream = ' + sha256Stream.toString() + ';\n' +
                    'onmessage = async e => { try { const f = e.data, h = sha256Stream(); for (let o = 0; o < f.size; o += ' + SLICE + ') h.update(new Uint8Array(await f.slice(o, o + ' + SLICE + ').arrayBuffer())); postMessage({ hex: h.digest() }); } catch (err) { postMessage({ error: String(err) }); } };';
                const url = root.URL.createObjectURL(new root.Blob([src], { type: 'text/javascript' }));
                try {
                    const worker = new root.Worker(url);
                    const out = await new Promise((resolve, reject) => {
                        worker.onmessage = e => (e.data && e.data.hex ? resolve(e.data.hex) : reject(new Error((e.data && e.data.error) || 'worker failed')));
                        worker.onerror = e => reject(new Error(e && e.message || 'worker error'));
                        worker.postMessage(file);
                    });
                    worker.terminate();
                    return out;
                } finally { if (isFn(root.URL.revokeObjectURL)) root.URL.revokeObjectURL(url); }
            } catch (e) { /* no worker allowed here (CSP, old browser): hash on this thread */ }
        }
        const h = sha256Stream();
        for (let o = 0; o < file.size; o += SLICE) {
            h.update(new Uint8Array(await file.slice(o, o + SLICE).arrayBuffer()));
            if (o + SLICE < file.size) await new Promise(r => setTimeout(r, 0));   // let the page breathe between slices
        }
        return h.digest();
    }

    /**
     * SHA-256 (hex) of a file, or null when it is over `maxMB` (default 50) or hashing is not possible.
     * Files up to 32 MB use the browser's crypto.subtle; bigger ones are hashed as a stream, so memory stays small.
     */
    async function hashFile(file, maxMB) {
        if (!file || typeof file.slice !== 'function') return null;
        if (file.size > (isNum(maxMB) ? maxMB : 50) * 1048576) return null;
        if (hashCache.has(file)) return hashCache.get(file);
        let hex;
        if (file.size > 32 * 1048576) hex = await hashStreaming(file);
        else {
            const subtle = (root.crypto && root.crypto.subtle) || (typeof require === 'function' ? (function () { try { return require('crypto').webcrypto.subtle; } catch (e) { return null; } })() : null);
            if (subtle && typeof file.arrayBuffer === 'function') {
                const digest = await subtle.digest('SHA-256', await file.arrayBuffer());
                hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
            } else hex = await hashStreaming(file);   // no crypto.subtle (plain http): the streaming hash needs neither it nor a secure context
        }
        hashCache.set(file, hex);
        return hex;
    }

    /** Default HTTP method of `remote` checks (GET, like jQuery Validation). FileValidator.remoteDefaults.method = 'POST' changes it for all. */
    const remoteDefaults = { method: 'GET' };
    const withTimeout = (promise, ms) => new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('timeout')), ms); promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); }); });
    const remoteCache = new WeakMap();   // File -> Map(url -> result)
    /** remote: '/check'  or  { url, method: 'GET' (default) | 'POST', send: 'meta' | 'file' | 'hash', field: 'file', data, headers, timeout, cache, failOpen, credentials, parse }
     *  The server answers true | 'true' | { valid, message, code } | 'error message' | false */
    async function remoteCheck(file, rcfg, cfg) {
        const o = typeof rcfg === 'string' ? { url: rcfg } : rcfg;
        if (!o || !o.url) return { valid: true };
        const cached = remoteCache.get(file);
        if (o.cache !== false && cached && cached.has(o.url)) return cached.get(o.url);

        const send = o.send || 'meta';
        const meta = { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified };
        if (send === 'hash') { const h = await hashFile(file, o.maxHashMB || cfg.duplicateContentMaxMB); if (h) meta.hash = h; }
        const extra = isFn(o.data) ? o.data(file, meta) : (o.data || {});
        let method = String(o.method || remoteDefaults.method).toUpperCase();
        if (send === 'file' && method === 'GET') method = 'POST';
        const headers = Object.assign({}, o.headers);
        const init = { method, headers, credentials: o.credentials };
        let url = o.url;
        if (send === 'file' && typeof root.FormData !== 'undefined') {
            const fd = new root.FormData();
            fd.append(o.field || 'file', file, file.name);
            Object.entries(Object.assign({}, meta, extra)).forEach(([k, v]) => { if (v !== undefined) fd.append(k, v); });
            init.body = fd;
        } else {
            const payload = Object.assign({}, meta, extra);
            if (method === 'GET') url += (url.indexOf('?') > -1 ? '&' : '?') + new URLSearchParams(payload);
            else { init.body = JSON.stringify(payload); headers['Content-Type'] = 'application/json'; }
        }
        const ctrl = root.AbortController ? new root.AbortController() : null;
        if (ctrl) init.signal = ctrl.signal;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), o.timeout || 15000) : null;
        let result;
        try {
            const resp = await fetch(url, init);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            let out = await resp.json();
            if (isFn(o.parse)) out = o.parse(out, resp);
            if (out === true || out === 'true') result = { valid: true };
            else if (out && typeof out === 'object') result = out.valid ? { valid: true } : { valid: false, message: out.message, code: out.code };
            else if (typeof out === 'string' && out !== 'false') result = { valid: false, message: out };
            else result = { valid: false };
            if (o.cache !== false) { const m = cached || new Map(); m.set(o.url, result); remoteCache.set(file, m); }
        } catch (e) {
            result = o.failOpen ? { valid: true } : { valid: false, code: 'REMOTE_ERROR' };
        } finally { if (timer) clearTimeout(timer); }
        return result;
    }

    function formatDuration(sec) {
        sec = Math.round(sec);
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, pad2 = n => String(n).padStart(2, '0');
        return h ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
    }

    function readMediaInfoDefault(file, category, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (typeof root.document === 'undefined' || !root.URL || !root.URL.createObjectURL) return resolve(null);
            const el = root.document.createElement(category === 'video' ? 'video' : 'audio');
            const url = root.URL.createObjectURL(file);
            const timer = setTimeout(() => done(new Error('timeout')), timeoutMs);
            function done(err, info) { clearTimeout(timer); root.URL.revokeObjectURL(url); el.onloadedmetadata = el.onerror = null; el.removeAttribute('src'); err ? reject(err) : resolve(info); }
            el.preload = 'metadata';
            el.onloadedmetadata = () => done(null, { duration: el.duration, width: el.videoWidth, height: el.videoHeight });
            el.onerror = () => done(new Error('decode'));
            el.src = url;
        });
    }

    // ------------------------------------------------------------------ single file
    async function validateFile(file, config, groupCtx) {
        config = normalizeConfig(config);
        if (!file) return finish([{ code: 'NO_FILES', fileName: null, file: null, params: {}, message: '' }], config);
        const details = [];
        const add = (code, params, message) => details.push({ code, fileName: file.name, file, params: params || {}, message: message || '' });
        const name = String(file.name || '');
        const ext = getExt(name);

        // per-category overrides: config.categories = { image: { maxFileSizeMB: 5 }, video: {...} }
        let cfg = config;
        const preCat = getCategory(file);
        if (config.categories && config.categories[preCat]) cfg = Object.assign({}, config, config.categories[preCat]);

        // ---- what kinds of files are accepted at all (legacy validateTarget)
        const t = config.validateTarget;
        if (t && !t.allowMixed) {
            const okImage = t.images, okOther = preCat === 'video' ? (t.videos !== undefined ? t.videos : t.files)
                : preCat === 'audio' ? (t.audios !== undefined ? t.audios : t.files) : t.files;
            if (preCat === 'image' && !okImage) add('INVALID_FILE_TYPE');
            else if (preCat !== 'image' && !okOther) add('INVALID_IMAGE_TYPE');
        }

        // ---- filename
        const hugeName = name.length > 4096;   // no pattern checks on absurd names: the length is the finding
        if (!name || (!hugeName && (CONTROL.test(name) || BIDI.test(name) || /[\\/]/.test(name) || /[. ]$/.test(name)))) add('INVALID_FILENAME');
        if (name.length > (cfg.maxFilenameLength || 255)) add('FILENAME_TOO_LONG', { max: cfg.maxFilenameLength || 255 });
        if (!hugeName && on(cfg, 'filenamePattern', cfg.filenameRegex instanceof RegExp) && !isValidFilename(name, cfg) &&
            !details.some(d => d.code === 'INVALID_FILENAME')) add('INVALID_FILENAME');

        // ---- folder path (files picked from a folder or dropped as a folder)
        const path = getPath(file);
        if (path) {
            const segs = path.split('/');
            if (path.charAt(0) === '/' || /\\/.test(path) || segs.some(sg => sg === '' || sg === '.' || sg === '..' || CONTROL.test(sg) || BIDI.test(sg) || /[. ]$/.test(sg))) add('INVALID_PATH');
            else {
                if (isNum(cfg.maxPathDepth) && segs.length - 1 > cfg.maxPathDepth) add('PATH_TOO_DEEP', { depth: segs.length - 1, max: cfg.maxPathDepth });
                if (isNum(cfg.maxPathLength) && path.length > cfg.maxPathLength) add('PATH_TOO_LONG', { max: cfg.maxPathLength });
            }
        }

        // signature sniffing is lazy: the MIME check may need it for files whose type the browser did not report
        let sig, sigLoaded = false;
        const getSig = async () => { if (!sigLoaded) { sig = file.size > 0 ? await detectSignature(file) : undefined; sigLoaded = true; } return sig; };
        const declaredMime = String(file.type || '').toLowerCase();

        // ---- dangerous names
        const dangerous = (cfg.dangerousExtensions || DEFAULT_DANGEROUS_EXTENSIONS).map(normExt);
        const explicitlyAllowed = nonEmptyArr(cfg.allowedExtensions) && cfg.allowedExtensions.map(normExt).includes(ext);
        if (cfg.validate?.dangerousExt !== false) {
            if (!hugeName && hasSuspiciousExtension(name, dangerous)) add('HIDDEN_EXTENSION');
            if (ext && dangerous.includes(ext) && !explicitlyAllowed) add('DANGEROUS_FILE_TYPE', { extension: ext });
            // ... and dangerous MIME types, even under a harmless name (photo.jpg reported as application/x-msdownload)
            const dangerMimes = (cfg.dangerousMimeTypes || DEFAULT_DANGEROUS_MIME_TYPES).map(m => String(m).toLowerCase());
            const mimeAllowed = nonEmptyArr(cfg.allowedMimeTypes) && cfg.allowedMimeTypes.some(m => String(m).toLowerCase() === declaredMime);
            if (declaredMime && dangerMimes.includes(declaredMime) && !explicitlyAllowed && !mimeAllowed && !details.some(d => d.code === 'DANGEROUS_FILE_TYPE')) {
                add('DANGEROUS_FILE_TYPE', { extension: ext || declaredMime, mime: declaredMime });
            }
        }

        // ---- allow lists
        if (on(cfg, 'extension', nonEmptyArr(cfg.allowedExtensions))) {
            if (!nonEmptyArr(cfg.allowedExtensions) || !cfg.allowedExtensions.map(normExt).includes(ext)) {
                add('INVALID_EXTENSION', { extension: ext, allowed: (cfg.allowedExtensions || []).join(', ') });
            }
        }
        // MIME type: with `allowedMimeTypes` the file's type must be in that list; with only `allowedExtensions` the list is taken from the
        // built-in registry (or `mimeByExtension`): the reported type must fit the extension, and an extension nobody knows is reported.
        const extList = nonEmptyArr(cfg.allowedExtensions), mimeList = nonEmptyArr(cfg.allowedMimeTypes);
        if (cfg.validate?.mimeType !== false && (mimeList || extList)) {
            const known = mimesForExt(ext, cfg);
            const generic = GENERIC_MIMES.includes(declaredMime);
            let mime = generic ? (known[0] || '') : declaredMime;
            if (!mime && mimeList) { const s2 = await getSig(); if (s2 && s2.mime) mime = s2.mime; }
            if (mimeList) {
                const ok = cfg.allowedMimeTypes.some(a => {
                    a = String(a).toLowerCase();
                    return a === mime || (a.endsWith('/*') && mime.startsWith(a.slice(0, -1)));
                });
                if (!ok && !(cfg.allowUnknownMime && !mime)) add('INVALID_MIME', { mime: mime || '(unknown)' });
            } else if (!details.some(d => d.code === 'INVALID_EXTENSION')) {
                if (!known.length) { if (!cfg.allowUnknownMime) add('UNKNOWN_MIME', { extension: ext || '(none)' }); }
                else if (!generic && !known.includes(declaredMime)) add('MIME_MISMATCH', { mime: declaredMime, extension: ext });
            }
        }

        // ---- size
        const maxBytes = isNum(cfg.maxFileSizeMB) ? cfg.maxFileSizeMB * 1048576 : (isNum(cfg.maxFileSize) ? cfg.maxFileSize : null);
        const minBytes = isNum(cfg.minFileSizeKB) ? cfg.minFileSizeKB * 1024 : (isNum(cfg.minFileSize) ? cfg.minFileSize : null);
        if (maxBytes !== null && on(cfg, 'maxFileSize', true) && file.size > maxBytes) {
            add('SIZE_TOO_LARGE', { max: formatBytes(maxBytes), size: formatBytes(file.size) });
        }
        if (minBytes !== null && on(cfg, 'minFileSize', true) && file.size < minBytes) {
            add('SIZE_TOO_SMALL', { min: formatBytes(minBytes), size: formatBytes(file.size) });
        }
        if (file.size === 0 && !cfg.allowEmpty && cfg.validate?.empty !== false && !details.some(d => d.code === 'SIZE_TOO_SMALL')) {
            add('EMPTY_FILE');
        }

        if (details.length) return finish(details, cfg);

        // ---- content signature (magic bytes)
        if (cfg.validate?.signature !== false && file.size > 0) {
            await getSig();
            if (sig && sig.executable) {
                if (!cfg.allowExecutables) add('DANGEROUS_CONTENT', { detected: sig.name });
            } else if (sig !== undefined && ext) {
                if (sig === null ? SIGNATURE_EXTS.has(ext) : (!sig.exts.includes(ext) && (!sig.weak || SIGNATURE_EXTS.has(ext)))) {
                    add('SIGNATURE_MISMATCH', { extension: ext, detected: sig ? sig.name : 'unknown' });
                }
            }
            if (details.length) return finish(details, cfg);
        }

        // ---- inside PDF, Office and ZIP files
        if (sig && !sig.executable && cfg.documents !== false && cfg.validate?.documents !== false && file.size > 0) {
            await inspectDocument(file, ext, sig, cfg, add, explicitlyAllowed);
            if (details.length) return finish(details, cfg);
        }

        // ---- a script, program or archive hidden inside a picture (polyglot)
        if (sig && !sig.executable && file.size > 0 && cfg.polyglot !== false && cfg.validate?.polyglot !== false &&
            (sig.mime && sig.mime.indexOf('image/') === 0 || (cfg.polyglot === 'all' && !['zip', 'ole', 'rtf', 'postscript', 'sqlite', 'tar', 'gzip', 'xz', 'zstd', 'bzip2', '7z', 'rar', 'cab', 'shebang'].includes(sig.name)))) {
            const win = Math.max(4, isNum(cfg.polyglotScanKB) ? cfg.polyglotScanKB : 256) * 1024;
            let hidden = null;
            try {
                const head = await readRange(file, 0, Math.min(file.size, win));
                if (sig.name === 'gif' && gifIsScript(head)) hidden = 'scripts';
                if (!hidden) hidden = findHidden(head, 0, file.size, sig.name, true);
                if (!hidden && file.size > win) { const from = Math.max(win, file.size - win); hidden = findHidden(await readRange(file, from, file.size), from, file.size, sig.name, true); }
            } catch (e) { /* unreadable: the other checks decide */ }
            if (hidden) { add('DANGEROUS_CONTENT', { detected: phrase(hidden) }); return finish(details, cfg); }
        }

        // ---- SVG can carry scripts
        if (ext === '.svg' && cfg.scanSvg !== false && file.size > 0 && file.size <= 5 * 1048576 && typeof file.text === 'function') {
            const txt = await file.text();
            if (svgIsUnsafe(txt)) {
                add('DANGEROUS_CONTENT', { detected: phrase('scripts') });
                return finish(details, cfg);
            }
        }

        // ---- image decoding + dimensions
        const category = getCategory(file, sig && sig.mime);
        if (category === 'image' && cfg.validate?.imageDecode !== false) {
            let size;
            const tolerant = ['.heic', '.heif', '.tif', '.tiff', '.avif', '.ico', '.cur'].includes(ext); // browsers often can't decode these
            try { size = await (isFn(cfg.readImageSize) ? cfg.readImageSize(file) : readImageSize(file, cfg.imageTimeoutMs || 10000)); }
            catch (e) { if (!tolerant) { add('INVALID_IMAGE'); return finish(details, cfg); } size = null; }

            if (size && size.width > 0 && size.height > 0) { // SVG without intrinsic size reports 0 — skip
                const { width: w, height: h } = size;
                if (isNum(cfg.maxImageWidth) && on(cfg, 'imageWidth', true) && w > cfg.maxImageWidth) add('WIDTH_EXCEEDED', { max: cfg.maxImageWidth, width: w });
                if (isNum(cfg.maxImageHeight) && on(cfg, 'imageHeight', true) && h > cfg.maxImageHeight) add('HEIGHT_EXCEEDED', { max: cfg.maxImageHeight, height: h });
                if (isNum(cfg.minImageWidth) && w < cfg.minImageWidth) add('WIDTH_TOO_SMALL', { min: cfg.minImageWidth, width: w });
                if (isNum(cfg.minImageHeight) && h < cfg.minImageHeight) add('HEIGHT_TOO_SMALL', { min: cfg.minImageHeight, height: h });
                if (cfg.aspectRatio && on(cfg, 'aspectRatio', true)) {
                    const a = w / h, r = cfg.aspectRatio;
                    let ok;
                    if (typeof r === 'object' && ('min' in r || 'max' in r)) ok = a >= (r.min || 0) && a <= (r.max === undefined ? Infinity : r.max);
                    else { const target = parseRatio(r), tol = isNum(cfg.aspectRatioTolerance) ? cfg.aspectRatioTolerance : 0.01; ok = Math.abs(a - target) <= tol; }
                    if (!ok) add('INVALID_ASPECT_RATIO', { ratio: +a.toFixed(3) });
                }
            }
        }

        // ---- audio / video duration
        if ((category === 'audio' || category === 'video') && (isNum(cfg.maxDurationSec) || isNum(cfg.minDurationSec))) {
            let info = null;
            try { info = await (isFn(cfg.readMediaInfo) ? cfg.readMediaInfo(file) : readMediaInfoDefault(file, category, cfg.imageTimeoutMs || 10000)); }
            catch (e) { if (cfg.requireMediaInfo) add('INVALID_MEDIA'); }
            if (info && isFinite(info.duration)) {
                if (isNum(cfg.maxDurationSec) && info.duration > cfg.maxDurationSec) add('DURATION_TOO_LONG', { max: formatDuration(cfg.maxDurationSec), duration: formatDuration(info.duration) });
                if (isNum(cfg.minDurationSec) && info.duration < cfg.minDurationSec) add('DURATION_TOO_SHORT', { min: formatDuration(cfg.minDurationSec), duration: formatDuration(info.duration) });
            }
        }

        // ---- your own checks, then the server: only for files that passed everything else
        if (!details.length) await runCustomChecks(file, cfg, add, { ext, category, files: groupCtx && groupCtx.files, index: groupCtx && groupCtx.index });
        if (!details.length && isFn(cfg.scan)) {
            let res;
            try {
                res = await withTimeout(Promise.resolve(cfg.scan(file, Object.assign({ config: cfg }, { ext, category, files: groupCtx && groupCtx.files, index: groupCtx && groupCtx.index }))), cfg.scanTimeout || 30000);
            } catch (e) { res = cfg.scanFailOpen === true ? true : { valid: false, code: 'SCAN_ERROR' }; }
            if (res !== true) {
                if (res && typeof res === 'object') { if (!res.valid) add(res.code || 'MALWARE_DETECTED', { threat: res.threat || 'malware' }, res.message); }
                else if (typeof res === 'string' && res) add('MALWARE_DETECTED', { threat: res }, undefined);
                else add('MALWARE_DETECTED', { threat: 'malware' });
            }
        }
        if (!details.length && cfg.remote) {
            const r = await remoteCheck(file, cfg.remote, cfg);
            if (!r.valid) add(r.code || 'REMOTE_REJECTED', {}, r.message);
        }

        return finish(details, cfg);
    }

    function finish(details, config) {
        details.forEach(d => { if (!d.message) d.message = getMessage(d.code, d.params, config); });
        return { isValid: details.length === 0, errors: [...new Set(details.map(d => d.code))], details };
    }

    // ------------------------------------------------------------------ scope / group rules
    function enforceScope(files, config) {
        const scope = config.validateScope;
        if (!scope || scope === 'mixed') return [];
        const count = files.length;
        const allImages = files.every(f => getCategory(f) === 'image');
        const allFiles = files.every(f => getCategory(f) !== 'image');
        const errors = [];

        const limit = (isNum(config.imageLimit) && allImages) ? config.imageLimit
            : (isNum(config.fileLimit) && allFiles) ? config.fileLimit : null;
        const err = (code, params) => errors.push({ code, params: params || {} });
        if (limit !== null && count > limit) err(limit === 1 ? 'SINGLE_FILE_LIMIT_EXCEEDED' : 'TOO_MANY_FILES', { max: limit });

        switch (scope) {
            case 'file': if (count > 1 && limit === null) err('SINGLE_FILE_LIMIT_EXCEEDED'); if (!allFiles) err('INVALID_FILE_TYPE'); break;
            case 'files': if (count < 2) err('TOO_FEW_FILES', { min: 2 }); if (!allFiles) err('INVALID_FILE_TYPE'); break;
            case 'image': if (count > 1 && limit === null) err('SINGLE_FILE_LIMIT_EXCEEDED'); if (!allImages) err('INVALID_IMAGE_TYPE'); break;
            case 'images': if (count < 2) err('TOO_FEW_FILES', { min: 2 }); if (!allImages) err('INVALID_IMAGE_TYPE'); break;
        }
        return errors;
    }

    function detectDuplicates(files) {
        const seen = new Set();
        for (const f of files) {
            const n = String(f.name).toLowerCase();
            if (seen.has(n)) return true;
            seen.add(n);
        }
        return false;
    }

    // ------------------------------------------------------------------ public: many files
    async function validateFiles(input, config) {
        config = normalizeConfig(config);
        const everything = toArray(input);
        const ignored = everything.filter(f => isIgnored(f, config.ignoreFiles));
        const files = ignored.length ? everything.filter(f => !ignored.includes(f)) : everything;
        if (files.length === 0) {
            if (config.allowNoFiles) return { isValid: true, errors: [], details: [], files: [], ignored };
            const d = [{ code: 'NO_FILES', fileName: null, file: null, params: {}, message: getMessage('NO_FILES', {}, config) }];
            return { isValid: false, errors: ['NO_FILES'], details: d, files: [], ignored };
        }

        const groupDetails = [];
        const addGroup = (code, params, message) => groupDetails.push({ code, fileName: null, file: null, params: params || {}, message: message || getMessage(code, params, config) });

        enforceScope(files, config).forEach(e => addGroup(e.code, e.params));

        if (isNum(config.maxFiles) && on(config, 'maxFiles', true) && files.length > config.maxFiles && !groupDetails.some(d => d.code === 'TOO_MANY_FILES' || d.code === 'SINGLE_FILE_LIMIT_EXCEEDED')) {
            addGroup('TOO_MANY_FILES', { max: config.maxFiles });
        }
        if (isNum(config.minFiles) && files.length < config.minFiles && !groupDetails.some(d => d.code === 'TOO_FEW_FILES')) {
            addGroup('TOO_FEW_FILES', { min: config.minFiles });
        }
        if (isNum(config.maxTotalSizeMB)) {
            const total = files.reduce((s, f) => s + (f.size || 0), 0);
            if (total > config.maxTotalSizeMB * 1048576) addGroup('TOTAL_SIZE_EXCEEDED', { max: formatBytes(config.maxTotalSizeMB * 1048576), size: formatBytes(total) });
        }
        if (on(config, 'duplicateNames', false) && detectDuplicates(files)) addGroup('DUPLICATE_FILENAMES');
        if (config.duplicateContent && files.length > 1) {
            const hashes = await Promise.all(files.map(f => hashFile(f, config.duplicateContentMaxMB)));
            const byHash = {};
            files.forEach((f, i) => { if (hashes[i]) (byHash[hashes[i]] = byHash[hashes[i]] || []).push(f.name); });
            Object.keys(byHash).forEach(h => { if (byHash[h].length > 1) addGroup('DUPLICATE_FILES', { names: byHash[h].join(', ') }); });
        }
        if (isFn(config.customAll)) {
            let res;
            try { res = config.customAll(files, { config }); if (res && isFn(res.then)) res = await res; } catch (e) { if (root.console) console.error(e); res = false; }
            if (res !== true) {
                if (res && typeof res === 'object') { if (!res.valid) addGroup(res.code || 'CUSTOM', { method: 'customAll' }, res.message || getMessage('CUSTOM', { method: 'customAll' }, config)); }
                else addGroup('CUSTOM', { method: 'customAll' }, typeof res === 'string' && res ? res : getMessage('CUSTOM', { method: 'customAll' }, config));
            }
        }

        const perFile = await mapLimit(files, config.concurrency || 4, async (file, index) => {
            const r = await validateFile(file, config, { files, index });
            return { file, name: file.name, isValid: r.isValid, errors: r.errors, details: r.details };
        });

        const details = groupDetails.concat(...perFile.map(p => p.details));
        return {
            isValid: details.length === 0,
            errors: [...new Set(details.map(d => d.code))],
            details,
            files: perFile.map(p => ({ file: p.file, name: p.name, isValid: p.isValid, errors: p.errors, details: p.details })),
            ignored
        };
    }

    /** Human-readable lines for a result: ["photo.png: This file is 6 MB but the maximum is 5 MB.", ...] */
    function summary(result, opts) {
        const withName = !opts || opts.fileNames !== false;
        return ((result && result.details) || []).map(d => (withName && d.fileName ? d.fileName + ': ' : '') + d.message);
    }

    /**
     * Wire validation to an <input type="file">. Returns an unbind function.
     *   bind(input, config, {
     *       onResult(result, input),        // called after every selection
     *       messageElement: el | selector,  // gets the first message (or '' when valid)
     *       clearOnInvalid: true            // empties the input when the selection is rejected
     *   })
     * Also sets input.setCustomValidity() so native form validation reports the problem.
     */
    function bind(input, config, opts) {
        opts = opts || {};
        if (typeof input === 'string') input = root.document.querySelector(input);
        if (!input) throw new Error('FileValidator.bind: input not found');
        let seq = 0;
        const handler = async () => {
            const my = ++seq;
            const files = Array.from(input.files || []);
            let result = { isValid: true, errors: [], details: [], files: [] };
            if (files.length) result = await validateFiles(files, config);
            if (my !== seq) return; // a newer selection superseded this one
            const msg = result.isValid ? '' : summary(result)[0];
            if (input.setCustomValidity) input.setCustomValidity(msg);
            const el = typeof opts.messageElement === 'string' ? root.document.querySelector(opts.messageElement) : opts.messageElement;
            if (el) el.textContent = msg;
            if (!result.isValid && opts.clearOnInvalid) { try { input.value = ''; } catch (e) { /* read-only in some envs */ } }
            if (typeof opts.onResult === 'function') opts.onResult(result, input);
        };
        input.addEventListener('change', handler);
        return () => { input.removeEventListener('change', handler); if (input.setCustomValidity) input.setCustomValidity(''); };
    }

    /** true or false: are these files fine? Accepts a FileList, File[], a File, an <input type="file"> or a selector. (The detailed answer is validateFiles().) */
    async function isValid(files, config) {
        if (typeof files === 'string') files = root.document.querySelector(files);
        return (await validateFiles(files, config)).isValid;
    }

    /**
     * Check a file input when its form is submitted, for a direct submit and for AJAX alike (the file counterpart of FormValidator.init):
     *   const g = FileValidator.guard('#cv', { accept: '.pdf', maxFileSizeMB: 5 }, { messageElement: '#cv-msg' });                 // direct: a valid form posts, an invalid one is blocked
     *   FileValidator.guard('#cv', cfg, { onSubmit: (files, formData) => fetch('/upload', { method: 'POST', body: formData }) });   // AJAX: called only with valid files
     *   if (await g.validate()) { ... }                                                                                           // or ask yourself: true / false
     * opts: messageElement (el | selector, gets the first message), required (default: the input's required attribute), onSubmit(files, formData, event) (may return a Promise;
     * { errors: 'message' } or { message } from your server is shown), onResult(result, input).
     * Returns { validate(): Promise<boolean>, check(): Promise<result>, unbind() }. Also sets setCustomValidity() like bind().
     */
    function guard(input, config, opts) {
        opts = opts || {};
        if (typeof input === 'string') input = root.document.querySelector(input);
        if (!input) throw new Error('FileValidator.guard: input not found');
        const form = input.form;
        if (!form) throw new Error('FileValidator.guard: the input is not inside a <form>');
        let bypass = false, busy = false;
        const show = msg => {
            if (input.setCustomValidity) input.setCustomValidity(msg);
            const el = typeof opts.messageElement === 'string' ? root.document.querySelector(opts.messageElement) : opts.messageElement;
            if (el) el.textContent = msg;
        };
        const check = async () => {
            const files = Array.from(input.files || []);
            const needed = opts.required !== undefined ? !!opts.required : !!input.required;
            const result = files.length || needed ? await validateFiles(files, config) : { isValid: true, errors: [], details: [], files: [] };
            show(result.isValid ? '' : summary(result)[0]);
            if (typeof opts.onResult === 'function') opts.onResult(result, input);
            return result;
        };
        const handler = e => {
            if (bypass) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (busy) return;
            busy = true;
            check().then(result => {
                if (!result.isValid) { busy = false; return; }
                if (typeof opts.onSubmit === 'function') {   // AJAX: the files are fine, hand over
                    return Promise.resolve().then(() => opts.onSubmit(Array.from(input.files || []), new root.FormData(form), e)).then(out => {
                        const m = out && (out.message || (typeof out.errors === 'string' ? out.errors : null));
                        if (m) show(String(m));
                    }).catch(err => { if (root.console) console.error(err); }).then(() => { busy = false; });
                }
                busy = false;
                // direct submit: hand the form back on the next task (a requestSubmit() made while the browser is still delivering the submit event is ignored)
                setTimeout(() => {
                    bypass = true;
                    try { if (typeof form.requestSubmit === 'function') { try { form.requestSubmit(e.submitter || undefined); } catch (err) { form.requestSubmit(); } } else form.submit(); }
                    finally { bypass = false; }
                }, 0);
            }).catch(err => { busy = false; if (root.console) console.error(err); });
        };
        // a new selection is checked at once: this also clears a stale error, which would otherwise make the browser itself block the next submit
        const onChange = () => { check().catch(err => { if (root.console) console.error(err); }); };
        form.addEventListener('submit', handler, true);
        input.addEventListener('change', onChange);
        return {
            validate: async () => (await check()).isValid,
            check,
            unbind: () => { form.removeEventListener('submit', handler, true); input.removeEventListener('change', onChange); if (input.setCustomValidity) input.setCustomValidity(''); }
        };
    }

    return {
        version: '2.11.0',
        validateFiles,   // async (FileList | File[] | File | <input>, config)
        isValid,         // async (files | <input> | selector, config) -> true / false
        guard,           // (input, config, { onSubmit, messageElement }) : check the file input when its form is submitted, direct or AJAX
        validateFile,    // async (File, config)
        addExtension,    // ('.xyz', 'application/x-xyz' | [..]) : teach the built-in registry an extension
        getMimeTypes: (ext, cfg) => mimesForExt(normExt(ext), cfg).slice(),
        addMethod,       // (name, fn(file, param, ctx), message) : your own check, used as { methods: { name: param } }
        setDefaults: obj => Object.assign(globalDefaults, obj),
        defaults: globalDefaults,
        remoteDefaults,
        readMetadata,    // async (File) -> { format, exif, gps, xmp, iptc, comments, orientation, kinds } | null  (JPEG, PNG, WebP)
        stripMetadata,   // async (File, { keepOrientation, keepColorProfile }) -> File without EXIF / GPS / XMP / IPTC / comments (same File when nothing to remove)
        hashFile,        // async (File, maxMB) -> SHA-256 hex, or null when over maxMB (files above 32 MB are hashed as a stream)
        _sha256Stream: sha256Stream,
        formatDuration,
        errorMessages,
        getMessage,
        summary,
        bind,
        defaultMessages,
        detectSignature, // async (File) -> signature | null | undefined
        detect,          // async (File) -> { type, mime, extensions, executable } | null: what the content is, whatever the name or file.type says
        safeName,        // (name, options?) -> a file name that is safe to store: no path, bidi / control characters, reserved names, one dot
        getCategory,
        formatBytes,
        units,           // { B, KB, MB, GB }: the size labels (a language pack changes them)
        phrases,         // English message fragment -> translation (a language pack fills it)
        phrase,          // (text, values) -> the fragment in the current language
        phraseN,         // (key, count, values, englishForms) -> plural-aware fragment
        get locale() { return localeState.code; },   // the language code used for plural rules; FVLocales.use() sets it
        set locale(code) { localeState.code = String(code || 'en'); },
        constants: {
            DEFAULT_DANGEROUS_EXTENSIONS,
            DEFAULT_DANGEROUS_MIME_TYPES,
            EXTENSIONS: () => Object.keys(EXT_MIMES).reduce((o, k) => { o[k] = EXT_MIMES[k].slice(); return o; }, {}),
            SIGNATURES: SIGNATURES.map(s => ({ name: s.name, mime: s.mime, exts: s.exts, executable: !!s.executable }))
        },
        getPath,         // (File) -> 'folder/sub/a.jpg' for files picked from a folder, else ''
        isIgnored,       // (File, ignoreFiles) -> boolean
        _internals: { getFileExtension, getMimeCategory, isValidFilename, hasSuspiciousExtension, normalizeConfig }
    };
});

/* DEFAULTS_DOC — every option, all optional
 *
 * Extensions / MIME
 *   Built-in registry: FileValidator.getMimeTypes('.pdf'), FileValidator.addExtension('.xyz', 'application/x-xyz')
 *   allowedExtensions only  -> the type must fit the extension (MIME_MISMATCH); unknown extension -> UNKNOWN_MIME (unless one of the options below)
 *   mimeByExtension: { '.xyz': 'application/x-xyz' }    per-call types for extensions (overrides the registry)
 *   dangerousMimeTypes: [...]                             replaces the built-in list of program/script MIME types
 *   allowedExtensions: ['.jpg','png']            case-insensitive, dot optional. An explicit allow also overrides the dangerous list.
 *   allowedMimeTypes:  ['image/*','application/pdf']   wildcard supported; falls back to extension-derived MIME if the browser gave none
 *   allowUnknownMime:  false
 *   dangerousExtensions: [...]                   replaces the default block list
 *
 * Size / count
 *   maxFileSizeMB / maxFileSize(bytes), minFileSizeKB / minFileSize(bytes), maxTotalSizeMB
 *   maxFiles, minFiles, allowNoFiles, allowEmpty (zero-byte files)
 *
 * Folders
 *   maxPathDepth, maxPathLength       limits for files picked from a folder (webkitdirectory or a dropped folder)
 *   ignoreFiles: true | ['Thumbs.db', /^~\$/]     skip junk files (true = .DS_Store, Thumbs.db, desktop.ini, ~$lock files, ._ files); listed in result.ignored
 *   (paths with "..", absolute or backslash parts, control or right-to-left characters are always INVALID_PATH)
 *
 * Names
 *   maxFilenameLength (255), validate.filenamePattern + filenameRegex, duplicate check: validate.duplicateNames = true
 *   (control chars, bidi-override tricks, path separators, trailing dots and "invoice.exe.pdf" are always caught)
 *
 * Images
 *   maxImageWidth, maxImageHeight, minImageWidth, minImageHeight, imageTimeoutMs
 *   aspectRatio: { min, max } | 1.5 | '16:9'  (+ aspectRatioTolerance, default 0.01)
 *
 * Content
 *   Magic-byte check is on by default (validate.signature = false to disable); allowExecutables lets executable content through.
 *
 * Per-category overrides
 *   categories: { image: { maxFileSizeMB: 5 }, video: { maxFileSizeMB: 200 } }
 *
 * Messages
 *   messages: { SIZE_TOO_LARGE: 'Max size is {max}', ... }  (string with {placeholders} or function(params))
 *
 * Your own checks
 *   FileValidator.addMethod('maxLines', async function (file, param, ctx) { return (await file.text()).split('\n').length <= param; }, 'At most {0} lines');
 *   methods: { maxLines: 100 }              registered methods, with a parameter
 *   custom: (file, ctx) => true | false | 'message' | { valid, message, code } | Promise      (function, array, or { name: fn })
 *   customAll: (files, ctx) => same result types, for the whole selection
 *
 * Inside PDF / Office / ZIP files (on by default)
 *   documents: false                 switch off, or { blockMacros, blockEmbeddedPrograms, blockUnsafePaths, blockPdfJavaScript, blockPdfLaunch,
 *                                    checkStructure, maxScanMB, maxUncompressedMB, maxCompressionRatio, maxEntries } (all true / defaults shown in the docs)
 *   scan: async (file, ctx) => true | false | 'threat name' | { valid, threat, message, code }     plug in an antivirus / malware service
 *   scanTimeout (ms, default 30000), scanFailOpen (default false: a scan that fails or times out blocks the file, SCAN_ERROR)
 *
 * Server checks (only for files that passed everything else)
 *   remote: '/check'  or  { url, method: 'GET' (default) | 'POST', send: 'meta' | 'file' | 'hash', field: 'file', data, headers, timeout, cache, failOpen, credentials, parse }
 *   The server answers true | 'true' | { valid, message, code } | 'error message' | false
 *
 * Duplicates and media
 *   duplicateContent: true (+ duplicateContentMaxMB, default 50)     identical files in one selection (SHA-256)
 *   maxDurationSec, minDurationSec, readMediaInfo(file) -> { duration }, requireMediaInfo      audio / video length
 *
 * Global defaults
 *   FileValidator.setDefaults({ maxFileSizeMB: 10, messages: { ... } })
 *
 * Legacy (still supported)
 *   validate: { extension, mimeType, maxFileSize, ... }, validateTarget: { images, files, allowMixed },
 *   validateScope: 'file' | 'files' | 'image' | 'images' | 'mixed', imageLimit, fileLimit
 */

    };

    mods["fileValidator.widget"] = function (module, exports, require, define) {
/*!
 * FileValidator upload widget v1.4.0 — drag and drop, folders, paste, previews, resizing and a file list on top of FileValidator.
 *
 * Load order:  fileValidator.js (2.5+)  →  fileValidator.widget.js.  No other dependencies.
 *
 *   const zone = FileValidator.widget('#dropzone', { accept: 'image/*', maxFiles: 5, maxFileSizeMB: 5 }, {
 *       list: '#file-list',            // renders the accepted files (name, size, preview, remove button)
 *       messageElement: '#file-errors',// rejected files and why (a live region)
 *       statusElement: '#file-status', // polite live region: "2 files added. 3 selected." (for screen reader users)
 *       preview: true,                 // thumbnails for images
 *       resize: true,                  // shrink big images to the maxImageWidth/Height/maxFileSizeMB limits instead of rejecting them
 *       stripMetadata: true,           // remove EXIF / GPS / XMP / IPTC / comments from JPEG, PNG and WebP photos (orientation is kept)
 *       paste: true,                   // Ctrl+V of a screenshot
 *       folder: true,                  // accept dropped or picked folders, ignore .DS_Store / Thumbs.db
 *       onChange: (files, entries) => {}, onReject: rejected => {}
 *   });
 *   zone.files; zone.remove(entry); zone.clear(); await zone.validate(); zone.appendTo(formData, 'files');
 *
 * The widget accepts files one by one with the same checks as validateFiles (limits on the running total included) and reports each
 * rejected file with its reasons, so a mixed drop is not thrown away as a whole. `validate()` runs the full selection check at the end
 * (minFiles, scopes, customAll...). Accepted files are also put into the <input type="file"> when the browser allows it (DataTransfer),
 * so a normal form submit and FormValidator's `file` rule keep working.
 *
 * Helpers: FileValidator.filesFromDrop(dataTransfer), filesFromClipboard(clipboardData), resizeImage(file, options), createPreview(file, options).
 *
 * Changelog
 *   1.4.0  `stripMetadata` option: photos are listed without EXIF, GPS, XMP, IPTC and comments (entries get `stripped`).
 *   1.3.0  Every sentence the widget writes (status line, "...and N more", remove button labels) goes through FileValidator.phrase(),
 *          so a language pack can translate it; plural forms follow the language.
 *   1.2.0  File names, messages and status text get dir="auto" (right-to-left languages); `moreText(n)` option for the "...and N more" line.
 *   1.1.1  Fix found in WebKit: dropping plain files no longer depends on the file-system entry API (which never answered for some drops).
 *          `dataTransfer.files` is used directly unless a folder is in the drop, and entry reads have a timeout.
 *   1.1.0  Accessibility: focus moves to the next remove button (or the input) after a file is removed; `statusElement` announces
 *          "2 files added. 3 selected." to screen readers.
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['fileValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, root.FileValidator || require('./fileValidator.js'));
    else factory(root, root.FileValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';

    if (!FV || !FV.validateFile || !FV.getPath) throw new Error('fileValidator.widget.js needs fileValidator.js v2.5 or newer to be loaded first');
    if (FV.widget && FV.widget.__fv) return FV;

    const isFn = f => typeof f === 'function';
    const isNum = v => typeof v === 'number' && isFinite(v);
    const doc = () => root.document;
    const closeInfo = info => { if (info && isFn(info.close)) { try { info.close(); } catch (e) { /* already closed */ } } };

    function setPath(file, path) {
        try { Object.defineProperty(file, 'webkitRelativePath', { value: path, configurable: true }); }
        catch (e) { file.fvPath = path; }
    }

    // ------------------------------------------------------------------ dropped folders and pasted files
    /**
     * Files of a drop event, including everything inside dropped folders (each file gets its relative path, like <input webkitdirectory>).
     * Call it synchronously inside the drop handler: the browser only lets you read the entries during the event.
     * options: { maxFiles = 10000, maxDepth = 32 }
     */
    async function filesFromDrop(dt, options) {
        options = options || {};
        const limit = isNum(options.maxFiles) ? options.maxFiles : 10000, maxDepth = isNum(options.maxDepth) ? options.maxDepth : 32;
        // Everything that must be read while the event is running comes first (the browser empties the DataTransfer afterwards).
        const direct = Array.from((dt && dt.files) || []);
        const items = dt && dt.items ? Array.from(dt.items).filter(i => i.kind === 'file') : [];
        const entries = items.map(i => { try { return isFn(i.webkitGetAsEntry) ? i.webkitGetAsEntry() : null; } catch (e) { return null; } });
        const hasFolder = entries.some(e => e && e.isDirectory);
        if (!hasFolder && direct.length) return direct;                    // plain files: no need for the entry API
        if (!entries.length || entries.every(e => !e)) return direct;

        const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
        const out = [];
        const walk = async (entry, dir, depth) => {
            if (!entry || out.length >= limit) return;
            if (entry.isFile) {
                let f = null;
                try { f = await withTimeout(new Promise((res, rej) => entry.file(res, rej)), 5000); }
                catch (e) { f = direct.find(d => d.name === entry.name) || null; }   // the entry did not answer: use the plain file if there is one
                if (!f) return;
                if (dir) setPath(f, dir + f.name);
                out.push(f);
            } else if (entry.isDirectory && depth < maxDepth) {
                const reader = entry.createReader();
                let batch;
                do { // readEntries returns at most ~100 entries per call
                    batch = await withTimeout(new Promise((res, rej) => reader.readEntries(res, rej)), 10000);
                    for (const child of batch) await walk(child, dir + entry.name + '/', depth + 1);
                } while (batch.length && out.length < limit);
            }
        };
        for (const e of entries) { try { await walk(e, '', 0); } catch (err) { /* an unreadable folder: keep what was read */ } }
        return out.length ? out : direct;
    }

    let mimeToExt = null;
    function extForMime(type) {
        if (!mimeToExt) {
            mimeToExt = {};
            const all = FV.constants.EXTENSIONS();
            Object.keys(all).forEach(ext => { const m = all[ext][0]; if (!mimeToExt[m]) mimeToExt[m] = ext.slice(1); });
        }
        return mimeToExt[String(type || '').toLowerCase()] || 'bin';
    }

    /** Files from a paste event. Screenshots and unnamed images get a name like pasted-2025-01-31T12-00-00.png */
    function filesFromClipboard(cd) {
        if (!cd) return [];
        let list = Array.from(cd.files || []);
        if (!list.length && cd.items) list = Array.from(cd.items).filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return list.map((f, i) => (f.name && !/^image\.\w+$/i.test(f.name)) ? f
            : new File([f], 'pasted-' + stamp + (list.length > 1 ? '-' + (i + 1) : '') + '.' + extForMime(f.type), { type: f.type, lastModified: Date.now() }));
    }

    // ------------------------------------------------------------------ images: read, resize, preview
    async function defaultReadImage(file) {
        if (typeof root.createImageBitmap === 'function') {
            const bmp = await root.createImageBitmap(file);
            return { width: bmp.width, height: bmp.height, source: bmp, close: () => bmp.close && bmp.close() };
        }
        if (!root.Image || !root.URL || !isFn(root.URL.createObjectURL)) return null;
        const url = root.URL.createObjectURL(file), img = new root.Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('decode')); img.src = url; });
        return { width: img.naturalWidth, height: img.naturalHeight, source: img, close: () => root.URL.revokeObjectURL(url) };
    }

    function defaultRender(source, w, h, type, quality) {
        const canvas = root.OffscreenCanvas ? new root.OffscreenCanvas(w, h) : Object.assign(doc().createElement('canvas'), { width: w, height: h });
        const ctx = canvas.getContext('2d');
        if (!ctx) return Promise.resolve(null);
        if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); } // transparent PNG -> white, not black
        ctx.drawImage(source, 0, 0, w, h);
        return canvas.convertToBlob ? canvas.convertToBlob({ type, quality }) : new Promise(res => canvas.toBlob(res, type, quality));
    }

    function renamed(name, outType, srcType) {
        if (outType === srcType) return name;
        const ext = extForMime(outType), i = name.lastIndexOf('.');
        return (i > 0 ? name.slice(0, i) : name) + '.' + ext;
    }

    /**
     * Shrink an image to fit limits. Returns a new File, or the same file when it already fits (or cannot be resized: SVG, GIF, unreadable).
     * options: { maxWidth, maxHeight, maxSizeMB, quality = 0.85, type, readImage, render }
     * The result has `file.fvResized = { from: {width,height,size}, to: {width,height,size} }`.
     * `readImage(file) -> { width, height, source, close? }` and `render(source, w, h, type, quality) -> Blob` can be replaced (tests, Node).
     */
    async function resizeImage(file, options) {
        const o = options || {};
        if (!file || FV.getCategory(file) !== 'image' || /svg|gif/i.test((file.type || '') + ' ' + (file.name || ''))) return file;
        const read = o.readImage || defaultReadImage, render = o.render || defaultRender;
        let info = null;
        try { info = await read(file); } catch (e) { return file; }
        if (!info || !(info.width > 0) || !(info.height > 0)) { closeInfo(info); return file; }

        const scale = Math.min(1, isNum(o.maxWidth) ? o.maxWidth / info.width : 1, isNum(o.maxHeight) ? o.maxHeight / info.height : 1);
        const maxBytes = isNum(o.maxSizeMB) ? o.maxSizeMB * 1048576 : null;
        if (scale >= 1 && !(maxBytes !== null && file.size > maxBytes)) { closeInfo(info); return file; }

        const src = String(file.type || '').toLowerCase();
        const outType = o.type || (src === 'image/png' ? 'image/png' : src === 'image/webp' ? 'image/webp' : 'image/jpeg');
        const q0 = isNum(o.quality) ? o.quality : 0.85;
        const qualities = outType === 'image/png' ? [1] : (maxBytes !== null ? [q0, 0.75, 0.65, 0.55, 0.45].filter(q => q <= q0) : [q0]);
        let w = Math.max(1, Math.round(info.width * scale)), h = Math.max(1, Math.round(info.height * scale)), blob = null;
        try {
            for (let round = 0; round < 8; round++) { // lower the quality first, then the size
                for (const q of qualities) { blob = await render(info.source, w, h, outType, q); if (!blob || maxBytes === null || blob.size <= maxBytes) break; }
                if (!blob || maxBytes === null || blob.size <= maxBytes) break;
                w = Math.max(1, Math.round(w * 0.85)); h = Math.max(1, Math.round(h * 0.85));
            }
        } finally { closeInfo(info); }
        if (!blob || (scale >= 1 && blob.size >= file.size)) return file; // never make a file bigger
        const out = new File([blob], renamed(file.name, outType, src), { type: outType, lastModified: file.lastModified });
        out.fvResized = { from: { width: info.width, height: info.height, size: file.size }, to: { width: w, height: h, size: blob.size } };
        return out;
    }

    /**
     * A preview for a file: { url, kind: 'image' | 'video' | 'audio' | 'file', width, height, label, revoke() }.
     * Images become thumbnails (options: maxWidth = 160, maxHeight = 160, type = 'image/jpeg', quality = 0.8, thumbnail = true).
     * With no DOM (Node) url is null.
     */
    async function createPreview(file, options) {
        const o = Object.assign({ maxWidth: 160, maxHeight: 160, type: 'image/jpeg', quality: 0.8, thumbnail: true }, options);
        const make = blobOrFile => (root.URL && isFn(root.URL.createObjectURL)) ? root.URL.createObjectURL(blobOrFile) : null;
        const revoker = url => () => { if (url && root.URL && isFn(root.URL.revokeObjectURL)) root.URL.revokeObjectURL(url); };
        const cat = FV.getCategory(file);
        if (cat === 'image') {
            const isSvg = /svg/i.test((file.type || '') + (file.name || ''));
            if (!o.thumbnail || isSvg) { const url = make(file); return { url, kind: 'image', revoke: revoker(url) }; }
            let info = null;
            try { info = await (o.readImage || defaultReadImage)(file); } catch (e) { info = null; }
            if (!info) { const url = make(file); return { url, kind: 'image', revoke: revoker(url) }; }
            const scale = Math.min(1, o.maxWidth / info.width, o.maxHeight / info.height);
            const w = Math.max(1, Math.round(info.width * scale)), h = Math.max(1, Math.round(info.height * scale));
            let blob = null;
            try { blob = await (o.render || defaultRender)(info.source, w, h, o.type, o.quality); } catch (e) { blob = null; }
            closeInfo(info);
            const url = make(blob || file);
            return { url, kind: 'image', width: info.width, height: info.height, revoke: revoker(url) };
        }
        if (cat === 'video' || cat === 'audio') { const url = make(file); return { url, kind: cat, revoke: revoker(url) }; }
        const ext = (String(file.name || '').split('.').pop() || '').toUpperCase();
        return { url: null, kind: 'file', label: ext.length <= 5 ? ext : '', revoke() { } };
    }

    // ------------------------------------------------------------------ the widget
    function widget(target, config, options) {
        config = config || {};
        const D = doc();
        const el = typeof target === 'string' ? D.querySelector(target) : target;
        if (!el) throw new Error('FileValidator.widget: element not found');
        const opt = Object.assign({
            multiple: true, append: true, browse: true, paste: false, folder: false, syncInput: true,
            dragClass: 'fv-dragover', preview: false, resize: null, list: null, messageElement: null, maxShownMessages: 5
        }, options);
        const resolve = x => (typeof x === 'string' ? D.querySelector(x) : x);
        const isInput = el.tagName === 'INPUT' && el.type === 'file';
        const input = resolve(opt.input) || (isInput ? el : el.querySelector('input[type=file]'));
        const zone = resolve(opt.dropzone) || (isInput ? (el.closest('label, [data-fv-dropzone]') || el.parentElement || el) : el);
        const listEl = resolve(opt.list), msgEl = resolve(opt.messageElement), statusEl = resolve(opt.statusElement);

        const entries = [];
        const cleanups = [];
        let seq = 0, chain = Promise.resolve(), dragDepth = 0, destroyed = false;

        const on = (node, type, fn, o) => { if (!node) return; node.addEventListener(type, fn, o); cleanups.push(() => node.removeEventListener(type, fn, o)); };
        const emit = (type, detail) => { if (typeof root.CustomEvent === 'function') zone.dispatchEvent(new root.CustomEvent(type, { bubbles: true, detail })); };
        const norm = () => FV._internals.normalizeConfig(config);
        const msg = (code, params) => FV.getMessage(code, params, config);

        // ---- rendering
        function defaultItem(entry) {
            const li = D.createElement('li');
            li.className = 'fv-file';
            li.setAttribute('data-id', String(entry.id));
            if (entry.preview && entry.preview.url && entry.preview.kind === 'image') {
                const img = D.createElement('img');
                img.className = 'fv-preview'; img.alt = ''; img.src = entry.preview.url;
                li.appendChild(img);
            } else if (entry.preview && entry.preview.label) {
                const badge = D.createElement('span');
                badge.className = 'fv-badge'; badge.textContent = entry.preview.label;
                li.appendChild(badge);
            }
            const name = D.createElement('span');
            name.className = 'fv-name'; name.setAttribute('dir', 'auto'); name.textContent = entry.path || entry.file.name;
            const size = D.createElement('span');
            size.className = 'fv-size'; size.textContent = FV.formatBytes(entry.file.size);
            const btn = D.createElement('button');
            btn.type = 'button'; btn.className = 'fv-remove'; btn.textContent = '×';
            btn.setAttribute('aria-label', FV.phrase('Remove {name}', { name: entry.path || entry.file.name }));
            btn.addEventListener('click', () => {
                const i = entries.indexOf(entry);
                remove(entry);
                // keep keyboard focus in the widget: the next remove button, else the previous one, else the input or the zone
                const btns = listEl ? listEl.querySelectorAll('.fv-remove') : [];
                const target = btns[Math.min(i, btns.length - 1)] || input || zone;
                if (target && isFn(target.focus)) target.focus();
            });
            li.appendChild(name); li.appendChild(D.createTextNode(' ')); li.appendChild(size); li.appendChild(D.createTextNode(' ')); li.appendChild(btn);
            return li;
        }

        function render() {
            if (!listEl) return;
            listEl.textContent = '';
            entries.forEach(e => listEl.appendChild(isFn(opt.renderItem) ? opt.renderItem(e, { remove: () => remove(e), formatBytes: FV.formatBytes }) : defaultItem(e)));
        }

        function showMessages(lines) {
            if (!msgEl) return;
            msgEl.textContent = '';
            if (!msgEl.hasAttribute('role')) msgEl.setAttribute('role', 'alert');
            if (!msgEl.hasAttribute('aria-live')) msgEl.setAttribute('aria-live', 'polite');
            const shown = lines.slice(0, opt.maxShownMessages);
            shown.forEach(line => { const d = D.createElement('div'); d.className = 'fv-message'; d.setAttribute('dir', 'auto'); d.textContent = line; msgEl.appendChild(d); });
            if (lines.length > shown.length) { const d = D.createElement('div'); d.className = 'fv-message'; d.setAttribute('dir', 'auto'); d.textContent = (isFn(opt.moreText) ? opt.moreText(lines.length - shown.length) : FV.phrase('…and {n} more.', { n: lines.length - shown.length })); msgEl.appendChild(d); }
        }

        // ---- a polite status line for screen readers: what just happened and how many files there are
        function say(kind, info) {
            if (!statusEl) return;
            if (!statusEl.hasAttribute('role')) statusEl.setAttribute('role', 'status');
            if (!statusEl.hasAttribute('aria-live')) statusEl.setAttribute('aria-live', 'polite');
            let text;
            if (isFn(opt.statusText)) text = opt.statusText(kind, info, entries.length);
            else if (kind === 'add') {
                text = [info.accepted ? FV.phraseN('status.added', info.accepted, {}, { one: '{n} file added.', other: '{n} files added.' }) : '',
                    info.rejected ? FV.phraseN('status.rejected', info.rejected, {}, { one: '{n} file not accepted.', other: '{n} files not accepted.' }) : '',
                    FV.phrase('{n} selected.', { n: entries.length })].filter(Boolean).join(' ');
            }
            else if (kind === 'remove') text = FV.phrase('{name} removed. {n} selected.', { name: info.name, n: entries.length });
            else text = FV.phrase('All files removed.');
            statusEl.setAttribute('dir', 'auto');
            statusEl.textContent = '';   // clear first so an identical message is announced again
            statusEl.textContent = text;
        }

        function syncInput() {
            if (!opt.syncInput || !input || typeof root.DataTransfer !== 'function') return;
            try {
                const dt = new root.DataTransfer();
                entries.forEach(e => dt.items.add(e.file));
                input.files = dt.files;
            } catch (e) { return; } // not supported here: entries stay available through widget.files / appendTo()
            const ev = new root.Event('change', { bubbles: true });
            ev.fvWidget = true;      // our own event: the widget ignores it, FormValidator and your code see it
            input.dispatchEvent(ev);
        }

        function changed(extra) {
            render(); syncInput();
            const files = entries.map(e => e.file);
            if (isFn(opt.onChange)) opt.onChange(files, entries.slice(), extra);
            emit('fv:widget-change', { files, entries: entries.slice() });
        }

        function revoke(entry) { if (entry.preview && isFn(entry.preview.revoke)) entry.preview.revoke(); entry.preview = null; }

        // ---- adding files
        const mkReject = (file, code, params) => {
            const message = msg(code, params);
            return { file, path: FV.getPath(file), errors: [code], details: [{ code, fileName: file.name, file, params: params || {}, message }], messages: [message] };
        };

        async function doAdd(list, source) {
            const cfg = norm();
            let files = Array.from(list || []);
            const ignoreSetting = config.ignoreFiles !== undefined ? config.ignoreFiles : (opt.folder ? true : undefined);
            const ignored = files.filter(f => FV.isIgnored(f, ignoreSetting));
            files = files.filter(f => !ignored.includes(f));
            const accepted = [], rejected = [];

            if (!opt.multiple || !opt.append) {
                if (!opt.multiple && files.length > 1) files.slice(1).forEach(f => rejected.push(mkReject(f, 'SINGLE_FILE_LIMIT_EXCEEDED')));
                if (!opt.multiple) files = files.slice(0, 1);
                if (files.length) { entries.splice(0).forEach(revoke); }   // the newest selection replaces the old one
            }

            const running = entries.map(e => e.file);
            const maxFiles = isNum(cfg.maxFiles) ? cfg.maxFiles : (opt.multiple ? Infinity : 1);
            const dupNames = cfg.duplicateNames === true || !!(cfg.validate && cfg.validate.duplicateNames);
            const idOf = f => (FV.getPath(f) || f.name).toLowerCase();
            let total = running.reduce((s, f) => s + (f.size || 0), 0);

            for (let file of files) {
                let resized = null;
                if (opt.resize) {
                    try {
                        const ro = opt.resize === true ? { maxWidth: cfg.maxImageWidth, maxHeight: cfg.maxImageHeight, maxSizeMB: cfg.maxFileSizeMB } : opt.resize;
                        const out = await resizeImage(file, ro);
                        if (out !== file) { file = out; resized = out.fvResized || null; }
                    } catch (e) { /* keep the original */ }
                }
                let stripped = null;
                if (opt.stripMetadata && isFn(FV.stripMetadata)) {
                    try {
                        const out = await FV.stripMetadata(file, opt.stripMetadata === true ? {} : opt.stripMetadata);
                        if (out !== file) { file = out; stripped = out.fvStripped || null; }
                    } catch (e) { /* keep the original */ }
                }
                if (running.length >= maxFiles) { rejected.push(mkReject(file, 'TOO_MANY_FILES', { max: maxFiles })); continue; }
                if (dupNames && running.some(f => idOf(f) === idOf(file))) { rejected.push(mkReject(file, 'DUPLICATE_FILENAMES')); continue; }
                if (cfg.duplicateContent) {
                    const h = await FV.hashFile(file, cfg.duplicateContentMaxMB);
                    if (h) {
                        const hs = await Promise.all(running.map(f => FV.hashFile(f, cfg.duplicateContentMaxMB)));
                        if (hs.includes(h)) { rejected.push(mkReject(file, 'DUPLICATE_FILES', { names: file.name })); continue; }
                    }
                }
                if (isNum(cfg.maxTotalSizeMB) && total + file.size > cfg.maxTotalSizeMB * 1048576) {
                    rejected.push(mkReject(file, 'TOTAL_SIZE_EXCEEDED', { max: FV.formatBytes(cfg.maxTotalSizeMB * 1048576), size: FV.formatBytes(total + file.size) }));
                    continue;
                }
                const res = await FV.validateFile(file, config, { files: running.concat(file), index: running.length });
                if (!res.isValid) { rejected.push({ file, path: FV.getPath(file), errors: res.errors, details: res.details, messages: res.details.map(d => d.message) }); continue; }
                running.push(file); total += file.size;
                accepted.push({ id: ++seq, file, path: FV.getPath(file), resized, stripped, preview: null });
            }

            entries.push(...accepted);
            if (opt.preview) {
                await Promise.all(accepted.map(async e => {
                    try { e.preview = await createPreview(e.file, opt.preview === true ? {} : opt.preview); } catch (err) { e.preview = null; }
                }));
            }

            const lines = [];
            rejected.forEach(r => r.messages.forEach(m => lines.push(r.file.name + ': ' + m)));
            showMessages(lines);
            if (files.length || rejected.length || ignored.length) { changed({ source, accepted, rejected, ignored }); say('add', { accepted: accepted.length, rejected: rejected.length }); }
            if (rejected.length) {
                if (isFn(opt.onReject)) opt.onReject(rejected, { source });
                emit('fv:widget-reject', { rejected, source });
            }
            return { accepted, rejected, ignored };
        }

        // one add at a time, so two quick drops cannot race each other
        function add(list, meta) {
            const run = chain.then(() => (destroyed ? { accepted: [], rejected: [], ignored: [] } : doAdd(list, (meta && meta.source) || 'api')));
            chain = run.catch(() => { /* keep the queue alive */ });
            return run;
        }

        function remove(x) {
            const i = typeof x === 'number' ? x : entries.findIndex(e => e === x || e.id === x || e.file === x);
            if (i < 0 || i >= entries.length) return false;
            const removed = entries[i];
            revoke(removed);
            entries.splice(i, 1);
            showMessages([]);
            changed({ source: 'remove' });
            say('remove', { name: removed.path || removed.file.name });
            return true;
        }

        function clear() {
            if (!entries.length) return;
            entries.splice(0).forEach(revoke);
            showMessages([]);
            changed({ source: 'clear' });
            say('clear', {});
        }

        async function validate() {
            const result = await FV.validateFiles(entries.map(e => e.file), config);
            showMessages(result.isValid ? [] : FV.summary(result));
            return result;
        }

        function appendTo(formData, name) {
            entries.forEach(e => formData.append(name || 'files', e.file, e.path || e.file.name));
            return formData;
        }

        // ---- events: the input, drag and drop, click and keyboard, paste
        if (input) on(input, 'change', e => { if (!e.fvWidget) add(Array.from(input.files || []), { source: 'input' }); });

        const hasFiles = e => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));
        on(zone, 'dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; zone.classList.add(opt.dragClass); });
        on(zone, 'dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (err) { /* read-only */ } });
        on(zone, 'dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) zone.classList.remove(opt.dragClass); });
        on(zone, 'drop', e => {
            if (!hasFiles(e)) return;
            e.preventDefault(); dragDepth = 0; zone.classList.remove(opt.dragClass);
            const p = filesFromDrop(e.dataTransfer, { maxFiles: opt.maxDropped, maxDepth: opt.maxDepth }); // starts synchronously, as required
            p.then(files => add(files, { source: 'drop' })).catch(() => { /* unreadable drop */ });
        });

        const wrappedInLabel = zone.tagName === 'LABEL' || !!zone.closest('label');
        if (opt.browse && input && zone !== input && !wrappedInLabel) {
            on(zone, 'click', e => { if (e.target === input || (e.target.closest && e.target.closest('button, a, input, select, textarea, .fv-file'))) return; input.click(); });
            on(zone, 'keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === zone) { e.preventDefault(); input.click(); } });
            // Keyboard access: when the real input can be reached with Tab it is the accessible control, and a button role on the zone would
            // nest interactive controls (an accessibility error). Only when the input is out of reach (hidden, aria-hidden, tabindex=-1) the
            // zone becomes the control. opt.keyboard = true / false forces it.
            const inputReachable = !input.hidden && input.getClientRects().length > 0 && input.getAttribute('tabindex') !== '-1' && input.getAttribute('aria-hidden') !== 'true';
            const hasOwnControls = !!(zone.querySelector('button, a[href], select, textarea') || (listEl && zone.contains(listEl)));
            const keyboard = opt.keyboard === undefined ? (!inputReachable && !hasOwnControls) : !!opt.keyboard;
            if (keyboard) {
                if (!zone.hasAttribute('tabindex')) zone.setAttribute('tabindex', '0');
                if (!zone.hasAttribute('role')) zone.setAttribute('role', 'button');
            }
        }

        if (opt.paste) {
            on(opt.paste === 'document' ? D : zone, 'paste', e => {
                const files = filesFromClipboard(e.clipboardData);
                if (!files.length) return;
                e.preventDefault();
                add(files, { source: 'paste' });
            });
        }

        function destroy() {
            destroyed = true;
            cleanups.splice(0).forEach(fn => fn());
            entries.splice(0).forEach(revoke);
            zone.classList.remove(opt.dragClass);
            if (listEl) listEl.textContent = '';
            showMessages([]);
            if (statusEl) statusEl.textContent = '';
        }

        return {
            add, remove, clear, validate, appendTo, destroy,
            get files() { return entries.map(e => e.file); },
            get entries() { return entries.slice(); },
            element: zone, input
        };
    }
    widget.__fv = true;

    Object.assign(FV, { widget, dropzone: widget, filesFromDrop, filesFromClipboard, resizeImage, createPreview });
    return FV;
});

    };

    mods["fileValidator.upload"] = function (module, exports, require, define) {
/*!
 * FileValidator upload add-on v1.0.0 — send a validated file: progress, cancel, retry, direct-to-storage and resumable (tus) uploads.
 *
 *   const up = FileValidator.upload(file, { url: '/upload', onProgress: p => bar.value = p.percent, retries: 3 });
 *   up.abort();                                  // cancel
 *   const { status, body } = await up;           // resolves with the response, rejects with an UploadError (code, status, response)
 *
 *   // straight to S3 / GCS / Azure with a URL your server signed for this one file
 *   FileValidator.upload(file, { presign: async f => ({ url: await getSignedUrl(f.name, f.type), method: 'PUT', headers: { 'Content-Type': f.type } }) });
 *   // ... or a presigned POST policy:  presign: async f => ({ url, method: 'POST', fields: { key, policy, 'x-amz-signature' }, fileField: 'file' })
 *
 *   // big files over a bad connection: resumable, in chunks (the tus protocol: tusd, @tus/server, Uppy's tus, Cloudflare, Vimeo ...)
 *   const t = FileValidator.upload(file, { tus: { endpoint: '/files/', chunkSize: 5 * 1024 * 1024 } });
 *   t.pause(); t.resume();                       // also survives a closed tab: the same file continues where it stopped
 *
 * Works in the browser (XMLHttpRequest for real upload progress, fetch when there is none) and in Node 18+ (fetch). Validate first with FileValidator.validateFile().
 *
 * Changelog
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['./fileValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, root.FileValidator || require('./fileValidator.js'));
    else factory(root, root.FileValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';
    if (!FV) throw new Error('fileValidator.upload.js needs FileValidator loaded first');

    const isFn = f => typeof f === 'function';
    const sleep = (ms, signal) => new Promise((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(abortError()); }, { once: true });
    });

    /** What an upload rejects with. code: 'ABORTED' | 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'PROTOCOL'; status and response are set for HTTP errors. */
    class UploadError extends Error {
        constructor(code, message, extra) {
            super(message);
            this.name = 'UploadError';
            this.code = code;
            if (extra) Object.assign(this, extra);
        }
        get aborted() { return this.code === 'ABORTED'; }
    }
    const abortError = () => new UploadError('ABORTED', 'The upload was cancelled.');

    // ---------------------------------------------------------------- one request: XMLHttpRequest (upload progress) or fetch
    function send(method, url, o) {
        const headers = Object.assign({}, o.headers);
        const canXhr = typeof root.XMLHttpRequest === 'function' && !o.forceFetch;
        if (o.signal && o.signal.aborted) return Promise.reject(abortError());
        if (canXhr) {
            return new Promise((resolve, reject) => {
                const xhr = new root.XMLHttpRequest();
                xhr.open(method, url, true);
                Object.keys(headers).forEach(k => xhr.setRequestHeader(k, headers[k]));
                xhr.withCredentials = !!o.withCredentials;
                if (o.timeout) xhr.timeout = o.timeout;
                if (xhr.upload && isFn(o.onProgress)) xhr.upload.onprogress = e => o.onProgress(e.loaded, e.lengthComputable ? e.total : (o.size || 0));
                const onAbort = () => { try { xhr.abort(); } catch (e) { /* done already */ } };
                if (o.signal) o.signal.addEventListener('abort', onAbort, { once: true });
                const done = fn => v => { if (o.signal) o.signal.removeEventListener('abort', onAbort); fn(v); };
                xhr.onload = done(() => {
                    const h = {};
                    String(xhr.getAllResponseHeaders() || '').trim().split(/[\r\n]+/).forEach(line => { const i = line.indexOf(':'); if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); });
                    resolve({ status: xhr.status, headers: h, text: xhr.responseText || '' });
                });
                xhr.onerror = done(() => reject(new UploadError('NETWORK', 'Network error.')));
                xhr.ontimeout = done(() => reject(new UploadError('TIMEOUT', 'The upload timed out.')));
                xhr.onabort = done(() => reject(abortError()));
                xhr.send(o.body === undefined ? null : o.body);
            });
        }
        const doFetch = o.fetch || (typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
        if (!doFetch) return Promise.reject(new UploadError('NETWORK', 'No XMLHttpRequest or fetch available.'));
        const ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
        let timer = null, timedOut = false;
        if (o.timeout && ctrl) timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, o.timeout);
        const onAbort = () => ctrl && ctrl.abort();
        if (o.signal) o.signal.addEventListener('abort', onAbort, { once: true });
        if (isFn(o.onProgress)) o.onProgress(0, o.size || 0);   // fetch cannot report upload progress: start and end only
        return doFetch(url, { method, headers, body: o.body, credentials: o.withCredentials ? 'include' : 'same-origin', signal: ctrl ? ctrl.signal : undefined, duplex: 'half' }).then(async resp => {
            const h = {};
            if (resp.headers && isFn(resp.headers.forEach)) resp.headers.forEach((v, k) => { h[String(k).toLowerCase()] = v; });
            const text = await resp.text();
            if (isFn(o.onProgress)) o.onProgress(o.size || 0, o.size || 0);
            return { status: resp.status, headers: h, text };
        }, e => {
            if (timedOut) throw new UploadError('TIMEOUT', 'The upload timed out.');
            if (e && e.name === 'AbortError') throw abortError();
            throw new UploadError('NETWORK', (e && e.message) || 'Network error.');
        }).finally(() => { if (timer) clearTimeout(timer); if (o.signal) o.signal.removeEventListener('abort', onAbort); });
    }

    const parseBody = (text, type) => { if (type === 'text') return text; try { return text === '' ? null : JSON.parse(text); } catch (e) { return type === 'json' ? text : text; } };
    const retryable = e => !!e && (e.code === 'NETWORK' || e.code === 'TIMEOUT' || (e.code === 'HTTP' && (e.status === 408 || e.status === 409 || e.status === 423 || e.status === 429 || e.status >= 500)));
    /** Runs `attempt` again after network trouble, 408 / 429 / 5xx, with exponential backoff and jitter (Retry-After is honoured). */
    async function withRetry(attempt, o, signal) {
        const max = typeof o.retries === 'number' ? o.retries : 3;
        for (let n = 0; ; n++) {
            try { return await attempt(n); }
            catch (e) {
                const should = isFn(o.retryOn) ? o.retryOn(e, n) : retryable(e);
                if (!e || e.aborted || n >= max || !should) throw e;
                const ra = e.response && e.response.headers && Number(e.response.headers['retry-after']);
                const base = typeof o.retryDelayMs === 'number' ? o.retryDelayMs : 1000;
                const wait = ra && isFinite(ra) ? Math.min(ra * 1000, 60000) : Math.min(base * Math.pow(2, n), 30000) * (0.75 + Math.random() * 0.5);
                if (isFn(o.onRetry)) o.onRetry({ attempt: n + 1, delayMs: wait, error: e });
                await sleep(wait, signal);
            }
        }
    }
    const httpError = resp => new UploadError('HTTP', 'The server answered ' + resp.status + '.', { status: resp.status, response: resp });
    const progressObj = (loaded, total) => ({ loaded, total, percent: total > 0 ? Math.min(100, Math.round(loaded / total * 1000) / 10) : 0 });

    // ---------------------------------------------------------------- a plain upload (multipart POST, raw PUT, or what a presigned URL asks for)
    async function plain(file, o, signal, report) {
        let target = { url: o.url, method: o.method, headers: o.headers, fields: o.fields, fileField: o.fieldName };
        if (isFn(o.presign)) target = Object.assign({ method: 'PUT' }, await o.presign(file));
        if (!target.url) throw new UploadError('PROTOCOL', 'upload: url (or presign) is required.');
        const method = String(target.method || 'POST').toUpperCase();
        let headers = Object.assign({}, typeof target.headers === 'function' ? target.headers(file) : target.headers);
        let body;
        const wantsForm = method !== 'PUT' && o.raw !== true;
        if (wantsForm) {
            body = new root.FormData();
            Object.keys(target.fields || {}).forEach(k => body.append(k, target.fields[k]));   // policy fields come before the file (S3 requires it)
            body.append(target.fileField || 'file', file, file.name);
        } else {
            body = file;
            if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type') && file.type) headers['Content-Type'] = file.type;
        }
        const resp = await send(method, target.url, { headers, body, signal, withCredentials: o.withCredentials, timeout: o.timeout, size: file.size, fetch: o.fetch, forceFetch: o.forceFetch, onProgress: (l, t) => report(l, t || file.size) });
        if (resp.status < 200 || resp.status >= 300) throw httpError(resp);
        return { status: resp.status, headers: resp.headers, body: parseBody(resp.text, o.responseType), response: resp, url: target.url };
    }

    // ---------------------------------------------------------------- tus 1.0.0 (https://tus.io): create, resume with HEAD, PATCH in chunks
    const TUS = '1.0.0';
    const b64 = s => { try { return root.btoa(unescape(encodeURIComponent(s))); } catch (e) { return Buffer.from(String(s), 'utf8').toString('base64'); } };
    function tusStore(o) {
        try { const s = o.storage === 'local' ? root.localStorage : (o.storage === false ? null : root.localStorage); return s && isFn(s.getItem) ? s : null; } catch (e) { return null; }
    }
    const fingerprint = (file, o) => ['fv-tus', o.endpoint, file.name, file.size, file.lastModified || 0, file.type || ''].join(':');
    function tusTask(file, o, signal, report, ctl) {
        const t = o.tus;
        const chunkSize = Math.max(64 * 1024, typeof t.chunkSize === 'number' ? t.chunkSize : 5 * 1024 * 1024);
        const store = t.resume === false ? null : tusStore(t);
        const key = fingerprint(file, t);
        const hdr = extra => Object.assign({ 'Tus-Resumable': TUS }, typeof t.headers === 'function' ? t.headers(file) : t.headers, extra);
        const common = { withCredentials: t.withCredentials || o.withCredentials, timeout: t.timeout || o.timeout, fetch: o.fetch, forceFetch: o.forceFetch };
        const abs = (loc, base) => { try { return new URL(loc, base).href; } catch (e) { return loc; } };
        const retryOpts = Object.assign({}, o, t);
        let location = ctl.location || (store && store.getItem(key)) || null;   // ctl.location: the same session after a pause

        async function create() {
            const meta = Object.assign({ filename: file.name, filetype: file.type || 'application/octet-stream' }, t.metadata);
            const metadata = Object.keys(meta).filter(k => meta[k] !== undefined && meta[k] !== null).map(k => k + ' ' + b64(String(meta[k]))).join(',');
            const resp = await send('POST', t.endpoint, Object.assign({ headers: hdr({ 'Upload-Length': String(file.size), 'Upload-Metadata': metadata }), signal }, common));
            if (resp.status !== 201) throw resp.status === 413 ? Object.assign(httpError(resp), { response: resp }) : httpError(resp);
            const loc = resp.headers.location;
            if (!loc) throw new UploadError('PROTOCOL', 'The tus server answered 201 without a Location header.', { response: resp });
            location = abs(loc, t.endpoint); ctl.location = location;
            if (store) { try { store.setItem(key, location); } catch (e) { /* storage full */ } }
        }
        /** Where does the server stand? Returns the offset, or null when the upload is gone (a new one is created). */
        async function offsetFromServer() {
            const resp = await send('HEAD', location, Object.assign({ headers: hdr(), signal }, common));
            if (resp.status === 404 || resp.status === 410 || resp.status === 403) { if (store) { try { store.removeItem(key); } catch (e) { /* */ } } location = null; ctl.location = null; return null; }
            if (resp.status < 200 || resp.status >= 300) throw httpError(resp);
            const off = parseInt(resp.headers['upload-offset'], 10);
            if (!isFinite(off)) throw new UploadError('PROTOCOL', 'The tus server did not answer an Upload-Offset.', { response: resp });
            const len = parseInt(resp.headers['upload-length'], 10);
            if (isFinite(len) && len !== file.size) { if (store) { try { store.removeItem(key); } catch (e) { /* */ } } location = null; ctl.location = null; return null; }   // a different file under that name
            return off;
        }
        async function run() {
            let offset = 0;
            if (location) { offset = await withRetry(() => offsetFromServer(), retryOpts, signal); if (offset === null) offset = 0; }
            if (!location) { await withRetry(() => create(), retryOpts, signal); offset = 0; }
            report(offset, file.size);
            if (file.size === 0) { if (store) { try { store.removeItem(key); } catch (e) { /* */ } } return { status: 201, headers: {}, body: null, url: location, offset: 0, size: 0 }; }
            while (offset < file.size) {
                const end = Math.min(file.size, offset + chunkSize), start = offset;
                const chunk = file.slice(start, end);
                const attemptChunk = async () => {
                    const resp = await send('PATCH', location, Object.assign({ headers: hdr({ 'Upload-Offset': String(start), 'Content-Type': 'application/offset+octet-stream' }), body: chunk, signal, size: end - start,
                        onProgress: (l) => report(start + Math.min(l, end - start), file.size) }, common));
                    if (resp.status === 409) {   // the server is at another offset: ask it
                        const o2 = await offsetFromServer();
                        throw Object.assign(new UploadError('HTTP', 'Offset mismatch.', { status: 409, response: resp }), { resumeAt: o2 });
                    }
                    if (resp.status !== 204 && resp.status !== 200) throw httpError(resp);
                    const next = parseInt(resp.headers['upload-offset'], 10);
                    if (!isFinite(next)) throw new UploadError('PROTOCOL', 'The tus server did not answer an Upload-Offset.', { response: resp });
                    return next;
                };
                try {
                    offset = await withRetry(attemptChunk, Object.assign({}, retryOpts, { retryOn: e => (e.code === 'HTTP' && e.status === 409) || retryable(e) }), signal);
                } catch (e) {
                    if (e && e.status === 409 && typeof e.resumeAt === 'number') { offset = e.resumeAt; continue; }
                    throw e;
                }
                report(offset, file.size);
                if (isFn(t.onChunkComplete)) t.onChunkComplete(end - start, offset, file.size);
            }
            if (store) { try { store.removeItem(key); } catch (e) { /* */ } }
            return { status: 204, headers: {}, body: null, url: location, offset, size: file.size };
        }
        return run();
    }

    /**
     * FileValidator.upload(file, options) -> a Promise with abort() (and pause() / resume() for tus). Resolves to { status, body, headers, url, response }, rejects with an UploadError.
     * options: url, method ('POST'), fieldName ('file'), fields (extra form fields), headers (object or function(file)), withCredentials, timeout (ms), responseType ('json' | 'text'),
     *   onProgress({ loaded, total, percent }), signal (an AbortSignal), retries (3), retryDelayMs (1000), retryOn(error, attempt), onRetry({ attempt, delayMs, error }),
     *   presign (async file -> { url, method: 'PUT' | 'POST', headers, fields, fileField }), raw (true: send the file as the body even for POST),
     *   tus ({ endpoint, chunkSize, headers, metadata, resume: true, storage: 'local', onChunkComplete }), fetch (your own), validate (a FileValidator config: the file is checked first).
     */
    function upload(file, options) {
        const o = options || {};
        const state = { paused: false, cancelled: false, resumeWaiters: [], current: null, location: null };
        const external = o.signal;
        const cancel = () => { state.cancelled = true; state.paused = false; state.resumeWaiters.splice(0).forEach(r => r()); if (state.current) state.current.abort(); };
        if (external) { if (external.aborted) state.cancelled = true; else external.addEventListener('abort', cancel, { once: true }); }
        const report = (loaded, total) => { if (isFn(o.onProgress)) { try { o.onProgress(progressObj(loaded, total)); } catch (e) { /* your callback must not break the upload */ } } };
        const run = async () => {
            if (!file || typeof file.size !== 'number') throw new UploadError('PROTOCOL', 'upload: pass a File.');
            if (o.validate) {
                const v = await FV.validateFile(file, o.validate);
                if (!v.isValid) throw new UploadError('INVALID', 'The file did not pass validation: ' + (v.errors || []).join(', '), { errors: v.errors, messages: v.messages });
            }
            for (;;) {
                if (state.cancelled) throw abortError();
                // one controller per run: pausing aborts the request in flight, resuming starts a new run from where the server says it is
                const ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
                state.current = ctrl;
                const signal = ctrl ? ctrl.signal : undefined;
                try {
                    if (o.tus && o.tus.endpoint) return await tusTask(file, o, signal, report, state);
                    return await withRetry(() => plain(file, o, signal, report), o, signal);
                } catch (e) {
                    if (e && e.aborted && state.paused && !state.cancelled) {
                        await new Promise(r => state.resumeWaiters.push(r));
                        continue;
                    }
                    throw e;
                } finally { state.current = null; }
            }
        };
        const promise = new Promise((resolve, reject) => { Promise.resolve().then(run).then(resolve, reject); });
        promise.abort = cancel;
        promise.pause = () => { if (!(o.tus && o.tus.endpoint)) throw new Error('upload.pause: only tus uploads can be paused'); if (state.cancelled) return; state.paused = true; if (state.current) state.current.abort(); };
        promise.resume = () => { state.paused = false; state.resumeWaiters.splice(0).forEach(r => r()); };
        return promise;
    }
    upload.UploadError = UploadError;

    FV.upload = upload;
    FV.UploadError = UploadError;
    return upload;
});

    };

    mods["formValidator"] = function (module, exports, require, define) {
/*!
 * FormValidator v2.15.0 — dependency-free form validation (jQuery / Select2 / Bootstrap are optional).
 *
 * Changelog
 *   2.15.0 registerRule(name, fn, { raw: true }) keeps a value untrimmed (pwcheck and the password add-on use it). Rules requiredIf, dateAfter, dateBefore, atLeastOne, sumEquals (other fields come from the form, options.values or the data). inst.state / getState() / onStateChange():
 *          touched, dirty, pending, errors, submit count. inst.validateStep(scope) for wizards. FormValidator.explain(value, rules): why a value passes or fails, rule by rule.
 *   2.14.0 Field arrays and nested data: path keys ('user.email', 'items[0].qty') and wildcards ('items[].qty') in checkValues / schema / forms; rules unique, minItems, maxItems;
 *          schema output is nested like the input; ValidationError.errors are keyed by the concrete path.
 *   2.13.0 ASP.NET unobtrusive validation: `unobtrusive: true` reads data-val-* (required, length, range, regex, equalto, remote, email, url, ... + custom adapters),
 *          data-valmsg-for / data-valmsg-summary and the field-validation-* / input-validation-* classes. FormValidator.unobtrusive.parse() / auto() / adapters.
 *   2.12.0 validateOn presets ('smart' | 'blur' | 'input' | 'submit' | 'all'; an 'input' entry now works) + validClass reward while typing. Stable error codes (data-code, code in getErrors / checkValue /
 *          schema issues, rule.code). errorSummary: accessible list of problems with links and focus. autoAttributes (type / inputmode / autocomplete / aria-required) + inst.lint().
 *   2.11.0 FormValidator.serverErrors(body): problem+json, ASP.NET, Laravel/Rails, Django REST, FastAPI, Zod, JSON:API, express-validator, Ajv in one shape; inst.setServerErrors();
 *          setErrors() matches items.0.qty to items[0].qty. precognition(url, values) / inst.validateOnServer() / inst.watchServer(): ask the real endpoint (Laravel Precognition protocol).
 *          FormValidator.action(rules, serverFn): one function for React 19 useActionState, Server Actions and FormData handlers.
 *   2.10.0 FormValidator.parseFormData(formData, { coerce }): flat fields (a.b[0].c, tags[], repeated names) -> the nested object a schema expects, safe against __proto__ keys and huge indexes.
 *          FormValidator.ruleNames(). A fuzz test (tests/redos.test.js) now guards every rule against catastrophic regex backtracking.
 *   2.9.0  FormValidator.schema(rules): the rules of an object as a Standard Schema (parse, safeParse, ~standard.validate, typed values and errors in TypeScript).
 *   2.8.0  19 new rules: integer, uuid, hexColor, slug, ipv4, ipv6, iban, time, domain, base64, mac, latitude, longitude, startsWith, endsWith, contains, notOneOf, minWords, maxWords
 *          (ASCII-exact, the same answers in .NET; messages in every language pack).
 *   2.7.0  Dates with a named format (date / minDate / maxDate: `format`, `strict`); checkValue() / checkValues() without a DOM; url rule independent of the browser's URL parser;
 *          pwcheck counts capital letters, small letters, digits and symbols of every script; min / max / range / step take plain decimals only.
 *   2.6.0  Error messages get dir="auto", so right-to-left text (Arabic, Hebrew) reads correctly inside a left-to-right page and the other way round.
 *   2.5.3  Hardening: a CSS selector that is not valid (equalTo: '[1,2]') no longer throws, and an error thrown by one of your callbacks
 *          (when, message, resolveMessage, normalizer, errorPlacement, highlight, ...) is logged and ignored instead of aborting the validation.
 *   2.5.2  Hardening: options of the wrong type (an array as errorElement, a string as submitHandler, an invalid CSS selector as ignore ...)
 *          fall back to the defaults instead of crashing when an error is shown.
 *   2.5.1  Fix found in real browsers: validation that runs because a field lost focus no longer changes the page (adds or removes
 *          messages) while a mouse button or finger is still down. Before, the message removal moved the page under the pointer and the
 *          click landed on the wrong element (for example a radio button was not selected).
 *   2.5.0  `remote` now defaults to GET (value in the query string), like jQuery Validation. POST is one option away: `method: 'POST'`
 *          per rule (JSON body, or `encoding: 'form'`), or globally with FormValidator.remoteDefaults.method = 'POST'.
 *   2.4.0  jQuery-Validation-style API on the native engine: FormValidator.addMethod(name, fn(value, element, param), message),
 *          scalar rule parameters ({ minlength: 3, range: [1, 5], equalTo: '#pw', remote: '/check' }), `depends`, `normalizer`,
 *          class rules (addClassRules / config.classRules), data-rule-* attributes, per-field `messages`, {0}/{1} placeholders,
 *          FormValidator.format / setDefaults, remote shorthand (`type`, function-valued `data`, `dataFilter`), a `pending` class
 *          while a server check runs (aria-busy), and `focusCleanup`.
 *   2.3.0  data-msg-<rule> and data-msg attributes set messages straight in the HTML (same idea as jQuery Validation):
 *          <input name="name" required data-msg-required="Please tell us your name">
 *   2.2.0  Engine additions for the jQuery Validation compatibility layer (formValidator.jquery.js): synchronous validation
 *          (validateSync), highlight/unhighlight/onFieldValid hooks, setError/getErrors/resetForm, skipEmptyUntilSubmit and
 *          validateAfterSubmit, per-field rule hook (fieldRules), equalTo by selector, form-encoded remote requests.
 *   2.1.0  Event delegation (fields added later just work), live re-check of "confirm" fields, type=number bad-input handling,
 *          `formnovalidate` buttons skip validation, `autoRules` (reads required/pattern/min/max/... attributes),
 *          `fv:valid` / `fv:invalid` DOM events, friendlier number rule.
 *   2.0.0  Rewrite: submit actually blocked, optional fields, no jQuery dependency, a11y, remote rule, file rule, registerRule, UMD.
 *   1.0.0  Original version (see _original_backup/).
 *
 * Works as a <script> (window.FormValidator), CommonJS, AMD or via a bundler.
 *
 *   FormValidator.init({
 *       formId: 'signup',                        // id, selector, element, or an array of those
 *       rules: {
 *           email:    [{ type: 'required', message: 'Email is required' }, { type: 'email' }],
 *           password: [{ type: 'pwcheck', minLength: 8, requireDigit: true }],
 *           confirm:  [{ type: 'equalTo', target: 'password' }],
 *           avatar:   [{ type: 'file', allowedExtensions: ['.png', '.jpg'], maxFileSizeMB: 2 }],   // uses FileValidator
 *           username: [{ type: 'remote', url: '/api/check-username' }],
 *       },
 *       config: { validateOn: ['change'], focusInvalid: true, submitHandler(form) { ajaxSubmit(form); } },
 *   });
 *
 * Non-required rules are skipped for empty values, so optional fields may stay blank.
 * Rule shorthands: 'required'  |  { required: true, email: { message: '...' } }.
 * Extra rules: FormValidator.registerRule('name', (value, rule, env) => boolean | string | {valid, message} | Promise).
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define([], function () { return factory(root); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root);
    else root.FormValidator = factory(root);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
    'use strict';

    // ------------------------------------------------------------------ defaults
    const DEFAULT_MESSAGES = {
        required: 'This field is required.',
        email: 'Please enter a valid email address.',
        url: 'Please enter a valid URL.',
        number: 'Please enter a valid number.',
        digits: 'Please enter digits only.',
        alpha: 'Please use letters only.',
        alphanumeric: 'Please use letters and numbers only.',
        phone: 'Please enter a valid phone number.',
        date: 'Please enter a valid date.',
        minDate: 'Date must be on or after {min}.',
        maxDate: 'Date must be on or before {max}.',
        creditcard: 'Please enter a valid card number.',
        pattern: 'Invalid format.',
        maxlength: 'Please enter no more than {max} characters.',
        minlength: 'Please enter at least {min} characters.',
        rangelength: 'Please enter between {min} and {max} characters.',
        range: 'Please enter a value between {min} and {max}.',
        max: 'Please enter a value no greater than {max}.',
        min: 'Please enter a value no less than {min}.',
        step: 'Please enter a multiple of {step}.',
        oneOf: 'Please choose a valid option.',
        notOneOf: 'This value is not allowed.',
        integer: 'Please enter a whole number.',
        uuid: 'Please enter a valid UUID.',
        hexColor: 'Please enter a valid hex color, like #1a2b3c.',
        slug: 'Use lowercase letters, numbers and single hyphens only.',
        ipv4: 'Please enter a valid IPv4 address.',
        ipv6: 'Please enter a valid IPv6 address.',
        iban: 'Please enter a valid IBAN.',
        time: 'Please enter a valid time (HH:mm).',
        domain: 'Please enter a valid domain name.',
        base64: 'Please enter valid Base64 text.',
        mac: 'Please enter a valid MAC address.',
        latitude: 'Please enter a latitude between -90 and 90.',
        longitude: 'Please enter a longitude between -180 and 180.',
        startsWith: 'Must start with {value}.',
        endsWith: 'Must end with {value}.',
        contains: 'Must contain {value}.',
        minWords: 'Please enter at least {min} words.',
        maxWords: 'Please enter no more than {max} words.',
        unique: 'This value is used more than once.',
        requiredIf: 'This field is required.',
        mask: 'Please complete this field.',
        dateAfter: 'Please enter a later date.',
        dateBefore: 'Please enter an earlier date.',
        atLeastOne: 'Please fill in at least one of these fields.',
        sumEquals: 'The values must add up to {total}.',
        minItems: 'Please add at least {min}.',
        maxItems: 'Please add no more than {max}.',
        notEqualTo: 'This value is not allowed.',
        equalTo: 'Values do not match.',
        pwcheck: 'Password does not meet the requirements.',
        minChecked: 'Please select at least {min}.',
        maxChecked: 'Please select no more than {max}.',
        minFiles: 'Please select at least {min} file(s).',
        maxFiles: 'Please select no more than {max} file(s).',
        fileType: 'This file type is not allowed.',
        fileSize: 'A file is too large.',
        file: 'Invalid file.',
        remote: 'Please fix this field.',
        badInput: 'Please enter a valid value.',
        errorSummary: 'Please fix the following:',
        custom: 'Invalid value.'
    };

    const DEFAULTS = {
        trim: true,                       // trim values (never trims type=password)
        novalidate: true,                 // set form.noValidate so native bubbles don't fight ours
        focusInvalid: true,               // focus + scroll to the first invalid field on submit
        validateHidden: false,            // also validate fields that are not rendered / type=hidden
        ignore: null,                     // CSS selector of fields to skip
        validateOn: ['change'],           // when a not-yet-invalid field is checked: a preset ('smart' = after the user leaves an edited field, then live while it is invalid; 'blur'; 'input'; 'submit'; 'all') or a list of events ('blur', 'change', 'input')
        debounce: 150,                    // ms, for 'input' revalidation
        errorElement: 'div',
        errorClass: 'text-danger error',  // class(es) for the message element
        invalidClass: 'is-invalid',       // class(es) added to invalid fields ('' to disable)
        messages: {},                     // per-instance message overrides by rule type
        passwordStrength: {},             // defaults for the pwcheck rule
        errorPlacement: null,             // (errorEl, field, fields) => void
        onError: null,                    // (errors[{name, field, message}]) on failed submit / validate()
        onSuccess: null,                  // () on successful submit / validate()
        submitHandler: null,              // (form, event) => void — called instead of native submit when valid
        autoRules: false,                 // also derive rules from HTML attributes (required, type, min, max, minlength, maxlength, pattern, accept)
        skipEmptyUntilSubmit: false,      // do not validate empty fields on blur/change until the first submit attempt
        validateAfterSubmit: false,       // after the first submit attempt, re-check every field as the user types
        highlight: null,                  // (field, unit) => void, called when a field becomes invalid
        unhighlight: null,                // (field, unit) => void, called when a field is cleared
        onFieldValid: null,               // (field, unit) => void, after a field was checked and is valid
        fieldRules: null,                 // (field, unit) => rules[] : extra rules per field, evaluated at validation time
        interceptSubmit: true,            // false: do not touch the form's submit event (validate manually)
        liveInput: true,                  // false: never re-check while typing (only on change/blur)
        skipSubmitter: null,              // CSS selector of submit buttons that skip validation (like formnovalidate)
        resolveMessage: null,             // (rule, env, dynamicMessage) => string | falsy : take over message selection
        pendingClass: 'fv-pending',       // class (and aria-busy) on a field while a server/async check runs; '' to disable
        focusCleanup: false,              // clear a field's error when it receives focus
        classRules: null,                 // { className: rules } applied to fields that carry the class
        validClass: '',                   // class for a field that was checked and holds a valid value ('is-valid'); while typing it appears as soon as the value becomes valid, an error never does
        rewardOnInput: true,              // false: validClass only after a real check, not while typing
        errorSummary: false,              // true | selector | element | { container, title, focus: 'summary' | 'field', withLabel, headingLevel, className }: an accessible list of all problems with links to the fields
        antiBot: false,                   // true | { honeypot: true | 'field_name', minTime: ms, timestampField: '_fv_t', onBot(reason) }: a hidden trap field and a minimum time; a bot's submit is dropped silently
        idempotencyKey: false,            // true | { field: '_idempotency_key', header: 'Idempotency-Key' }: one key per submission attempt, kept across retries until it succeeds (inst.idempotencyKey())
        disableOnSubmit: false,           // true: submit buttons are disabled (and the form gets .fv-submitting) while your onSubmit / handleSubmit function runs
        draft: false,                     // true | { key, storage: 'session' | 'local', exclude: [names], debounce: 400, maxAgeDays: 7 }: keep what the user typed (never passwords or files) and restore it
        leaveWarning: false,              // true: the browser asks before leaving a page with unsaved changes
        unobtrusive: false,               // read ASP.NET data-val-* attributes (MVC / Razor), use data-valmsg-for / data-valmsg-summary and the field-validation-* classes; see FormValidator.unobtrusive
        autoAttributes: false             // true | { type, inputmode, autocomplete, ariaRequired, lint }: set type / inputmode / autocomplete / aria-required from the rules and field names, and warn about autocomplete="off" and type="number" misuse
    };

    const GROUP_CONTAINERS = '.answer, .btn-group, .option-group, .choice-group, .checkbox-group';
    let uid = 0;

    // ------------------------------------------------------------------ helpers
    const esc = s => (root.CSS && root.CSS.escape) ? root.CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
    const isFn = f => typeof f === 'function';
    /** Runs one of YOUR callbacks. If it throws, the error is logged and `fallback` is used, so a bug there cannot block the form. */
    function guard(fn, fallback) {
        try { return fn.apply(null, Array.prototype.slice.call(arguments, 2)); }
        catch (e) { if (root.console) console.error('FormValidator: an error in your callback was ignored:', e); return fallback; }
    }
    /** querySelector / matches that treat an invalid selector as "no match" instead of throwing. */
    const safeQuery = (scope, sel) => { try { return scope.querySelector(sel); } catch (e) { return null; } };
    const safeMatches = (el, sel) => { try { return !!el.matches(sel); } catch (e) { return false; } };
    // plain decimal numbers only (sign, digits, one point, exponent): no 0x10, no Infinity, no digits of other scripts. min / max / range / step use it too.
    const NUMBER_RE = /^[-+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][-+]?[0-9]+)?$/;
    const num = v => NUMBER_RE.test(String(v).trim()) ? Number(v) : NaN;
    const fmt = (tpl, rule) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (rule && rule[k] !== undefined ? rule[k] : m));

    function resolveForm(target) {
        if (!target) return null;
        if (target.nodeType === 1) return target;
        if (target[0] && target[0].nodeType === 1) return target[0]; // jQuery object
        const d = root.document;
        return d.getElementById(target) || (function () { try { return d.querySelector(target); } catch (e) { return null; } })();
    }

    function tryFileValidator() {
        if (root.FileValidator) return root.FileValidator;
        try { if (typeof require === 'function') return require('./fileValidator'); } catch (e) { /* not available */ }
        return null;
    }

    function toDate(v) {
        if (v === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
        const t = Date.parse(v);
        return isNaN(t) ? NaN : t;
    }

    // ---- dates with an explicit format: identical in every browser and in the .NET port (no Date.parse guessing)
    //  tokens: yyyy / y (4-digit year), yy (00-69 -> 20xx, 70-99 -> 19xx), MM / M, dd / d, HH / H, mm / m, ss / s; any other character is literal.
    //  d / M / H / m / s accept 1 or 2 digits, the doubled tokens need exactly 2. The calendar is checked (leap years, 30/31-day months).
    const DATE_TOKEN = /yyyy|yy|y|MM|M|dd|d|HH|H|mm|m|ss|s/g;
    const ISO_FORMATS = ['yyyy-MM-dd', 'yyyy-MM-ddTHH:mm', 'yyyy-MM-ddTHH:mm:ss'];
    const daysIn = (y, m) => m === 2 ? ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
    /** -> milliseconds since 1970-01-01T00:00 UTC (the wall-clock time read as UTC), or NaN when v does not fit the format */
    function parseDateFormat(v, format) {
        v = String(v);
        let pos = 0, last = 0, out = null; const f = { y: null, M: 1, d: 1, H: 0, m: 0, s: 0 }; let ok = true;
        const digits = (min, max) => { const m = new RegExp('^\\d{' + min + ',' + max + '}').exec(v.slice(pos)); if (!m) return null; pos += m[0].length; return +m[0]; };
        const lit = text => { if (v.substr(pos, text.length) !== text) return false; pos += text.length; return true; };
        DATE_TOKEN.lastIndex = 0;
        while ((out = DATE_TOKEN.exec(format))) {
            if (out.index > last && !lit(format.slice(last, out.index))) return NaN;
            last = out.index + out[0].length;
            const t = out[0];
            const n = t === 'yyyy' || t === 'y' ? digits(4, 4) : t.length === 2 ? digits(2, 2) : digits(1, 2);
            if (n === null) return NaN;
            if (t === 'yyyy' || t === 'y') f.y = n; else if (t === 'yy') f.y = n < 70 ? 2000 + n : 1900 + n;
            else f[t[0]] = n;
        }
        if (last < format.length && !lit(format.slice(last))) return NaN;
        if (pos !== v.length || f.y === null || f.y < 1) ok = false;
        if (!ok || f.M < 1 || f.M > 12 || f.d < 1 || f.d > daysIn(f.y, f.M) || f.H > 23 || f.m > 59 || f.s > 59) return NaN;
        const dt = new Date(0); dt.setUTCFullYear(f.y, f.M - 1, f.d); dt.setUTCHours(f.H, f.m, f.s, 0);
        return dt.getTime();
    }
    /** strict ISO 8601: yyyy-MM-dd, optionally with THH:mm[:ss]; no time zone, no other spellings */
    function parseIso(v) { for (const f of ISO_FORMATS) { const t = parseDateFormat(v, f); if (!isNaN(t)) return t; } return NaN; }
    /** the value of a date rule under its options: explicit format > strict ISO > the browser's own Date.parse (legacy) */
    function dateValue(v, rule) {
        if (v === 'today' && (rule.format || rule.strict)) { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }   // today's calendar date, as a wall-clock date
        if (rule.format) return parseDateFormat(v, rule.format);
        if (rule.strict) return parseIso(v);
        return toDate(v);
    }

    // ---- the url rule. Written out here instead of asking `new URL()`: browsers disagree on edge cases (Chrome accepts "http://exa%20mple.com",
    //      the others do not), and the .NET package follows exactly this algorithm, so the answer is the same in every browser, Node and .NET.
    //      Follows the URL standard: scheme, user info, host (percent-decoding, forbidden characters, IPv4 forms, IPv6 in brackets, IDN), port.
    const URL_SPECIAL = ['http', 'https', 'ftp', 'ws', 'wss', 'file'];
    const URL_FORBIDDEN_HOST = ' #/:<>?@[\\]^|%';
    function ipv4Part(s) {
        if (s === '') return null;
        let radix = 10;
        if (s.length >= 2 && s[0] === '0' && (s[1] === 'x' || s[1] === 'X')) { s = s.slice(2); radix = 16; }
        else if (s.length >= 2 && s[0] === '0') { s = s.slice(1); radix = 8; }
        if (s === '') return 0;
        let value = 0;
        for (const ch of s) {
            const d = parseInt(ch, 16);
            if (isNaN(d) || d >= radix || (radix === 10 && !/[0-9]/.test(ch)) || (radix === 8 && !/[0-7]/.test(ch))) return null;
            value = value * radix + d;
            if (value > 0xFFFFFFFF * 256) return null;
        }
        return value;
    }
    /** a host that ends in a number must be an IPv4 address (1-4 parts, decimal / 0x hex / 0 octal); returns the dotted form or null */
    function ipv4Of(host) {
        const parts = host.split('.');
        if (parts[parts.length - 1] === '' && parts.length > 1) parts.pop();
        if (parts.length > 4) return null;
        const nums = [];
        for (const p of parts) { const n = ipv4Part(p); if (n === null) return null; nums.push(n); }
        for (let i = 0; i < nums.length - 1; i++) if (nums[i] > 255) return null;
        if (nums[nums.length - 1] >= Math.pow(256, 5 - nums.length)) return null;
        let ip = nums[nums.length - 1];
        for (let i = 0; i < nums.length - 1; i++) ip += nums[i] * Math.pow(256, 3 - i);
        return [Math.floor(ip / 16777216) % 256, Math.floor(ip / 65536) % 256, Math.floor(ip / 256) % 256, ip % 256].join('.');
    }
    function endsInNumber(host) {
        const labels = host.split('.');
        if (labels[labels.length - 1] === '' && labels.length > 1) labels.pop();
        const last = labels[labels.length - 1];
        return /^[0-9]+$/.test(last) || /^0[xX][0-9a-fA-F]*$/.test(last);
    }
    function ipv6Ok(s) {
        if (!/^[0-9a-fA-F:.]+$/.test(s) || s.indexOf(':') < 0) return false;
        let tail = s, groups = 0;
        const dbl = s.indexOf('::');
        if (dbl !== s.lastIndexOf('::')) return false;
        const lastColon = s.lastIndexOf(':');
        const v4 = s.slice(lastColon + 1);
        if (v4.indexOf('.') >= 0) { if (!/^(\d{1,3})(\.\d{1,3}){3}$/.test(v4) || v4.split('.').some(n => +n > 255)) return false; tail = s.slice(0, lastColon + 1) + '0:0'; }
        const halves = tail.split('::');
        for (const half of halves) {
            if (half === '') continue;
            for (const g of half.split(':')) { if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return false; groups++; }
        }
        return dbl >= 0 ? groups < 8 : groups === 8;
    }
    function hostOf(host) {   // percent-decoding, lower case, ASCII (punycode) form of an international name; '' = invalid
        try {
            if (host.indexOf('%') >= 0) host = decodeURIComponent(host);
            host = host.toLowerCase();
            if (/[^\x00-\x7f]/.test(host)) { const u = new URL('http://' + host + '/'); host = u.hostname; }   // only international names go to the engine's IDNA
            return host;
        } catch (e) { return ''; }
    }
    function urlOk(v, rule) {
        if (/\s/.test(v)) return false;
        const hasProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(v);
        if (!hasProto && rule.requireProtocol) return false;
        const full = hasProto ? v : 'http://' + v;
        const sep = full.indexOf('://');
        const scheme = full.slice(0, sep).toLowerCase();
        if (!(rule.protocols || ['http:', 'https:']).includes(scheme + ':')) return false;
        const rest = full.slice(sep + 3), special = URL_SPECIAL.includes(scheme);
        let end = rest.length;
        for (let i = 0; i < rest.length; i++) { const ch = rest[i]; if (ch === '/' || ch === '?' || ch === '#' || (special && ch === String.fromCharCode(92))) { end = i; break; } }
        const authority = rest.slice(0, end), at = authority.lastIndexOf('@');
        const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
        let host, port = '';
        if (hostPort[0] === '[') {
            const close = hostPort.indexOf(']');
            if (close < 0) return false;
            host = hostPort.slice(0, close + 1);
            const after = hostPort.slice(close + 1);
            if (after !== '') { if (after[0] !== ':') return false; port = after.slice(1); }
            if (!ipv6Ok(host.slice(1, -1))) return false;
        } else {
            const colon = hostPort.indexOf(':');
            host = colon >= 0 ? hostPort.slice(0, colon) : hostPort;
            if (colon >= 0) port = hostPort.slice(colon + 1);
            if (host === '') return false;
            host = hostOf(host);
            if (host === '') return false;
            for (let i = 0; i < host.length; i++) { const c = host.charCodeAt(i); if (c <= 0x1f || c === 0x7f || URL_FORBIDDEN_HOST.indexOf(host[i]) >= 0) return false; }
            if (endsInNumber(host)) { const ip = ipv4Of(host); if (ip === null) return false; host = ip; }
        }
        if (port !== '') { if (!/^[0-9]{1,5}$/.test(port) || +port > 65535) return false; }
        if (rule.allowLocal) return true;
        return (host.indexOf('.') >= 0 || host === 'localhost') && host[0] !== '.' && host[host.length - 1] !== '.';
    }

    function luhn(v) {
        const s = v.replace(/[\s-]/g, '');
        if (!/^\d{12,19}$/.test(s)) return false;
        let sum = 0, alt = false;
        for (let i = s.length - 1; i >= 0; i--) { let n = +s[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
        return sum % 10 === 0;
    }

    // ---- identifiers and formats. Everything below is ASCII-only on purpose (no /i flag, no toUpperCase) so every platform answers the same.
    const IPV4_BYTE = '(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
    const IPV4_RE = new RegExp('^(?:' + IPV4_BYTE + '\\.){3}' + IPV4_BYTE + '$');
    const HEX4_RE = /^[0-9a-fA-F]{1,4}$/;

    /** IPv6 in any of its writings: full, with :: once, with an IPv4 tail (::ffff:1.2.3.4). */
    function isIPv6(v) {
        if (!/^[0-9a-fA-F:.]+$/.test(v) || v.split('::').length > 2) return false;
        let s = v;
        const lastColon = s.lastIndexOf(':');
        if (s.indexOf('.') > -1) {
            const tail = s.slice(lastColon + 1);
            if (!IPV4_RE.test(tail)) return false;
            s = s.slice(0, lastColon + 1) + '0:0';
        }
        const groups = s.split('::');
        const parse = part => part === '' ? [] : part.split(':');
        const left = parse(groups[0]), right = groups.length === 2 ? parse(groups[1]) : [];
        if (left.concat(right).some(g => !HEX4_RE.test(g))) return false;
        return groups.length === 2 ? left.length + right.length < 8 : left.length === 8;
    }

    /** IBAN: shape, then the mod-97 check of ISO 13616 (spaces are allowed, case does not matter). */
    function ibanOk(v) {
        const s = v.replace(/\s+/g, '').replace(/[a-z]/g, c => c.toUpperCase());
        if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(s)) return false;
        const moved = s.slice(4) + s.slice(0, 4);
        let rem = 0;
        for (let i = 0; i < moved.length; i++) {
            const c = moved.charCodeAt(i);
            const digits = c >= 65 ? String(c - 55) : moved[i];
            for (let j = 0; j < digits.length; j++) rem = (rem * 10 + (digits.charCodeAt(j) - 48)) % 97;
        }
        return rem === 1;
    }

    /** A host name: letters, digits and hyphens in labels of 1-63 characters, a top level of letters (or xn-- for internationalised ones), 253 in all. */
    const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:[a-zA-Z]{2,63}|xn--[a-zA-Z0-9-]{1,59})$/;

    /** Words: pieces between whitespace that hold at least one letter or digit (of any script). */
    function wordCount(v) {
        return v.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
    }

    /** data-msg-<rule> (or data-msg when `generic`), for example data-msg-required, data-msg-min-date or data-msg-mindate. */
    function dataMessage(field, type, generic) {
        if (!field || !field.getAttribute) return '';
        if (generic) return field.getAttribute('data-msg') || '';
        const t = String(type);
        const kebab = t.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        return field.getAttribute('data-msg-' + t.toLowerCase()) || field.getAttribute('data-msg-' + kebab) || '';
    }

    // ------------------------------------------------------------------ rules
    const validators = {};
    function registerRule(name, fn, opts) {
        if (!isFn(fn)) throw new Error('registerRule: validator must be a function');
        validators[name] = { fn, runOnEmpty: !!(opts && opts.runOnEmpty), remote: !!(opts && opts.remote), raw: !!(opts && opts.raw) };   // raw: the value is not trimmed (passwords)
    }

    const R = (name, fn, o) => registerRule(name, fn, o);

    /** How `remote` rules talk to the server unless a rule says otherwise (like jQuery Validation: GET).
     *  Change globally: FormValidator.remoteDefaults.method = 'POST'  (and .encoding = 'form' for a classic form body). */
    const REMOTE_DEFAULTS = { method: 'GET', encoding: 'json' };

    R('required', (v, r, env) => !env.empty, { runOnEmpty: true });
    R('email', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
    R('url', (v, rule) => urlOk(v, rule));
    R('number', v => NUMBER_RE.test(v));
    R('digits', v => /^\d+$/.test(v));
    R('alpha', v => /^\p{L}+$/u.test(v));
    R('alphanumeric', v => /^[\p{L}\p{N}]+$/u.test(v));
    R('phone', v => /^\+?[\d\s\-().]{7,25}$/.test(v) && (v.match(/\d/g) || []).length >= 7 && (v.match(/\d/g) || []).length <= 15);
    R('date', (v, r) => r.format || r.strict ? !isNaN(dateValue(v, r)) : !isNaN(Date.parse(v)));   // format: 'd/M/yyyy' | strict: true (ISO 8601) | neither: Date.parse (legacy)
    R('minDate', (v, r) => { const a = dateValue(v, r), b = dateValue(r.min, r); return !isNaN(a) && !isNaN(b) && a >= b; });
    R('maxDate', (v, r) => { const a = dateValue(v, r), b = dateValue(r.max, r); return !isNaN(a) && !isNaN(b) && a <= b; });
    R('creditcard', v => luhn(v));
    R('pattern', (v, r) => { const re = r.pattern instanceof RegExp ? r.pattern : new RegExp(r.pattern || r.regex, r.flags || ''); re.lastIndex = 0; return re.test(v); });
    R('maxlength', (v, r) => v.length <= r.max);
    R('minlength', (v, r) => v.length >= r.min);
    R('rangelength', (v, r) => v.length >= r.min && v.length <= r.max);
    R('range', (v, r) => num(v) >= r.min && num(v) <= r.max);
    R('max', (v, r) => num(v) <= r.max);
    R('min', (v, r) => num(v) >= r.min);
    R('step', (v, r) => { const n = num(v), base = r.base || 0; if (isNaN(n)) return false; const q = (n - base) / r.step; return Math.abs(q - Math.round(q)) < 1e-9; });
    R('oneOf', (v, r) => (r.values || []).map(String).includes(v));
    R('notOneOf', (v, r) => !(r.values || []).map(String).includes(v));
    R('integer', v => /^[+-]?[0-9]+$/.test(v));
    R('uuid', v => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v));
    R('hexColor', v => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v));
    R('slug', v => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v));
    R('ipv4', v => IPV4_RE.test(v));
    R('ipv6', v => isIPv6(v));
    R('iban', v => ibanOk(v));
    R('time', v => /^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/.test(v));
    R('domain', v => v.length <= 253 && DOMAIN_RE.test(v));
    R('base64', v => /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v));
    R('mac', v => /^[0-9a-fA-F]{2}([:-])[0-9a-fA-F]{2}(?:\1[0-9a-fA-F]{2}){4}$/.test(v));
    R('latitude', v => /^[+-]?(?:90(?:\.0+)?|[0-8]?[0-9](?:\.[0-9]+)?)$/.test(v));
    R('longitude', v => /^[+-]?(?:180(?:\.0+)?|1[0-7][0-9](?:\.[0-9]+)?|[1-9]?[0-9](?:\.[0-9]+)?)$/.test(v));
    R('startsWith', (v, r) => v.startsWith(String(r.value == null ? '' : r.value)));
    R('endsWith', (v, r) => v.endsWith(String(r.value == null ? '' : r.value)));
    R('contains', (v, r) => v.includes(String(r.value == null ? '' : r.value)));
    R('minWords', (v, r) => wordCount(v) >= r.min);
    R('maxWords', (v, r) => wordCount(v) <= r.max);
    // rows of a repeater / items of an array (checkValues, schema, and wildcard rules on a form: 'items[].sku')
    const uniqueCounts = new WeakMap();
    R('unique', (v, r, env) => {   // the same value in two rows: every row that repeats it fails (empty values are not compared)
        const column = env.column || (isFn(r.columnFn) ? r.columnFn() : null);
        if (!column) return true;
        const key = r.ignoreCase ? 'i' : 's';
        let counts = uniqueCounts.get(column);   // counted once per column, so 5000 rows stay fast
        if (!counts) { counts = { i: null, s: null }; uniqueCounts.set(column, counts); }
        if (!counts[key]) {
            const m = new Map();
            column.forEach(x => { if (x === '') return; const k = r.ignoreCase ? String(x).toLowerCase() : String(x); m.set(k, (m.get(k) || 0) + 1); });
            counts[key] = m;
        }
        return (counts[key].get(r.ignoreCase ? String(v).toLowerCase() : String(v)) || 0) <= 1;
    });
    R('minItems', (v, r, env) => !env.array || env.array.length >= Number(r.min !== undefined ? r.min : r.param), { runOnEmpty: true });
    R('maxItems', (v, r, env) => !env.array || env.array.length <= Number(r.max !== undefined ? r.max : r.param), { runOnEmpty: true });
    // ------------------------------------------------------------------ masks: '(999) 999-9999' (9 = digit, a = letter, * = letter or digit, \ escapes) and the text rules in attributes
    /** Pattern -> tokens [{ t: 'digit' | 'letter' | 'alnum' | 'lit', c }] */
    function maskTokens(pattern) {
        const out = [], p = Array.from(String(pattern === null || pattern === undefined ? '' : pattern));
        for (let i = 0; i < p.length; i++) {
            const ch = p[i];
            if (ch === '\\' && i + 1 < p.length) { out.push({ t: 'lit', c: p[++i] }); continue; }
            out.push(ch === '9' ? { t: 'digit' } : ch === 'a' ? { t: 'letter' } : ch === '*' ? { t: 'alnum' } : { t: 'lit', c: ch });
        }
        return out;
    }
    const MASK_CLASS = { digit: /[0-9]/, letter: /\p{L}/u, alnum: /[\p{L}0-9]/u };
    const maskFits = (tok, ch) => MASK_CLASS[tok.t].test(ch);
    /** The characters a user typed, without the mask's own literals: 'raw' of '(555) 123' is '555123'. */
    function maskRaw(value, tokens) {
        const v = Array.from(String(value === null || value === undefined ? '' : value));
        let vi = 0, raw = '';
        for (let ti = 0; ti < tokens.length && vi < v.length; ti++) {
            const tok = tokens[ti];
            if (tok.t === 'lit') { if (v[vi] === tok.c) vi++; continue; }
            while (vi < v.length && !maskFits(tok, v[vi])) vi++;
            if (vi < v.length) raw += v[vi++];
        }
        return raw;
    }
    /** Raw characters -> the formatted text. Literals appear as soon as the next character has to follow them (or always, with trailing: true). */
    function maskFormat(raw, tokens, trailing) {
        const r = Array.from(raw);
        let ri = 0, out = '', pendingLits = '';
        for (const tok of tokens) {
            if (tok.t === 'lit') { pendingLits += tok.c; continue; }
            while (ri < r.length && !maskFits(tok, r[ri])) ri++;
            if (ri >= r.length) return trailing ? out + pendingLits : out;
            out += pendingLits + r[ri++]; pendingLits = '';
        }
        return trailing ? out + pendingLits : out;
    }
    /** The RegExp a complete masked value matches: maskPattern('(999) 999-9999') -> /^\(\d{3}\) \d{3}-\d{4}$/ */
    function maskPattern(pattern) {
        const src = maskTokens(pattern).map(t => t.t === 'lit' ? t.c.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') : t.t === 'digit' ? '[0-9]' : t.t === 'letter' ? '\\p{L}' : '[\\p{L}0-9]').join('');
        return new RegExp('^' + src + '$', 'u');
    }
    /** The typed characters of a masked value: unmaskValue('(555) 123-4567', '(999) 999-9999') -> '5551234567' */
    function unmaskValue(value, pattern) { return maskRaw(value, maskTokens(pattern)); }
    R('mask', (v, r) => { const p = r.pattern || r.param; return !p || maskPattern(p).test(v); });

    // 'required email minlength:3 pattern:^a:b$' | '["required"]' | '{"minlength":3}' -> rules (the format of data-fv attributes and <fv-field rules="">), or null
    function parseRules(text) {
        const s = String(text === null || text === undefined ? '' : text).trim();
        if (!s) return null;
        if (s.charAt(0) === '[' || s.charAt(0) === '{') {
            try { return JSON.parse(s); } catch (e) { return null; }
        }
        const map = {};
        s.split(/\s+/).forEach(tok => {
            const i = tok.indexOf(':');
            const name = i < 0 ? tok : tok.slice(0, i);
            if (!name || BAD_KEYS.indexOf(name) >= 0) return;
            map[name] = i < 0 ? true : tok.slice(i + 1);
        });
        return Object.keys(map).length ? map : null;
    }

    // rules that look at other fields: the other values come from checkValue's options.values, or from the form
    const valuesOf = env => env.values || (env.inst && isFn(env.inst.getValues) ? env.inst.getValues() : null);
    /** The other field as trimmed text (checkbox groups joined with ','), undefined when it is not known. */
    function otherText(env, name) {
        const vals = valuesOf(env);
        if (!vals || name === undefined || name === null) return undefined;
        let v = vals[name];
        if (v === undefined) { const c = canonKey(String(name)); if (c) v = vals[c]; }
        if (v === undefined) return undefined;
        return v === null ? '' : (Array.isArray(v) ? v.join(',') : String(v)).trim();
    }
    const ruleFields = r => [].concat(r.fields !== undefined ? r.fields : (r.param !== undefined ? r.param : []));
    /** Names of the other fields a rule depends on (so a form re-checks it when they change). */
    const ruleTargetNames = r => {
        if (r.type === 'equalTo' || r.type === 'notEqualTo') return r.target ? [String(r.target).replace(/^#/, '')] : [];
        if (r.type === 'requiredIf' || r.type === 'dateAfter' || r.type === 'dateBefore') return r.field ? [String(r.field)] : [];
        if (r.type === 'atLeastOne' || r.type === 'sumEquals') return ruleFields(r).map(String);
        return [];
    };
    // requiredIf: { field: 'country', equals: 'US' } | { field, in: ['US','CA'] } | { field, notEquals: 'x' } | 'country' (required whenever that field is filled in)
    R('requiredIf', (v, r, env) => {
        const other = otherText(env, r.field);
        if (other === undefined) return true;
        const applies = r.equals !== undefined ? other === String(r.equals) : Array.isArray(r.in) ? r.in.map(String).indexOf(other) >= 0 : r.notEquals !== undefined ? other !== String(r.notEquals) : other !== '';
        return !applies || v !== '';
    }, { runOnEmpty: true });
    // dateAfter / dateBefore: { field: 'start', inclusive: true, format: 'd/M/y' }  (nothing to compare with: no opinion)
    R('dateAfter', (v, r, env) => { const o = otherText(env, r.field); if (o === undefined || o === '') return true; const a = dateValue(v, r), b = dateValue(o, r); return !isNaN(a) && !isNaN(b) && (r.inclusive ? a >= b : a > b); });
    R('dateBefore', (v, r, env) => { const o = otherText(env, r.field); if (o === undefined || o === '') return true; const a = dateValue(v, r), b = dateValue(o, r); return !isNaN(a) && !isNaN(b) && (r.inclusive ? a <= b : a < b); });
    // atLeastOne: { fields: ['phone', 'email'] }: this field or one of the others must be filled in
    R('atLeastOne', (v, r, env) => v !== '' || ruleFields(r).some(n => { const t = otherText(env, n); return t !== undefined && t !== ''; }), { runOnEmpty: true });
    // sumEquals: { fields: ['b', 'c'], total: 100 }: this value plus the others add up to the total (empty counts as 0)
    R('sumEquals', (v, r, env) => {
        const parts = [v].concat(ruleFields(r).map(n => otherText(env, n) || ''));
        let sum = 0;
        for (const p of parts) { if (p === '') continue; const x = num(p); if (isNaN(x)) return false; sum += x; }
        return Math.abs(sum - Number(r.total)) < 1e-9;
    }, { runOnEmpty: true });
    const targetOf = (r, env) => r.selector ? safeQuery(env.form, r.selector) : safeQuery(env.form, `[name="${esc(r.target)}"]`);
    R('notEqualTo', (v, r, env) => { const t = targetOf(r, env); return !t || v !== t.value.trim(); });
    R('equalTo', (v, r, env) => {
        const t = targetOf(r, env);
        return !!t && v === (t.type === 'password' ? t.value : t.value.trim());
    }, { runOnEmpty: true });

    R('pwcheck', (v, r, env) => {
        const c = Object.assign({ minLength: 6 }, env.config.passwordStrength, r);
        if (c.enabled === false) return true;
        if (v.length < c.minLength) return false;
        if (c.maxLength && v.length > c.maxLength) return false;
        if (c.requireUppercase && !/\p{Lu}/u.test(v)) return false;   // capital letters of any alphabet, not only A-Z
        if (c.requireLowercase && !/\p{Ll}/u.test(v)) return false;
        if (c.requireDigit && !/\p{Nd}/u.test(v)) return false;       // digits of any script
        if (c.requireSpecialChar && !/[^\p{L}\p{N}\s]/u.test(v)) return false;   // anything that is not a letter, number or space
        if (c.noWhitespace && /\s/.test(v)) return false;
        return true;
    }, { raw: true });

    R('minChecked', (v, r, env) => env.count >= r.min, { runOnEmpty: true });
    R('maxChecked', (v, r, env) => env.count <= r.max);
    R('minFiles', (v, r, env) => env.count >= r.min, { runOnEmpty: true });
    R('maxFiles', (v, r, env) => env.count <= r.max);
    R('fileType', (v, r, env) => {
        const allowed = (r.types || []).map(t => String(t).toLowerCase());
        return (env.files || []).every(f => {
            const n = f.name.toLowerCase(), ext = n.includes('.') ? n.split('.').pop() : '';
            const mime = (f.type || '').toLowerCase();
            return allowed.some(a => a.includes('/') ? (a.endsWith('/*') ? mime.startsWith(a.slice(0, -1)) : a === mime) : a.replace(/^\./, '') === ext);
        });
    });
    R('fileSize', (v, r, env) => {
        const max = r.maxSize !== undefined ? r.maxSize : r.maxSizeMB * 1048576;
        return (env.files || []).every(f => f.size <= max);
    });
    R('file', async (v, r, env) => {
        const FV = tryFileValidator();
        if (!FV) { if (root.console) console.warn('FormValidator: "file" rule needs fileValidator.js'); return true; }
        const files = env.files || [];
        const res = await FV.validateFiles(files, r.options || r);
        if (res.isValid) return true;
        // with several files, say which one is the problem ("b.exe: ...")
        const line = FV.summary ? FV.summary(res, { fileNames: files.length > 1 })[0] : (res.details[0] && res.details[0].message);
        return { valid: false, message: line };
    });

    R('custom', (v, r, env) => {
        if (!isFn(r.validate)) { if (root.console) console.warn('FormValidator: custom rule needs a validate(value, context, field) function'); return true; }
        return r.validate(v, env.context, env.field, env);
    }, { runOnEmpty: true });

    // remote: POST/GET to a server. Response: true | "true" | { valid, message } | "error message" | false
    R('remote', async (v, r, env) => {
        if (!r.url) return true;
        const inst = env.inst, key = env.unit.key;
        const fieldKey = r.field || env.field.name;
        const method = String(r.method || REMOTE_DEFAULTS.method).toUpperCase();
        const encoding = r.encoding || REMOTE_DEFAULTS.encoding;
        const evalData = d => { const out = {}; Object.keys(d || {}).forEach(k => { out[k] = isFn(d[k]) ? d[k].call(env.field, v, env) : d[k]; }); return out; };
        const extra = isFn(r.data) ? r.data(v, env) : evalData(r.data);
        const payload = Object.assign({ [fieldKey]: v }, extra);
        const url = method === 'GET' ? r.url + (r.url.includes('?') ? '&' : '?') + new URLSearchParams(payload) : r.url;
        const cacheKey = method + ' ' + url + ' ' + (method === 'GET' ? '' : JSON.stringify(payload));
        if (r.cache !== false && inst._remoteCache.has(cacheKey)) return inst._remoteCache.get(cacheKey);

        if (inst._aborters.get(key)) inst._aborters.get(key).abort();
        const ctrl = root.AbortController ? new root.AbortController() : null;
        if (ctrl) inst._aborters.set(key, ctrl);
        const timer = ctrl ? setTimeout(() => ctrl.abort(), r.timeout || 10000) : null;
        try {
            const resp = await fetch(url, {
                method,
                headers: Object.assign(method === 'GET' ? {} : { 'Content-Type': encoding === 'form' ? 'application/x-www-form-urlencoded; charset=UTF-8' : 'application/json' }, r.headers),
                body: method === 'GET' ? undefined : (encoding === 'form' ? new URLSearchParams(payload).toString() : JSON.stringify(payload)),
                credentials: r.credentials,
                signal: ctrl ? ctrl.signal : undefined
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            let out = await resp.json();
            if (isFn(r.parse)) out = r.parse(out, resp);
            let result;
            if (out === true || out === 'true') result = true;
            else if (out && typeof out === 'object') result = { valid: !!out.valid, message: out.message };
            else if (typeof out === 'string' && out !== 'false') result = { valid: false, message: out };
            else result = false;
            if (r.cache !== false) inst._remoteCache.set(cacheKey, result);
            return result;
        } catch (e) {
            if (e && e.name === 'AbortError' && inst._aborters.get(key) !== ctrl) return true; // superseded; newer run decides
            return r.failOpen === true; // network problem: block by default
        } finally {
            if (timer) clearTimeout(timer);
            if (inst._aborters.get(key) === ctrl) inst._aborters.delete(key);
        }
    }, { remote: true });

    function normalizeResult(res) {
        let valid = res === true, message;
        if (res && typeof res === 'object') { valid = !!res.valid; message = res.message; }
        else if (typeof res === 'string' && res) { valid = false; message = res; }
        else if (res === undefined || res === null) valid = false;
        else valid = !!res;
        return { valid, message };
    }

    // ------------------------------------------------------------------ rule normalisation
    const CLASS_RULES = {};
    const methodNames = new Set();
    const numOr = v => (typeof v === 'string' && v.trim() !== '' && !isNaN(v)) ? Number(v) : v;
    const toRange = p => { const a = typeof p === 'string' ? p.replace(/[\[\]]/g, '').split(/[\s,]+/) : p; return { min: numOr(a[0]), max: numOr(a[1]) }; };
    const selectorLike = str => /^[#.\[]|[\s>:+~]/.test(str);
    const requiredSelector = /^[#.\[]|:(checked|unchecked|filled|blank|selected|visible|hidden)\b/;

    function remoteFields(o) { // jQuery style options: { url, type: 'post', data: {...}, dataFilter } -> engine options
        const r = Object.assign({}, o);
        delete r.type; delete r.dataFilter;
        if (!r.method && o.type) r.method = o.type;
        if (o.dataFilter && !r.parse) r.parse = o.dataFilter;
        return r;
    }

    /** jQuery-style scalar parameters -> engine options */
    const PARAM = {
        minlength: p => ({ min: +p }), maxlength: p => ({ max: +p }), rangelength: toRange, range: toRange,
        min: p => ({ min: numOr(p) }), max: p => ({ max: numOr(p) }), step: p => ({ step: +p }),
        minDate: p => ({ min: p }), maxDate: p => ({ max: p }),
        pattern: p => ({ pattern: p }), oneOf: p => ({ values: [].concat(p) }), notOneOf: p => ({ values: [].concat(p) }),
        startsWith: p => ({ value: p }), endsWith: p => ({ value: p }), contains: p => ({ value: p }),
        minWords: p => ({ min: +p }), maxWords: p => ({ max: +p }), minItems: p => ({ min: +p }), maxItems: p => ({ max: +p }),
        unique: p => (p && typeof p === 'object' ? p : {}),
        mask: p => (p && typeof p === 'object' ? p : { pattern: p }),
        requiredIf: p => ({ field: p }), dateAfter: p => ({ field: p }), dateBefore: p => ({ field: p }), atLeastOne: p => ({ fields: [].concat(p) }),
        equalTo: p => selectorLike(String(p)) ? { selector: p } : { target: p },
        notEqualTo: p => selectorLike(String(p)) ? { selector: p } : { target: p },
        minChecked: p => ({ min: +p }), maxChecked: p => ({ max: +p }), minFiles: p => ({ min: +p }), maxFiles: p => ({ max: +p }),
        fileType: p => ({ types: typeof p === 'string' ? p.split(/[,|\s]+/).filter(Boolean) : p }),
        fileSize: p => ({ maxSize: +p }),
        remote: p => remoteFields(typeof p === 'string' ? { url: p } : p),
        pwcheck: p => (p && typeof p === 'object' ? p : { minLength: +p })
    };

    function ruleFromMap(k, v) {
        const adapt = p => PARAM[k] ? Object.assign({ type: k }, PARAM[k](p)) : { type: k, param: p };
        if (v === true) return { type: k };
        if (isFn(v)) {
            if (k === 'required') return { type: k, when: (val, env) => !!v.call(env.field, env.field) }; // dependency
            if (k === 'custom') return { type: k, validate: v };
            return { type: k, param: v };
        }
        if (typeof v === 'string') {
            if (k === 'required' && requiredSelector.test(v)) return { type: k, when: (val, env) => !!safeQuery(env.form, v) };
            if (PARAM[k] || methodNames.has(k)) return adapt(v);
            return { type: k, message: v };                                    // email: 'Not an email'
        }
        if (Array.isArray(v) || typeof v === 'number' || v instanceof RegExp) return adapt(v);
        if (v && typeof v === 'object') {
            if ('param' in v || 'depends' in v) {                               // { param: 5, depends: fn | 'selector' }
                const r = v.param !== undefined ? adapt(v.param) : { type: k };
                if (v.message) r.message = v.message;
                const d = v.depends;
                if (typeof d === 'string') r.when = (val, env) => !!safeQuery(env.form, d);
                else if (isFn(d)) r.when = (val, env) => !!d.call(env.field, env.field);
                return r;
            }
            if (k === 'remote') return Object.assign({ type: 'remote' }, remoteFields(v));
            return Object.assign({ type: k }, v);
        }
        return { type: k };
    }

    function normalizeRules(input) {
        if (!input) return [];
        if (typeof input === 'string') return [{ type: input }];
        if (Array.isArray(input)) return input.map(x => typeof x === 'string' ? { type: x } : x).filter(Boolean);
        if (input.type) return [input];
        // map shorthand: { required: true, minlength: 3, range: [1, 5], equalTo: '#pw', remote: '/check', email: 'Not an email' }
        const keys = Object.keys(input).filter(k => input[k] !== false && k !== 'normalizer' && k !== 'messages');
        const list = keys.map(k => ruleFromMap(k, input[k]));
        if (isFn(input.normalizer)) list.forEach(r => { r.normalizer = input.normalizer; });
        if (input.messages && typeof input.messages === 'object') list.forEach(r => { if (!r.message && input.messages[r.type]) r.message = input.messages[r.type]; });
        const first = list.filter(r => r.type === 'required'), last = list.filter(r => r.type === 'remote');
        return first.concat(list.filter(r => r.type !== 'required' && r.type !== 'remote'), last); // like jQuery: required first, remote last
    }

    /** params for {0}, {1} placeholders and jQuery-style message functions */
    function paramsOf(rule) {
        if (rule.param !== undefined) return [].concat(rule.param);
        if ('min' in rule && 'max' in rule) return [rule.min, rule.max];
        if ('min' in rule) return [rule.min];
        if ('max' in rule) return [rule.max];
        if ('step' in rule) return [rule.step];
        return [];
    }

    function format(source, params) { // like $.validator.format
        if (arguments.length === 1) return function () { return format.apply(null, [source].concat(Array.from(arguments))); };
        if (params === undefined) return source;
        if (arguments.length > 2 && !Array.isArray(params)) params = Array.from(arguments).slice(1);
        if (!Array.isArray(params)) params = [params];
        return params.reduce((out, n, i) => out.replace(new RegExp('\\{' + i + '\\}', 'g'), () => n), source);
    }

    /** jQuery-style custom method:  addMethod('even', function (value, element, param) { return this.optional(element) || value % 2 === 0; }, 'Even numbers only') */
    function addMethod(name, fn, message) {
        if (!isFn(fn)) throw new Error('addMethod: the method must be a function');
        methodNames.add(name);
        registerRule(name, function (value, rule, env) {
            const ps = paramsOf(rule);
            const ctx = {
                form: env.form, field: env.field, format,
                optional: el => (!el || el === env.field) ? env.empty : env.inst.readValue(env.inst.unitOf(el) || { key: el, fields: [el] }).empty,
                elementValue: el => env.inst.readValue(env.inst.unitOf(el) || { key: el, fields: [el] }).value
            };
            const res = fn.call(ctx, value, env.field, ps.length > 1 ? ps : ps[0], env);
            return (res === 'dependency-mismatch' || res === 'pending') ? true : res;
        }, { runOnEmpty: true }); // like jQuery: the method decides for empty values itself, via this.optional(element)
        if (message !== undefined) DEFAULT_MESSAGES[name] = isFn(message) ? (field, rule) => { const ps = paramsOf(rule); return message(ps.length > 1 ? ps : ps[0], field); } : message;
    }

    function addClassRules(name, rules) {
        if (typeof name === 'string') CLASS_RULES[name] = rules; else Object.assign(CLASS_RULES, name);
    }

    // ------------------------------------------------------------------ instance
    const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

    const VALIDATE_ON_PRESETS = { smart: ['change'], 'default': ['change'], change: ['change'], blur: ['blur'], input: ['input'], submit: [], all: ['change', 'blur', 'input'] };

    /** Options of the wrong type fall back to the defaults: a bad config must not crash the page when an error is shown. */
    function sanitizeConfig(cfg) {
        if (typeof cfg.errorElement !== 'string' || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(cfg.errorElement)) cfg.errorElement = DEFAULTS.errorElement;
        ['errorClass', 'invalidClass', 'pendingClass', 'validClass'].forEach(k => { if (typeof cfg[k] !== 'string') cfg[k] = k === 'errorClass' ? DEFAULTS.errorClass : ''; });
        const preset = typeof cfg.validateOn === 'string' ? VALIDATE_ON_PRESETS[cfg.validateOn.toLowerCase()] : null;
        cfg.validateOn = preset ? preset.slice() : Array.isArray(cfg.validateOn) ? cfg.validateOn.filter(e => typeof e === 'string') : DEFAULTS.validateOn.slice();
        if (typeof cfg.debounce !== 'number' || !isFinite(cfg.debounce) || cfg.debounce < 0) cfg.debounce = DEFAULTS.debounce;
        ['ignore', 'skipSubmitter'].forEach(k => {
            if (typeof cfg[k] !== 'string' || !cfg[k].trim()) { cfg[k] = null; return; }
            try { root.document.createDocumentFragment().querySelector(cfg[k]); } catch (e) { cfg[k] = null; }   // an invalid selector
        });
        ['errorPlacement', 'submitHandler', 'onError', 'onSuccess', 'highlight', 'unhighlight', 'onFieldValid', 'fieldRules', 'resolveMessage'].forEach(k => { if (!isFn(cfg[k])) cfg[k] = null; });
        if (!isObj(cfg.classRules)) cfg.classRules = null;
        return cfg;
    }

    function createInstance(form, opts) {
        const userConfig = isObj(opts.config) ? opts.config : {};
        const cfg = sanitizeConfig(Object.assign({}, DEFAULTS, userConfig));
        if (typeof userConfig.validateOn === 'string' && userConfig.validateOn.toLowerCase() === 'blur' && !('skipEmptyUntilSubmit' in userConfig)) cfg.skipEmptyUntilSubmit = true;   // 'blur' does not nag fields the user only tabbed through
        cfg.passwordStrength = Object.assign({}, DEFAULTS.passwordStrength, isObj(userConfig.passwordStrength) ? userConfig.passwordStrength : null);
        const rawMessages = Object.assign({}, isObj(userConfig.messages) ? userConfig.messages : null, isObj(opts.messages) ? opts.messages : null);
        cfg.messages = {};                 // by rule type
        const fieldMessages = {};          // by field name: { name: 'text' } or { name: { required: 'text' } }
        Object.keys(rawMessages).forEach(k => {
            const v = rawMessages[k], isType = k in DEFAULT_MESSAGES || !!validators[k];
            if ((v && typeof v === 'object') || !isType) fieldMessages[k] = v; else cfg.messages[k] = v;
        });
        if (cfg.unobtrusive) {   // the class names MVC's CSS and Razor helpers already use
            if (!('errorElement' in userConfig)) cfg.errorElement = 'span';
            if (!('errorClass' in userConfig)) cfg.errorClass = 'field-validation-error';
            if (!('invalidClass' in userConfig)) cfg.invalidClass = 'input-validation-error';
            if (!('validClass' in userConfig)) cfg.validClass = 'input-validation-valid';
            if (!('rewardOnInput' in userConfig)) cfg.rewardOnInput = false;
        }
        const context = Object.assign({}, opts.context, { form });

        const inst = {
            form, config: cfg, context,
            rules: {},
            _errors: new Map(),        // unit.key -> { el, message, unit }
            _tokens: new Map(),
            _aborters: new Map(),
            _remoteCache: new Map(),
            _serverNames: new Set(),
            _serverToken: 0,
            _serverAbort: null,
            _listeners: [],
            _timers: new Map(),
            _busy: false, _bypass: false, _submitted: false,
            _pending: new Map(), fieldMessages,
            _touched: new Set(), _initial: null, _submitCount: 0, _stateSubs: new Set()
        };
        Object.keys(opts.rules || {}).forEach(n => { inst.rules[n] = normalizeRules(opts.rules[n]); });

        // ---- units: one per radio/checkbox group, one per individual element otherwise
        function unitsOf(els) {
            const grouped = els.filter(e => e.type === 'radio' || e.type === 'checkbox');
            const units = els.filter(e => !(e.type === 'radio' || e.type === 'checkbox')).map(e => ({ key: e, fields: [e] }));
            if (grouped.length) units.unshift({ key: grouped[0], fields: grouped });
            return units;
        }
        function unitsFor(name) { return unitsOf(Array.from(form.querySelectorAll(`[name="${esc(name)}"]`))); }
        let wildCache = null;   // the wildcard rule keys; reset whenever rules are added, replaced or removed
        const wildKeys = () => wildCache || (wildCache = Object.keys(inst.rules).filter(k => hasPathChars(k) && (ruleTokens(k) || []).some(isWild)));
        /** Does the field name 'items[2].qty' (or 'items.2.qty') belong to the wildcard rule key 'items[].qty'? */
        function nameMatchesKey(name, key) {
            const nt = ruleTokens(name), kt = ruleTokens(key);
            return !!nt && !!kt && nt.length === kt.length && kt.every((t, i) => (isWild(t) ? typeof nt[i] === 'number' : t === nt[i]));
        }
        function wildcardRulesFor(name) {
            const out = [];
            wildKeys().forEach(key => {
                if (name === key || !nameMatchesKey(name, key)) return;
                inst.rules[key].forEach(r => {
                    if (r.type !== 'unique') { out.push(r); return; }
                    // the other rows of the same column: every field whose name matches the wildcard key
                    out.push(Object.assign({}, r, { columnFn: () => Array.from(form.elements).filter(el => el.name && !/^(radio|checkbox|file|button|submit|reset|image)$/.test(el.type) && nameMatchesKey(el.name, key)).map(el => String(el.value == null ? '' : el.value).trim()) }));
                });
            });
            return out;
        }
        function names() {
            const set = new Set(Object.keys(inst.rules));
            const wild = wildKeys();
            if (wild.length) {
                wild.forEach(k => { if (!Array.from(form.elements).some(e => e.name === k)) set.delete(k); });   // PHP-style 'items[]' that is a real field name stays a plain name
                Array.from(form.elements).forEach(e => { if (e.name && wild.some(k => nameMatchesKey(e.name, k))) set.add(e.name); });
            }
            if (cfg.autoRules || isFn(cfg.fieldRules) || hasClassRules()) {
                Array.from(form.elements).forEach(e => {
                    if (e.name && e.tagName !== 'FIELDSET' && !['button', 'submit', 'reset', 'image'].includes(e.type)) set.add(e.name);
                });
            } else if (cfg.unobtrusive) {
                Array.from(form.elements).forEach(e => { if (e.name && e.getAttribute('data-val') === 'true') set.add(e.name); });
            }
            return Array.from(set);
        }
        function allUnits() {   // one pass over the form instead of one query per field name
            const nm = names();
            const groups = new Map();
            Array.from(form.querySelectorAll('[name]')).forEach(el => { const n = el.getAttribute('name'); const g = groups.get(n); if (g) g.push(el); else groups.set(n, [el]); });
            return [].concat(...nm.map(n => unitsOf(groups.get(n) || [])));
        }

        const hasClassRules = () => Object.keys(CLASS_RULES).length > 0 || (cfg.classRules && Object.keys(cfg.classRules).length > 0);

        function classRulesFor(f) {
            const map = Object.assign({}, CLASS_RULES, cfg.classRules), out = [];
            String(typeof f.className === 'string' ? f.className : '').split(/\s+/).forEach(c => { if (c && Object.prototype.hasOwnProperty.call(map, c)) out.push(...normalizeRules(map[c])); });
            return out;
        }

        function attributeRules(f) {
            const r = [], t = (f.type || '').toLowerCase(), get = a => f.getAttribute(a);
            if (f.hasAttribute('required')) r.push({ type: 'required' });
            if (t === 'email') r.push({ type: 'email' });
            if (t === 'url') r.push({ type: 'url' });
            if (t === 'number' || t === 'range') r.push({ type: 'number' });
            if (t === 'date') r.push({ type: 'date' });
            if (f.hasAttribute('minlength')) r.push({ type: 'minlength', min: +get('minlength') });
            if (f.hasAttribute('maxlength')) r.push({ type: 'maxlength', max: +get('maxlength') });
            if (t === 'number' || t === 'range') {
                if (f.hasAttribute('min')) r.push({ type: 'min', min: +get('min') });
                if (f.hasAttribute('max')) r.push({ type: 'max', max: +get('max') });
            }
            if (f.hasAttribute('pattern')) {
                let re; try { re = new RegExp('^(?:' + get('pattern') + ')$', 'u'); } catch (e) { try { re = new RegExp('^(?:' + get('pattern') + ')$'); } catch (e2) { re = null; } }
                if (re) r.push({ type: 'pattern', pattern: re, message: f.getAttribute('title') || undefined });
            }
            if (t === 'file' && f.hasAttribute('accept')) r.push({ type: 'file', accept: get('accept') });
            Array.from(f.attributes).forEach(a => {                       // data-rule-minlength="3", data-rule-range="[1,5]", data-rule-required
                if (a.name.indexOf('data-rule-') !== 0) return;
                const key = a.name.slice(10).replace(/-/g, '');
                const type = Object.keys(validators).find(n => n.toLowerCase() === key);
                if (!type) return;
                let v = a.value;
                if (v === '' || v === 'true') v = true;
                else if (v === 'false') return;
                else { try { v = JSON.parse(v); } catch (e) { /* keep the text, e.g. #password */ } }
                r.push(ruleFromMap(type, v));
            });
            return r;
        }

        /** The rules ASP.NET rendered into data-val-* attributes of a field (data-val="true"), through the adapters of FormValidator.unobtrusive.adapters. */
        function dataValRules(f) {
            if (f.getAttribute('data-val') !== 'true') return [];
            const name = f.name || '', prefix = name.slice(0, name.lastIndexOf('.') + 1), attrs = {}, out = [];
            Array.from(f.attributes).forEach(a => { attrs[a.name.toLowerCase()] = a.value; });
            Object.keys(attrs).forEach(k => {
                const m = /^data-val-([a-z0-9_]+)$/.exec(k);
                if (m && !UNOB[m[1]] && !unobWarned.has(m[1])) { unobWarned.add(m[1]); if (root.console) console.warn('FormValidator unobtrusive: no adapter for data-val-' + m[1] + ' (add one with FormValidator.unobtrusive.adapters.add); it is ignored.'); }
            });
            Object.keys(UNOB).forEach(adapter => {
                const attr = 'data-val-' + adapter;
                if (!(attr in attrs)) return;
                const def = UNOB[adapter], options = { element: f, form, prefix, collect: collectValues, message: attrs[attr] || undefined, params: {}, rules: {}, messages: {} };
                def.params.forEach(p => { options.params[p] = attrs[attr + '-' + p.toLowerCase()]; });
                try { def.fn(options); } catch (e) { if (root.console) console.error('FormValidator unobtrusive: the adapter "' + adapter + '" threw:', e); return; }
                Object.keys(options.rules).forEach(rn => {
                    if (!validators[rn]) { if (root.console && !unobWarned.has('rule:' + rn)) { unobWarned.add('rule:' + rn); console.warn('FormValidator unobtrusive: the adapter "' + adapter + '" uses the rule "' + rn + '" which is not registered (FormValidator.addMethod / registerRule); it is ignored.'); } return; }
                    const v = options.rules[rn];
                    const r = typeof v === 'string' && !PARAM[rn] && !methodNames.has(rn) ? { type: rn, param: v } : ruleFromMap(rn, v);   // a text value is a parameter here, never a message
                    if (options.messages[rn]) r.message = options.messages[rn];
                    out.push(r);
                });
            });
            return out;
        }
        const valmsgFor = f => (cfg.unobtrusive && f && f.name ? form.querySelector('[data-valmsg-for="' + esc(f.name) + '"]') : null);

        function rulesFor(unit) {
            const explicit = (inst.rules[unit.fields[0].name] || []).concat(wildKeys().length ? wildcardRulesFor(unit.fields[0].name) : []);
            if (!cfg.autoRules && !cfg.unobtrusive && !isFn(cfg.fieldRules) && !hasClassRules()) return explicit;
            const merged = new Map();  // later sources win per rule type: class < attributes / data-rule < data-val < fieldRules
            classRulesFor(unit.fields[0]).concat(cfg.autoRules ? attributeRules(unit.fields[0]) : [], cfg.unobtrusive ? dataValRules(unit.fields[0]) : [],
                isFn(cfg.fieldRules) ? normalizeRules(guard(cfg.fieldRules, [], unit.fields[0], unit)) : []).forEach(r => merged.set(r.type, r));
            const derived = Array.from(merged.values()).filter(a => !explicit.some(e => e.type === a.type));
            return derived.concat(explicit);
        }

        function readEnv(unit) {
            const first = unit.fields[0], type = first.type;
            let value, empty, count = 0, files = null, badInput = false;
            if (type === 'file') {
                files = Array.from(first.files || []); count = files.length; empty = !count;
                value = files.map(f => f.name).join(', ');
            } else if (type === 'checkbox' || type === 'radio') {
                const on = unit.fields.filter(f => f.checked);
                count = on.length; empty = !count; value = on[0] ? on[0].value : '';
            } else if (first.tagName === 'SELECT' && first.multiple) {
                const sel = Array.from(first.selectedOptions).filter(o => o.value !== '');
                count = sel.length; empty = !count; value = sel[0] ? sel[0].value : '';
            } else {
                const raw = first.value == null ? '' : first.value;
                value = (type === 'password' || cfg.trim === false) ? raw : raw.trim();
                empty = value === ''; count = empty ? 0 : 1;
                if (first.validity && first.validity.badInput) { badInput = true; empty = false; count = 1; } // e.g. letters typed into type=number
            }
            return { badInput, value, empty, count, files, field: first, fields: unit.fields, unit, form, config: cfg, context, inst };
        }

        /**
         * The values of the form as an object, ready to send (JSON, fetch, axios, $.ajax): text is trimmed like the validation saw it (passwords are not),
         * a checkbox group and a multiple select give an array, a radio group its chosen value, a file field the File objects. Like a native submit, unchecked
         * checkboxes and unchosen radios are left out and disabled fields are skipped.
         */
        function collectValues() {
            const out = {}, groups = new Map();
            Array.from(form.elements).forEach(el => {
                if (!el.name || el.disabled || el.tagName === 'FIELDSET' || ['submit', 'button', 'reset', 'image'].includes(el.type)) return;
                if (el.hasAttribute('data-fv-trap') || (stampEl && el === stampEl) || (idemEl && el === idemEl)) return;   // our own hidden fields are not form values
                if (!groups.has(el.name)) groups.set(el.name, []);
                groups.get(el.name).push(el);
            });
            groups.forEach((els, name) => {
                const first = els[0], type = first.type;
                if (type === 'file') out[name] = els.reduce((all, e) => all.concat(Array.from(e.files || [])), []);
                else if (type === 'checkbox') { const on = els.filter(e => e.checked).map(e => e.value); if (els.length > 1) out[name] = on; else if (on.length) out[name] = on[0]; }
                else if (type === 'radio') { const on = els.find(e => e.checked); if (on) out[name] = on.value; }
                else if (first.tagName === 'SELECT' && first.multiple) out[name] = Array.from(first.selectedOptions).map(o => o.value);
                else {
                    const vals = els.map(e => { const raw = e.value == null ? '' : e.value; return (e.type === 'password' || cfg.trim === false) ? raw : raw.trim(); });
                    out[name] = vals.length > 1 ? vals : vals[0];
                }
            });
            return out;
        }

        function isActive(unit) {
            if (unit.fields.every(f => f.disabled)) return false;
            if (cfg.ignore) { try { if (unit.fields[0].matches(cfg.ignore)) return false; } catch (e) { /* invalid selector */ } }
            if (cfg.validateHidden) return true;
            return unit.fields.some(f => f.type !== 'hidden' && f.getClientRects().length > 0);
        }

        // ---- messages
        function resolveMessage(rule, env, dynamic) {
            if (isFn(cfg.resolveMessage)) { const custom = guard(cfg.resolveMessage, '', rule, env, dynamic); if (custom) return custom; }
            let m = rule.serverMessage && dynamic ? dynamic : rule.message;   // [Remote]: the text the server answers wins over the attribute's
            if (isFn(m)) m = guard(m, '', env.field, rule, env);
            if (!m) { const fm = fieldMessages[env.field.name]; m = fm && (typeof fm === 'string' || isFn(fm) ? fm : fm[rule.type]); } // messages: { email: { required: '...' } }
            if (!m) m = dataMessage(env.field, rule.type, false);         // data-msg-required="..." (like jQuery Validation)
            if (!m) m = dynamic;
            if (!m) m = dataMessage(env.field, rule.type, true);          // data-msg="..." : one message for every rule of the field
            if (!m) m = cfg.messages[rule.type] || DEFAULT_MESSAGES[rule.type] || 'Invalid value.';
            if (isFn(m)) m = guard(m, '', env.field, rule, env);
            const ps = paramsOf(rule);
            return fmt(m, rule).replace(/\{(\d+)\}/g, (x, i) => (ps[i] !== undefined ? ps[i] : x));
        }

        // ---- error display
        function place(err, unit) {
            const first = unit.fields[0], last = unit.fields[unit.fields.length - 1];
            const slot = valmsgFor(first);   // ASP.NET: <span data-valmsg-for="Email" class="field-validation-valid">
            if (slot) {
                slot.classList.remove('field-validation-valid'); slot.classList.add('field-validation-error');
                if (slot.getAttribute('data-valmsg-replace') !== 'false') { while (slot.firstChild) slot.removeChild(slot.firstChild); } else err.hidden = true;   // replace=false keeps your static text; the message stays reachable for screen readers
                slot.appendChild(err);
                return;
            }
            if (isFn(cfg.errorPlacement)) {
                try { cfg.errorPlacement(err, first, unit.fields); return; }
                catch (e) { if (root.console) console.error('FormValidator: an error in your errorPlacement was ignored, using the default placement:', e); }
            }

            if (first.type === 'radio' || first.type === 'checkbox') {
                const container = first.closest(GROUP_CONTAINERS);
                const anchor = container || last.closest('.form-check') || last.closest('label') || last;
                return anchor.insertAdjacentElement('afterend', err);
            }
            const next = first.nextElementSibling; // Select2 container
            if (first.tagName === 'SELECT' && next && next.classList.contains('select2')) return next.insertAdjacentElement('afterend', err);

            const wrap = first.closest('.input-group') || first.closest('.form-floating');
            (wrap || first).insertAdjacentElement('afterend', err);
        }

        function removeError(unit) {
            const rec = inst._errors.get(unit.key);
            if (rec) { rec.el.remove(); inst._errors.delete(unit.key); refreshSummary(); scheduleState(); }
            const slot = valmsgFor(unit.fields[0]);
            if (slot) {
                slot.classList.remove('field-validation-error'); slot.classList.add('field-validation-valid');
                if (slot.getAttribute('data-valmsg-replace') !== 'false') while (slot.firstChild) slot.removeChild(slot.firstChild);
            }
            unit.fields.forEach(f => {
                if (cfg.validClass) cfg.validClass.split(/\s+/).forEach(c => c && f.classList.remove(c));
                if (isFn(cfg.unhighlight)) guard(cfg.unhighlight, undefined, f, unit);
                if (cfg.invalidClass) cfg.invalidClass.split(/\s+/).forEach(c => c && f.classList.remove(c));
                f.removeAttribute('aria-invalid');
                if (rec) {
                    const ids = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(i => i && i !== rec.el.id);
                    ids.length ? f.setAttribute('aria-describedby', ids.join(' ')) : f.removeAttribute('aria-describedby');
                }
            });
        }

        function showError(unit, message, code) {
            removeError(unit);
            const err = root.document.createElement(cfg.errorElement);
            err.setAttribute('data-code', code || 'custom');
            err.className = cfg.errorClass;
            err.id = 'fv-error-' + (++uid);
            err.setAttribute('data-error-for', unit.fields[0].name);
            err.setAttribute('dir', 'auto');
            // role="alert" is not allowed on <label> (ARIA); the field's aria-describedby makes screen readers read the message on focus anyway
            if (err.tagName === 'LABEL') err.setAttribute('aria-live', 'polite'); else err.setAttribute('role', 'alert');
            if (err.tagName === 'LABEL' && unit.fields[0].id) err.setAttribute('for', unit.fields[0].id);
            err.textContent = message;
            place(err, unit);
            inst._errors.set(unit.key, { el: err, message, unit, code: code || 'custom' });
            refreshSummary();
            scheduleState();
            unit.fields.forEach(f => {
                if (isFn(cfg.highlight)) guard(cfg.highlight, undefined, f, unit);
                if (cfg.invalidClass) cfg.invalidClass.split(/\s+/).forEach(c => c && f.classList.add(c));
                f.setAttribute('aria-invalid', 'true');
                f.setAttribute('aria-describedby', ((f.getAttribute('aria-describedby') || '') + ' ' + err.id).trim());
            });
        }

        // ---- validation
        /** The stable code of a failed rule: its type ('required', 'email', 'minlength' ...) unless the rule carries its own `code` ('coupon.expired'). */
        const codeOf = rule => (typeof rule.code === 'string' && rule.code ? rule.code : rule.type);
        const valueFor = (rule, env) => { if (!isFn(rule.normalizer)) return env.value; const v = guard(function () { return rule.normalizer.call(env.field, env.value, env.field); }, env.value); return typeof v === 'string' ? v : String(v); };

        function setPending(unit, on) {
            if (!cfg.pendingClass) return;
            const n = (inst._pending.get(unit.key) || 0) + (on ? 1 : -1);
            inst._pending.set(unit.key, Math.max(0, n));
            scheduleState();
            if (on && n === 1) unit.fields.forEach(f => { cfg.pendingClass.split(/\s+/).forEach(c => c && f.classList.add(c)); f.setAttribute('aria-busy', 'true'); });
            if (!on && n <= 0) unit.fields.forEach(f => { cfg.pendingClass.split(/\s+/).forEach(c => c && f.classList.remove(c)); f.removeAttribute('aria-busy'); });
        }

        async function validateUnit(unit, o) {
            o = o || {};
            const rules = rulesFor(unit);
            if (!rules.length) return true;
            const token = (inst._tokens.get(unit.key) || 0) + 1;
            inst._tokens.set(unit.key, token);

            if (!isActive(unit)) { removeError(unit); return true; }
            const env = readEnv(unit);

            if (env.badInput) { showError(unit, cfg.messages.badInput || DEFAULT_MESSAGES.badInput, 'badInput'); return false; }

            let pending = false;
            try {
                for (const rule of rules) {
                    const def = validators[rule.type];
                    if (!def) { if (root.console) console.warn('FormValidator: unknown rule "' + rule.type + '"'); continue; }
                    if (isFn(rule.when) && !guard(rule.when, true, env.value, env)) continue;   // a throwing `when` counts as "applies"
                    if (env.empty && !def.runOnEmpty) continue;
                    if (def.remote && o.event === 'input') continue;

                    let res;
                    try {
                        res = def.fn(valueFor(rule, env), rule, env);
                        if (res && isFn(res.then)) { if (!pending) { pending = true; setPending(unit, true); } res = await res; }
                    } catch (e) { if (root.console) console.error(e); res = false; }

                    if (inst._tokens.get(unit.key) !== token) return !inst._errors.has(unit.key); // a newer run owns the state

                    const r = normalizeResult(res);
                    if (!r.valid) { showError(unit, resolveMessage(rule, env, r.message), codeOf(rule)); return false; }
                }
                removeError(unit);
                if (!env.empty) markValid(unit, true);
                if (isFn(cfg.onFieldValid)) guard(cfg.onFieldValid, undefined, unit.fields[0], unit);
                return true;
            } finally {
                if (pending) setPending(unit, false);
            }
        }

        /** Synchronous check. Rules that answer asynchronously (remote, file, async custom) count as valid for now;
         *  their result updates the UI when it arrives. This is what jQuery Validation's valid() semantics need. */
        function validateUnitSync(unit, o) {
            o = o || {};
            const rules = rulesFor(unit);
            if (!rules.length) return true;
            const token = (inst._tokens.get(unit.key) || 0) + 1;
            inst._tokens.set(unit.key, token);

            if (!isActive(unit)) { removeError(unit); return true; }
            const env = readEnv(unit);
            if (env.badInput) { showError(unit, cfg.messages.badInput || DEFAULT_MESSAGES.badInput, 'badInput'); return false; }

            for (const rule of rules) {
                const def = validators[rule.type];
                if (!def) { if (root.console) console.warn('FormValidator: unknown rule "' + rule.type + '"'); continue; }
                if (isFn(rule.when) && !guard(rule.when, true, env.value, env)) continue;   // a throwing `when` counts as "applies"
                if (env.empty && !def.runOnEmpty) continue;
                if (def.remote && o.event === 'input') continue;

                let res;
                try { res = def.fn(valueFor(rule, env), rule, env); }
                catch (e) { if (root.console) console.error(e); res = false; }

                if (res && isFn(res.then)) {
                    res.then(late => {
                        if (inst._tokens.get(unit.key) !== token) return;
                        const lr = normalizeResult(late);
                        if (!lr.valid) showError(unit, resolveMessage(rule, env, lr.message), codeOf(rule));
                    }).catch(() => { /* a failed async check stays "pending" in sync mode */ });
                    continue;
                }
                const r = normalizeResult(res);
                if (!r.valid) { showError(unit, resolveMessage(rule, env, r.message), codeOf(rule)); return false; }
            }
            removeError(unit);
            if (!env.empty) markValid(unit, true);
            if (isFn(cfg.onFieldValid)) guard(cfg.onFieldValid, undefined, unit.fields[0], unit);
            return true;
        }

        function finishAll(units, results, o) {
            const invalid = units.filter((u, i) => !results[i] && inst._errors.has(u.key));
            const ok = results.every(Boolean);
            if (!ok) {
                invalid.sort((a, b) => (a.fields[0].compareDocumentPosition(b.fields[0]) & 4) ? -1 : 1);
                const list = invalid.map(u => ({ name: u.fields[0].name, field: u.fields[0], message: inst._errors.get(u.key).message, code: inst._errors.get(u.key).code }));
                renderValSummary();
                const summaryFocus = !!summaryCfg && summaryCfg.focus === 'summary' && (!o || o.focus !== false) && cfg.focusInvalid;
                if (summaryCfg && (o && (o.submit || o.summary) || inst._submitted)) renderSummary(summaryFocus);
                if (cfg.focusInvalid && invalid[0] && !summaryFocus && (!o || o.focus !== false)) { // after the list: focus handlers may clear errors
                    const f = invalid[0].fields[0];
                    try { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
                    catch (e) { /* not focusable */ }
                }
                if (isFn(cfg.onError)) guard(cfg.onError, undefined, list);
                emit('fv:invalid', { errors: list });
            } else {
                if (isFn(cfg.onSuccess)) guard(cfg.onSuccess, undefined);
                if (summaryEl) renderSummary(false);
                renderValSummary();
                emit('fv:valid', {});
            }
            return ok;
        }

        async function validateAll(o) {
            if (o && o.submit) { inst._submitted = true; inst._submitCount++; scheduleState(); }
            const units = allUnits();
            const results = await Promise.all(units.map(u => validateUnit(u, o)));
            return finishAll(units, results, o);
        }

        function validateAllSync(o) {
            if (o && o.submit) { inst._submitted = true; inst._submitCount++; scheduleState(); }
            const units = allUnits();
            return finishAll(units, units.map(u => validateUnitSync(u, o)), o);
        }

        function emit(type, detail) {
            if (typeof root.CustomEvent === 'function') form.dispatchEvent(new root.CustomEvent(type, { bubbles: true, detail }));
        }

        function unitOf(el) {
            if (!el || !el.name || !names().includes(el.name)) return null;
            if (el.type === 'radio' || el.type === 'checkbox') return unitsFor(el.name).find(u => u.fields.includes(el)) || null;
            return { key: el, fields: [el] };
        }

        // ---- listeners
        function listen(el, type, fn, opt) { el.addEventListener(type, fn, opt); inst._listeners.push(() => el.removeEventListener(type, fn, opt)); }

        function attach() {
            if (cfg.novalidate) { inst._hadNoValidate = form.noValidate; form.noValidate = true; }

            // Delegated on the form, so fields added or replaced later are covered automatically.
            function dependents(el) { // fields whose rule compares against this one (equalTo / notEqualTo / dependsOn)
                const out = [];
                Object.keys(inst.rules).forEach(n => {
                    const hit = r => ((r.type === 'equalTo' || r.type === 'notEqualTo') && (r.target === el.name || (r.selector && safeMatches(el, r.selector))))
                        || (r.dependsOn && safeMatches(el, r.dependsOn)) || ruleTargetNames(r).indexOf(el.name) >= 0;
                    if (inst.rules[n].some(hit)) out.push(...unitsFor(n));
                });
                if (isFn(cfg.fieldRules)) { // rules that come from fieldRules() are not stored in inst.rules
                    allUnits().forEach(u => {
                        if (out.some(o => o.key === u.key)) return;
                        if (normalizeRules(guard(cfg.fieldRules, [], u.fields[0], u)).some(r => r.dependsOn && safeMatches(el, r.dependsOn))) out.push(u);
                    });
                }
                return out;
            }

            // While a pointer is down, a blur-triggered re-check must not add or remove messages: the page would shift under the
            // pointer and the click would land on the wrong element. Those updates wait until the click is over.
            const D = root.document;
            let pointerDown = false;
            const deferred = new Map();
            inst._deferred = deferred;
            const flush = () => { const fns = Array.from(deferred.values()); deferred.clear(); fns.forEach(fn => fn()); };
            const pointerUp = () => { if (pointerDown) { pointerDown = false; setTimeout(flush, 150); } };
            if (D) {
                [['pointerdown', () => { pointerDown = true; }], ['pointerup', pointerUp], ['pointercancel', pointerUp],
                    ['click', () => { if (deferred.size) { pointerDown = false; setTimeout(flush, 0); } }]].forEach(([t, fn]) => {
                    D.addEventListener(t, fn, true);
                    inst._listeners.push(() => D.removeEventListener(t, fn, true));
                });
            }
            const later = (key, fn) => { if (pointerDown) deferred.set(key, fn); else fn(); };

            const onEvent = evt => {
                const el = evt.target;
                const type = evt.type === 'focusout' ? 'blur' : evt.type;
                if (!el || !el.name) return;
                if (type === 'blur') inst._touched.add(el.name);
                scheduleState();
                const unit = unitOf(el);

                dependents(el).forEach(d => { // works even when `el` has no rules of its own
                    if (unit && d.key === unit.key) return;
                    const shown = inst._errors.has(d.key);
                    if (shown || (type !== 'input' && !readEnv(d).empty)) later(d.key, () => validateUnit(d, { event: type }));
                });
                if (!unit) return;

                if (type === 'input' && cfg.liveInput === false) return;
                const hasErr = inst._errors.has(unit.key);
                const afterSubmit = inst._submitted && cfg.validateAfterSubmit;
                if (type === 'input' && !hasErr && !afterSubmit && !cfg.validateOn.includes('input')) {
                    // reward early: a valid value earns the valid class while typing; an error is never shown until the user leaves the field
                    if (cfg.validClass && cfg.rewardOnInput !== false) {
                        clearTimeout(inst._timers.get(unit.key));
                        inst._timers.set(unit.key, setTimeout(() => { const ok = peekValid(unit); if (ok === true) markValid(unit, true); else markValid(unit, false); }, cfg.debounce || 0));
                    }
                    return;
                }
                if (!hasErr && !afterSubmit && !cfg.validateOn.includes(type)) return;
                if (!hasErr && cfg.skipEmptyUntilSubmit && !inst._submitted && readEnv(unit).empty) return;
                clearTimeout(inst._timers.get(unit.key));
                const run = () => validateUnit(unit, { event: type });
                if (type === 'input' && cfg.debounce) inst._timers.set(unit.key, setTimeout(() => later(unit.key, run), cfg.debounce));
                else later(unit.key, run);
            };
            ['input', 'change', 'focusout'].forEach(t => listen(form, t, onEvent));
            if (root.jQuery) { // Select2 triggers jQuery-only change events
                const $form = root.jQuery(form), ns = 'change.fv' + (++uid);
                $form.on(ns, 'select', e => onEvent({ type: 'change', target: e.target }));
                inst._listeners.push(() => $form.off(ns));
            }

            if (cfg.focusCleanup) listen(form, 'focusin', e => { const u = unitOf(e.target); if (u && inst._errors.has(u.key)) removeError(u); });

            // capture phase: we see the submit first and can hide invalid submits from other handlers
            if (cfg.interceptSubmit !== false) listen(form, 'submit', e => {
                if (inst._bypass) return;
                if (e.submitter && e.submitter.hasAttribute && e.submitter.hasAttribute('formnovalidate')) return; // e.g. "Save draft"
                if (cfg.skipSubmitter && e.submitter && e.submitter.matches && e.submitter.matches(cfg.skipSubmitter)) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                const bot = botReason();
                if (bot) { reportBot(bot); return; }   // a bot's submit goes nowhere, and says nothing
                inst._submitted = true;
                if (inst._busy) return;
                inst._busy = true;
                const submitter = e.submitter;
                validateAll({ submit: true }).then(ok => {
                    inst._busy = false;
                    if (!ok) return;
                    if (isFn(cfg.onSubmit)) {   // AJAX, the short way: your function gets the validated values; it may return { errors: { field: message } } from the server to show them here
                        inst._busy = true;      // no double submit while the request runs
                        setSubmitting(true);
                        let failed = false;
                        return Promise.resolve().then(() => cfg.onSubmit(collectValues(), e, inst)).then(out => {
                            if (out && out.errors && typeof out.errors === 'object') { failed = true; inst.setErrors(out.errors); }
                        }).catch(err => { failed = true; if (root.console) console.error(err); }).then(() => { inst._busy = false; setSubmitting(false); if (!failed) { clearDraft(); rotateKey(); leaveOk = true; } });
                    }
                    if (isFn(cfg.submitHandler)) return cfg.submitHandler(form, e, collectValues());   // the AJAX place: the third argument is the validated data
                    // Hand the form back to the browser on the next task, not now: when every rule is synchronous this callback runs while the browser
                    // is still delivering the user's submit event, and a requestSubmit() made at that moment is silently ignored (the form never posts).
                    setTimeout(() => {
                        inst._bypass = true;
                        try {
                            if (isFn(form.requestSubmit)) {
                                try { form.requestSubmit(submitter || undefined); } catch (err) { form.requestSubmit(); }
                            } else form.submit();
                        } finally { inst._bypass = false; }
                    }, 0);
                }).catch(err => { inst._busy = false; if (root.console) console.error(err); });
            }, true);

            listen(form, 'reset', () => setTimeout(() => inst.resetForm(), 0));
            snapshotInitial();
            mountAntiBot();
            mountIdempotency();
            if (draftCfg) { restoreDraft(); ['input', 'change'].forEach(t => listen(form, t, scheduleDraft)); }
            if (cfg.leaveWarning && root.addEventListener) { root.addEventListener('beforeunload', onBeforeUnload); inst._listeners.push(() => root.removeEventListener('beforeunload', onBeforeUnload)); }
            if (autoCfg) {
                runAutoAttributes();
                listen(form, 'focusin', e => { if (e.target && e.target.name) applyAutoAttributes([e.target]); });   // fields added later
            }
        }

        // ---- state: what a UI needs to know about the form (touched, dirty, pending, errors, submit count)
        const textOf = v => JSON.stringify(v === undefined ? null : v);
        let stateScheduled = false;
        function scheduleState() {
            if (!inst._stateSubs.size || stateScheduled) return;
            stateScheduled = true;
            Promise.resolve().then(() => { stateScheduled = false; const st = inst.getState(); Array.from(inst._stateSubs).forEach(fn => guard(fn, undefined, st)); });
        }
        function snapshotInitial() { inst._initial = {}; const vals = collectValues(); Object.keys(vals).forEach(k => { inst._initial[k] = textOf(vals[k]); }); }
        function getState() {
            if (!inst._initial) snapshotInitial();
            const values = collectValues(), fields = {};
            let dirty = false, touched = false, pending = false, errorCount = 0;
            allUnits().forEach(u => {
                const name = u.fields[0].name, err = inst._errors.get(u.key);
                const isDirty = textOf(values[name]) !== (name in inst._initial ? inst._initial[name] : textOf(undefined));
                const isTouched = inst._touched.has(name), isPending = (inst._pending.get(u.key) || 0) > 0;
                if (err) errorCount++;
                dirty = dirty || isDirty; touched = touched || isTouched; pending = pending || isPending;
                fields[name] = { value: values[name], dirty: isDirty, pristine: !isDirty, touched: isTouched, pending: isPending, valid: !err, error: err ? err.message : null, code: err ? err.code : null };
            });
            return { valid: errorCount === 0, errorCount, dirty, pristine: !dirty, touched, validating: pending, submitCount: inst._submitCount, submitted: inst._submitCount > 0, fields };
        }
        /** The units of the fields inside a step: an element or selector (every field in it), or a list of field names. */
        function unitsInScope(scope) {
            if (Array.isArray(scope)) return [].concat(...scope.map(n => unitsFor(String(n))));
            let el = scope;
            if (typeof scope === 'string') el = safeQuery(form, scope) || safeQuery(root.document, scope);
            if (el && el.jquery) el = el[0];
            if (!el || !el.contains) return [];
            return allUnits().filter(u => u.fields.some(f => el === f || el.contains(f)));
        }

        // ---- flow protections: bots, double submits, idempotency keys, drafts and unsaved changes
        const antiCfg = (() => {
            const a = cfg.antiBot;
            if (!a) return null;
            const o = isObj(a) ? a : {};
            return { honeypot: o.honeypot === false ? null : (typeof o.honeypot === 'string' && /^[A-Za-z][\w-]*$/.test(o.honeypot) ? o.honeypot : 'website_url'), minTime: isNum0(o.minTime) ? o.minTime : 0,
                timestampField: typeof o.timestampField === 'string' && /^[A-Za-z_][\w-]*$/.test(o.timestampField) ? o.timestampField : null, onBot: isFn(o.onBot) ? o.onBot : null };
        })();
        function isNum0(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }
        let honeypotEl = null, honeypotWrap = null, stampEl = null;
        inst._startedAt = Date.now();
        function mountAntiBot() {
            if (!antiCfg || honeypotWrap || stampEl) return;
            const D = root.document;
            if (antiCfg.honeypot) {
                honeypotWrap = D.createElement('div');
                honeypotWrap.setAttribute('aria-hidden', 'true');
                honeypotWrap.style.cssText = 'position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important';
                const label = D.createElement('label');
                label.textContent = 'Leave this field empty';
                honeypotEl = D.createElement('input');
                honeypotEl.type = 'text'; honeypotEl.name = antiCfg.honeypot; honeypotEl.tabIndex = -1; honeypotEl.autocomplete = 'off';
                honeypotEl.setAttribute('data-fv-trap', '');
                label.appendChild(honeypotEl); honeypotWrap.appendChild(label); form.appendChild(honeypotWrap);
            }
            if (antiCfg.timestampField) {
                stampEl = D.createElement('input');
                stampEl.type = 'hidden'; stampEl.name = antiCfg.timestampField; stampEl.value = String(inst._startedAt);
                form.appendChild(stampEl);
            }
        }
        function unmountAntiBot() { if (honeypotWrap) honeypotWrap.remove(); if (stampEl) stampEl.remove(); honeypotWrap = honeypotEl = stampEl = null; }
        /** Why this submit looks like a bot ('honeypot' when the trap field is filled, 'too-fast' under antiBot.minTime ms), or null. */
        function botReason() {
            if (!antiCfg) return null;
            if (honeypotEl && String(honeypotEl.value).trim() !== '') return 'honeypot';
            if (antiCfg.minTime && Date.now() - inst._startedAt < antiCfg.minTime) return 'too-fast';
            return null;
        }
        function reportBot(reason) {
            if (antiCfg && antiCfg.onBot) guard(antiCfg.onBot, undefined, reason);
            emit('fv:bot', { reason });
        }
        const idemCfg = (() => {
            const k = cfg.idempotencyKey;
            if (!k) return null;
            const o = isObj(k) ? k : {};
            return { field: typeof o.field === 'string' && /^[A-Za-z_][\w-]*$/.test(o.field) ? o.field : '_idempotency_key', header: typeof o.header === 'string' && o.header ? o.header : 'Idempotency-Key' };
        })();
        let idemKey = null, idemEl = null;
        const newKey = () => {
            const c = root.crypto;
            if (c && isFn(c.randomUUID)) return c.randomUUID();
            const b = new Uint8Array(16);
            if (c && isFn(c.getRandomValues)) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
            b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
            const h = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
            return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
        };
        /** The key of the current submission attempt: the same for every retry, new after a success (and after resetForm). null when idempotencyKey is off. */
        function idempotencyKey() {
            if (!idemCfg) return null;
            if (!idemKey) idemKey = newKey();
            if (idemEl && idemEl.value !== idemKey) idemEl.value = idemKey;
            return idemKey;
        }
        function mountIdempotency() {
            if (!idemCfg || idemEl) return;
            idemEl = root.document.createElement('input');
            idemEl.type = 'hidden'; idemEl.name = idemCfg.field;
            form.appendChild(idemEl);
            idempotencyKey();
        }
        const rotateKey = () => { if (!idemCfg) return; idemKey = null; idempotencyKey(); };
        let submittingNow = false;
        const submitButtons = () => Array.from(form.querySelectorAll('button, input[type=submit], input[type=image]')).filter(b => !b.type || /^(submit|image)$/.test(b.type));
        function setSubmitting(on) {
            if (submittingNow === on) return;
            submittingNow = on;
            form.classList.toggle('fv-submitting', on);
            if (!cfg.disableOnSubmit) return;
            submitButtons().forEach(b => {
                if (on) { b._fvWasDisabled = b.disabled; b.disabled = true; b.setAttribute('aria-busy', 'true'); }
                else { b.disabled = !!b._fvWasDisabled; b.removeAttribute('aria-busy'); delete b._fvWasDisabled; }
            });
            scheduleState();
        }
        // drafts: what the user typed survives a reload, a crash and an accidental navigation
        const draftCfg = (() => {
            const d = cfg.draft;
            if (!d) return null;
            const o = isObj(d) ? d : {};
            return { key: typeof o.key === 'string' && o.key ? o.key : 'fv-draft:' + (form.id || form.getAttribute('name') || (root.location ? root.location.pathname : 'form')), storage: o.storage === 'local' ? 'local' : 'session',
                exclude: [].concat(o.exclude || []).map(String), debounce: isNum0(o.debounce) ? o.debounce : 400, maxAgeMs: (isNum0(o.maxAgeDays) ? o.maxAgeDays : 7) * 86400000 };
        })();
        const store = () => { try { return draftCfg ? (draftCfg.storage === 'local' ? root.localStorage : root.sessionStorage) : null; } catch (e) { return null; } };
        const draftable = el => el.name && !el.disabled && !el.hasAttribute('data-fv-no-draft') && !/^(password|file|hidden|submit|button|reset|image)$/i.test(el.type) &&
            (!draftCfg || draftCfg.exclude.indexOf(el.name) < 0) && el.name !== (antiCfg && antiCfg.honeypot) && el.name !== (idemCfg && idemCfg.field) && el.name !== (antiCfg && antiCfg.timestampField);
        function draftValues() {
            const out = {}, vals = collectValues();
            Array.from(form.elements).filter(draftable).forEach(el => { if (el.name in vals) out[el.name] = vals[el.name]; });
            return out;
        }
        function saveDraft() {
            const st = store();
            if (!st) return false;
            try {
                const vals = draftValues();
                const dirty = Object.keys(vals).some(k => textOf(vals[k]) !== (k in (inst._initial || {}) ? inst._initial[k] : textOf(undefined)));
                if (!dirty) { st.removeItem(draftCfg.key); return false; }
                st.setItem(draftCfg.key, JSON.stringify({ v: 1, t: Date.now(), values: vals }));
                return true;
            } catch (e) { return false; }   // storage full or blocked: the form still works
        }
        function restoreDraft() {
            const st = store();
            if (!st) return false;
            let saved = null;
            try { saved = JSON.parse(st.getItem(draftCfg.key) || 'null'); } catch (e) { saved = null; }
            if (!saved || saved.v !== 1 || !saved.values || typeof saved.values !== 'object' || (Date.now() - (saved.t || 0)) > draftCfg.maxAgeMs) { try { st.removeItem(draftCfg.key); } catch (e) { /* */ } return false; }
            let applied = 0;
            Object.keys(saved.values).forEach(name => {
                if (BAD_KEYS.indexOf(name) >= 0) return;
                const els = Array.from(form.querySelectorAll('[name="' + esc(name) + '"]')).filter(draftable);
                if (!els.length) return;
                const v = saved.values[name], first = els[0];
                if (first.type === 'checkbox' || first.type === 'radio') {
                    const want = [].concat(v === undefined ? [] : v).map(String);
                    els.forEach(el => { el.checked = want.indexOf(el.value) >= 0; });
                } else if (first.tagName === 'SELECT' && first.multiple) {
                    const want = [].concat(v).map(String);
                    Array.from(first.options).forEach(o => { o.selected = want.indexOf(o.value) >= 0; });
                } else els.forEach((el, i) => { const x = Array.isArray(v) ? v[i] : v; if (x !== undefined && x !== null) el.value = String(x); });
                applied++;
                els.forEach(el => { el.dispatchEvent(new root.Event('input', { bubbles: true })); el.dispatchEvent(new root.Event('change', { bubbles: true })); });
            });
            if (applied) { emit('fv:draft-restored', { fields: applied }); scheduleState(); }
            return applied > 0;
        }
        function clearDraft() { const st = store(); if (st) { try { st.removeItem(draftCfg.key); } catch (e) { /* */ } } }
        let draftTimer = null;
        function scheduleDraft() { if (!draftCfg) return; clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, draftCfg.debounce); }
        const hasUnsaved = () => { if (!inst._initial) return false; return Object.keys(draftValuesAll()).some(k => textOf(draftValuesAll()[k]) !== (k in inst._initial ? inst._initial[k] : textOf(undefined))); };
        function draftValuesAll() {   // everything except passwords and the traps: what "unsaved changes" means
            const out = {}, vals = collectValues();
            Array.from(form.elements).forEach(el => { if (el.name && el.name in vals && !/^(password|hidden|submit|button|reset|image)$/i.test(el.type) && el.name !== (antiCfg && antiCfg.honeypot)) out[el.name] = vals[el.name]; });
            return out;
        }
        let leaveOk = false;
        const onBeforeUnload = e => {
            if (!cfg.leaveWarning || leaveOk || inst._bypass || !hasUnsaved()) return undefined;
            e.preventDefault();
            e.returnValue = typeof cfg.leaveWarning === 'string' ? cfg.leaveWarning : '';
            return e.returnValue;
        };

        // ---- valid state: a class on fields that were checked and hold a valid value (reward early)
        function markValid(unit, on) {
            if (!cfg.validClass) return;
            unit.fields.forEach(f => cfg.validClass.split(/\s+/).forEach(c => { if (c) f.classList[on ? 'add' : 'remove'](c); }));
        }
        /** Checks a field without showing anything: true (valid and not empty), false (invalid), null (empty, or it needs a server / async rule, so no answer yet). */
        function peekValid(unit) {
            const rules = rulesFor(unit);
            if (!rules.length || !isActive(unit)) return null;
            const env = readEnv(unit);
            if (env.badInput) return false;
            if (env.empty) return null;
            for (const rule of rules) {
                const def = validators[rule.type];
                if (!def || (isFn(rule.when) && !guard(rule.when, true, env.value, env))) continue;
                if (def.remote) return null;
                let res;
                try { res = def.fn(valueFor(rule, env), rule, env); } catch (e) { return false; }
                if (res && isFn(res.then)) return null;
                if (!normalizeResult(res).valid) return false;
            }
            return true;
        }

        // ---- error summary: one accessible list of every problem, with links to the fields
        const summaryCfg = (() => {
            const s = cfg.errorSummary;
            if (!s) return null;
            const o = typeof s === 'string' || (s && s.nodeType === 1) ? { container: s } : (isObj(s) ? s : {});
            return {
                container: o.container === undefined ? null : o.container,
                title: typeof o.title === 'string' ? o.title : null,
                focus: o.focus === 'field' || o.focus === false ? 'field' : 'summary',
                withLabel: o.withLabel !== false,
                headingLevel: [1, 2, 3, 4, 5, 6].includes(o.headingLevel) ? o.headingLevel : 2,
                className: typeof o.className === 'string' ? o.className : 'fv-summary'
            };
        })();
        let summaryEl = null, summaryOwned = false, summarySig = '';
        function summaryContainer() {
            if (!summaryCfg) return null;
            if (summaryEl && summaryEl.isConnected !== false) return summaryEl;
            const c = summaryCfg.container;
            let el = null;
            if (typeof c === 'string') el = root.document.querySelector(c);
            else if (c && c.nodeType === 1) el = c;
            if (!el) {
                el = root.document.createElement('div');
                form.insertBefore(el, form.firstChild);
                summaryOwned = true;
            }
            if (!el.classList.contains(summaryCfg.className)) el.classList.add(summaryCfg.className);
            el.setAttribute('tabindex', '-1');
            summaryEl = el;
            return el;
        }
        function labelOf(unit) {
            const f = unit.fields[0];
            // text of a node without the messages we placed and without form controls that sit inside a wrapping <label>
            const plain = node => {
                if (!node) return '';
                const c = node.cloneNode(true);
                Array.from(c.querySelectorAll('[data-error-for], input, select, textarea, button, .fv-summary')).forEach(x => x.remove());
                return c.textContent || '';
            };
            let text = '';
            const ref = f.getAttribute('aria-labelledby');
            if (ref) text = ref.split(/\s+/).map(id => plain(root.document.getElementById(id))).join(' ');
            if (!text.trim() && unit.fields.length > 1) { const fs = f.closest('fieldset'); const lg = fs && fs.querySelector('legend'); if (lg) text = plain(lg); }
            if (!text.trim() && f.labels && f.labels.length) text = Array.from(f.labels).map(plain).join(' ');
            if (!text.trim() && f.id) { const l = form.querySelector('label[for="' + esc(f.id) + '"]'); if (l) text = plain(l); }
            if (!text.trim()) text = f.getAttribute('aria-label') || '';
            return text.replace(/\s+/g, ' ').replace(/[*:]\s*$/, '').trim();
        }
        function focusField(unit) {
            const f = unit.fields.find(x => !x.disabled) || unit.fields[0];
            try { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* not focusable */ }
        }
        /** Rebuilds the summary from the errors that are showing now. focus: move keyboard focus to it (after a failed submit). */
        function renderSummary(focus) {
            if (!summaryCfg) return;
            const list = Array.from(inst._errors.values()).filter(r => r.unit.fields[0].isConnected !== false);
            const el = list.length || summaryEl ? summaryContainer() : null;
            if (!el) return;
            list.sort((a, b) => (a.unit.fields[0].compareDocumentPosition(b.unit.fields[0]) & 4) ? -1 : 1);
            const title = summaryCfg.title || cfg.messages.errorSummary || DEFAULT_MESSAGES.errorSummary;
            const sig = JSON.stringify([title, list.map(r => [r.message, r.unit.fields[0].name])]);
            if (!focus && sig === summarySig && !el.hidden) return;   // nothing changed: do not rebuild (and re-announce) the list
            summarySig = sig;
            while (el.firstChild) el.removeChild(el.firstChild);   // fresh nodes every time: screen readers announce new content
            if (!list.length) { el.hidden = true; summarySig = ''; return; }
            const D = root.document;
            const h = D.createElement('h' + summaryCfg.headingLevel);
            h.id = 'fv-summary-title-' + (++uid);
            h.textContent = title;
            const ul = D.createElement('ul');
            list.forEach(r => {
                const f = r.unit.fields[0];
                if (!f.id) f.id = 'fv-field-' + (++uid);
                const li = D.createElement('li'), a = D.createElement('a');
                a.setAttribute('href', '#' + f.id);
                const label = summaryCfg.withLabel ? labelOf(r.unit) : '';
                a.textContent = label && r.message.toLowerCase().indexOf(label.toLowerCase()) < 0 ? label + ': ' + r.message : r.message;
                a.setAttribute('dir', 'auto');
                a.addEventListener('click', e => { e.preventDefault(); focusField(r.unit); });
                li.appendChild(a); ul.appendChild(li);
            });
            el.appendChild(h); el.appendChild(ul);
            el.setAttribute('aria-labelledby', h.id);
            el.hidden = false;
            if (focus) { try { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* not focusable */ } }
        }
        let summaryTimer = null;
        /** ASP.NET's <div data-valmsg-summary="true"><ul></ul></div>: the list of messages and the validation-summary-errors / -valid classes. */
        function renderValSummary() {
            if (!cfg.unobtrusive) return;
            const box = form.querySelector('[data-valmsg-summary="true"]');
            if (!box) return;
            let ul = box.querySelector('ul');
            if (!ul) { ul = root.document.createElement('ul'); box.appendChild(ul); }
            while (ul.firstChild) ul.removeChild(ul.firstChild);
            const list = Array.from(inst._errors.values()).sort((a, b) => (a.unit.fields[0].compareDocumentPosition(b.unit.fields[0]) & 4) ? -1 : 1);
            list.forEach(r => { const li = root.document.createElement('li'); li.textContent = r.message; ul.appendChild(li); });
            box.classList.toggle('validation-summary-errors', list.length > 0);
            box.classList.toggle('validation-summary-valid', list.length === 0);
        }
        const refreshSummary = () => {   // errors come and go one by one: rebuild once per tick, without stealing focus
            if ((!summaryCfg && !cfg.unobtrusive) || summaryTimer) return;
            summaryTimer = setTimeout(() => { summaryTimer = null; renderValSummary(); if (summaryCfg && summaryEl && !summaryEl.hidden) renderSummary(false); }, 0);
        };

        // ---- autoAttributes: type, inputmode, autocomplete and aria-required from the rules and the field names, and a lint for what browsers get wrong
        const autoCfg = (() => {
            const a = cfg.autoAttributes;
            if (!a) return null;
            const o = isObj(a) ? a : {};
            return { type: o.type !== false, inputmode: o.inputmode !== false, autocomplete: o.autocomplete !== false, ariaRequired: o.ariaRequired !== false, lint: o.lint !== false };
        })();
        inst.attributeChanges = [];
        inst.lintIssues = [];
        const attrDone = new WeakMap();   // field -> the rule types it was last set up for
        function applyAutoAttributes(fields) {
            if (!autoCfg) return [];
            const changes = [];
            const byName = new Map();
            (fields || Array.from(form.elements)).forEach(el => {
                if (!el.name || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
                if (attrDone.get(el) === (inst.rules[el.name] || []).map(r => r.type).join()) return;
                if (!byName.has(el.name)) byName.set(el.name, []);
                byName.get(el.name).push(el);
            });
            const passwords = Array.from(form.elements).filter(e => e.type === 'password').length;
            byName.forEach((els, name) => {
                const rules = inst.rules[name] || [];
                const types = rules.map(r => r.type);
                const first = els[0];
                els.forEach(e => attrDone.set(e, types.join()));
                const set = (el, attr, value) => { if (el.hasAttribute(attr) && attr !== 'type') return false; if (attr === 'type' && !(el.getAttribute('type') === null || el.getAttribute('type') === '' || el.getAttribute('type') === 'text')) return false; el.setAttribute(attr, value); changes.push({ field: el, name, attribute: attr, value }); return true; };
                if (autoCfg.ariaRequired && types.includes('required') && !rules.some(r => r.type === 'required' && isFn(r.when))) els.forEach(e => set(e, 'aria-required', 'true'));
                if (first.tagName === 'TEXTAREA') return;
                if (first.type === 'checkbox' || first.type === 'radio' || first.type === 'file' || first.type === 'hidden') return;
                const key = (name + ' ' + (first.id || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                let type = null, inputmode = null, token = null;
                if (types.includes('email')) { type = 'email'; inputmode = 'email'; token = /user|login/.test(key) ? 'username' : 'email'; }
                else if (types.includes('url')) { type = 'url'; inputmode = 'url'; token = 'url'; }
                else if (types.includes('phone')) { type = 'tel'; inputmode = 'tel'; token = 'tel'; }
                else if (types.includes('creditcard')) { inputmode = 'numeric'; token = 'cc-number'; }
                else if (types.includes('digits')) inputmode = 'numeric';
                else if (types.includes('number')) inputmode = 'decimal';
                if (first.type === 'password') {
                    const isNew = types.includes('pwcheck') || rules.some(r => r.type === 'equalTo') || passwords > 1 || /new|confirm|repeat|retype|verify|signup|register|create/.test(key);
                    token = isNew ? 'new-password' : 'current-password';
                }
                if (!token) {
                    const rx = [
                        [/\b(otp|one time|verification code|sms code|2fa|mfa|totp)\b/, 'one-time-code', 'numeric'],
                        [/\b(e ?mail)\b/, 'email'], [/\b(user ?name|userid|user id|login)\b/, 'username'],
                        [/\b(first ?name|fname|given ?name|forename)\b/, 'given-name'], [/\b(last ?name|lname|surname|family ?name)\b/, 'family-name'],
                        [/\b(full ?name|name)\b$/, 'name'], [/\b(mobile|phone|tel|telephone)\b/, 'tel', 'tel'],
                        [/\b(zip|zip ?code|postal|postal ?code|postcode)\b/, 'postal-code'], [/\b(address ?2|address ?line ?2|apt|suite)\b/, 'address-line2'],
                        [/\b(address ?1|address ?line ?1)\b/, 'address-line1'], [/\b(street|address)\b/, 'street-address'],
                        [/\b(city|town)\b/, 'address-level2'], [/\b(state|province|region)\b/, 'address-level1'], [/\b(country)\b/, 'country-name'],
                        [/\b(company|organi[sz]ation|org)\b/, 'organization'], [/\b(birth ?day|birthday|bday|dob|date of birth)\b/, 'bday'],
                        [/\b(card ?number|cc ?num|cc ?number|card ?no)\b/, 'cc-number', 'numeric'], [/\b(cvc|cvv|csc|security code)\b/, 'cc-csc', 'numeric'],
                        [/\b(cc ?exp|card ?expiry|expiry|exp date)\b/, 'cc-exp', 'numeric']
                    ];
                    const hit = rx.find(r => r[0].test(key));
                    if (hit) { token = hit[1]; if (!inputmode && hit[2]) inputmode = hit[2]; }
                }
                if (autoCfg.type && type && /^(INPUT)$/.test(first.tagName)) set(first, 'type', type);
                if (autoCfg.inputmode && inputmode && first.tagName === 'INPUT' && first.type !== 'number') set(first, 'inputmode', inputmode);
                if (autoCfg.autocomplete && token && !first.hasAttribute('autocomplete')) els.forEach(e => set(e, 'autocomplete', token));
            });
            inst.attributeChanges = inst.attributeChanges.concat(changes);
            return changes;
        }
        function lintForm() {
            const issues = [];
            const rulesOf = n => (inst.rules[n] || []).map(r => r.type);
            Array.from(form.elements).forEach(el => {
                if (!el.name || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
                const ac = (el.getAttribute('autocomplete') || '').trim().toLowerCase();
                const key = (el.name + ' ' + (el.id || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
                const known = el.type === 'password' || /\b(e ?mail|user ?name|login|first ?name|last ?name|full ?name|phone|tel|zip|postal|postcode|address|city|card ?number|cvc|cvv)\b/.test(key);
                if ((ac === 'off' || ac === 'false') && known) issues.push({ field: el, name: el.name, code: 'autocomplete-off', message: 'autocomplete="off" on "' + el.name + '": browsers and password managers ignore it for logins and addresses, and it blocks the autofill people rely on.', fix: 'Remove it, or use a specific value such as autocomplete="' + (el.type === 'password' ? 'current-password' : 'email') + '".' });
                if (el.type === 'password' && !ac) issues.push({ field: el, name: el.name, code: 'password-autocomplete', message: 'The password field "' + el.name + '" has no autocomplete value.', fix: 'Use autocomplete="current-password" for logins and "new-password" for sign-up or change-password forms (autoAttributes does this).' });
                const digitish = /\b(otp|one time|code|pin|zip|postal|postcode|phone|tel|card|cvc|cvv|iban|account|ssn|id)\b/.test(key) || ['digits', 'phone', 'creditcard'].some(t => rulesOf(el.name).includes(t));
                if (el.type === 'number' && digitish) issues.push({ field: el, name: el.name, code: 'type-number', message: '"' + el.name + '" looks like an identifier, not a quantity, but uses type="number": leading zeros are lost, the mouse wheel changes the value, and "e" is accepted.', fix: 'Use type="text" with inputmode="numeric" (autoAttributes does this for digits rules).' });
            });
            inst.lintIssues = issues;
            return issues;
        }
        function runAutoAttributes() {
            if (!autoCfg) return;
            applyAutoAttributes();
            if (autoCfg.lint) {
                const issues = lintForm();
                if (issues.length && root.console && console.warn) console.warn('FormValidator autoAttributes: ' + issues.length + ' thing(s) to fix in the form markup:\n' + issues.map(i => ' - [' + i.code + '] ' + i.message + ' ' + i.fix).join('\n'));
            }
        }

        Object.assign(inst, {
            validate: o => validateAll(o),
            getValues: collectValues,
            /** validate, then hand back what to send: { valid, values, errors }. Shows the errors like validate() does. */
            validateAndGetValues: async o => { const valid = await validateAll(o); return { valid, values: collectValues(), errors: inst.getErrors() }; },
            /**
             * An event handler for any framework (React onSubmit, Vue @submit, Angular (ngSubmit), addEventListener): it stops the native submit, validates and,
             * only when the form is valid, calls fn(values, event, inst). If fn returns { errors: { field: message } } (what your server sent back) they are shown
             * on the fields. Resolves to { valid, values, errors, result }.
             */
            handleSubmit: fn => async event => {
                if (event && isFn(event.preventDefault)) event.preventDefault();
                const bot = botReason();
                if (bot) { reportBot(bot); return { valid: false, bot: true, reason: bot, values: {}, errors: [] }; }
                const r = await inst.validateAndGetValues({ submit: true });
                if (!r.valid || !isFn(fn)) return r;
                setSubmitting(true);
                let out;
                try { out = await fn(r.values, event, inst); } finally { setSubmitting(false); }
                if (out && out.errors && typeof out.errors === 'object') { inst.setErrors(out.errors); return Object.assign({}, r, { valid: false, errors: inst.getErrors(), result: out }); }
                clearDraft(); rotateKey(); leaveOk = true;
                return Object.assign({}, r, { result: out });
            },
            /** Shows messages from the server on the fields: { Email: 'Already registered' } (a list takes the first message). Names are matched exactly, then ignoring case. Returns the names that match no field. */
            setErrors: map => {
                const names = Array.from(form.elements).map(el => el.name).filter(Boolean), missed = [], byCanon = new Map();
                names.forEach(n => { const c = canonKey(n); if (c !== null) { if (!byCanon.has(c)) byCanon.set(c, n); if (!byCanon.has('~' + c.toLowerCase())) byCanon.set('~' + c.toLowerCase(), n); } });
                Object.keys(map || {}).forEach(key => {
                    const msg = [].concat(map[key])[0], c = canonKey(key);
                    // exact name, then the same path written another way (items.0.qty = items[0][qty] = items[0].qty), then ignoring case
                    const target = names.includes(key) ? key : (c !== null && byCanon.get(c)) || names.find(n => n.toLowerCase() === String(key).toLowerCase()) || (c !== null && byCanon.get('~' + c.toLowerCase()));
                    if (!target || msg === undefined || msg === null || !inst.setError(target, String(msg))) missed.push(key);
                    else inst._serverNames.add(target);
                });
                return missed;
            },
            /**
             * Shows what a backend answered (problem+json, Laravel, Django REST, ASP.NET, FastAPI, Zod ...) on the fields: see FormValidator.serverErrors().
             * Resolves to { errors, all, form, format, missed }: `form` are the messages that belong to no field, `missed` the field names that match no input.
             * options.clear (default false) removes the earlier server messages first.
             */
            setServerErrors: (body, options) => {
                const r = serverErrors(body, options);
                if (options && options.clear) inst.clearServerErrors();
                const missed = inst.setErrors(r.all);
                return Object.assign({}, r, { missed });
            },
            clearServerErrors: () => { Array.from(inst._serverNames).forEach(n => inst.clearError(n)); inst._serverNames.clear(); },
            /**
             * Precognition: sends the current values to your real endpoint (url) and shows the field errors it answers, without saving anything.
             * validateOnServer(url, { only: ['email'], method, headers, ... }). `only` limits what is reported (and shown); default is every field.
             * A newer call cancels an older one. Resolves to the precognition() result plus { missed }. valid === null means "could not check": nothing is changed.
             */
            validateOnServer: async (url, options) => {
                const o = Object.assign({}, typeof url === 'object' && url ? url : { url }, options);
                const names = o.only === undefined ? null : [].concat(o.only);
                if (inst._serverAbort) inst._serverAbort.abort();
                const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
                inst._serverAbort = ctrl;
                const token = ++inst._serverToken;
                const r = await precognition(o.url, collectValues(), Object.assign({}, o, { only: names === null ? undefined : names, signal: ctrl ? ctrl.signal : o.signal }));
                if (token !== inst._serverToken || r.aborted) return Object.assign({}, r, { aborted: true, valid: null });
                if (inst._serverAbort === ctrl) inst._serverAbort = null;
                if (r.valid === null) return r;
                // fields that were asked about and now pass lose an earlier server message
                const asked = names === null ? Array.from(inst._serverNames) : Array.from(form.elements).map(el => el.name).filter(n => n && names.some(x => canonKey(x) === canonKey(n)));
                asked.forEach(n => { if (!Object.prototype.hasOwnProperty.call(r.errors, canonKey(n)) && inst._serverNames.has(n)) { inst.clearError(n); inst._serverNames.delete(n); } });
                const missed = inst.setErrors(r.all);
                return Object.assign({}, r, { missed });
            },
            /**
             * Live server checks like Laravel Precognition: when the user leaves a field that passes the browser rules and holds a value, only that field is checked
             * on the server (validateOnServer with only: [name]). options: url, delay (ms, default 200), exclude (names), validateEmpty, excludePasswords (default true),
             * plus the validateOnServer options. Returns a function that stops it.
             */
            watchServer: (url, options) => {
                const o = Object.assign({}, typeof url === 'object' && url ? url : { url }, options), delay = typeof o.delay === 'number' ? o.delay : 200;
                const timers = new Map();
                const handler = e => {
                    const el = e.target;
                    if (!el || !el.name || el.disabled || el.type === 'file' || (el.type === 'password' && o.excludePasswords !== false) || [].concat(o.exclude || []).includes(el.name)) return;
                    clearTimeout(timers.get(el.name));
                    timers.set(el.name, setTimeout(() => {
                        timers.delete(el.name);
                        if (inst.getErrors().some(x => x.name === el.name && !inst._serverNames.has(el.name))) return;   // the browser rules already complain
                        const v = collectValues()[el.name];
                        if (!o.validateEmpty && (v === '' || v === undefined || v === null || (Array.isArray(v) && !v.length))) return;
                        inst.validateOnServer(Object.assign({}, o, { only: [el.name] })).catch(() => {});
                    }, delay));
                };
                ['change', 'focusout'].forEach(t => form.addEventListener(t, handler));
                const stop = () => { ['change', 'focusout'].forEach(t => form.removeEventListener(t, handler)); timers.forEach(clearTimeout); timers.clear(); };
                inst._listeners.push(stop);
                return stop;
            },
            /** What a UI needs: { valid, errorCount, dirty, pristine, touched, validating, submitCount, submitted, fields: { name: { value, dirty, pristine, touched, pending, valid, error, code } } } */
            getState,
            /** Calls fn(state) (once per tick) when errors, touched, dirty, pending or the submit count change. Returns the unsubscribe function. */
            onStateChange: fn => { if (!isFn(fn)) return () => {}; inst._stateSubs.add(fn); return () => { inst._stateSubs.delete(fn); }; },
            /**
             * Wizards: checks only the fields inside a step. scope: an element, a selector or a list of names. Shows the messages, focuses the first invalid field,
             * calls onError / fires fv:invalid for that step, and resolves to true when the step is valid. Fields in hidden steps are skipped as always.
             */
            validateStep: async (scope, o) => {
                const units = unitsInScope(scope);
                const results = await Promise.all(units.map(u => validateUnit(u, o)));
                return finishAll(units, results, o);
            },
            validateSync: o => validateAllSync(o),
            validateElementSync: (el, o) => { const u = unitOf(el); return u ? validateUnitSync(u, o) : true; },
            validateElement: (el, o) => { const u = unitOf(el); return u ? validateUnit(u, o) : Promise.resolve(true); },
            unitOf,
            units: unitsFor,
            allUnits,
            readValue: unit => readEnv(unit),
            getErrors: () => Array.from(inst._errors.values()).map(r => ({ name: r.unit.fields[0].name, field: r.unit.fields[0], fields: r.unit.fields, message: r.message, code: r.code, rule: r.code, el: r.el })),
            setError: (name, message, code) => { const u = unitsFor(name)[0]; if (u) showError(u, message, code || 'server'); return !!u; },
            /** The problems with this form's markup that browsers and password managers trip over (autocomplete="off" on logins, type="number" for codes ...). */
            lint: () => lintForm(),
            /** Applies autoAttributes to fields that were added after init (it also happens when such a field gets focus). */
            refreshAttributes: () => applyAutoAttributes(),
            /** Rebuilds the error summary (errorSummary option) from the errors that show now; focus: true moves keyboard focus to it. */
            showSummary: focus => { if (summaryCfg) renderSummary(!!focus); return summaryEl; },
            clearError: name => unitsFor(name).forEach(removeError),
            resetForm: () => { inst.clearErrors(); inst._submitted = false; inst._submitCount = 0; inst._touched.clear(); inst._tokens.clear(); snapshotInitial(); inst._startedAt = Date.now(); if (stampEl) stampEl.value = String(inst._startedAt); rotateKey(); leaveOk = false; clearDraft(); scheduleState(); },
            /** Why this looks like a bot submit ('honeypot' | 'too-fast'), or null (also when antiBot is off). */
            botReason,
            /** The key of this submission attempt (the same for retries, new after a success); pass it to your server as the Idempotency-Key. null when idempotencyKey is off. */
            idempotencyKey,
            /** { 'Idempotency-Key': key } for fetch / axios (the header name is idempotencyKey.header). */
            idempotencyHeaders: () => (idemCfg ? { [idemCfg.header]: idempotencyKey() } : {}),
            isSubmitting: () => submittingNow,
            /** Draft: saveDraft(), restoreDraft(), clearDraft(); a draft is saved by itself while the user types, restored at start, cleared after a successful handleSubmit / onSubmit. */
            saveDraft, restoreDraft, clearDraft,
            /** true when the form differs from how it started (passwords and traps aside). */
            hasUnsavedChanges: hasUnsaved,
            /** Call after your own successful save so leaveWarning stops asking. */
            markSaved: () => { leaveOk = true; clearDraft(); },
            isSubmitted: () => inst._submitted,
            validateField: name => Promise.all(unitsFor(name).map(u => validateUnit(u))).then(r => r.every(Boolean)),
            clearErrors: () => { allUnits().forEach(removeError); Array.from(inst._errors.values()).forEach(r => removeError(r.unit)); },
            setRules: (name, rules) => { inst.rules[name] = normalizeRules(rules); wildCache = null; },
            addRules: (name, rules) => { inst.rules[name] = (inst.rules[name] || []).concat(normalizeRules(rules)); wildCache = null; },
            removeRules: name => { delete inst.rules[name]; wildCache = null; unitsFor(name).forEach(removeError); },
            destroy: () => {
                inst._listeners.forEach(off => off());
                inst._listeners.length = 0;
                inst._timers.forEach(clearTimeout);
                if (inst._deferred) inst._deferred.clear();
                inst._aborters.forEach(a => a.abort());
                inst.clearErrors();
                if (summaryTimer) { clearTimeout(summaryTimer); summaryTimer = null; }
                clearTimeout(draftTimer); unmountAntiBot(); if (idemEl) { idemEl.remove(); idemEl = null; }
                if (summaryEl) { while (summaryEl.firstChild) summaryEl.removeChild(summaryEl.firstChild); if (summaryOwned) summaryEl.remove(); else summaryEl.hidden = true; summaryEl = null; }
                if (cfg.novalidate) form.noValidate = !!inst._hadNoValidate;
                delete form._fvInstance; delete form._manualValidate;
            },
            attach
        });
        Object.defineProperty(inst, 'state', { get: getState, enumerable: true });   // inst.state is getState() without the parentheses
        return inst;
    }

    // ------------------------------------------------------------------ ASP.NET unobtrusive validation: data-val-* attributes (MVC 5 / Razor / Core tag helpers)
    const UNOB = {};   // adapter name (lower case) -> { params: [...], fn(options) }
    const unobWarned = new Set();
    /** FormValidator.unobtrusive.adapters: the same three helpers as $.validator.unobtrusive.adapters, so existing custom adapters keep working. */
    const unobAdapters = {
        /** add('name', ['p1', 'p2'], function (options) { options.rules.myRule = { p1: options.params.p1 }; options.messages.myRule = options.message; }) */
        add(name, params, fn) {
            if (isFn(params)) { fn = params; params = []; }
            if (typeof name !== 'string' || !name || !isFn(fn)) throw new Error('unobtrusive.adapters.add: a name and a function are needed');
            UNOB[name.toLowerCase()] = { params: [].concat(params || []), fn };
            return unobAdapters;
        },
        /** addBool('email') or addBool('foo', 'fooRule'): data-val-foo="msg" turns the rule on. */
        addBool(name, ruleName) {
            return unobAdapters.add(name, [], o => { o.rules[ruleName || name] = true; o.messages[ruleName || name] = o.message; });
        },
        /** addSingleVal('minlength', 'min'): data-val-minlength-min="3" gives rule minlength = 3. */
        addSingleVal(name, attribute, ruleName) {
            return unobAdapters.add(name, [attribute || 'val'], o => { o.rules[ruleName || name] = o.params[attribute || 'val']; o.messages[ruleName || name] = o.message; });
        },
        /** addMinMax('length', 'minlength', 'maxlength', 'rangelength'): min only, max only, or both. */
        addMinMax(name, minRule, maxRule, minMaxRule, minAttr, maxAttr) {
            minAttr = minAttr || 'min'; maxAttr = maxAttr || 'max';
            return unobAdapters.add(name, [minAttr, maxAttr], o => {
                const min = o.params[minAttr], max = o.params[maxAttr], has = v => v !== undefined && v !== null && v !== '';
                if (has(min) && has(max)) { o.rules[minMaxRule] = [min, max]; o.messages[minMaxRule] = o.message; }
                else if (has(min)) { o.rules[minRule] = min; o.messages[minRule] = o.message; }
                else if (has(max)) { o.rules[maxRule] = max; o.messages[maxRule] = o.message; }
            });
        }
    };
    ['email', 'url', 'creditcard', 'number', 'digits', 'date', 'phone'].forEach(n => unobAdapters.addBool(n));
    unobAdapters.addBool('required');
    unobAdapters.addMinMax('length', 'minlength', 'maxlength', 'rangelength');
    unobAdapters.addSingleVal('minlength', 'min');
    unobAdapters.addSingleVal('maxlength', 'max');
    unobAdapters.addMinMax('range', 'min', 'max', 'range');
    unobAdapters.add('regex', ['pattern'], o => {
        const p = o.params.pattern;
        if (p === undefined || p === '') return;
        try { new RegExp('^(?:' + p + ')$'); } catch (e) { if (root.console) console.warn('FormValidator unobtrusive: the data-val-regex-pattern of "' + o.element.name + '" is not a valid JavaScript regular expression and is ignored: ' + p); return; }
        o.rules.pattern = { pattern: '^(?:' + p + ')$' };   // MVC matches the whole value
        o.messages.pattern = o.message;
    });
    unobAdapters.add('equalto', ['other'], o => {
        const other = o.params.other;
        if (!other) return;
        o.rules.equalTo = { target: other.indexOf('*.') === 0 ? o.prefix + other.slice(2) : other };
        o.messages.equalTo = o.message;
    });
    unobAdapters.add('fileextensions', ['extensions'], o => {
        const list = String(o.params.extensions || '').split(/[,\s]+/).filter(Boolean).map(x => '.' + x.replace(/^\./, '').toLowerCase());
        if (!list.length) return;
        o.rules.file = { accept: list.join(',') };
        o.messages.file = o.message;
    });
    unobAdapters.add('remote', ['url', 'type', 'additionalfields'], o => {
        const url = o.params.url;
        if (!url) return;
        const data = {};
        String(o.params.additionalfields || '').split(',').map(s => s.trim()).filter(Boolean).forEach(n => {
            const name = n.indexOf('*.') === 0 ? o.prefix + n.slice(2) : n;
            data[name] = () => { const vals = o.collect(); const v = vals[name]; return Array.isArray(v) ? v.join(',') : (v === undefined ? '' : v); };
        });
        o.rules.remote = { url, method: String(o.params.type || 'GET').toUpperCase(), encoding: 'form', data, serverMessage: true };   // MVC's [Remote] reads a classic form body / query string
        o.messages.remote = o.message;
    });
    const unobtrusive = {
        adapters: unobAdapters,
        /**
         * Starts FormValidator on every form under `scope` (default: the document) that holds data-val="true" fields, reading the rules from the data-val-* attributes
         * that ASP.NET MVC / Razor / Core render. Returns the instances. Call it again after inserting HTML with AJAX (fields added to an initialised form are picked up
         * by themselves; this is for new forms). config: any FormValidator config.
         */
        parse(scope, config) {
            const doc = root.document;
            let node = scope === undefined || scope === null ? doc : (typeof scope === 'string' ? doc.querySelector(scope) : scope);
            if (node && node.jquery) node = node[0];
            if (!node) return [];
            const forms = [];
            if (node.nodeType === 1 && node.tagName === 'FORM') forms.push(node);
            else if (node.nodeType === 1 && node.closest && node.closest('form')) forms.push(node.closest('form'));
            if (node.querySelectorAll) Array.from(node.querySelectorAll('form')).forEach(f => { if (!forms.includes(f)) forms.push(f); });
            return forms.filter(f => f.querySelector('[data-val="true"]')).map(f => f._fvInstance || init({ form: f, rules: {}, config: Object.assign({ unobtrusive: true }, config) }));
        },
        /** parse() when the page is ready, and again for forms that are added later (partial views, AJAX, modals). Returns a function that stops it. */
        auto(config) {
            const doc = root.document;
            const run = () => unobtrusive.parse(doc, config);
            if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run, { once: true }); else run();
            let mo = null, timer = null;
            if (typeof root.MutationObserver === 'function' && doc.body) {
                mo = new root.MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 20); });
                mo.observe(doc.body, { childList: true, subtree: true });
            }
            return () => { if (mo) mo.disconnect(); clearTimeout(timer); doc.removeEventListener('DOMContentLoaded', run); };
        }
    };

    // ------------------------------------------------------------------ mask(): format an input while the user types
    /**
     * FormValidator.mask(input, '(999) 999-9999', options) formats the text field as the user types: 9 digit, a letter, * letter or digit, \ escapes a character.
     * It keeps the caret where the user is, handles paste, delete and backspace over a literal, IME composition and maxlength-free fields. Returns
     *   { value, raw, complete, update(pattern), destroy() }.   options: onComplete(value, raw), trailing (show literals before the next character is typed, e.g. ") ").
     * Validate with { mask: '(999) 999-9999' } (the whole value matches), and read the digits with FormValidator.unmaskValue(value, pattern).
     */
    function mask(input, pattern, options) {
        if (!input || typeof input.addEventListener !== 'function') throw new Error('mask: pass the text input');
        const o = options || {};
        let tokens = maskTokens(pattern), pat = pattern;
        let last = { raw: maskRaw(input.value, tokens), value: '' };
        const slots = () => tokens.filter(t => t.t !== 'lit').length;
        function apply(deleteBack) {
            const el = input;
            const caret = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
            const before = el.value.slice(0, caret);
            let rawBefore = maskRaw(before, tokens).length;
            let raw = maskRaw(el.value, tokens);
            if (deleteBack && raw === last.raw && rawBefore > 0) {   // backspace removed a literal: take the character before it instead
                const arr = Array.from(raw); arr.splice(rawBefore - 1, 1); raw = arr.join(''); rawBefore--;
            }
            raw = Array.from(raw).slice(0, slots()).join('');
            rawBefore = Math.min(rawBefore, Array.from(raw).length);
            const formatted = maskFormat(raw, tokens, !!o.trailing);
            if (el.value !== formatted) el.value = formatted;
            // the caret goes after the same number of typed characters as before
            let pos = 0, seen = 0;
            const f = Array.from(formatted);
            while (pos < f.length && seen < rawBefore) { const t = maskRaw(f.slice(0, pos + 1).join(''), tokens).length; pos++; seen = t; }
            const at = f.slice(0, pos).join('').length;
            if (typeof el.setSelectionRange === 'function' && (root.document ? root.document.activeElement === el : true)) { try { el.setSelectionRange(at, at); } catch (e) { /* type without selection */ } }
            const wasComplete = last.complete;
            last = { raw, value: formatted, complete: maskPattern(pat).test(formatted) };
            if (last.complete && !wasComplete && isFn(o.onComplete)) guard(o.onComplete, undefined, formatted, raw);
        }
        let composing = false;
        const onInput = e => { if (composing || (e && e.isComposing)) return; apply(!!(e && e.inputType === 'deleteContentBackward')); };
        const onStart = () => { composing = true; };
        const onEnd = () => { composing = false; apply(false); };
        input.addEventListener('input', onInput);
        input.addEventListener('compositionstart', onStart);
        input.addEventListener('compositionend', onEnd);
        if (input.value) apply(false);
        return {
            get value() { return input.value; },
            get raw() { return maskRaw(input.value, tokens); },
            get complete() { return maskPattern(pat).test(input.value); },
            update(next) { tokens = maskTokens(next); pat = next; last = { raw: '', value: '' }; apply(false); },
            destroy() { input.removeEventListener('input', onInput); input.removeEventListener('compositionstart', onStart); input.removeEventListener('compositionend', onEnd); }
        };
    }

    // ------------------------------------------------------------------ declarative: <input name="email" data-fv="required email"> on any page, no script of your own
    const DECLARATIVE_FORMS = new WeakSet();
    /**
     * FormValidator.auto(config) starts a validator on every form that has data-fv (the form itself, or fields inside it):
     *   <form data-fv>  <input name="email" data-fv="required email">  <input name="zip" data-fv="required digits minlength:5" data-fv-mask="99999">
     * Field attributes: data-fv (the rules, like <fv-field rules>: 'required email minlength:3' or JSON), data-fv-mask (a mask), data-msg-<rule> (messages).
     * Form attributes: data-fv-config='{"errorSummary":true,"validClass":"is-valid"}' (any config as JSON). Forms added later are picked up. Returns a function that stops it.
     * Add data-fv-auto to the script tag that loads the bundle to run it by itself.
     */
    function auto(config) {
        const doc = root.document;
        if (!doc) return () => {};
        const setup = () => {
            Array.from(doc.querySelectorAll('form')).forEach(form => {
                if (DECLARATIVE_FORMS.has(form) || form._fvInstance) return;
                const fields = Array.from(form.querySelectorAll('[data-fv]')).filter(el => el !== form && el.name);
                if (!form.hasAttribute('data-fv') && !fields.length) return;
                const rules = {};
                fields.forEach(el => { const r = parseRules(el.getAttribute('data-fv')); if (r) rules[el.name] = r; });
                let formConfig = {};
                const cfgText = form.getAttribute('data-fv-config');
                if (cfgText) { try { formConfig = JSON.parse(cfgText); } catch (e) { if (root.console) console.warn('FormValidator.auto: data-fv-config is not valid JSON and is ignored.'); } }
                DECLARATIVE_FORMS.add(form);
                const masks = [];
                Array.from(form.querySelectorAll('[data-fv-mask]')).forEach(el => { if (el.name || el.id) masks.push(mask(el, el.getAttribute('data-fv-mask'))); });
                const inst = init({ form, rules, config: Object.assign({ autoRules: false }, config, formConfig) });
                inst._listeners.push(() => masks.forEach(m => m.destroy()));
            });
        };
        const run = () => setup();
        if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run, { once: true }); else run();
        let mo = null, timer = null;
        if (typeof root.MutationObserver === 'function' && doc.body) {
            mo = new root.MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 20); });
            mo.observe(doc.body, { childList: true, subtree: true });
        } else if (typeof root.MutationObserver === 'function') {
            doc.addEventListener('DOMContentLoaded', () => { if (!mo && doc.body) { mo = new root.MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 20); }); mo.observe(doc.body, { childList: true, subtree: true }); } }, { once: true });
        }
        return () => { if (mo) mo.disconnect(); clearTimeout(timer); doc.removeEventListener('DOMContentLoaded', run); };
    }

    // ------------------------------------------------------------------ public API
    function init(options) {
        options = options || {};
        const targets = [].concat(options.formId !== undefined ? options.formId : options.form);
        const instances = targets.map(t => {
            const form = resolveForm(t);
            if (!form) throw new Error(`Form "${t && t.id ? t.id : t}" not found`);
            if (form._fvInstance) form._fvInstance.destroy();
            const inst = createInstance(form, { rules: options.rules, config: options.config, context: options.context, messages: options.messages });
            inst.attach();
            form._fvInstance = inst;
            form._manualValidate = () => inst.validate(); // legacy hook
            return inst;
        });
        return Array.isArray(options.formId) ? instances : instances[0];
    }

    async function validate(target, rules) {
        const form = resolveForm(target);
        if (!form) throw new Error(`Form "${target}" not found`);
        if (!rules) {
            if (!form._fvInstance) throw new Error('Form not initialized with validator');
            return form._fvInstance.validate();
        }
        // ad-hoc rules: reuse the form's config when it has been initialised
        const base = form._fvInstance;
        const tmp = createInstance(form, { rules, config: base ? base.config : {}, context: base ? base.context : {} });
        return tmp.validate();
    }

    /**
     * jQuery's  $(form).valid()  without jQuery: true or false, right now, and the errors are shown. Use it for a direct submit or before your own AJAX call:
     *   form.addEventListener('submit', e => { if (!FormValidator.isValid(form)) e.preventDefault(); });          // direct: only a valid form goes through
     *   if (FormValidator.isValid(form)) fetch('/api', { method: 'POST', body: JSON.stringify(inst.getValues()) });  // AJAX
     * Rules that need to wait (remote, file checks) count as valid for now and show their result when it arrives; validate() (async) waits for them.
     * Needs FormValidator.init(...) first, or pass rules: FormValidator.isValid(form, { email: ['required', 'email'] }).
     */
    function isValid(target, rules) {
        const form = resolveForm(target);
        if (!form) throw new Error(`Form "${target}" not found`);
        if (!rules) {
            if (!form._fvInstance) throw new Error('Form not initialized with validator');
            return form._fvInstance.validateSync();
        }
        const base = form._fvInstance;
        return createInstance(form, { rules, config: base ? base.config : {}, context: base ? base.context : {} }).validateSync();
    }

    // ------------------------------------------------------------------ values without a form (Node, servers, unit tests)
    const NEEDS_FORM = ['file', 'fileType', 'fileSize', 'minFiles', 'maxFiles', 'minChecked', 'maxChecked'];
    /**
     * Checks one value against the same rules the form uses, with no DOM:
     *   FormValidator.checkValue('a@b', ['required', 'email'])            -> { valid: false, rule: 'email', message: 'Please enter a valid email address.' }
     *   FormValidator.checkValue('x', { equalTo: 'password' }, { values: { password: 'y' } })
     * Rules: everything except file, checkbox-count and remote rules (they need a form, files or a server). Synchronous only (no async custom rules).
     * options: trim (default true; pwcheck never trims), values (other fields, for equalTo / notEqualTo), messages ({ rule: text }), passwordStrength, context.
     */
    function checkValue(value, rules, options) { return checkRules(value, normalizeRules(rules), options || {}); }

    /** checkValue for rules that are already normalised (schema() does that once, not on every call). */
    function checkRules(value, list, o) {
        const raw = value == null ? '' : String(value);
        const trimmed = o.trim === false ? raw : raw.trim();
        let env = null;
        for (const rule of list) {
            const def = validators[rule.type];
            if (!def) throw new Error('checkValue: unknown rule "' + rule.type + '"');
            if (def.remote || NEEDS_FORM.includes(rule.type)) throw new Error('checkValue: the "' + rule.type + '" rule needs a form, files or a server and cannot run on a plain value');
            const v = def.raw ? raw : trimmed;
            const empty = v === '';
            if (!env) env = { value: v, empty, count: empty ? 0 : 1, files: null, field: null, fields: [], form: null, inst: null, badInput: false,
                config: { passwordStrength: o.passwordStrength || {} }, context: o.context || {}, column: o.column, index: o.index, array: o.array, values: o.values };
            else { env.value = v; env.empty = empty; env.count = empty ? 0 : 1; }
            if (isFn(rule.when) && !guard(rule.when, true, v, env)) continue;
            if (empty && !def.runOnEmpty && rule.type !== 'equalTo') continue;
            let res;
            if (rule.type === 'equalTo' || rule.type === 'notEqualTo') {
                const other = o.values && rule.target in o.values ? String(o.values[rule.target] == null ? '' : o.values[rule.target]) : undefined;
                if (other === undefined) throw new Error('checkValue: pass the other field in options.values for the "' + rule.type + '" rule');
                res = rule.type === 'equalTo' ? v === other.trim() || v === other : v !== other.trim() && v !== other;
                if (rule.type === 'notEqualTo' && empty) continue;
            } else {
                res = def.fn(rule.normalizer ? rule.normalizer(v, null) : v, rule, env);
            }
            if (res && isFn(res.then)) throw new Error('checkValue: the "' + rule.type + '" rule is asynchronous; use a form for it');
            const r = normalizeResult(res);
            if (!r.valid) {
                const custom = typeof rule.message === 'string' ? rule.message : (o.messages && o.messages[rule.type]) || r.message || DEFAULT_MESSAGES[rule.type] || 'Invalid value.';
                return { valid: false, rule: rule.type, code: typeof rule.code === 'string' && rule.code ? rule.code : rule.type, message: format(fmt(custom, rule), paramsOf(rule)) };
            }
        }
        return { valid: true, rule: null, code: null, message: '' };
    }

    // ---- paths: 'user.email', 'items[0].qty', wildcards 'items[].qty' / 'items.*.qty' (every row)
    const isWild = t => t === '' || t === '*';
    /** Rule key -> tokens ('' and '*' match every index), or null when unsafe. A plain key without path characters is one token. */
    function ruleTokens(key) {
        const t = pathTokens(String(key));
        if (!t) return null;
        return t.map(x => (typeof x === 'string' && /^[0-9]+$/.test(x) ? +x : x));
    }
    const hasPathChars = key => /[.\[*]/.test(key);
    /** Every concrete place a (wildcard) path points to in `data`: [{ tokens, value, parent }]. A missing plain path gives one entry with value undefined; a wildcard over nothing gives none. */
    function expandPath(data, tokens) {
        const out = [];
        const step = (node, i, acc) => {
            if (i === tokens.length) { out.push({ tokens: acc, value: node }); return; }
            const t = tokens[i];
            if (isWild(t)) {
                if (Array.isArray(node)) node.forEach((child, idx) => step(child, i + 1, acc.concat([idx])));
                else if (node && typeof node === 'object') Object.keys(node).forEach(k => { if (BAD_KEYS.indexOf(k) < 0) step(node[k], i + 1, acc.concat([k])); });
                return;
            }
            if (BAD_KEYS.indexOf(t) >= 0) return;
            const child = node !== null && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, t) ? node[t] : undefined;
            step(child, i + 1, acc.concat([t]));
        };
        step(data, 0, []);
        return out;
    }
    /** { 'user.email': .., 'items[0].qty': .. }: every leaf of a nested object by canonical path (capped) */
    function flatten(data) {
        const out = {};
        let n = 0;
        const walk = (node, path, depth) => {
            if (n > 5000 || depth > 12) return;
            if (node !== null && typeof node === 'object' && !(typeof Blob === 'function' && node instanceof Blob)) {
                Object.keys(node).forEach(k => { if (BAD_KEYS.indexOf(k) < 0) walk(node[k], path.concat([Array.isArray(node) ? +k : k]), depth + 1); });
            } else if (path.length) { out[canonKey(path)] = node; n++; }
        };
        walk(data, [], 0);
        return out;
    }
    function targetsIn(rules) {
        const list = [];
        (Array.isArray(rules) ? rules : normalizeRules(rules)).forEach(r => { ruleTargetNames(r).forEach(t => list.push(t)); });
        return list;
    }

    /**
     * Checks a whole object (a JSON request body, a model) against { field: rules }:
     *   FormValidator.checkValues(body, { email: ['required', 'email'], pw: { required: true, pwcheck: { minLength: 8 } }, pw2: { equalTo: 'pw' } })
     *   -> { valid, errors: { field: message }, details: { field: { rule, code, message } } }
     * Keys may be paths into nested data and arrays: 'user.email', 'items[0].qty', and wildcards for every row: 'items[].qty' (or 'items.*.qty').
     * Errors are keyed by the concrete path ('items[1].qty'). Array rules on the array itself: { items: { minItems: 1, maxItems: 10 } };
     * rules on a wildcard column may use `unique` ({ 'items[].sku': ['required', { type: 'unique', ignoreCase: true }] }).
     * equalTo / notEqualTo targets are looked up in the same row first ('items[].password' + target 'confirm'), then as an absolute path.
     */
    /**
     * Server side of antiBot: FormValidator.isBotSubmission(body, { honeypot: 'website_url', timestampField: '_fv_t', minTimeMs: 1500 }) -> { bot, reason }.
     * 'honeypot': the trap field came back filled in; 'too-fast': the form was submitted less than minTimeMs after it was rendered (the timestamp field holds the time in ms).
     */
    function isBotSubmission(values, options) {
        const o = options || {}, v = values && typeof values === 'object' ? values : {};
        const trap = typeof o.honeypot === 'string' ? o.honeypot : 'website_url';
        if (o.honeypot !== false && v[trap] !== undefined && v[trap] !== null && String(v[trap]).trim() !== '') return { bot: true, reason: 'honeypot' };
        const stamp = o.timestampField ? Number(v[o.timestampField]) : NaN;
        const min = typeof o.minTimeMs === 'number' ? o.minTimeMs : 0;
        const now = typeof o.now === 'number' ? o.now : Date.now();
        if (min > 0 && isFinite(stamp) && now - stamp < min) return { bot: true, reason: 'too-fast' };
        return { bot: false, reason: null };
    }

    /**
     * Why does this value pass or fail? One entry per rule, in the order they run:
     *   FormValidator.explain('ab', ['required', { type: 'minlength', min: 3 }, 'email'])
     *   -> [{ rule: 'required', passed: true }, { rule: 'minlength', param: [3], passed: false, message: 'Please enter at least 3 characters.' }, { rule: 'email', passed: false, ... }]
     * Unlike checkValue it does not stop at the first failure, and it says when a rule is skipped (empty value, a `when` that said no) or cannot run here.
     * options: the same as checkValue (trim, values, messages, ...).
     */
    function explain(value, rules, options) {
        const o = options || {};
        return normalizeRules(rules).map(rule => {
            const entry = { rule: rule.type, code: typeof rule.code === 'string' && rule.code ? rule.code : rule.type };
            const ps = paramsOf(rule);
            if (ps.length) entry.param = ps;
            const def = validators[rule.type];
            if (!def) return Object.assign(entry, { passed: null, skipped: 'unknown rule' });
            if (def.remote || NEEDS_FORM.includes(rule.type)) return Object.assign(entry, { passed: null, skipped: 'needs a form, files or a server' });
            const raw = value == null ? '' : String(value), trimmed = o.trim === false ? raw : raw.trim();
            const v = def.raw ? raw : trimmed;
            if (isFn(rule.when) && !guard(rule.when, true, v, null)) return Object.assign(entry, { passed: null, skipped: 'its "when" condition is false' });
            if (v === '' && !def.runOnEmpty && rule.type !== 'equalTo') return Object.assign(entry, { passed: true, skipped: 'empty value: only required-type rules check blanks' });
            let r;
            try { r = checkRules(value, [rule], o); } catch (e) { return Object.assign(entry, { passed: null, skipped: String(e && e.message) }); }
            entry.passed = r.valid;
            if (!r.valid) entry.message = r.message;
            return entry;
        });
    }

    function checkValues(data, schema, options) { return runValues(data, schema, options || {}, false); }

    /** The work of checkValues. `normalized`: the rules per key are already lists of rule objects (schema() prepares them once). */
    function runValues(data, schema, o, normalized, meta) {
        const errors = {}, details = {};
        const keys = meta ? meta.keys : Object.keys(schema || {});
        const hasOwn = Object.prototype.hasOwnProperty;
        const pathKeys = meta ? (meta.pathKeys.length ? meta.pathKeys.filter(k => !(data && hasOwn.call(data, k))) : meta.pathKeys) : keys.filter(k => hasPathChars(k) && !(data && hasOwn.call(data, k)));
        const flat = pathKeys.length ? flatten(data) : null;
        const fail = (key, r) => { if (!(key in errors)) { errors[key] = r.message; details[key] = { rule: r.rule, code: r.code, message: r.message }; } };
        let base = null;   // the other fields, for equalTo / notEqualTo: built once, and only when a rule asks
        const baseValues = () => base || (base = Object.assign({}, data, flat, o.values));
        keys.forEach(name => {
            const list = normalized ? schema[name] : normalizeRules(schema[name]);
            const m = meta ? meta.by[name] : null;
            const wantsArray = m ? m.wantsArray : list.some(r => r.type === 'minItems' || r.type === 'maxItems');
            const needsValues = m ? m.needsValues : list.some(r => ruleTargetNames(r).length > 0);
            if (pathKeys.indexOf(name) < 0) {   // a plain field, like before
                const val = data ? data[name] : undefined;
                const opts = (needsValues || wantsArray) ? Object.assign({}, o, { values: needsValues ? baseValues() : o.values, array: wantsArray ? (Array.isArray(val) ? val : (val == null ? [] : null)) : undefined }) : o;
                const r = checkRules(val, list, opts);
                if (!r.valid) fail(name, r);
                return;
            }
            const tokens = ruleTokens(name);
            if (!tokens) return;
            const entries = expandPath(data, tokens);
            const wild = tokens.some(isWild);
            const column = wild ? entries.map(e => (e.value == null ? '' : String(e.value).trim())) : undefined;
            const targets = targetsIn(list);
            entries.forEach((e, idx) => {
                const values = needsValues ? (targets.length ? Object.create(baseValues()) : baseValues()) : o.values;   // one shared copy: rows only add what they override
                targets.forEach(t => {   // the same row first
                    const tt = ruleTokens(t);
                    if (!tt) return;
                    const rel = expandPath(data, e.tokens.slice(0, -1).concat(tt));
                    if (rel.length && rel[0].value !== undefined) values[t] = rel[0].value;
                });
                const val = e.value;
                const r = checkRules(val !== null && typeof val === 'object' && !Array.isArray(val) ? '' : (Array.isArray(val) ? '' : val), list,
                    Object.assign({}, o, { values, column, index: idx, array: wantsArray ? (Array.isArray(val) ? val : (val == null ? [] : null)) : undefined }));
                if (!r.valid) fail(canonKey(e.tokens), r);
            });
        });
        return { valid: Object.keys(errors).length === 0, errors, details };
    }

    // ------------------------------------------------------------------ schema: the rules as a Standard Schema (https://standardschema.dev)
    /** What parse() throws: `error.issues` is the Standard Schema issue list, `error.errors` is { field: message }. */
    /** { field: first message } from Standard Schema issues; nested paths are keyed 'items[1].qty'. */
    function errorsOfIssues(issues) {
        const errors = {};
        issues.forEach(i => { const k = i.path && i.path.length ? (i.path.length === 1 ? i.path[0] : canonKey(i.path)) : undefined; if (k !== undefined && k !== null && !(k in errors)) errors[k] = i.message; });
        return errors;
    }
    class ValidationError extends Error {
        constructor(issues) {
            super(issues.length ? issues[0].message : 'Validation failed');
            this.name = 'ValidationError';
            this.issues = issues;
            this.errors = errorsOfIssues(issues);
        }
    }

    /**
     * The rules of an object as ONE schema that every Standard Schema consumer understands (React Hook Form, TanStack Form, Hono, tRPC, ...):
     *   const signup = FormValidator.schema({ email: ['required', 'email'], password: { required: true, pwcheck: { minLength: 8 } }, confirm: { equalTo: 'password' } });
     *   signup.parse(req.body)       -> { email, password, confirm } (trimmed text) or throws ValidationError
     *   signup.safeParse(req.body)   -> { success: true, data } | { success: false, error, errors: { confirm: 'Values do not match.' }, issues }
     *   signup['~standard'].validate(value)    -> { value } | { issues: [{ message, path: ['confirm'], rule: 'equalTo' }] }
     * Same engine and same messages as checkValues(): no file, checkbox-count or remote rules, synchronous. Fields that are not in the rules are dropped from `data`.
     * options: the checkValues options (trim, messages, passwordStrength, context).
     */
    function schema(rulesMap, options) {
        const rules = rulesMap && typeof rulesMap === 'object' ? rulesMap : {};
        const fields = Object.keys(rules);
        const keepsRaw = Object.create(null), compiled = Object.create(null);
        fields.forEach(f => { compiled[f] = normalizeRules(rules[f]); keepsRaw[f] = compiled[f].some(r => { const d = validators[r.type]; return !!(d && d.raw); }); });   // rules are read once; passwords are never trimmed
        const o = options || {};

        const pathFields = fields.filter(f => hasPathChars(f));
        const meta = { keys: fields, pathKeys: pathFields, by: Object.create(null) };   // what runValues would otherwise work out on every call
        fields.forEach(f => { meta.by[f] = { wantsArray: compiled[f].some(r => r.type === 'minItems' || r.type === 'maxItems'), needsValues: compiled[f].some(r => ruleTargetNames(r).length > 0) }; });
        function run(input) {
            if (input === null || typeof input !== 'object' || Array.isArray(input)) return { issues: [{ message: 'Expected an object.', path: [] }] };
            const data = Object.assign({}, input);
            fields.forEach(f => { if (pathFields.indexOf(f) < 0 && data[f] == null) data[f] = ''; });     // a field that is not there is blank (equalTo may point at it)
            const res = runValues(data, compiled, o, true, meta);
            if (!res.valid) {
                const issues = Object.keys(res.errors).map(k => {
                    const tokens = pathFields.length && (hasPathChars(k) && !(k in input)) ? (ruleTokens(k) || [k]) : [k];
                    return { message: res.errors[k], path: tokens, rule: res.details[k].rule, code: res.details[k].code };
                });
                // flat fields keep the order of the rules, nested ones follow
                const order = k => { const i = fields.indexOf(k); return i < 0 ? fields.length : i; };
                issues.sort((x, y) => order(x.path.length === 1 ? x.path[0] : '') - order(y.path.length === 1 ? y.path[0] : ''));
                return { issues };
            }
            const value = {};
            fields.forEach(f => {
                if (pathFields.indexOf(f) < 0) { const raw = input[f] == null ? '' : String(input[f]); value[f] = keepsRaw[f] || o.trim === false ? raw : raw.trim(); return; }
                const tokens = ruleTokens(f);
                if (!tokens) return;
                expandPath(input, tokens).forEach(e => {
                    if (e.value !== null && typeof e.value === 'object') return;
                    const raw = e.value == null ? '' : String(e.value);
                    let node = value;
                    e.tokens.forEach((t, i) => {
                        if (i === e.tokens.length - 1) { node[t] = keepsRaw[f] || o.trim === false ? raw : raw.trim(); return; }
                        if (node[t] === undefined || node[t] === null || typeof node[t] !== 'object') node[t] = typeof e.tokens[i + 1] === 'number' ? [] : {};
                        node = node[t];
                    });
                });
            });
            return { value };
        }

        const api = {
            '~standard': { version: 1, vendor: 'form-and-file-validator', validate: run },
            rules,
            fields,
            safeParse(data) {
                const r = run(data);
                if (!r.issues) return { success: true, data: r.value, errors: {}, issues: [] };
                const issues = r.issues, errors = errorsOfIssues(issues);
                let error = null;   // an Error object is only built (and its stack captured) when somebody reads it: safeParse stays cheap on invalid data
                return { success: false, get error() { return error || (error = new ValidationError(issues)); }, errors, issues };
            },
            parse(data) {
                const r = run(data);
                if (r.issues) throw new ValidationError(r.issues);
                return r.value;
            },
            check: data => runValues(data, compiled, o, true, meta)
        };
        return api;
    }

    // ------------------------------------------------------------------ parseFormData: flat form fields -> nested object
    const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
    const MAX_INDEX = 999, MAX_DEPTH = 20;
    /** "a.b[0].c" -> ['a','b',0,'c'];  "tags[]" -> ['tags','']  ('' = append);  "a[b]" -> ['a','b']. null when the key is unusable or unsafe. */
    function pathTokens(key) {
        const out = [], re = /([^.[\]]+)|\[([^\]]*)\]/g;
        let m, last = 0;
        while ((m = re.exec(key))) {
            const dotted = key.charAt(m.index - 1) === '.' && m.index === last + 1 && out.length > 0;
            if (m.index !== last && !dotted) return null;   // stray "]" or "." where a name should start
            last = re.lastIndex;
            let name = m[1] !== undefined ? m[1] : m[2];
            if (m[1] === undefined && out.length === 0) return null;   // key cannot start with [
            if (m[1] === undefined && /^[0-9]+$/.test(name)) { if (+name > MAX_INDEX) return null; name = +name; }
            else if (m[1] === undefined && name === '') name = '';
            else if (BAD_KEYS.indexOf(name) >= 0) return null;
            out.push(name);
        }
        return out.length && out.length <= MAX_DEPTH && last === key.length ? out : null;
    }
    const NUMERIC_TEXT = /^-?(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,15})?$/;
    function coerceText(v) {
        if (typeof v !== 'string') return v;
        if (v === 'true') return true;
        if (v === 'false') return false;
        return NUMERIC_TEXT.test(v) ? Number(v) : v;
    }
    /**
     * Turns the flat fields of a <form>, FormData, URLSearchParams, an entry list or a plain { 'a.b[0]': value } object into the nested object your schema expects.
     *   name="user.email"  -> { user: { email } }      name="items[0].qty" -> { items: [{ qty }] }      name="tags[]" -> { tags: [...] }
     *   the same name twice (checkbox groups, multiple selects) -> an array         keys like __proto__ or items[100000] are dropped
     * Options: { coerce: true } turns "42", "3.5", "true", "false" into numbers and booleans (text such as "007" stays text, so zip codes survive).
     */
    function parseFormData(input, options) {
        const o = options || {};
        let entries;
        if (input && typeof input.elements === 'object' && typeof FormData === 'function') entries = Array.from(new FormData(input).entries());
        else if (Array.isArray(input)) entries = input;
        else if (input && typeof input.entries === 'function') entries = Array.from(input.entries());
        else if (input && typeof input[Symbol.iterator] === 'function') entries = Array.from(input);
        else if (input && typeof input === 'object') entries = Object.keys(input).map(k => [k, input[k]]);
        else entries = [];
        const root = {};
        for (const pair of entries) {
            const tokens = pathTokens(String(pair[0]));
            if (!tokens) continue;
            const value = o.coerce ? coerceText(pair[1]) : pair[1];
            let node = root;
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i], isLast = i === tokens.length - 1;
                if (Array.isArray(node) && t === '') { if (isLast) node.push(value); else { const c = typeof tokens[i + 1] === 'number' || tokens[i + 1] === '' ? [] : {}; node.push(c); node = c; } continue; }
                if (isLast) {
                    if (!Object.prototype.hasOwnProperty.call(node, t)) node[t] = value;
                    else if (Array.isArray(node[t])) node[t].push(value);
                    else node[t] = [node[t], value];
                    continue;
                }
                const next = tokens[i + 1];
                let child = Object.prototype.hasOwnProperty.call(node, t) ? node[t] : undefined;
                if (child === null || typeof child !== 'object' || (typeof next === 'number' || next === '' ? !Array.isArray(child) : Array.isArray(child))) {
                    child = typeof next === 'number' || next === '' ? [] : {};
                    node[t] = child;
                }
                node = child;
            }
        }
        return root;
    }

    // ------------------------------------------------------------------ server errors: any backend's validation response -> { field: message }
    /** Canonical field key: 'items.0.qty', 'items[0][qty]' and ['items', 0, 'qty'] all become 'items[0].qty'. null for unsafe keys. */
    function canonKey(key) {
        let tokens;
        if (Array.isArray(key)) {
            tokens = key.map(p => (typeof p === 'number' ? p : (/^[0-9]+$/.test(String(p)) ? +p : String(p))));
            if (tokens.some(p => typeof p === 'string' && BAD_KEYS.indexOf(p) >= 0)) return null;
        } else {
            const s = String(key);
            tokens = pathTokens(s);
            if (!tokens) tokens = s.split('.').filter(Boolean).some(p => BAD_KEYS.indexOf(p) >= 0) ? null : [s];
            else tokens = tokens.map(p => (typeof p === 'string' && /^[0-9]+$/.test(p) ? +p : p));
        }
        if (!tokens || !tokens.length) return null;
        let out = '';
        tokens.forEach((t, i) => { out += typeof t === 'number' ? '[' + t + ']' : t === '' ? '[]' : (i ? '.' : '') + t; });
        return out;
    }
    /** Path parts of a response key, or null when a part is unsafe (__proto__ ...). */
    function keyParts(key) {
        const t = pathTokens(key);
        if (t) return t.some(p => typeof p === 'string' && BAD_KEYS.indexOf(p) >= 0) ? null : t;
        return String(key).split(/[.\[\]]/).some(p => BAD_KEYS.indexOf(p) >= 0) ? null : [key];
    }
    const MESSAGE_KEYS = ['message', 'msg', 'detail', 'title', 'description', 'error', 'reason'];
    const MESSAGE_OBJECT_KEYS = ['message', 'msg', 'code', 'type', 'detail', 'title', 'description', 'error', 'reason', 'field', 'path', 'rule', 'ctx', 'input', 'url', 'severity', 'params', 'keyword', 'schemaPath'];
    /** A string for a message-like value (string, number, { message }), else null. */
    function messageText(m, depth) {
        if (typeof m === 'string') return m.trim() || null;
        if (typeof m === 'number' && isFinite(m)) return String(m);
        if (m && typeof m === 'object' && !Array.isArray(m) && (depth || 0) < 2) {
            for (const k of MESSAGE_KEYS) { const t = messageText(m[k], (depth || 0) + 1); if (t) return t; }
        }
        return null;
    }
    const isMessageObject = o => o && typeof o === 'object' && !Array.isArray(o) && messageText(o) !== null && Object.keys(o).every(k => MESSAGE_OBJECT_KEYS.indexOf(k) >= 0);
    const FORM_KEYS = ['non_field_errors', '__all__', 'nonFieldErrors', 'formErrors', 'detail', '$', ''];
    const META_KEYS = ['message', 'Message', 'error', 'detail', 'title', 'status', 'statusCode', 'code', 'type', 'success', 'ok', 'path', 'timestamp', 'instance', 'trace', 'traceId', 'name'];
    const LOCATIONS = ['body', 'query', 'path', 'header', 'cookie', 'form'];
    /** '#/a/0/b' or '/data/attributes/email' -> ['a', 0, 'b'] / ['email'] */
    function pointerParts(p) {
        let parts = String(p).replace(/^#/, '').split('/').filter(s => s !== '').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
        if (parts[0] === 'data' && parts.length > 1) { parts = parts.slice(1); if (parts[0] === 'attributes' || parts[0] === 'relationships') parts = parts.slice(1); }
        return parts;
    }
    /**
     * Reads the validation response of any common backend into one shape:
     *   { format, errors: { 'items[0].qty': 'First message' }, all: { 'items[0].qty': ['First', 'Second'] }, form: ['Message that belongs to no field'] }
     * Understood (detected from the body, or forced with options.format): RFC 9457 problem+json, ASP.NET Core ValidationProblemDetails and classic ModelState,
     * Laravel / Rails ({ errors: { field: [..] } }), Django REST framework (field lists, non_field_errors, nested serializers and list errors), FastAPI / Pydantic
     * ({ detail: [{ loc, msg }] }), Zod (issues, flatten()), Standard Schema issue lists, express-validator, JSON:API ({ errors: [{ source: { pointer } }] }), Ajv.
     * `body` may be the parsed JSON, a JSON string or an array of issues. Anything else gives an empty result. Never throws.
     */
    function serverErrors(body, options) {
        const o = options || {}, res = { format: 'none', errors: {}, all: {}, form: [] };
        let count = 0;
        const add = (key, msgs) => {
            if (count > 2000) return;
            const list = [].concat(msgs).map(m => messageText(m)).filter(m => m !== null);
            if (!list.length) return;
            const k = key === null || key === undefined ? null : (Array.isArray(key) ? canonKey(key) : (key === '' ? null : canonKey(key)));
            if (k === null) { if (key === null || key === undefined || key === '' || (Array.isArray(key) && !key.length)) list.forEach(m => { res.form.push(m); count++; }); return; }
            if (!Object.prototype.hasOwnProperty.call(res.all, k)) res.all[k] = [];
            list.forEach(m => { res.all[k].push(m); count++; });
        };
        // { key: message | [messages] | { nested } | [ { nested }, ... ] } -> add() for every leaf
        const walk = (obj, parts, depth) => {
            if (!obj || typeof obj !== 'object' || depth > 12 || count > 2000) return;
            Object.keys(obj).forEach(key => {
                const kp = keyParts(key);   // 'items.0.name' / 'a[b]' are paths, not one long name
                if (!kp) return;
                const v = obj[key], here = parts.concat(kp);
                const isForm = parts.length === 0 && FORM_KEYS.indexOf(key) >= 0;
                const target = isForm ? null : here;
                if (messageText(v) !== null && !(v && typeof v === 'object')) { add(target, v); return; }
                if (Array.isArray(v)) {
                    if (v.every(x => typeof x === 'string' || typeof x === 'number' || isMessageObject(x))) { add(target, v); return; }
                    v.forEach((item, i) => {
                        if (typeof item === 'string' || typeof item === 'number' || isMessageObject(item)) add(target, item);
                        else if (item && typeof item === 'object') walk(item, here.concat([i]), depth + 1);
                    });
                    return;
                }
                if (v && typeof v === 'object') {
                    if (isMessageObject(v)) add(target, v);
                    else walk(v, here, depth + 1);
                }
            });
        };
        // [ { path | pointer | loc | param | field | name | instancePath, message | msg | detail } ]
        const issues = list => {
            list.forEach(it => {
                if (typeof it === 'string') { add(null, it); return; }
                if (!it || typeof it !== 'object') return;
                let key = null;
                if (Array.isArray(it.path)) key = it.path.map(p => (p && typeof p === 'object' && 'key' in p ? p.key : p));
                else if (Array.isArray(it.loc)) key = LOCATIONS.indexOf(String(it.loc[0])) >= 0 ? it.loc.slice(1) : it.loc;
                else if (it.source && typeof it.source === 'object' && typeof it.source.pointer === 'string') key = pointerParts(it.source.pointer);
                else if (it.source && typeof it.source === 'object' && typeof it.source.parameter === 'string') key = [it.source.parameter];
                else if (typeof it.pointer === 'string') key = pointerParts(it.pointer);
                else if (typeof it.instancePath === 'string') key = pointerParts(it.instancePath);
                else if (typeof it.dataPath === 'string') key = canonKey(it.dataPath.replace(/^\./, ''));
                else {
                    const k = it.path !== undefined ? it.path : it.param !== undefined ? it.param : it.field !== undefined ? it.field : it.name !== undefined ? it.name : it.property;
                    if (typeof k === 'string' && k !== '') key = [k];
                }
                if (typeof key === 'string') key = [key];
                if (key && key.some(p => p && typeof p === 'object')) key = null;
                const text = messageText(it.message) || messageText(it.msg) || messageText(it.detail) || messageText(it.title) || messageText(it.error) || messageText(it.description);
                if (text) add(key && key.length ? key : null, text);
            });
        };
        let data = body;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = null; } }
        const fmt = String(o.format || 'auto').toLowerCase();
        try {
            if (Array.isArray(data)) { res.format = 'issues'; issues(data); }
            else if (data && typeof data === 'object') {
                const generic = () => {
                    // top level { title, detail, message } says what went wrong when no field is named
                    if (!Object.keys(res.all).length) ['detail', 'title', 'message', 'Message', 'error'].some(k => { const t = messageText(data[k]); if (t) { res.form.push(t); return true; } return false; });
                };
                if ((fmt === 'auto' || fmt === 'aspnet' || fmt === 'modelstate') && data.ModelState && typeof data.ModelState === 'object') {
                    res.format = 'aspnet-modelstate';
                    const ms = {};
                    Object.keys(data.ModelState).forEach(k => { ms[k.replace(/^(?:model|\$)\./i, '')] = data.ModelState[k]; });
                    walk(ms, [], 0);
                    generic();
                } else if ((fmt === 'auto' || fmt === 'zod' || fmt === 'issues' || fmt === 'standard') && Array.isArray(data.issues)) { res.format = 'issues'; issues(data.issues); }
                else if ((fmt === 'auto' || fmt === 'zod') && data.fieldErrors && typeof data.fieldErrors === 'object') { res.format = 'zod'; walk(data.fieldErrors, [], 0); [].concat(data.formErrors || []).forEach(m => add(null, m)); }
                else if ((fmt === 'auto' || fmt === 'fastapi' || fmt === 'issues') && Array.isArray(data.detail) && data.detail.some(x => x && typeof x === 'object')) { res.format = 'fastapi'; issues(data.detail); }
                else if ((fmt === 'auto' || fmt === 'jsonapi' || fmt === 'express-validator' || fmt === 'issues') && Array.isArray(data.errors)) { res.format = 'issues'; issues(data.errors); generic(); }
                else if ((fmt === 'auto' || fmt === 'problem' || fmt === 'laravel' || fmt === 'rails' || fmt === 'aspnet') && data.errors && typeof data.errors === 'object') {
                    res.format = fmt === 'auto' ? (data.type !== undefined || data.status !== undefined || data.title !== undefined ? 'problem+json' : 'errors-map') : fmt;
                    walk(data.errors, [], 0);
                    generic();
                } else if (fmt === 'auto' || fmt === 'drf' || fmt === 'map') {
                    if (fmt === 'auto' && Object.keys(data).every(k => META_KEYS.indexOf(k) >= 0)) generic();   // { message: 'Server error' } names no field
                    else walk(data, [], 0);
                    if (Object.keys(res.all).length || res.form.length) res.format = 'field-map';
                }
                if (res.format === 'none' && (fmt === 'auto') && !Object.keys(res.all).length && !res.form.length) generic();
                if (res.format === 'none' && (Object.keys(res.all).length || res.form.length)) res.format = 'generic';
            }
        } catch (e) { /* hostile or cyclic input: whatever was collected stays */ }
        Object.keys(res.all).forEach(k => { res.errors[k] = res.all[k][0]; });
        return res;
    }

    // ------------------------------------------------------------------ precognition: ask the real endpoint "would this pass?" without saving anything
    function flattenValues(values, into, prefix, depth) {
        Object.keys(values || {}).forEach(k => {
            if (BAD_KEYS.indexOf(k) >= 0) return;
            const v = values[k], name = prefix ? prefix + (/^[0-9]+$/.test(k) ? '[' + k + ']' : '.' + k) : k;
            const isBlob = typeof Blob === 'function' && v instanceof Blob;
            if (v && typeof v === 'object' && !isBlob && depth < 8) flattenValues(v, into, name, depth + 1);
            else if (v !== undefined && v !== null) into.push([name, v]);
            else if (v === null) into.push([name, '']);
        });
        return into;
    }
    /**
     * FormValidator.precognition(url, values, options): sends the values to the real endpoint with `Precognition: true` (Laravel Precognition protocol) and answers
     * { valid, status, errors, all, form, only, error?, aborted? }. The endpoint must validate and then stop (Laravel answers 204 / 422). Never throws:
     * `valid` is true (2xx), false (field errors), or null when the check could not be made (network, timeout, 5xx, unreadable answer: see `error`) or was cancelled
     * (`aborted: true`). Options: method (POST), only (field names to report), headers, credentials, encoding ('json' | 'form' | 'multipart', files pick multipart),
     * timeout (10000 ms), signal, fetch, format (see serverErrors).
     */
    async function precognition(url, values, options) {
        const o = options || {};
        const only = o.only === undefined ? null : [].concat(o.only).map(String);
        const method = String(o.method || 'POST').toUpperCase();
        const doFetch = o.fetch || (typeof fetch === 'function' ? fetch : null);
        const result = (extra) => Object.assign({ valid: null, status: 0, errors: {}, all: {}, form: [], only }, extra);
        if (!doFetch) return result({ error: new Error('precognition: no fetch available (pass options.fetch)') });
        if (!url) return result({ error: new Error('precognition: url is required') });
        const headers = Object.assign({ 'Accept': 'application/json', 'Precognition': 'true' }, o.headers);
        if (only) headers['Precognition-Validate-Only'] = only.join(',');
        const entries = flattenValues(values, [], '', 0);
        const hasFile = entries.some(e => typeof Blob === 'function' && e[1] instanceof Blob);
        const encoding = o.encoding || (hasFile ? 'multipart' : 'json');
        let target = String(url), body;
        if (method === 'GET' || method === 'HEAD') {
            const qs = new URLSearchParams();
            entries.forEach(e => { if (!(typeof Blob === 'function' && e[1] instanceof Blob)) qs.append(e[0], String(e[1])); });
            const s = qs.toString();
            if (s) target += (target.indexOf('?') >= 0 ? '&' : '?') + s;
        } else if (encoding === 'multipart') {
            body = new FormData();
            entries.forEach(e => body.append(e[0], e[1]));
        } else if (encoding === 'form') {
            body = new URLSearchParams(entries.map(e => [e[0], String(e[1])])).toString();
            headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
        } else {
            body = JSON.stringify(values || {});
            headers['Content-Type'] = 'application/json';
        }
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        let timedOut = false;
        const timer = ctrl ? setTimeout(() => { timedOut = true; ctrl.abort(); }, o.timeout || 10000) : null;
        const onAbort = () => ctrl && ctrl.abort();
        if (o.signal) { if (o.signal.aborted) onAbort(); else if (o.signal.addEventListener) o.signal.addEventListener('abort', onAbort, { once: true }); }
        try {
            const resp = await doFetch(target, { method, headers, body, credentials: o.credentials, signal: ctrl ? ctrl.signal : undefined });
            const status = resp.status;
            if (status >= 200 && status < 300) return result({ valid: true, status });
            let data = null;
            try { data = await resp.json(); } catch (e) { /* no JSON body */ }
            const parsed = serverErrors(data, { format: o.format });
            const hasErrors = Object.keys(parsed.all).length > 0;
            const filter = m => { if (!only) return m; const out = {}; Object.keys(m).forEach(k => { if (only.some(n => canonKey(n) === k)) out[k] = m[k]; }); return out; };
            if ((status === 422 || status === 400 || status === 409) && (hasErrors || parsed.form.length)) {
                const all = filter(parsed.all), errors = {};
                Object.keys(all).forEach(k => { errors[k] = all[k][0]; });
                // when only some fields were asked for and none of them failed, the answer for those fields is "valid"
                return result({ valid: Object.keys(all).length === 0 && only ? true : false, status, errors, all, form: parsed.form, format: parsed.format, rawErrors: parsed.errors });
            }
            return result({ status, error: new Error('precognition: HTTP ' + status), form: parsed.form });
        } catch (e) {
            if (e && e.name === 'AbortError' && !timedOut) return result({ aborted: true });
            return result({ error: timedOut ? new Error('precognition: timed out') : e });
        } finally {
            if (timer) clearTimeout(timer);
            if (o.signal && o.signal.removeEventListener) o.signal.removeEventListener('abort', onAbort);
        }
    }

    // ------------------------------------------------------------------ action: one function for React 19 useActionState / Server Actions / any FormData handler
    /**
     * FormValidator.action(rules, serverFn, options) -> async (previousState, formData) => state, the shape React 19's useActionState wants.
     *   state = { ok, values, errors: { field: message }, form: [messages], result }
     * It reads the form fields, checks them with the rules (same engine as schema()) and only then calls serverFn(validatedValues, formData). `values` hands back
     * what was typed (never passwords, never files) so the inputs can be filled again after React resets the form. serverFn may return { errors } (or a backend
     * response body, see serverErrors) to show server-side messages; any other return value arrives as `result`. Errors thrown by serverFn are not swallowed.
     * Works without JavaScript on the page (Server Actions) because the same function runs on the server.
     */
    function action(rulesOrSchema, serverFn, options) {
        const o = options || {};
        const sch = rulesOrSchema && rulesOrSchema['~standard'] && rulesOrSchema.rules ? rulesOrSchema : schema(rulesOrSchema || {}, o);
        const names = sch.fields;
        const secret = rules => [].concat(rules).some(r => r === 'pwcheck' || (r && typeof r === 'object' && ('pwcheck' in r || r.type === 'pwcheck')));
        const secretNames = new Set(names.filter(n => secret(sch.rules[n])).concat(o.omitValues || []));
        const read = fd => {
            const data = {};
            names.forEach(n => {
                let v;
                if (fd && typeof fd.getAll === 'function') { const all = fd.getAll(n).filter(x => typeof x === 'string'); v = all.length > 1 ? all : all[0]; }
                else if (fd && typeof fd === 'object') v = fd[n];
                if (Array.isArray(v)) v = v.join(o.join === undefined ? ',' : o.join);
                if (v !== undefined) data[n] = v;
            });
            return data;
        };
        const keep = data => { const out = {}; Object.keys(data).forEach(n => { if (!secretNames.has(n) && typeof data[n] === 'string') out[n] = data[n]; }); return out; };
        const run = async (prev, formData) => {
            const input = read(formData), values = keep(input);
            const r = sch.safeParse(input);
            if (!r.success) return { ok: false, values, errors: r.errors, form: [], result: undefined };
            if (!isFn(serverFn)) return { ok: true, values, errors: {}, form: [], result: undefined };
            const out = await serverFn(r.data, formData, prev);
            if (out && typeof out === 'object') {
                const se = (out.errors && typeof out.errors === 'object' && !Array.isArray(out.errors) && Object.keys(out.errors).every(k => messageText(out.errors[k]) !== null || Array.isArray(out.errors[k]))) ? serverErrors({ errors: out.errors }) : (out.errors || out.issues || out.fieldErrors || out.ModelState ? serverErrors(out) : null);
                if (se && (Object.keys(se.all).length || se.form.length)) return { ok: false, values, errors: se.errors, form: se.form, result: out };
            }
            return { ok: true, values, errors: {}, form: [], result: out };
        };
        run.initialState = { ok: false, values: {}, errors: {}, form: [], result: undefined };
        return run;
    }

    // `__FV_CORE__` does not exist in the normal build. The "core" build (dist/formValidator.core.min.js, tools/build-subset.js) defines it as true, which lets the
    // minifier drop the whole form engine and everything only it uses: what is left checks values, schemas and server answers without a DOM.
    const CORE = typeof __FV_CORE__ === 'boolean' && __FV_CORE__;
    return Object.assign({
        parseFormData, // (formData | form | entries | object, { coerce? }) -> nested object: 'a.b[0].c' -> { a: { b: [{ c }] } }
        serverErrors,  // (response body, { format? }) -> { errors, all, form, format } from problem+json, Laravel, DRF, ASP.NET, FastAPI, Zod ...
        precognition,  // async (url, values, { only, method, ... }) -> { valid, errors, ... }: ask the real endpoint whether the values would pass
        action,        // (rules, serverFn) -> (prevState, formData) => state, for React 19 useActionState and Server Actions
        schema,        // (rules, options?) -> Standard Schema with parse / safeParse / check
        ValidationError,
        checkValue,
        checkValues,
        maskPattern,   // ('(999) 999-9999') -> RegExp of a complete masked value
        unmaskValue,   // (value, pattern) -> the typed characters without the mask's literals
        parseRules,    // ('required email minlength:3') -> rules, the text format of data-fv and <fv-field rules>
        isBotSubmission, // (body, { honeypot, timestampField, minTimeMs }) -> { bot, reason }: the server side of antiBot
        explain,       // (value, rules, options?) -> [{ rule, code, param, passed, message?, skipped? }]: why a value passes or fails, rule by rule
        registerRule,
        addMethod,
        format,
        getRule: name => validators[name] || null,
        ruleNames: () => Object.keys(validators),   // every registered rule, built in and custom
        messages: DEFAULT_MESSAGES,     // mutable: FormValidator.messages.required = 'Pflichtfeld'
        version: '2.15.0'
    }, CORE ? {} : {
        init,
        mask,          // (input, '(999) 999-9999', { onComplete, trailing }) -> { value, raw, complete, update, destroy }: format while typing
        auto,          // (config?) -> stop: start validators from data-fv attributes, now and for forms added later
        unobtrusive,   // ASP.NET data-val-* support: unobtrusive.parse(scope), .auto(), .adapters.add / addBool / addSingleVal / addMinMax
        validate,      // async (form, rules?) -> true / false (waits for remote and file checks)
        isValid,       // sync (form, rules?) -> true / false, like jQuery's valid()
        remoteDefaults: REMOTE_DEFAULTS,
        addClassRules,
        setDefaults: obj => Object.assign(DEFAULTS, obj),
        defaults: DEFAULTS,             // mutable global defaults
        getInstance: t => { const f = resolveForm(t); return f ? f._fvInstance || null : null; }
    });
});

    };

    mods["formValidator.element"] = function (module, exports, require, define) {
/*!
 * FormValidator element v1.0.0 — <fv-field>: any FormValidator rule as native constraint validation, in plain HTML, no init call.
 *
 *   <form>
 *     <fv-field rules="required email">
 *       <label for="e">Email</label>
 *       <input id="e" name="email">
 *     </fv-field>
 *     <fv-field rules="required pwcheck" ...>                     <!-- rule names, optionally with a parameter:  minlength:3  range:1,10  pattern:^[A-Z]+$  -->
 *     <fv-field rules='[{"type":"minDate","min":"2020-01-01"}]'>  <!-- or JSON: a list, or the map shorthand {"minlength":3,"equalTo":"password"} -->
 *     <fv-field rules="required" server="/signup">                <!-- ask your real endpoint (Precognition) when the user leaves the field -->
 *   </form>
 *
 * The rules run on the native control inside the element and are handed to the browser with setCustomValidity(), so form.checkValidity(), reportValidity(),
 * a blocked submit, the native :user-invalid / :user-valid pseudo-classes and the browser's own bubble all follow them. Reward early, punish late is the
 * browser's own rule for :user-invalid; the message under the field follows it too: it appears after the user leaves the field (or tries to submit) and
 * disappears the moment the value is right. Messages, language packs and cross-field rules (equalTo / notEqualTo read the other fields of the form) are the
 * engine's. Radio groups, checkbox groups, selects and textareas work. ElementInternals is used for the custom states :state(user-invalid) and
 * :state(user-valid) when the browser has it; nothing depends on it.
 *
 * Note: like the native pseudo-classes, checkValidity() fires the `invalid` event, and a field that gets one shows its message (so does reportValidity() and a blocked submit).
 *
 * mask="(999) 999-9999" formats the input while typing (FormValidator.mask) and asks for a complete value.
 *
 * Attributes: rules, mask, messages (JSON { rule: text }), server (URL), server-encoding ('form' default | 'json'), server-delay (ms, 300), native-bubble (keep the
 * browser's own bubble instead of our inline message), control (CSS selector when the field is not the first input inside).
 * Properties and methods: rules, messages, control, controls, value, validity, validationMessage, willValidate, checkValidity(), reportValidity(), validate(), reset(),
 * setServerError(text). Event: `fv-validate` (bubbles) with detail { valid, rule, code, message, shown }.
 * Styling: .fv-error (the message), [data-state="valid|invalid"] and [data-shown] on the element, input:user-invalid / fv-field:state(user-invalid).
 *
 * Needs FormValidator (the bundle, or formValidator.js): registered as <fv-field> when it loads; FormValidator.fieldElement.define('my-field') uses another name.
 *
 * Changelog
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['./formValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, require('./formValidator.js'));
    else factory(root, root.FormValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';
    if (!FV) throw new Error('formValidator.element.js needs FormValidator loaded first');

    const DEFAULT_NAME = 'fv-field';
    let uid = 0;
    const warned = new Set();
    const warnOnce = (key, text) => { if (!warned.has(key)) { warned.add(key); if (root.console && console.warn) console.warn(text); } };

    /** 'required email minlength:3 pattern:^a:b$' | '["required"]' | '{"minlength":3}' -> rules for checkValue, or null */
    function parseRules(text) {
        if (typeof FV.parseRules === 'function' && !/^\s*[\[{]/.test(String(text))) return FV.parseRules(text);
        const s = String(text === null || text === undefined ? '' : text).trim();
        if (!s) return null;
        if (s.charAt(0) === '[' || s.charAt(0) === '{') {
            try { return JSON.parse(s); } catch (e) { warnOnce('json:' + s, 'fv-field: the rules attribute is not valid JSON and is ignored: ' + s); return null; }
        }
        const map = {};
        s.split(/\s+/).forEach(tok => {
            const i = tok.indexOf(':');
            const name = i < 0 ? tok : tok.slice(0, i);
            if (!name || name === '__proto__' || name === 'constructor' || name === 'prototype') return;
            map[name] = i < 0 ? true : tok.slice(i + 1);
        });
        return Object.keys(map).length ? map : null;
    }
    const isCustom = el => !!el.localName && el.localName.indexOf('-') > 0;
    const targetsOf = rules => {
        const out = [];
        const visit = r => {
            if (!r) return;
            if (Array.isArray(r)) { r.forEach(visit); return; }
            if (typeof r !== 'object') return;
            if (r.type) { if ((r.type === 'equalTo' || r.type === 'notEqualTo') && r.target) out.push(String(r.target).replace(/^#/, '')); return; }
            ['equalTo', 'notEqualTo'].forEach(k => {
                if (typeof r[k] === 'string') out.push(r[k].replace(/^#/, ''));
                else if (r[k] && typeof r[k] === 'object' && r[k].target) out.push(String(r[k].target).replace(/^#/, ''));
            });
        };
        visit(rules);
        return out;
    };

    function createClass() {
        const Base = root.HTMLElement;
        class FvField extends Base {
            static get formAssociated() { return true; }
            static get observedAttributes() { return ['rules', 'messages', 'server', 'control', 'mask']; }

            constructor() {
                super();
                this._rules = undefined;        // set through the property: wins over the attribute
                this._messages = undefined;
                this._touched = false;
                this._dirty = false;            // the user typed or picked something (even if it is empty again)
                this._submitted = false;
                this._shown = false;
                this._result = { valid: true, rule: null, code: null, message: '' };
                this._serverMsg = '';
                this._serverFor = null;
                this._token = 0;
                this._timer = null;
                this._abort = null;
                this._cleanups = [];
                this._err = null;
                this._internals = null;
                try { this._internals = typeof this.attachInternals === 'function' ? this.attachInternals() : null; } catch (e) { this._internals = null; }
            }

            // ---------------------------------------------------------------- lifecycle
            connectedCallback() {
                this._form = this.closest ? this.closest('form') : null;
                const on = (el, type, fn, cap) => { if (!el) return; el.addEventListener(type, fn, cap); this._cleanups.push(() => el.removeEventListener(type, fn, cap)); };
                on(this, 'input', e => this._onEvent(e, 'input'));
                on(this, 'change', e => this._onEvent(e, 'change'));
                on(this, 'focusout', e => this._onEvent(e, 'blur'));
                on(this, 'invalid', e => this._onInvalid(e), true);   // invalid does not bubble: capture it
                if (this._form) {
                    on(this._form, 'input', e => this._onSibling(e));
                    on(this._form, 'change', e => this._onSibling(e));
                    on(this._form, 'submit', () => { this._submitted = true; }, true);
                    on(this._form, 'reset', () => setTimeout(() => this.reset(), 0));
                }
                if (typeof root.MutationObserver === 'function') {
                    this._mo = new root.MutationObserver(records => {
                        // a control was added, removed or replaced; our own message element changing must not start a loop
                        const own = n => this._err && (n === this._err || this._err.contains(n));
                        if (records.every(r => own(r.target) || (Array.from(r.addedNodes).concat(Array.from(r.removedNodes)).every(own)))) return;
                        this._check(this._shown);
                    });
                    this._mo.observe(this, { childList: true, subtree: true });
                }
                this._bindMask();
                this._check(false);
            }
            _bindMask() {
                if (this._maskApi) { this._maskApi.destroy(); this._maskApi = null; }
                const pat = this.getAttribute('mask'), c = this.control;
                if (pat && c && typeof FV.mask === 'function' && c.tagName === 'INPUT') this._maskApi = FV.mask(c, pat);
            }
            disconnectedCallback() {
                if (this._maskApi) { this._maskApi.destroy(); this._maskApi = null; }
                this._cleanups.forEach(f => f()); this._cleanups = [];
                if (this._mo) { this._mo.disconnect(); this._mo = null; }
                clearTimeout(this._timer);
                if (this._abort) this._abort.abort();
                this._removeMessage();
                this._form = null;
            }
            attributeChangedCallback(name, oldValue, value) {
                if (oldValue === value || !this.isConnected) return;
                if (name === 'server') { this._serverMsg = ''; }
                if (name === 'mask' || name === 'control') this._bindMask();
                this._check(this._shown);
            }

            // ---------------------------------------------------------------- public API
            get rules() {
                const base = this._rules !== undefined ? this._rules : parseRules(this.getAttribute('rules'));
                const m = this.getAttribute('mask');
                if (!m) return base;
                // mask="(999) 999-9999" also asks for a complete value
                if (!base) return { mask: m };
                if (Array.isArray(base)) return base.concat([{ type: 'mask', pattern: m }]);
                if (typeof base === 'string') return [base, { type: 'mask', pattern: m }];
                if (base.type) return [base, { type: 'mask', pattern: m }];
                return Object.assign({}, base, { mask: m });
            }
            set rules(v) { this._rules = v === null ? undefined : v; if (this.isConnected) this._check(this._shown); }
            get messages() {
                if (this._messages !== undefined) return this._messages;
                const t = this.getAttribute('messages');
                if (!t) return undefined;
                try { const m = JSON.parse(t); return m && typeof m === 'object' ? m : undefined; } catch (e) { warnOnce('msg:' + t, 'fv-field: the messages attribute is not valid JSON and is ignored.'); return undefined; }
            }
            set messages(v) { this._messages = v === null ? undefined : v; if (this.isConnected) this._check(this._shown); }
            /** The native controls inside: one input / select / textarea, or the radios / checkboxes of a group. */
            get controls() {
                const sel = this.getAttribute('control');
                let list;
                try { list = Array.from(this.querySelectorAll(sel || 'input, select, textarea')); } catch (e) { list = []; }
                list = list.filter(c => c !== this && !/^(hidden|submit|button|reset|image)$/i.test(c.type || ''));
                const first = list[0];
                if (first && (first.type === 'radio' || first.type === 'checkbox') && first.name) return list.filter(c => c.type === first.type && c.name === first.name);
                return first ? [first] : [];
            }
            get control() { return this.controls[0] || null; }
            get form() { return this._internals && this._internals.form ? this._internals.form : (this.closest ? this.closest('form') : null); }
            get name() { const c = this.control; return c ? c.name : ''; }
            get type() { return 'fv-field'; }
            get value() { return this._text(); }
            get validity() { const c = this.control; return c ? c.validity : null; }
            get validationMessage() { const c = this.control; return c ? c.validationMessage : ''; }
            get willValidate() { const c = this.control; return !!c && c.willValidate; }
            checkValidity() { this._check(false); const c = this.control; return c ? c.checkValidity() : true; }
            /** Checks now, shows the message and focuses the control when it is invalid. Returns validity. */
            reportValidity() {
                this._touched = true;
                this._check(true);
                const c = this.control;
                const ok = !c || c.validity.valid;
                if (!ok) { try { c.focus(); } catch (e) { /* not focusable */ } }
                return ok;
            }
            /** Checks the value now and shows the message (sync rules; the server check runs on its own). Returns true when valid. */
            validate() { this._touched = true; this._check(true); return this._result.valid && !this._serverMessage(); }
            /** Back to untouched: no message, nothing shown (what a form reset does). */
            reset() { this._touched = false; this._dirty = false; this._submitted = false; this._serverMsg = ''; this._check(false); }
            /** Shows a message from the server on this field until the value changes. */
            setServerError(text) { this._serverMsg = text ? String(text) : ''; this._serverFor = this._text(); this._touched = true; this._check(true); }

            // ---------------------------------------------------------------- values
            _text() {
                const cs = this.controls, f = cs[0];
                if (!f) return '';
                if (f.type === 'radio') { const on = cs.find(c => c.checked); return on ? on.value : ''; }
                if (f.type === 'checkbox') return cs.filter(c => c.checked).map(c => c.value || 'on').join(',');
                if (f.tagName === 'SELECT' && f.multiple) return Array.from(f.selectedOptions).map(o => o.value).join(',');
                if (f.type === 'file') return f.files && f.files.length ? Array.from(f.files).map(x => x.name).join(', ') : '';
                return f.value === null || f.value === undefined ? '' : String(f.value);
            }
            _otherValues() {
                const out = {}, form = this.form;
                if (!form) return out;
                Array.from(form.elements).forEach(el => {
                    if (!el.name || el.disabled || this.contains(el) || isCustom(el)) return;
                    if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) { if (!(el.name in out)) out[el.name] = ''; return; }
                    if (el.type === 'file') { out[el.name] = el.files && el.files.length ? el.files[0].name : ''; return; }
                    out[el.name] = el.value === null || el.value === undefined ? '' : String(el.value);
                });
                return out;
            }

            // ---------------------------------------------------------------- checking
            _evaluate() {
                const rules = this.rules;
                const none = { valid: true, rule: null, code: null, message: '' };
                if (!rules || (Array.isArray(rules) && !rules.length)) return none;
                try {
                    return FV.checkValue(this._text(), rules, { values: this._otherValues(), messages: this.messages });
                } catch (e) {
                    if (/options\.values/.test(String(e && e.message))) return none;   // the other field is not in the form: no opinion
                    warnOnce('rule:' + (e && e.message), 'fv-field: ' + (e && e.message) + ' (this rule is ignored; use the server attribute for checks that need a server)');
                    return none;
                }
            }
            _serverMessage() {
                if (this._serverMsg && this._serverFor !== null && this._serverFor !== this._text()) { this._serverMsg = ''; }   // the value changed: the server's message is stale
                return this._serverMsg;
            }
            /** Runs the rules, hands the answer to the browser, and (when `show`) shows it. */
            _check(show) {
                const r = this._evaluate();
                this._result = r;
                const message = !r.valid ? r.message : this._serverMessage();
                const cs = this.controls;
                cs.forEach((c, i) => { if (typeof c.setCustomValidity === 'function') c.setCustomValidity(i === 0 ? message : ''); });
                const invalid = !!message;
                const showNow = !!show && invalid;
                this._shown = showNow;
                if (showNow) this._showMessage(message, !r.valid ? (r.code || r.rule) : 'server'); else this._removeMessage();
                this._reflect(invalid, showNow);
                if (!invalid && this.getAttribute('server') && this._text() !== '') this._scheduleServer(); else if (this._abort) { this._abort.abort(); this._abort = null; }
                this.dispatchEvent(new root.CustomEvent('fv-validate', { bubbles: true, detail: { valid: !invalid, rule: r.rule, code: !r.valid ? (r.code || r.rule) : (invalid ? 'server' : null), message, shown: showNow } }));
                return !invalid;
            }
            _reflect(invalid, shown) {
                this.setAttribute('data-state', invalid ? 'invalid' : 'valid');
                if (shown) this.setAttribute('data-shown', ''); else this.removeAttribute('data-shown');
                const st = this._internals && this._internals.states;
                if (st) {
                    const set = (name, on) => { try { if (on) st.add(name); else st.delete(name); } catch (e) { /* older engines want --names */ } };
                    set('invalid', invalid); set('valid', !invalid); set('user-invalid', shown); set('user-valid', this._touched && !invalid && this._text() !== '');
                }
            }
            _showMessage(message, code) {
                const D = this.ownerDocument;
                if (!this._err) {
                    this._err = D.createElement('div');
                    this._err.className = 'fv-error';
                    this._err.id = 'fv-field-error-' + (++uid);
                    this._err.setAttribute('role', 'alert');
                    this._err.setAttribute('dir', 'auto');
                }
                this._err.setAttribute('data-code', code || 'custom');
                this._err.textContent = message;
                if (this.hasAttribute('native-bubble')) return;
                const cs = this.controls, last = cs[cs.length - 1];
                if (this._err.parentNode !== this) {
                    if (last && last.parentNode === this) last.insertAdjacentElement('afterend', this._err); else this.appendChild(this._err);
                }
                cs.forEach(c => {
                    c.setAttribute('aria-invalid', 'true');
                    const ids = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
                    if (!ids.includes(this._err.id)) c.setAttribute('aria-describedby', ids.concat(this._err.id).join(' '));
                });
            }
            _removeMessage() {
                if (!this._err) return;
                const id = this._err.id;
                if (this._err.parentNode) this._err.parentNode.removeChild(this._err);
                this.controls.forEach(c => {
                    c.removeAttribute('aria-invalid');
                    const ids = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter(x => x && x !== id);
                    if (ids.length) c.setAttribute('aria-describedby', ids.join(' ')); else c.removeAttribute('aria-describedby');
                });
            }

            // ---------------------------------------------------------------- events
            _onEvent(e, type) {
                if (!this.controls.includes(e.target)) return;
                if (type === 'input') {
                    this._dirty = true;
                    // reward early: a field that shows a message is re-checked while typing; one that does not is checked silently (no message, the browser's own state follows)
                    this._check(this._shown);
                    return;
                }
                this._touched = true;
                // punish late: after the user leaves a field, and not for a field they only tabbed through
                this._check(this._text() !== '' || this._dirty || this._submitted || this._shown);
            }
            _onInvalid(e) {
                if (!this.controls.includes(e.target)) return;
                this._touched = true; this._submitted = true;
                this._check(true);
                if (this.hasAttribute('native-bubble')) return;
                e.preventDefault();   // our message replaces the browser's bubble (which would also have moved the focus: do that ourselves for the first invalid control)
                const form = this.form;
                const firstInvalid = form ? Array.from(form.elements).find(el => !isCustom(el) && typeof el.checkValidity === 'function' && el.willValidate && !el.validity.valid) : null;   // the <fv-field> hosts are in form.elements too: skip them
                if (firstInvalid === e.target) { try { e.target.focus(); } catch (err) { /* not focusable */ } }
            }
            _onSibling(e) {
                const t = e.target;
                if (!t || !t.name || this.contains(t)) return;
                if (targetsOf(this.rules).indexOf(t.name) >= 0) this._check(this._shown || (this._touched && this._text() !== ''));
            }

            // ---------------------------------------------------------------- the server (Precognition)
            _scheduleServer() {
                clearTimeout(this._timer);
                const delay = parseInt(this.getAttribute('server-delay'), 10);
                this._timer = setTimeout(() => this._askServer(), isFinite(delay) ? delay : 300);
            }
            async _askServer() {
                const url = this.getAttribute('server'), name = this.name;
                if (!url || !name || this._result.valid === false) return;
                if (!this._touched) return;   // only after the user has been in the field
                const token = ++this._token;
                if (this._abort) this._abort.abort();
                this._abort = typeof root.AbortController === 'function' ? new root.AbortController() : null;
                const asked = this._text();
                const form = this.form;
                const flat = Object.assign(this._otherValues(), { [name]: asked });
                let values = flat;
                if (this.getAttribute('server-encoding') === 'json' && form && typeof root.FormData === 'function') values = FV.parseFormData(new root.FormData(form));
                const r = await FV.precognition(url, values, { only: [name], encoding: this.getAttribute('server-encoding') === 'json' ? 'json' : 'form', signal: this._abort ? this._abort.signal : undefined });
                if (token !== this._token || r.valid === null || this._text() !== asked) return;
                const canon = String(name).replace(/\.(\d+)(?=\.|$)/g, '[$1]');
                const msg = r.valid === false ? (r.errors[canon] || r.errors[name] || r.form[0] || '') : '';
                if (msg) { this._serverMsg = msg; this._serverFor = asked; } else if (this._serverMsg) { this._serverMsg = ''; }
                this._check(!!msg || this._shown);
            }
        }
        return FvField;
    }

    let Klass = null;
    const fieldElement = {
        /** Registers the element (default name 'fv-field'). Returns the class, or null when this environment has no custom elements. */
        define(name) {
            if (typeof root.customElements === 'undefined' || typeof root.HTMLElement === 'undefined') return null;
            const tag = name || DEFAULT_NAME;
            const existing = root.customElements.get(tag);
            if (existing) return existing;
            if (!Klass) Klass = createClass();
            const C = tag === DEFAULT_NAME ? Klass : class extends Klass {};   // a class can be registered once: another name gets a thin subclass
            root.customElements.define(tag, C);
            return C;
        },
        parseRules
    };
    FV.fieldElement = fieldElement;
    try { fieldElement.define(DEFAULT_NAME); } catch (e) { if (root.console) console.warn('fv-field could not be registered:', e); }
    return fieldElement;
});

    };

    mods["formValidator.password"] = function (module, exports, require, define) {
/*!
 * FormValidator password add-on v1.0.0 — a strength estimate, a minimum-strength rule and a breached-password check.
 *
 *   FormValidator.passwordStrength('Tr0ub4dor&3', { userInputs: [email, name] })   // { score: 0..4, label, bits, length, feedback: ['common', 'sequence', ...] }
 *   FormValidator.watchPasswordStrength(input, result => meter.value = result.score)
 *   await FormValidator.pwned(password)                                            // times seen in known breaches (0 = never, null = could not check)
 *   rules: { password: { pwcheck: { minLength: 8 }, pwscore: 3, pwned: true } }    // "good" or better, and not in a breach
 *
 * Part of the one-file bundle; on its own it needs formValidator.js loaded first. The strength estimate runs offline (about 1 KB of common passwords, no downloads);
 * the breach check sends only the first 5 characters of the password's SHA-1 hash to the Have I Been Pwned range API (k-anonymity), never the password.
 *
 * Changelog
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['./formValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, require('./formValidator.js'));
    else factory(root, root.FormValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';
    if (!FV) throw new Error('formValidator.password.js needs FormValidator loaded first');

    const isNum = v => typeof v === 'number' && isFinite(v);
    const COMMON_PASSWORDS = new Set(('password 123456 12345678 qwerty abc123 monkey letmein dragon 111111 baseball iloveyou trustno1 sunshine master welcome shadow ashley football jesus michael ninja ' +
        'mustang password1 123456789 12345 1234567 1234567890 qwertyuiop 123123 654321 superman 1qaz2wsx 7777777 121212 000000 qazwsx 123qwe killer jordan jennifer zxcvbnm asdfgh hunter buster ' +
        'soccer harley batman andrew tigger charlie robert thomas hockey ranger daniel starwars 112233 george computer michelle jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass ' +
        'maggie 159753 aaaaaa ginger princess joshua cheese amanda summer love nicole chelsea biteme matthew access yankees 987654321 dallas austin thunder taylor matrix admin administrator root toor ' +
        'passw0rd welcome1 qwerty123 changeme default login guest test letmein1 football1 iloveyou1 monkey1 dragon1 abc12345 qwerty1 password123 pa55word 1q2w3e4r 1q2w3e 123321 666666 696969 ' +
        'secret hello hello123 whatever internet service canada hello1 flower passw0rd1 azerty loveme lovely 1234 12345678910 nothing starwars1 qwe123 samsung google').split(' '));
    const COMMON_LIST = Array.from(COMMON_PASSWORDS).filter(c => c.length >= 5);
    const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'qazwsxedcrfvtgbyhnujmikolp'];
    const LEET = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '+': 't' };
    const LABELS = ['very weak', 'weak', 'fair', 'good', 'strong'];

    /**
     * A fast, offline estimate of how hard a password is to guess. Returns
     *   { score: 0..4, label, bits, length, feedback: ['too-short', 'common', 'sequence', 'repeated', 'user-input', 'only-letters', 'only-digits', 'add-length'] }
     * Characters in a keyboard run (qwerty, 12345, abcd), a repeat (aaaa), a year or a piece of what you tell it about the user (options.userInputs: email, name ...) count
     * as about one bit instead of a free choice, and a common password (also with l33t substitutions or a few characters added) scores 0. Score thresholds on `bits`: 28 / 36 / 60 / 80.
     * It is a guide for a meter and a minimum, not a guarantee: it has no dictionary of words, so an ordinary word with substitutions can score higher than it deserves.
     */
    function passwordStrength(password, options) {
        const o = options || {};
        const full = password === null || password === undefined ? '' : String(password);
        // a password of 256 characters is judged on its first 256: anything longer than that is strong unless it repeats, and repeats show up in the first 256 too
        const pw = full.length > 256 ? full.slice(0, 256) : full;
        const chars = Array.from(pw), n = chars.length;
        const feedback = [];
        if (!n) return { score: 0, label: LABELS[0], bits: 0, length: 0, feedback: ['too-short'] };
        let pool = 0;
        if (/\p{Ll}/u.test(pw)) pool += 26;
        if (/\p{Lu}/u.test(pw)) pool += 26;
        if (/\p{Nd}/u.test(pw)) pool += 10;
        if (/[ -\/:-@\[-`{-~]/.test(pw)) pool += 33;
        if (/[^\x00-\x7f]/.test(pw)) pool += 50;   // letters and symbols of other alphabets
        pool = Math.max(pool, 10);
        const per = Math.log2(pool);
        const lower = pw.toLowerCase(), lowerChars = Array.from(lower);
        const covered = new Array(n).fill(false);   // characters that are a pattern, not a free choice
        const cover = (from, len) => { for (let i = from; i < from + len && i < n; i++) covered[i] = true; };
        const note = f => { if (feedback.indexOf(f) < 0) feedback.push(f); };
        for (let i = 0; i < n;) { let j = i; while (j < n && chars[j] === chars[i]) j++; if (j - i >= 3) { cover(i, j - i); note('repeated'); } i = Math.max(j, i + 1); }   // aaaa
        for (let len = 2; len <= 4; len++) for (let i = 0; i + len * 3 <= n; i++) {                                                                                          // abababab
            const unit = lowerChars.slice(i, i + len).join('');
            if (lowerChars.slice(i + len, i + 2 * len).join('') === unit && lowerChars.slice(i + 2 * len, i + 3 * len).join('') === unit) { cover(i, len * 3); note('repeated'); }
        }
        for (let i = 0; i + 3 <= n; i++) {   // abc, 987
            const a = lowerChars[i].codePointAt(0), b = lowerChars[i + 1].codePointAt(0), c = lowerChars[i + 2].codePointAt(0);
            if (b - a === c - b && Math.abs(b - a) === 1) {
                let j = i + 2; const d = b - a;
                while (j + 1 < n && lowerChars[j + 1].codePointAt(0) - lowerChars[j].codePointAt(0) === d) j++;
                cover(i, j - i + 1); note('sequence'); i = j - 1;
            }
        }
        KEYBOARD_ROWS.forEach(row => {   // qwerty, poiuy
            [row, row.split('').reverse().join('')].forEach(r => {
                for (let i = 0; i + 3 <= n; i++) {
                    const start = r.indexOf(lower.slice(i, i + 3));
                    if (start < 0) continue;
                    let k = 0;
                    while (i + k < n && start + k < r.length && lower[i + k] === r[start + k]) k++;
                    if (k >= 3) { cover(i, k); note('sequence'); }
                }
            });
        });
        for (const m of pw.matchAll(/(?:19|20)\d{2}/g)) cover(m.index, 4);   // years
        [].concat(o.userInputs || []).forEach(u => {   // what the site knows about the user
            const t = String(u === null || u === undefined ? '' : u).toLowerCase().trim();
            const parts = t.length >= 3 ? [t].concat(t.split(/[^\p{L}\p{N}]+/u).filter(x => x.length >= 3)) : [];
            parts.forEach(p => { const at = lower.indexOf(p); if (at >= 0) { cover(at, p.length); note('user-input'); } });
        });
        // free characters cost `per` bits each; a whole run of pattern characters (qwerty, aaaa, abcd) costs about ten bits however long it is
        let bits = 0, run = 0;
        const endRun = () => { if (run) { bits += 3 + 1.2 * Math.min(run, 6); run = 0; } };
        covered.forEach(c => { if (c) run++; else { endRun(); bits += per; } });
        endRun();
        // a password that is one short piece repeated over and over is only as strong as that piece
        for (let p = 1; p * 3 <= n; p++) {
            let same = true;
            for (let i = 0; i + p < n; i++) if (lowerChars[i] !== lowerChars[i + p]) { same = false; break; }
            if (same) { bits = Math.min(bits, p * per + 4); note('repeated'); break; }
        }
        // a common password (also with l33t substitutions or a few characters added) is not a secret
        const plain = lower.replace(/[01345 7@$!+]/g, ch => LEET[ch] || ch), stripped = lower.replace(/[^\p{L}\p{N}]/gu, '');
        const isCommon = w => COMMON_PASSWORDS.has(w) || (w.length >= 5 && COMMON_LIST.some(c => w.indexOf(c) === 0 && w.length <= c.length + 3 || (w.length <= c.length + 3 && w.slice(-c.length) === c)));
        if (isCommon(lower) || isCommon(plain) || isCommon(stripped)) { bits = Math.min(bits, 12); note('common'); }
        if (n < 8) note('too-short');
        if (/^\p{L}+$/u.test(pw)) note('only-letters');
        if (/^\p{Nd}+$/u.test(pw)) note('only-digits');
        if (n < 12 && bits < 60) note('add-length');
        bits = Math.round(bits * 10) / 10;
        const score = bits < 28 ? 0 : bits < 36 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
        return { score, label: LABELS[score], bits, length: full.length > 256 ? Array.from(full).length : n, feedback };
    }

    // a small SHA-1 for pages without crypto.subtle (plain http)
    function sha1Hex(text) {
        const bytes = Array.from(new TextEncoder().encode(text));
        const l = bytes.length * 8;
        bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
        for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
        let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
        const rol = (x, n) => (x << n) | (x >>> (32 - n));
        for (let off = 0; off < bytes.length; off += 64) {
            const w = [];
            for (let i = 0; i < 16; i++) w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
            for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
            let a = h0, b = h1, c = h2, d = h3, e = h4;
            for (let i = 0; i < 80; i++) {
                const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
                const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
                const t = (rol(a, 5) + f + e + k + w[i]) >>> 0;
                e = d; d = c; c = rol(b, 30) >>> 0; b = a; a = t;
            }
            h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
        }
        return [h0, h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('').toUpperCase();
    }
    async function sha1(text) {
        const subtle = root.crypto && root.crypto.subtle;
        if (subtle && typeof subtle.digest === 'function') {
            try { return Array.from(new Uint8Array(await subtle.digest('SHA-1', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); } catch (e) { /* fall back */ }
        }
        return sha1Hex(text);
    }

    /**
     * How often a password appeared in known data breaches (Have I Been Pwned "Pwned Passwords", k-anonymity): only the first 5 characters of the SHA-1 hash are sent,
     * never the password. Resolves to the count (0 = not found) or null when the check could not be made (offline, blocked, timeout, empty password).
     * options: url (default 'https://api.pwnedpasswords.com/range/'), timeout (5000 ms), fetch, signal.
     */
    async function pwned(password, options) {
        const o = options || {};
        const doFetch = o.fetch || (typeof fetch === 'function' ? fetch : null);
        if (!doFetch || password === null || password === undefined || password === '') return null;
        const hash = await sha1(String(password));
        const prefix = hash.slice(0, 5), suffix = hash.slice(5);
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), o.timeout || 5000) : null;
        if (o.signal && ctrl) { if (o.signal.aborted) ctrl.abort(); else if (o.signal.addEventListener) o.signal.addEventListener('abort', () => ctrl.abort(), { once: true }); }
        try {
            const resp = await doFetch((o.url || 'https://api.pwnedpasswords.com/range/') + prefix, { headers: { 'Add-Padding': 'true' }, signal: ctrl ? ctrl.signal : undefined });
            if (!resp.ok) return null;
            const text = await resp.text();
            for (const line of String(text).split(/\r?\n/)) {
                const i = line.indexOf(':');
                if (i > 0 && line.slice(0, i).trim().toUpperCase() === suffix) { const c = parseInt(line.slice(i + 1), 10); return isFinite(c) ? c : 1; }
            }
            return 0;
        } catch (e) { return null; } finally { if (timer) clearTimeout(timer); }
    }

    /** Calls fn(result) with passwordStrength() whenever the input changes (and once now): for a strength meter. Returns a function that stops it. */
    function watchPasswordStrength(input, fn, options) {
        if (!input || typeof input.addEventListener !== 'function') throw new Error('watchPasswordStrength: pass the password input');
        const run = () => {
            const o = options || {};
            fn(passwordStrength(input.value, { userInputs: [].concat(typeof o.userInputs === 'function' ? o.userInputs() : (o.userInputs || [])) }));
        };
        input.addEventListener('input', run);
        run();
        return () => input.removeEventListener('input', run);
    }

    const otherValue = (env, name) => {   // another field of the form / the data, as text
        const vals = env.values || (env.inst && typeof env.inst.getValues === 'function' ? env.inst.getValues() : null);
        const v = vals ? vals[name] : undefined;
        return v === undefined || v === null ? '' : String(Array.isArray(v) ? v.join(' ') : v).trim();
    };
    // pwscore: { pwscore: 3 } = at least "good"; { type: 'pwscore', min: 3, userFields: ['email', 'name'] } also treats those fields' values as guessable
    FV.registerRule('pwscore', (v, r, env) => {
        const users = [].concat(r.userFields || []).map(name => otherValue(env, name)).filter(Boolean).concat(r.userInputs || []);
        return passwordStrength(v, { userInputs: users }).score >= (r.min !== undefined ? Number(r.min) : (Number(r.param) || 3));
    }, { raw: true });
    // pwned: { pwned: true } | { pwned: { maxCount: 0, timeout: 5000, failOpen: true } }   (asynchronous: a form waits for it, it is skipped while typing; checkValue cannot run it)
    FV.registerRule('pwned', async (v, r) => {
        const count = await pwned(v, { timeout: r.timeout, fetch: r.fetch, url: r.url });
        if (count === null) return r.failOpen === false ? false : true;   // could not ask: do not block the user
        return count <= (isNum(r.maxCount) ? r.maxCount : 0);
    }, { raw: true, remote: true });
    if (!FV.messages.pwscore) FV.messages.pwscore = 'Please choose a stronger password.';
    if (!FV.messages.pwned) FV.messages.pwned = 'This password has appeared in a data breach. Please choose another one.';

    FV.passwordStrength = passwordStrength;
    FV.pwned = pwned;
    FV.watchPasswordStrength = watchPasswordStrength;
    return { passwordStrength, pwned, watchPasswordStrength };
});

    };

    mods["formValidator.jquery"] = function (module, exports, require, define) {
/*!
 * FormValidator — jQuery Validation compatibility layer v1.2.0
 *
 * Load order:  jQuery  →  formValidator.js (2.2+)  →  formValidator.jquery.js
 * Then replace the jQuery Validation plugin (jquery.validate.js, additional-methods.js, localization files) with these scripts.
 * Your existing code keeps working:
 *
 *   $('#myform').validate({
 *       rules:    { email: { required: true, email: true }, pw: { minlength: 8 }, pw2: { equalTo: '#pw' } },
 *       messages: { email: { required: 'We need your email' } },
 *       errorPlacement: function (error, element) { error.insertAfter(element); },
 *       submitHandler: function (form) { form.submit(); }
 *   });
 *   $('#myform').valid();                         // synchronous, like the original
 *   $('#email').rules('add', { minlength: 3 });
 *   $.validator.addMethod('even', function (value, element, param) { return this.optional(element) || value % 2 === 0; }, 'Even numbers only');
 *
 * Supported: $.fn.validate / valid / rules, $.validator.{addMethod, addClassRules, setDefaults, format, messages, methods,
 * defaults, classRuleSettings, normalizeRule(s)}, all built-in and "additional" methods, per-field messages, data-rule-* /
 * data-msg-*, HTML5 attributes, class rules, depends, normalizer, remote, highlight/unhighlight/success/errorPlacement,
 * errorContainer/errorLabelContainer/wrapper, submitHandler/invalidHandler, focusCleanup, ignore, debug, onsubmit/onfocusout/
 * onkeyup/onclick, ".cancel" and formnovalidate buttons, validator.form/element/resetForm/showErrors/numberOfInvalids/...
 * Also supported: the `groups` option (one visible error per group) and the `showErrors` option (with this.defaultShowErrors()).
 * Differences that are improvements: text values are trimmed (set trim:false for the original behaviour), the URL check is
 * done by the URL parser, and validation runs on the modern engine (accessible errors, dynamic fields, no dependencies on layout plugins).
 *
 * Changelog
 *   1.2.0  `groups` and `showErrors` options.
 *   1.1.0  `pending` class (and aria-busy) on a field while a remote or file check runs; the new FileValidator options
 *          (methods, custom, remote, duplicateContent, duration limits) work inside the `fileValidator` method.
 *   1.0.0  First release, including the `fileValidator` method:
 *            rules: { avatar: { fileValidator: { accept: '.png,.jpg', maxFileSizeMB: 2 } } }   (needs fileValidator.js)
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['jquery'], function ($) { return factory(root, $); });
    else if (typeof module === 'object' && module.exports) {
        module.exports = factory(root, root.jQuery || (function () { try { return require('jquery'); } catch (e) { return null; } })());
    } else factory(root, root.jQuery);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, $) {
    'use strict';

    if (!$ || !$.fn) throw new Error('formValidator.jquery.js needs jQuery to be loaded first');
    const FV = root.FormValidator || (typeof require === 'function' ? require('./formValidator.js') : null);
    if (!FV || !FV.getRule) throw new Error('formValidator.jquery.js needs formValidator.js v2.2 or newer to be loaded first');
    if ($.validator && $.validator.__fv) return $.validator;
    if ($.validator && root.console) console.warn('formValidator.jquery.js: replacing the jQuery Validation plugin that was loaded before it.');

    const isFn = f => typeof f === 'function';
    const D = () => root.document;
    const trim = s => String(s == null ? '' : s).trim(); // $.trim was removed in jQuery 4
    const cap = m => m.charAt(0).toUpperCase() + m.substring(1).toLowerCase();
    const escName = n => String(n).replace(/(["\\])/g, '\\$1');

    // ------------------------------------------------------------------ Validator
    function Validator(options, form) {
        this.settings = $.extend(true, {}, Validator.defaults, options);
        this.currentForm = form;
        this.submitted = {};
        this._init();
    }

    Validator.__fv = true;
    Validator.version = '1.2.0';
    Validator.autoCreateRanges = false;

    Validator.format = function (source, params) {
        if (arguments.length === 1) {
            return function () {
                const args = $.makeArray(arguments);
                args.unshift(source);
                return Validator.format.apply(this, args);
            };
        }
        if (params === undefined) return source;
        if (arguments.length > 2 && params.constructor !== Array) params = $.makeArray(arguments).slice(1);
        if (params.constructor !== Array) params = [params];
        $.each(params, function (i, n) { source = source.replace(new RegExp('\\{' + i + '\\}', 'g'), function () { return n; }); });
        return source;
    };

    Validator.defaults = {
        messages: {}, groups: {}, rules: {},
        errorClass: 'error', pendingClass: 'pending', validClass: 'valid', errorElement: 'label',
        focusCleanup: false, focusInvalid: true,
        errorContainer: $([]), errorLabelContainer: $([]),
        onsubmit: true, ignore: ':hidden', ignoreTitle: false,
        onfocusout: true, onkeyup: true, onclick: true,
        onfocusin: function (element) { this.lastActive = element; },   // called on every focusin; with focusCleanup the error is cleared as well
        ariaDescribedByCleanup: false,                                  // accepted for compatibility: aria-describedby is always kept in step with the errors
        highlight: function (element, errorClass, validClass) {
            if (element.type === 'radio') this.findByName(element.name).addClass(errorClass).removeClass(validClass);
            else $(element).addClass(errorClass).removeClass(validClass);
        },
        unhighlight: function (element, errorClass, validClass) {
            if (element.type === 'radio') this.findByName(element.name).removeClass(errorClass).addClass(validClass);
            else $(element).removeClass(errorClass).addClass(validClass);
        }
    };

    Validator.setDefaults = function (settings) { $.extend(Validator.defaults, settings); };

    Validator.messages = {
        required: 'This field is required.',
        remote: 'Please fix this field.',
        email: 'Please enter a valid email address.',
        url: 'Please enter a valid URL.',
        date: 'Please enter a valid date.',
        dateISO: 'Please enter a valid date (ISO).',
        number: 'Please enter a valid number.',
        digits: 'Please enter only digits.',
        equalTo: 'Please enter the same value again.',
        maxlength: Validator.format('Please enter no more than {0} characters.'),
        minlength: Validator.format('Please enter at least {0} characters.'),
        rangelength: Validator.format('Please enter a value between {0} and {1} characters long.'),
        range: Validator.format('Please enter a value between {0} and {1}.'),
        max: Validator.format('Please enter a value less than or equal to {0}.'),
        min: Validator.format('Please enter a value greater than or equal to {0}.'),
        step: Validator.format('Please enter a multiple of {0}.'),
        creditcard: 'Please enter a valid credit card number.',
        accept: 'Please enter a value with a valid mimetype.',
        extension: 'Please enter a value with a valid extension.',
        pattern: 'Invalid format.',
        maxWords: Validator.format('Please enter {0} words or less.'),
        minWords: Validator.format('Please enter at least {0} words.'),
        rangeWords: Validator.format('Please enter between {0} and {1} words.'),
        integer: 'A positive or negative non-decimal number please',
        lettersonly: 'Letters only please',
        letterswithbasicpunc: 'Letters or punctuation only please',
        alphanumeric: 'Letters, numbers, and underscores only please',
        nowhitespace: 'No white space please',
        ipv4: 'Please enter a valid IP v4 address.',
        ipv6: 'Please enter a valid IP v6 address.',
        time: 'Please enter a valid time, between 00:00 and 23:59',
        time12h: 'Please enter a valid time in 12-hour am/pm format',
        phoneUS: 'Please specify a valid phone number',
        iban: 'Please specify a valid IBAN',
        require_from_group: Validator.format('Please fill at least {0} of these fields.'),
        skip_or_fill_minimum: Validator.format('Please either skip these fields or fill at least {0} of them.'),
        notEqualTo: 'Please enter a different value, values must not be the same.'
    };

    Validator.classRuleSettings = {
        required: { required: true }, email: { email: true }, url: { url: true }, date: { date: true },
        dateISO: { dateISO: true }, number: { number: true }, digits: { digits: true }, creditcard: { creditcard: true }
    };

    Validator.addClassRules = function (className, rules) {
        if (className.constructor === String) Validator.classRuleSettings[className] = rules;
        else $.extend(Validator.classRuleSettings, className);
    };

    Validator.addMethod = function (name, method, message) {
        Validator.methods[name] = method;
        Validator.messages[name] = message !== undefined ? message : Validator.messages[name];
        if (method.length < 3) Validator.addClassRules(name, Validator.normalizeRule(name));
    };

    // ------------------------------------------------------------------ methods (same signatures and semantics as jQuery Validation)
    const stripHtml = v => v.replace(/<.[^<>]*?>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/[.(),;:!?%#$'"_+=\/\-\u201c\u201d\u2019]*/g, '');
    const words = v => stripHtml(v).match(/\b\w+\b/g) || [];
    const decimals = n => { const m = ('' + n).match(/(?:\.(\d+))?$/); return m && m[1] ? m[1].length : 0; };

    function isIPv6(v) {
        if (!/^[0-9a-f:.]+$/i.test(v) || v.split('::').length > 2) return false;
        let tail4 = null, s = v;
        const lastColon = s.lastIndexOf(':');
        if (s.indexOf('.') > -1) {
            tail4 = s.slice(lastColon + 1);
            if (!/^(\d{1,3})(\.\d{1,3}){3}$/.test(tail4) || tail4.split('.').some(n => +n > 255)) return false;
            s = s.slice(0, lastColon + 1) + '0:0';
        }
        const groups = s.split('::');
        const parse = part => part === '' ? [] : part.split(':');
        const left = parse(groups[0]), right = groups.length === 2 ? parse(groups[1]) : [];
        if ([...left, ...right].some(g => !/^[0-9a-f]{1,4}$/i.test(g))) return false;
        return groups.length === 2 ? left.length + right.length < 8 : left.length === 8;
    }

    function ibanOk(v) {
        v = v.replace(/\s+/g, '').toUpperCase();
        if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
        const rearranged = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, c => c.charCodeAt(0) - 55);
        let rem = 0;
        for (let i = 0; i < rearranged.length; i++) rem = (rem * 10 + +rearranged[i]) % 97;
        return rem === 1;
    }

    function urlOk(v) {
        if (!/^(?:(?:https?|ftp):)?\/\//i.test(v) || /\s/.test(v)) return false;
        let u;
        try { u = new URL(v.startsWith('//') ? 'http:' + v : v); } catch (e) { return false; }
        const host = u.hostname;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
            const p = host.split('.').map(Number);
            if (p.some(n => n > 255) || p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
                (p[0] === 169 && p[1] === 254) || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)) return false;
            return true;
        }
        return /^(?:[a-z\u00a1-\uffff0-9](?:[a-z\u00a1-\uffff0-9-]*[a-z\u00a1-\uffff0-9])?\.)+[a-z\u00a1-\uffff]{2,}\.?$/i.test(host);
    }

    Validator.methods = {
        required: function (value, element, param) {
            if (!this.depend(param, element)) return 'dependency-mismatch';
            if (element.nodeName.toLowerCase() === 'select') { const val = $(element).val(); return !!val && val.length > 0; }
            if (this.checkable(element)) return this.getLength(value, element) > 0;
            if (value === undefined || value === null) return false;
            return typeof value === 'string' ? (this.settings.trim === false ? value.length > 0 : trim(value).length > 0) : value.length > 0;
        },
        remote: function () { return true; }, // executed by the engine (see remoteRule below)
        minlength: function (value, element, param) { const length = Array.isArray(value) ? value.length : this.getLength(value, element); return this.optional(element) || length >= param; },
        maxlength: function (value, element, param) { const length = Array.isArray(value) ? value.length : this.getLength(value, element); return this.optional(element) || length <= param; },
        rangelength: function (value, element, param) { const length = Array.isArray(value) ? value.length : this.getLength(value, element); return this.optional(element) || (length >= param[0] && length <= param[1]); },
        min: function (value, element, param) { return this.optional(element) || value >= param; },
        max: function (value, element, param) { return this.optional(element) || value <= param; },
        range: function (value, element, param) { return this.optional(element) || (value >= param[0] && value <= param[1]); },
        step: function (value, element, param) {
            const type = $(element).attr('type');
            if (type && !/\b(text|number|range)\b/.test(type)) throw new Error('Step attribute on input type ' + type + ' is not supported.');
            const places = decimals(param), toInt = n => Math.round(n * Math.pow(10, places));
            const valid = decimals(value) <= places && toInt(value) % toInt(param) === 0;
            return this.optional(element) || valid;
        },
        email: function (value, element) { return this.optional(element) || /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value); },
        url: function (value, element) { return this.optional(element) || urlOk(value); },
        date: function (value, element) { return this.optional(element) || !/Invalid|NaN/.test(new Date(value).toString()); },
        dateISO: function (value, element) { return this.optional(element) || /^\d{4}[\/\-](0?[1-9]|1[012])[\/\-](0?[1-9]|[12][0-9]|3[01])$/.test(value); },
        number: function (value, element) { return this.optional(element) || /^(?:-?\d+|-?\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/.test(value); },
        digits: function (value, element) { return this.optional(element) || /^\d+$/.test(value); },
        equalTo: function (value, element, param) {
            const target = $(param);
            return target.length > 0 && value === this.elementValue(target[0]);
        },
        notEqualTo: function (value, element, param) { return this.optional(element) || !Validator.methods.equalTo.call(this, value, element, param); },
        creditcard: function (value, element) {
            if (this.optional(element)) return 'dependency-mismatch';
            if (/[^0-9 \-]+/.test(value)) return false;
            let nCheck = 0, bEven = false;
            value = value.replace(/\D/g, '');
            if (value.length < 13 || value.length > 19) return false;
            for (let n = value.length - 1; n >= 0; n--) {
                let nDigit = parseInt(value.charAt(n), 10);
                if (bEven && (nDigit *= 2) > 9) nDigit -= 9;
                nCheck += nDigit; bEven = !bEven;
            }
            return nCheck % 10 === 0;
        },
        extension: function (value, element, param) {
            param = typeof param === 'string' ? param.replace(/,/g, '|') : 'png|jpe?g|gif';
            return this.optional(element) || new RegExp('\\.(' + param + ')$', 'i').test(value);
        },
        accept: function (value, element, param) {
            let typeParam = typeof param === 'string' ? param.replace(/\s/g, '') : 'image/*';
            if (this.optional(element)) return 'dependency-mismatch';
            if ($(element).attr('type') === 'file') {
                typeParam = typeParam.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, '\\$&').replace(/,/g, '|').replace(/\\\/\*/g, '\\/.*');
                const re = new RegExp('.?(' + typeParam + ')$', 'i');
                return Array.from(element.files || []).every(f => !f.type || re.test(f.type));
            }
            return true;
        },
        pattern: function (value, element, param) {
            if (this.optional(element)) return true;
            const re = typeof param === 'string' ? new RegExp('^(?:' + param + ')$') : param;
            re.lastIndex = 0;
            return re.test(value);
        },
        maxWords: function (value, element, param) { return this.optional(element) || words(value).length <= param; },
        minWords: function (value, element, param) { return this.optional(element) || words(value).length >= param; },
        rangeWords: function (value, element, param) { const n = words(value).length; return this.optional(element) || (n >= param[0] && n <= param[1]); },
        integer: function (value, element) { return this.optional(element) || /^-?\d+$/.test(value); },
        lettersonly: function (value, element) { return this.optional(element) || /^[a-z]+$/i.test(value); },
        letterswithbasicpunc: function (value, element) { return this.optional(element) || /^[a-z\-.,()'"\s]+$/i.test(value); },
        alphanumeric: function (value, element) { return this.optional(element) || /^\w+$/i.test(value); },
        nowhitespace: function (value, element) { return this.optional(element) || /^\S+$/i.test(value); },
        ipv4: function (value, element) { return this.optional(element) || /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/i.test(value); },
        ipv6: function (value, element) { return this.optional(element) || isIPv6(value); },
        time: function (value, element) { return this.optional(element) || /^([01]\d|2[0-3]|[0-9])(:[0-5]\d){1,2}$/.test(value); },
        time12h: function (value, element) { return this.optional(element) || /^((0?[1-9]|1[012])(:[0-5]\d){1,2}( ?[AP]M))$/i.test(value); },
        phoneUS: function (value, element) {
            value = value.replace(/\s+/g, '');
            return this.optional(element) || (value.length > 9 && /^(\+?1-?)?(\([2-9]([02-9]\d|1[02-9])\)|[2-9]([02-9]\d|1[02-9]))-?[2-9]\d{2}-?\d{4}$/.test(value));
        },
        iban: function (value, element) { return this.optional(element) || ibanOk(value); },
        require_from_group: function (value, element, options) {
            const $fields = $(options[1], element.form), self = this;
            return $fields.filter(function () { return !!self.elementValue(this); }).length >= options[0];
        },
        skip_or_fill_minimum: function (value, element, options) {
            const $fields = $(options[1], element.form), self = this;
            const filled = $fields.filter(function () { return !!self.elementValue(this); }).length;
            return filled === 0 || filled >= options[0];
        }
    };

    // FileValidator as a jQuery-Validation method:  rules: { avatar: { fileValidator: { accept: '.png,.jpg', maxFileSizeMB: 2 } } }
    // or  data-rule-filevalidator='{"maxFileSizeMB":2}'.  Answers asynchronously; valid() treats it as pending until it arrives.
    Validator.methods.fileValidator = function (value, element, param) {
        if (this.optional(element)) return 'dependency-mismatch';
        const FileV = root.FileValidator || (typeof require === 'function' ? (function () { try { return require('./fileValidator.js'); } catch (e) { return null; } })() : null);
        if (!FileV) { if (root.console) console.warn('fileValidator method needs fileValidator.js to be loaded'); return true; }
        const files = Array.from(element.files || []);
        if (!files.length) return true;
        const options = param && typeof param === 'object' ? param : {};
        return FileV.validateFiles(files, options).then(function (res) {
            if (res.isValid) return true;
            return { valid: false, message: FileV.summary(res, { fileNames: files.length > 1 })[0] };
        });
    };
    Validator.messages.fileValidator = 'Please choose a valid file.';

    // ------------------------------------------------------------------ rule discovery (class, attributes, data-*, static)
    Validator.normalizeRule = function (data) {
        if (typeof data === 'string') {
            const transformed = {};
            $.each(data.split(/\s/), function () { if (this !== '') transformed[this] = true; });
            return transformed;
        }
        return data;
    };

    function normalizeAttributeRule(rules, type, method, value) {
        if (/min|max|step/.test(method) && (type === null || /number|range|text/.test(type))) {
            value = Number(value);
            if (isNaN(value)) value = undefined;
        }
        if (value || value === 0) rules[method] = value;
        else if (type === method && type !== 'range') rules[type === 'date' ? 'dateISO' : type] = true;
    }

    Validator.normalizeAttributeRule = normalizeAttributeRule;

    Validator.classRules = function (element) {
        const rules = {}, classes = $(element).attr('class');
        if (classes) $.each(classes.split(' '), function () { if (this in Validator.classRuleSettings) $.extend(rules, Validator.classRuleSettings[this]); });
        return rules;
    };

    Validator.attributeRules = function (element) {
        const rules = {}, $el = $(element), type = element.getAttribute('type');
        for (const method in Validator.methods) {
            let value;
            if (method === 'required') { value = element.getAttribute(method); if (value === '') value = true; value = !!value; }
            else value = $el.attr(method);
            normalizeAttributeRule(rules, type, method, value);
        }
        if (rules.maxlength && /-1|2147483647|524288/.test(rules.maxlength)) delete rules.maxlength;
        return rules;
    };

    Validator.dataRules = function (element) {
        const rules = {}, $el = $(element), type = element.getAttribute('type');
        for (const method in Validator.methods) {
            let value = $el.data('rule' + cap(method));
            if (value === '') value = true;
            normalizeAttributeRule(rules, type, method, value);
        }
        return rules;
    };

    Validator.staticRules = function (element) {
        const validator = $.data(element.form, 'validator');
        return (validator && validator.settings.rules ? Validator.normalizeRule(validator.settings.rules[element.name]) : null) || {};
    };

    Validator.normalizeRules = function (rules, element) {
        $.each(rules, function (prop, val) {
            if (val === false) { delete rules[prop]; return; }
            if (val && (val.param || val.depends)) {
                let keep = true;
                switch (typeof val.depends) {
                    case 'string': keep = !!$(val.depends, element.form).length; break;
                    case 'function': keep = val.depends.call(element, element); break;
                }
                if (keep) rules[prop] = val.param !== undefined ? val.param : true;
                else delete rules[prop];
            }
        });
        $.each(rules, function (rule, parameter) { rules[rule] = isFn(parameter) && rule !== 'normalizer' ? parameter(element) : parameter; });
        $.each(['minlength', 'maxlength'], function (i, name) { if (rules[name]) rules[name] = Number(rules[name]); });
        $.each(['rangelength', 'range'], function (i, name) {
            if (!rules[name]) return;
            if (Array.isArray(rules[name])) rules[name] = [Number(rules[name][0]), Number(rules[name][1])];
            else if (typeof rules[name] === 'string') {
                const parts = rules[name].replace(/[\[\]]/g, '').split(/[\s,]+/);
                rules[name] = [Number(parts[0]), Number(parts[1])];
            }
        });
        if (Validator.autoCreateRanges) {
            if (rules.min != null && rules.max != null) { rules.range = [rules.min, rules.max]; delete rules.min; delete rules.max; }
            if (rules.minlength != null && rules.maxlength != null) { rules.rangelength = [rules.minlength, rules.maxlength]; delete rules.minlength; delete rules.maxlength; }
        }
        return rules;
    };

    function rulesFor(element) {
        if (!element.form || !element.name) return {};
        let data = Validator.normalizeRules($.extend({}, Validator.classRules(element), Validator.attributeRules(element),
            Validator.dataRules(element), Validator.staticRules(element)), element);
        if (data.messages) delete data.messages;
        if (data.required) { const p = data.required; delete data.required; data = $.extend({ required: p }, data); $(element).attr('aria-required', 'true'); }
        if (data.remote) { const p = data.remote; delete data.remote; data = $.extend(data, { remote: p }); }
        return data;
    }

    // ------------------------------------------------------------------ engine bridge
    const registered = {};

    function dependsOnFor(method, param) {
        if ((method === 'equalTo' || method === 'notEqualTo') && typeof param === 'string') return param;
        if ((method === 'require_from_group' || method === 'skip_or_fill_minimum') && param && typeof param[1] === 'string') return param[1];
        return undefined;
    }

    function remoteRule(value, rule, env) {
        const validator = $.data(env.form, 'validator');
        if (validator.optional(env.field)) return true;
        const p = typeof rule.param === 'string' ? { url: rule.param } : (rule.param || {});
        const coreRule = {
            type: 'remote',
            url: p.url,
            method: (p.type || p.method || 'GET'),
            encoding: /json/i.test(p.contentType || '') ? 'json' : 'form',
            headers: p.headers,
            timeout: p.timeout,
            cache: p.cache !== false,
            credentials: p.xhrFields && p.xhrFields.withCredentials ? 'include' : undefined,
            data: () => { const d = {}; $.each(p.data || {}, function (k, v) { d[k] = isFn(v) ? v() : v; }); return d; }
        };
        return FV.getRule('remote').fn(value, coreRule, env);
    }

    function ensureRegistered(method) {
        if (registered[method]) return;
        registered[method] = true;
        const key = 'jq:' + method;
        if (method === 'remote') { FV.registerRule(key, remoteRule, { remote: true }); return; }
        FV.registerRule(key, function (value, rule, env) {
            const validator = $.data(env.form, 'validator'), fn = Validator.methods[method];
            if (!validator || !fn) return true;
            let val = validator.elementValue(env.field);
            if (isFn(rule.normalizer)) val = rule.normalizer.call(env.field, val);
            const res = fn.call(validator, val, env.field, rule.param);
            if (res === 'dependency-mismatch' || res === 'pending') return true;
            if (res && isFn(res.then)) return res;
            return !!res;
        }, { runOnEmpty: true }); // jQuery methods decide for themselves via this.optional(element)
    }

    // ------------------------------------------------------------------ Validator instance
    $.extend(Validator.prototype, {
        _init() {
            const self = this, s = this.settings, form = this.currentForm;
            $.data(form, 'validator', this);
            this.fv = FV.init({ form, rules: {}, config: this._buildConfig() });
            if (s.invalidHandler) $(form).on('invalid-form.validate', s.invalidHandler);
            const onFocusIn = function (e) { // native listener: works in every browser and jQuery version
                if (isFn(s.onfocusin)) s.onfocusin.call(self, e.target, e);
                if (!s.focusCleanup) return;
                const u = self.fv.unitOf(e.target);
                if (u && self.fv._errors.has(u.key)) self.fv.clearError(u.fields[0].name);
            };
            form.addEventListener('focusin', onFocusIn);
            this.fv._listeners.push(() => form.removeEventListener('focusin', onFocusIn));
            this._syncContainers();
        },

        _buildConfig() {
            const self = this, s = this.settings;
            let validateHidden = true, ignore = null;
            if (typeof s.ignore === 'string' && s.ignore.trim()) {
                const parts = s.ignore.split(',').map(x => x.trim()).filter(Boolean);
                validateHidden = !parts.includes(':hidden');
                const rest = parts.filter(x => x !== ':hidden').join(',');
                ignore = rest || null;
            }
            this._groupOf = {};
            Object.keys(s.groups || {}).forEach(g => String(s.groups[g]).split(/\s+/).filter(Boolean).forEach(n => { this._groupOf[n] = g; }));
            this._holder = D().createElement('div');   // showErrors mode: messages wait here, detached, until defaultShowErrors() places them
            const errorPlacement = isFn(s.showErrors) ? function (errorEl) { self._holder.appendChild(errorEl); }
                : (isFn(s.errorPlacement) || $(s.errorLabelContainer).length || s.wrapper
                    ? function (errorEl, field) { self._place($(errorEl), field); } : null);
            return {
                trim: s.trim !== false,
                novalidate: true,
                focusInvalid: s.focusInvalid,
                validateHidden, ignore,
                validateOn: s.onfocusout === false ? ['change'] : ['blur', 'change'],
                validateAfterSubmit: s.onkeyup !== false,
                liveInput: s.onkeyup !== false,
                skipEmptyUntilSubmit: true,
                debounce: 0,
                errorElement: s.errorElement,
                unobtrusive: !!s.unobtrusive,   // read ASP.NET data-val-* attributes and use data-valmsg-for / data-valmsg-summary
                errorClass: s.errorClass,
                pendingClass: s.pendingClass,   // jQuery Validation adds "pending" to a field while a remote check runs
                invalidClass: '',
                errorPlacement,
                interceptSubmit: s.onsubmit !== false,
                skipSubmitter: '.cancel',
                fieldRules: field => self._coreRules(field),
                resolveMessage: (rule, env, dynamic) => {
                    if (!rule.method) return '';   // a rule that did not come from jQuery-style settings (ASP.NET data-val-*): the engine picks its message
                    // a message the developer wrote for this field wins over FileValidator's detailed one; server (remote) messages always win
                    if (dynamic && rule.method === 'fileValidator' && self._hasCustomMessage(env.field, rule.method)) dynamic = null;
                    return dynamic || self.defaultMessage(env.field, { method: rule.method, parameters: rule.param });
                },
                highlight: (field, unit) => { if (field === unit.fields[0]) { self.settings.highlight.call(self, field, s.errorClass, s.validClass); self._syncContainers(); self._afterErrorChange(); } },
                unhighlight: (field, unit) => { if (field === unit.fields[0]) { self._removeSuccess(field); self.settings.unhighlight.call(self, field, s.errorClass, s.validClass); self._syncContainers(); self._afterErrorChange(); } },
                onFieldValid: field => self._success(field),
                onError: () => { $(self.currentForm).triggerHandler('invalid-form', [self]); },
                // AJAX in one step: onSubmit(values, event, validator) gets the validated values; returning { errors: { field: message } } shows the server's messages
                onSubmit: isFn(s.onSubmit) ? function (values, event) { return s.onSubmit.call(self, values, event, self); } : undefined,
                submitHandler: s.debug || isFn(s.submitHandler) ? function (form, event, values) {
                    if (s.debug) { if (root.console) console.log('Submit handler called. The form is not submitted because "debug" is on.'); return false; }
                    let hidden = null;
                    const sub = event && event.submitter;
                    if (sub && sub.name) hidden = $('<input type="hidden"/>').attr('name', sub.name).val($(sub).val()).appendTo(form);
                    const r = s.submitHandler.call(self, form, event, values);   // jQuery Validation passes (form, event); the validated values are a third argument
                    if (hidden) hidden.remove();
                    return r;
                } : null
            };
        },

        _coreRules(element) {
            const self = this, rules = rulesFor(element), out = [];
            $.each(rules, function (method, param) {
                if (method === 'normalizer') return;
                ensureRegistered(method);
                out.push({ type: 'jq:' + method, method, param, normalizer: rules.normalizer, dependsOn: dependsOnFor(method, param) });
            });
            return out;
        },

        _place($error, field) {
            const s = this.settings, $field = $(field);
            const container = $(s.errorLabelContainer);
            let node = $error;
            if (s.wrapper) { node = $error.wrap('<' + s.wrapper + '/>').parent(); this._wrappers = this._wrappers || new Map(); this._wrappers.set(field, node); }
            if (container.length) { container.append(node); return; }
            if (isFn(s.errorPlacement)) s.errorPlacement.call(this, node, $field);
            else node.insertAfter($field);
        },

        _success(field) {
            const s = this.settings;
            if (!s.success || this.optional(field)) return;
            const $label = $('<' + s.errorElement + '/>').addClass(s.validClass).attr('for', field.id || '').text('');
            if (typeof s.success === 'string') $label.addClass(s.success); else if (isFn(s.success)) s.success.call(this, $label, field);
            this._successLabels = this._successLabels || new Map();
            this._successLabels.set(field, $label);
            if (isFn(s.errorPlacement)) s.errorPlacement.call(this, $label, $(field)); else $label.insertAfter(field);
        },

        _removeSuccess(field) {
            if (this._successLabels && this._successLabels.has(field)) { this._successLabels.get(field).remove(); this._successLabels.delete(field); }
            if (this._wrappers && this._wrappers.has(field)) { this._wrappers.get(field).remove(); this._wrappers.delete(field); }
        },

        // ---- groups: one visible message per group; showErrors: hand the messages to your own renderer
        _syncGroups() {
            if (!this._groupOf || !Object.keys(this._groupOf).length) return;
            const seen = {};
            this.fv.getErrors().sort((a, b) => (a.field.compareDocumentPosition(b.field) & 4 ? -1 : 1)).forEach(e => {
                const g = this._groupOf[e.name];
                if (!g) return;
                e.el.hidden = !!seen[g];       // the first error of a group shows, later ones are hidden (and not announced)
                seen[g] = true;
            });
        },

        _afterErrorChange() {
            this._syncGroups();
            if (isFn(this.settings.showErrors) && !this._showQueued) {   // async paths (blur, typing, submit): call it once per tick
                this._showQueued = true;
                Promise.resolve().then(() => { if (this._showQueued) this._runShowErrors(); });
            }
        },

        _runShowErrors() {
            this._showQueued = false;
            if (isFn(this.settings.showErrors)) this.settings.showErrors.call(this, this.errorMap, this.errorList);
        },

        /** Place every current message the normal way (after its field, or through errorPlacement). For use inside your showErrors. */
        defaultShowErrors() {
            this.fv.getErrors().forEach(e => {
                if (this.settings.errorLabelContainer && $(this.settings.errorLabelContainer).length || isFn(this.settings.errorPlacement) || this.settings.wrapper) this._place($(e.el), e.field);
                else $(e.field).after(e.el);
            });
            this._syncGroups();
            this._syncContainers();
        },

        _syncContainers() {
            const s = this.settings, all = $(s.errorContainer).add(s.errorLabelContainer);
            if (!all.length) return;
            if (this.fv && this.fv.getErrors().length) all.show(); else all.hide();
        },

        // ---- public API of the original validator object
        form() {
            const ok = this.fv.validateSync({ submit: true });
            this._syncContainers();
            this._runShowErrors();
            return ok;
        },
        element(element) {
            element = this.validationTargetFor(this.clean(element));
            const r = this.fv.validateElementSync(element);
            this._syncContainers();
            this._runShowErrors();
            return r !== false;
        },
        valid() { return this.size() === 0; },
        size() { return this.fv.getErrors().length; },
        numberOfInvalids() { return this.size(); },
        resetForm() { this.submitted = {}; this.fv.resetForm(); this._syncContainers(); },
        showErrors(errors) {
            if (errors) { Object.keys(errors).forEach(name => this.fv.setError(name, errors[name])); this._syncContainers(); }
        },
        /** The validated values as an object, ready for $.ajax / fetch: text trimmed, checkbox groups and multiple selects as arrays (passwords never trimmed). */
        getValues() { return this.fv.getValues(); },
        /** Resolves to { valid, values, errors }; shows the errors like form() does. */
        validateAndGetValues(options) { const self = this; return this.fv.validateAndGetValues(options).then(r => { self._syncContainers(); return r; }); },
        /** An event handler: validates, then calls fn(values, event, validator) only when the form is valid. fn may return { errors: { field: message } } from the server. */
        handleSubmit(fn) { const self = this; return event => this.fv.handleSubmit(fn)(event).then(r => { self._syncContainers(); return r; }); },
        hideErrors() { this.fv.clearErrors(); this._syncContainers(); },
        focusInvalid() {
            const e = this.fv.getErrors()[0];
            if (e) { try { e.field.focus(); } catch (x) { /* not focusable */ } }
        },
        destroy() {
            this.resetForm();
            this.fv.destroy();
            $(this.currentForm).off('.validate').removeData('validator');
        },
        clean(selector) { return $(selector)[0]; },
        validationTargetFor(element) {
            if (this.checkable(element)) element = this.findByName(element.name)[0] || element;
            return element;
        },
        findLastActive() {
            const last = this.lastActive;
            return last && $.grep(this.fv.getErrors(), n => n.field === last).length === 1 && last;
        },
        idOrName(element) { return element.id || element.name || ''; },
        escapeCssMeta(string) { return string.replace(/([\\!"#$%&'()*+,./:;<=>?@\[\]^`{|}~])/g, '\\$1'); },
        objectLength(obj) { return Object.keys(obj).length; },
        /** The error labels that belong to a field (matched by their `for` attribute). */
        errorsFor(element) {
            const id = this.idOrName(this.clean(element)), s = this.settings;
            return $(this.currentForm).find(s.errorElement + '.' + String(s.errorClass).split(' ').join('.')).filter(function () { return $(this).attr('for') === id; });
        },
        checkable(element) { return /radio|checkbox/i.test(element.type); },
        findByName(name) { return $(this.currentForm).find('[name="' + escName(name) + '"]'); },
        getLength(value, element) {
            switch (element.nodeName.toLowerCase()) {
                case 'select': return $('option:selected', element).length;
                case 'input': if (this.checkable(element)) return this.findByName(element.name).filter(':checked').length;
            }
            return value.length;
        },
        depend(param, element) {
            switch (typeof param) {
                case 'boolean': return param;
                case 'string': return !!$(param, element.form).length;
                case 'function': return param(element);
                default: return true;
            }
        },
        optional(element) {
            const val = this.elementValue(element);
            return !Validator.methods.required.call(this, val, element) && 'dependency-mismatch';
        },
        elementValue(element) {
            const $el = $(element), type = element.type;
            let val;
            if (type === 'radio' || type === 'checkbox') return this.findByName(element.name).filter(':checked').val();
            if (type === 'number' && element.validity !== undefined) return element.validity.badInput ? 'NaN' : $el.val();
            val = element.hasAttribute('contenteditable') ? $el.text() : $el.val();
            if (type === 'file') {
                if (element.files && element.files.length) return element.files[0].name; // more robust than the "fakepath" value
                if (val.substr(0, 12) === 'C:\\fakepath\\') return val.substr(12);
                const idx = val.lastIndexOf('/'); if (idx >= 0) return val.substr(idx + 1);
                const idx2 = val.lastIndexOf('\\'); if (idx2 >= 0) return val.substr(idx2 + 1);
                return val;
            }
            if (typeof val === 'string') {
                val = val.replace(/\r/g, '');
                if (this.settings.trim !== false && type !== 'password') val = trim(val);
            }
            return val;
        },
        elements() {
            const self = this;
            const seen = {};
            return $(this.currentForm).find('input, select, textarea, [contenteditable]')
                .not(':submit, :reset, :image, :disabled').filter(function () {
                    if (!this.name || seen[this.name] || $.isEmptyObject(rulesFor(this))) return false;
                    seen[this.name] = true;
                    return true;
                });
        },
        invalidElements() { return $(this.fv.getErrors().map(e => e.field)); },
        validElements() { const bad = this.fv.getErrors().map(e => e.field); return this.elements().not(function () { return bad.indexOf(this) > -1; }); },
        _hasCustomMessage(element, method) {
            const m = this.settings.messages[element.name];
            return !!((m && (m.constructor === String ? m : m[method])) || $(element).data('msg' + cap(method)) || $(element).data('msg'));
        },
        defaultMessage(element, rule) {
            if (typeof rule === 'string') rule = { method: rule };
            const s = this.settings, method = rule.method;
            const custom = (() => { const m = s.messages[element.name]; return m && (m.constructor === String ? m : m[method]); })();
            const dataMsg = $(element).data('msg' + cap(method)) || $(element).data('msg');
            const message = [custom, dataMsg, (!s.ignoreTitle && element.title) || undefined, Validator.messages[method],
                '<strong>Warning: No message defined for ' + element.name + '</strong>'].find(m => m !== undefined && m !== '');
            const re = /\$?\{(\d+)\}/g;
            if (isFn(message)) return message.call(this, rule.parameters, element);
            if (re.test(message)) return Validator.format(message.replace(re, '{$1}'), rule.parameters);
            return message;
        }
    });

    Object.defineProperty(Validator.prototype, 'errorList', {
        get() { return this.fv.getErrors().map(e => ({ message: e.message, element: e.field, method: undefined })); }
    });
    Object.defineProperty(Validator.prototype, 'errorMap', {
        get() { const m = {}; this.fv.getErrors().forEach(e => { m[e.name] = e.message; }); return m; }
    });

    // ------------------------------------------------------------------ jQuery plugin surface
    $.validator = Validator;

    /**
     * ASP.NET MVC's jquery.validate.unobtrusive replacement: $.validator.unobtrusive.parse(selector) validates the forms that hold data-val="true" fields from their
     * data-val-* attributes (messages, data-valmsg-for, data-valmsg-summary and the input-validation-* / field-validation-* classes work as before), and
     * $.validator.unobtrusive.adapters.add / addBool / addSingleVal / addMinMax are the same helpers, so custom adapters keep working.
     */
    Validator.unobtrusive = {
        adapters: FV.unobtrusive.adapters,
        parse(selector) {
            const $scope = $(selector === undefined ? D() : selector);
            const forms = $scope.find('form').addBack('form').add($scope.closest('form')).toArray().filter((f, i, a) => a.indexOf(f) === i);
            forms.forEach(form => {
                if (!form.querySelector('[data-val="true"]')) return;
                if (!$.data(form, 'validator')) $(form).validate({ unobtrusive: true, errorClass: 'input-validation-error', validClass: 'input-validation-valid', errorElement: 'span' });
            });
            return $scope;
        },
        parseElement() { /* rules are read from the attributes when a field is checked; nothing to do */ }
    };

    $.extend($.fn, {
        validate(options) {
            if (!this.length) { if (options && options.debug && root.console) console.warn("Nothing selected, can't validate, returning nothing."); return; }
            let validator = $.data(this[0], 'validator');
            if (validator) return validator;
            this.attr('novalidate', 'novalidate');
            validator = new Validator(options, this[0]);
            $.data(this[0], 'validator', validator);
            return validator;
        },
        valid() {
            let valid, validator, errorList;
            if ($(this[0]).is('form')) valid = this.validate().form();
            else {
                errorList = [];
                valid = true;
                validator = $(this[0].form).validate();
                this.each(function () { valid = validator.element(this) && valid; if (!valid) errorList = errorList.concat(validator.errorList); });
            }
            return valid;
        },
        rules(command, argument) {
            const element = this[0];
            if (!element) return;
            if (command) {
                const settings = $.data(element.form, 'validator').settings, staticRules = settings.rules, existing = Validator.staticRules(element);
                switch (command) {
                    case 'add':
                        $.extend(existing, Validator.normalizeRule(argument));
                        delete existing.messages;
                        staticRules[element.name] = existing;
                        if (argument.messages) settings.messages[element.name] = $.extend(settings.messages[element.name], argument.messages);
                        break;
                    case 'remove':
                        if (!argument) { delete staticRules[element.name]; return existing; }
                        const filtered = {};
                        $.each(argument.split(/\s/), function (i, method) { filtered[method] = existing[method]; delete existing[method]; });
                        return filtered;
                }
            }
            return rulesFor(element);
        }
    });

    const pseudos = $.expr.pseudos || $.expr[':'];
    $.extend(pseudos, {
        blank: a => !trim('' + $(a).val()),
        filled: a => { const v = $(a).val(); return v !== null && !!trim('' + v); },
        unchecked: a => !$(a).prop('checked')
    });

    return Validator;
});

    };

    mods["formValidator.additional"] = function (module, exports, require, define) {
/*!
 * FormValidator — additional methods for the jQuery Validation layer v1.0.0
 *
 * The country and bank checks of the jQuery Validation plugin's additional-methods.js that the core layer does not already contain
 * (abaRoutingNumber, bic, cpfBR, cnpjBR, nifES, phoneUK, postcodeUK, zipcodeUS, vinUS, currency, greaterThan, maxsize, ...), with the same
 * names, parameters and default messages, so $('#f').validate({ rules: { cpf: { cpfBR: true } } }) keeps working without the old file.
 * Methods that the core layer already provides (accept, extension, pattern, phoneUS, iban, ipv4, ipv6, time, ...) are not repeated here.
 *
 * Derived from jquery-validation additional-methods.js, Copyright (c) Jörn Zaefferer, released under the MIT license.
 * Load order:  jQuery  →  formValidator.js  →  formValidator.jquery.js  →  formValidator.additional.js   (the one-file bundle does all of it)
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['jquery'], function ($) { return factory($); });
    else if (typeof module === 'object' && module.exports) {
        module.exports = factory(root.jQuery || (function () { try { return require('jquery'); } catch (e) { return null; } })());
    } else factory(root.jQuery);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function ($) {
    if (!$ || !$.validator) throw new Error('formValidator.additional.js needs jQuery and formValidator.jquery.js loaded first');

/**
 * This is used in the United States to process payments, deposits,
 * or transfers using the Automated Clearing House (ACH) or Fedwire
 * systems. A very common use case would be to validate a form for
 * an ACH bill payment.
 */
$.validator.addMethod( "abaRoutingNumber", function( value ) {
	var checksum = 0;
	var tokens = value.split( "" );
	var length = tokens.length;

	// Length Check
	if ( length !== 9 ) {
		return false;
	}

	// Calc the checksum
	// https://en.wikipedia.org/wiki/ABA_routing_transit_number
	for ( var i = 0; i < length; i += 3 ) {
		checksum +=	parseInt( tokens[ i ], 10 )     * 3 +
					parseInt( tokens[ i + 1 ], 10 ) * 7 +
					parseInt( tokens[ i + 2 ], 10 );
	}

	// If not zero and divisible by 10 then valid
	if ( checksum !== 0 && checksum % 10 === 0 ) {
		return true;
	}

	return false;
}, "Please enter a valid routing number." );

/*
 * Dutch bank account numbers (not 'giro' numbers) have 9 digits
 * and pass the '11 check'.
 * We accept the notation with spaces, as that is common.
 * acceptable: 123456789 or 12 34 56 789
 */
$.validator.addMethod( "bankaccountNL", function( value, element ) {
	if ( this.optional( element ) ) {
		return true;
	}
	if ( !( /^[0-9]{9}|([0-9]{2} ){3}[0-9]{3}$/.test( value ) ) ) {
		return false;
	}

	// Now '11 check'
	var account = value.replace( / /g, "" ), // Remove spaces
		sum = 0,
		len = account.length,
		pos, factor, digit;
	for ( pos = 0; pos < len; pos++ ) {
		factor = len - pos;
		digit = account.substring( pos, pos + 1 );
		sum = sum + factor * digit;
	}
	return sum % 11 === 0;
}, "Please specify a valid bank account number." );

$.validator.addMethod( "bankorgiroaccountNL", function( value, element ) {
	return this.optional( element ) ||
			( $.validator.methods.bankaccountNL.call( this, value, element ) ) ||
			( $.validator.methods.giroaccountNL.call( this, value, element ) );
}, "Please specify a valid bank or giro account number." );

/**
 * BIC is the business identifier code (ISO 9362). This BIC check is not a guarantee for authenticity.
 *
 * BIC pattern: BBBBCCLLbbb (8 or 11 characters long; bbb is optional)
 *
 * Validation is case-insensitive. Please make sure to normalize input yourself.
 *
 * BIC definition in detail:
 * - First 4 characters - bank code (only letters)
 * - Next 2 characters - ISO 3166-1 alpha-2 country code (only letters)
 * - Next 2 characters - location code (letters and digits)
 *   a. shall not start with '0' or '1'
 *   b. second character must be a letter ('O' is not allowed) or digit ('0' for test (therefore not allowed), '1' denoting passive participant, '2' typically reverse-billing)
 * - Last 3 characters - branch code, optional (shall not start with 'X' except in case of 'XXX' for primary office) (letters and digits)
 */
$.validator.addMethod( "bic", function( value, element ) {
    return this.optional( element ) || /^([A-Z]{6}[A-Z2-9][A-NP-Z1-9])(X{3}|[A-WY-Z0-9][A-Z0-9]{2})?$/.test( value.toUpperCase() );
}, "Please specify a valid BIC code." );

/*
 * Código de identificación fiscal ( CIF ) is the tax identification code for Spanish legal entities
 * Further rules can be found in Spanish on http://es.wikipedia.org/wiki/C%C3%B3digo_de_identificaci%C3%B3n_fiscal
 *
 * Spanish CIF structure:
 *
 * [ T ][ P ][ P ][ N ][ N ][ N ][ N ][ N ][ C ]
 *
 * Where:
 *
 * T: 1 character. Kind of Organization Letter: [ABCDEFGHJKLMNPQRSUVW]
 * P: 2 characters. Province.
 * N: 5 characters. Secuencial Number within the province.
 * C: 1 character. Control Digit: [0-9A-J].
 *
 * [ T ]: Kind of Organizations. Possible values:
 *
 *   A. Corporations
 *   B. LLCs
 *   C. General partnerships
 *   D. Companies limited partnerships
 *   E. Communities of goods
 *   F. Cooperative Societies
 *   G. Associations
 *   H. Communities of homeowners in horizontal property regime
 *   J. Civil Societies
 *   K. Old format
 *   L. Old format
 *   M. Old format
 *   N. Nonresident entities
 *   P. Local authorities
 *   Q. Autonomous bodies, state or not, and the like, and congregations and religious institutions
 *   R. Congregations and religious institutions (since 2008 ORDER EHA/451/2008)
 *   S. Organs of State Administration and regions
 *   V. Agrarian Transformation
 *   W. Permanent establishments of non-resident in Spain
 *
 * [ C ]: Control Digit. It can be a number or a letter depending on T value:
 * [ T ]  -->  [ C ]
 * ------    ----------
 *   A         Number
 *   B         Number
 *   E         Number
 *   H         Number
 *   K         Letter
 *   P         Letter
 *   Q         Letter
 *   S         Letter
 *
 */
$.validator.addMethod( "cifES", function( value, element ) {
	"use strict";

	if ( this.optional( element ) ) {
		return true;
	}

	var cifRegEx = new RegExp( /^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/gi );
	var letter  = value.substring( 0, 1 ), // [ T ]
		number  = value.substring( 1, 8 ), // [ P ][ P ][ N ][ N ][ N ][ N ][ N ]
		control = value.substring( 8, 9 ), // [ C ]
		all_sum = 0,
		even_sum = 0,
		odd_sum = 0,
		i, n,
		control_digit,
		control_letter;

	function isOdd( n ) {
		return n % 2 === 0;
	}

	// Quick format test
	if ( value.length !== 9 || !cifRegEx.test( value ) ) {
		return false;
	}

	for ( i = 0; i < number.length; i++ ) {
		n = parseInt( number[ i ], 10 );

		// Odd positions
		if ( isOdd( i ) ) {

			// Odd positions are multiplied first.
			n *= 2;

			// If the multiplication is bigger than 10 we need to adjust
			odd_sum += n < 10 ? n : n - 9;

		// Even positions
		// Just sum them
		} else {
			even_sum += n;
		}
	}

	all_sum = even_sum + odd_sum;
	control_digit = ( 10 - ( all_sum ).toString().slice( -1 ) ).toString();
	control_digit = parseInt( control_digit, 10 ) > 9 ? "0" : control_digit;
	control_letter = "JABCDEFGHI".charAt( control_digit ).toString();

	// Control must be a digit
	if ( letter.match( /[ABEH]/ ) ) {
		return control === control_digit;

	// Control must be a letter
	} else if ( letter.match( /[KPQS]/ ) ) {
		return control === control_letter;
	}

	// Can be either
	return control === control_digit || control === control_letter;

}, "Please specify a valid CIF number." );

/*
 * Brazillian CNH number (Carteira Nacional de Habilitacao) is the License Driver number.
 * CNH numbers have 11 digits in total: 9 numbers followed by 2 check numbers that are being used for validation.
 */
$.validator.addMethod( "cnhBR", function( value ) {

  // Removing special characters from value
  value = value.replace( /([~!@#$%^&*()_+=`{}\[\]\-|\\:;'<>,.\/? ])+/g, "" );

  // Checking value to have 11 digits only
  if ( value.length !== 11 ) {
    return false;
  }

  var sum = 0, dsc = 0, firstChar,
		firstCN, secondCN, i, j, v;

  firstChar = value.charAt( 0 );

  if ( new Array( 12 ).join( firstChar ) === value ) {
    return false;
  }

  // Step 1 - using first Check Number:
  for ( i = 0, j = 9, v = 0; i < 9; ++i, --j ) {
    sum += +( value.charAt( i ) * j );
  }

  firstCN = sum % 11;
  if ( firstCN >= 10 ) {
    firstCN = 0;
    dsc = 2;
  }

  sum = 0;
  for ( i = 0, j = 1, v = 0; i < 9; ++i, ++j ) {
    sum += +( value.charAt( i ) * j );
  }

  secondCN = sum % 11;
  if ( secondCN >= 10 ) {
    secondCN = 0;
  } else {
    secondCN = secondCN - dsc;
  }

  return ( String( firstCN ).concat( secondCN ) === value.substr( -2 ) );

}, "Please specify a valid CNH number." );

/*
 * Brazillian value number (Cadastrado de Pessoas Juridica).
 * value numbers have 14 digits in total: 12 numbers followed by 2 check numbers that are being used for validation.
 */
$.validator.addMethod( "cnpjBR", function( value, element ) {
	"use strict";

	if ( this.optional( element ) ) {
		return true;
	}

	// Removing no number
	value = value.replace( /[^\d]+/g, "" );

	// Checking value to have 14 digits only
	if ( value.length !== 14 ) {
		return false;
	}

	// Elimina values invalidos conhecidos
	if ( value === "00000000000000" ||
		value === "11111111111111" ||
		value === "22222222222222" ||
		value === "33333333333333" ||
		value === "44444444444444" ||
		value === "55555555555555" ||
		value === "66666666666666" ||
		value === "77777777777777" ||
		value === "88888888888888" ||
		value === "99999999999999" ) {
		return false;
	}

	// Valida DVs
	var tamanho = ( value.length - 2 );
	var numeros = value.substring( 0, tamanho );
	var digitos = value.substring( tamanho );
	var soma = 0;
	var pos = tamanho - 7;

	for ( var i = tamanho; i >= 1; i-- ) {
		soma += numeros.charAt( tamanho - i ) * pos--;
		if ( pos < 2 ) {
			pos = 9;
		}
	}

	var resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;

	if ( resultado !== parseInt( digitos.charAt( 0 ), 10 ) ) {
		return false;
	}

	tamanho = tamanho + 1;
	numeros = value.substring( 0, tamanho );
	soma = 0;
	pos = tamanho - 7;

	for ( var il = tamanho; il >= 1; il-- ) {
		soma += numeros.charAt( tamanho - il ) * pos--;
		if ( pos < 2 ) {
			pos = 9;
		}
	}

	resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;

	if ( resultado !== parseInt( digitos.charAt( 1 ), 10 ) ) {
		return false;
	}

	return true;

}, "Please specify a CNPJ value number." );

/*
 * Brazillian CPF number (Cadastrado de Pessoas Físicas) is the equivalent of a Brazilian tax registration number.
 * CPF numbers have 11 digits in total: 9 numbers followed by 2 check numbers that are being used for validation.
 */
$.validator.addMethod( "cpfBR", function( value, element ) {
	"use strict";

	if ( this.optional( element ) ) {
		return true;
	}

	// Removing special characters from value
	value = value.replace( /([~!@#$%^&*()_+=`{}\[\]\-|\\:;'<>,.\/? ])+/g, "" );

	// Checking value to have 11 digits only
	if ( value.length !== 11 ) {
		return false;
	}

	var sum = 0,
		firstCN, secondCN, checkResult, i;

	firstCN = parseInt( value.substring( 9, 10 ), 10 );
	secondCN = parseInt( value.substring( 10, 11 ), 10 );

	checkResult = function( sum, cn ) {
		var result = ( sum * 10 ) % 11;
		if ( ( result === 10 ) || ( result === 11 ) ) {
			result = 0;
		}
		return ( result === cn );
	};

	// Checking for dump data
	if ( value === "" ||
		value === "00000000000" ||
		value === "11111111111" ||
		value === "22222222222" ||
		value === "33333333333" ||
		value === "44444444444" ||
		value === "55555555555" ||
		value === "66666666666" ||
		value === "77777777777" ||
		value === "88888888888" ||
		value === "99999999999"
	) {
		return false;
	}

	// Step 1 - using first Check Number:
	for ( i = 1; i <= 9; i++ ) {
		sum = sum + parseInt( value.substring( i - 1, i ), 10 ) * ( 11 - i );
	}

	// If first Check Number (CN) is valid, move to Step 2 - using second Check Number:
	if ( checkResult( sum, firstCN ) ) {
		sum = 0;
		for ( i = 1; i <= 10; i++ ) {
			sum = sum + parseInt( value.substring( i - 1, i ), 10 ) * ( 12 - i );
		}
		return checkResult( sum, secondCN );
	}
	return false;

}, "Please specify a valid CPF number." );

/* NOTICE: Modified version of Castle.Components.Validator.CreditCardValidator
 * Redistributed under the Apache License 2.0 at http://www.apache.org/licenses/LICENSE-2.0
 * Valid Types: mastercard, visa, amex, dinersclub, enroute, discover, jcb, unknown, all (overrides all other settings)
 */
$.validator.addMethod( "creditcardtypes", function( value, element, param ) {
	if ( /[^0-9\-]+/.test( value ) ) {
		return false;
	}

	value = value.replace( /\D/g, "" );

	var validTypes = 0x0000;

	if ( param.mastercard ) {
		validTypes |= 0x0001;
	}
	if ( param.visa ) {
		validTypes |= 0x0002;
	}
	if ( param.amex ) {
		validTypes |= 0x0004;
	}
	if ( param.dinersclub ) {
		validTypes |= 0x0008;
	}
	if ( param.enroute ) {
		validTypes |= 0x0010;
	}
	if ( param.discover ) {
		validTypes |= 0x0020;
	}
	if ( param.jcb ) {
		validTypes |= 0x0040;
	}
	if ( param.unknown ) {
		validTypes |= 0x0080;
	}
	if ( param.all ) {
		validTypes = 0x0001 | 0x0002 | 0x0004 | 0x0008 | 0x0010 | 0x0020 | 0x0040 | 0x0080;
	}
	if ( validTypes & 0x0001 && ( /^(5[12345])/.test( value ) || /^(2[234567])/.test( value ) ) ) { // Mastercard
		return value.length === 16;
	}
	if ( validTypes & 0x0002 && /^(4)/.test( value ) ) { // Visa
		return value.length === 16;
	}
	if ( validTypes & 0x0004 && /^(3[47])/.test( value ) ) { // Amex
		return value.length === 15;
	}
	if ( validTypes & 0x0008 && /^(3(0[012345]|[68]))/.test( value ) ) { // Dinersclub
		return value.length === 14;
	}
	if ( validTypes & 0x0010 && /^(2(014|149))/.test( value ) ) { // Enroute
		return value.length === 15;
	}
	if ( validTypes & 0x0020 && /^(6011)/.test( value ) ) { // Discover
		return value.length === 16;
	}
	if ( validTypes & 0x0040 && /^(3)/.test( value ) ) { // Jcb
		return value.length === 16;
	}
	if ( validTypes & 0x0040 && /^(2131|1800)/.test( value ) ) { // Jcb
		return value.length === 15;
	}
	if ( validTypes & 0x0080 ) { // Unknown
		return true;
	}
	return false;
}, "Please enter a valid credit card number." );

/**
 * Validates currencies with any given symbols by @jameslouiz
 * Symbols can be optional or required. Symbols required by default
 *
 * Usage examples:
 *  currency: ["£", false] - Use false for soft currency validation
 *  currency: ["$", false]
 *  currency: ["RM", false] - also works with text based symbols such as "RM" - Malaysia Ringgit etc
 *
 *  <input class="currencyInput" name="currencyInput">
 *
 * Soft symbol checking
 *  currencyInput: {
 *     currency: ["$", false]
 *  }
 *
 * Strict symbol checking (default)
 *  currencyInput: {
 *     currency: "$"
 *     //OR
 *     currency: ["$", true]
 *  }
 *
 * Multiple Symbols
 *  currencyInput: {
 *     currency: "$,£,¢"
 *  }
 */
$.validator.addMethod( "currency", function( value, element, param ) {
    var isParamString = typeof param === "string",
        symbol = isParamString ? param : param[ 0 ],
        soft = isParamString ? true : param[ 1 ],
        regex;

    symbol = symbol.replace( /,/g, "" );
    symbol = soft ? symbol + "]" : symbol + "]?";
    regex = "^[" + symbol + "([1-9]{1}[0-9]{0,2}(\\,[0-9]{3})*(\\.[0-9]{0,2})?|[1-9]{1}[0-9]{0,}(\\.[0-9]{0,2})?|0(\\.[0-9]{0,2})?|(\\.[0-9]{1,2})?)$";
    regex = new RegExp( regex );
    return this.optional( element ) || regex.test( value );

}, "Please specify a valid currency." );

$.validator.addMethod( "dateFA", function( value, element ) {
	return this.optional( element ) || /^[1-4]\d{3}\/((0?[1-6]\/((3[0-1])|([1-2][0-9])|(0?[1-9])))|((1[0-2]|(0?[7-9]))\/(30|([1-2][0-9])|(0?[1-9]))))$/.test( value );
}, $.validator.messages.date );

/**
 * Return true, if the value is a valid date, also making this formal check dd/mm/yyyy.
 *
 * @example $.validator.methods.date("01/01/1900")
 * @result true
 *
 * @example $.validator.methods.date("01/13/1990")
 * @result false
 *
 * @example $.validator.methods.date("01.01.1900")
 * @result false
 *
 * @example <input name="pippo" class="{dateITA:true}" />
 * @desc Declares an optional input element whose value must be a valid date.
 *
 * @name $.validator.methods.dateITA
 * @type Boolean
 * @cat Plugins/Validate/Methods
 */
$.validator.addMethod( "dateITA", function( value, element ) {
	var check = false,
		re = /^\d{1,2}\/\d{1,2}\/\d{4}$/,
		adata, gg, mm, aaaa, xdata;
	if ( re.test( value ) ) {
		adata = value.split( "/" );
		gg = parseInt( adata[ 0 ], 10 );
		mm = parseInt( adata[ 1 ], 10 );
		aaaa = parseInt( adata[ 2 ], 10 );
		xdata = new Date( Date.UTC( aaaa, mm - 1, gg, 12, 0, 0, 0 ) );
		if ( ( xdata.getUTCFullYear() === aaaa ) && ( xdata.getUTCMonth() === mm - 1 ) && ( xdata.getUTCDate() === gg ) ) {
			check = true;
		} else {
			check = false;
		}
	} else {
		check = false;
	}
	return this.optional( element ) || check;
}, $.validator.messages.date );

$.validator.addMethod( "dateNL", function( value, element ) {
	return this.optional( element ) || /^(0?[1-9]|[12]\d|3[01])[\.\/\-](0?[1-9]|1[012])[\.\/\-]([12]\d)?(\d\d)$/.test( value );
}, $.validator.messages.date );

/**
 * Dutch giro account numbers (not bank numbers) have max 7 digits
 */
$.validator.addMethod( "giroaccountNL", function( value, element ) {
	return this.optional( element ) || /^[0-9]{1,7}$/.test( value );
}, "Please specify a valid giro account number." );

$.validator.addMethod( "greaterThan", function( value, element, param ) {
    var target = $( param );

    if ( this.settings.onfocusout && target.not( ".validate-greaterThan-blur" ).length ) {
        target.addClass( "validate-greaterThan-blur" ).on( "blur.validate-greaterThan", function() {
            $( element ).valid();
        } );
    }

    return value > target.val();
}, "Please enter a greater value." );

$.validator.addMethod( "greaterThanEqual", function( value, element, param ) {
    var target = $( param );

    if ( this.settings.onfocusout && target.not( ".validate-greaterThanEqual-blur" ).length ) {
        target.addClass( "validate-greaterThanEqual-blur" ).on( "blur.validate-greaterThanEqual", function() {
            $( element ).valid();
        } );
    }

    return value >= target.val();
}, "Please enter a greater value." );

$.validator.addMethod( "lessThan", function( value, element, param ) {
    var target = $( param );

    if ( this.settings.onfocusout && target.not( ".validate-lessThan-blur" ).length ) {
        target.addClass( "validate-lessThan-blur" ).on( "blur.validate-lessThan", function() {
            $( element ).valid();
        } );
    }

    return value < target.val();
}, "Please enter a lesser value." );

$.validator.addMethod( "lessThanEqual", function( value, element, param ) {
    var target = $( param );

    if ( this.settings.onfocusout && target.not( ".validate-lessThanEqual-blur" ).length ) {
        target.addClass( "validate-lessThanEqual-blur" ).on( "blur.validate-lessThanEqual", function() {
            $( element ).valid();
        } );
    }

    return value <= target.val();
}, "Please enter a lesser value." );

$.validator.addMethod( "maxfiles", function( value, element, param ) {
	if ( this.optional( element ) ) {
		return true;
	}

	if ( $( element ).attr( "type" ) === "file" ) {
		if ( element.files && element.files.length > param ) {
			return false;
		}
	}

	return true;
}, $.validator.format( "Please select no more than {0} files." ) );

$.validator.addMethod( "maxsize", function( value, element, param ) {
	if ( this.optional( element ) ) {
		return true;
	}

	if ( $( element ).attr( "type" ) === "file" ) {
		if ( element.files && element.files.length ) {
			for ( var i = 0; i < element.files.length; i++ ) {
				if ( element.files[ i ].size > param ) {
					return false;
				}
			}
		}
	}

	return true;
}, $.validator.format( "File size must not exceed {0} bytes each." ) );

$.validator.addMethod( "maxsizetotal", function( value, element, param ) {
	if ( this.optional( element ) ) {
		return true;
	}

	if ( $( element ).attr( "type" ) === "file" ) {
		if ( element.files && element.files.length ) {
			var totalSize = 0;

			for ( var i = 0; i < element.files.length; i++ ) {
				totalSize += element.files[ i ].size;
				if ( totalSize > param ) {
					return false;
				}
			}
		}
	}

	return true;
}, $.validator.format( "Total size of all files must not exceed {0} bytes." ) );

$.validator.addMethod( "mobileNL", function( value, element ) {
	return this.optional( element ) || /^((\+|00(\s|\s?\-\s?)?)31(\s|\s?\-\s?)?(\(0\)[\-\s]?)?|0)6((\s|\s?\-\s?)?[0-9]){8}$/.test( value );
}, "Please specify a valid mobile number." );

$.validator.addMethod( "mobileRU", function( phone_number, element ) {
	var ruPhone_number = phone_number.replace( /\(|\)|\s+|-/g, "" );
	return this.optional( element ) || ruPhone_number.length > 9 && /^((\+7|7|8)+([0-9]){10})$/.test( ruPhone_number );
}, "Please specify a valid mobile number." );

/* For UK phone functions, do the following server side processing:
 * Compare original input with this RegEx pattern:
 * ^\(?(?:(?:00\)?[\s\-]?\(?|\+)(44)\)?[\s\-]?\(?(?:0\)?[\s\-]?\(?)?|0)([1-9]\d{1,4}\)?[\s\d\-]+)$
 * Extract $1 and set $prefix to '+44<space>' if $1 is '44', otherwise set $prefix to '0'
 * Extract $2 and remove hyphens, spaces and parentheses. Phone number is combined $prefix and $2.
 * A number of very detailed GB telephone number RegEx patterns can also be found at:
 * http://www.aa-asterisk.org.uk/index.php/Regular_Expressions_for_Validating_and_Formatting_GB_Telephone_Numbers
 */
$.validator.addMethod( "mobileUK", function( phone_number, element ) {
	phone_number = phone_number.replace( /\(|\)|\s+|-/g, "" );
	return this.optional( element ) || phone_number.length > 9 &&
		phone_number.match( /^(?:(?:(?:00\s?|\+)44\s?|0)7(?:[1345789]\d{2}|624)\s?\d{3}\s?\d{3})$/ );
}, "Please specify a valid mobile number." );

$.validator.addMethod( "netmask", function( value, element ) {
    return this.optional( element ) || /^(254|252|248|240|224|192|128)\.0\.0\.0|255\.(254|252|248|240|224|192|128|0)\.0\.0|255\.255\.(254|252|248|240|224|192|128|0)\.0|255\.255\.255\.(254|252|248|240|224|192|128|0)/i.test( value );
}, "Please enter a valid netmask." );

/*
 * The NIE (Número de Identificación de Extranjero) is a Spanish tax identification number assigned by the Spanish
 * authorities to any foreigner.
 *
 * The NIE is the equivalent of a Spaniards Número de Identificación Fiscal (NIF) which serves as a fiscal
 * identification number. The CIF number (Certificado de Identificación Fiscal) is equivalent to the NIF, but applies to
 * companies rather than individuals. The NIE consists of an 'X' or 'Y' followed by 7 or 8 digits then another letter.
 */
$.validator.addMethod( "nieES", function( value, element ) {
	"use strict";

	if ( this.optional( element ) ) {
		return true;
	}

	var nieRegEx = new RegExp( /^[MXYZ]{1}[0-9]{7,8}[TRWAGMYFPDXBNJZSQVHLCKET]{1}$/gi );
	var validChars = "TRWAGMYFPDXBNJZSQVHLCKET",
		letter = value.substr( value.length - 1 ).toUpperCase(),
		number;

	value = value.toString().toUpperCase();

	// Quick format test
	if ( value.length > 10 || value.length < 9 || !nieRegEx.test( value ) ) {
		return false;
	}

	// X means same number
	// Y means number + 10000000
	// Z means number + 20000000
	value = value.replace( /^[X]/, "0" )
		.replace( /^[Y]/, "1" )
		.replace( /^[Z]/, "2" );

	number = value.length === 9 ? value.substr( 0, 8 ) : value.substr( 0, 9 );

	return validChars.charAt( parseInt( number, 10 ) % 23 ) === letter;

}, "Please specify a valid NIE number." );

/*
 * The Número de Identificación Fiscal ( NIF ) is the way tax identification used in Spain for individuals
 */
$.validator.addMethod( "nifES", function( value, element ) {
	"use strict";

	if ( this.optional( element ) ) {
		return true;
	}

	value = value.toUpperCase();

	// Basic format test
	if ( !value.match( "((^[A-Z]{1}[0-9]{7}[A-Z0-9]{1}$|^[T]{1}[A-Z0-9]{8}$)|^[0-9]{8}[A-Z]{1}$)" ) ) {
		return false;
	}

	// Test NIF
	if ( /^[0-9]{8}[A-Z]{1}$/.test( value ) ) {
		return ( "TRWAGMYFPDXBNJZSQVHLCKE".charAt( value.substring( 8, 0 ) % 23 ) === value.charAt( 8 ) );
	}

	// Test specials NIF (starts with K, L or M)
	if ( /^[KLM]{1}/.test( value ) ) {
		return ( value[ 8 ] === "TRWAGMYFPDXBNJZSQVHLCKE".charAt( value.substring( 8, 1 ) % 23 ) );
	}

	return false;

}, "Please specify a valid NIF number." );

/*
 * Numer identyfikacji podatkowej ( NIP ) is the way tax identification used in Poland for companies
 */
$.validator.addMethod( "nipPL", function( value ) {
	"use strict";

	value = value.replace( /[^0-9]/g, "" );

	if ( value.length !== 10 ) {
		return false;
	}

	var arrSteps = [ 6, 5, 7, 2, 3, 4, 5, 6, 7 ];
	var intSum = 0;
	for ( var i = 0; i < 9; i++ ) {
		intSum += arrSteps[ i ] * value[ i ];
	}
	var int2 = intSum % 11;
	var intControlNr = ( int2 === 10 ) ? 0 : int2;

	return ( intControlNr === parseInt( value[ 9 ], 10 ) );
}, "Please specify a valid NIP number." );

/**
 * Created for project jquery-validation.
 * @Description Brazillian PIS or NIS number (Número de Identificação Social Pis ou Pasep) is the equivalent of a
 * Brazilian tax registration number NIS of PIS numbers have 11 digits in total: 10 numbers followed by 1 check numbers
 * that are being used for validation.
 * @copyright (c) 21/08/2018 13:14, Cleiton da Silva Mendonça
 * @author Cleiton da Silva Mendonça <cleiton.mendonca@gmail.com>
 * @link http://gitlab.com/csmendonca Gitlab of Cleiton da Silva Mendonça
 * @link http://github.com/csmendonca Github of Cleiton da Silva Mendonça
 */
$.validator.addMethod( "nisBR", function( value ) {
	var number;
	var cn;
	var sum = 0;
	var dv;
	var count;
	var multiplier;

	// Removing special characters from value
	value = value.replace( /([~!@#$%^&*()_+=`{}\[\]\-|\\:;'<>,.\/? ])+/g, "" );

	// Checking value to have 11 digits only
	if ( value.length !== 11 ) {
		return false;
	}

	//Get check number of value
	cn = parseInt( value.substring( 10, 11 ), 10 );

	//Get number with 10 digits of the value
	number = parseInt( value.substring( 0, 10 ), 10 );

	for ( count = 2; count < 12; count++ ) {
		multiplier = count;
		if ( count === 10 ) {
			multiplier = 2;
		}
		if ( count === 11 ) {
			multiplier = 3;
		}
		sum += ( ( number % 10 ) * multiplier );
		number = parseInt( number / 10, 10 );
	}
	dv = ( sum % 11 );

	if ( dv > 1 ) {
		dv = ( 11 - dv );
	} else {
		dv = 0;
	}

	if ( cn === dv ) {
		return true;
	} else {
		return false;
	}
}, "Please specify a valid NIS/PIS number." );

/**
 * Dutch phone numbers have 10 digits (or 11 and start with +31).
 */
$.validator.addMethod( "phoneNL", function( value, element ) {
	return this.optional( element ) || /^((\+|00(\s|\s?\-\s?)?)31(\s|\s?\-\s?)?(\(0\)[\-\s]?)?|0)[1-9]((\s|\s?\-\s?)?[0-9]){8}$/.test( value );
}, "Please specify a valid phone number." );

/**
 * Polish telephone numbers have 9 digits.
 *
 * Mobile phone numbers starts with following digits:
 * 45, 50, 51, 53, 57, 60, 66, 69, 72, 73, 78, 79, 88.
 *
 * Fixed-line numbers starts with area codes:
 * 12, 13, 14, 15, 16, 17, 18, 22, 23, 24, 25, 29, 32, 33,
 * 34, 41, 42, 43, 44, 46, 48, 52, 54, 55, 56, 58, 59, 61,
 * 62, 63, 65, 67, 68, 71, 74, 75, 76, 77, 81, 82, 83, 84,
 * 85, 86, 87, 89, 91, 94, 95.
 *
 * Ministry of National Defence numbers and VoIP numbers starts with 26 and 39.
 *
 * Excludes intelligent networks (premium rate, shared cost, free phone numbers).
 *
 * Poland National Numbering Plan http://www.itu.int/oth/T02020000A8/en
 */
$.validator.addMethod( "phonePL", function( phone_number, element ) {
	phone_number = phone_number.replace( /\s+/g, "" );
	var regexp = /^(?:(?:(?:\+|00)?48)|(?:\(\+?48\)))?(?:1[2-8]|2[2-69]|3[2-49]|4[1-68]|5[0-9]|6[0-35-9]|[7-8][1-9]|9[145])\d{7}$/;
	return this.optional( element ) || regexp.test( phone_number );
}, "Please specify a valid phone number." );

$.validator.addMethod( "phonesUK", function( phone_number, element ) {
	phone_number = phone_number.replace( /\(|\)|\s+|-/g, "" );
	return this.optional( element ) || phone_number.length > 9 &&
		phone_number.match( /^(?:(?:(?:00\s?|\+)44\s?|0)(?:1\d{8,9}|[23]\d{9}|7(?:[1345789]\d{8}|624\d{6})))$/ );
}, "Please specify a valid uk phone number." );

/* For UK phone functions, do the following server side processing:
 * Compare original input with this RegEx pattern:
 * ^\(?(?:(?:00\)?[\s\-]?\(?|\+)(44)\)?[\s\-]?\(?(?:0\)?[\s\-]?\(?)?|0)([1-9]\d{1,4}\)?[\s\d\-]+)$
 * Extract $1 and set $prefix to '+44<space>' if $1 is '44', otherwise set $prefix to '0'
 * Extract $2 and remove hyphens, spaces and parentheses. Phone number is combined $prefix and $2.
 * A number of very detailed GB telephone number RegEx patterns can also be found at:
 * http://www.aa-asterisk.org.uk/index.php/Regular_Expressions_for_Validating_and_Formatting_GB_Telephone_Numbers
 */
$.validator.addMethod( "phoneUK", function( phone_number, element ) {
	phone_number = phone_number.replace( /\(|\)|\s+|-/g, "" );
	return this.optional( element ) || phone_number.length > 9 &&
		phone_number.match( /^(?:(?:(?:00\s?|\+)44\s?)|(?:\(?0))(?:\d{2}\)?\s?\d{4}\s?\d{4}|\d{3}\)?\s?\d{3}\s?\d{3,4}|\d{4}\)?\s?(?:\d{5}|\d{3}\s?\d{3})|\d{5}\)?\s?\d{4,5})$/ );
}, "Please specify a valid phone number." );

/*
* Valida CEPs do brasileiros:
*
* Formatos aceitos:
* 99999-999
* 99.999-999
* 99999999
*/
$.validator.addMethod( "postalcodeBR", function( cep_value, element ) {
	return this.optional( element ) || /^\d{2}.\d{3}-\d{3}?$|^\d{5}-?\d{3}?$/.test( cep_value );
}, "Informe um CEP válido." );

/**
 * Matches a valid Canadian Postal Code
 *
 * @example jQuery.validator.methods.postalCodeCA( "H0H 0H0", element )
 * @result true
 *
 * @example jQuery.validator.methods.postalCodeCA( "H0H0H0", element )
 * @result false
 *
 * @name jQuery.validator.methods.postalCodeCA
 * @type Boolean
 * @cat Plugins/Validate/Methods
 */
$.validator.addMethod( "postalCodeCA", function( value, element ) {
	return this.optional( element ) || /^[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVWXYZ] *\d[ABCEGHJKLMNPRSTVWXYZ]\d$/i.test( value );
}, "Please specify a valid postal code." );

/* Matches Italian postcode (CAP) */
$.validator.addMethod( "postalcodeIT", function( value, element ) {
	return this.optional( element ) || /^\d{5}$/.test( value );
}, "Please specify a valid postal code." );

$.validator.addMethod( "postalcodeNL", function( value, element ) {
	return this.optional( element ) || /^[1-9][0-9]{3}\s?[a-zA-Z]{2}$/.test( value );
}, "Please specify a valid postal code." );

$.validator.addMethod( "postcodeUK", function( value, element ) {
	return this.optional( element ) || /^((([A-PR-UWYZ][0-9])|([A-PR-UWYZ][0-9][0-9])|([A-PR-UWYZ][A-HK-Y][0-9])|([A-PR-UWYZ][A-HK-Y][0-9][0-9])|([A-PR-UWYZ][0-9][A-HJKSTUW])|([A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRVWXY]))\s?([0-9][ABD-HJLNP-UW-Z]{2})|(GIR)\s?(0AA))$/i.test( value );
}, "Please specify a valid UK postcode." );

/* Validates US States and/or Territories by @jdforsythe
 * Can be case insensitive or require capitalization - default is case insensitive
 * Can include US Territories or not - default does not
 * Can include US Military postal abbreviations (AA, AE, AP) - default does not
 *
 * Note: "States" always includes DC (District of Colombia)
 *
 * Usage examples:
 *
 *  This is the default - case insensitive, no territories, no military zones
 *  stateInput: {
 *     caseSensitive: false,
 *     includeTerritories: false,
 *     includeMilitary: false
 *  }
 *
 *  Only allow capital letters, no territories, no military zones
 *  stateInput: {
 *     caseSensitive: false
 *  }
 *
 *  Case insensitive, include territories but not military zones
 *  stateInput: {
 *     includeTerritories: true
 *  }
 *
 *  Only allow capital letters, include territories and military zones
 *  stateInput: {
 *     caseSensitive: true,
 *     includeTerritories: true,
 *     includeMilitary: true
 *  }
 *
 */
$.validator.addMethod( "stateUS", function( value, element, options ) {
	var isDefault = typeof options === "undefined",
		caseSensitive = ( isDefault || typeof options.caseSensitive === "undefined" ) ? false : options.caseSensitive,
		includeTerritories = ( isDefault || typeof options.includeTerritories === "undefined" ) ? false : options.includeTerritories,
		includeMilitary = ( isDefault || typeof options.includeMilitary === "undefined" ) ? false : options.includeMilitary,
		regex;

	if ( !includeTerritories && !includeMilitary ) {
		regex = "^(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])$";
	} else if ( includeTerritories && includeMilitary ) {
		regex = "^(A[AEKLPRSZ]|C[AOT]|D[CE]|FL|G[AU]|HI|I[ADLN]|K[SY]|LA|M[ADEINOPST]|N[CDEHJMVY]|O[HKR]|P[AR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])$";
	} else if ( includeTerritories ) {
		regex = "^(A[KLRSZ]|C[AOT]|D[CE]|FL|G[AU]|HI|I[ADLN]|K[SY]|LA|M[ADEINOPST]|N[CDEHJMVY]|O[HKR]|P[AR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])$";
	} else {
		regex = "^(A[AEKLPRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])$";
	}

	regex = caseSensitive ? new RegExp( regex ) : new RegExp( regex, "i" );
	return this.optional( element ) || regex.test( value );
}, "Please specify a valid state." );

$.validator.addMethod( "strippedminlength", function( value, element, param ) {
	// DOMParser builds an inert document (the original $( value ) would run <img onerror=...> from user text); without it, strip tags by hand
	var text;
	if ( typeof DOMParser === "function" ) {
		text = new DOMParser().parseFromString( String( value ), "text/html" ).body.textContent;
	} else {
		text = String( value ).replace( /<[^>]*>/g, "" );
	}
	return text.length >= param;
}, $.validator.format( "Please enter at least {0} characters." ) );

$.validator.addMethod( "url2", function( value, element ) {
	return this.optional( element ) || /^(?:(?:(?:https?|ftp):)?\/\/)(?:(?:[^\]\[?\/<~#`!@$^&*()+=}|:";',>{ ]|%[0-9A-Fa-f]{2})+(?::(?:[^\]\[?\/<~#`!@$^&*()+=}|:";',>{ ]|%[0-9A-Fa-f]{2})*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?)|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff])|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62}\.)))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test( value );
}, $.validator.messages.url );

/**
 * Return true, if the value is a valid vehicle identification number (VIN).
 *
 * Works with all kind of text inputs.
 *
 * @example <input type="text" size="20" name="VehicleID" class="{required:true,vinUS:true}" />
 * @desc Declares a required input element whose value must be a valid vehicle identification number.
 *
 * @name $.validator.methods.vinUS
 * @type Boolean
 * @cat Plugins/Validate/Methods
 */
$.validator.addMethod( "vinUS", function( v ) {
    if ( v.length !== 17 ) {
        return false;
    }

    var LL = [ "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T", "U", "V", "W", "X", "Y", "Z" ],
        VL = [ 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 7, 9, 2, 3, 4, 5, 6, 7, 8, 9 ],
        FL = [ 8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2 ],
        rs = 0,
        i, n, d, f, cd, cdv;

    for ( i = 0; i < 17; i++ ) {
        f = FL[ i ];
        d = v.slice( i, i + 1 );
        if ( isNaN( d ) ) {
            d = d.toUpperCase();
            n = VL[ LL.indexOf( d ) ];
        } else {
            n = parseInt( d, 10 );
        }
        if ( i === 8 )
        {
            cdv = n;
            if ( d === "X" ) {
                cdv = 10;
            }
        }
        rs += n * f;
    }
    cd = rs % 11;
    if ( cd === cdv ) {
        return true;
    }
    return false;
}, "The specified vehicle identification number (VIN) is invalid." );

$.validator.addMethod( "zipcodeUS", function( value, element ) {
	return this.optional( element ) || /^\d{5}(-\d{4})?$/.test( value );
}, "The specified US ZIP Code is invalid." );

$.validator.addMethod( "ziprange", function( value, element ) {
	return this.optional( element ) || /^90[2-5]\d\{2\}-\d{4}$/.test( value );
}, "Your ZIP-code must be in the range 902xx-xxxx to 905xx-xxxx." );


    return $.validator;
});

    };

    mods["locale"] = function (module, exports, require, define) {
/*!
 * FVLocales v1.0.0 — language packs for FormValidator, FileValidator, the upload widget and the jQuery Validation layer.
 *
 *   <script src="dist/validator.min.js"></script>          <!-- the bundle already contains this registry -->
 *   <script src="dist/locales/de.js"></script>            <!-- one script per language, after the bundle (or dist/locales/all.js) -->
 *   <script>FVLocales.use('de');</script>                 <!-- everything is German now -->
 *
 *   FVLocales.auto();                     // the visitor's browser language, else English
 *   FVLocales.use('ar', { document: true });   // also sets <html lang="ar" dir="rtl">
 *   FVLocales.register('sv', { name: 'Svenska', form: { required: 'Fältet är obligatoriskt.' } });   // your own language; missing texts stay English
 *
 * A pack is { name, dir: 'ltr' | 'rtl', form: { ruleType: text }, file: { ERROR_CODE: text }, phrases: { 'English fragment': text },
 *             units: { B, KB, MB, GB }, jquery: { method: text } }.
 * Texts use {0} {1} for rule parameters (form) and {name} placeholders as in the English text (file). `use('en')` restores English.
 *
 * Changelog
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define([], function () { return factory(root); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root);
    else root.FVLocales = factory(root);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
    'use strict';

    /** The English fragments FileValidator and the widget look up (FileValidator.phrases); plural sentences are objects keyed by CLDR category. */
    const PHRASE_KEYS = ['Office document', 'document', 'ZIP archive', 'PDF', 'the file is too short',
        'the ZIP directory at the end of the file is missing (the file may be cut off)', 'the ZIP directory points outside the file', 'the ZIP directory is damaged',
        'unsafe file paths inside the archive', 'it holds {n} files', 'it would expand to {size}', 'it compresses {ratio} times, which is not normal for a real document',
        'required parts are missing, so it is not a real {type} file', 'macros', 'embedded programs', 'the end of the file is missing (it may be cut off)',
        'JavaScript in a PDF', 'a launch action in a PDF', 'an embedded program in a PDF', 'scripts', 'hidden extra data',
        'Remove {name}', '…and {n} more.', '{n} selected.', '{name} removed. {n} selected.', 'All files removed.', 'status.added', 'status.rejected'];

    const packs = { en: { name: 'English', dir: 'ltr' } };
    const seen = new Set();        // queued pack objects this registry already took in
    const snapshots = {};          // English originals, taken the first time a language is applied
    let current = 'en';

    const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const tryRequire = name => { try { return typeof require === 'function' ? require(name) : null; } catch (e) { return null; } };
    const targets = () => ({
        form: root.FormValidator || tryRequire('./formValidator.js'),
        file: root.FileValidator || tryRequire('./fileValidator.js'),
        jq: root.jQuery && root.jQuery.validator && root.jQuery.validator.__fv ? root.jQuery.validator : null
    });

    /** Packs whose script ran before this registry (or that were required in Node) wait in FVLocalePacks: take them in. */
    function pullQueued() {
        const queued = root.FVLocalePacks;
        if (!isObj(queued)) return;
        // the queue stays as it is (another registry, for example the server's, may need the same packs); each pack object is taken in once per registry
        Object.keys(queued).forEach(code => { const pack = queued[code]; if (seen.has(pack)) return; seen.add(pack); register(code, pack); });
    }

    const find = code => {
        pullQueued();
        const wanted = String(code || '').toLowerCase();
        return Object.keys(packs).find(k => k.toLowerCase() === wanted) || null;
    };

    function register(code, pack) {
        if (!code || !isObj(pack)) throw new Error('FVLocales.register(code, pack): a language code and a pack object are needed');
        const key = Object.keys(packs).find(k => k.toLowerCase() === String(code).toLowerCase()) || String(code);
        const old = packs[key] || {};
        packs[key] = Object.assign({}, old, pack, {
            form: Object.assign({}, old.form, pack.form), file: Object.assign({}, old.file, pack.file), phrases: Object.assign({}, old.phrases, pack.phrases),
            units: Object.assign({}, old.units, pack.units), jquery: Object.assign({}, old.jquery, pack.jquery)
        });
        if (key === current && key !== 'en') apply(key);   // a pack that arrives after use(): apply it right away
        return packs[key];
    }

    /** Put `obj` back to its English state (the first call remembers it), then fill in `values`. */
    function reset(name, obj, values) {
        const snap = snapshots[name] || (snapshots[name] = Object.assign({}, obj));
        Object.keys(obj).forEach(k => { if (!(k in snap)) delete obj[k]; });
        Object.assign(obj, snap);
        if (values) Object.keys(values).forEach(k => { obj[k] = values[k]; });
    }

    function apply(code) {
        const pack = packs[code] || {};
        const t = targets();
        if (t.form && t.form.messages) reset('form', t.form.messages, pack.form);
        if (t.file) {
            if (t.file.defaultMessages) reset('file', t.file.defaultMessages, pack.file);
            if (t.file.units) reset('units', t.file.units, pack.units);
            if (t.file.phrases) { Object.keys(t.file.phrases).forEach(k => { delete t.file.phrases[k]; }); Object.assign(t.file.phrases, pack.phrases); }
            try { t.file.locale = code; } catch (e) { /* older FileValidator */ }
        }
        if (t.jq && t.jq.messages) {
            // the form texts serve the jQuery methods of the same name ({min}/{max}/{step} become {0}/{1}); `jquery` adds or overrides
            const snap = snapshots.jq || (snapshots.jq = Object.assign({}, t.jq.messages));
            const derived = {}, format = t.jq.format;
            const toIndexed = text => /\{min\}/.test(text) && /\{max\}/.test(text) ? text.replace(/\{min\}/g, '{0}').replace(/\{max\}/g, '{1}') : text.replace(/\{(min|max|step)\}/g, '{0}');
            const merged = Object.assign({}, pack.form, pack.jquery);
            Object.keys(merged).forEach(k => {
                if (!(k in snap) || typeof merged[k] !== 'string') return;
                const text = pack.jquery && k in pack.jquery ? merged[k] : toIndexed(merged[k]);
                derived[k] = typeof snap[k] === 'function' && format ? format(text) : text;
            });
            reset('jq', t.jq.messages, derived);
        }
    }

    function use(code, options) {
        const key = find(code);
        if (!key) throw new Error('FVLocales: unknown language "' + code + '". Loaded: ' + Object.keys(packs).join(', ') + '. Load its file (dist/locales/' + code + '.js) or register() a pack.');
        apply(key);
        current = key;
        const pack = packs[key];
        if (options && options.document && root.document && root.document.documentElement) {
            root.document.documentElement.setAttribute('lang', key);
            root.document.documentElement.setAttribute('dir', pack.dir || 'ltr');
        }
        return { code: key, name: pack.name || key, dir: pack.dir || 'ltr' };
    }

    /** The visitor's language: the first language of navigator.languages that has a pack (de-AT falls back to de), else `fallback` (default 'en'). */
    function auto(fallback, options) {
        const nav = root.navigator || {};
        const wanted = [].concat(nav.languages || [], nav.language || []);
        for (const l of wanted) {
            const exact = find(l), base = find(String(l).split('-')[0]);
            if (exact || base) return use(exact || base, options);
        }
        return use(fallback || 'en', options);
    }

    /** Apply the current language again, for example after the jQuery layer was installed. */
    function reapply() { if (current !== 'en') apply(current); }

    pullQueued();

    return {
        version: '1.0.0',
        register, use, auto, reapply,
        get current() { return current; },
        get(code) { const k = find(code); return k ? packs[k] : null; },
        list() { pullQueued(); return Object.keys(packs).map(code => ({ code, name: packs[code].name || code, dir: packs[code].dir || 'ltr' })); },
        /** Every text a complete pack needs: use it as a checklist for your own language. */
        keys() {
            const t = targets();
            return { form: Object.keys(snapshots.form || (t.form && t.form.messages) || {}), file: Object.keys(snapshots.file || (t.file && t.file.defaultMessages) || {}), phrases: PHRASE_KEYS.slice() };
        }
    };
});

    };

    var norm = function (id) { return String(id).replace(/^.*[\\/]/, '').replace(/\.js$/, ''); };
    function requireMod(id) {
        var n = norm(id);
        if (n === 'jquery') { if (root.jQuery) return root.jQuery; throw new Error('jQuery is not loaded'); }
        if (!mods[n]) throw new Error('Cannot find module ' + id);
        return run(n);
    }
    function run(n) {
        if (cache[n]) return cache[n].exports;
        var module = cache[n] = { exports: {} };
        mods[n].call(root, module, module.exports, requireMod, undefined);
        return module.exports;
    }

    var FileValidator = run('fileValidator');
    run('fileValidator.widget');                 // adds widget(), resizeImage(), filesFromDrop() ... to FileValidator
    run('fileValidator.upload');                 // adds upload(): progress, cancel, retry, presigned and tus uploads
    var FormValidator = run('formValidator');
    run('formValidator.element');                // <fv-field> (registers itself when the browser has custom elements)
    run('formValidator.password');               // passwordStrength(), pwned(), the pwscore and pwned rules (before the locale registry, so its messages are translated)
    var locales = run('locale');                  // language packs: FVLocales.use('de')
    FormValidator.locales = locales; FileValidator.locales = locales;

    /** Installs the jQuery Validation compatibility layer on the given jQuery ($.fn.validate, $.validator ...). Safe to call twice. */
    function useJQuery($) {
        var m = { exports: {} };
        var req = function (id) { return norm(id) === 'jquery' ? $ : requireMod(id); };
        mods['formValidator.jquery'].call(root, m, m.exports, req, undefined);
        mods['formValidator.additional'].call(root, { exports: {} }, {}, req, undefined);   // country and bank methods of additional-methods.js
        try { locales.reapply(); } catch (e) { /* the current language now also reaches the jQuery messages */ }
        return m.exports;
    }
    FormValidator.bundled = true;
    FormValidator.useJQuery = useJQuery;

    var api = { FormValidator: FormValidator, FileValidator: FileValidator, locales: locales, useJQuery: useJQuery,
        versions: {"fileValidator":"2.11.0","fileValidator.widget":"1.4.0","fileValidator.upload":"1.0.0","formValidator":"2.15.0","formValidator.element":"1.0.0","formValidator.password":"1.0.0","formValidator.jquery":"1.2.0","formValidator.additional":"1.0.0","locale":"1.0.0"} };

    if (typeof define === 'function' && define.amd) define(function () { return api; });
    else if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.FormValidator = FormValidator; root.FileValidator = FileValidator; root.FVLocales = locales; }

    // <script src="validator.min.js" data-fv-auto></script> starts validators from data-fv attributes by itself
    try { if (root.document && root.document.currentScript && root.document.currentScript.hasAttribute('data-fv-auto')) FormValidator.auto(); } catch (e) { /* no document */ }
    if (root.jQuery && root.jQuery.fn) useJQuery(root.jQuery);   // jQuery was loaded first: the jQuery Validation API is ready
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
