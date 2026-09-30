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
