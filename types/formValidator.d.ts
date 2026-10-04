// Types for FormValidator (formValidator.js).

export interface RuleEnv {
    value: string;
    empty: boolean;
    /** Ticked boxes, chosen options or selected files. */
    count: number;
    files: File[] | null;
    field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    /** All boxes of a checkbox or radio group. */
    fields: Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
    form: HTMLFormElement;
    config: FormConfig;
    context: Record<string, unknown> & { form: HTMLFormElement };
    inst: FormInstance;
    badInput: boolean;
}

/** What a rule function may return. A string is the error message. */
export type RuleResult = boolean | string | undefined | null | { valid: boolean; message?: string };

export type MessageSource = string | ((field: HTMLElement, rule: RuleObject, env: RuleEnv) => string);

export interface RuleObject {
    type: RuleName | (string & {});
    /** Text with {min}, {max}, {0}, {1} placeholders, or a function. Wins over every other message source. */
    message?: MessageSource;
    /** The rule applies only when this returns true. */
    when?: (value: string, env: RuleEnv) => boolean;
    /** Transforms the value before the rule sees it. */
    normalizer?: (value: string, field: HTMLElement) => string;
    /** date / minDate / maxDate: the exact format, for example 'd/M/y', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd HH:mm'. y = 4-digit year, yy = 2-digit year (00-69 is 20xx), d M H m s = 1 or 2 digits, dd MM HH mm ss = exactly 2. Same result on every platform. */
    format?: string;
    /** date / minDate / maxDate: only ISO 8601 (yyyy-MM-dd, optionally THH:mm[:ss]). Ignored when a format is given. */
    strict?: boolean;
    min?: number | string;
    max?: number | string;
    step?: number;
    base?: number;
    values?: unknown[];
    pattern?: string | RegExp;
    flags?: string;
    /** equalTo / notEqualTo: a field name. */
    target?: string;
    /** equalTo / notEqualTo: a CSS selector. */
    selector?: string;
    types?: string[];
    maxSize?: number;
    maxSizeMB?: number;
    /** custom rule */
    validate?: (value: string, context: RuleEnv['context'], field: HTMLElement, env: RuleEnv) => RuleResult | Promise<RuleResult>;
    /** pwcheck */
    minLength?: number;
    maxLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireDigit?: boolean;
    requireSpecialChar?: boolean;
    noWhitespace?: boolean;
    enabled?: boolean;
    /** remote rule */
    url?: string;
    method?: 'GET' | 'POST' | 'get' | 'post';
    /** jQuery-style alias of `method` for remote rules. */
    field?: string;
    data?: Record<string, unknown> | ((value: string, env: RuleEnv) => Record<string, unknown>);
    headers?: Record<string, string>;
    timeout?: number;
    cache?: boolean;
    failOpen?: boolean;
    encoding?: 'json' | 'form';
    credentials?: RequestCredentials;
    parse?: (json: unknown, response: Response) => unknown;
    /** file rule: any FileValidator option */
    accept?: string;
    param?: unknown;
    [option: string]: unknown;
}

export type RuleName =
    | 'required' | 'email' | 'url' | 'number' | 'digits' | 'alpha' | 'alphanumeric' | 'phone' | 'date' | 'minDate' | 'maxDate' | 'creditcard' | 'pattern'
    | 'minlength' | 'maxlength' | 'rangelength' | 'range' | 'min' | 'max' | 'step' | 'oneOf' | 'equalTo' | 'notEqualTo' | 'pwcheck'
    | 'minChecked' | 'maxChecked' | 'minFiles' | 'maxFiles' | 'fileType' | 'fileSize' | 'file' | 'remote' | 'custom'
    | 'notOneOf' | 'integer' | 'uuid' | 'hexColor' | 'slug' | 'ipv4' | 'ipv6' | 'iban' | 'time' | 'domain' | 'base64' | 'mac' | 'latitude' | 'longitude'
    | 'startsWith' | 'endsWith' | 'contains' | 'minWords' | 'maxWords';

/** jQuery-style rule map: `{ required: true, minlength: 3, range: [1, 5], equalTo: '#pw', remote: '/check' }`. */
export type RuleMap = { [rule: string]: unknown } & { normalizer?: (value: string, field: HTMLElement) => string; messages?: Record<string, string> };

/** A rule, a list of rules, or a jQuery-style map. Strings are rule names: 'required'. */
export type RulesForField = string | RuleObject | Array<string | RuleObject> | RuleMap;

