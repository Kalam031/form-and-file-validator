// Vue 3 bindings: `import { useFormValidator, FileDropzone, vFormValidator } from 'form-and-file-validator/vue'`
import type { Ref, ShallowRef, Directive, Plugin, DefineComponent } from 'vue';
import type { InitOptions, FormInstance, FieldError, FormValues, SubmitResult, ServerErrorsResult, ServerErrorFormat, PrecognitionOptions, PrecognitionResult } from './formValidator';
import type { FileValidatorConfig, WidgetOptions } from './fileValidator';

type Opts = Omit<InitOptions, 'form' | 'formId'>;
export declare function useFormValidator(options: Opts | Ref<Opts> | (() => Opts)): {
    formRef: Ref<HTMLFormElement | null>;
    validate(options?: { focus?: boolean; submit?: boolean }): Promise<boolean>;
    reset(): void;
    /** Event handler: validates, then calls fn(values, event) only for a valid form. fn may return `{ errors: { field: message } }` from your server. */
    handleSubmit(fn: (values: FormValues, event: any) => unknown): (event?: any) => Promise<SubmitResult>;
    getValues(): FormValues;
    setErrors(errors: Record<string, string | string[]>): string[];
    /** Show what a backend answered (problem+json, Laravel, Django REST, ASP.NET, FastAPI, Zod ...) on the fields and refresh `errors`. */
    setServerErrors(body: unknown, options?: { format?: ServerErrorFormat; clear?: boolean }): ServerErrorsResult & { missed: string[] };
    /** Precognition: ask your real endpoint whether the current values pass, and show its field errors. */
    validateOnServer(url: string, options?: PrecognitionOptions): Promise<PrecognitionResult>;
    errors: Ref<FieldError[]>;
    instance: ShallowRef<FormInstance | null>;
};
export declare const vFormValidator: Directive<HTMLFormElement, Opts>;
export declare const FileDropzone: DefineComponent<{ config?: FileValidatorConfig; options?: WidgetOptions; name?: string; id?: string; label?: string }>;
export declare const FormValidatorPlugin: Plugin;
declare const _default: { useFormValidator: typeof useFormValidator; vFormValidator: typeof vFormValidator; FileDropzone: typeof FileDropzone; FormValidatorPlugin: typeof FormValidatorPlugin };
export default _default;
