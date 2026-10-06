// Types for FileValidator (fileValidator.js) and the upload widget (fileValidator.widget.js).

export type FileCategory = 'image' | 'video' | 'audio' | 'file';

/** What a custom check, `scan` function or `customAll` may return. */
export type CheckResult = boolean | string | undefined | null | { valid: boolean; message?: string; code?: string; threat?: string };

export interface CheckContext {
    config: FileValidatorConfig;
    ext: string;
    category: FileCategory;
    files?: File[];
    index?: number;
}

export interface RemoteOptions {
    url: string;
    /** 'GET' (default) puts the file's metadata in the query string, 'POST' sends JSON. */
    method?: 'GET' | 'POST' | 'get' | 'post';
    /** 'meta' (default), 'hash' (adds the SHA-256) or 'file' (multipart upload, always POST). */
    send?: 'meta' | 'hash' | 'file';
    field?: string;
    data?: Record<string, unknown> | ((file: File, meta: Record<string, unknown>) => Record<string, unknown>);
    headers?: Record<string, string>;
    timeout?: number;
    cache?: boolean;
    failOpen?: boolean;
    credentials?: RequestCredentials;
    maxHashMB?: number;
    parse?: (json: unknown, response: Response) => unknown;
}

export interface DocumentOptions {
    checkStructure?: boolean;
    blockMacros?: boolean;
    blockEmbeddedPrograms?: boolean;
    blockUnsafePaths?: boolean;
    blockPdfJavaScript?: boolean;
    blockPdfLaunch?: boolean;
    maxScanMB?: number;
    maxUncompressedMB?: number;
    maxCompressionRatio?: number;
    maxEntries?: number;
}

export type MessageTemplate = string | ((params: Record<string, any>) => string);

export interface FileValidatorConfig {
    // type and name
    allowedExtensions?: string | string[];
    allowedMimeTypes?: string | string[];
    /** Like an <input accept>: '.jpg,image/*,application/pdf'. */
    accept?: string | string[];
    allowUnknownMime?: boolean;
    dangerousExtensions?: string | string[];
    dangerousMimeTypes?: string[];
    mimeByExtension?: Record<string, string | string[]>;
    allowExecutables?: boolean;
    maxFilenameLength?: number | string;
    filenameRegex?: RegExp;
    // size and count
    maxFileSizeMB?: number | string;
    maxFileSize?: number | string;
    minFileSizeKB?: number | string;
    minFileSize?: number | string;
    maxTotalSizeMB?: number | string;
    maxFiles?: number | string;
    minFiles?: number | string;
    allowEmpty?: boolean;
    allowNoFiles?: boolean;
    duplicateNames?: boolean;
    duplicateContent?: boolean;
    duplicateContentMaxMB?: number | string;
    // images
    maxImageWidth?: number | string;
    maxImageHeight?: number | string;
    minImageWidth?: number | string;
    minImageHeight?: number | string;
    aspectRatio?: number | string | { min?: number; max?: number };
    aspectRatioTolerance?: number | string;
    imageDecode?: boolean;
    imageTimeoutMs?: number;
    readImageSize?: (file: File) => Promise<{ width: number; height: number } | null> | { width: number; height: number } | null;
    scanSvg?: boolean;
    /** Refuse a script, program or archive hidden in a picture (head and tail). `false` turns it off, `'all'` also covers audio, video, fonts and PDFs. Default true. */
    polyglot?: boolean | 'all';
    /** KB searched at the start and at the end of a file for hidden content. Default 256. */
    polyglotScanKB?: number;
    // audio and video
    maxDurationSec?: number | string;
    minDurationSec?: number | string;
    readMediaInfo?: (file: File) => Promise<{ duration: number; width?: number; height?: number } | null>;
    requireMediaInfo?: boolean;
    // folders
    maxPathDepth?: number | string;
    maxPathLength?: number | string;
    ignoreFiles?: boolean | Array<string | RegExp>;
    // inside documents
    documents?: boolean | DocumentOptions;
    // your own checks, scanning and the server
    methods?: Record<string, unknown>;
    custom?: CustomCheck | CustomCheck[] | Record<string, CustomCheck>;
    customAll?: (files: File[], ctx: { config: FileValidatorConfig }) => CheckResult | Promise<CheckResult>;
    scan?: (file: File, ctx: CheckContext) => CheckResult | Promise<CheckResult>;
    scanTimeout?: number;
    scanFailOpen?: boolean;
    remote?: string | RemoteOptions;
    // per kind of file, messages, misc
    categories?: Partial<Record<FileCategory, FileValidatorConfig>>;
    messages?: Partial<Record<ErrorCode, MessageTemplate>> & Record<string, MessageTemplate>;
    concurrency?: number;
    /** Switches for individual checks: `{ signature: false, dangerousExt: false, ... }`. */
    validate?: Record<string, boolean>;
    // legacy (still supported)
    validateTarget?: { images?: boolean; files?: boolean; videos?: boolean; audios?: boolean; allowMixed?: boolean };
    validateScope?: 'file' | 'files' | 'image' | 'images' | 'mixed';
    imageLimit?: number;
    fileLimit?: number;
}