export interface FormConfig {
    trim?: boolean;
    novalidate?: boolean;
    focusInvalid?: boolean;
    focusCleanup?: boolean;
    validateHidden?: boolean;
    ignore?: string | null;
    validateOn?: Array<'change' | 'blur' | 'input'>;
    debounce?: number;
    errorElement?: string;
    errorClass?: string;
    invalidClass?: string;
    pendingClass?: string;
    messages?: Record<string, string | ((field: HTMLElement, rule: RuleObject, env: RuleEnv) => string)>;
    passwordStrength?: Partial<Pick<RuleObject, 'minLength' | 'maxLength' | 'requireUppercase' | 'requireLowercase' | 'requireDigit' | 'requireSpecialChar' | 'noWhitespace' | 'enabled'>>;
    errorPlacement?: ((errorEl: HTMLElement, field: HTMLElement, fields: HTMLElement[]) => void) | null;
    /** Called instead of a normal submit when the form is valid (the AJAX place). The third argument is the validated data, see getValues(). */
    submitHandler?: ((form: HTMLFormElement, event: Event, values: FormValues) => void) | null;
    /** AJAX in one step: called with the validated values when the form is valid, no native submit. May return a Promise; `{ errors: { field: message } }` (from your server) is shown on the fields. */
    onSubmit?: ((values: FormValues, event: Event, instance: FormInstance) => unknown) | null;
    onError?: ((errors: Array<{ name: string; field: HTMLElement; message: string }>) => void) | null;
    onSuccess?: (() => void) | null;
    autoRules?: boolean;
    classRules?: Record<string, RulesForField> | null;
    skipEmptyUntilSubmit?: boolean;
    validateAfterSubmit?: boolean;
    liveInput?: boolean;
    interceptSubmit?: boolean;
    skipSubmitter?: string | null;
    highlight?: ((field: HTMLElement, unit: unknown) => void) | null;
    unhighlight?: ((field: HTMLElement, unit: unknown) => void) | null;
    onFieldValid?: ((field: HTMLElement, unit: unknown) => void) | null;
    fieldRules?: ((field: HTMLElement, unit: unknown) => RulesForField) | null;
    resolveMessage?: ((rule: RuleObject, env: RuleEnv, dynamicMessage?: string) => string | null | undefined) | null;
}

export interface InitOptions {
    /** An id, a CSS selector, an element, or an array of those. */
    formId?: string | HTMLFormElement | Array<string | HTMLFormElement>;
    form?: string | HTMLFormElement | Array<string | HTMLFormElement>;
    rules: Record<string, RulesForField>;
    config?: FormConfig;
    /** Your own object, passed to `custom` rules next to `form`. */
    context?: Record<string, unknown>;
    /** Per rule type, per field ({ email: { required: '...' } }) or one text for a field. */
    messages?: Record<string, string | Record<string, string> | ((field: HTMLElement, rule: RuleObject, env: RuleEnv) => string)>;
}

export interface FieldError {
    name: string;
    field: HTMLElement;
    fields: HTMLElement[];
    message: string;
    el: HTMLElement;
}

/** What getValues() returns: text trimmed like the validation saw it (passwords not), checkbox groups and multiple selects as arrays, File[] for file inputs, unchecked boxes left out. */
export type FormValues = Record<string, string | string[] | File[]>;

/** What handleSubmit resolves to. */
export interface SubmitResult {
    valid: boolean;
    values: FormValues;
    errors: FieldError[];
    /** What your function returned. */
    result?: unknown;
}

export interface FormInstance {
    readonly form: HTMLFormElement;
    readonly config: FormConfig;
    /** Checks the whole form. */
    validate(options?: { focus?: boolean; submit?: boolean }): Promise<boolean>;
    /** Synchronous check. Answers from async rules (remote, file) count as valid until they arrive. */
    validateSync(options?: { focus?: boolean; submit?: boolean }): boolean;
    validateField(name: string): Promise<boolean>;
    validateElement(el: HTMLElement): Promise<boolean>;
    validateElementSync(el: HTMLElement): boolean;
    getErrors(): FieldError[];
    /** The form values as an object, ready for fetch / axios / $.ajax. */
    getValues(): FormValues;
    /** Validate (showing the errors), then give back what to send. */
    validateAndGetValues(options?: { focus?: boolean; submit?: boolean }): Promise<SubmitResult>;
    /** An event handler for any framework: stops the native submit, validates, and only for a valid form calls fn(values, event, instance). fn may return `{ errors: { field: message } }` from your server. */
    handleSubmit(fn: (values: FormValues, event: Event | undefined, instance: FormInstance) => unknown): (event?: Event) => Promise<SubmitResult>;
    /** Shows messages from the server on the fields (names matched exactly, then ignoring case). Returns the names that matched no field. */
    setErrors(errors: Record<string, string | string[]>): string[];
    setError(name: string, message: string): boolean;
    clearError(name: string): void;
    clearErrors(): void;
    resetForm(): void;
    isSubmitted(): boolean;
    setRules(name: string, rules: RulesForField): void;
    addRules(name: string, rules: RulesForField): void;
    removeRules(name: string): void;
    destroy(): void;
}

