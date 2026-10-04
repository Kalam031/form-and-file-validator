// Types for form-and-file-validator: `import { FormValidator, FileValidator } from 'form-and-file-validator'`.
import type { FormValidatorStatic } from './formValidator';
import type { FileValidatorStatic } from './fileValidator';

export * from './formValidator';
export * from './fileValidator';
export type { JQueryValidate } from './jquery-validate';
import type { LocalesStatic } from './locales';
export * from './locales';
export declare const locales: LocalesStatic;

export declare const FormValidator: FormValidatorStatic;
export declare const FileValidator: FileValidatorStatic;

/** Installs the jQuery Validation compatibility layer on this jQuery ($.fn.validate, $.validator ...). Safe to call twice. */
export declare function useJQuery(jQuery: unknown): unknown;

export declare const versions: {
    formValidator: string;
    fileValidator: string;
    'fileValidator.widget': string;
    'formValidator.jquery': string;
    'formValidator.additional': string;
    locale: string;
};

declare const api: { FormValidator: FormValidatorStatic; FileValidator: FileValidatorStatic; locales: LocalesStatic; useJQuery: typeof useJQuery; versions: typeof versions };
export default api;
