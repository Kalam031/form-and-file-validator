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

export interface FileValidatorStatic {
    readonly version: string;
    validateFiles(files: FilesInput, config?: FileValidatorConfig): Promise<ValidationResult>;
    validateFile(file: File, config?: FileValidatorConfig): Promise<SingleResult>;
    /** Lines like "photo.png: This file is 6 MB but the maximum is 5 MB." */
    summary(result: ValidationResult, options?: { fileNames?: boolean }): string[];
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
    formatBytes(bytes: number): string;
    formatDuration(seconds: number): string;
    getCategory(file: { name: string; type?: string }, sniffedMime?: string): FileCategory;
    getPath(file: File): string;
    isIgnored(file: File, ignoreFiles: boolean | Array<string | RegExp>): boolean;
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

export interface WidgetEntry {
    id: number;
    file: File;
    /** Relative path for files that came from a folder, else ''. */
    path: string;
    preview: Preview | null;
    resized: { from: { width: number; height: number; size: number }; to: { width: number; height: number; size: number } } | null;
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
    createPreview(file: File, options?: PreviewOptions): Promise<Preview>;
}

declare const FileValidator: FileValidatorStatic;
export default FileValidator;
export { FileValidator };
