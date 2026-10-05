// Lit bindings: `import { FvFormController } from 'form-and-file-validator/lit'` (needs lit >= 2)
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { InitOptions, FormInstance, FormValues, SubmitResult, ServerErrorsResult, ServerErrorFormat } from './formValidator';

export interface FvControllerError { name: string; message: string; code?: string; field: HTMLElement }
export interface FvControllerOptions extends Omit<InitOptions, 'form' | 'formId'> {
    /** CSS selector of the form inside the element's render root (default: the first <form>). */
    form?: string;
}
export declare class FvFormController implements ReactiveController {
    constructor(host: ReactiveControllerHost & { renderRoot?: Element | DocumentFragment | ShadowRoot }, options?: FvControllerOptions);
    /** Refreshed after each check and while the user fixes fields; the host re-renders when it changes. */
    errors: FvControllerError[];
    /** true / false after a check, null before the first one. */
    valid: boolean | null;
    submitting: boolean;
    readonly instance: FormInstance | null;
    hostConnected(): void;
    hostUpdated(): void;
    hostDisconnected(): void;
    getValues(): FormValues;
    validate(options?: { focus?: boolean; submit?: boolean }): Promise<boolean>;
    /** `@submit` handler: validates, calls fn(values, event) only for a valid form; fn may return `{ errors }` from your server. */
    handleSubmit(fn: (values: FormValues, event: any) => unknown): (event?: any) => Promise<SubmitResult>;
    setServerErrors(body: unknown, options?: { format?: ServerErrorFormat; clear?: boolean }): (ServerErrorsResult & { missed: string[] }) | null;
    reset(): void;
}
declare const _default: { FvFormController: typeof FvFormController };
export default _default;
