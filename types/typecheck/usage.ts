// Compile-time check of the typings: `npm run test:types` (tsc --noEmit, strict). This file is never run.
import FormValidatorDefault, { FormValidator, FileValidator, useJQuery, versions } from '../index';
import type {
    FormInstance, InitOptions, RuleObject, ValidationResult, FileValidatorConfig, WidgetController, WidgetOptions, AddResult, CheckContext, ErrorCode
} from '../index';
import '../jquery-validate';

// ---------------------------------------------------------------- FormValidator
const inst: FormInstance = FormValidator.init({
    formId: 'signup',
    rules: {
        email: ['required', 'email'],
        password: ['required', { type: 'pwcheck', minLength: 8, requireDigit: true, message: 'Use 8+ characters with a digit.' }],
        confirm: [{ type: 'equalTo', target: 'password', message: (field, rule, env) => `${field.tagName} ${rule.type} ${env.count}` }],
        terms: { type: 'required', message: 'Please accept the terms.' },
        // jQuery-style rule maps
        age: { required: true, range: [18, 99], minlength: 2, messages: { range: 'Between {0} and {1}' } },
        cv: ['required', { type: 'file', accept: '.pdf', maxFileSizeMB: 5 }],
        user: { remote: { url: '/check', type: 'post', data: { token: () => 'x' } } }
    },
    config: {
        focusInvalid: true, validateOn: ['change', 'blur'], debounce: 150, pendingClass: 'busy',
        submitHandler: (form, event) => { form.reset(); event.preventDefault(); },
        onError: errors => errors.forEach(e => console.log(e.name, e.message, e.field.id)),
        errorPlacement: (errorEl, field) => field.after(errorEl)
    },
    messages: { email: { required: 'We need your email' }, required: 'Required.' }
});
const ok: Promise<boolean> = inst.validate({ focus: false });
const okSync: boolean = inst.validateSync();
inst.addRules('coupon', ['required', { type: 'pattern', pattern: /^[A-Z0-9]{6}$/ }]);
inst.setError('email', 'Taken');
inst.getErrors().forEach(e => e.el.hidden = true);
inst.destroy();

const many: FormInstance[] = FormValidator.init({ formId: ['a', 'b'], rules: {} });

FormValidator.addMethod('multipleOf', function (value, element, param) { return this.optional(element) || Number(value) % param === 0; }, FormValidator.format('Multiples of {0} only'));
FormValidator.addMethod('between', (value, element, param: [number, number]) => Number(value) >= param[0], (param, element) => `Between ${param[0]} and ${param[1]} for ${element.id}`);
FormValidator.registerRule('even', (value, rule: RuleObject, env) => Number(value) % 2 === 0 || { valid: false, message: 'Even only' }, { runOnEmpty: false });
FormValidator.addClassRules('zip', { required: true, digits: true, minlength: 5 });
FormValidator.setDefaults({ errorClass: 'bad' });
FormValidator.messages.required = 'Pflichtfeld';
FormValidator.remoteDefaults.method = 'POST';
const formatted: string = FormValidator.format('{0}-{1}', 'a', 'b');
const fn: (...p: unknown[]) => string = FormValidator.format('Hi {0}');
const initOpts: InitOptions = { form: document.forms[0], rules: {} };
void [ok, okSync, many, formatted, fn, initOpts];

// ---------------------------------------------------------------- FileValidator
const cfg: FileValidatorConfig = {
    accept: '.pdf,.png', maxFileSizeMB: 5, maxFiles: 3, maxImageWidth: 4000, aspectRatio: '16:9',
    documents: { blockPdfJavaScript: false, maxUncompressedMB: 500 },
    scan: async (file: File, ctx: CheckContext) => (ctx.ext === '.exe' ? { valid: false, threat: 'Trojan' } : true),
    remote: { url: '/api/check', send: 'hash', method: 'POST', failOpen: true },
    custom: { noSpaces: f => !f.name.includes(' ') || 'No spaces' },
    methods: { maxLines: 100 },
    messages: { SIZE_TOO_LARGE: 'Max is {max}', EMPTY_FILE: p => 'Empty ' + String(p.name) },
    mimeByExtension: { '.dxf': ['application/dxf'] },
    ignoreFiles: true, maxPathDepth: 3, duplicateContent: true, maxDurationSec: 600,
    categories: { video: { maxFileSizeMB: 200 } }
};