export type CustomCheck = (file: File, ctx: CheckContext) => CheckResult | Promise<CheckResult>;
export type MethodFunction = (this: { format(source: string, ...params: unknown[]): string }, file: File, param: any, ctx: CheckContext) => CheckResult | Promise<CheckResult>;

export type ErrorCode =
    | 'INVALID_EXTENSION' | 'INVALID_MIME' | 'MIME_MISMATCH' | 'UNKNOWN_MIME' | 'SIZE_TOO_LARGE' | 'SIZE_TOO_SMALL' | 'TOTAL_SIZE_EXCEEDED' | 'EMPTY_FILE'
    | 'INVALID_FILENAME' | 'FILENAME_TOO_LONG' | 'INVALID_PATH' | 'PATH_TOO_DEEP' | 'PATH_TOO_LONG'
    | 'WIDTH_EXCEEDED' | 'HEIGHT_EXCEEDED' | 'WIDTH_TOO_SMALL' | 'HEIGHT_TOO_SMALL' | 'INVALID_ASPECT_RATIO' | 'INVALID_IMAGE'
    | 'TOO_MANY_FILES' | 'TOO_FEW_FILES' | 'DUPLICATE_FILENAMES' | 'DUPLICATE_FILES' | 'NO_FILES' | 'SINGLE_FILE_LIMIT_EXCEEDED'
    | 'INVALID_IMAGE_TYPE' | 'INVALID_FILE_TYPE'
    | 'DANGEROUS_FILE_TYPE' | 'DANGEROUS_CONTENT' | 'HIDDEN_EXTENSION' | 'SIGNATURE_MISMATCH'
    | 'CORRUPT_FILE' | 'ARCHIVE_BOMB' | 'MALWARE_DETECTED' | 'SCAN_ERROR'
    | 'DURATION_TOO_LONG' | 'DURATION_TOO_SHORT' | 'INVALID_MEDIA'
    | 'CUSTOM' | 'REMOTE_REJECTED' | 'REMOTE_ERROR';

export interface FileProblem {
    /** One of the codes above, or a code your own check returned. */
    code: ErrorCode | (string & {});
    /** null for problems with the whole selection. */
    fileName: string | null;
    file: File | null;
    params: Record<string, any>;
    /** Friendly text, ready to show. */
    message: string;
}

export interface FileResult {
    file: File;
    name: string;
    isValid: boolean;
    errors: string[];
    details: FileProblem[];
}

export interface ValidationResult {
    isValid: boolean;
    /** Unique codes, easy to test for. */
    errors: string[];
    details: FileProblem[];
    files: FileResult[];
    /** Files skipped because of `ignoreFiles`. */
    ignored: File[];
}

export interface SingleResult {
    isValid: boolean;
    errors: string[];
    details: FileProblem[];
}

export type FilesInput = FileList | File[] | File | HTMLInputElement | null | undefined;

export interface BindOptions {
    onResult?: (result: ValidationResult, input: HTMLInputElement) => void;
    messageElement?: string | HTMLElement;
    clearOnInvalid?: boolean;
}

export interface GuardOptions {
    /** Gets the first message (or an empty string when the files are fine). */
    messageElement?: string | HTMLElement | null;
    /** Default: the required attribute of the input. */
    required?: boolean;
    /** AJAX: called only with valid files, instead of a native submit. May return a Promise; { errors: 'message' } or { message } is shown. */
    onSubmit?: (files: File[], formData: FormData, event: Event) => unknown;
    onResult?: (result: ValidationResult, input: HTMLInputElement) => void;
}

export interface GuardHandle {
    /** true / false for the current selection (shows the message). */
    validate(): Promise<boolean>;
    check(): Promise<ValidationResult>;
    unbind(): void;
}

