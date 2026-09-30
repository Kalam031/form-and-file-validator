// Server companion: `import { middleware, validate } from 'form-and-file-validator/server'` (Node >= 18).
import type { FileValidatorConfig, FileValidatorStatic } from './fileValidator';

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
