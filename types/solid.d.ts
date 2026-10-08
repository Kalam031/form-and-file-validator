// Solid bindings: `import { createFormValidator } from 'form-and-file-validator/solid'` (needs solid-js >= 1.6)
import type { InitOptions, FormInstance, FormValues, SubmitResult, ServerErrorsResult, ServerErrorFormat } from './formValidator';

export interface FvSolidError { name: string; message: string; code?: string; field: HTMLElement }
export type FvSolidOptions = Omit<InitOptions, 'form' | 'formId'>;
export interface SolidFormValidator {
    /** `<form ref={fv.ref}>` */
    ref(el: HTMLFormElement | undefined): void;
    errors: () => FvSolidError[];
    /** true / false after a check, null before the first one. */
    valid: () => boolean | null;
    submitting: () => boolean;
    validate(options?: { focus?: boolean; submit?: boolean }): Promise<boolean>;
    /** onSubmit handler: validates, calls fn(values, event) only for a valid form; fn may return `{ errors }` from your server. */
    handleSubmit(fn: (values: FormValues, event: any) => unknown): (event?: any) => Promise<SubmitResult>;
    getValues(): FormValues;
    setServerErrors(body: unknown, options?: { format?: ServerErrorFormat; clear?: boolean }): (ServerErrorsResult & { missed: string[] }) | null;
    /** Precognition: asks your real endpoint whether the current values pass and shows its field errors. */
    validateOnServer(url: string, options?: object): Promise<{ valid: boolean | null; status: number; errors: Record<string, string>; all: Record<string, string[]>; form: string[]; only: string[] | null }>;
    reset(): void;
    instance(): FormInstance | null;
    element(): HTMLFormElement | null;
}
export declare function createFormValidator(options?: FvSolidOptions): SolidFormValidator;
declare const _default: { createFormValidator: typeof createFormValidator };
export default _default;
