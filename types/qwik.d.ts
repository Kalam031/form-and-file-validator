// Qwik bindings: `import { fvQwik, fvQwikCheck } from 'form-and-file-validator/qwik'` (no peer dependency: plain functions for useVisibleTask$ and routeAction$)
import type { InitOptions, FormInstance, FormValues, SubmitResult, ServerErrorsResult, ServerErrorFormat } from './formValidator';

/** Plain data (no DOM nodes), safe to keep in a Qwik signal. */
export interface FvQwikError { name: string; message: string; code?: string }
export type FvQwikOptions = Omit<InitOptions, 'form' | 'formId'> & {
    /** Called with the current errors after every check and while fields are fixed. */
    onErrors?: (errors: FvQwikError[]) => void;
    /** Called with true / false after every check. */
    onValid?: (valid: boolean) => void;
};
export interface QwikFormValidator {
    errors(): FvQwikError[];
    /** true / false after a check, null before the first one. */
    valid(): boolean | null;
    validate(options?: { focus?: boolean; submit?: boolean }): Promise<boolean>;
    handleSubmit(fn: (values: FormValues, event: any) => unknown): (event?: any) => Promise<SubmitResult>;
    getValues(): FormValues;
    setServerErrors(body: unknown, options?: { format?: ServerErrorFormat; clear?: boolean }): ServerErrorsResult & { missed: string[] };
    validateOnServer(url: string, options?: object): Promise<{ valid: boolean | null; status: number; errors: Record<string, string>; all: Record<string, string>; form: string[]; only: string[] | null }>;
    reset(): void;
    instance(): FormInstance;
    destroy(): void;
}
export declare function fvQwik(form: HTMLFormElement, options?: FvQwikOptions): QwikFormValidator;
export interface QwikCheckResult { ok: boolean; values: FormValues; errors: Record<string, string>; details: Record<string, { rule: string; code: string; message: string }> }
export declare function fvQwikCheck(rules: Record<string, unknown>, data: unknown, options?: object): QwikCheckResult;
declare const _default: { fvQwik: typeof fvQwik; fvQwikCheck: typeof fvQwikCheck };
export default _default;