export interface UploadProgress { loaded: number; total: number; percent: number }
export interface UploadTarget { url: string; method?: string; headers?: Record<string, string>; fields?: Record<string, string>; fileField?: string }
export interface UploadResult { status: number; headers: Record<string, string>; body: any; url: string; response?: { status: number; headers: Record<string, string>; text: string }; offset?: number; size?: number }
export declare class UploadError extends Error {
    /** 'ABORTED' | 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'INVALID' | 'PROTOCOL' */
    code: string;
    status?: number;
    response?: { status: number; headers: Record<string, string>; text: string };
    errors?: string[];
    readonly aborted: boolean;
}
export interface UploadOptions {
    url?: string;
    method?: string;
    fieldName?: string;
    fields?: Record<string, string>;
    headers?: Record<string, string> | ((file: File | Blob) => Record<string, string>);
    withCredentials?: boolean;
    timeout?: number;
    responseType?: 'json' | 'text';
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal;
    retries?: number;
    retryDelayMs?: number;
    retryOn?: (error: UploadError, attempt: number) => boolean;
    onRetry?: (info: { attempt: number; delayMs: number; error: UploadError }) => void;
    /** Direct-to-storage: ask your server to sign a URL (PUT) or a POST policy (fields) for this file. */
    presign?: (file: File | Blob) => Promise<UploadTarget>;
    /** Send the file itself as the body even for POST. */
    raw?: boolean;
    /** Resumable upload to a tus 1.0.0 endpoint. */
    tus?: { endpoint: string; chunkSize?: number; headers?: Record<string, string> | ((file: File | Blob) => Record<string, string>); metadata?: Record<string, string>; resume?: boolean; storage?: 'local' | false; withCredentials?: boolean; timeout?: number; onChunkComplete?: (bytes: number, offset: number, total: number) => void };
    /** A FileValidator config: the file is checked first and an invalid one is not sent. */
    validate?: FileValidatorConfig;
    fetch?: (url: string, init?: any) => Promise<any>;
}
export type QueueStatus = 'queued' | 'uploading' | 'offline' | 'retrying' | 'done' | 'failed' | 'aborted' | 'changed';
export interface UploadQueueOptions extends Omit<UploadOptions, 'onProgress'> {
    /** Uploads in flight at once. Default 2. */
    concurrency?: number;
    /** Default navigator.onLine. */
    isOnline?: () => boolean;
    /** Object that fires 'online' events. Default window / self. */
    onlineEvent?: EventTarget;
    /** false: skip the "did the file change or vanish" check. */
    checkFile?: boolean;
    onChange?: (item: QueueItem, items: QueueItem[]) => void;
    onProgress?: (progress: UploadProgress, item: QueueItem) => void;
}
export interface QueueItem {
    readonly id: number;
    file: File | Blob;
    status: QueueStatus;
    progress: UploadProgress | null;
    error: UploadError | null;
    result: UploadResult | null;
    /** Resolves with the result, rejects with an UploadError (codes include FILE_CHANGED and FILE_UNREADABLE). */
    promise: Promise<UploadResult>;
    abort(): void;
    /** Queue a failed / aborted / changed item again. false when it is not in one of those states. */
    retry(): boolean;
    /** The person chose the file again: same item, new content. */
    replace(file: File | Blob): QueueItem;
}
export interface UploadQueue {
    add(file: File | Blob, overrides?: Partial<UploadQueueOptions>): QueueItem;
    readonly items: QueueItem[];
    readonly online: boolean;
    pause(): void;
    resume(): void;
    retryFailed(): number;
    abortAll(): void;
    /** Removes finished items (done, failed, aborted, changed). */
    clear(): void;
    whenIdle(): Promise<QueueItem[]>;
    destroy(): void;
}
export interface UploadTask extends Promise<UploadResult> {
    abort(): void;
    /** tus only. */
    pause(): void;
    resume(): void;
}