async function files(input: HTMLInputElement): Promise<void> {
    const result: ValidationResult = await FileValidator.validateFiles(input.files, cfg);
    if (!result.isValid) {
        const code: string = result.errors[0];
        const lines: string[] = FileValidator.summary(result);
        const first = result.details[0];
        console.log(code, lines, first.fileName, first.message, first.params.max, result.ignored.length, result.files[0].isValid);
    }
    const single = await FileValidator.validateFile(new File(['x'], 'a.txt'), {});
    const known: ErrorCode = 'SIZE_TOO_LARGE';
    void [single.isValid, known];
}

const stop: () => void = FileValidator.bind('#cv', cfg, { messageElement: '#msg', clearOnInvalid: true, onResult: (r, input) => console.log(r.isValid, input.id) });
FileValidator.addMethod('maxLines', async function (file, param: number, ctx) { return (await file.text()).split('\n').length <= param && ctx.category === 'file'; }, 'At most {0} lines');
FileValidator.addExtension('.dxf', 'application/dxf');
FileValidator.setDefaults({ maxFileSizeMB: 10 });
const mimes: string[] = FileValidator.getMimeTypes('.pdf');
const hash: Promise<string | null> = FileValidator.hashFile(new File(['abc'], 'a.txt'));
const dangerous: string[] = FileValidator.constants.DEFAULT_DANGEROUS_EXTENSIONS;
void [stop, mimes, hash, dangerous, files];

// ---------------------------------------------------------------- upload widget
const widgetOptions: WidgetOptions = {
    list: '#list', messageElement: '#errors', statusElement: '#status', preview: { maxWidth: 120 }, resize: { maxWidth: 1600, maxSizeMB: 1 }, paste: 'document', folder: true,
    onChange: (fs, entries) => console.log(fs.length, entries[0]?.path),
    onReject: rejected => rejected.forEach(r => console.log(r.file.name, r.messages)),
    renderItem: (entry, helpers) => { const li = document.createElement('li'); li.textContent = entry.file.name + helpers.formatBytes(entry.file.size); return li; }
};
const zone: WidgetController = FileValidator.widget('#zone', cfg, widgetOptions);
async function use(z: WidgetController): Promise<void> {
    const res: AddResult = await z.add([new File(['x'], 'a.txt')], { source: 'api' });
    console.log(res.accepted.length, res.rejected[0]?.errors);
    z.remove(0); z.remove(z.entries[0]); z.clear();
    const full = await z.validate();
    const fd: FormData = z.appendTo(new FormData(), 'files');
    void [full.isValid, fd, z.files.length, z.element, z.input];
    z.destroy();
}
async function helpers(dt: DataTransfer, cb: DataTransfer): Promise<void> {
    const dropped: File[] = await FileValidator.filesFromDrop(dt, { maxFiles: 100 });
    const pasted: File[] = FileValidator.filesFromClipboard(cb);
    const smaller: File = await FileValidator.resizeImage(dropped[0], { maxWidth: 800 });
    const preview = await FileValidator.createPreview(smaller);
    preview.revoke();
    void pasted;
}
void [zone, use, helpers];

// ---------------------------------------------------------------- module surface
const v: string = versions.formValidator;
const same: boolean = FormValidatorDefault.FormValidator === FormValidator && typeof useJQuery === 'function';
void [v, same];