/** jQuery Validation style method: `function (value, element, param)`, with `this.optional(element)`. */
export type MethodFn = (this: { form: HTMLFormElement; field: HTMLElement; format: FormValidatorStatic['format']; optional(element: HTMLElement): boolean; elementValue(element: HTMLElement): string },
    value: string, element: HTMLElement, param: any, env: RuleEnv) => RuleResult | 'dependency-mismatch' | 'pending' | Promise<RuleResult>;

/** The answer of checkValue for one value. */
export interface ValueCheckResult {
    valid: boolean;
    /** The type of the first rule that failed (null when valid). */
    rule: string | null;
    message: string;
}

export interface ValueCheckOptions {
    /** Trim the value first (default true; pwcheck never trims). */
    trim?: boolean;
    /** The other fields, for equalTo / notEqualTo. */
    values?: Record<string, unknown>;
    /** Replaces the default message of a rule type. */
    messages?: Record<string, string>;
    passwordStrength?: Partial<Pick<RuleObject, 'minLength' | 'maxLength' | 'requireUppercase' | 'requireLowercase' | 'requireDigit' | 'requireSpecialChar' | 'noWhitespace'>>;
    context?: Record<string, unknown>;
}

export interface ValuesCheckResult {
    valid: boolean;
    errors: Record<string, string>;
    details: Record<string, { rule: string | null; message: string }>;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Standard Schema (https://standardschema.dev): the interface below is the one the specification asks libraries to copy.
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
    interface Props<Input = unknown, Output = Input> {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
        readonly types?: Types<Input, Output> | undefined;
    }
    type Result<Output> = SuccessResult<Output> | FailureResult;
    interface SuccessResult<Output> { readonly value: Output; readonly issues?: undefined }
    interface FailureResult { readonly issues: ReadonlyArray<Issue> }
    interface Issue { readonly message: string; readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined }
    interface PathSegment { readonly key: PropertyKey }
    interface Types<Input = unknown, Output = Input> { readonly input: Input; readonly output: Output }
    type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['input'];
    type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['output'];
}

/** One problem found by a schema: the Standard Schema issue plus the type of the rule that failed. */
export interface SchemaIssue extends StandardSchemaV1.Issue {
    readonly path: ReadonlyArray<string>;
    /** The rule that failed, for example 'email'. */
    readonly rule?: string;
}

/** What `schema.parse()` throws. */
export interface ValidationError extends Error {
    readonly name: 'ValidationError';
    readonly issues: ReadonlyArray<SchemaIssue>;
    /** { field: first message of that field } */
    readonly errors: Record<string, string>;
}

type IsRequired<R> =
    R extends 'required' ? true
    : R extends { type: 'required' } ? true
    : R extends { required: false } ? false
    : R extends { required: (...args: never[]) => unknown } ? false          // required only when a condition says so
    : R extends { required: unknown } ? true
    : R extends readonly (infer E)[] ? (true extends IsRequired<E> ? true : false)
    : false;

/** The value a form has for each field, as text: fields with a `required` rule must be there, the others may be missing. */
export type SchemaInput<R extends Record<string, RulesForField>> =
    { [K in keyof R as IsRequired<R[K]> extends true ? K : never]: string }
    & { [K in keyof R as IsRequired<R[K]> extends true ? never : K]?: string };

/** What a valid check gives back: every field as trimmed text (passwords exactly as typed). */
export type SchemaOutput<R extends Record<string, RulesForField>> = { [K in keyof R]: string };

/** { field: message } with the field names of the rules. */
export type SchemaErrors<R extends Record<string, RulesForField>> = { [K in keyof R]?: string };

export type SafeParseResult<R extends Record<string, RulesForField>> =
    | { success: true; data: SchemaOutput<R>; errors: {}; issues: [] }
    | { success: false; data?: undefined; error: ValidationError; errors: SchemaErrors<R>; issues: ReadonlyArray<SchemaIssue> };

/** The rules of an object as one Standard Schema, from `FormValidator.schema(rules)`. */
export interface FormSchema<R extends Record<string, RulesForField>> extends StandardSchemaV1<SchemaInput<R>, SchemaOutput<R>> {
    readonly rules: R;
    readonly fields: ReadonlyArray<keyof R & string>;
    /** The checked, trimmed values, or throws a ValidationError. */
    parse(data: unknown): SchemaOutput<R>;
    /** Never throws for invalid data. */
    safeParse(data: unknown): SafeParseResult<R>;
    /** The checkValues() answer: { valid, errors, details }. */
    check(data: Record<string, unknown>): ValuesCheckResult;
}

export type InferInput<S extends { readonly rules: Record<string, RulesForField> }> = SchemaInput<S['rules']>;
export type InferOutput<S extends { readonly rules: Record<string, RulesForField> }> = SchemaOutput<S['rules']>;
export type InferErrors<S extends { readonly rules: Record<string, RulesForField> }> = SchemaErrors<S['rules']>;

export interface FormValidatorStatic {
    readonly version: string;
    /**
     * The rules of an object as one Standard Schema (React Hook Form, TanStack Form, Hono, tRPC ... accept it), with typed values and errors:
     * `const signup = FormValidator.schema({ email: ['required', 'email'], nick: { minlength: 3 } });`
     * Same engine and messages as checkValues(): no file, checkbox-count or remote rules.
     */
    schema<const R extends Record<string, RulesForField>>(rules: R, options?: ValueCheckOptions): FormSchema<R>;
    readonly ValidationError: new (issues: ReadonlyArray<SchemaIssue>) => ValidationError;
    /** Set up one form (returns its instance) or several (returns an array). */
    init(options: InitOptions & { formId: Array<string | HTMLFormElement> }): FormInstance[];
    init(options: InitOptions): FormInstance;
    /** Check an initialised form, or any form against ad-hoc rules. */
    validate(form: string | HTMLFormElement, rules?: Record<string, RulesForField>): Promise<boolean>;
    getInstance(form: string | HTMLFormElement): FormInstance | null;
    /** jQuery valid() without jQuery: true / false right now (shows the errors). Remote and file checks count as valid until they answer; validate() waits for them. */
    isValid(form: string | HTMLFormElement, rules?: Record<string, RulesForField>): boolean;
    /**
     * Checks one value with the form rules and no DOM: Node, a server, a unit test, Angular validators.
     * Not available: file, checkbox-count and remote rules (they throw). Synchronous: no async custom rules.
     */
    checkValue(value: unknown, rules: RulesForField, options?: ValueCheckOptions): ValueCheckResult;
    /** Checks a whole object against `{ field: rules }`. */
    checkValues(data: Record<string, unknown>, schema: Record<string, RulesForField>, options?: ValueCheckOptions): ValuesCheckResult;
    /** Engine-style rule: `fn(value, rule, env)`. */
    registerRule(name: string, fn: (value: string, rule: RuleObject, env: RuleEnv) => RuleResult | Promise<RuleResult>, options?: { runOnEmpty?: boolean; remote?: boolean }): void;
    /** jQuery-style rule: `fn(value, element, param)`. */
    addMethod(name: string, fn: MethodFn, message?: string | ((param: any, element: HTMLElement) => string)): void;
    addClassRules(name: string, rules: RulesForField): void;
    addClassRules(rules: Record<string, RulesForField>): void;
    /** Like $.validator.format: fills {0}, {1}. With one argument it returns a function. */
    format(source: string): (...params: unknown[]) => string;
    format(source: string, ...params: unknown[]): string;
    setDefaults(options: FormConfig): void;
    /** Global default messages by rule type. Change them to translate everything. */
    readonly messages: Record<string, string | ((field: HTMLElement, rule: RuleObject, env: RuleEnv) => string)>;
    readonly defaults: FormConfig;
    /** How remote rules talk to the server (default GET). */
    readonly remoteDefaults: { method: 'GET' | 'POST'; encoding: 'json' | 'form' };
    getRule(name: string): { fn: Function; runOnEmpty: boolean; remote: boolean } | null;
    /** Only in the one-file bundle. */
    readonly bundled?: boolean;
    /** Only in the one-file bundle: install the jQuery Validation layer on this jQuery. */
    useJQuery?(jQuery: unknown): unknown;
}

declare const FormValidator: FormValidatorStatic;
export default FormValidator;
export { FormValidator };
