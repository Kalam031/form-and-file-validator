/*!
 * FileValidator v2.8.0 — dependency-free file validation for browsers and Node (18+).
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
        version: '2.8.0',
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