// ---------------------------------------------------------------- the jQuery layer
$.validator.addMethod('even', function (value, element, param) { return this.optional(element) || value % 2 === 0; }, 'Even numbers only');
$.validator.addClassRules('zip', { required: true, digits: true });
$.validator.messages.required = 'Pflichtfeld';
const validator = $('#signup').validate({
    rules: { email: { required: true, email: true }, avatar: { fileValidator: { accept: '.png', maxFileSizeMB: 2 } } },
    messages: { email: { required: 'We need your email' } },
    groups: { name: 'first last' },
    errorPlacement: (error, element) => { error.insertAfter(element); },
    highlight: (element, errorClass) => { element.classList.add(errorClass); },
    submitHandler: form => { form.submit(); },
    showErrors: function (map, list) { console.log(Object.keys(map).length, list.length); this.defaultShowErrors(); }
});
const isValid: boolean = $('#email').valid();
$('#email').rules('add', { minlength: 3, messages: { minlength: 'Too short' } });
const removed = $('#email').rules('remove', 'minlength');
void [validator.numberOfInvalids(), validator.errorMap, isValid, removed];

// ---------------------------------------------------------------- these must NOT compile
// @ts-expect-error unknown option name
const bad1: FileValidatorConfig = { maxFileSzieMB: 5 };
// @ts-expect-error validateOn only accepts change | blur | input
FormValidator.init({ formId: 'x', rules: {}, config: { validateOn: ['click'] } });
// @ts-expect-error a widget needs a target
FileValidator.widget();
void bad1;


// ---- language packs
import { locales } from '../index';
const info = locales.use('de', { document: true });
const dirValue: 'ltr' | 'rtl' = info.dir;
locales.register('sv', { name: 'Svenska', form: { required: 'Fältet är obligatoriskt.' } });
locales.auto('en');
// @ts-expect-error a pack's dir is ltr or rtl
locales.register('xx', { dir: 'up' });
void dirValue;

// ---- server companion
import { middleware, validate } from "../server";
const mw = middleware({ allowedExtensions: [".png"], maxFileSizeMB: 2 }, { status: 400 });
mw({}, {}, () => undefined);
validate([], { maxFiles: 1 }).then(r => { const ok: boolean = r.isValid; void ok; });

// ---- framework bindings
import { useFormValidator as useReactForm, FileDropzone as ReactDropzone } from '../react';
import { useFormValidator as useVueForm } from '../vue';
const reactHook: typeof useReactForm = useReactForm;
const vueHook: typeof useVueForm = useVueForm;
const dz: typeof ReactDropzone = ReactDropzone;
void reactHook; void vueHook; void dz;

// value-only checks (no DOM) and date formats
const one = FormValidator.checkValue('31/04/2024', [{ type: 'required' }, { type: 'date', format: 'd/M/y' }]);
const oneValid: boolean = one.valid;
const oneRule: string | null = one.rule;
const manyChecked = FormValidator.checkValues({ a: '1' }, { a: { required: true, date: { format: 'yyyy-MM-dd' } } }, { messages: { required: 'Pflichtfeld' } });
const manyMessage: string | undefined = manyChecked.errors['a'];
void oneValid; void oneRule; void manyMessage;

// Angular: our validators must be accepted wherever Angular wants a ValidatorFn
import { FormControl, FormGroup, FormBuilder, type ValidatorFn } from '@angular/forms';
import { fvValidator, fvControls, fvGroupValidator, fvMessage, fvWatch } from '../angular';
const ngValidator: ValidatorFn = fvValidator(['required', { type: 'date', format: 'd/M/y' }], { messages: { required: 'Pflichtfeld' } });
const ngControl = new FormControl('', ngValidator);
const ngGroup = new FormGroup({ pw: new FormControl(''), pw2: new FormControl('', fvValidator({ equalTo: 'pw' })) }, { validators: fvGroupValidator({ pw: ['required'] }) });
const ngBuilt = new FormBuilder().group(fvControls({ email: ['required', 'email'] }, { email: 'a@b.co' }));
const ngMessage: string = fvMessage(ngControl);
const ngStop: () => void = fvWatch(ngGroup, { pw2: { equalTo: 'pw' } });
void ngBuilt; void ngMessage; void ngStop;

