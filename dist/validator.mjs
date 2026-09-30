/*! FormValidator 2.6.0 + FileValidator 2.7.1 + upload widget 1.3.0 + jQuery Validation layer 1.2.0 | one-file bundle | see docs/ */
const api = (function (root) {
    'use strict';
    var mods = {}, cache = {};
    mods["fileValidator"] = function (module, exports, require, define) {
/*!
 * FileValidator v2.7.1 — dependency-free file validation for browsers and Node (18+).
 *
 * Changelog
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
        'validate', 'validateTarget', 'validateScope', 'imageLimit', 'fileLimit', 'type', 'options', 'scanSvg', 'message', 'when',
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

        // ---- SVG can carry scripts
        if (ext === '.svg' && cfg.scanSvg !== false && file.size > 0 && file.size <= 5 * 1048576 && typeof file.text === 'function') {
            const txt = await file.text();
            if (/<script[\s>]|\son\w+\s*=|javascript:|<foreignObject/i.test(txt)) {
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

    return {
        version: '2.7.1',
        validateFiles,   // async (FileList | File[] | File | <input>, config)
        validateFile,    // async (File, config)
        addExtension,    // ('.xyz', 'application/x-xyz' | [..]) : teach the built-in registry an extension
        getMimeTypes: (ext, cfg) => mimesForExt(normExt(ext), cfg).slice(),
        addMethod,       // (name, fn(file, param, ctx), message) : your own check, used as { methods: { name: param } }
        setDefaults: obj => Object.assign(globalDefaults, obj),
        defaults: globalDefaults,
        remoteDefaults,
        hashFile,        // async (File, maxMB) -> SHA-256 hex, or null when over maxMB (files above 32 MB are hashed as a stream)
        _sha256Stream: sha256Stream,
        formatDuration,
        errorMessages,
        getMessage,
        summary,
        bind,
        defaultMessages,
        detectSignature, // async (File) -> signature | null | undefined
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
 * FileValidator upload widget v1.3.0 — drag and drop, folders, paste, previews, resizing and a file list on top of FileValidator.
 *
 * Load order:  fileValidator.js (2.5+)  →  fileValidator.widget.js.  No other dependencies.
 *
 *   const zone = FileValidator.widget('#dropzone', { accept: 'image/*', maxFiles: 5, maxFileSizeMB: 5 }, {
 *       list: '#file-list',            // renders the accepted files (name, size, preview, remove button)
 *       messageElement: '#file-errors',// rejected files and why (a live region)
 *       statusElement: '#file-status', // polite live region: "2 files added. 3 selected." (for screen reader users)
 *       preview: true,                 // thumbnails for images
 *       resize: true,                  // shrink big images to the maxImageWidth/Height/maxFileSizeMB limits instead of rejecting them
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
                accepted.push({ id: ++seq, file, path: FV.getPath(file), resized, preview: null });
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

    mods["formValidator"] = function (module, exports, require, define) {
/*!
 * FormValidator v2.6.0 — dependency-free form validation (jQuery / Select2 / Bootstrap are optional).
 *
 * Changelog
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
        custom: 'Invalid value.'
    };

    const DEFAULTS = {
        trim: true,                       // trim values (never trims type=password)
        novalidate: true,                 // set form.noValidate so native bubbles don't fight ours
        focusInvalid: true,               // focus + scroll to the first invalid field on submit
        validateHidden: false,            // also validate fields that are not rendered / type=hidden
        ignore: null,                     // CSS selector of fields to skip
        validateOn: ['change'],           // events that validate a not-yet-invalid field ('blur', 'change', 'input')
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
        classRules: null                  // { className: rules } applied to fields that carry the class
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
    const num = v => (typeof v === 'string' && v.trim() === '') ? NaN : Number(v);
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

    function luhn(v) {
        const s = v.replace(/[\s-]/g, '');
        if (!/^\d{12,19}$/.test(s)) return false;
        let sum = 0, alt = false;
        for (let i = s.length - 1; i >= 0; i--) { let n = +s[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
        return sum % 10 === 0;
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
        validators[name] = { fn, runOnEmpty: !!(opts && opts.runOnEmpty), remote: !!(opts && opts.remote) };
    }

    const R = (name, fn, o) => registerRule(name, fn, o);

    /** How `remote` rules talk to the server unless a rule says otherwise (like jQuery Validation: GET).
     *  Change globally: FormValidator.remoteDefaults.method = 'POST'  (and .encoding = 'form' for a classic form body). */
    const REMOTE_DEFAULTS = { method: 'GET', encoding: 'json' };

    R('required', (v, r, env) => !env.empty, { runOnEmpty: true });
    R('email', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
    R('url', (v, rule) => {
        if (/\s/.test(v)) return false;
        try {
            const hasProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(v);
            if (!hasProto && rule.requireProtocol) return false;
            const u = new URL(hasProto ? v : 'http://' + v);
            if (!(rule.protocols || ['http:', 'https:']).includes(u.protocol)) return false;
            return rule.allowLocal ? true : (u.hostname.includes('.') || u.hostname === 'localhost') && !/^\.|\.$/.test(u.hostname);
        } catch (e) { return false; }
    });
    R('number', v => /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(v));
    R('digits', v => /^\d+$/.test(v));
    R('alpha', v => /^\p{L}+$/u.test(v));
    R('alphanumeric', v => /^[\p{L}\p{N}]+$/u.test(v));
    R('phone', v => /^\+?[\d\s\-().]{7,25}$/.test(v) && (v.match(/\d/g) || []).length >= 7 && (v.match(/\d/g) || []).length <= 15);
    R('date', v => !isNaN(Date.parse(v)));
    R('minDate', (v, r) => { const a = toDate(v), b = toDate(r.min); return !isNaN(a) && !isNaN(b) && a >= b; });
    R('maxDate', (v, r) => { const a = toDate(v), b = toDate(r.max); return !isNaN(a) && !isNaN(b) && a <= b; });
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
        if (c.requireUppercase && !/[A-Z]/.test(v)) return false;
        if (c.requireLowercase && !/[a-z]/.test(v)) return false;
        if (c.requireDigit && !/\d/.test(v)) return false;
        if (c.requireSpecialChar && !/[^A-Za-z0-9\s]/.test(v)) return false;
        if (c.noWhitespace && /\s/.test(v)) return false;
        return true;
    });

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
        pattern: p => ({ pattern: p }), oneOf: p => ({ values: [].concat(p) }),
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

    /** Options of the wrong type fall back to the defaults: a bad config must not crash the page when an error is shown. */
    function sanitizeConfig(cfg) {
        if (typeof cfg.errorElement !== 'string' || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(cfg.errorElement)) cfg.errorElement = DEFAULTS.errorElement;
        ['errorClass', 'invalidClass', 'pendingClass'].forEach(k => { if (typeof cfg[k] !== 'string') cfg[k] = k === 'errorClass' ? DEFAULTS.errorClass : ''; });
        cfg.validateOn = Array.isArray(cfg.validateOn) ? cfg.validateOn.filter(e => typeof e === 'string') : DEFAULTS.validateOn.slice();
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
        cfg.passwordStrength = Object.assign({}, DEFAULTS.passwordStrength, isObj(userConfig.passwordStrength) ? userConfig.passwordStrength : null);
        const rawMessages = Object.assign({}, isObj(userConfig.messages) ? userConfig.messages : null, isObj(opts.messages) ? opts.messages : null);
        cfg.messages = {};                 // by rule type
        const fieldMessages = {};          // by field name: { name: 'text' } or { name: { required: 'text' } }
        Object.keys(rawMessages).forEach(k => {
            const v = rawMessages[k], isType = k in DEFAULT_MESSAGES || !!validators[k];
            if ((v && typeof v === 'object') || !isType) fieldMessages[k] = v; else cfg.messages[k] = v;
        });
        const context = Object.assign({}, opts.context, { form });

        const inst = {
            form, config: cfg, context,
            rules: {},
            _errors: new Map(),        // unit.key -> { el, message, unit }
            _tokens: new Map(),
            _aborters: new Map(),
            _remoteCache: new Map(),
            _listeners: [],
            _timers: new Map(),
            _busy: false, _bypass: false, _submitted: false,
            _pending: new Map(), fieldMessages
        };
        Object.keys(opts.rules || {}).forEach(n => { inst.rules[n] = normalizeRules(opts.rules[n]); });

        // ---- units: one per radio/checkbox group, one per individual element otherwise
        function unitsFor(name) {
            const els = Array.from(form.querySelectorAll(`[name="${esc(name)}"]`));
            const grouped = els.filter(e => e.type === 'radio' || e.type === 'checkbox');
            const units = els.filter(e => !(e.type === 'radio' || e.type === 'checkbox')).map(e => ({ key: e, fields: [e] }));
            if (grouped.length) units.unshift({ key: grouped[0], fields: grouped });
            return units;
        }
        function names() {
            const set = new Set(Object.keys(inst.rules));
            if (cfg.autoRules || isFn(cfg.fieldRules) || hasClassRules()) {
                Array.from(form.elements).forEach(e => {
                    if (e.name && e.tagName !== 'FIELDSET' && !['button', 'submit', 'reset', 'image'].includes(e.type)) set.add(e.name);
                });
            }
            return Array.from(set);
        }
        const allUnits = () => [].concat(...names().map(unitsFor));

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

        function rulesFor(unit) {
            const explicit = inst.rules[unit.fields[0].name] || [];
            if (!cfg.autoRules && !isFn(cfg.fieldRules) && !hasClassRules()) return explicit;
            const merged = new Map();  // later sources win per rule type: class < attributes / data-rule < fieldRules
            classRulesFor(unit.fields[0]).concat(cfg.autoRules ? attributeRules(unit.fields[0]) : [],
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

        function isActive(unit) {
            if (unit.fields.every(f => f.disabled)) return false;
            if (cfg.ignore) { try { if (unit.fields[0].matches(cfg.ignore)) return false; } catch (e) { /* invalid selector */ } }
            if (cfg.validateHidden) return true;
            return unit.fields.some(f => f.type !== 'hidden' && f.getClientRects().length > 0);
        }

        // ---- messages
        function resolveMessage(rule, env, dynamic) {
            if (isFn(cfg.resolveMessage)) { const custom = guard(cfg.resolveMessage, '', rule, env, dynamic); if (custom) return custom; }
            let m = rule.message;
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
            if (rec) { rec.el.remove(); inst._errors.delete(unit.key); }
            unit.fields.forEach(f => {
                if (isFn(cfg.unhighlight)) guard(cfg.unhighlight, undefined, f, unit);
                if (cfg.invalidClass) cfg.invalidClass.split(/\s+/).forEach(c => c && f.classList.remove(c));
                f.removeAttribute('aria-invalid');
                if (rec) {
                    const ids = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(i => i && i !== rec.el.id);
                    ids.length ? f.setAttribute('aria-describedby', ids.join(' ')) : f.removeAttribute('aria-describedby');
                }
            });
        }

        function showError(unit, message) {
            removeError(unit);
            const err = root.document.createElement(cfg.errorElement);
            err.className = cfg.errorClass;
            err.id = 'fv-error-' + (++uid);
            err.setAttribute('data-error-for', unit.fields[0].name);
            err.setAttribute('dir', 'auto');
            // role="alert" is not allowed on <label> (ARIA); the field's aria-describedby makes screen readers read the message on focus anyway
            if (err.tagName === 'LABEL') err.setAttribute('aria-live', 'polite'); else err.setAttribute('role', 'alert');
            if (err.tagName === 'LABEL' && unit.fields[0].id) err.setAttribute('for', unit.fields[0].id);
            err.textContent = message;
            place(err, unit);
            inst._errors.set(unit.key, { el: err, message, unit });
            unit.fields.forEach(f => {
                if (isFn(cfg.highlight)) guard(cfg.highlight, undefined, f, unit);
                if (cfg.invalidClass) cfg.invalidClass.split(/\s+/).forEach(c => c && f.classList.add(c));
                f.setAttribute('aria-invalid', 'true');
                f.setAttribute('aria-describedby', ((f.getAttribute('aria-describedby') || '') + ' ' + err.id).trim());
            });
        }

        // ---- validation
        const valueFor = (rule, env) => { if (!isFn(rule.normalizer)) return env.value; const v = guard(function () { return rule.normalizer.call(env.field, env.value, env.field); }, env.value); return typeof v === 'string' ? v : String(v); };

        function setPending(unit, on) {
            if (!cfg.pendingClass) return;
            const n = (inst._pending.get(unit.key) || 0) + (on ? 1 : -1);
            inst._pending.set(unit.key, Math.max(0, n));
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

            if (env.badInput) { showError(unit, cfg.messages.badInput || DEFAULT_MESSAGES.badInput); return false; }

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
                    if (!r.valid) { showError(unit, resolveMessage(rule, env, r.message)); return false; }
                }
                removeError(unit);
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
            if (env.badInput) { showError(unit, cfg.messages.badInput || DEFAULT_MESSAGES.badInput); return false; }

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
                        if (!lr.valid) showError(unit, resolveMessage(rule, env, lr.message));
                    }).catch(() => { /* a failed async check stays "pending" in sync mode */ });
                    continue;
                }
                const r = normalizeResult(res);
                if (!r.valid) { showError(unit, resolveMessage(rule, env, r.message)); return false; }
            }
            removeError(unit);
            if (isFn(cfg.onFieldValid)) guard(cfg.onFieldValid, undefined, unit.fields[0], unit);
            return true;
        }

        function finishAll(units, results, o) {
            const invalid = units.filter((u, i) => !results[i] && inst._errors.has(u.key));
            const ok = results.every(Boolean);
            if (!ok) {
                invalid.sort((a, b) => (a.fields[0].compareDocumentPosition(b.fields[0]) & 4) ? -1 : 1);
                const list = invalid.map(u => ({ name: u.fields[0].name, field: u.fields[0], message: inst._errors.get(u.key).message }));
                if (cfg.focusInvalid && invalid[0] && (!o || o.focus !== false)) { // after the list: focus handlers may clear errors
                    const f = invalid[0].fields[0];
                    try { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
                    catch (e) { /* not focusable */ }
                }
                if (isFn(cfg.onError)) guard(cfg.onError, undefined, list);
                emit('fv:invalid', { errors: list });
            } else {
                if (isFn(cfg.onSuccess)) guard(cfg.onSuccess, undefined);
                emit('fv:valid', {});
            }
            return ok;
        }

        async function validateAll(o) {
            if (o && o.submit) inst._submitted = true;
            const units = allUnits();
            const results = await Promise.all(units.map(u => validateUnit(u, o)));
            return finishAll(units, results, o);
        }

        function validateAllSync(o) {
            if (o && o.submit) inst._submitted = true;
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
                        || (r.dependsOn && safeMatches(el, r.dependsOn));
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
                if (!hasErr && !afterSubmit && (!cfg.validateOn.includes(type) || type === 'input')) return;
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
                inst._submitted = true;
                if (inst._busy) return;
                inst._busy = true;
                const submitter = e.submitter;
                validateAll({ submit: true }).then(ok => {
                    inst._busy = false;
                    if (!ok) return;
                    if (isFn(cfg.submitHandler)) return cfg.submitHandler(form, e);
                    inst._bypass = true;
                    try {
                        if (isFn(form.requestSubmit)) {
                            try { form.requestSubmit(submitter || undefined); } catch (err) { form.requestSubmit(); }
                        } else form.submit();
                    } finally { inst._bypass = false; }
                }).catch(err => { inst._busy = false; if (root.console) console.error(err); });
            }, true);

            listen(form, 'reset', () => setTimeout(() => inst.resetForm(), 0));
        }

        Object.assign(inst, {
            validate: o => validateAll(o),
            validateSync: o => validateAllSync(o),
            validateElementSync: (el, o) => { const u = unitOf(el); return u ? validateUnitSync(u, o) : true; },
            validateElement: (el, o) => { const u = unitOf(el); return u ? validateUnit(u, o) : Promise.resolve(true); },
            unitOf,
            units: unitsFor,
            allUnits,
            readValue: unit => readEnv(unit),
            getErrors: () => Array.from(inst._errors.values()).map(r => ({ name: r.unit.fields[0].name, field: r.unit.fields[0], fields: r.unit.fields, message: r.message, el: r.el })),
            setError: (name, message) => { const u = unitsFor(name)[0]; if (u) showError(u, message); return !!u; },
            clearError: name => unitsFor(name).forEach(removeError),
            resetForm: () => { inst.clearErrors(); inst._submitted = false; inst._tokens.clear(); },
            isSubmitted: () => inst._submitted,
            validateField: name => Promise.all(unitsFor(name).map(u => validateUnit(u))).then(r => r.every(Boolean)),
            clearErrors: () => { allUnits().forEach(removeError); Array.from(inst._errors.values()).forEach(r => removeError(r.unit)); },
            setRules: (name, rules) => { inst.rules[name] = normalizeRules(rules); },
            addRules: (name, rules) => { inst.rules[name] = (inst.rules[name] || []).concat(normalizeRules(rules)); },
            removeRules: name => { delete inst.rules[name]; unitsFor(name).forEach(removeError); },
            destroy: () => {
                inst._listeners.forEach(off => off());
                inst._listeners.length = 0;
                inst._timers.forEach(clearTimeout);
                if (inst._deferred) inst._deferred.clear();
                inst._aborters.forEach(a => a.abort());
                inst.clearErrors();
                if (cfg.novalidate) form.noValidate = !!inst._hadNoValidate;
                delete form._fvInstance; delete form._manualValidate;
            },
            attach
        });
        return inst;
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

    return {
        init,
        validate,
        registerRule,
        remoteDefaults: REMOTE_DEFAULTS,
        addMethod,
        addClassRules,
        format,
        setDefaults: obj => Object.assign(DEFAULTS, obj),
        getRule: name => validators[name] || null,
        messages: DEFAULT_MESSAGES,     // mutable: FormValidator.messages.required = 'Pflichtfeld'
        defaults: DEFAULTS,             // mutable global defaults
        getInstance: t => { const f = resolveForm(t); return f ? f._fvInstance || null : null; },
        version: '2.6.0'
    };
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
            if (s.focusCleanup) {
                const onFocusIn = function (e) { // native listener: works in every browser and jQuery version
                    const u = self.fv.unitOf(e.target);
                    if (u && self.fv._errors.has(u.key)) self.fv.clearError(u.fields[0].name);
                };
                form.addEventListener('focusin', onFocusIn);
                this.fv._listeners.push(() => form.removeEventListener('focusin', onFocusIn));
            }
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
                errorClass: s.errorClass,
                pendingClass: s.pendingClass,   // jQuery Validation adds "pending" to a field while a remote check runs
                invalidClass: '',
                errorPlacement,
                interceptSubmit: s.onsubmit !== false,
                skipSubmitter: '.cancel',
                fieldRules: field => self._coreRules(field),
                resolveMessage: (rule, env, dynamic) => {
                    // a message the developer wrote for this field wins over FileValidator's detailed one; server (remote) messages always win
                    if (dynamic && rule.method === 'fileValidator' && self._hasCustomMessage(env.field, rule.method)) dynamic = null;
                    return dynamic || self.defaultMessage(env.field, { method: rule.method, parameters: rule.param });
                },
                highlight: (field, unit) => { if (field === unit.fields[0]) { self.settings.highlight.call(self, field, s.errorClass, s.validClass); self._syncContainers(); self._afterErrorChange(); } },
                unhighlight: (field, unit) => { if (field === unit.fields[0]) { self._removeSuccess(field); self.settings.unhighlight.call(self, field, s.errorClass, s.validClass); self._syncContainers(); self._afterErrorChange(); } },
                onFieldValid: field => self._success(field),
                onError: () => { $(self.currentForm).triggerHandler('invalid-form', [self]); },
                submitHandler: s.debug || isFn(s.submitHandler) ? function (form, event) {
                    if (s.debug) { if (root.console) console.log('Submit handler called. The form is not submitted because "debug" is on.'); return false; }
                    let hidden = null;
                    const sub = event && event.submitter;
                    if (sub && sub.name) hidden = $('<input type="hidden"/>').attr('name', sub.name).val($(sub).val()).appendTo(form);
                    const r = s.submitHandler.call(self, form, event);
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
        'JavaScript in a PDF', 'a launch action in a PDF', 'an embedded program in a PDF', 'scripts',
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
    var FormValidator = run('formValidator');
    var locales = run('locale');                  // language packs: FVLocales.use('de')
    FormValidator.locales = locales; FileValidator.locales = locales;

    /** Installs the jQuery Validation compatibility layer on the given jQuery ($.fn.validate, $.validator ...). Safe to call twice. */
    function useJQuery($) {
        var m = { exports: {} };
        mods['formValidator.jquery'].call(root, m, m.exports, function (id) { return norm(id) === 'jquery' ? $ : requireMod(id); }, undefined);
        try { locales.reapply(); } catch (e) { /* the current language now also reaches the jQuery messages */ }
        return m.exports;
    }
    FormValidator.bundled = true;
    FormValidator.useJQuery = useJQuery;

    var api = { FormValidator: FormValidator, FileValidator: FileValidator, locales: locales, useJQuery: useJQuery,
        versions: {"fileValidator":"2.7.1","fileValidator.widget":"1.3.0","formValidator":"2.6.0","formValidator.jquery":"1.2.0","locale":"1.0.0"} };

    if (root.jQuery && root.jQuery.fn) useJQuery(root.jQuery);   // jQuery was loaded first: the jQuery Validation API is ready
    return api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
export const FormValidator = api.FormValidator;
export const FileValidator = api.FileValidator;
export const useJQuery = api.useJQuery;
export const locales = api.locales;
export const versions = api.versions;
export default api;
