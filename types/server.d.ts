// Server companion: `import { middleware, validate } from 'form-and-file-validator/server'` (Node >= 18).
import type { FileValidatorConfig, FileValidatorStatic } from './fileValidator';
import type { FormValidatorStatic, FormSchema, RulesForField } from './formValidator';

/** Whatever your upload library gives you: multer / formidable / express-fileupload objects, Buffers, paths or Web Files. */
export type UploadInput = unknown;

export interface ServerResult {
    isValid: boolean;
    errors: string[];
    details: Array<{ code: string; message: string; [k: string]: unknown }>;
    files: Array<{ name: string; isValid: boolean; errors: string[]; details: Array<{ code: string; message: string }> }>;
}
export interface MiddlewareOptions {
    /** Status code of the automatic error response. Default 422. */
    status?: number;
    /** Validate only req.files[field]. */
    field?: string;
    /** Accept a request without files. Default false. */
    allowNoFiles?: boolean;
    /** Delete disk uploads that failed. Default true. */
    removeFailed?: boolean;
    /** Send your own response instead of the JSON body. */
    respond?: (req: any, res: any, result: ServerResult) => void;
}
export declare function validate(input: UploadInput, config?: FileValidatorConfig): Promise<ServerResult>;
export declare function middleware(config: FileValidatorConfig | ((req: any) => FileValidatorConfig), options?: MiddlewareOptions): (req: any, res: any, next: (err?: unknown) => void) => void;
export declare function toFile(item: UploadInput): Promise<File>;
export declare function flatten(input: unknown): unknown[];
export declare const FileValidator: FileValidatorStatic;
import type { LocalesStatic } from './locales';
export declare const locales: LocalesStatic;
export declare const version: string;

/** Where the values come from: a Web Request, FormData, URLSearchParams, a JSON or urlencoded string, or an already parsed object. */
export type RequestInput = Request | FormData | URLSearchParams | string | Record<string, unknown>;
export interface ValidateRequestOptions {
    /** Status of a validation failure. Default 422. */
    status?: number;
    /** File rules by form field name; uploaded Files in that field are checked like FileValidator.validateFiles. */
    files?: Record<string, FileValidatorConfig>;
    /** Write the messages in another language for this call. */
    lang?: string;
    /** Field names (or a RegExp) whose values are never echoed by `html().value()`. Password-like names are always omitted. */
    omit?: string[] | RegExp;
    /** Title of the problem+json body. */
    title?: string;
}
export interface ErrorMarkup {
    ok: boolean;
    keys: string[];
    /** An accessible summary (role="alert", links to the fields); '' when valid. Everything is escaped. */
    summary: string;
    /** The message under one field ('' when it is valid). */
    error(name: string): string;
    /** ` aria-invalid="true" aria-describedby="name-error"` for an invalid field, otherwise ''. */
    attrs(name: string): string;
    /** The visitor's input, escaped, for value="..." ('' for password-like fields). */
    value(name: string): string;
}
export interface RenderErrorsOptions { title?: string; idPrefix?: string; errorClass?: string; summaryClass?: string; omit?: string[] | RegExp }
export interface RequestResult<T = Record<string, unknown>> {
    ok: boolean;
    /** 200 when valid, otherwise 422 (or 400 for an unreadable body, 415 for an unsupported content type). */
    status: number;
    data: T | undefined;
    values: unknown;
    errors: Record<string, string>;
    issues: Array<{ message: string; path: Array<string | number>; rule?: string; code?: string }>;
    files: Record<string, ServerResult>;
    /** RFC 9457 problem+json body when not ok, otherwise null. */
    problem: { type: string; title: string; status: number; errors: Record<string, string[]> } | null;
    /** A Response (application/problem+json) for Fetch-API frameworks. */
    response(init?: ResponseInit): Response;
    html(options?: RenderErrorsOptions): ErrorMarkup;
}
/** One rules object for the browser and the server: validates a request body and returns typed data or a ready 422 answer. */
export declare function validateRequest<R extends Record<string, RulesForField>>(input: RequestInput, rules: R | FormSchema<R>, options?: ValidateRequestOptions): Promise<RequestResult>;
export interface BodyValidatorOptions {
    status?: number;
    /** Which property of the request holds the values. Default 'body'. */
    source?: 'body' | 'query' | 'params';
    respond?: (req: any, res: any, result: { ok: false; status: number; errors: Record<string, string>; problem: unknown }) => void;
    lang?: string;
}
/** Express / Connect / Fastify middleware: 422 problem+json on failure, `req.validated` on success. */
export declare function bodyValidator(rules: Record<string, RulesForField>, options?: BodyValidatorOptions): (req: any, res: any, next: (err?: unknown) => void) => void;
/** Accessible error markup for pages that work without JavaScript (all output escaped). */
export declare function renderErrors(result: { errors?: Record<string, string>; values?: unknown } | Record<string, string> | null | undefined, options?: RenderErrorsOptions): ErrorMarkup;
export declare const FormValidator: FormValidatorStatic;
