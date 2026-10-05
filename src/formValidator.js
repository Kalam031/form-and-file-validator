/*!
 * FormValidator v2.14.0 — dependency-free form validation (jQuery / Select2 / Bootstrap are optional).
 *
 * Changelog
 *   2.14.0 Field arrays and nested data: path keys ('user.email', 'items[0].qty') and wildcards ('items[].qty') in checkValues / schema / forms; rules unique, minItems, maxItems;
 *          schema output is nested like the input; ValidationError.errors are keyed by the concrete path.
 *   2.13.0 ASP.NET unobtrusive validation: `unobtrusive: true` reads data-val-* (required, length, range, regex, equalto, remote, email, url, ... + custom adapters),
 *          data-valmsg-for / data-valmsg-summary and the field-validation-* / input-validation-* classes. FormValidator.unobtrusive.parse() / auto() / adapters.
 *   2.12.0 validateOn presets ('smart' | 'blur' | 'input' | 'submit' | 'all'; an 'input' entry now works) + validClass reward while typing. Stable error codes (data-code, code in getErrors / checkValue /
 *          schema issues, rule.code). errorSummary: accessible list of problems with links and focus. autoAttributes (type / inputmode / autocomplete / aria-required) + inst.lint().
 *   2.11.0 FormValidator.serverErrors(body): problem+json, ASP.NET, Laravel/Rails, Django REST, FastAPI, Zod, JSON:API, express-validator, Ajv in one shape; inst.setServerErrors();
 *          setErrors() matches items.0.qty to items[0].qty. precognition(url, values) / inst.validateOnServer() / inst.watchServer(): ask the real endpoint (Laravel Precognition protocol).
 *          FormValidator.action(rules, serverFn): one function for React 19 useActionState, Server Actions and FormData handlers.
 *   2.10.0 FormValidator.parseFormData(formData, { coerce }): flat fields (a.b[0].c, tags[], repeated names) -> the nested object a schema expects, safe against __proto__ keys and huge indexes.
 *          FormValidator.ruleNames(). A fuzz test (tests/redos.test.js) now guards every rule against catastrophic regex backtracking.
 *   2.9.0  FormValidator.schema(rules): the rules of an object as a Standard Schema (parse, safeParse, ~standard.validate, typed values and errors in TypeScript).
 *   2.8.0  19 new rules: integer, uuid, hexColor, slug, ipv4, ipv6, iban, time, domain, base64, mac, latitude, longitude, startsWith, endsWith, contains, notOneOf, minWords, maxWords
 *          (ASCII-exact, the same answers in .NET; messages in every language pack).
 *   2.7.0  Dates with a named format (date / minDate / maxDate: `format`, `strict`); checkValue() / checkValues() without a DOM; url rule independent of the browser's URL parser;
 *          pwcheck counts capital letters, small letters, digits and symbols of every script; min / max / range / step take plain decimals only.
 *   2.6.0  Error messages get dir="auto", so right-to-left text (Arabic, Hebrew) reads correctly inside a left-to-right page and the other way round.
 *   2.5.3  Hardening: a CSS selector that is not valid (equalTo: '[1,2]') no longer throws, and an error thrown by one of your callbacks
 *          (when, message, resolveMessage, normalizer, errorPlacement, highlight, ...) is logged and ignored instead of aborting the validation.
 *   2.5.2  Hardening: options of the wrong type (an array as errorElement, a string as submitHandler, an invalid CSS selector as ignore ...)
 *          fall back to the defaults instead of crashing when an error is shown.
 *   2.5.1  Fix found in real browsers: validation that runs because a field lost focus no longer changes the page (adds or removes
 *          messages) while a mouse button or finger is still down. Before, the message removal moved the page under the pointer and the
 *          click landed on the wrong element (for example a radio button was not selected).
 *   2.5.0  `remote` now defaults to GET (value in the query string), like jQuery Validation. POST is one option away: `method: 'POST'`
 *          per rule (JSON body, or `encoding: 'form'`), or globally with FormValidator.remoteDefaults.method = 'POST'.
 *   2.4.0  jQuery-Validation-style API on the native engine: FormValidator.addMethod(name, fn(value, element, param), message),
 *          scalar rule parameters ({ minlength: 3, range: [1, 5], equalTo: '#pw', remote: '/check' }), `depends`, `normalizer`,
 *          class rules (addClassRules / config.classRules), data-rule-* attributes, per-field `messages`, {0}/{1} placeholders,
 *          FormValidator.format / setDefaults, remote shorthand (`type`, function-valued `data`, `dataFilter`), a `pending` class
 *          while a server check runs (aria-busy), and `focusCleanup`.
 *   2.3.0  data-msg-<rule> and data-msg attributes set messages straight in the HTML (same idea as jQuery Validation):
 *          <input name="name" required data-msg-required="Please tell us your name">
 *   2.2.0  Engine additions for the jQuery Validation compatibility layer (formValidator.jquery.js): synchronous validation
 *          (validateSync), highlight/unhighlight/onFieldValid hooks, setError/getErrors/resetForm, skipEmptyUntilSubmit and
 *          validateAfterSubmit, per-field rule hook (fieldRules), equalTo by selector, form-encoded remote requests.
 *   2.1.0  Event delegation (fields added later just work), live re-check of "confirm" fields, type=number bad-input handling,
 *          `formnovalidate` buttons skip validation, `autoRules` (reads required/pattern/min/max/... attributes),
 *          `fv:valid` / `fv:invalid` DOM events, friendlier number rule.
 *   2.0.0  Rewrite: submit actually blocked, optional fields, no jQuery dependency, a11y, remote rule, file rule, registerRule, UMD.
 *   1.0.0  Original version (see _original_backup/).
 *
 * Works as a <script> (window.FormValidator), CommonJS, AMD or via a bundler.
 *
 *   FormValidator.init({
 *       formId: 'signup',                        // id, selector, element, or an array of those
 *       rules: {
 *           email:    [{ type: 'required', message: 'Email is required' }, { type: 'email' }],
 *           password: [{ type: 'pwcheck', minLength: 8, requireDigit: true }],
 *           confirm:  [{ type: 'equalTo', target: 'password' }],
 *           avatar:   [{ type: 'file', allowedExtensions: ['.png', '.jpg'], maxFileSizeMB: 2 }],   // uses FileValidator
 *           username: [{ type: 'remote', url: '/api/check-username' }],
 *       },
 *       config: { validateOn: ['change'], focusInvalid: true, submitHandler(form) { ajaxSubmit(form); } },
 *   });
 *
 * Non-required rules are skipped for empty values, so optional fields may stay blank.
 * Rule shorthands: 'required'  |  { required: true, email: { message: '...' } }.
 * Extra rules: FormValidator.registerRule('name', (value, rule, env) => boolean | string | {valid, message} | Promise).
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define([], function () { return factory(root); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root);
    else root.FormValidator = factory(root);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
    'use strict';

    // ------------------------------------------------------------------ defaults
    const DEFAULT_MESSAGES = {
        required: 'This field is required.',
        email: 'Please enter a valid email address.',
        url: 'Please enter a valid URL.',
        number: 'Please enter a valid number.',
        digits: 'Please enter digits only.',
        alpha: 'Please use letters only.',
        alphanumeric: 'Please use letters and numbers only.',
        phone: 'Please enter a valid phone number.',
        date: 'Please enter a valid date.',
        minDate: 'Date must be on or after {min}.',
        maxDate: 'Date must be on or before {max}.',
        creditcard: 'Please enter a valid card number.',
        pattern: 'Invalid format.',
        maxlength: 'Please enter no more than {max} characters.',
        minlength: 'Please enter at least {min} characters.',
        rangelength: 'Please enter between {min} and {max} characters.',
        range: 'Please enter a value between {min} and {max}.',
        max: 'Please enter a value no greater than {max}.',
        min: 'Please enter a value no less than {min}.',
        step: 'Please enter a multiple of {step}.',
        oneOf: 'Please choose a valid option.',
        notOneOf: 'This value is not allowed.',
        integer: 'Please enter a whole number.',
        uuid: 'Please enter a valid UUID.',
        hexColor: 'Please enter a valid hex color, like #1a2b3c.',
        slug: 'Use lowercase letters, numbers and single hyphens only.',
        ipv4: 'Please enter a valid IPv4 address.',
        ipv6: 'Please enter a valid IPv6 address.',
        iban: 'Please enter a valid IBAN.',
        time: 'Please enter a valid time (HH:mm).',
        domain: 'Please enter a valid domain name.',
        base64: 'Please enter valid Base64 text.',
        mac: 'Please enter a valid MAC address.',
        latitude: 'Please enter a latitude between -90 and 90.',
        longitude: 'Please enter a longitude between -180 and 180.',
        startsWith: 'Must start with {value}.',
        endsWith: 'Must end with {value}.',
        contains: 'Must contain {value}.',
        minWords: 'Please enter at least {min} words.',
        maxWords: 'Please enter no more than {max} words.',
        unique: 'This value is used more than once.',
        minItems: 'Please add at least {min}.',
        maxItems: 'Please add no more than {max}.',
        notEqualTo: 'This value is not allowed.',
        equalTo: 'Values do not match.',
        pwcheck: 'Password does not meet the requirements.',
        minChecked: 'Please select at least {min}.',
        maxChecked: 'Please select no more than {max}.',
        minFiles: 'Please select at least {min} file(s).',
        maxFiles: 'Please select no more than {max} file(s).',
        fileType: 'This file type is not allowed.',
        fileSize: 'A file is too large.',
        file: 'Invalid file.',
        remote: 'Please fix this field.',
        badInput: 'Please enter a valid value.',
        errorSummary: 'Please fix the following:',
        custom: 'Invalid value.'
    };

    const DEFAULTS = {
        trim: true,                       // trim values (never trims type=password)
        novalidate: true,                 // set form.noValidate so native bubbles don't fight ours
        focusInvalid: true,               // focus + scroll to the first invalid field on submit
        validateHidden: false,            // also validate fields that are not rendered / type=hidden
        ignore: null,                     // CSS selector of fields to skip
        validateOn: ['change'],           // when a not-yet-invalid field is checked: a preset ('smart' = after the user leaves an edited field, then live while it is invalid; 'blur'; 'input'; 'submit'; 'all') or a list of events ('blur', 'change', 'input')
        debounce: 150,                    // ms, for 'input' revalidation
        errorElement: 'div',
        errorClass: 'text-danger error',  // class(es) for the message element
        invalidClass: 'is-invalid',       // class(es) added to invalid fields ('' to disable)
        messages: {},                     // per-instance message overrides by rule type
        passwordStrength: {},             // defaults for the pwcheck rule
        errorPlacement: null,             // (errorEl, field, fields) => void
        onError: null,                    // (errors[{name, field, message}]) on failed submit / validate()
        onSuccess: null,                  // () on successful submit / validate()
        submitHandler: null,              // (form, event) => void — called instead of native submit when valid
        autoRules: false,                 // also derive rules from HTML attributes (required, type, min, max, minlength, maxlength, pattern, accept)
        skipEmptyUntilSubmit: false,      // do not validate empty fields on blur/change until the first submit attempt
        validateAfterSubmit: false,       // after the first submit attempt, re-check every field as the user types
        highlight: null,                  // (field, unit) => void, called when a field becomes invalid
        unhighlight: null,                // (field, unit) => void, called when a field is cleared
        onFieldValid: null,               // (field, unit) => void, after a field was checked and is valid
        fieldRules: null,                 // (field, unit) => rules[] : extra rules per field, evaluated at validation time
        interceptSubmit: true,            // false: do not touch the form's submit event (validate manually)
        liveInput: true,                  // false: never re-check while typing (only on change/blur)
        skipSubmitter: null,              // CSS selector of submit buttons that skip validation (like formnovalidate)
        resolveMessage: null,             // (rule, env, dynamicMessage) => string | falsy : take over message selection
        pendingClass: 'fv-pending',       // class (and aria-busy) on a field while a server/async check runs; '' to disable
        focusCleanup: false,              // clear a field's error when it receives focus
        classRules: null,                 // { className: rules } applied to fields that carry the class
        validClass: '',                   // class for a field that was checked and holds a valid value ('is-valid'); while typing it appears as soon as the value becomes valid, an error never does
        rewardOnInput: true,              // false: validClass only after a real check, not while typing
        errorSummary: false,              // true | selector | element | { container, title, focus: 'summary' | 'field', withLabel, headingLevel, className }: an accessible list of all problems with links to the fields
        unobtrusive: false,               // read ASP.NET data-val-* attributes (MVC / Razor), use data-valmsg-for / data-valmsg-summary and the field-validation-* classes; see FormValidator.unobtrusive
        autoAttributes: false             // true | { type, inputmode, autocomplete, ariaRequired, lint }: set type / inputmode / autocomplete / aria-required from the rules and field names, and warn about autocomplete="off" and type="number" misuse
    };

    const GROUP_CONTAINERS = '.answer, .btn-group, .option-group, .choice-group, .checkbox-group';
    let uid = 0;

    // ------------------------------------------------------------------ helpers
    const esc = s => (root.CSS && root.CSS.escape) ? root.CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
    const isFn = f => typeof f === 'function';
    /** Runs one of YOUR callbacks. If it throws, the error is logged and `fallback` is used, so a bug there cannot block the form. */
    function guard(fn, fallback) {
        try { return fn.apply(null, Array.prototype.slice.call(arguments, 2)); }
        catch (e) { if (root.console) console.error('FormValidator: an error in your callback was ignored:', e); return fallback; }
    }
    /** querySelector / matches that treat an invalid selector as "no match" instead of throwing. */
    const safeQuery = (scope, sel) => { try { return scope.querySelector(sel); } catch (e) { return null; } };
    const safeMatches = (el, sel) => { try { return !!el.matches(sel); } catch (e) { return false; } };
    // plain decimal numbers only (sign, digits, one point, exponent): no 0x10, no Infinity, no digits of other scripts. min / max / range / step use it too.
    const NUMBER_RE = /^[-+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][-+]?[0-9]+)?$/;
    const num = v => NUMBER_RE.test(String(v).trim()) ? Number(v) : NaN;
    const fmt = (tpl, rule) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (rule && rule[k] !== undefined ? rule[k] : m));

    function resolveForm(target) {
        if (!target) return null;
        if (target.nodeType === 1) return target;
        if (target[0] && target[0].nodeType === 1) return target[0]; // jQuery object
        const d = root.document;
        return d.getElementById(target) || (function () { try { return d.querySelector(target); } catch (e) { return null; } })();
    }

    function tryFileValidator() {
        if (root.FileValidator) return root.FileValidator;
        try { if (typeof require === 'function') return require('./fileValidator'); } catch (e) { /* not available */ }
        return null;
    }

    function toDate(v) {
        if (v === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
        const t = Date.parse(v);
        return isNaN(t) ? NaN : t;
    }

    // ---- dates with an explicit format: identical in every browser and in the .NET port (no Date.parse guessing)
    //  tokens: yyyy / y (4-digit year), yy (00-69 -> 20xx, 70-99 -> 19xx), MM / M, dd / d, HH / H, mm / m, ss / s; any other character is literal.
    //  d / M / H / m / s accept 1 or 2 digits, the doubled tokens need exactly 2. The calendar is checked (leap years, 30/31-day months).
    const DATE_TOKEN = /yyyy|yy|y|MM|M|dd|d|HH|H|mm|m|ss|s/g;
    const ISO_FORMATS = ['yyyy-MM-dd', 'yyyy-MM-ddTHH:mm', 'yyyy-MM-ddTHH:mm:ss'];
    const daysIn = (y, m) => m === 2 ? ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
    /** -> milliseconds since 1970-01-01T00:00 UTC (the wall-clock time read as UTC), or NaN when v does not fit the format */
    function parseDateFormat(v, format) {
        v = String(v);
        let pos = 0, last = 0, out = null; const f = { y: null, M: 1, d: 1, H: 0, m: 0, s: 0 }; let ok = true;
        const digits = (min, max) => { const m = new RegExp('^\\d{' + min + ',' + max + '}').exec(v.slice(pos)); if (!m) return null; pos += m[0].length; return +m[0]; };
        const lit = text => { if (v.substr(pos, text.length) !== text) return false; pos += text.length; return true; };
        DATE_TOKEN.lastIndex = 0;
        while ((out = DATE_TOKEN.exec(format))) {
            if (out.index > last && !lit(format.slice(last, out.index))) return NaN;
            last = out.index + out[0].length;
            const t = out[0];
            const n = t === 'yyyy' || t === 'y' ? digits(4, 4) : t.length === 2 ? digits(2, 2) : digits(1, 2);
            if (n === null) return NaN;
            if (t === 'yyyy' || t === 'y') f.y = n; else if (t === 'yy') f.y = n < 70 ? 2000 + n : 1900 + n;
            else f[t[0]] = n;
        }
        if (last < format.length && !lit(format.slice(last))) return NaN;
        if (pos !== v.length || f.y === null || f.y < 1) ok = false;
        if (!ok || f.M < 1 || f.M > 12 || f.d < 1 || f.d > daysIn(f.y, f.M) || f.H > 23 || f.m > 59 || f.s > 59) return NaN;
        const dt = new Date(0); dt.setUTCFullYear(f.y, f.M - 1, f.d); dt.setUTCHours(f.H, f.m, f.s, 0);
        return dt.getTime();
    }
    /** strict ISO 8601: yyyy-MM-dd, optionally with THH:mm[:ss]; no time zone, no other spellings */
    function parseIso(v) { for (const f of ISO_FORMATS) { const t = parseDateFormat(v, f); if (!isNaN(t)) return t; } return NaN; }
    /** the value of a date rule under its options: explicit format > strict ISO > the browser's own Date.parse (legacy) */
    function dateValue(v, rule) {
        if (v === 'today' && (rule.format || rule.strict)) { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }   // today's calendar date, as a wall-clock date
        if (rule.format) return parseDateFormat(v, rule.format);
        if (rule.strict) return parseIso(v);
        return toDate(v);
    }

    // ---- the url rule. Written out here instead of asking `new URL()`: browsers disagree on edge cases (Chrome accepts "http://exa%20mple.com",
    //      the others do not), and the .NET package follows exactly this algorithm, so the answer is the same in every browser, Node and .NET.
    //      Follows the URL standard: scheme, user info, host (percent-decoding, forbidden characters, IPv4 forms, IPv6 in brackets, IDN), port.
    const URL_SPECIAL = ['http', 'https', 'ftp', 'ws', 'wss', 'file'];
    const URL_FORBIDDEN_HOST = ' #/:<>?@[\\]^|%';
    function ipv4Part(s) {
        if (s === '') return null;
        let radix = 10;
        if (s.length >= 2 && s[0] === '0' && (s[1] === 'x' || s[1] === 'X')) { s = s.slice(2); radix = 16; }
        else if (s.length >= 2 && s[0] === '0') { s = s.slice(1); radix = 8; }
        if (s === '') return 0;
        let value = 0;
        for (const ch of s) {
            const d = parseInt(ch, 16);
            if (isNaN(d) || d >= radix || (radix === 10 && !/[0-9]/.test(ch)) || (radix === 8 && !/[0-7]/.test(ch))) return null;
            value = value * radix + d;
            if (value > 0xFFFFFFFF * 256) return null;
        }
        return value;
    }
    /** a host that ends in a number must be an IPv4 address (1-4 parts, decimal / 0x hex / 0 octal); returns the dotted form or null */
    function ipv4Of(host) {
        const parts = host.split('.');
        if (parts[parts.length - 1] === '' && parts.length > 1) parts.pop();
        if (parts.length > 4) return null;
        const nums = [];
        for (const p of parts) { const n = ipv4Part(p); if (n === null) return null; nums.push(n); }
        for (let i = 0; i < nums.length - 1; i++) if (nums[i] > 255) return null;
        if (nums[nums.length - 1] >= Math.pow(256, 5 - nums.length)) return null;
        let ip = nums[nums.length - 1];
        for (let i = 0; i < nums.length - 1; i++) ip += nums[i] * Math.pow(256, 3 - i);
        return [Math.floor(ip / 16777216) % 256, Math.floor(ip / 65536) % 256, Math.floor(ip / 256) % 256, ip % 256].join('.');
    }
    function endsInNumber(host) {
        const labels = host.split('.');
        if (labels[labels.length - 1] === '' && labels.length > 1) labels.pop();
        const last = labels[labels.length - 1];
        return /^[0-9]+$/.test(last) || /^0[xX][0-9a-fA-F]*$/.test(last);
    }
    function ipv6Ok(s) {
        if (!/^[0-9a-fA-F:.]+$/.test(s) || s.indexOf(':') < 0) return false;
        let tail = s, groups = 0;
        const dbl = s.indexOf('::');
        if (dbl !== s.lastIndexOf('::')) return false;
        const lastColon = s.lastIndexOf(':');
        const v4 = s.slice(lastColon + 1);
        if (v4.indexOf('.') >= 0) { if (!/^(\d{1,3})(\.\d{1,3}){3}$/.test(v4) || v4.split('.').some(n => +n > 255)) return false; tail = s.slice(0, lastColon + 1) + '0:0'; }
        const halves = tail.split('::');
        for (const half of halves) {
            if (half === '') continue;
            for (const g of half.split(':')) { if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return false; groups++; }
        }
        return dbl >= 0 ? groups < 8 : groups === 8;
    }
    function hostOf(host) {   // percent-decoding, lower case, ASCII (punycode) form of an international name; '' = invalid
        try {
            if (host.indexOf('%') >= 0) host = decodeURIComponent(host);
            host = host.toLowerCase();
            if (/[^\x00-\x7f]/.test(host)) { const u = new URL('http://' + host + '/'); host = u.hostname; }   // only international names go to the engine's IDNA
            return host;
        } catch (e) { return ''; }
    }
    function urlOk(v, rule) {
        if (/\s/.test(v)) return false;
        const hasProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(v);
        if (!hasProto && rule.requireProtocol) return false;
        const full = hasProto ? v : 'http://' + v;
        const sep = full.indexOf('://');
        const scheme = full.slice(0, sep).toLowerCase();
        if (!(rule.protocols || ['http:', 'https:']).includes(scheme + ':')) return false;
        const rest = full.slice(sep + 3), special = URL_SPECIAL.includes(scheme);
        let end = rest.length;
        for (let i = 0; i < rest.length; i++) { const ch = rest[i]; if (ch === '/' || ch === '?' || ch === '#' || (special && ch === String.fromCharCode(92))) { end = i; break; } }
        const authority = rest.slice(0, end), at = authority.lastIndexOf('@');
        const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
        let host, port = '';
        if (hostPort[0] === '[') {
            const close = hostPort.indexOf(']');
            if (close < 0) return false;
            host = hostPort.slice(0, close + 1);
            const after = hostPort.slice(close + 1);
            if (after !== '') { if (after[0] !== ':') return false; port = after.slice(1); }
            if (!ipv6Ok(host.slice(1, -1))) return false;
        } else {
            const colon = hostPort.indexOf(':');
            host = colon >= 0 ? hostPort.slice(0, colon) : hostPort;
            if (colon >= 0) port = hostPort.slice(colon + 1);
            if (host === '') return false;
            host = hostOf(host);
            if (host === '') return false;
            for (let i = 0; i < host.length; i++) { const c = host.charCodeAt(i); if (c <= 0x1f || c === 0x7f || URL_FORBIDDEN_HOST.indexOf(host[i]) >= 0) return false; }
            if (endsInNumber(host)) { const ip = ipv4Of(host); if (ip === null) return false; host = ip; }
        }
        if (port !== '') { if (!/^[0-9]{1,5}$/.test(port) || +port > 65535) return false; }
        if (rule.allowLocal) return true;
        return (host.indexOf('.') >= 0 || host === 'localhost') && host[0] !== '.' && host[host.length - 1] !== '.';
    }

    function luhn(v) {
        const s = v.replace(/[\s-]/g, '');
        if (!/^\d{12,19}$/.test(s)) return false;
        let sum = 0, alt = false;
        for (let i = s.length - 1; i >= 0; i--) { let n = +s[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
        return sum % 10 === 0;
    }

    // ---- identifiers and formats. Everything below is ASCII-only on purpose (no /i flag, no toUpperCase) so every platform answers the same.
    const IPV4_BYTE = '(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
    const IPV4_RE = new RegExp('^(?:' + IPV4_BYTE + '\\.){3}' + IPV4_BYTE + '$');
    const HEX4_RE = /^[0-9a-fA-F]{1,4}$/;

    /** IPv6 in any of its writings: full, with :: once, with an IPv4 tail (::ffff:1.2.3.4). */
    function isIPv6(v) {
        if (!/^[0-9a-fA-F:.]+$/.test(v) || v.split('::').length > 2) return false;
        let s = v;
        const lastColon = s.lastIndexOf(':');
        if (s.indexOf('.') > -1) {
            const tail = s.slice(lastColon + 1);
            if (!IPV4_RE.test(tail)) return false;
            s = s.slice(0, lastColon + 1) + '0:0';
        }
        const groups = s.split('::');
        const parse = part => part === '' ? [] : part.split(':');
        const left = parse(groups[0]), right = groups.length === 2 ? parse(groups[1]) : [];
        if (left.concat(right).some(g => !HEX4_RE.test(g))) return false;
        return groups.length === 2 ? left.length + right.length < 8 : left.length === 8;
    }

    /** IBAN: shape, then the mod-97 check of ISO 13616 (spaces are allowed, case does not matter). */
    function ibanOk(v) {
        const s = v.replace(/\s+/g, '').replace(/[a-z]/g, c => c.toUpperCase());
        if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(s)) return false;
        const moved = s.slice(4) + s.slice(0, 4);
        let rem = 0;
        for (let i = 0; i < moved.length; i++) {
            const c = moved.charCodeAt(i);
            const digits = c >= 65 ? String(c - 55) : moved[i];
            for (let j = 0; j < digits.length; j++) rem = (rem * 10 + (digits.charCodeAt(j) - 48)) % 97;
        }
        return rem === 1;
    }

    /** A host name: letters, digits and hyphens in labels of 1-63 characters, a top level of letters (or xn-- for internationalised ones), 253 in all. */
    const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:[a-zA-Z]{2,63}|xn--[a-zA-Z0-9-]{1,59})$/;

    /** Words: pieces between whitespace that hold at least one letter or digit (of any script). */
    function wordCount(v) {
        return v.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
    }

    /** data-msg-<rule> (or data-msg when `generic`), for example data-msg-required, data-msg-min-date or data-msg-mindate. */
    function dataMessage(field, type, generic) {
        if (!field || !field.getAttribute) return '';
        if (generic) return field.getAttribute('data-msg') || '';
        const t = String(type);
        const kebab = t.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        return field.getAttribute('data-msg-' + t.toLowerCase()) || field.getAttribute('data-msg-' + kebab) || '';
    }

    // ------------------------------------------------------------------ rules
    const validators = {};
    function registerRule(name, fn, opts) {
        if (!isFn(fn)) throw new Error('registerRule: validator must be a function');
        validators[name] = { fn, runOnEmpty: !!(opts && opts.runOnEmpty), remote: !!(opts && opts.remote) };
    }

    const R = (name, fn, o) => registerRule(name, fn, o);

    /** How `remote` rules talk to the server unless a rule says otherwise (like jQuery Validation: GET).
     *  Change globally: FormValidator.remoteDefaults.method = 'POST'  (and .encoding = 'form' for a classic form body). */
    const REMOTE_DEFAULTS = { method: 'GET', encoding: 'json' };

    R('required', (v, r, env) => !env.empty, { runOnEmpty: true });
    R('email', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
    R('url', (v, rule) => urlOk(v, rule));
    R('number', v => NUMBER_RE.test(v));
    R('digits', v => /^\d+$/.test(v));
    R('alpha', v => /^\p{L}+$/u.test(v));
    R('alphanumeric', v => /^[\p{L}\p{N}]+$/u.test(v));
    R('phone', v => /^\+?[\d\s\-().]{7,25}$/.test(v) && (v.match(/\d/g) || []).length >= 7 && (v.match(/\d/g) || []).length <= 15);
    R('date', (v, r) => r.format || r.strict ? !isNaN(dateValue(v, r)) : !isNaN(Date.parse(v)));   // format: 'd/M/yyyy' | strict: true (ISO 8601) | neither: Date.parse (legacy)
    R('minDate', (v, r) => { const a = dateValue(v, r), b = dateValue(r.min, r); return !isNaN(a) && !isNaN(b) && a >= b; });
    R('maxDate', (v, r) => { const a = dateValue(v, r), b = dateValue(r.max, r); return !isNaN(a) && !isNaN(b) && a <= b; });
    R('creditcard', v => luhn(v));
    R('pattern', (v, r) => { const re = r.pattern instanceof RegExp ? r.pattern : new RegExp(r.pattern || r.regex, r.flags || ''); re.lastIndex = 0; return re.test(v); });
    R('maxlength', (v, r) => v.length <= r.max);
    R('minlength', (v, r) => v.length >= r.min);
    R('rangelength', (v, r) => v.length >= r.min && v.length <= r.max);
    R('range', (v, r) => num(v) >= r.min && num(v) <= r.max);
    R('max', (v, r) => num(v) <= r.max);
    R('min', (v, r) => num(v) >= r.min);
    R('step', (v, r) => { const n = num(v), base = r.base || 0; if (isNaN(n)) return false; const q = (n - base) / r.step; return Math.abs(q - Math.round(q)) < 1e-9; });
    R('oneOf', (v, r) => (r.values || []).map(String).includes(v));
    R('notOneOf', (v, r) => !(r.values || []).map(String).includes(v));
    R('integer', v => /^[+-]?[0-9]+$/.test(v));
    R('uuid', v => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v));
    R('hexColor', v => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v));
    R('slug', v => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v));
    R('ipv4', v => IPV4_RE.test(v));
    R('ipv6', v => isIPv6(v));
    R('iban', v => ibanOk(v));
    R('time', v => /^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/.test(v));
    R('domain', v => v.length <= 253 && DOMAIN_RE.test(v));
    R('base64', v => /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v));
    R('mac', v => /^[0-9a-fA-F]{2}([:-])[0-9a-fA-F]{2}(?:\1[0-9a-fA-F]{2}){4}$/.test(v));
    R('latitude', v => /^[+-]?(?:90(?:\.0+)?|[0-8]?[0-9](?:\.[0-9]+)?)$/.test(v));
    R('longitude', v => /^[+-]?(?:180(?:\.0+)?|1[0-7][0-9](?:\.[0-9]+)?|[1-9]?[0-9](?:\.[0-9]+)?)$/.test(v));
    R('startsWith', (v, r) => v.startsWith(String(r.value == null ? '' : r.value)));
    R('endsWith', (v, r) => v.endsWith(String(r.value == null ? '' : r.value)));
    R('contains', (v, r) => v.includes(String(r.value == null ? '' : r.value)));
    R('minWords', (v, r) => wordCount(v) >= r.min);
    R('maxWords', (v, r) => wordCount(v) <= r.max);
    // rows of a repeater / items of an array (checkValues, schema, and wildcard rules on a form: 'items[].sku')
    const uniqueCounts = new WeakMap();
    R('unique', (v, r, env) => {   // the same value in two rows: every row that repeats it fails (empty values are not compared)
        const column = env.column || (isFn(r.columnFn) ? r.columnFn() : null);
        if (!column) return true;
        const key = r.ignoreCase ? 'i' : 's';
        let counts = uniqueCounts.get(column);   // counted once per column, so 5000 rows stay fast
        if (!counts) { counts = { i: null, s: null }; uniqueCounts.set(column, counts); }
        if (!counts[key]) {
            const m = new Map();
            column.forEach(x => { if (x === '') return; const k = r.ignoreCase ? String(x).toLowerCase() : String(x); m.set(k, (m.get(k) || 0) + 1); });
            counts[key] = m;
        }
        return (counts[key].get(r.ignoreCase ? String(v).toLowerCase() : String(v)) || 0) <= 1;
    });
    R('minItems', (v, r, env) => !env.array || env.array.length >= Number(r.min !== undefined ? r.min : r.param), { runOnEmpty: true });
    R('maxItems', (v, r, env) => !env.array || env.array.length <= Number(r.max !== undefined ? r.max : r.param), { runOnEmpty: true });
    const targetOf = (r, env) => r.selector ? safeQuery(env.form, r.selector) : safeQuery(env.form, `[name="${esc(r.target)}"]`);
    R('notEqualTo', (v, r, env) => { const t = targetOf(r, env); return !t || v !== t.value.trim(); });
    R('equalTo', (v, r, env) => {
        const t = targetOf(r, env);
        return !!t && v === (t.type === 'password' ? t.value : t.value.trim());
    }, { runOnEmpty: true });

    R('pwcheck', (v, r, env) => {
        const c = Object.assign({ minLength: 6 }, env.config.passwordStrength, r);
        if (c.enabled === false) return true;
        if (v.length < c.minLength) return false;
        if (c.maxLength && v.length > c.maxLength) return false;
        if (c.requireUppercase && !/\p{Lu}/u.test(v)) return false;   // capital letters of any alphabet, not only A-Z
        if (c.requireLowercase && !/\p{Ll}/u.test(v)) return false;
        if (c.requireDigit && !/\p{Nd}/u.test(v)) return false;       // digits of any script
        if (c.requireSpecialChar && !/[^\p{L}\p{N}\s]/u.test(v)) return false;   // anything that is not a letter, number or space
        if (c.noWhitespace && /\s/.test(v)) return false;
        return true;
    });

    R('minChecked', (v, r, env) => env.count >= r.min, { runOnEmpty: true });
    R('maxChecked', (v, r, env) => env.count <= r.max);
    R('minFiles', (v, r, env) => env.count >= r.min, { runOnEmpty: true });
    R('maxFiles', (v, r, env) => env.count <= r.max);
    R('fileType', (v, r, env) => {
        const allowed = (r.types || []).map(t => String(t).toLowerCase());
        return (env.files || []).every(f => {
            const n = f.name.toLowerCase(), ext = n.includes('.') ? n.split('.').pop() : '';
            const mime = (f.type || '').toLowerCase();
            return allowed.some(a => a.includes('/') ? (a.endsWith('/*') ? mime.startsWith(a.slice(0, -1)) : a === mime) : a.replace(/^\./, '') === ext);
        });
    });
    R('fileSize', (v, r, env) => {
        const max = r.maxSize !== undefined ? r.maxSize : r.maxSizeMB * 1048576;
        return (env.files || []).every(f => f.size <= max);
    });
    R('file', async (v, r, env) => {
        const FV = tryFileValidator();
        if (!FV) { if (root.console) console.warn('FormValidator: "file" rule needs fileValidator.js'); return true; }
        const files = env.files || [];
        const res = await FV.validateFiles(files, r.options || r);
        if (res.isValid) return true;
        // with several files, say which one is the problem ("b.exe: ...")
        const line = FV.summary ? FV.summary(res, { fileNames: files.length > 1 })[0] : (res.details[0] && res.details[0].message);
        return { valid: false, message: line };
    });

    R('custom', (v, r, env) => {
        if (!isFn(r.validate)) { if (root.console) console.warn('FormValidator: custom rule needs a validate(value, context, field) function'); return true; }
        return r.validate(v, env.context, env.field, env);
    }, { runOnEmpty: true });

    // remote: POST/GET to a server. Response: true | "true" | { valid, message } | "error message" | false
    R('remote', async (v, r, env) => {
        if (!r.url) return true;
        const inst = env.inst, key = env.unit.key;
        const fieldKey = r.field || env.field.name;
        const method = String(r.method || REMOTE_DEFAULTS.method).toUpperCase();
        const encoding = r.encoding || REMOTE_DEFAULTS.encoding;
        const evalData = d => { const out = {}; Object.keys(d || {}).forEach(k => { out[k] = isFn(d[k]) ? d[k].call(env.field, v, env) : d[k]; }); return out; };
        const extra = isFn(r.data) ? r.data(v, env) : evalData(r.data);
        const payload = Object.assign({ [fieldKey]: v }, extra);
        const url = method === 'GET' ? r.url + (r.url.includes('?') ? '&' : '?') + new URLSearchParams(payload) : r.url;
        const cacheKey = method + ' ' + url + ' ' + (method === 'GET' ? '' : JSON.stringify(payload));
        if (r.cache !== false && inst._remoteCache.has(cacheKey)) return inst._remoteCache.get(cacheKey);

        if (inst._aborters.get(key)) inst._aborters.get(key).abort();
        const ctrl = root.AbortController ? new root.AbortController() : null;
        if (ctrl) inst._aborters.set(key, ctrl);
        const timer = ctrl ? setTimeout(() => ctrl.abort(), r.timeout || 10000) : null;
        try {
            const resp = await fetch(url, {
                method,
                headers: Object.assign(method === 'GET' ? {} : { 'Content-Type': encoding === 'form' ? 'application/x-www-form-urlencoded; charset=UTF-8' : 'application/json' }, r.headers),
                body: method === 'GET' ? undefined : (encoding === 'form' ? new URLSearchParams(payload).toString() : JSON.stringify(payload)),
                credentials: r.credentials,
                signal: ctrl ? ctrl.signal : undefined
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            let out = await resp.json();
            if (isFn(r.parse)) out = r.parse(out, resp);
            let result;
            if (out === true || out === 'true') result = true;
            else if (out && typeof out === 'object') result = { valid: !!out.valid, message: out.message };
            else if (typeof out === 'string' && out !== 'false') result = { valid: false, message: out };
            else result = false;
            if (r.cache !== false) inst._remoteCache.set(cacheKey, result);
            return result;
        } catch (e) {
            if (e && e.name === 'AbortError' && inst._aborters.get(key) !== ctrl) return true; // superseded; newer run decides
            return r.failOpen === true; // network problem: block by default
        } finally {
            if (timer) clearTimeout(timer);
            if (inst._aborters.get(key) === ctrl) inst._aborters.delete(key);
        }
    }, { remote: true });

    function normalizeResult(res) {
        let valid = res === true, message;
        if (res && typeof res === 'object') { valid = !!res.valid; message = res.message; }
        else if (typeof res === 'string' && res) { valid = false; message = res; }
        else if (res === undefined || res === null) valid = false;
        else valid = !!res;
        return { valid, message };
    }

    // ------------------------------------------------------------------ rule normalisation
    const CLASS_RULES = {};
    const methodNames = new Set();
    const numOr = v => (typeof v === 'string' && v.trim() !== '' && !isNaN(v)) ? Number(v) : v;
    const toRange = p => { const a = typeof p === 'string' ? p.replace(/[\[\]]/g, '').split(/[\s,]+/) : p; return { min: numOr(a[0]), max: numOr(a[1]) }; };
    const selectorLike = str => /^[#.\[]|[\s>:+~]/.test(str);
    const requiredSelector = /^[#.\[]|:(checked|unchecked|filled|blank|selected|visible|hidden)\b/;

    function remoteFields(o) { // jQuery style options: { url, type: 'post', data: {...}, dataFilter } -> engine options
        const r = Object.assign({}, o);
        delete r.type; delete r.dataFilter;
        if (!r.method && o.type) r.method = o.type;
        if (o.dataFilter && !r.parse) r.parse = o.dataFilter;
        return r;
    }

    /** jQuery-style scalar parameters -> engine options */
    const PARAM = {
        minlength: p => ({ min: +p }), maxlength: p => ({ max: +p }), rangelength: toRange, range: toRange,
        min: p => ({ min: numOr(p) }), max: p => ({ max: numOr(p) }), step: p => ({ step: +p }),
        minDate: p => ({ min: p }), maxDate: p => ({ max: p }),
        pattern: p => ({ pattern: p }), oneOf: p => ({ values: [].concat(p) }), notOneOf: p => ({ values: [].concat(p) }),
        startsWith: p => ({ value: p }), endsWith: p => ({ value: p }), contains: p => ({ value: p }),
        minWords: p => ({ min: +p }), maxWords: p => ({ max: +p }), minItems: p => ({ min: +p }), maxItems: p => ({ max: +p }),
        unique: p => (p && typeof p === 'object' ? p : {}),
        equalTo: p => selectorLike(String(p)) ? { selector: p } : { target: p },
        notEqualTo: p => selectorLike(String(p)) ? { selector: p } : { target: p },
        minChecked: p => ({ min: +p }), maxChecked: p => ({ max: +p }), minFiles: p => ({ min: +p }), maxFiles: p => ({ max: +p }),
        fileType: p => ({ types: typeof p === 'string' ? p.split(/[,|\s]+/).filter(Boolean) : p }),
        fileSize: p => ({ maxSize: +p }),
        remote: p => remoteFields(typeof p === 'string' ? { url: p } : p),
        pwcheck: p => (p && typeof p === 'object' ? p : { minLength: +p })
    };

    function ruleFromMap(k, v) {
        const adapt = p => PARAM[k] ? Object.assign({ type: k }, PARAM[k](p)) : { type: k, param: p };
        if (v === true) return { type: k };
        if (isFn(v)) {
            if (k === 'required') return { type: k, when: (val, env) => !!v.call(env.field, env.field) }; // dependency
            if (k === 'custom') return { type: k, validate: v };
            return { type: k, param: v };
        }
        if (typeof v === 'string') {
            if (k === 'required' && requiredSelector.test(v)) return { type: k, when: (val, env) => !!safeQuery(env.form, v) };
            if (PARAM[k] || methodNames.has(k)) return adapt(v);
            return { type: k, message: v };                                    // email: 'Not an email'
        }
        if (Array.isArray(v) || typeof v === 'number' || v instanceof RegExp) return adapt(v);
        if (v && typeof v === 'object') {
            if ('param' in v || 'depends' in v) {                               // { param: 5, depends: fn | 'selector' }
                const r = v.param !== undefined ? adapt(v.param) : { type: k };
                if (v.message) r.message = v.message;
                const d = v.depends;
                if (typeof d === 'string') r.when = (val, env) => !!safeQuery(env.form, d);
                else if (isFn(d)) r.when = (val, env) => !!d.call(env.field, env.field);
                return r;
            }
            if (k === 'remote') return Object.assign({ type: 'remote' }, remoteFields(v));
            return Object.assign({ type: k }, v);
        }
        return { type: k };
    }

    function normalizeRules(input) {
        if (!input) return [];
        if (typeof input === 'string') return [{ type: input }];
        if (Array.isArray(input)) return input.map(x => typeof x === 'string' ? { type: x } : x).filter(Boolean);
        if (input.type) return [input];
        // map shorthand: { required: true, minlength: 3, range: [1, 5], equalTo: '#pw', remote: '/check', email: 'Not an email' }
        const keys = Object.keys(input).filter(k => input[k] !== false && k !== 'normalizer' && k !== 'messages');
        const list = keys.map(k => ruleFromMap(k, input[k]));
        if (isFn(input.normalizer)) list.forEach(r => { r.normalizer = input.normalizer; });
        if (input.messages && typeof input.messages === 'object') list.forEach(r => { if (!r.message && input.messages[r.type]) r.message = input.messages[r.type]; });
        const first = list.filter(r => r.type === 'required'), last = list.filter(r => r.type === 'remote');
        return first.concat(list.filter(r => r.type !== 'required' && r.type !== 'remote'), last); // like jQuery: required first, remote last
    }

    /** params for {0}, {1} placeholders and jQuery-style message functions */
    function paramsOf(rule) {
        if (rule.param !== undefined) return [].concat(rule.param);
        if ('min' in rule && 'max' in rule) return [rule.min, rule.max];
        if ('min' in rule) return [rule.min];
        if ('max' in rule) return [rule.max];
        if ('step' in rule) return [rule.step];
        return [];
    }

    function format(source, params) { // like $.validator.format
        if (arguments.length === 1) return function () { return format.apply(null, [source].concat(Array.from(arguments))); };
        if (params === undefined) return source;
        if (arguments.length > 2 && !Array.isArray(params)) params = Array.from(arguments).slice(1);
        if (!Array.isArray(params)) params = [params];
        return params.reduce((out, n, i) => out.replace(new RegExp('\\{' + i + '\\}', 'g'), () => n), source);
    }

    /** jQuery-style custom method:  addMethod('even', function (value, element, param) { return this.optional(element) || value % 2 === 0; }, 'Even numbers only') */
    function addMethod(name, fn, message) {
        if (!isFn(fn)) throw new Error('addMethod: the method must be a function');
        methodNames.add(name);
        registerRule(name, function (value, rule, env) {
            const ps = paramsOf(rule);
            const ctx = {
                form: env.form, field: env.field, format,
                optional: el => (!el || el === env.field) ? env.empty : env.inst.readValue(env.inst.unitOf(el) || { key: el, fields: [el] }).empty,
                elementValue: el => env.inst.readValue(env.inst.unitOf(el) || { key: el, fields: [el] }).value
            };
            const res = fn.call(ctx, value, env.field, ps.length > 1 ? ps : ps[0], env);
            return (res === 'dependency-mismatch' || res === 'pending') ? true : res;
        }, { runOnEmpty: true }); // like jQuery: the method decides for empty values itself, via this.optional(element)
        if (message !== undefined) DEFAULT_MESSAGES[name] = isFn(message) ? (field, rule) => { const ps = paramsOf(rule); return message(ps.length > 1 ? ps : ps[0], field); } : message;
    }

    function addClassRules(name, rules) {
        if (typeof name === 'string') CLASS_RULES[name] = rules; else Object.assign(CLASS_RULES, name);
    }

    // ------------------------------------------------------------------ instance
    const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

    const VALIDATE_ON_PRESETS = { smart: ['change'], 'default': ['change'], change: ['change'], blur: ['blur'], input: ['input'], submit: [], all: ['change', 'blur', 'input'] };

    /** Options of the wrong type fall back to the defaults: a bad config must not crash the page when an error is shown. */
    function sanitizeConfig(cfg) {
        if (typeof cfg.errorElement !== 'string' || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(cfg.errorElement)) cfg.errorElement = DEFAULTS.errorElement;
        ['errorClass', 'invalidClass', 'pendingClass', 'validClass'].forEach(k => { if (typeof cfg[k] !== 'string') cfg[k] = k === 'errorClass' ? DEFAULTS.errorClass : ''; });
        const preset = typeof cfg.validateOn === 'string' ? VALIDATE_ON_PRESETS[cfg.validateOn.toLowerCase()] : null;
        cfg.validateOn = preset ? preset.slice() : Array.isArray(cfg.validateOn) ? cfg.validateOn.filter(e => typeof e === 'string') : DEFAULTS.validateOn.slice();
        if (typeof cfg.debounce !== 'number' || !isFinite(cfg.debounce) || cfg.debounce < 0) cfg.debounce = DEFAULTS.debounce;
        ['ignore', 'skipSubmitter'].forEach(k => {
            if (typeof cfg[k] !== 'string' || !cfg[k].trim()) { cfg[k] = null; return; }
            try { root.document.createDocumentFragment().querySelector(cfg[k]); } catch (e) { cfg[k] = null; }   // an invalid selector
        });
        ['errorPlacement', 'submitHandler', 'onError', 'onSuccess', 'highlight', 'unhighlight', 'onFieldValid', 'fieldRules', 'resolveMessage'].forEach(k => { if (!isFn(cfg[k])) cfg[k] = null; });
        if (!isObj(cfg.classRules)) cfg.classRules = null;
        return cfg;
    }

    function createInstance(form, opts) {
        const userConfig = isObj(opts.config) ? opts.config : {};
        const cfg = sanitizeConfig(Object.assign({}, DEFAULTS, userConfig));
        if (typeof userConfig.validateOn === 'string' && userConfig.validateOn.toLowerCase() === 'blur' && !('skipEmptyUntilSubmit' in userConfig)) cfg.skipEmptyUntilSubmit = true;   // 'blur' does not nag fields the user only tabbed through
        cfg.passwordStrength = Object.assign({}, DEFAULTS.passwordStrength, isObj(userConfig.passwordStrength) ? userConfig.passwordStrength : null);
        const rawMessages = Object.assign({}, isObj(userConfig.messages) ? userConfig.messages : null, isObj(opts.messages) ? opts.messages : null);
        cfg.messages = {};                 // by rule type
        const fieldMessages = {};          // by field name: { name: 'text' } or { name: { required: 'text' } }
        Object.keys(rawMessages).forEach(k => {
            const v = rawMessages[k], isType = k in DEFAULT_MESSAGES || !!validators[k];
            if ((v && typeof v === 'object') || !isType) fieldMessages[k] = v; else cfg.messages[k] = v;
        });
        if (cfg.unobtrusive) {   // the class names MVC's CSS and Razor helpers already use
            if (!('errorElement' in userConfig)) cfg.errorElement = 'span';
            if (!('errorClass' in userConfig)) cfg.errorClass = 'field-validation-error';
            if (!('invalidClass' in userConfig)) cfg.invalidClass = 'input-validation-error';
            if (!('validClass' in userConfig)) cfg.validClass = 'input-validation-valid';
            if (!('rewardOnInput' in userConfig)) cfg.rewardOnInput = false;
        }
        const context = Object.assign({}, opts.context, { form });

        const inst = {
            form, config: cfg, context,
            rules: {},
            _errors: new Map(),        // unit.key -> { el, message, unit }
            _tokens: new Map(),
            _aborters: new Map(),
            _remoteCache: new Map(),
            _serverNames: new Set(),
            _serverToken: 0,
            _serverAbort: null,
            _listeners: [],
            _timers: new Map(),
            _busy: false, _bypass: false, _submitted: false,
            _pending: new Map(), fieldMessages
        };
        Object.keys(opts.rules || {}).forEach(n => { inst.rules[n] = normalizeRules(opts.rules[n]); });

        // ---- units: one per radio/checkbox group, one per individual element otherwise
        function unitsOf(els) {
            const grouped = els.filter(e => e.type === 'radio' || e.type === 'checkbox');
            const units = els.filter(e => !(e.type === 'radio' || e.type === 'checkbox')).map(e => ({ key: e, fields: [e] }));
            if (grouped.length) units.unshift({ key: grouped[0], fields: grouped });
            return units;
        }
        function unitsFor(name) { return unitsOf(Array.from(form.querySelectorAll(`[name="${esc(name)}"]`))); }
        let wildCache = null;   // the wildcard rule keys; reset whenever rules are added, replaced or removed
        const wildKeys = () => wildCache || (wildCache = Object.keys(inst.rules).filter(k => hasPathChars(k) && (ruleTokens(k) || []).some(isWild)));
        /** Does the field name 'items[2].qty' (or 'items.2.qty') belong to the wildcard rule key 'items[].qty'? */
        function nameMatchesKey(name, key) {
            const nt = ruleTokens(name), kt = ruleTokens(key);
            return !!nt && !!kt && nt.length === kt.length && kt.every((t, i) => (isWild(t) ? typeof nt[i] === 'number' : t === nt[i]));
        }
        function wildcardRulesFor(name) {
            const out = [];
            wildKeys().forEach(key => {
                if (name === key || !nameMatchesKey(name, key)) return;
                inst.rules[key].forEach(r => {
                    if (r.type !== 'unique') { out.push(r); return; }
                    // the other rows of the same column: every field whose name matches the wildcard key
                    out.push(Object.assign({}, r, { columnFn: () => Array.from(form.elements).filter(el => el.name && !/^(radio|checkbox|file|button|submit|reset|image)$/.test(el.type) && nameMatchesKey(el.name, key)).map(el => String(el.value == null ? '' : el.value).trim()) }));
                });
            });
            return out;
        }
        function names() {
            const set = new Set(Object.keys(inst.rules));
            const wild = wildKeys();
            if (wild.length) {
                wild.forEach(k => { if (!Array.from(form.elements).some(e => e.name === k)) set.delete(k); });   // PHP-style 'items[]' that is a real field name stays a plain name
                Array.from(form.elements).forEach(e => { if (e.name && wild.some(k => nameMatchesKey(e.name, k))) set.add(e.name); });
            }
            if (cfg.autoRules || isFn(cfg.fieldRules) || hasClassRules()) {
                Array.from(form.elements).forEach(e => {
                    if (e.name && e.tagName !== 'FIELDSET' && !['button', 'submit', 'reset', 'image'].includes(e.type)) set.add(e.name);
                });
            } else if (cfg.unobtrusive) {
                Array.from(form.elements).forEach(e => { if (e.name && e.getAttribute('data-val') === 'true') set.add(e.name); });
            }
            return Array.from(set);
        }
        function allUnits() {   // one pass over the form instead of one query per field name
            const nm = names();
            const groups = new Map();
            Array.from(form.querySelectorAll('[name]')).forEach(el => { const n = el.getAttribute('name'); const g = groups.get(n); if (g) g.push(el); else groups.set(n, [el]); });
            return [].concat(...nm.map(n => unitsOf(groups.get(n) || [])));
        }

        const hasClassRules = () => Object.keys(CLASS_RULES).length > 0 || (cfg.classRules && Object.keys(cfg.classRules).length > 0);

        function classRulesFor(f) {
            const map = Object.assign({}, CLASS_RULES, cfg.classRules), out = [];
            String(typeof f.className === 'string' ? f.className : '').split(/\s+/).forEach(c => { if (c && Object.prototype.hasOwnProperty.call(map, c)) out.push(...normalizeRules(map[c])); });
            return out;
        }

        function attributeRules(f) {
            const r = [], t = (f.type || '').toLowerCase(), get = a => f.getAttribute(a);
            if (f.hasAttribute('required')) r.push({ type: 'required' });
            if (t === 'email') r.push({ type: 'email' });
            if (t === 'url') r.push({ type: 'url' });
            if (t === 'number' || t === 'range') r.push({ type: 'number' });
            if (t === 'date') r.push({ type: 'date' });
            if (f.hasAttribute('minlength')) r.push({ type: 'minlength', min: +get('minlength') });
            if (f.hasAttribute('maxlength')) r.push({ type: 'maxlength', max: +get('maxlength') });
            if (t === 'number' || t === 'range') {
                if (f.hasAttribute('min')) r.push({ type: 'min', min: +get('min') });
                if (f.hasAttribute('max')) r.push({ type: 'max', max: +get('max') });
            }
            if (f.hasAttribute('pattern')) {
                let re; try { re = new RegExp('^(?:' + get('pattern') + ')$', 'u'); } catch (e) { try { re = new RegExp('^(?:' + get('pattern') + ')$'); } catch (e2) { re = null; } }
                if (re) r.push({ type: 'pattern', pattern: re, message: f.getAttribute('title') || undefined });
            }
            if (t === 'file' && f.hasAttribute('accept')) r.push({ type: 'file', accept: get('accept') });
            Array.from(f.attributes).forEach(a => {                       // data-rule-minlength="3", data-rule-range="[1,5]", data-rule-required
                if (a.name.indexOf('data-rule-') !== 0) return;
                const key = a.name.slice(10).replace(/-/g, '');
                const type = Object.keys(validators).find(n => n.toLowerCase() === key);
                if (!type) return;
                let v = a.value;
                if (v === '' || v === 'true') v = true;
                else if (v === 'false') return;
                else { try { v = JSON.parse(v); } catch (e) { /* keep the text, e.g. #password */ } }
                r.push(ruleFromMap(type, v));
            });
            return r;
        }

        /** The rules ASP.NET rendered into data-val-* attributes of a field (data-val="true"), through the adapters of FormValidator.unobtrusive.adapters. */
        function dataValRules(f) {
            if (f.getAttribute('data-val') !== 'true') return [];
            const name = f.name || '', prefix = name.slice(0, name.lastIndexOf('.') + 1), attrs = {}, out = [];
            Array.from(f.attributes).forEach(a => { attrs[a.name.toLowerCase()] = a.value; });
            Object.keys(attrs).forEach(k => {
                const m = /^data-val-([a-z0-9_]+)$/.exec(k);
                if (m && !UNOB[m[1]] && !unobWarned.has(m[1])) { unobWarned.add(m[1]); if (root.console) console.warn('FormValidator unobtrusive: no adapter for data-val-' + m[1] + ' (add one with FormValidator.unobtrusive.adapters.add); it is ignored.'); }
            });
            Object.keys(UNOB).forEach(adapter => {
                const attr = 'data-val-' + adapter;
                if (!(attr in attrs)) return;
                const def = UNOB[adapter], options = { element: f, form, prefix, collect: collectValues, message: attrs[attr] || undefined, params: {}, rules: {}, messages: {} };
                def.params.forEach(p => { options.params[p] = attrs[attr + '-' + p.toLowerCase()]; });
                try { def.fn(options); } catch (e) { if (root.console) console.error('FormValidator unobtrusive: the adapter "' + adapter + '" threw:', e); return; }
                Object.keys(options.rules).forEach(rn => {
                    if (!validators[rn]) { if (root.console && !unobWarned.has('rule:' + rn)) { unobWarned.add('rule:' + rn); console.warn('FormValidator unobtrusive: the adapter "' + adapter + '" uses the rule "' + rn + '" which is not registered (FormValidator.addMethod / registerRule); it is ignored.'); } return; }
                    const v = options.rules[rn];
                    const r = typeof v === 'string' && !PARAM[rn] && !methodNames.has(rn) ? { type: rn, param: v } : ruleFromMap(rn, v);   // a text value is a parameter here, never a message
                    if (options.messages[rn]) r.message = options.messages[rn];
                    out.push(r);
                });
            });
            return out;
        }
        const valmsgFor = f => (cfg.unobtrusive && f && f.name ? form.querySelector('[data-valmsg-for="' + esc(f.name) + '"]') : null);

        function rulesFor(unit) {
            const explicit = (inst.rules[unit.fields[0].name] || []).concat(wildKeys().length ? wildcardRulesFor(unit.fields[0].name) : []);
            if (!cfg.autoRules && !cfg.unobtrusive && !isFn(cfg.fieldRules) && !hasClassRules()) return explicit;
            const merged = new Map();  // later sources win per rule type: class < attributes / data-rule < data-val < fieldRules
            classRulesFor(unit.fields[0]).concat(cfg.autoRules ? attributeRules(unit.fields[0]) : [], cfg.unobtrusive ? dataValRules(unit.fields[0]) : [],
                isFn(cfg.fieldRules) ? normalizeRules(guard(cfg.fieldRules, [], unit.fields[0], unit)) : []).forEach(r => merged.set(r.type, r));
            const derived = Array.from(merged.values()).filter(a => !explicit.some(e => e.type === a.type));
            return derived.concat(explicit);
        }

        function readEnv(unit) {
            const first = unit.fields[0], type = first.type;
            let value, empty, count = 0, files = null, badInput = false;
            if (type === 'file') {
                files = Array.from(first.files || []); count = files.length; empty = !count;
                value = files.map(f => f.name).join(', ');
            } else if (type === 'checkbox' || type === 'radio') {
                const on = unit.fields.filter(f => f.checked);
                count = on.length; empty = !count; value = on[0] ? on[0].value : '';
            } else if (first.tagName === 'SELECT' && first.multiple) {
                const sel = Array.from(first.selectedOptions).filter(o => o.value !== '');
                count = sel.length; empty = !count; value = sel[0] ? sel[0].value : '';
            } else {
                const raw = first.value == null ? '' : first.value;
                value = (type === 'password' || cfg.trim === false) ? raw : raw.trim();
                empty = value === ''; count = empty ? 0 : 1;
                if (first.validity && first.validity.badInput) { badInput = true; empty = false; count = 1; } // e.g. letters typed into type=number
            }
            return { badInput, value, empty, count, files, field: first, fields: unit.fields, unit, form, config: cfg, context, inst };
        }

        /**
         * The values of the form as an object, ready to send (JSON, fetch, axios, $.ajax): text is trimmed like the validation saw it (passwords are not),
         * a checkbox group and a multiple select give an array, a radio group its chosen value, a file field the File objects. Like a native submit, unchecked
         * checkboxes and unchosen radios are left out and disabled fields are skipped.
         */
        function collectValues() {
            const out = {}, groups = new Map();
            Array.from(form.elements).forEach(el => {
                if (!el.name || el.disabled || el.tagName === 'FIELDSET' || ['submit', 'button', 'reset', 'image'].includes(el.type)) return;
                if (!groups.has(el.name)) groups.set(el.name, []);
                groups.get(el.name).push(el);
            });
            groups.forEach((els, name) => {
                const first = els[0], type = first.type;
                if (type === 'file') out[name] = els.reduce((all, e) => all.concat(Array.from(e.files || [])), []);
                else if (type === 'checkbox') { const on = els.filter(e => e.checked).map(e => e.value); if (els.length > 1) out[name] = on; else if (on.length) out[name] = on[0]; }
                else if (type === 'radio') { const on = els.find(e => e.checked); if (on) out[name] = on.value; }
                else if (first.tagName === 'SELECT' && first.multiple) out[name] = Array.from(first.selectedOptions).map(o => o.value);
                else {
                    const vals = els.map(e => { const raw = e.value == null ? '' : e.value; return (e.type === 'password' || cfg.trim === false) ? raw : raw.trim(); });
                    out[name] = vals.length > 1 ? vals : vals[0];
                }
            });
            return out;
        }

        function isActive(unit) {
            if (unit.fields.every(f => f.disabled)) return false;
            if (cfg.ignore) { try { if (unit.fields[0].matches(cfg.ignore)) return false; } catch (e) { /* invalid selector */ } }
            if (cfg.validateHidden) return true;
            return unit.fields.some(f => f.type !== 'hidden' && f.getClientRects().length > 0);
        }

        // ---- messages
        function resolveMessage(rule, env, dynamic) {
            if (isFn(cfg.resolveMessage)) { const custom = guard(cfg.resolveMessage, '', rule, env, dynamic); if (custom) return custom; }
            let m = rule.serverMessage && dynamic ? dynamic : rule.message;   // [Remote]: the text the server answers wins over the attribute's
            if (isFn(m)) m = guard(m, '', env.field, rule, env);
            if (!m) { const fm = fieldMessages[env.field.name]; m = fm && (typeof fm === 'string' || isFn(fm) ? fm : fm[rule.type]); } // messages: { email: { required: '...' } }
            if (!m) m = dataMessage(env.field, rule.type, false);         // data-msg-required="..." (like jQuery Validation)
            if (!m) m = dynamic;
            if (!m) m = dataMessage(env.field, rule.type, true);          // data-msg="..." : one message for every rule of the field
            if (!m) m = cfg.messages[rule.type] || DEFAULT_MESSAGES[rule.type] || 'Invalid value.';
            if (isFn(m)) m = guard(m, '', env.field, rule, env);
            const ps = paramsOf(rule);
            return fmt(m, rule).replace(/\{(\d+)\}/g, (x, i) => (ps[i] !== undefined ? ps[i] : x));
        }

        // ---- error display
        function place(err, unit) {
            const first = unit.fields[0], last = unit.fields[unit.fields.length - 1];
            const slot = valmsgFor(first);   // ASP.NET: <span data-valmsg-for="Email" class="field-validation-valid">
            if (slot) {
                slot.classList.remove('field-validation-valid'); slot.classList.add('field-validation-error');
                if (slot.getAttribute('data-valmsg-replace') !== 'false') { while (slot.firstChild) slot.removeChild(slot.firstChild); } else err.hidden = true;   // replace=false keeps your static text; the message stays reachable for screen readers
                slot.appendChild(err);
                return;
            }
            if (isFn(cfg.errorPlacement)) {
                try { cfg.errorPlacement(err, first, unit.fields); return; }
                catch (e) { if (root.console) console.error('FormValidator: an error in your errorPlacement was ignored, using the default placement:', e); }
            }

            if (first.type === 'radio' || first.type === 'checkbox') {
                const container = first.closest(GROUP_CONTAINERS);
                const anchor = container || last.closest('.form-check') || last.closest('label') || last;
                return anchor.insertAdjacentElement('afterend', err);
            }
            const next = first.nextElementSibling; // Select2 container
            if (first.tagName === 'SELECT' && next && next.classList.contains('select2')) return next.insertAdjacentElement('afterend', err);

            const wrap = first.closest('.input-group') || first.closest('.form-floating');
            (wrap || first).insertAdjacentElement('afterend', err);
        }

        function removeError(unit) {
            const rec = inst._errors.get(unit.key);
            if (rec) { rec.el.remove(); inst._errors.delete(unit.key); refreshSummary(); }
            const slot = valmsgFor(unit.fields[0]);
            if (slot) {
                slot.classList.remove('field-validation-error'); slot.classList.add('field-validation-valid');
                if (slot.getAttribute('data-valmsg-replace') !== 'false') while (slot.firstChild) slot.removeChild(slot.firstChild);
            }
            unit.fields.forEach(f => {
                if (cfg.validClass) cfg.validClass.split(/\s+/).forEach(c => c && f.classList.remove(c));
                if (isFn(cfg.unhighlight)) guard(cfg.unhighlight, undefined, f, unit);
                if (cfg.invalidClass) cfg.invalidClass.split(/\s+/).forEach(c => c && f.classList.remove(c));
                f.removeAttribute('aria-invalid');
                if (rec) {
                    const ids = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(i => i && i !== rec.el.id);
                    ids.length ? f.setAttribute('aria-describedby', ids.join(' ')) : f.removeAttribute('aria-describedby');
                }
            });
        }

        function showError(unit, message, code) {
            removeError(unit);
            const err = root.document.createElement(cfg.errorElement);
            err.setAttribute('data-code', code || 'custom');
            err.className = cfg.errorClass;
            err.id = 'fv-error-' + (++uid);
            err.setAttribute('data-error-for', unit.fields[0].name);
            err.setAttribute('dir', 'auto');
            // role="alert" is not allowed on <label> (ARIA); the field's aria-describedby makes screen readers read the message on focus anyway
            if (err.tagName === 'LABEL') err.setAttribute('aria-live', 'polite'); else err.setAttribute('role', 'alert');
            if (err.tagName === 'LABEL' && unit.fields[0].id) err.setAttribute('for', unit.fields[0].id);
            err.textContent = message;
            place(err, unit);
            inst._errors.set(unit.key, { el: err, message, unit, code: code || 'custom' });
            refreshSummary();
            unit.fields.forEach(f => {
                if (isFn(cfg.highlight)) guard(cfg.highlight, undefined, f, unit);
                if (cfg.invalidClass) cfg.invalidClass.split(/\s+/).forEach(c => c && f.classList.add(c));
                f.setAttribute('aria-invalid', 'true');
                f.setAttribute('aria-describedby', ((f.getAttribute('aria-describedby') || '') + ' ' + err.id).trim());
            });
        }

        // ---- validation
        /** The stable code of a failed rule: its type ('required', 'email', 'minlength' ...) unless the rule carries its own `code` ('coupon.expired'). */
        const codeOf = rule => (typeof rule.code === 'string' && rule.code ? rule.code : rule.type);
        const valueFor = (rule, env) => { if (!isFn(rule.normalizer)) return env.value; const v = guard(function () { return rule.normalizer.call(env.field, env.value, env.field); }, env.value); return typeof v === 'string' ? v : String(v); };

        function setPending(unit, on) {
            if (!cfg.pendingClass) return;
            const n = (inst._pending.get(unit.key) || 0) + (on ? 1 : -1);
            inst._pending.set(unit.key, Math.max(0, n));
            if (on && n === 1) unit.fields.forEach(f => { cfg.pendingClass.split(/\s+/).forEach(c => c && f.classList.add(c)); f.setAttribute('aria-busy', 'true'); });
            if (!on && n <= 0) unit.fields.forEach(f => { cfg.pendingClass.split(/\s+/).forEach(c => c && f.classList.remove(c)); f.removeAttribute('aria-busy'); });
        }

        async function validateUnit(unit, o) {
            o = o || {};
            const rules = rulesFor(unit);
            if (!rules.length) return true;
            const token = (inst._tokens.get(unit.key) || 0) + 1;
            inst._tokens.set(unit.key, token);

            if (!isActive(unit)) { removeError(unit); return true; }
            const env = readEnv(unit);

            if (env.badInput) { showError(unit, cfg.messages.badInput || DEFAULT_MESSAGES.badInput, 'badInput'); return false; }

            let pending = false;
            try {
                for (const rule of rules) {
                    const def = validators[rule.type];
                    if (!def) { if (root.console) console.warn('FormValidator: unknown rule "' + rule.type + '"'); continue; }
                    if (isFn(rule.when) && !guard(rule.when, true, env.value, env)) continue;   // a throwing `when` counts as "applies"
                    if (env.empty && !def.runOnEmpty) continue;
                    if (def.remote && o.event === 'input') continue;

                    let res;
                    try {
                        res = def.fn(valueFor(rule, env), rule, env);
                        if (res && isFn(res.then)) { if (!pending) { pending = true; setPending(unit, true); } res = await res; }
                    } catch (e) { if (root.console) console.error(e); res = false; }

                    if (inst._tokens.get(unit.key) !== token) return !inst._errors.has(unit.key); // a newer run owns the state

                    const r = normalizeResult(res);
                    if (!r.valid) { showError(unit, resolveMessage(rule, env, r.message), codeOf(rule)); return false; }
                }
                removeError(unit);
                if (!env.empty) markValid(unit, true);
                if (isFn(cfg.onFieldValid)) guard(cfg.onFieldValid, undefined, unit.fields[0], unit);
                return true;
            } finally {
                if (pending) setPending(unit, false);
            }
        }

        /** Synchronous check. Rules that answer asynchronously (remote, file, async custom) count as valid for now;
         *  their result updates the UI when it arrives. This is what jQuery Validation's valid() semantics need. */
        function validateUnitSync(unit, o) {
            o = o || {};
            const rules = rulesFor(unit);
            if (!rules.length) return true;
            const token = (inst._tokens.get(unit.key) || 0) + 1;
            inst._tokens.set(unit.key, token);

            if (!isActive(unit)) { removeError(unit); return true; }
            const env = readEnv(unit);
            if (env.badInput) { showError(unit, cfg.messages.badInput || DEFAULT_MESSAGES.badInput, 'badInput'); return false; }

            for (const rule of rules) {
                const def = validators[rule.type];
                if (!def) { if (root.console) console.warn('FormValidator: unknown rule "' + rule.type + '"'); continue; }
                if (isFn(rule.when) && !guard(rule.when, true, env.value, env)) continue;   // a throwing `when` counts as "applies"
                if (env.empty && !def.runOnEmpty) continue;
                if (def.remote && o.event === 'input') continue;

                let res;
                try { res = def.fn(valueFor(rule, env), rule, env); }
                catch (e) { if (root.console) console.error(e); res = false; }

                if (res && isFn(res.then)) {
                    res.then(late => {
                        if (inst._tokens.get(unit.key) !== token) return;
                        const lr = normalizeResult(late);
                        if (!lr.valid) showError(unit, resolveMessage(rule, env, lr.message), codeOf(rule));
                    }).catch(() => { /* a failed async check stays "pending" in sync mode */ });
                    continue;
                }
                const r = normalizeResult(res);
                if (!r.valid) { showError(unit, resolveMessage(rule, env, r.message), codeOf(rule)); return false; }
            }
            removeError(unit);
            if (!env.empty) markValid(unit, true);
            if (isFn(cfg.onFieldValid)) guard(cfg.onFieldValid, undefined, unit.fields[0], unit);
            return true;
        }

        function finishAll(units, results, o) {
            const invalid = units.filter((u, i) => !results[i] && inst._errors.has(u.key));
            const ok = results.every(Boolean);
            if (!ok) {
                invalid.sort((a, b) => (a.fields[0].compareDocumentPosition(b.fields[0]) & 4) ? -1 : 1);
                const list = invalid.map(u => ({ name: u.fields[0].name, field: u.fields[0], message: inst._errors.get(u.key).message, code: inst._errors.get(u.key).code }));
                renderValSummary();
                const summaryFocus = !!summaryCfg && summaryCfg.focus === 'summary' && (!o || o.focus !== false) && cfg.focusInvalid;
                if (summaryCfg && (o && (o.submit || o.summary) || inst._submitted)) renderSummary(summaryFocus);
                if (cfg.focusInvalid && invalid[0] && !summaryFocus && (!o || o.focus !== false)) { // after the list: focus handlers may clear errors
                    const f = invalid[0].fields[0];
                    try { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
                    catch (e) { /* not focusable */ }
                }
                if (isFn(cfg.onError)) guard(cfg.onError, undefined, list);
                emit('fv:invalid', { errors: list });
            } else {
                if (isFn(cfg.onSuccess)) guard(cfg.onSuccess, undefined);
                if (summaryEl) renderSummary(false);
                renderValSummary();
                emit('fv:valid', {});
            }
            return ok;
        }

        async function validateAll(o) {
            if (o && o.submit) inst._submitted = true;
            const units = allUnits();
            const results = await Promise.all(units.map(u => validateUnit(u, o)));
            return finishAll(units, results, o);
        }

        function validateAllSync(o) {
            if (o && o.submit) inst._submitted = true;
            const units = allUnits();
            return finishAll(units, units.map(u => validateUnitSync(u, o)), o);
        }

        function emit(type, detail) {
            if (typeof root.CustomEvent === 'function') form.dispatchEvent(new root.CustomEvent(type, { bubbles: true, detail }));
        }

        function unitOf(el) {
            if (!el || !el.name || !names().includes(el.name)) return null;
            if (el.type === 'radio' || el.type === 'checkbox') return unitsFor(el.name).find(u => u.fields.includes(el)) || null;
            return { key: el, fields: [el] };
        }

        // ---- listeners
        function listen(el, type, fn, opt) { el.addEventListener(type, fn, opt); inst._listeners.push(() => el.removeEventListener(type, fn, opt)); }

        function attach() {
            if (cfg.novalidate) { inst._hadNoValidate = form.noValidate; form.noValidate = true; }

            // Delegated on the form, so fields added or replaced later are covered automatically.
            function dependents(el) { // fields whose rule compares against this one (equalTo / notEqualTo / dependsOn)
                const out = [];
                Object.keys(inst.rules).forEach(n => {
                    const hit = r => ((r.type === 'equalTo' || r.type === 'notEqualTo') && (r.target === el.name || (r.selector && safeMatches(el, r.selector))))
                        || (r.dependsOn && safeMatches(el, r.dependsOn));
                    if (inst.rules[n].some(hit)) out.push(...unitsFor(n));
                });
                if (isFn(cfg.fieldRules)) { // rules that come from fieldRules() are not stored in inst.rules
                    allUnits().forEach(u => {
                        if (out.some(o => o.key === u.key)) return;
                        if (normalizeRules(guard(cfg.fieldRules, [], u.fields[0], u)).some(r => r.dependsOn && safeMatches(el, r.dependsOn))) out.push(u);
                    });
                }
                return out;
            }

            // While a pointer is down, a blur-triggered re-check must not add or remove messages: the page would shift under the
            // pointer and the click would land on the wrong element. Those updates wait until the click is over.
            const D = root.document;
            let pointerDown = false;
            const deferred = new Map();
            inst._deferred = deferred;
            const flush = () => { const fns = Array.from(deferred.values()); deferred.clear(); fns.forEach(fn => fn()); };
            const pointerUp = () => { if (pointerDown) { pointerDown = false; setTimeout(flush, 150); } };
            if (D) {
                [['pointerdown', () => { pointerDown = true; }], ['pointerup', pointerUp], ['pointercancel', pointerUp],
                    ['click', () => { if (deferred.size) { pointerDown = false; setTimeout(flush, 0); } }]].forEach(([t, fn]) => {
                    D.addEventListener(t, fn, true);
                    inst._listeners.push(() => D.removeEventListener(t, fn, true));
                });
            }
            const later = (key, fn) => { if (pointerDown) deferred.set(key, fn); else fn(); };

            const onEvent = evt => {
                const el = evt.target;
                const type = evt.type === 'focusout' ? 'blur' : evt.type;
                if (!el || !el.name) return;
                const unit = unitOf(el);

                dependents(el).forEach(d => { // works even when `el` has no rules of its own
                    if (unit && d.key === unit.key) return;
                    const shown = inst._errors.has(d.key);
                    if (shown || (type !== 'input' && !readEnv(d).empty)) later(d.key, () => validateUnit(d, { event: type }));
                });
                if (!unit) return;

                if (type === 'input' && cfg.liveInput === false) return;
                const hasErr = inst._errors.has(unit.key);
                const afterSubmit = inst._submitted && cfg.validateAfterSubmit;
                if (type === 'input' && !hasErr && !afterSubmit && !cfg.validateOn.includes('input')) {
                    // reward early: a valid value earns the valid class while typing; an error is never shown until the user leaves the field
                    if (cfg.validClass && cfg.rewardOnInput !== false) {
                        clearTimeout(inst._timers.get(unit.key));
                        inst._timers.set(unit.key, setTimeout(() => { const ok = peekValid(unit); if (ok === true) markValid(unit, true); else markValid(unit, false); }, cfg.debounce || 0));
                    }
                    return;
                }
                if (!hasErr && !afterSubmit && !cfg.validateOn.includes(type)) return;
                if (!hasErr && cfg.skipEmptyUntilSubmit && !inst._submitted && readEnv(unit).empty) return;
                clearTimeout(inst._timers.get(unit.key));
                const run = () => validateUnit(unit, { event: type });
                if (type === 'input' && cfg.debounce) inst._timers.set(unit.key, setTimeout(() => later(unit.key, run), cfg.debounce));
                else later(unit.key, run);
            };
            ['input', 'change', 'focusout'].forEach(t => listen(form, t, onEvent));
            if (root.jQuery) { // Select2 triggers jQuery-only change events
                const $form = root.jQuery(form), ns = 'change.fv' + (++uid);
                $form.on(ns, 'select', e => onEvent({ type: 'change', target: e.target }));
                inst._listeners.push(() => $form.off(ns));
            }

            if (cfg.focusCleanup) listen(form, 'focusin', e => { const u = unitOf(e.target); if (u && inst._errors.has(u.key)) removeError(u); });

            // capture phase: we see the submit first and can hide invalid submits from other handlers
            if (cfg.interceptSubmit !== false) listen(form, 'submit', e => {
                if (inst._bypass) return;
                if (e.submitter && e.submitter.hasAttribute && e.submitter.hasAttribute('formnovalidate')) return; // e.g. "Save draft"
                if (cfg.skipSubmitter && e.submitter && e.submitter.matches && e.submitter.matches(cfg.skipSubmitter)) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                inst._submitted = true;
                if (inst._busy) return;
                inst._busy = true;
                const submitter = e.submitter;
                validateAll({ submit: true }).then(ok => {
                    inst._busy = false;
                    if (!ok) return;
                    if (isFn(cfg.onSubmit)) {   // AJAX, the short way: your function gets the validated values; it may return { errors: { field: message } } from the server to show them here
                        inst._busy = true;      // no double submit while the request runs
                        return Promise.resolve().then(() => cfg.onSubmit(collectValues(), e, inst)).then(out => {
                            if (out && out.errors && typeof out.errors === 'object') inst.setErrors(out.errors);
                        }).catch(err => { if (root.console) console.error(err); }).then(() => { inst._busy = false; });
                    }
                    if (isFn(cfg.submitHandler)) return cfg.submitHandler(form, e, collectValues());   // the AJAX place: the third argument is the validated data
                    // Hand the form back to the browser on the next task, not now: when every rule is synchronous this callback runs while the browser
                    // is still delivering the user's submit event, and a requestSubmit() made at that moment is silently ignored (the form never posts).
                    setTimeout(() => {
                        inst._bypass = true;
                        try {
                            if (isFn(form.requestSubmit)) {
                                try { form.requestSubmit(submitter || undefined); } catch (err) { form.requestSubmit(); }
                            } else form.submit();
                        } finally { inst._bypass = false; }
                    }, 0);
                }).catch(err => { inst._busy = false; if (root.console) console.error(err); });
            }, true);

            listen(form, 'reset', () => setTimeout(() => inst.resetForm(), 0));
            if (autoCfg) {
                runAutoAttributes();
                listen(form, 'focusin', e => { if (e.target && e.target.name) applyAutoAttributes([e.target]); });   // fields added later
            }
        }

        // ---- valid state: a class on fields that were checked and hold a valid value (reward early)
        function markValid(unit, on) {
            if (!cfg.validClass) return;
            unit.fields.forEach(f => cfg.validClass.split(/\s+/).forEach(c => { if (c) f.classList[on ? 'add' : 'remove'](c); }));
        }
        /** Checks a field without showing anything: true (valid and not empty), false (invalid), null (empty, or it needs a server / async rule, so no answer yet). */
        function peekValid(unit) {
            const rules = rulesFor(unit);
            if (!rules.length || !isActive(unit)) return null;
            const env = readEnv(unit);
            if (env.badInput) return false;
            if (env.empty) return null;
            for (const rule of rules) {
                const def = validators[rule.type];
                if (!def || (isFn(rule.when) && !guard(rule.when, true, env.value, env))) continue;
                if (def.remote) return null;
                let res;
                try { res = def.fn(valueFor(rule, env), rule, env); } catch (e) { return false; }
                if (res && isFn(res.then)) return null;
                if (!normalizeResult(res).valid) return false;
            }
            return true;
        }

        // ---- error summary: one accessible list of every problem, with links to the fields
        const summaryCfg = (() => {
            const s = cfg.errorSummary;
            if (!s) return null;
            const o = typeof s === 'string' || (s && s.nodeType === 1) ? { container: s } : (isObj(s) ? s : {});
            return {
                container: o.container === undefined ? null : o.container,
                title: typeof o.title === 'string' ? o.title : null,
                focus: o.focus === 'field' || o.focus === false ? 'field' : 'summary',
                withLabel: o.withLabel !== false,
                headingLevel: [1, 2, 3, 4, 5, 6].includes(o.headingLevel) ? o.headingLevel : 2,
                className: typeof o.className === 'string' ? o.className : 'fv-summary'
            };
        })();
        let summaryEl = null, summaryOwned = false, summarySig = '';
        function summaryContainer() {
            if (!summaryCfg) return null;
            if (summaryEl && summaryEl.isConnected !== false) return summaryEl;
            const c = summaryCfg.container;
            let el = null;
            if (typeof c === 'string') el = root.document.querySelector(c);
            else if (c && c.nodeType === 1) el = c;
            if (!el) {
                el = root.document.createElement('div');
                form.insertBefore(el, form.firstChild);
                summaryOwned = true;
            }
            if (!el.classList.contains(summaryCfg.className)) el.classList.add(summaryCfg.className);
            el.setAttribute('tabindex', '-1');
            summaryEl = el;
            return el;
        }
        function labelOf(unit) {
            const f = unit.fields[0];
            // text of a node without the messages we placed and without form controls that sit inside a wrapping <label>
            const plain = node => {
                if (!node) return '';
                const c = node.cloneNode(true);
                Array.from(c.querySelectorAll('[data-error-for], input, select, textarea, button, .fv-summary')).forEach(x => x.remove());
                return c.textContent || '';
            };
            let text = '';
            const ref = f.getAttribute('aria-labelledby');
            if (ref) text = ref.split(/\s+/).map(id => plain(root.document.getElementById(id))).join(' ');
            if (!text.trim() && unit.fields.length > 1) { const fs = f.closest('fieldset'); const lg = fs && fs.querySelector('legend'); if (lg) text = plain(lg); }
            if (!text.trim() && f.labels && f.labels.length) text = Array.from(f.labels).map(plain).join(' ');
            if (!text.trim() && f.id) { const l = form.querySelector('label[for="' + esc(f.id) + '"]'); if (l) text = plain(l); }
            if (!text.trim()) text = f.getAttribute('aria-label') || '';
            return text.replace(/\s+/g, ' ').replace(/[*:]\s*$/, '').trim();
        }
        function focusField(unit) {
            const f = unit.fields.find(x => !x.disabled) || unit.fields[0];
            try { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* not focusable */ }
        }
        /** Rebuilds the summary from the errors that are showing now. focus: move keyboard focus to it (after a failed submit). */
        function renderSummary(focus) {
            if (!summaryCfg) return;
            const list = Array.from(inst._errors.values()).filter(r => r.unit.fields[0].isConnected !== false);
            const el = list.length || summaryEl ? summaryContainer() : null;
            if (!el) return;
            list.sort((a, b) => (a.unit.fields[0].compareDocumentPosition(b.unit.fields[0]) & 4) ? -1 : 1);
            const title = summaryCfg.title || cfg.messages.errorSummary || DEFAULT_MESSAGES.errorSummary;
            const sig = JSON.stringify([title, list.map(r => [r.message, r.unit.fields[0].name])]);
            if (!focus && sig === summarySig && !el.hidden) return;   // nothing changed: do not rebuild (and re-announce) the list
            summarySig = sig;
            while (el.firstChild) el.removeChild(el.firstChild);   // fresh nodes every time: screen readers announce new content
            if (!list.length) { el.hidden = true; summarySig = ''; return; }
            const D = root.document;
            const h = D.createElement('h' + summaryCfg.headingLevel);
            h.id = 'fv-summary-title-' + (++uid);
            h.textContent = title;
            const ul = D.createElement('ul');
            list.forEach(r => {
                const f = r.unit.fields[0];
                if (!f.id) f.id = 'fv-field-' + (++uid);
                const li = D.createElement('li'), a = D.createElement('a');
                a.setAttribute('href', '#' + f.id);
                const label = summaryCfg.withLabel ? labelOf(r.unit) : '';
                a.textContent = label && r.message.toLowerCase().indexOf(label.toLowerCase()) < 0 ? label + ': ' + r.message : r.message;
                a.setAttribute('dir', 'auto');
                a.addEventListener('click', e => { e.preventDefault(); focusField(r.unit); });
                li.appendChild(a); ul.appendChild(li);
            });
            el.appendChild(h); el.appendChild(ul);
            el.setAttribute('aria-labelledby', h.id);
            el.hidden = false;
            if (focus) { try { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* not focusable */ } }
        }
        let summaryTimer = null;
        /** ASP.NET's <div data-valmsg-summary="true"><ul></ul></div>: the list of messages and the validation-summary-errors / -valid classes. */
        function renderValSummary() {
            if (!cfg.unobtrusive) return;
            const box = form.querySelector('[data-valmsg-summary="true"]');
            if (!box) return;
            let ul = box.querySelector('ul');
            if (!ul) { ul = root.document.createElement('ul'); box.appendChild(ul); }
            while (ul.firstChild) ul.removeChild(ul.firstChild);
            const list = Array.from(inst._errors.values()).sort((a, b) => (a.unit.fields[0].compareDocumentPosition(b.unit.fields[0]) & 4) ? -1 : 1);
            list.forEach(r => { const li = root.document.createElement('li'); li.textContent = r.message; ul.appendChild(li); });
            box.classList.toggle('validation-summary-errors', list.length > 0);
            box.classList.toggle('validation-summary-valid', list.length === 0);
        }
        const refreshSummary = () => {   // errors come and go one by one: rebuild once per tick, without stealing focus
            if ((!summaryCfg && !cfg.unobtrusive) || summaryTimer) return;
            summaryTimer = setTimeout(() => { summaryTimer = null; renderValSummary(); if (summaryCfg && summaryEl && !summaryEl.hidden) renderSummary(false); }, 0);
        };

        // ---- autoAttributes: type, inputmode, autocomplete and aria-required from the rules and the field names, and a lint for what browsers get wrong
        const autoCfg = (() => {
            const a = cfg.autoAttributes;
            if (!a) return null;
            const o = isObj(a) ? a : {};
            return { type: o.type !== false, inputmode: o.inputmode !== false, autocomplete: o.autocomplete !== false, ariaRequired: o.ariaRequired !== false, lint: o.lint !== false };
        })();
        inst.attributeChanges = [];
        inst.lintIssues = [];
        const attrDone = new WeakMap();   // field -> the rule types it was last set up for
        function applyAutoAttributes(fields) {
            if (!autoCfg) return [];
            const changes = [];
            const byName = new Map();
            (fields || Array.from(form.elements)).forEach(el => {
                if (!el.name || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
                if (attrDone.get(el) === (inst.rules[el.name] || []).map(r => r.type).join()) return;
                if (!byName.has(el.name)) byName.set(el.name, []);
                byName.get(el.name).push(el);
            });
            const passwords = Array.from(form.elements).filter(e => e.type === 'password').length;
            byName.forEach((els, name) => {
                const rules = inst.rules[name] || [];
                const types = rules.map(r => r.type);
                const first = els[0];
                els.forEach(e => attrDone.set(e, types.join()));
                const set = (el, attr, value) => { if (el.hasAttribute(attr) && attr !== 'type') return false; if (attr === 'type' && !(el.getAttribute('type') === null || el.getAttribute('type') === '' || el.getAttribute('type') === 'text')) return false; el.setAttribute(attr, value); changes.push({ field: el, name, attribute: attr, value }); return true; };
                if (autoCfg.ariaRequired && types.includes('required') && !rules.some(r => r.type === 'required' && isFn(r.when))) els.forEach(e => set(e, 'aria-required', 'true'));
                if (first.tagName === 'TEXTAREA') return;
                if (first.type === 'checkbox' || first.type === 'radio' || first.type === 'file' || first.type === 'hidden') return;
                const key = (name + ' ' + (first.id || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                let type = null, inputmode = null, token = null;
                if (types.includes('email')) { type = 'email'; inputmode = 'email'; token = /user|login/.test(key) ? 'username' : 'email'; }
                else if (types.includes('url')) { type = 'url'; inputmode = 'url'; token = 'url'; }
                else if (types.includes('phone')) { type = 'tel'; inputmode = 'tel'; token = 'tel'; }
                else if (types.includes('creditcard')) { inputmode = 'numeric'; token = 'cc-number'; }
                else if (types.includes('digits')) inputmode = 'numeric';
                else if (types.includes('number')) inputmode = 'decimal';
                if (first.type === 'password') {
                    const isNew = types.includes('pwcheck') || rules.some(r => r.type === 'equalTo') || passwords > 1 || /new|confirm|repeat|retype|verify|signup|register|create/.test(key);
                    token = isNew ? 'new-password' : 'current-password';
                }
                if (!token) {
                    const rx = [
                        [/\b(otp|one time|verification code|sms code|2fa|mfa|totp)\b/, 'one-time-code', 'numeric'],
                        [/\b(e ?mail)\b/, 'email'], [/\b(user ?name|userid|user id|login)\b/, 'username'],
                        [/\b(first ?name|fname|given ?name|forename)\b/, 'given-name'], [/\b(last ?name|lname|surname|family ?name)\b/, 'family-name'],
                        [/\b(full ?name|name)\b$/, 'name'], [/\b(mobile|phone|tel|telephone)\b/, 'tel', 'tel'],
                        [/\b(zip|zip ?code|postal|postal ?code|postcode)\b/, 'postal-code'], [/\b(address ?2|address ?line ?2|apt|suite)\b/, 'address-line2'],
                        [/\b(address ?1|address ?line ?1)\b/, 'address-line1'], [/\b(street|address)\b/, 'street-address'],
                        [/\b(city|town)\b/, 'address-level2'], [/\b(state|province|region)\b/, 'address-level1'], [/\b(country)\b/, 'country-name'],
                        [/\b(company|organi[sz]ation|org)\b/, 'organization'], [/\b(birth ?day|birthday|bday|dob|date of birth)\b/, 'bday'],
                        [/\b(card ?number|cc ?num|cc ?number|card ?no)\b/, 'cc-number', 'numeric'], [/\b(cvc|cvv|csc|security code)\b/, 'cc-csc', 'numeric'],
                        [/\b(cc ?exp|card ?expiry|expiry|exp date)\b/, 'cc-exp', 'numeric']
                    ];
                    const hit = rx.find(r => r[0].test(key));
                    if (hit) { token = hit[1]; if (!inputmode && hit[2]) inputmode = hit[2]; }
                }
                if (autoCfg.type && type && /^(INPUT)$/.test(first.tagName)) set(first, 'type', type);
                if (autoCfg.inputmode && inputmode && first.tagName === 'INPUT' && first.type !== 'number') set(first, 'inputmode', inputmode);
                if (autoCfg.autocomplete && token && !first.hasAttribute('autocomplete')) els.forEach(e => set(e, 'autocomplete', token));
            });
            inst.attributeChanges = inst.attributeChanges.concat(changes);
            return changes;
        }
        function lintForm() {
            const issues = [];
            const rulesOf = n => (inst.rules[n] || []).map(r => r.type);
            Array.from(form.elements).forEach(el => {
                if (!el.name || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
                const ac = (el.getAttribute('autocomplete') || '').trim().toLowerCase();
                const key = (el.name + ' ' + (el.id || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
                const known = el.type === 'password' || /\b(e ?mail|user ?name|login|first ?name|last ?name|full ?name|phone|tel|zip|postal|postcode|address|city|card ?number|cvc|cvv)\b/.test(key);
                if ((ac === 'off' || ac === 'false') && known) issues.push({ field: el, name: el.name, code: 'autocomplete-off', message: 'autocomplete="off" on "' + el.name + '": browsers and password managers ignore it for logins and addresses, and it blocks the autofill people rely on.', fix: 'Remove it, or use a specific value such as autocomplete="' + (el.type === 'password' ? 'current-password' : 'email') + '".' });
                if (el.type === 'password' && !ac) issues.push({ field: el, name: el.name, code: 'password-autocomplete', message: 'The password field "' + el.name + '" has no autocomplete value.', fix: 'Use autocomplete="current-password" for logins and "new-password" for sign-up or change-password forms (autoAttributes does this).' });
                const digitish = /\b(otp|one time|code|pin|zip|postal|postcode|phone|tel|card|cvc|cvv|iban|account|ssn|id)\b/.test(key) || ['digits', 'phone', 'creditcard'].some(t => rulesOf(el.name).includes(t));
                if (el.type === 'number' && digitish) issues.push({ field: el, name: el.name, code: 'type-number', message: '"' + el.name + '" looks like an identifier, not a quantity, but uses type="number": leading zeros are lost, the mouse wheel changes the value, and "e" is accepted.', fix: 'Use type="text" with inputmode="numeric" (autoAttributes does this for digits rules).' });
            });
            inst.lintIssues = issues;
            return issues;
        }
        function runAutoAttributes() {
            if (!autoCfg) return;
            applyAutoAttributes();
            if (autoCfg.lint) {
                const issues = lintForm();
                if (issues.length && root.console && console.warn) console.warn('FormValidator autoAttributes: ' + issues.length + ' thing(s) to fix in the form markup:\n' + issues.map(i => ' - [' + i.code + '] ' + i.message + ' ' + i.fix).join('\n'));
            }
        }

        Object.assign(inst, {
            validate: o => validateAll(o),
            getValues: collectValues,
            /** validate, then hand back what to send: { valid, values, errors }. Shows the errors like validate() does. */
            validateAndGetValues: async o => { const valid = await validateAll(o); return { valid, values: collectValues(), errors: inst.getErrors() }; },
            /**
             * An event handler for any framework (React onSubmit, Vue @submit, Angular (ngSubmit), addEventListener): it stops the native submit, validates and,
             * only when the form is valid, calls fn(values, event, inst). If fn returns { errors: { field: message } } (what your server sent back) they are shown
             * on the fields. Resolves to { valid, values, errors, result }.
             */
            handleSubmit: fn => async event => {
                if (event && isFn(event.preventDefault)) event.preventDefault();
                const r = await inst.validateAndGetValues({ submit: true });
                if (!r.valid || !isFn(fn)) return r;
                const out = await fn(r.values, event, inst);
                if (out && out.errors && typeof out.errors === 'object') { inst.setErrors(out.errors); return Object.assign({}, r, { valid: false, errors: inst.getErrors(), result: out }); }
                return Object.assign({}, r, { result: out });
            },
            /** Shows messages from the server on the fields: { Email: 'Already registered' } (a list takes the first message). Names are matched exactly, then ignoring case. Returns the names that match no field. */
            setErrors: map => {
                const names = Array.from(form.elements).map(el => el.name).filter(Boolean), missed = [], byCanon = new Map();
                names.forEach(n => { const c = canonKey(n); if (c !== null) { if (!byCanon.has(c)) byCanon.set(c, n); if (!byCanon.has('~' + c.toLowerCase())) byCanon.set('~' + c.toLowerCase(), n); } });
                Object.keys(map || {}).forEach(key => {
                    const msg = [].concat(map[key])[0], c = canonKey(key);
                    // exact name, then the same path written another way (items.0.qty = items[0][qty] = items[0].qty), then ignoring case
                    const target = names.includes(key) ? key : (c !== null && byCanon.get(c)) || names.find(n => n.toLowerCase() === String(key).toLowerCase()) || (c !== null && byCanon.get('~' + c.toLowerCase()));
                    if (!target || msg === undefined || msg === null || !inst.setError(target, String(msg))) missed.push(key);
                    else inst._serverNames.add(target);
                });
                return missed;
            },
            /**
             * Shows what a backend answered (problem+json, Laravel, Django REST, ASP.NET, FastAPI, Zod ...) on the fields: see FormValidator.serverErrors().
             * Resolves to { errors, all, form, format, missed }: `form` are the messages that belong to no field, `missed` the field names that match no input.
             * options.clear (default false) removes the earlier server messages first.
             */
            setServerErrors: (body, options) => {
                const r = serverErrors(body, options);
                if (options && options.clear) inst.clearServerErrors();
                const missed = inst.setErrors(r.all);
                return Object.assign({}, r, { missed });
            },
            clearServerErrors: () => { Array.from(inst._serverNames).forEach(n => inst.clearError(n)); inst._serverNames.clear(); },
            /**
             * Precognition: sends the current values to your real endpoint (url) and shows the field errors it answers, without saving anything.
             * validateOnServer(url, { only: ['email'], method, headers, ... }). `only` limits what is reported (and shown); default is every field.
             * A newer call cancels an older one. Resolves to the precognition() result plus { missed }. valid === null means "could not check": nothing is changed.
             */
            validateOnServer: async (url, options) => {
                const o = Object.assign({}, typeof url === 'object' && url ? url : { url }, options);
                const names = o.only === undefined ? null : [].concat(o.only);
                if (inst._serverAbort) inst._serverAbort.abort();
                const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
                inst._serverAbort = ctrl;
                const token = ++inst._serverToken;
                const r = await precognition(o.url, collectValues(), Object.assign({}, o, { only: names === null ? undefined : names, signal: ctrl ? ctrl.signal : o.signal }));
                if (token !== inst._serverToken || r.aborted) return Object.assign({}, r, { aborted: true, valid: null });
                if (inst._serverAbort === ctrl) inst._serverAbort = null;
                if (r.valid === null) return r;
                // fields that were asked about and now pass lose an earlier server message
                const asked = names === null ? Array.from(inst._serverNames) : Array.from(form.elements).map(el => el.name).filter(n => n && names.some(x => canonKey(x) === canonKey(n)));
                asked.forEach(n => { if (!Object.prototype.hasOwnProperty.call(r.errors, canonKey(n)) && inst._serverNames.has(n)) { inst.clearError(n); inst._serverNames.delete(n); } });
                const missed = inst.setErrors(r.all);
                return Object.assign({}, r, { missed });
            },
            /**
             * Live server checks like Laravel Precognition: when the user leaves a field that passes the browser rules and holds a value, only that field is checked
             * on the server (validateOnServer with only: [name]). options: url, delay (ms, default 200), exclude (names), validateEmpty, excludePasswords (default true),
             * plus the validateOnServer options. Returns a function that stops it.
             */
            watchServer: (url, options) => {
                const o = Object.assign({}, typeof url === 'object' && url ? url : { url }, options), delay = typeof o.delay === 'number' ? o.delay : 200;
                const timers = new Map();
                const handler = e => {
                    const el = e.target;
                    if (!el || !el.name || el.disabled || el.type === 'file' || (el.type === 'password' && o.excludePasswords !== false) || [].concat(o.exclude || []).includes(el.name)) return;
                    clearTimeout(timers.get(el.name));
                    timers.set(el.name, setTimeout(() => {
                        timers.delete(el.name);
                        if (inst.getErrors().some(x => x.name === el.name && !inst._serverNames.has(el.name))) return;   // the browser rules already complain
                        const v = collectValues()[el.name];
                        if (!o.validateEmpty && (v === '' || v === undefined || v === null || (Array.isArray(v) && !v.length))) return;
                        inst.validateOnServer(Object.assign({}, o, { only: [el.name] })).catch(() => {});
                    }, delay));
                };
                ['change', 'focusout'].forEach(t => form.addEventListener(t, handler));
                const stop = () => { ['change', 'focusout'].forEach(t => form.removeEventListener(t, handler)); timers.forEach(clearTimeout); timers.clear(); };
                inst._listeners.push(stop);
                return stop;
            },
            validateSync: o => validateAllSync(o),
            validateElementSync: (el, o) => { const u = unitOf(el); return u ? validateUnitSync(u, o) : true; },
            validateElement: (el, o) => { const u = unitOf(el); return u ? validateUnit(u, o) : Promise.resolve(true); },
            unitOf,
            units: unitsFor,
            allUnits,
            readValue: unit => readEnv(unit),
            getErrors: () => Array.from(inst._errors.values()).map(r => ({ name: r.unit.fields[0].name, field: r.unit.fields[0], fields: r.unit.fields, message: r.message, code: r.code, rule: r.code, el: r.el })),
            setError: (name, message, code) => { const u = unitsFor(name)[0]; if (u) showError(u, message, code || 'server'); return !!u; },
            /** The problems with this form's markup that browsers and password managers trip over (autocomplete="off" on logins, type="number" for codes ...). */
            lint: () => lintForm(),
            /** Applies autoAttributes to fields that were added after init (it also happens when such a field gets focus). */
            refreshAttributes: () => applyAutoAttributes(),
            /** Rebuilds the error summary (errorSummary option) from the errors that show now; focus: true moves keyboard focus to it. */
            showSummary: focus => { if (summaryCfg) renderSummary(!!focus); return summaryEl; },
            clearError: name => unitsFor(name).forEach(removeError),
            resetForm: () => { inst.clearErrors(); inst._submitted = false; inst._tokens.clear(); },
            isSubmitted: () => inst._submitted,
            validateField: name => Promise.all(unitsFor(name).map(u => validateUnit(u))).then(r => r.every(Boolean)),
            clearErrors: () => { allUnits().forEach(removeError); Array.from(inst._errors.values()).forEach(r => removeError(r.unit)); },
            setRules: (name, rules) => { inst.rules[name] = normalizeRules(rules); wildCache = null; },
            addRules: (name, rules) => { inst.rules[name] = (inst.rules[name] || []).concat(normalizeRules(rules)); wildCache = null; },
            removeRules: name => { delete inst.rules[name]; wildCache = null; unitsFor(name).forEach(removeError); },
            destroy: () => {
                inst._listeners.forEach(off => off());
                inst._listeners.length = 0;
                inst._timers.forEach(clearTimeout);
                if (inst._deferred) inst._deferred.clear();
                inst._aborters.forEach(a => a.abort());
                inst.clearErrors();
                if (summaryTimer) { clearTimeout(summaryTimer); summaryTimer = null; }
                if (summaryEl) { while (summaryEl.firstChild) summaryEl.removeChild(summaryEl.firstChild); if (summaryOwned) summaryEl.remove(); else summaryEl.hidden = true; summaryEl = null; }
                if (cfg.novalidate) form.noValidate = !!inst._hadNoValidate;
                delete form._fvInstance; delete form._manualValidate;
            },
            attach
        });
        return inst;
    }

    // ------------------------------------------------------------------ ASP.NET unobtrusive validation: data-val-* attributes (MVC 5 / Razor / Core tag helpers)
    const UNOB = {};   // adapter name (lower case) -> { params: [...], fn(options) }
    const unobWarned = new Set();
    /** FormValidator.unobtrusive.adapters: the same three helpers as $.validator.unobtrusive.adapters, so existing custom adapters keep working. */
    const unobAdapters = {
        /** add('name', ['p1', 'p2'], function (options) { options.rules.myRule = { p1: options.params.p1 }; options.messages.myRule = options.message; }) */
        add(name, params, fn) {
            if (isFn(params)) { fn = params; params = []; }
            if (typeof name !== 'string' || !name || !isFn(fn)) throw new Error('unobtrusive.adapters.add: a name and a function are needed');
            UNOB[name.toLowerCase()] = { params: [].concat(params || []), fn };
            return unobAdapters;
        },
        /** addBool('email') or addBool('foo', 'fooRule'): data-val-foo="msg" turns the rule on. */
        addBool(name, ruleName) {
            return unobAdapters.add(name, [], o => { o.rules[ruleName || name] = true; o.messages[ruleName || name] = o.message; });
        },
        /** addSingleVal('minlength', 'min'): data-val-minlength-min="3" gives rule minlength = 3. */
        addSingleVal(name, attribute, ruleName) {
            return unobAdapters.add(name, [attribute || 'val'], o => { o.rules[ruleName || name] = o.params[attribute || 'val']; o.messages[ruleName || name] = o.message; });
        },
        /** addMinMax('length', 'minlength', 'maxlength', 'rangelength'): min only, max only, or both. */
        addMinMax(name, minRule, maxRule, minMaxRule, minAttr, maxAttr) {
            minAttr = minAttr || 'min'; maxAttr = maxAttr || 'max';
            return unobAdapters.add(name, [minAttr, maxAttr], o => {
                const min = o.params[minAttr], max = o.params[maxAttr], has = v => v !== undefined && v !== null && v !== '';
                if (has(min) && has(max)) { o.rules[minMaxRule] = [min, max]; o.messages[minMaxRule] = o.message; }
                else if (has(min)) { o.rules[minRule] = min; o.messages[minRule] = o.message; }
                else if (has(max)) { o.rules[maxRule] = max; o.messages[maxRule] = o.message; }
            });
        }
    };
    ['email', 'url', 'creditcard', 'number', 'digits', 'date', 'phone'].forEach(n => unobAdapters.addBool(n));
    unobAdapters.addBool('required');
    unobAdapters.addMinMax('length', 'minlength', 'maxlength', 'rangelength');
    unobAdapters.addSingleVal('minlength', 'min');
    unobAdapters.addSingleVal('maxlength', 'max');
    unobAdapters.addMinMax('range', 'min', 'max', 'range');
    unobAdapters.add('regex', ['pattern'], o => {
        const p = o.params.pattern;
        if (p === undefined || p === '') return;
        try { new RegExp('^(?:' + p + ')$'); } catch (e) { if (root.console) console.warn('FormValidator unobtrusive: the data-val-regex-pattern of "' + o.element.name + '" is not a valid JavaScript regular expression and is ignored: ' + p); return; }
        o.rules.pattern = { pattern: '^(?:' + p + ')$' };   // MVC matches the whole value
        o.messages.pattern = o.message;
    });
    unobAdapters.add('equalto', ['other'], o => {
        const other = o.params.other;
        if (!other) return;
        o.rules.equalTo = { target: other.indexOf('*.') === 0 ? o.prefix + other.slice(2) : other };
        o.messages.equalTo = o.message;
    });
    unobAdapters.add('fileextensions', ['extensions'], o => {
        const list = String(o.params.extensions || '').split(/[,\s]+/).filter(Boolean).map(x => '.' + x.replace(/^\./, '').toLowerCase());
        if (!list.length) return;
        o.rules.file = { accept: list.join(',') };
        o.messages.file = o.message;
    });
    unobAdapters.add('remote', ['url', 'type', 'additionalfields'], o => {
        const url = o.params.url;
        if (!url) return;
        const data = {};
        String(o.params.additionalfields || '').split(',').map(s => s.trim()).filter(Boolean).forEach(n => {
            const name = n.indexOf('*.') === 0 ? o.prefix + n.slice(2) : n;
            data[name] = () => { const vals = o.collect(); const v = vals[name]; return Array.isArray(v) ? v.join(',') : (v === undefined ? '' : v); };
        });
        o.rules.remote = { url, method: String(o.params.type || 'GET').toUpperCase(), encoding: 'form', data, serverMessage: true };   // MVC's [Remote] reads a classic form body / query string
        o.messages.remote = o.message;
    });
    const unobtrusive = {
        adapters: unobAdapters,
        /**
         * Starts FormValidator on every form under `scope` (default: the document) that holds data-val="true" fields, reading the rules from the data-val-* attributes
         * that ASP.NET MVC / Razor / Core render. Returns the instances. Call it again after inserting HTML with AJAX (fields added to an initialised form are picked up
         * by themselves; this is for new forms). config: any FormValidator config.
         */
        parse(scope, config) {
            const doc = root.document;
            let node = scope === undefined || scope === null ? doc : (typeof scope === 'string' ? doc.querySelector(scope) : scope);
            if (node && node.jquery) node = node[0];
            if (!node) return [];
            const forms = [];
            if (node.nodeType === 1 && node.tagName === 'FORM') forms.push(node);
            else if (node.nodeType === 1 && node.closest && node.closest('form')) forms.push(node.closest('form'));
            if (node.querySelectorAll) Array.from(node.querySelectorAll('form')).forEach(f => { if (!forms.includes(f)) forms.push(f); });
            return forms.filter(f => f.querySelector('[data-val="true"]')).map(f => f._fvInstance || init({ form: f, rules: {}, config: Object.assign({ unobtrusive: true }, config) }));
        },
        /** parse() when the page is ready, and again for forms that are added later (partial views, AJAX, modals). Returns a function that stops it. */
        auto(config) {
            const doc = root.document;
            const run = () => unobtrusive.parse(doc, config);
            if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run, { once: true }); else run();
            let mo = null, timer = null;
            if (typeof root.MutationObserver === 'function' && doc.body) {
                mo = new root.MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 20); });
                mo.observe(doc.body, { childList: true, subtree: true });
            }
            return () => { if (mo) mo.disconnect(); clearTimeout(timer); doc.removeEventListener('DOMContentLoaded', run); };
        }
    };

    // ------------------------------------------------------------------ public API
    function init(options) {
        options = options || {};
        const targets = [].concat(options.formId !== undefined ? options.formId : options.form);
        const instances = targets.map(t => {
            const form = resolveForm(t);
            if (!form) throw new Error(`Form "${t && t.id ? t.id : t}" not found`);
            if (form._fvInstance) form._fvInstance.destroy();
            const inst = createInstance(form, { rules: options.rules, config: options.config, context: options.context, messages: options.messages });
            inst.attach();
            form._fvInstance = inst;
            form._manualValidate = () => inst.validate(); // legacy hook
            return inst;
        });
        return Array.isArray(options.formId) ? instances : instances[0];
    }

    async function validate(target, rules) {
        const form = resolveForm(target);
        if (!form) throw new Error(`Form "${target}" not found`);
        if (!rules) {
            if (!form._fvInstance) throw new Error('Form not initialized with validator');
            return form._fvInstance.validate();
        }
        // ad-hoc rules: reuse the form's config when it has been initialised
        const base = form._fvInstance;
        const tmp = createInstance(form, { rules, config: base ? base.config : {}, context: base ? base.context : {} });
        return tmp.validate();
    }

    /**
     * jQuery's  $(form).valid()  without jQuery: true or false, right now, and the errors are shown. Use it for a direct submit or before your own AJAX call:
     *   form.addEventListener('submit', e => { if (!FormValidator.isValid(form)) e.preventDefault(); });          // direct: only a valid form goes through
     *   if (FormValidator.isValid(form)) fetch('/api', { method: 'POST', body: JSON.stringify(inst.getValues()) });  // AJAX
     * Rules that need to wait (remote, file checks) count as valid for now and show their result when it arrives; validate() (async) waits for them.
     * Needs FormValidator.init(...) first, or pass rules: FormValidator.isValid(form, { email: ['required', 'email'] }).
     */
    function isValid(target, rules) {
        const form = resolveForm(target);
        if (!form) throw new Error(`Form "${target}" not found`);
        if (!rules) {
            if (!form._fvInstance) throw new Error('Form not initialized with validator');
            return form._fvInstance.validateSync();
        }
        const base = form._fvInstance;
        return createInstance(form, { rules, config: base ? base.config : {}, context: base ? base.context : {} }).validateSync();
    }

    // ------------------------------------------------------------------ values without a form (Node, servers, unit tests)
    const NEEDS_FORM = ['file', 'fileType', 'fileSize', 'minFiles', 'maxFiles', 'minChecked', 'maxChecked'];
    /**
     * Checks one value against the same rules the form uses, with no DOM:
     *   FormValidator.checkValue('a@b', ['required', 'email'])            -> { valid: false, rule: 'email', message: 'Please enter a valid email address.' }
     *   FormValidator.checkValue('x', { equalTo: 'password' }, { values: { password: 'y' } })
     * Rules: everything except file, checkbox-count and remote rules (they need a form, files or a server). Synchronous only (no async custom rules).
     * options: trim (default true; pwcheck never trims), values (other fields, for equalTo / notEqualTo), messages ({ rule: text }), passwordStrength, context.
     */
    function checkValue(value, rules, options) { return checkRules(value, normalizeRules(rules), options || {}); }

    /** checkValue for rules that are already normalised (schema() does that once, not on every call). */
    function checkRules(value, list, o) {
        const raw = value == null ? '' : String(value);
        const trimmed = o.trim === false ? raw : raw.trim();
        let env = null;
        for (const rule of list) {
            const def = validators[rule.type];
            if (!def) throw new Error('checkValue: unknown rule "' + rule.type + '"');
            if (def.remote || NEEDS_FORM.includes(rule.type)) throw new Error('checkValue: the "' + rule.type + '" rule needs a form, files or a server and cannot run on a plain value');
            const v = rule.type === 'pwcheck' ? raw : trimmed;
            const empty = v === '';
            if (!env) env = { value: v, empty, count: empty ? 0 : 1, files: null, field: null, fields: [], form: null, inst: null, badInput: false,
                config: { passwordStrength: o.passwordStrength || {} }, context: o.context || {}, column: o.column, index: o.index, array: o.array };
            else { env.value = v; env.empty = empty; env.count = empty ? 0 : 1; }
            if (isFn(rule.when) && !guard(rule.when, true, v, env)) continue;
            if (empty && !def.runOnEmpty && rule.type !== 'equalTo') continue;
            let res;
            if (rule.type === 'equalTo' || rule.type === 'notEqualTo') {
                const other = o.values && rule.target in o.values ? String(o.values[rule.target] == null ? '' : o.values[rule.target]) : undefined;
                if (other === undefined) throw new Error('checkValue: pass the other field in options.values for the "' + rule.type + '" rule');
                res = rule.type === 'equalTo' ? v === other.trim() || v === other : v !== other.trim() && v !== other;
                if (rule.type === 'notEqualTo' && empty) continue;
            } else {
                res = def.fn(rule.normalizer ? rule.normalizer(v, null) : v, rule, env);
            }
            if (res && isFn(res.then)) throw new Error('checkValue: the "' + rule.type + '" rule is asynchronous; use a form for it');
            const r = normalizeResult(res);
            if (!r.valid) {
                const custom = typeof rule.message === 'string' ? rule.message : (o.messages && o.messages[rule.type]) || r.message || DEFAULT_MESSAGES[rule.type] || 'Invalid value.';
                return { valid: false, rule: rule.type, code: typeof rule.code === 'string' && rule.code ? rule.code : rule.type, message: format(fmt(custom, rule), paramsOf(rule)) };
            }
        }
        return { valid: true, rule: null, code: null, message: '' };
    }

    // ---- paths: 'user.email', 'items[0].qty', wildcards 'items[].qty' / 'items.*.qty' (every row)
    const isWild = t => t === '' || t === '*';
    /** Rule key -> tokens ('' and '*' match every index), or null when unsafe. A plain key without path characters is one token. */
    function ruleTokens(key) {
        const t = pathTokens(String(key));
        if (!t) return null;
        return t.map(x => (typeof x === 'string' && /^[0-9]+$/.test(x) ? +x : x));
    }
    const hasPathChars = key => /[.\[*]/.test(key);
    /** Every concrete place a (wildcard) path points to in `data`: [{ tokens, value, parent }]. A missing plain path gives one entry with value undefined; a wildcard over nothing gives none. */
    function expandPath(data, tokens) {
        const out = [];
        const step = (node, i, acc) => {
            if (i === tokens.length) { out.push({ tokens: acc, value: node }); return; }
            const t = tokens[i];
            if (isWild(t)) {
                if (Array.isArray(node)) node.forEach((child, idx) => step(child, i + 1, acc.concat([idx])));
                else if (node && typeof node === 'object') Object.keys(node).forEach(k => { if (BAD_KEYS.indexOf(k) < 0) step(node[k], i + 1, acc.concat([k])); });
                return;
            }
            if (BAD_KEYS.indexOf(t) >= 0) return;
            const child = node !== null && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, t) ? node[t] : undefined;
            step(child, i + 1, acc.concat([t]));
        };
        step(data, 0, []);
        return out;
    }
    /** { 'user.email': .., 'items[0].qty': .. }: every leaf of a nested object by canonical path (capped) */
    function flatten(data) {
        const out = {};
        let n = 0;
        const walk = (node, path, depth) => {
            if (n > 5000 || depth > 12) return;
            if (node !== null && typeof node === 'object' && !(typeof Blob === 'function' && node instanceof Blob)) {
                Object.keys(node).forEach(k => { if (BAD_KEYS.indexOf(k) < 0) walk(node[k], path.concat([Array.isArray(node) ? +k : k]), depth + 1); });
            } else if (path.length) { out[canonKey(path)] = node; n++; }
        };
        walk(data, [], 0);
        return out;
    }
    function targetsIn(rules) {
        const list = [];
        (Array.isArray(rules) ? rules : normalizeRules(rules)).forEach(r => { if ((r.type === 'equalTo' || r.type === 'notEqualTo') && r.target) list.push(String(r.target).replace(/^#/, '')); });
        return list;
    }

    /**
     * Checks a whole object (a JSON request body, a model) against { field: rules }:
     *   FormValidator.checkValues(body, { email: ['required', 'email'], pw: { required: true, pwcheck: { minLength: 8 } }, pw2: { equalTo: 'pw' } })
     *   -> { valid, errors: { field: message }, details: { field: { rule, code, message } } }
     * Keys may be paths into nested data and arrays: 'user.email', 'items[0].qty', and wildcards for every row: 'items[].qty' (or 'items.*.qty').
     * Errors are keyed by the concrete path ('items[1].qty'). Array rules on the array itself: { items: { minItems: 1, maxItems: 10 } };
     * rules on a wildcard column may use `unique` ({ 'items[].sku': ['required', { type: 'unique', ignoreCase: true }] }).
     * equalTo / notEqualTo targets are looked up in the same row first ('items[].password' + target 'confirm'), then as an absolute path.
     */
    function checkValues(data, schema, options) { return runValues(data, schema, options || {}, false); }

    /** The work of checkValues. `normalized`: the rules per key are already lists of rule objects (schema() prepares them once). */
    function runValues(data, schema, o, normalized, meta) {
        const errors = {}, details = {};
        const keys = meta ? meta.keys : Object.keys(schema || {});
        const hasOwn = Object.prototype.hasOwnProperty;
        const pathKeys = meta ? (meta.pathKeys.length ? meta.pathKeys.filter(k => !(data && hasOwn.call(data, k))) : meta.pathKeys) : keys.filter(k => hasPathChars(k) && !(data && hasOwn.call(data, k)));
        const flat = pathKeys.length ? flatten(data) : null;
        const fail = (key, r) => { if (!(key in errors)) { errors[key] = r.message; details[key] = { rule: r.rule, code: r.code, message: r.message }; } };
        let base = null;   // the other fields, for equalTo / notEqualTo: built once, and only when a rule asks
        const baseValues = () => base || (base = Object.assign({}, data, flat, o.values));
        keys.forEach(name => {
            const list = normalized ? schema[name] : normalizeRules(schema[name]);
            const m = meta ? meta.by[name] : null;
            const wantsArray = m ? m.wantsArray : list.some(r => r.type === 'minItems' || r.type === 'maxItems');
            const needsValues = m ? m.needsValues : list.some(r => r.type === 'equalTo' || r.type === 'notEqualTo');
            if (pathKeys.indexOf(name) < 0) {   // a plain field, like before
                const val = data ? data[name] : undefined;
                const opts = (needsValues || wantsArray) ? Object.assign({}, o, { values: needsValues ? baseValues() : o.values, array: wantsArray ? (Array.isArray(val) ? val : (val == null ? [] : null)) : undefined }) : o;
                const r = checkRules(val, list, opts);
                if (!r.valid) fail(name, r);
                return;
            }
            const tokens = ruleTokens(name);
            if (!tokens) return;
            const entries = expandPath(data, tokens);
            const wild = tokens.some(isWild);
            const column = wild ? entries.map(e => (e.value == null ? '' : String(e.value).trim())) : undefined;
            const targets = targetsIn(list);
            entries.forEach((e, idx) => {
                const values = needsValues ? (targets.length ? Object.create(baseValues()) : baseValues()) : o.values;   // one shared copy: rows only add what they override
                targets.forEach(t => {   // the same row first
                    const tt = ruleTokens(t);
                    if (!tt) return;
                    const rel = expandPath(data, e.tokens.slice(0, -1).concat(tt));
                    if (rel.length && rel[0].value !== undefined) values[t] = rel[0].value;
                });
                const val = e.value;
                const r = checkRules(val !== null && typeof val === 'object' && !Array.isArray(val) ? '' : (Array.isArray(val) ? '' : val), list,
                    Object.assign({}, o, { values, column, index: idx, array: wantsArray ? (Array.isArray(val) ? val : (val == null ? [] : null)) : undefined }));
                if (!r.valid) fail(canonKey(e.tokens), r);
            });
        });
        return { valid: Object.keys(errors).length === 0, errors, details };
    }

    // ------------------------------------------------------------------ schema: the rules as a Standard Schema (https://standardschema.dev)
    /** What parse() throws: `error.issues` is the Standard Schema issue list, `error.errors` is { field: message }. */
    /** { field: first message } from Standard Schema issues; nested paths are keyed 'items[1].qty'. */
    function errorsOfIssues(issues) {
        const errors = {};
        issues.forEach(i => { const k = i.path && i.path.length ? (i.path.length === 1 ? i.path[0] : canonKey(i.path)) : undefined; if (k !== undefined && k !== null && !(k in errors)) errors[k] = i.message; });
        return errors;
    }
    class ValidationError extends Error {
        constructor(issues) {
            super(issues.length ? issues[0].message : 'Validation failed');
            this.name = 'ValidationError';
            this.issues = issues;
            this.errors = errorsOfIssues(issues);
        }
    }

    /**
     * The rules of an object as ONE schema that every Standard Schema consumer understands (React Hook Form, TanStack Form, Hono, tRPC, ...):
     *   const signup = FormValidator.schema({ email: ['required', 'email'], password: { required: true, pwcheck: { minLength: 8 } }, confirm: { equalTo: 'password' } });
     *   signup.parse(req.body)       -> { email, password, confirm } (trimmed text) or throws ValidationError
     *   signup.safeParse(req.body)   -> { success: true, data } | { success: false, error, errors: { confirm: 'Values do not match.' }, issues }
     *   signup['~standard'].validate(value)    -> { value } | { issues: [{ message, path: ['confirm'], rule: 'equalTo' }] }
     * Same engine and same messages as checkValues(): no file, checkbox-count or remote rules, synchronous. Fields that are not in the rules are dropped from `data`.
     * options: the checkValues options (trim, messages, passwordStrength, context).
     */
    function schema(rulesMap, options) {
        const rules = rulesMap && typeof rulesMap === 'object' ? rulesMap : {};
        const fields = Object.keys(rules);
        const keepsRaw = Object.create(null), compiled = Object.create(null);
        fields.forEach(f => { compiled[f] = normalizeRules(rules[f]); keepsRaw[f] = compiled[f].some(r => r.type === 'pwcheck'); });   // rules are read once; passwords are never trimmed
        const o = options || {};

        const pathFields = fields.filter(f => hasPathChars(f));
        const meta = { keys: fields, pathKeys: pathFields, by: Object.create(null) };   // what runValues would otherwise work out on every call
        fields.forEach(f => { meta.by[f] = { wantsArray: compiled[f].some(r => r.type === 'minItems' || r.type === 'maxItems'), needsValues: compiled[f].some(r => r.type === 'equalTo' || r.type === 'notEqualTo') }; });
        function run(input) {
            if (input === null || typeof input !== 'object' || Array.isArray(input)) return { issues: [{ message: 'Expected an object.', path: [] }] };
            const data = Object.assign({}, input);
            fields.forEach(f => { if (pathFields.indexOf(f) < 0 && data[f] == null) data[f] = ''; });     // a field that is not there is blank (equalTo may point at it)
            const res = runValues(data, compiled, o, true, meta);
            if (!res.valid) {
                const issues = Object.keys(res.errors).map(k => {
                    const tokens = pathFields.length && (hasPathChars(k) && !(k in input)) ? (ruleTokens(k) || [k]) : [k];
                    return { message: res.errors[k], path: tokens, rule: res.details[k].rule, code: res.details[k].code };
                });
                // flat fields keep the order of the rules, nested ones follow
                const order = k => { const i = fields.indexOf(k); return i < 0 ? fields.length : i; };
                issues.sort((x, y) => order(x.path.length === 1 ? x.path[0] : '') - order(y.path.length === 1 ? y.path[0] : ''));
                return { issues };
            }
            const value = {};
            fields.forEach(f => {
                if (pathFields.indexOf(f) < 0) { const raw = input[f] == null ? '' : String(input[f]); value[f] = keepsRaw[f] || o.trim === false ? raw : raw.trim(); return; }
                const tokens = ruleTokens(f);
                if (!tokens) return;
                expandPath(input, tokens).forEach(e => {
                    if (e.value !== null && typeof e.value === 'object') return;
                    const raw = e.value == null ? '' : String(e.value);
                    let node = value;
                    e.tokens.forEach((t, i) => {
                        if (i === e.tokens.length - 1) { node[t] = keepsRaw[f] || o.trim === false ? raw : raw.trim(); return; }
                        if (node[t] === undefined || node[t] === null || typeof node[t] !== 'object') node[t] = typeof e.tokens[i + 1] === 'number' ? [] : {};
                        node = node[t];
                    });
                });
            });
            return { value };
        }

        const api = {
            '~standard': { version: 1, vendor: 'form-and-file-validator', validate: run },
            rules,
            fields,
            safeParse(data) {
                const r = run(data);
                if (!r.issues) return { success: true, data: r.value, errors: {}, issues: [] };
                const issues = r.issues, errors = errorsOfIssues(issues);
                let error = null;   // an Error object is only built (and its stack captured) when somebody reads it: safeParse stays cheap on invalid data
                return { success: false, get error() { return error || (error = new ValidationError(issues)); }, errors, issues };
            },
            parse(data) {
                const r = run(data);
                if (r.issues) throw new ValidationError(r.issues);
                return r.value;
            },
            check: data => runValues(data, compiled, o, true, meta)
        };
        return api;
    }

    // ------------------------------------------------------------------ parseFormData: flat form fields -> nested object
    const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
    const MAX_INDEX = 999, MAX_DEPTH = 20;
    /** "a.b[0].c" -> ['a','b',0,'c'];  "tags[]" -> ['tags','']  ('' = append);  "a[b]" -> ['a','b']. null when the key is unusable or unsafe. */
    function pathTokens(key) {
        const out = [], re = /([^.[\]]+)|\[([^\]]*)\]/g;
        let m, last = 0;
        while ((m = re.exec(key))) {
            const dotted = key.charAt(m.index - 1) === '.' && m.index === last + 1 && out.length > 0;
            if (m.index !== last && !dotted) return null;   // stray "]" or "." where a name should start
            last = re.lastIndex;
            let name = m[1] !== undefined ? m[1] : m[2];
            if (m[1] === undefined && out.length === 0) return null;   // key cannot start with [
            if (m[1] === undefined && /^[0-9]+$/.test(name)) { if (+name > MAX_INDEX) return null; name = +name; }
            else if (m[1] === undefined && name === '') name = '';
            else if (BAD_KEYS.indexOf(name) >= 0) return null;
            out.push(name);
        }
        return out.length && out.length <= MAX_DEPTH && last === key.length ? out : null;
    }
    const NUMERIC_TEXT = /^-?(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,15})?$/;
    function coerceText(v) {
        if (typeof v !== 'string') return v;
        if (v === 'true') return true;
        if (v === 'false') return false;
        return NUMERIC_TEXT.test(v) ? Number(v) : v;
    }
    /**
     * Turns the flat fields of a <form>, FormData, URLSearchParams, an entry list or a plain { 'a.b[0]': value } object into the nested object your schema expects.
     *   name="user.email"  -> { user: { email } }      name="items[0].qty" -> { items: [{ qty }] }      name="tags[]" -> { tags: [...] }
     *   the same name twice (checkbox groups, multiple selects) -> an array         keys like __proto__ or items[100000] are dropped
     * Options: { coerce: true } turns "42", "3.5", "true", "false" into numbers and booleans (text such as "007" stays text, so zip codes survive).
     */
    function parseFormData(input, options) {
        const o = options || {};
        let entries;
        if (input && typeof input.elements === 'object' && typeof FormData === 'function') entries = Array.from(new FormData(input).entries());
        else if (Array.isArray(input)) entries = input;
        else if (input && typeof input.entries === 'function') entries = Array.from(input.entries());
        else if (input && typeof input[Symbol.iterator] === 'function') entries = Array.from(input);
        else if (input && typeof input === 'object') entries = Object.keys(input).map(k => [k, input[k]]);
        else entries = [];
        const root = {};
        for (const pair of entries) {
            const tokens = pathTokens(String(pair[0]));
            if (!tokens) continue;
            const value = o.coerce ? coerceText(pair[1]) : pair[1];
            let node = root;
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i], isLast = i === tokens.length - 1;
                if (Array.isArray(node) && t === '') { if (isLast) node.push(value); else { const c = typeof tokens[i + 1] === 'number' || tokens[i + 1] === '' ? [] : {}; node.push(c); node = c; } continue; }
                if (isLast) {
                    if (!Object.prototype.hasOwnProperty.call(node, t)) node[t] = value;
                    else if (Array.isArray(node[t])) node[t].push(value);
                    else node[t] = [node[t], value];
                    continue;
                }
                const next = tokens[i + 1];
                let child = Object.prototype.hasOwnProperty.call(node, t) ? node[t] : undefined;
                if (child === null || typeof child !== 'object' || (typeof next === 'number' || next === '' ? !Array.isArray(child) : Array.isArray(child))) {
                    child = typeof next === 'number' || next === '' ? [] : {};
                    node[t] = child;
                }
                node = child;
            }
        }
        return root;
    }

    // ------------------------------------------------------------------ server errors: any backend's validation response -> { field: message }
    /** Canonical field key: 'items.0.qty', 'items[0][qty]' and ['items', 0, 'qty'] all become 'items[0].qty'. null for unsafe keys. */
    function canonKey(key) {
        let tokens;
        if (Array.isArray(key)) {
            tokens = key.map(p => (typeof p === 'number' ? p : (/^[0-9]+$/.test(String(p)) ? +p : String(p))));
            if (tokens.some(p => typeof p === 'string' && BAD_KEYS.indexOf(p) >= 0)) return null;
        } else {
            const s = String(key);
            tokens = pathTokens(s);
            if (!tokens) tokens = s.split('.').filter(Boolean).some(p => BAD_KEYS.indexOf(p) >= 0) ? null : [s];
            else tokens = tokens.map(p => (typeof p === 'string' && /^[0-9]+$/.test(p) ? +p : p));
        }
        if (!tokens || !tokens.length) return null;
        let out = '';
        tokens.forEach((t, i) => { out += typeof t === 'number' ? '[' + t + ']' : t === '' ? '[]' : (i ? '.' : '') + t; });
        return out;
    }
    /** Path parts of a response key, or null when a part is unsafe (__proto__ ...). */
    function keyParts(key) {
        const t = pathTokens(key);
        if (t) return t.some(p => typeof p === 'string' && BAD_KEYS.indexOf(p) >= 0) ? null : t;
        return String(key).split(/[.\[\]]/).some(p => BAD_KEYS.indexOf(p) >= 0) ? null : [key];
    }
    const MESSAGE_KEYS = ['message', 'msg', 'detail', 'title', 'description', 'error', 'reason'];
    const MESSAGE_OBJECT_KEYS = ['message', 'msg', 'code', 'type', 'detail', 'title', 'description', 'error', 'reason', 'field', 'path', 'rule', 'ctx', 'input', 'url', 'severity', 'params', 'keyword', 'schemaPath'];
    /** A string for a message-like value (string, number, { message }), else null. */
    function messageText(m, depth) {
        if (typeof m === 'string') return m.trim() || null;
        if (typeof m === 'number' && isFinite(m)) return String(m);
        if (m && typeof m === 'object' && !Array.isArray(m) && (depth || 0) < 2) {
            for (const k of MESSAGE_KEYS) { const t = messageText(m[k], (depth || 0) + 1); if (t) return t; }
        }
        return null;
    }
    const isMessageObject = o => o && typeof o === 'object' && !Array.isArray(o) && messageText(o) !== null && Object.keys(o).every(k => MESSAGE_OBJECT_KEYS.indexOf(k) >= 0);
    const FORM_KEYS = ['non_field_errors', '__all__', 'nonFieldErrors', 'formErrors', 'detail', '$', ''];
    const META_KEYS = ['message', 'Message', 'error', 'detail', 'title', 'status', 'statusCode', 'code', 'type', 'success', 'ok', 'path', 'timestamp', 'instance', 'trace', 'traceId', 'name'];
    const LOCATIONS = ['body', 'query', 'path', 'header', 'cookie', 'form'];
    /** '#/a/0/b' or '/data/attributes/email' -> ['a', 0, 'b'] / ['email'] */
    function pointerParts(p) {
        let parts = String(p).replace(/^#/, '').split('/').filter(s => s !== '').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
        if (parts[0] === 'data' && parts.length > 1) { parts = parts.slice(1); if (parts[0] === 'attributes' || parts[0] === 'relationships') parts = parts.slice(1); }
        return parts;
    }
    /**
     * Reads the validation response of any common backend into one shape:
     *   { format, errors: { 'items[0].qty': 'First message' }, all: { 'items[0].qty': ['First', 'Second'] }, form: ['Message that belongs to no field'] }
     * Understood (detected from the body, or forced with options.format): RFC 9457 problem+json, ASP.NET Core ValidationProblemDetails and classic ModelState,
     * Laravel / Rails ({ errors: { field: [..] } }), Django REST framework (field lists, non_field_errors, nested serializers and list errors), FastAPI / Pydantic
     * ({ detail: [{ loc, msg }] }), Zod (issues, flatten()), Standard Schema issue lists, express-validator, JSON:API ({ errors: [{ source: { pointer } }] }), Ajv.
     * `body` may be the parsed JSON, a JSON string or an array of issues. Anything else gives an empty result. Never throws.
     */
    function serverErrors(body, options) {
        const o = options || {}, res = { format: 'none', errors: {}, all: {}, form: [] };
        let count = 0;
        const add = (key, msgs) => {
            if (count > 2000) return;
            const list = [].concat(msgs).map(m => messageText(m)).filter(m => m !== null);
            if (!list.length) return;
            const k = key === null || key === undefined ? null : (Array.isArray(key) ? canonKey(key) : (key === '' ? null : canonKey(key)));
            if (k === null) { if (key === null || key === undefined || key === '' || (Array.isArray(key) && !key.length)) list.forEach(m => { res.form.push(m); count++; }); return; }
            if (!Object.prototype.hasOwnProperty.call(res.all, k)) res.all[k] = [];
            list.forEach(m => { res.all[k].push(m); count++; });
        };
        // { key: message | [messages] | { nested } | [ { nested }, ... ] } -> add() for every leaf
        const walk = (obj, parts, depth) => {
            if (!obj || typeof obj !== 'object' || depth > 12 || count > 2000) return;
            Object.keys(obj).forEach(key => {
                const kp = keyParts(key);   // 'items.0.name' / 'a[b]' are paths, not one long name
                if (!kp) return;
                const v = obj[key], here = parts.concat(kp);
                const isForm = parts.length === 0 && FORM_KEYS.indexOf(key) >= 0;
                const target = isForm ? null : here;
                if (messageText(v) !== null && !(v && typeof v === 'object')) { add(target, v); return; }
                if (Array.isArray(v)) {
                    if (v.every(x => typeof x === 'string' || typeof x === 'number' || isMessageObject(x))) { add(target, v); return; }
                    v.forEach((item, i) => {
                        if (typeof item === 'string' || typeof item === 'number' || isMessageObject(item)) add(target, item);
                        else if (item && typeof item === 'object') walk(item, here.concat([i]), depth + 1);
                    });
                    return;
                }
                if (v && typeof v === 'object') {
                    if (isMessageObject(v)) add(target, v);
                    else walk(v, here, depth + 1);
                }
            });
        };
        // [ { path | pointer | loc | param | field | name | instancePath, message | msg | detail } ]
        const issues = list => {
            list.forEach(it => {
                if (typeof it === 'string') { add(null, it); return; }
                if (!it || typeof it !== 'object') return;
                let key = null;
                if (Array.isArray(it.path)) key = it.path.map(p => (p && typeof p === 'object' && 'key' in p ? p.key : p));
                else if (Array.isArray(it.loc)) key = LOCATIONS.indexOf(String(it.loc[0])) >= 0 ? it.loc.slice(1) : it.loc;
                else if (it.source && typeof it.source === 'object' && typeof it.source.pointer === 'string') key = pointerParts(it.source.pointer);
                else if (it.source && typeof it.source === 'object' && typeof it.source.parameter === 'string') key = [it.source.parameter];
                else if (typeof it.pointer === 'string') key = pointerParts(it.pointer);
                else if (typeof it.instancePath === 'string') key = pointerParts(it.instancePath);
                else if (typeof it.dataPath === 'string') key = canonKey(it.dataPath.replace(/^\./, ''));
                else {
                    const k = it.path !== undefined ? it.path : it.param !== undefined ? it.param : it.field !== undefined ? it.field : it.name !== undefined ? it.name : it.property;
                    if (typeof k === 'string' && k !== '') key = [k];
                }
                if (typeof key === 'string') key = [key];
                if (key && key.some(p => p && typeof p === 'object')) key = null;
                const text = messageText(it.message) || messageText(it.msg) || messageText(it.detail) || messageText(it.title) || messageText(it.error) || messageText(it.description);
                if (text) add(key && key.length ? key : null, text);
            });
        };
        let data = body;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = null; } }
        const fmt = String(o.format || 'auto').toLowerCase();
        try {
            if (Array.isArray(data)) { res.format = 'issues'; issues(data); }
            else if (data && typeof data === 'object') {
                const generic = () => {
                    // top level { title, detail, message } says what went wrong when no field is named
                    if (!Object.keys(res.all).length) ['detail', 'title', 'message', 'Message', 'error'].some(k => { const t = messageText(data[k]); if (t) { res.form.push(t); return true; } return false; });
                };
                if ((fmt === 'auto' || fmt === 'aspnet' || fmt === 'modelstate') && data.ModelState && typeof data.ModelState === 'object') {
                    res.format = 'aspnet-modelstate';
                    const ms = {};
                    Object.keys(data.ModelState).forEach(k => { ms[k.replace(/^(?:model|\$)\./i, '')] = data.ModelState[k]; });
                    walk(ms, [], 0);
                    generic();
                } else if ((fmt === 'auto' || fmt === 'zod' || fmt === 'issues' || fmt === 'standard') && Array.isArray(data.issues)) { res.format = 'issues'; issues(data.issues); }
                else if ((fmt === 'auto' || fmt === 'zod') && data.fieldErrors && typeof data.fieldErrors === 'object') { res.format = 'zod'; walk(data.fieldErrors, [], 0); [].concat(data.formErrors || []).forEach(m => add(null, m)); }
                else if ((fmt === 'auto' || fmt === 'fastapi' || fmt === 'issues') && Array.isArray(data.detail) && data.detail.some(x => x && typeof x === 'object')) { res.format = 'fastapi'; issues(data.detail); }
                else if ((fmt === 'auto' || fmt === 'jsonapi' || fmt === 'express-validator' || fmt === 'issues') && Array.isArray(data.errors)) { res.format = 'issues'; issues(data.errors); generic(); }
                else if ((fmt === 'auto' || fmt === 'problem' || fmt === 'laravel' || fmt === 'rails' || fmt === 'aspnet') && data.errors && typeof data.errors === 'object') {
                    res.format = fmt === 'auto' ? (data.type !== undefined || data.status !== undefined || data.title !== undefined ? 'problem+json' : 'errors-map') : fmt;
                    walk(data.errors, [], 0);
                    generic();
                } else if (fmt === 'auto' || fmt === 'drf' || fmt === 'map') {
                    if (fmt === 'auto' && Object.keys(data).every(k => META_KEYS.indexOf(k) >= 0)) generic();   // { message: 'Server error' } names no field
                    else walk(data, [], 0);
                    if (Object.keys(res.all).length || res.form.length) res.format = 'field-map';
                }
                if (res.format === 'none' && (fmt === 'auto') && !Object.keys(res.all).length && !res.form.length) generic();
                if (res.format === 'none' && (Object.keys(res.all).length || res.form.length)) res.format = 'generic';
            }
        } catch (e) { /* hostile or cyclic input: whatever was collected stays */ }
        Object.keys(res.all).forEach(k => { res.errors[k] = res.all[k][0]; });
        return res;
    }

    // ------------------------------------------------------------------ precognition: ask the real endpoint "would this pass?" without saving anything
    function flattenValues(values, into, prefix, depth) {
        Object.keys(values || {}).forEach(k => {
            if (BAD_KEYS.indexOf(k) >= 0) return;
            const v = values[k], name = prefix ? prefix + (/^[0-9]+$/.test(k) ? '[' + k + ']' : '.' + k) : k;
            const isBlob = typeof Blob === 'function' && v instanceof Blob;
            if (v && typeof v === 'object' && !isBlob && depth < 8) flattenValues(v, into, name, depth + 1);
            else if (v !== undefined && v !== null) into.push([name, v]);
            else if (v === null) into.push([name, '']);
        });
        return into;
    }
    /**
     * FormValidator.precognition(url, values, options): sends the values to the real endpoint with `Precognition: true` (Laravel Precognition protocol) and answers
     * { valid, status, errors, all, form, only, error?, aborted? }. The endpoint must validate and then stop (Laravel answers 204 / 422). Never throws:
     * `valid` is true (2xx), false (field errors), or null when the check could not be made (network, timeout, 5xx, unreadable answer: see `error`) or was cancelled
     * (`aborted: true`). Options: method (POST), only (field names to report), headers, credentials, encoding ('json' | 'form' | 'multipart', files pick multipart),
     * timeout (10000 ms), signal, fetch, format (see serverErrors).
     */
    async function precognition(url, values, options) {
        const o = options || {};
        const only = o.only === undefined ? null : [].concat(o.only).map(String);
        const method = String(o.method || 'POST').toUpperCase();
        const doFetch = o.fetch || (typeof fetch === 'function' ? fetch : null);
        const result = (extra) => Object.assign({ valid: null, status: 0, errors: {}, all: {}, form: [], only }, extra);
        if (!doFetch) return result({ error: new Error('precognition: no fetch available (pass options.fetch)') });
        if (!url) return result({ error: new Error('precognition: url is required') });
        const headers = Object.assign({ 'Accept': 'application/json', 'Precognition': 'true' }, o.headers);
        if (only) headers['Precognition-Validate-Only'] = only.join(',');
        const entries = flattenValues(values, [], '', 0);
        const hasFile = entries.some(e => typeof Blob === 'function' && e[1] instanceof Blob);
        const encoding = o.encoding || (hasFile ? 'multipart' : 'json');
        let target = String(url), body;
        if (method === 'GET' || method === 'HEAD') {
            const qs = new URLSearchParams();
            entries.forEach(e => { if (!(typeof Blob === 'function' && e[1] instanceof Blob)) qs.append(e[0], String(e[1])); });
            const s = qs.toString();
            if (s) target += (target.indexOf('?') >= 0 ? '&' : '?') + s;
        } else if (encoding === 'multipart') {
            body = new FormData();
            entries.forEach(e => body.append(e[0], e[1]));
        } else if (encoding === 'form') {
            body = new URLSearchParams(entries.map(e => [e[0], String(e[1])])).toString();
            headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
        } else {
            body = JSON.stringify(values || {});
            headers['Content-Type'] = 'application/json';
        }
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        let timedOut = false;
        const timer = ctrl ? setTimeout(() => { timedOut = true; ctrl.abort(); }, o.timeout || 10000) : null;
        const onAbort = () => ctrl && ctrl.abort();
        if (o.signal) { if (o.signal.aborted) onAbort(); else if (o.signal.addEventListener) o.signal.addEventListener('abort', onAbort, { once: true }); }
        try {
            const resp = await doFetch(target, { method, headers, body, credentials: o.credentials, signal: ctrl ? ctrl.signal : undefined });
            const status = resp.status;
            if (status >= 200 && status < 300) return result({ valid: true, status });
            let data = null;
            try { data = await resp.json(); } catch (e) { /* no JSON body */ }
            const parsed = serverErrors(data, { format: o.format });
            const hasErrors = Object.keys(parsed.all).length > 0;
            const filter = m => { if (!only) return m; const out = {}; Object.keys(m).forEach(k => { if (only.some(n => canonKey(n) === k)) out[k] = m[k]; }); return out; };
            if ((status === 422 || status === 400 || status === 409) && (hasErrors || parsed.form.length)) {
                const all = filter(parsed.all), errors = {};
                Object.keys(all).forEach(k => { errors[k] = all[k][0]; });
                // when only some fields were asked for and none of them failed, the answer for those fields is "valid"
                return result({ valid: Object.keys(all).length === 0 && only ? true : false, status, errors, all, form: parsed.form, format: parsed.format, rawErrors: parsed.errors });
            }
            return result({ status, error: new Error('precognition: HTTP ' + status), form: parsed.form });
        } catch (e) {
            if (e && e.name === 'AbortError' && !timedOut) return result({ aborted: true });
            return result({ error: timedOut ? new Error('precognition: timed out') : e });
        } finally {
            if (timer) clearTimeout(timer);
            if (o.signal && o.signal.removeEventListener) o.signal.removeEventListener('abort', onAbort);
        }
    }

    // ------------------------------------------------------------------ action: one function for React 19 useActionState / Server Actions / any FormData handler
    /**
     * FormValidator.action(rules, serverFn, options) -> async (previousState, formData) => state, the shape React 19's useActionState wants.
     *   state = { ok, values, errors: { field: message }, form: [messages], result }
     * It reads the form fields, checks them with the rules (same engine as schema()) and only then calls serverFn(validatedValues, formData). `values` hands back
     * what was typed (never passwords, never files) so the inputs can be filled again after React resets the form. serverFn may return { errors } (or a backend
     * response body, see serverErrors) to show server-side messages; any other return value arrives as `result`. Errors thrown by serverFn are not swallowed.
     * Works without JavaScript on the page (Server Actions) because the same function runs on the server.
     */
    function action(rulesOrSchema, serverFn, options) {
        const o = options || {};
        const sch = rulesOrSchema && rulesOrSchema['~standard'] && rulesOrSchema.rules ? rulesOrSchema : schema(rulesOrSchema || {}, o);
        const names = sch.fields;
        const secret = rules => [].concat(rules).some(r => r === 'pwcheck' || (r && typeof r === 'object' && ('pwcheck' in r || r.type === 'pwcheck')));
        const secretNames = new Set(names.filter(n => secret(sch.rules[n])).concat(o.omitValues || []));
        const read = fd => {
            const data = {};
            names.forEach(n => {
                let v;
                if (fd && typeof fd.getAll === 'function') { const all = fd.getAll(n).filter(x => typeof x === 'string'); v = all.length > 1 ? all : all[0]; }
                else if (fd && typeof fd === 'object') v = fd[n];
                if (Array.isArray(v)) v = v.join(o.join === undefined ? ',' : o.join);
                if (v !== undefined) data[n] = v;
            });
            return data;
        };
        const keep = data => { const out = {}; Object.keys(data).forEach(n => { if (!secretNames.has(n) && typeof data[n] === 'string') out[n] = data[n]; }); return out; };
        const run = async (prev, formData) => {
            const input = read(formData), values = keep(input);
            const r = sch.safeParse(input);
            if (!r.success) return { ok: false, values, errors: r.errors, form: [], result: undefined };
            if (!isFn(serverFn)) return { ok: true, values, errors: {}, form: [], result: undefined };
            const out = await serverFn(r.data, formData, prev);
            if (out && typeof out === 'object') {
                const se = (out.errors && typeof out.errors === 'object' && !Array.isArray(out.errors) && Object.keys(out.errors).every(k => messageText(out.errors[k]) !== null || Array.isArray(out.errors[k]))) ? serverErrors({ errors: out.errors }) : (out.errors || out.issues || out.fieldErrors || out.ModelState ? serverErrors(out) : null);
                if (se && (Object.keys(se.all).length || se.form.length)) return { ok: false, values, errors: se.errors, form: se.form, result: out };
            }
            return { ok: true, values, errors: {}, form: [], result: out };
        };
        run.initialState = { ok: false, values: {}, errors: {}, form: [], result: undefined };
        return run;
    }

    // `__FV_CORE__` does not exist in the normal build. The "core" build (dist/formValidator.core.min.js, tools/build-subset.js) defines it as true, which lets the
    // minifier drop the whole form engine and everything only it uses: what is left checks values, schemas and server answers without a DOM.
    const CORE = typeof __FV_CORE__ === 'boolean' && __FV_CORE__;
    return Object.assign({
        parseFormData, // (formData | form | entries | object, { coerce? }) -> nested object: 'a.b[0].c' -> { a: { b: [{ c }] } }
        serverErrors,  // (response body, { format? }) -> { errors, all, form, format } from problem+json, Laravel, DRF, ASP.NET, FastAPI, Zod ...
        precognition,  // async (url, values, { only, method, ... }) -> { valid, errors, ... }: ask the real endpoint whether the values would pass
        action,        // (rules, serverFn) -> (prevState, formData) => state, for React 19 useActionState and Server Actions
        schema,        // (rules, options?) -> Standard Schema with parse / safeParse / check
        ValidationError,
        checkValue,
        checkValues,
        registerRule,
        addMethod,
        format,
        getRule: name => validators[name] || null,
        ruleNames: () => Object.keys(validators),   // every registered rule, built in and custom
        messages: DEFAULT_MESSAGES,     // mutable: FormValidator.messages.required = 'Pflichtfeld'
        version: '2.14.0'
    }, CORE ? {} : {
        init,
        unobtrusive,   // ASP.NET data-val-* support: unobtrusive.parse(scope), .auto(), .adapters.add / addBool / addSingleVal / addMinMax
        validate,      // async (form, rules?) -> true / false (waits for remote and file checks)
        isValid,       // sync (form, rules?) -> true / false, like jQuery's valid()
        remoteDefaults: REMOTE_DEFAULTS,
        addClassRules,
        setDefaults: obj => Object.assign(DEFAULTS, obj),
        defaults: DEFAULTS,             // mutable global defaults
        getInstance: t => { const f = resolveForm(t); return f ? f._fvInstance || null : null; }
    });
});
