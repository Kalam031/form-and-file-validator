// Test helpers: `import { fillAndSubmit, expectError, fakeFetch } from 'form-and-file-validator/testing'`
export type FormRef = HTMLFormElement | string;
export declare function fill(form: FormRef, values: Record<string, unknown>, options?: { change?: boolean }): void;
export declare function settle(form: FormRef, options?: { timeout?: number; delay?: number }): Promise<void>;
export declare function submit(form: FormRef, options?: { button?: string | HTMLElement; timeout?: number; delay?: number }): Promise<Record<string, string>>;
export declare function fillAndSubmit(form: FormRef, values: Record<string, unknown>, options?: { button?: string | HTMLElement; change?: boolean }): Promise<Record<string, string>>;
/** { fieldName: message } for every message that shows now. */
export declare function errors(form: FormRef): Record<string, string>;
export declare function expectError(form: FormRef, name: string, matcher?: string | RegExp): string;
export declare function expectNoError(form: FormRef, name: string): void;
export declare function expectValid(form: FormRef): void;
export declare function expectInvalid(form: FormRef, names?: string | string[]): void;
export interface FakeRequest { method: string; url: string; path: string; query: Record<string, string>; body: any; headers: Record<string, string> }
export type FakeAnswer = { status?: number; json?: unknown; text?: string; headers?: Record<string, string>; delay?: number };
export declare function fakeFetch(routes: Record<string, FakeAnswer | ((req: FakeRequest) => FakeAnswer | Promise<FakeAnswer>)>): ((url: string, init?: any) => Promise<any>) & { calls: FakeRequest[] };
export declare const version: string;
