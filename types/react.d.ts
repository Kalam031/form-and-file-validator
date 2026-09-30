// React bindings: `import { useFormValidator, FileDropzone } from 'form-and-file-validator/react'`
import type { Ref, ForwardRefExoticComponent, RefAttributes, RefObject, InputHTMLAttributes } from 'react';
import type { InitOptions, FormInstance, FieldError } from './formValidator';
import type { FileValidatorConfig, WidgetOptions, WidgetEntry, RejectedFile, AddResult, ValidationResult } from './fileValidator';

export interface UseFormValidatorResult {
    /** Put this on your <form ref={...}>. */
    ref: RefObject<HTMLFormElement | null>;
    validate(options?: { focus?: boolean; submit?: boolean }): Promise<boolean>;
    reset(): void;
    /** Refreshed after every validate() call. */
    errors: FieldError[];
    instance(): FormInstance | null;
}
/** `deps` decide when the validator is created again (default: once). */
export declare function useFormValidator(options: Omit<InitOptions, 'form' | 'formId'>, deps?: ReadonlyArray<unknown>): UseFormValidatorResult;

export interface FileDropzoneHandle {
    readonly files: File[];
    readonly entries: WidgetEntry[];
    validate(): Promise<ValidationResult>;
    clear(): void;
    add(files: Iterable<File> | ArrayLike<File>, meta?: { source?: string }): Promise<AddResult>;
    appendTo(formData: FormData, name?: string): FormData;
}
export interface FileDropzoneProps {
    config?: FileValidatorConfig;
    options?: Omit<WidgetOptions, 'onChange' | 'onReject' | 'input' | 'list' | 'messageElement' | 'statusElement'>;
    onChange?: (files: File[], entries: WidgetEntry[], info?: unknown) => void;
    onReject?: (rejected: RejectedFile[], info: { source: string }) => void;
    name?: string;
    id?: string;
    className?: string;
    label?: string;
    inputProps?: InputHTMLAttributes<HTMLInputElement>;
}
export declare const FileDropzone: ForwardRefExoticComponent<FileDropzoneProps & RefAttributes<FileDropzoneHandle>>;
declare const _default: { useFormValidator: typeof useFormValidator; FileDropzone: typeof FileDropzone };
export default _default;
