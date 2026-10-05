// Angular Signal Forms bindings: `import { fvSchema, fvValidate, fvPrecognition, fvServerErrors } from 'form-and-file-validator/angular-signals'`
// Needs @angular/forms >= 21 (the `@angular/forms/signals` entry point) and @angular/core.
import type { FieldContext, FieldTree, SchemaPathTree, ValidationError } from '@angular/forms/signals';
import type { RulesForField, ValueCheckOptions, ServerErrorFormat, PrecognitionOptions } from './formValidator';

/** The error these functions give to Signal Forms: `kind` is the rule's `code` (else its type), so `@if (e.kind === 'required')` works. */
export interface FvSignalError { kind: string; message: string; rule: string; code: string }

export interface FvSignalOptions extends Pick<ValueCheckOptions, 'trim' | 'messages' | 'passwordStrength' | 'context'> {
    /** Fixed values, or a function that reads them from the form, for the "other fields" of equalTo / notEqualTo. */
    values?: Record<string, unknown> | ((ctx: FieldContext<any, any>) => Record<string, unknown>);
}

/** `validate(p.email, fvValidate(['required', 'email']))` */
export declare function fvValidate(rules: RulesForField, options?: FvSignalOptions): (ctx: FieldContext<any, any>) => FvSignalError | undefined;

/** `form(model, fvSchema({ email: ['required', 'email'], confirm: { equalTo: 'password' } }))`, or `fvSchema({...})(p)` inside your own schema. Field names may be paths ('address.zip'). */
export declare function fvSchema(rules: Record<string, RulesForField>, options?: FvSignalOptions): (path: SchemaPathTree<any>) => void;

export interface FvPrecognitionSignalOptions extends Omit<PrecognitionOptions, 'only' | 'signal'> {
    /** The field name sent as `Precognition-Validate-Only`. */
    name: string;
    /** The values to send; default `{ [name]: value }`. */
    values?: (ctx: FieldContext<any, any>) => Record<string, unknown>;
    /** Milliseconds (default 300) or a Signal Forms debouncer. */
    debounce?: number | ((...args: any[]) => any);
}
/** Asks your real endpoint whether the value would pass (after the sync rules pass, debounced, stale requests cancelled). */
export declare function fvPrecognition(path: SchemaPathTree<any>, url: string, options: FvPrecognitionSignalOptions): void;

/** Server messages (any backend) as errors for `submit()`: each lands on its field, the rest on the form. */
export declare function fvServerErrors(form: FieldTree<any>, body: unknown, options?: { format?: ServerErrorFormat }): Array<FvSignalError & { fieldTree: FieldTree<any> }>;

declare const _default: { fvValidate: typeof fvValidate; fvSchema: typeof fvSchema; fvPrecognition: typeof fvPrecognition; fvServerErrors: typeof fvServerErrors };
export default _default;
