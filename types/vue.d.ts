// Vue 3 bindings: `import { useFormValidator, FileDropzone, vFormValidator } from 'form-and-file-validator/vue'`
import type { Ref, ShallowRef, Directive, Plugin, DefineComponent } from 'vue';
import type { InitOptions, FormInstance, FieldError } from './formValidator';
import type { FileValidatorConfig, WidgetOptions } from './fileValidator';

type Opts = Omit<InitOptions, 'form' | 'formId'>;
export declare function useFormValidator(options: Opts | Ref<Opts> | (() => Opts)): {
    formRef: Ref<HTMLFormElement | null>;
    validate(options?: { focus?: boolean; submit?: boolean }): Promise<boolean>;
    reset(): void;
    errors: Ref<FieldError[]>;
    instance: ShallowRef<FormInstance | null>;
};
export declare const vFormValidator: Directive<HTMLFormElement, Opts>;
export declare const FileDropzone: DefineComponent<{ config?: FileValidatorConfig; options?: WidgetOptions; name?: string; id?: string; label?: string }>;
export declare const FormValidatorPlugin: Plugin;
declare const _default: { useFormValidator: typeof useFormValidator; vFormValidator: typeof vFormValidator; FileDropzone: typeof FileDropzone; FormValidatorPlugin: typeof FormValidatorPlugin };
export default _default;