// submitting: direct, AJAX, validated values (every framework), and the same for files
const formEl = document.createElement('form');
const okNow: boolean = FormValidator.isValid(formEl);
const submitInst = FormValidator.init({ form: formEl, rules: { email: ['required', 'email'] }, config: {
    onSubmit: async (values, event, instance) => { const email: string | string[] | File[] = values['email']; void email; void event; void instance; return { errors: { email: 'Already registered' } }; },
    submitHandler: (form, event, values) => { void form; void event; void values; }
} });
const gotValues = submitInst.getValues();
const handler: (event?: Event) => Promise<{ valid: boolean }> = submitInst.handleSubmit(async values => { void values; });
const missedNames: string[] = submitInst.setErrors({ email: 'Taken' });
submitInst.validateAndGetValues().then(r => { const sent: boolean = r.valid; void sent; });
void okNow; void gotValues; void handler; void missedNames;

const fileOk: Promise<boolean> = FileValidator.isValid('#cv', { accept: '.pdf' });
const fileGuard = FileValidator.guard('#cv', { accept: '.pdf' }, { messageElement: '#msg', onSubmit: (files, formData, event) => { void files; void formData; void event; return { errors: 'Refused' }; } });
fileGuard.validate().then(v => { const fine: boolean = v; void fine; });
fileGuard.unbind();
void fileOk;

// ---------------------------------------------------------------- schema: Standard Schema, typed values and errors
import type { StandardSchemaV1 as OfficialStandardSchema } from '@standard-schema/spec';
import type { InferInput, InferOutput, InferErrors, SafeParseResult, ValidationError } from '../index';

type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const signupSchema = FormValidator.schema({
    email: ['required', 'email'],
    nick: { minlength: 3 },
    pw: { required: true, pwcheck: { minLength: 8 } },
    code: [{ type: 'required' }, 'digits'],
    maybe: { required: false, email: true },
    conditional: { required: (el: HTMLElement) => !!el },
});
type SignupIn = InferInput<typeof signupSchema>;
const inputShape: Mutual<SignupIn, { email: string; pw: string; code: string } & { nick?: string; maybe?: string; conditional?: string }> = true;
const outputShape: Mutual<InferOutput<typeof signupSchema>, { email: string; nick: string; pw: string; code: string; maybe: string; conditional: string }> = true;
const errorShape: Mutual<InferErrors<typeof signupSchema>, { email?: string; nick?: string; pw?: string; code?: string; maybe?: string; conditional?: string }> = true;
void inputShape; void outputShape; void errorShape;

const parsed = signupSchema.safeParse({ email: 'a@b.co' });
if (parsed.success) { const e: string = parsed.data.email; void e; } else { const m: string | undefined = parsed.errors.email; const first: string = parsed.issues[0].message; void m; void first; }
const typedResult: SafeParseResult<typeof signupSchema.rules> = parsed;
void typedResult;
try { const values: { email: string } = signupSchema.parse({}); void values; } catch (e) { const ve = e as ValidationError; const all: Record<string, string> = ve.errors; void all; }
// @ts-expect-error a field that is not in the rules
const nope = parsed.success ? parsed.data.unknownField : undefined;
void nope;

// the very interface the specification publishes accepts our schema
const official: OfficialStandardSchema<SignupIn, InferOutput<typeof signupSchema>> = signupSchema;
const verdict = official['~standard'].validate({});
void verdict;

// ---------------------------------------------------------------- server errors, precognition, action
{
    const parsed = FormValidator.serverErrors({ errors: { email: ['Taken'] } }, { format: 'laravel' });
    const first: string | undefined = parsed.errors.email;
    const msgs: string[] = parsed.form;
    const pc = FormValidator.precognition('/check', { email: 'a@b.co' }, { only: ['email'], method: 'POST', timeout: 5000 });
    pc.then(r => { const v: boolean | null = r.valid; const e: Record<string, string> = r.errors; return [v, e]; });
    const shown = inst.setServerErrors({ title: 'x' }, { clear: true });
    const missed: string[] = shown.missed;
    inst.validateOnServer('/check', { only: ['email'] }).then(r => r.valid);
    const stop: () => void = inst.watchServer({ url: '/check', delay: 100, exclude: ['pw'] });
    inst.clearServerErrors();

    const act = FormValidator.action({ email: ['required', 'email'], nick: { minlength: 3 } }, async (values, formData) => {
        const e: string = values.email;
        const f: FormData = formData;
        return { id: 1 as number, e, f };
    });
    const init = act.initialState;
    const ok: boolean = init.ok;
    act(init, new FormData()).then(state => {
        const emailError: string | undefined = state.errors.email;
        const typed: string | undefined = state.values.email;
        const id: number | undefined = state.result?.id;
        // @ts-expect-error a misspelt field is not a key of the values
        state.values.emial;
        return [emailError, typed, id];
    });
    void [first, msgs, missed, stop];
}