export interface FileValidatorStatic {
    readonly version: string;
    validateFiles(files: FilesInput, config?: FileValidatorConfig): Promise<ValidationResult>;
    validateFile(file: File, config?: FileValidatorConfig): Promise<SingleResult>;
    /** Lines like "photo.png: This file is 6 MB but the maximum is 5 MB." */
    summary(result: ValidationResult, options?: { fileNames?: boolean }): string[];
    /** true / false: are these files fine? (validateFiles() gives the detail.) */
    isValid(files: FilesInput | string, config?: FileValidatorConfig): Promise<boolean>;
    /**
     * Check a file input when its form is submitted, direct or AJAX. Without onSubmit a valid form posts normally and an invalid one is blocked;
     * with onSubmit it is called (only with valid files) instead of a native submit and may return { errors: 'message' } or { message } to show a server message.
     */
    guard(input: string | HTMLInputElement, config?: FileValidatorConfig, options?: GuardOptions): GuardHandle;
    /** Connect a file input to validation. Returns a function that removes it again. */
    bind(input: string | HTMLInputElement, config?: FileValidatorConfig, options?: BindOptions): () => void;
    getMessage(code: string, params?: Record<string, unknown>, config?: FileValidatorConfig): string;
    readonly errorMessages: Record<string, string>;
    readonly defaultMessages: Record<string, string>;
    /** Your own check: `FileValidator.addMethod('maxLines', async (file, param) => ..., 'At most {0} lines')`, then `{ methods: { maxLines: 100 } }`. */
    addMethod(name: string, fn: MethodFunction, message?: string | ((param: any, file: File) => string)): void;
    /** Teach the built-in registry an extension. */
    addExtension(ext: string, mimeTypes: string | string[]): void;
    getMimeTypes(ext: string, config?: FileValidatorConfig): string[];
    setDefaults(options: FileValidatorConfig): void;
    readonly defaults: FileValidatorConfig;
    readonly remoteDefaults: { method: 'GET' | 'POST' };
    hashFile(file: File, maxMB?: number): Promise<string | null>;
    /** What a JPEG, PNG or WebP gives away (EXIF, GPS position, XMP, IPTC, comments), or null for any other file. */
    readMetadata(file: File, options?: MetadataOptions): Promise<ImageMetadata | null>;
    /**
     * Removes EXIF, GPS, XMP, IPTC and comments from a JPEG, PNG or WebP without re-encoding it. Returns a new File (with `fvStripped`), or the same
     * file when there is nothing to remove or it is not a readable JPEG, PNG or WebP. The orientation of phone photos is kept.
     */
    stripMetadata(file: File, options?: MetadataOptions): Promise<File>;
    formatBytes(bytes: number): string;
    formatDuration(seconds: number): string;
    getCategory(file: { name: string; type?: string }, sniffedMime?: string): FileCategory;
    getPath(file: File): string;
    isIgnored(file: File, ignoreFiles: boolean | Array<string | RegExp>): boolean;
    /** What the content is, whatever the name or file.type says: { type, mime, extensions, executable }, null when no known signature matches, undefined when the file cannot be read. */
    /** Sends a file: progress, cancel, retry, presigned and tus uploads (upload add-on: bundle or fileValidator.upload.js). Returns a Promise with abort() (and pause() / resume() for tus). */
    upload(file: File | Blob, options: UploadOptions): UploadTask;
    readonly UploadError: typeof UploadError;
    /** Upload many files with a limit; waits while offline (not counted as a failure), retries, notices a file that changed or vanished (upload add-on). */
    uploadQueue(options: UploadQueueOptions): UploadQueue;
    /** Image add-on (bundle or fileValidator.image.js): crop, rotate, flip, shrink and re-encode. SVG and GIF come back unchanged. Rejects with code IMAGE_DECODE_FAILED. */
    transformImage(file: File, options?: ImageTransformOptions): Promise<File>;
    /** Re-encode as JPEG (or options.type), e.g. an iPhone HEIC photo. */
    convertImage(file: File, options?: ConvertImageOptions): Promise<File>;
    /** convertImage with onlyHeic: true. */
    convertHeic(file: File, options?: ConvertImageOptions): Promise<File>;
    /** A keyboard-friendly crop dialog. Resolves to the new File, or null when cancelled. */
    cropper(file: File, options?: CropperOptions): Promise<File | null>;
    /** Opens the phone camera (a file chooser on a computer). Call from a click. Resolves to a File, null when nothing was taken (an array with `multiple`). */
    capture(options?: CaptureOptions): Promise<File | null>;
    isHeic(file: { name?: string; type?: string }): boolean;
    detect(file: File): Promise<{ type: string; mime: string | null; extensions: string[]; executable: boolean } | null | undefined>;
    /** A file name that is safe to store and to show: no path, bidi / control characters or reserved names, bounded length, only the last dot. */
    safeName(name: unknown, options?: { replacement?: string; maxLength?: number; lowercase?: boolean; ascii?: boolean; dots?: 'replace' | 'keep'; fallback?: string; extensionMaxLength?: number }): string;
    detectSignature(file: File): Promise<{ name: string; mime?: string; exts: string[]; executable?: boolean } | null | undefined>;
    readonly constants: {
        DEFAULT_DANGEROUS_EXTENSIONS: string[];
        DEFAULT_DANGEROUS_MIME_TYPES: string[];
        EXTENSIONS: () => Record<string, string[]>;
        SIGNATURES: Array<{ name: string; mime?: string; exts: string[]; executable: boolean }>;
    };
}

