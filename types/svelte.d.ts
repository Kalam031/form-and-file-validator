// Svelte bindings: `import { createFormValidator, fvForm } from 'form-and-file-validator/svelte'` (Svelte 3, 4 and 5; no Svelte import needed)
import type { InitOptions, FormInstance, FormValues, SubmitResult, ServerErrorsResult, ServerErrorFormat } from './formValidator';

export interface FvStoreError { name: string; message: string; code?: string; field: HTMLElement }
/** The Svelte store contract: usable with `$store` and `get()`. */
export interface Readable<T> { subscribe(run: (value: T) => void): () => void }
export type FvOptions = Omit<InitOptions, 'form' | 'formId'>;

export interface FvAction { update(options?: FvOptions): void; destroy(): void }
/** `<form use:fvForm={{ rules, config }}>` */
export declare function fvForm(node: HTMLFormElement, options?: FvOptions): FvAction;

export interface SvelteFormValidator {
    /** `<form use:form>` */
    form(node: HTMLFormElement, options?: FvOptions): FvAction;
    errors: Readable<FvStoreError[]>;
    /** true / false after a check, null before the first one. */
    valid: Readable<boolean | null>;
    submitting: Readable<boolean>;
    validate(options?: { focus?: boolean; submit?: boolean }): Promise<boolean>;
    /** onsubmit handler: validates, calls fn(values, event) only for a valid form; fn may return `{ errors }` from your server. */
    handleSubmit(fn: (values: FormValues, event: any) => unknown): (event?: any) => Promise<SubmitResult>;
    getValues(): FormValues;
    setServerErrors(body: unknown, options?: { format?: ServerErrorFormat; clear?: boolean }): (ServerErrorsResult & { missed: string[] }) | null;
    /** Precognition: asks your real endpoint whether the current values pass and shows its field errors. */
    validateOnServer(url: string, options?: object): Promise<{ valid: boolean | null; status: number; errors: Record<string, string>; all: Record<string, string[]>; form: string[]; only: string[] | null }>;
    reset(): void;
    instance(): FormInstance | null;
    readonly element: HTMLFormElement | null;
}
export declare function createFormValidator(options?: FvOptions): SvelteFormValidator;
declare const _default: { fvForm: typeof fvForm; createFormValidator: typeof createFormValidator };
export default _default;