// ---------------------------------------------------------------- validateOn presets, error codes, summary, autoAttributes
{
    const i2 = FormValidator.init({
        formId: 'x',
        rules: { email: [{ type: 'email', code: 'mail.bad' }] },
        config: { validateOn: 'blur', validClass: 'is-valid', errorSummary: { title: 'Fix these', headingLevel: 3, focus: 'field' }, autoAttributes: { lint: false } }
    });
    FormValidator.init({ formId: 'y', rules: {}, config: { validateOn: ['change', 'input'], errorSummary: true, autoAttributes: true } });
    const codes: Array<string | undefined> = i2.getErrors().map(e => e.code);
    const lint = i2.lint().map(l => l.code);
    const box: HTMLElement | null = i2.showSummary(true);
    i2.setError('email', 'Taken', 'email.taken');
    const c: string | null = FormValidator.checkValue('x', ['email']).code;
    void [codes, lint, box, c];
}

// ---------------------------------------------------------------- ASP.NET unobtrusive
{
    FormValidator.unobtrusive.adapters
        .addBool('even')
        .addSingleVal('multipleof', 'by')
        .addMinMax('between', 'atleast', 'atmost', 'range')
        .add('startsx', ['prefix'], o => { o.rules.startswithx = { prefix: o.params.prefix }; o.messages.startswithx = o.message; });
    const instances: FormInstance[] = FormValidator.unobtrusive.parse('#modal', { focusInvalid: false });
    const stopAuto: () => void = FormValidator.unobtrusive.auto();
    FormValidator.init({ formId: 'f', rules: {}, config: { unobtrusive: true } });
    $.validator.unobtrusive.parse(document);
    $.validator.unobtrusive.adapters.addBool('x');
    void [instances, stopAuto];
}

// ---------------------------------------------------------------- <fv-field>
{
    const field = document.querySelector('fv-field');
    if (field) {
        field.rules = { required: true, minlength: 3 };
        const ok: boolean = field.reportValidity();
        const c: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = field.control;
        field.addEventListener('fv-validate', e => { const m: string = e.detail.message; void m; });
        void [ok, c];
    }
    FormValidator.fieldElement?.define('my-field');
}

// ---------------------------------------------------------------- field arrays
{
    const order = FormValidator.schema({ title: 'required', 'items[].sku': ['required', { type: 'unique', ignoreCase: true }], items: { minItems: 1 } });
    const r = order.safeParse({});
    if (!r.success) { const e: string | undefined = r.errors['items[0].sku']; const p: ReadonlyArray<string | number> = r.issues[0].path; void [e, p]; }
    else { const t: any = r.data.items; void t; }
    FormValidator.checkValues({}, { 'user.email': 'required', 'rows[].x': { unique: true } });
}

// ---------------------------------------------------------------- core (no DOM)
import { checkValue as coreCheck, schema as coreSchema, FormValidator as CoreFV } from '../core';
{
    const r = coreCheck('x', ['required', 'email']);
    const ok: boolean = r.valid;
    const s = coreSchema({ email: ['required', 'email'] });
    const parsed = s.safeParse({});
    const names: string[] = CoreFV.ruleNames();
    // @ts-expect-error the core has no form engine
    CoreFV.init;
    void [ok, parsed, names];
}

// ---------------------------------------------------------------- Svelte, Lit, Solid
import { createFormValidator as svelteFv, fvForm } from '../svelte';
import { createFormValidator as solidFv } from '../solid';
import { FvFormController } from '../lit';
{
    const sv = svelteFv({ rules: { email: ['required', 'email'] } });
    sv.errors.subscribe(list => { const n: string | undefined = list[0]?.message; void n; });
    const pending: Promise<boolean> = sv.validate();
    const act = fvForm(document.createElement('form'), { rules: {} });
    act.destroy();
    const so = solidFv({ rules: {} });
    const errs: string[] = so.errors().map(e => e.name);
    const v: boolean | null = so.valid();
    void [pending, errs, v, FvFormController];
}