// ------------------------------------------------------------------ upload widget (fileValidator.widget.js)

export interface PreviewOptions {
    maxWidth?: number;
    maxHeight?: number;
    type?: string;
    quality?: number;
    /** false: use the file itself instead of a thumbnail. */
    thumbnail?: boolean;
    readImage?: (file: File) => Promise<ImageInfo | null>;
    render?: (source: unknown, width: number, height: number, type: string, quality: number) => Promise<Blob | null>;
}

export interface ImageInfo { width: number; height: number; source: unknown; close?: () => void }

export interface Preview {
    url: string | null;
    kind: 'image' | 'video' | 'audio' | 'file';
    width?: number;
    height?: number;
    /** File type badge text such as "PDF" for kind 'file'. */
    label?: string;
    revoke(): void;
}

export interface ResizeOptions {
    maxWidth?: number;
    maxHeight?: number;
    maxSizeMB?: number;
    quality?: number;
    type?: string;
    readImage?: (file: File) => Promise<ImageInfo | null>;
    render?: (source: unknown, width: number, height: number, type: string, quality: number) => Promise<Blob | null>;
}

export interface ImageTransformOptions {
    /** Source pixels. Out-of-range values are clamped. */
    crop?: { x?: number; y?: number; width?: number; height?: number };
    /** Multiple of 90, clockwise. */
    rotate?: number;
    flipH?: boolean;
    flipV?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    /** Output MIME type. Default: PNG / WebP stay, anything else becomes image/jpeg. */
    type?: string;
    /** 0..1, default 0.85. */
    quality?: number;
    /** Plug in a HEIC library: return a Blob, ImageBitmap or { source, width, height, close? }. */
    decoder?: (file: File) => Promise<Blob | ImageBitmap | { source: CanvasImageSource; width: number; height: number; close?: () => void }>;
}
export interface ConvertImageOptions extends ImageTransformOptions {
    /** true: files that are not HEIC / HEIF are returned untouched. */
    onlyHeic?: boolean;
    /** 'keep' returns the original when it cannot be decoded instead of throwing. */
    onFail?: 'throw' | 'keep';
}
export interface CropperOptions extends ImageTransformOptions {
    /** A number (1, 16 / 9) or 'free' (default). */
    aspectRatio?: number | 'free';
    texts?: Partial<Record<'title' | 'apply' | 'cancel' | 'rotateLeft' | 'rotateRight' | 'flip' | 'reset' | 'help', string>>;
    parent?: HTMLElement;
}
export interface CaptureOptions extends ConvertImageOptions {
    accept?: string;
    camera?: 'environment' | 'user' | false;
    multiple?: boolean;
    /** false: return the files as picked. */
    process?: boolean;
}
export interface ImageTransformInfo { from: { width: number; height: number; size: number }; to: { width: number; height: number; size: number }; type: string; rotate?: number; flipH?: boolean }

export interface WidgetEntry {
    id: number;
    file: File;
    /** Relative path for files that came from a folder, else ''. */
    path: string;
    preview: Preview | null;
    resized: { from: { width: number; height: number; size: number }; to: { width: number; height: number; size: number } } | null;
    /** Set when `stripMetadata` removed something: what was removed and the size before and after. */
    stripped: { removed: string[]; from: number; to: number } | null;
    /** Set when `convert` turned the file (HEIC) into another format. */
    converted: ImageTransformInfo | { type: string } | null;
    /** Set when the person cropped it in the `crop` dialog. */
    cropped: ImageTransformInfo | { type: string } | null;
}

export interface MetadataOptions {
    /** Keep the EXIF Orientation tag (as a minimal EXIF block) so phone photos stay upright. Default true. */
    keepOrientation?: boolean;
    /** Keep the embedded colour profile. Default true. */
    keepColorProfile?: boolean;
    /** Largest file to read, in MB. Default 64. */
    maxMB?: number;
}

