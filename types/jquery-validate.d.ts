// Types for the jQuery Validation compatibility layer (formValidator.jquery.js). Needs @types/jquery in your project.
import type { RulesForField, MethodFn, UnobtrusiveAdapters } from './formValidator';
import type { FileValidatorConfig } from './fileValidator';

export namespace JQueryValidate {
    type MessageFn = (params: any, element: HTMLElement) => string;

    interface ErrorItem { message: string; element: HTMLElement; method?: string }

    interface Options {
        rules?: Record<string, string | Record<string, unknown> & { fileValidator?: FileValidatorConfig | true }>;
        messages?: Record<string, string | Record<string, string | MessageFn>>;
        /** Fields that share one visible error: `{ username: 'firstname lastname' }`. */
        groups?: Record<string, string>;
        errorClass?: string;
        validClass?: string;
        pendingClass?: string;
        errorElement?: string;
        focusInvalid?: boolean;
        focusCleanup?: boolean;
        onsubmit?: boolean;
        onfocusout?: boolean;
        onkeyup?: boolean;
        onclick?: boolean;
        ignore?: string | unknown[];
        ignoreTitle?: boolean;
        debug?: boolean;
        /** Trim text values (default true; false gives the original plugin's behaviour). */
        trim?: boolean;
        errorContainer?: unknown;
        errorLabelContainer?: unknown;
        wrapper?: string;
        success?: string | ((this: Validator, label: any, element: HTMLElement) => void);
        errorPlacement?: (this: Validator, error: any, element: any) => void;
        highlight?: (this: Validator, element: HTMLElement, errorClass: string, validClass: string) => void;
        unhighlight?: (this: Validator, element: HTMLElement, errorClass: string, validClass: string) => void;
        invalidHandler?: (event: Event, validator: Validator) => void;
        submitHandler?: (this: Validator, form: HTMLFormElement, event: Event, values: Record<string, string | string[] | File[]>) => void | boolean;
        /** AJAX in one step: called with the validated values when the form is valid. May return a Promise; `{ errors: { field: message } }` from your server is shown on the fields. */
        onSubmit?: (this: Validator, values: Record<string, string | string[] | File[]>, event: Event, validator: Validator) => unknown;
        /** Render the errors yourself; call this.defaultShowErrors() to place them normally. */
        showErrors?: (this: Validator, errorMap: Record<string, string>, errorList: ErrorItem[]) => void;
    }

    interface Validator {
        settings: Options;
        currentForm: HTMLFormElement;
        readonly errorList: ErrorItem[];
        readonly errorMap: Record<string, string>;
        form(): boolean;
        element(element: string | HTMLElement | unknown): boolean;
        valid(): boolean;
        size(): number;
        numberOfInvalids(): number;
        resetForm(): void;
        showErrors(errors?: Record<string, string>): void;
        /** The validated values as an object, ready for $.ajax / fetch. */
        getValues(): Record<string, string | string[] | File[]>;
        validateAndGetValues(options?: { focus?: boolean; submit?: boolean }): Promise<{ valid: boolean; values: Record<string, string | string[] | File[]>; errors: unknown[] }>;
        /** An event handler: validates, then calls fn(values, event, validator) only when the form is valid. */
        handleSubmit(fn: (values: Record<string, string | string[] | File[]>, event: Event | undefined, validator: Validator) => unknown): (event?: Event) => Promise<unknown>;
        defaultShowErrors(): void;
        hideErrors(): void;
        focusInvalid(): void;
        destroy(): void;
        invalidElements(): any;
        validElements(): any;
        elements(): any;
        optional(element: HTMLElement): boolean | string;
        elementValue(element: HTMLElement): string;
        defaultMessage(element: HTMLElement, rule: string | { method: string; parameters?: unknown }): string;
    }

    interface ValidatorStatic {
        readonly version: string;
        defaults: Options;
        messages: Record<string, string | MessageFn>;
        methods: Record<string, MethodFn | ((this: Validator, value: any, element: HTMLElement, param: any) => unknown)>;
        classRuleSettings: Record<string, Record<string, unknown>>;
        autoCreateRanges: boolean;
        /** Replacement for jquery.validate.unobtrusive.js: `parse(selector)` and the adapter helpers. */
        unobtrusive: { adapters: UnobtrusiveAdapters; parse(selector?: any): JQuery; parseElement(element?: any): void };
        setDefaults(options: Options): void;
        addMethod(name: string, method: (this: Validator, value: any, element: HTMLElement, param: any) => boolean | string | Promise<boolean | string>, message?: string | MessageFn): void;
        addClassRules(name: string, rules: RulesForField): void;
        addClassRules(rules: Record<string, RulesForField>): void;
        format(source: string): (...params: unknown[]) => string;
        format(source: string, ...params: unknown[]): string;
        normalizeRule(data: string | Record<string, unknown>): Record<string, unknown>;
        normalizeRules(rules: Record<string, unknown>, element: HTMLElement): Record<string, unknown>;
    }
}

declare global {
    interface JQuery<TElement = HTMLElement> {
        validate(options?: JQueryValidate.Options): JQueryValidate.Validator;
        /** Synchronous. Server checks (remote, fileValidator) count as valid until they answer. */
        valid(): boolean;
        rules(): Record<string, unknown>;
        rules(command: 'add', argument: string | (Record<string, unknown> & { messages?: Record<string, string | JQueryValidate.MessageFn> })): void;
        rules(command: 'remove', argument?: string): Record<string, unknown>;
    }
    interface JQueryStatic {
        validator: JQueryValidate.ValidatorStatic;
    }
}

export {};