// ---------------------------------------------------------------- state, steps, explain
{
    const fi = FormValidator.init({ formId: 'w', rules: { a: { requiredIf: { field: 'b', equals: 'x' } }, c: { dateAfter: 'd' }, e: { atLeastOne: ['f'] }, g: { sumEquals: { fields: ['h'], total: 100 } } } });
    const st = fi.state;
    const dirty: boolean = st.fields.a.dirty;
    const stop: () => void = fi.onStateChange(s => { const n: number = s.submitCount; void n; });
    const step: Promise<boolean> = fi.validateStep('#step1');
    const why = FormValidator.explain('x', ['required', 'email']).map(e => e.passed);
    void [dirty, stop, step, why];
}

// ---------------------------------------------------------------- upload security
{
    const safe: string = FileValidator.safeName('../a.php.jpg', { maxLength: 80, ascii: true, dots: 'replace' });
    FileValidator.detect(new File([], 'a')).then(d => { const t: string | undefined = d?.type; void t; });
    const cfg: FileValidatorConfig = { polyglot: 'all', polyglotScanKB: 512 };
    void [safe, cfg];
}

// ---------------------------------------------------------------- passwords
{
    const st = FormValidator.passwordStrength('x', { userInputs: ['bob'] });
    const sc: 0 | 1 | 2 | 3 | 4 = st.score;
    FormValidator.pwned('x').then(c => { const n: number | null = c; void n; });
    const stop: () => void = FormValidator.watchPasswordStrength(document.createElement('input'), r => { const l: string = r.label; void l; });
    void [sc, stop];
}

// ---------------------------------------------------------------- masks, declarative
{
    const m = FormValidator.mask(document.createElement('input'), '(999) 999-9999', { onComplete: (v, raw) => void [v, raw] });
    const done: boolean = m.complete;
    const rx: RegExp = FormValidator.maskPattern('99');
    const raw: string = FormValidator.unmaskValue('(1)', '(9)');
    const rules = FormValidator.parseRules('required email');
    const stop: () => void = FormValidator.auto({ validClass: 'ok' });
    void [done, rx, raw, rules, stop];
}

// ---------------------------------------------------------------- protections
{
    const pi = FormValidator.init({ formId: 'p', rules: {}, config: { antiBot: { honeypot: 'website_url', minTime: 1500, onBot: r => void r }, idempotencyKey: { header: 'X-Idem' }, disableOnSubmit: true, draft: { exclude: ['x'], storage: 'local' }, leaveWarning: 'Sure?' } });
    const k: string | null = pi.idempotencyKey();
    const reason: 'honeypot' | 'too-fast' | null = pi.botReason();
    const verdict = FormValidator.isBotSubmission({}, { honeypot: false, minTimeMs: 1000 });
    pi.markSaved();
    void [k, reason, verdict.bot];
}

// ---------------------------------------------------------------- upload
{
    const task = FileValidator.upload(new File([], 'a.bin'), {
        url: '/upload', fields: { a: 'b' }, onProgress: p => { const n: number = p.percent; void n; }, retries: 2,
        tus: { endpoint: '/files', chunkSize: 1024 * 1024, metadata: { owner: 'x' } }
    });
    task.pause(); task.resume(); task.abort();
    task.then(r => { const s: number = r.status; void s; }).catch((e: unknown) => { if (e instanceof FileValidator.UploadError) { const c: string = e.code; void c; } });
    FileValidator.upload(new File([], 'b'), { presign: async f => ({ url: '/u/' + (f as File).name, method: 'PUT' }) });
}

// ---------------------------------------------------------------- JSON Schema
{
    const js: Record<string, any> = FormValidator.toJsonSchema({ a: 'required' }, { title: 'T', additionalProperties: false });
    const rules = FormValidator.fromJsonSchema(js, { onUnsupported: (p, k) => void [p, k] });
    void [js, rules];
}