export interface ImageMetadata {
    format: 'jpeg' | 'png' | 'webp';
    exif: boolean;
    /** True only when a latitude or longitude is really stored. */
    gps: boolean;
    xmp: boolean;
    iptc: boolean;
    comments: boolean;
    /** EXIF orientation 1-8, or null. */
    orientation: number | null;
    /** Readable names of what was found: 'EXIF', 'GPS location', 'XMP', 'IPTC / Photoshop', 'comments', 'other'. */
    kinds: string[];
}

export interface RejectedFile {
    file: File;
    path: string;
    errors: string[];
    details: FileProblem[];
    messages: string[];
}

export interface AddResult {
    accepted: WidgetEntry[];
    rejected: RejectedFile[];
    ignored: File[];
}

export interface WidgetOptions {
    input?: string | HTMLInputElement;
    dropzone?: string | HTMLElement;
    multiple?: boolean;
    append?: boolean;
    browse?: boolean;
    /** Force the zone to be a keyboard-operable button. Automatic only when the real input cannot be reached by keyboard. */
    keyboard?: boolean;
    paste?: boolean | 'document';
    folder?: boolean;
    syncInput?: boolean;
    dragClass?: string;
    list?: string | HTMLElement;
    messageElement?: string | HTMLElement;
    statusElement?: string | HTMLElement;
    statusText?: (kind: 'add' | 'remove' | 'clear', info: Record<string, unknown>, total: number) => string;
    renderItem?: (entry: WidgetEntry, helpers: { remove(): void; formatBytes(bytes: number): string }) => HTMLElement;
    preview?: boolean | PreviewOptions;
    resize?: boolean | ResizeOptions;
    /** HEIC / HEIF photos become JPEG where the browser (or `decoder`) can decode them. Needs the image add-on (in the bundle). */
    convert?: boolean | ConvertImageOptions;
    /** Every accepted image opens in a crop dialog first; cancelling skips the file. Needs the image add-on. */
    crop?: boolean | CropperOptions;
    /** Remove EXIF / GPS / XMP / IPTC / comments from JPEG, PNG and WebP photos before they are listed. `true` or MetadataOptions. */
    stripMetadata?: boolean | MetadataOptions;
    maxShownMessages?: number;
    maxDropped?: number;
    maxDepth?: number;
    onChange?: (files: File[], entries: WidgetEntry[], info?: unknown) => void;
    onReject?: (rejected: RejectedFile[], info: { source: string }) => void;
}

export interface WidgetController {
    add(files: Iterable<File> | ArrayLike<File>, meta?: { source?: string }): Promise<AddResult>;
    remove(target: WidgetEntry | number | File): boolean;
    clear(): void;
    /** Full check of the selection (minFiles, scopes, customAll ...). */
    validate(): Promise<ValidationResult>;
    appendTo(formData: FormData, name?: string): FormData;
    destroy(): void;
    readonly files: File[];
    readonly entries: WidgetEntry[];
    readonly element: HTMLElement;
    readonly input: HTMLInputElement | null;
}

export interface FileValidatorStatic {
    widget(target: string | HTMLElement, config?: FileValidatorConfig, options?: WidgetOptions): WidgetController;
    /** Alias of widget(). */
    dropzone(target: string | HTMLElement, config?: FileValidatorConfig, options?: WidgetOptions): WidgetController;
    filesFromDrop(dataTransfer: DataTransfer | null, options?: { maxFiles?: number; maxDepth?: number }): Promise<File[]>;
    filesFromClipboard(clipboardData: DataTransfer | null): File[];
    resizeImage(file: File, options?: ResizeOptions): Promise<File>;
    /** Decodes an image the way it is DISPLAYED: width / height already follow the EXIF orientation and `source` is upright, on every browser. null when it cannot be decoded. */
    readImage(file: File): Promise<{ width: number; height: number; source: CanvasImageSource; close(): void; orientation: number } | null>;
    /** The EXIF Orientation (1-8) of a JPEG, WebP or PNG; 1 when there is none or the file cannot be read. */
    exifOrientation(file: File): Promise<number>;
    createPreview(file: File, options?: PreviewOptions): Promise<Preview>;
}

declare const FileValidator: FileValidatorStatic;
export default FileValidator;
export { FileValidator };
