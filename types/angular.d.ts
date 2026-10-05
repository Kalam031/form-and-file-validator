// Angular bindings: `import { fvValidator, fvControls, fvGroupValidator, fvMessage } from 'form-and-file-validator/angular'`
// Structural types, so this file needs no import from @angular/forms and fits every Angular version (these are assignable to ValidatorFn).
import type { RulesForField, ValueCheckOptions } from './formValidator';

/** What the validators need from an AbstractControl. */
export interface ControlLike {
    value: unknown;
    parent?: { getRawValue?(): unknown; value?: unknown } | null;
    errors?: { [key: string]: any } | null;
}

export type FvErrors = { [rule: string]: { message: string } } & { fv: { rule: string; message: string } };
export type FvGroupErrors = { fv: { errors: Record<string, string>; details: Record<string, { rule: string | null; message: string }> } };

/** Names of the fields that equalTo / notEqualTo rules look at. */
export declare function fvTargets(rules: RulesForField): string[];

export interface FvOptions extends Pick<ValueCheckOptions, 'trim' | 'messages' | 'passwordStrength' | 'context'> {
    /** Fixed values for the "other fields" of equalTo / notEqualTo. By default the sibling controls of the group are used. */
    values?: Record<string, unknown>;
}

/** Any form value as the text the rules look at: null = '', numbers and booleans as text, a Date as yyyy-MM-dd (its local calendar date). */
export declare function fvText(value: unknown): string;

/** A validator for one control (a ValidatorFn). Rules: a name, a rule object, a list, or the map shorthand. */
export declare function fvValidator(rules: RulesForField, options?: FvOptions): (control: ControlLike) => FvErrors | null;

/** `{ field: rules }` -> `{ field: [startValue, validator] }` for `fb.group(...)` (FormBuilder). */
export declare function fvControls(schema: Record<string, RulesForField>, initial?: Record<string, unknown>, options?: FvOptions): Record<string, [unknown, (control: ControlLike) => FvErrors | null]>;

/** The group values as plain data to send (text trimmed; names that look like a password are never trimmed; options.keep adds more). */
export declare function fvValues(group: ControlLike, options?: { trim?: boolean; keep?: string[] }): any;

/** Shows messages from the server on the controls. Returns the names that matched no control. */
export declare function fvSetErrors(group: { get(path: string): any; controls?: any }, errors: Record<string, string | string[]>): string[];

/**
 * Submit a FormGroup: touches and checks every control, and only for a valid form calls fn(values, group).
 * fn may return `{ errors: { field: message } }` from your server; they are shown on the controls.
 */
export declare function fvSubmit(group: any, fn?: (values: any, group: any) => unknown, options?: { trim?: boolean; keep?: string[] }): Promise<{ valid: boolean; values: any; result?: unknown; serverErrors?: Record<string, string | string[]>; missed?: string[] }>;

/** Re-checks a control when a field that its equalTo / notEqualTo rule looks at changes. `group` is a FormGroup. Returns a function that stops watching. */
export declare function fvWatch(group: { get(path: string): any }, schema: Record<string, RulesForField>): () => void;

/** A validator for a whole FormGroup: every field of the schema at once. */
export declare function fvGroupValidator(schema: Record<string, RulesForField>, options?: FvOptions): (group: ControlLike) => FvGroupErrors | null;

/** The message of the first failed rule of a control ('' when valid). */
export declare function fvMessage(control: ControlLike | null | undefined): string;

declare const _default: { fvValidator: typeof fvValidator; fvControls: typeof fvControls; fvGroupValidator: typeof fvGroupValidator; fvMessage: typeof fvMessage; fvText: typeof fvText; fvWatch: typeof fvWatch; fvValues: typeof fvValues; fvSetErrors: typeof fvSetErrors; fvSubmit: typeof fvSubmit };
export default _default;
