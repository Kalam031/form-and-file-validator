// The DOM-free core: `import { checkValue, schema } from 'form-and-file-validator/core'` (about 12 KB gzip; no form engine, no jQuery layer, no files).
import type { FormValidatorStatic } from './formValidator';

export type FormValidatorCore = Pick<FormValidatorStatic,
    'version' | 'checkValue' | 'checkValues' | 'schema' | 'action' | 'serverErrors' | 'precognition' | 'parseFormData' | 'registerRule' | 'addMethod' | 'format' |
    'getRule' | 'ruleNames' | 'messages' | 'ValidationError'>;

export declare const FormValidator: FormValidatorCore;
export declare const checkValue: FormValidatorCore['checkValue'];
export declare const checkValues: FormValidatorCore['checkValues'];
export declare const schema: FormValidatorCore['schema'];
export declare const action: FormValidatorCore['action'];
export declare const serverErrors: FormValidatorCore['serverErrors'];
export declare const precognition: FormValidatorCore['precognition'];
export declare const parseFormData: FormValidatorCore['parseFormData'];
export declare const registerRule: FormValidatorCore['registerRule'];
export declare const addMethod: FormValidatorCore['addMethod'];
export declare const format: FormValidatorCore['format'];
export declare const ValidationError: FormValidatorCore['ValidationError'];
export declare const messages: FormValidatorCore['messages'];
export type * from './formValidator';
declare const _default: FormValidatorCore;
export default _default;
