/*!
 * FormValidator v2.9.0 — dependency-free form validation (jQuery / Select2 / Bootstrap are optional).
 *
 * Changelog
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
        custom: 'Invalid value.'
    };

    const DEFAULTS = {
        trim: true,                       // trim values (never trims type=password)
        novalidate: true,                 // set form.noValidate so native bubbles don't fight ours
        focusInvalid: true,               // focus + scroll to the first invalid field on submit
        validateHidden: false,            // also validate fields that are not rendered / type=hidden
        ignore: null,                     // CSS selector of fields to skip
        validateOn: ['change'],           // events that validate a not-yet-invalid field ('blur', 'change', 'input')
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
        classRules: null                  // { className: rules } applied to fields that carry the class
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
        minWords: p => ({ min: +p }), maxWords: p => ({ max: +p }),
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

    /** Options of the wrong type fall back to the defaults: a bad config must not crash the page when an error is shown. */
    function sanitizeConfig(cfg) {
        if (typeof cfg.errorElement !== 'string' || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(cfg.errorElement)) cfg.errorElement = DEFAULTS.errorElement;
        ['errorClass', 'invalidClass', 'pendingClass'].forEach(k => { if (typeof cfg[k] !== 'string') cfg[k] = k === 'errorClass' ? DEFAULTS.errorClass : ''; });
        cfg.validateOn = Array.isArray(cfg.validateOn) ? cfg.validateOn.filter(e => typeof e === 'string') : DEFAULTS.validateOn.slice();
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
        cfg.passwordStrength = Object.assign({}, DEFAULTS.passwordStrength, isObj(userConfig.passwordStrength) ? userConfig.passwordStrength : null);
        const rawMessages = Object.assign({}, isObj(userConfig.messages) ? userConfig.messages : null, isObj(opts.messages) ? opts.messages : null);
        cfg.messages = {};                 // by rule type
        const fieldMessages = {};          // by field name: { name: 'text' } or { name: { required: 'text' } }
        Object.keys(rawMessages).forEach(k => {
            const v = rawMessages[k], isType = k in DEFAULT_MESSAGES || !!validators[k];
            if ((v && typeof v === 'object') || !isType) fieldMessages[k] = v; else cfg.messages[k] = v;
        });
        const context = Object.assign({}, opts.context, { form });

        const inst = {
            form, config: cfg, context,
            rules: {},
            _errors: new Map(),        // unit.key -> { el, message, unit }
            _tokens: new Map(),
            _aborters: new Map(),
            _remoteCache: new Map(),
            _listeners: [],
            _timers: new Map(),
            _busy: false, _bypass: false, _submitted: false,
            _pending: new Map(), fieldMessages
        };
        Object.keys(opts.rules || {}).forEach(n => { inst.rules[n] = normalizeRules(opts.rules[n]); });

        // ---- units: one per radio/checkbox group, one per individual element otherwise
        function unitsFor(name) {
            const els = Array.from(form.querySelectorAll(`[name="${esc(name)}"]`));
            const grouped = els.filter(e => e.type === 'radio' || e.type === 'checkbox');
            const units = els.filter(e => !(e.type === 'radio' || e.type === 'checkbox')).map(e => ({ key: e, fields: [e] }));
            if (grouped.length) units.unshift({ key: grouped[0], fields: grouped });
            return units;
        }
        function names() {
            const set = new Set(Object.keys(inst.rules));
            if (cfg.autoRules || isFn(cfg.fieldRules) || hasClassRules()) {
                Array.from(form.elements).forEach(e => {
                    if (e.name && e.tagName !== 'FIELDSET' && !['button', 'submit', 'reset', 'image'].includes(e.type)) set.add(e.name);
                });
            }
            return Array.from(set);
        }
        const allUnits = () => [].concat(...names().map(unitsFor));

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

        function rulesFor(unit) {
            const explicit = inst.rules[unit.fields[0].name] || [];
            if (!cfg.autoRules && !isFn(cfg.fieldRules) && !hasClassRules()) return explicit;
            const merged = new Map();  // later sources win per rule type: class < attributes / data-rule < fieldRules
            classRulesFor(unit.fields[0]).concat(cfg.autoRules ? attributeRules(unit.fields[0]) : [],
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
            let m = rule.message;
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
            if (rec) { rec.el.remove(); inst._errors.delete(unit.key); }
            unit.fields.forEach(f => {
                if (isFn(cfg.unhighlight)) guard(cfg.unhighlight, undefined, f, unit);
                if (cfg.invalidClass) cfg.invalidClass.split(/\s+/).forEach(c => c && f.classList.remove(c));
                f.removeAttribute('aria-invalid');
                if (rec) {
                    const ids = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(i => i && i !== rec.el.id);
                    ids.length ? f.setAttribute('aria-describedby', ids.join(' ')) : f.removeAttribute('aria-describedby');
                }
            });
        }

        function showError(unit, message) {
            removeError(unit);
            const err = root.document.createElement(cfg.errorElement);
            err.className = cfg.errorClass;
            err.id = 'fv-error-' + (++uid);
            err.setAttribute('data-error-for', unit.fields[0].name);
            err.setAttribute('dir', 'auto');
            // role="alert" is not allowed on <label> (ARIA); the field's aria-describedby makes screen readers read the message on focus anyway
            if (err.tagName === 'LABEL') err.setAttribute('aria-live', 'polite'); else err.setAttribute('role', 'alert');
            if (err.tagName === 'LABEL' && unit.fields[0].id) err.setAttribute('for', unit.fields[0].id);
            err.textContent = message;
            place(err, unit);
            inst._errors.set(unit.key, { el: err, message, unit });
            unit.fields.forEach(f => {
                if (isFn(cfg.highlight)) guard(cfg.highlight, undefined, f, unit);
                if (cfg.invalidClass) cfg.invalidClass.split(/\s+/).forEach(c => c && f.classList.add(c));
                f.setAttribute('aria-invalid', 'true');
                f.setAttribute('aria-describedby', ((f.getAttribute('aria-describedby') || '') + ' ' + err.id).trim());
            });
        }

        // ---- validation
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

            if (env.badInput) { showError(unit, cfg.messages.badInput || DEFAULT_MESSAGES.badInput); return false; }

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
                    if (!r.valid) { showError(unit, resolveMessage(rule, env, r.message)); return false; }
                }
                removeError(unit);
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
            if (env.badInput) { showError(unit, cfg.messages.badInput || DEFAULT_MESSAGES.badInput); return false; }

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
                        if (!lr.valid) showError(unit, resolveMessage(rule, env, lr.message));
                    }).catch(() => { /* a failed async check stays "pending" in sync mode */ });
                    continue;
                }
                const r = normalizeResult(res);
                if (!r.valid) { showError(unit, resolveMessage(rule, env, r.message)); return false; }
            }
            removeError(unit);
            if (isFn(cfg.onFieldValid)) guard(cfg.onFieldValid, undefined, unit.fields[0], unit);
            return true;
        }

        function finishAll(units, results, o) {
            const invalid = units.filter((u, i) => !results[i] && inst._errors.has(u.key));
            const ok = results.every(Boolean);
            if (!ok) {
                invalid.sort((a, b) => (a.fields[0].compareDocumentPosition(b.fields[0]) & 4) ? -1 : 1);
                const list = invalid.map(u => ({ name: u.fields[0].name, field: u.fields[0], message: inst._errors.get(u.key).message }));
                if (cfg.focusInvalid && invalid[0] && (!o || o.focus !== false)) { // after the list: focus handlers may clear errors
                    const f = invalid[0].fields[0];
                    try { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
                    catch (e) { /* not focusable */ }
                }
                if (isFn(cfg.onError)) guard(cfg.onError, undefined, list);
                emit('fv:invalid', { errors: list });
            } else {
                if (isFn(cfg.onSuccess)) guard(cfg.onSuccess, undefined);
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
                if (!hasErr && !afterSubmit && (!cfg.validateOn.includes(type) || type === 'input')) return;
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
                const names = Array.from(form.elements).map(el => el.name).filter(Boolean), missed = [];
                Object.keys(map || {}).forEach(key => {
                    const msg = [].concat(map[key])[0];
                    const target = names.includes(key) ? key : names.find(n => n.toLowerCase() === String(key).toLowerCase());
                    if (!target || msg === undefined || msg === null || !inst.setError(target, String(msg))) missed.push(key);
                });
                return missed;
            },
            validateSync: o => validateAllSync(o),
            validateElementSync: (el, o) => { const u = unitOf(el); return u ? validateUnitSync(u, o) : true; },
            validateElement: (el, o) => { const u = unitOf(el); return u ? validateUnit(u, o) : Promise.resolve(true); },
            unitOf,
            units: unitsFor,
            allUnits,
            readValue: unit => readEnv(unit),
            getErrors: () => Array.from(inst._errors.values()).map(r => ({ name: r.unit.fields[0].name, field: r.unit.fields[0], fields: r.unit.fields, message: r.message, el: r.el })),
            setError: (name, message) => { const u = unitsFor(name)[0]; if (u) showError(u, message); return !!u; },
            clearError: name => unitsFor(name).forEach(removeError),
            resetForm: () => { inst.clearErrors(); inst._submitted = false; inst._tokens.clear(); },
            isSubmitted: () => inst._submitted,
            validateField: name => Promise.all(unitsFor(name).map(u => validateUnit(u))).then(r => r.every(Boolean)),
            clearErrors: () => { allUnits().forEach(removeError); Array.from(inst._errors.values()).forEach(r => removeError(r.unit)); },
            setRules: (name, rules) => { inst.rules[name] = normalizeRules(rules); },
            addRules: (name, rules) => { inst.rules[name] = (inst.rules[name] || []).concat(normalizeRules(rules)); },
            removeRules: name => { delete inst.rules[name]; unitsFor(name).forEach(removeError); },
            destroy: () => {
                inst._listeners.forEach(off => off());
                inst._listeners.length = 0;
                inst._timers.forEach(clearTimeout);
                if (inst._deferred) inst._deferred.clear();
                inst._aborters.forEach(a => a.abort());
                inst.clearErrors();
                if (cfg.novalidate) form.noValidate = !!inst._hadNoValidate;
                delete form._fvInstance; delete form._manualValidate;
            },
            attach
        });
        return inst;
    }

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
    function checkValue(value, rules, options) {
        const o = options || {};
        const raw = value == null ? '' : String(value);
        const trimmed = o.trim === false ? raw : raw.trim();
        for (const rule of normalizeRules(rules)) {
            const def = validators[rule.type];
            if (!def) throw new Error('checkValue: unknown rule "' + rule.type + '"');
            if (def.remote || NEEDS_FORM.includes(rule.type)) throw new Error('checkValue: the "' + rule.type + '" rule needs a form, files or a server and cannot run on a plain value');
            const v = rule.type === 'pwcheck' ? raw : trimmed;
            const empty = v === '';
            const env = { value: v, empty, count: empty ? 0 : 1, files: null, field: null, fields: [], form: null, inst: null, badInput: false,
                config: { passwordStrength: o.passwordStrength || {} }, context: o.context || {} };
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
                return { valid: false, rule: rule.type, message: format(fmt(custom, rule), paramsOf(rule)) };
            }
        }
        return { valid: true, rule: null, message: '' };
    }

    /**
     * Checks a whole object (a JSON request body, a model) against { field: rules }:
     *   FormValidator.checkValues(body, { email: ['required', 'email'], pw: { required: true, pwcheck: { minLength: 8 } }, pw2: { equalTo: 'pw' } })
     *   -> { valid, errors: { field: message }, details: { field: { rule, message } } }
     */
    function checkValues(data, schema, options) {
        const o = options || {}, errors = {}, details = {};
        Object.keys(schema || {}).forEach(name => {
            const r = checkValue(data ? data[name] : undefined, schema[name], Object.assign({}, o, { values: Object.assign({}, data, o.values) }));
            if (!r.valid) { errors[name] = r.message; details[name] = { rule: r.rule, message: r.message }; }
        });
        return { valid: Object.keys(errors).length === 0, errors, details };
    }

    // ------------------------------------------------------------------ schema: the rules as a Standard Schema (https://standardschema.dev)
    /** What parse() throws: `error.issues` is the Standard Schema issue list, `error.errors` is { field: message }. */
    class ValidationError extends Error {
        constructor(issues) {
            super(issues.length ? issues[0].message : 'Validation failed');
            this.name = 'ValidationError';
            this.issues = issues;
            this.errors = {};
            issues.forEach(i => { const k = i.path && i.path[0]; if (k !== undefined && !(k in this.errors)) this.errors[k] = i.message; });
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
        const keepsRaw = Object.create(null);
        fields.forEach(f => { keepsRaw[f] = normalizeRules(rules[f]).some(r => r.type === 'pwcheck'); });   // passwords are never trimmed
        const o = options || {};

        function run(input) {
            if (input === null || typeof input !== 'object' || Array.isArray(input)) return { issues: [{ message: 'Expected an object.', path: [] }] };
            const data = Object.assign({}, input);
            fields.forEach(f => { if (data[f] == null) data[f] = ''; });     // a field that is not there is blank (equalTo may point at it)
            const res = checkValues(data, rules, o);
            if (!res.valid) {
                return { issues: fields.filter(f => f in res.errors).map(f => ({ message: res.errors[f], path: [f], rule: res.details[f].rule })) };
            }
            const value = {};
            fields.forEach(f => { const raw = input[f] == null ? '' : String(input[f]); value[f] = keepsRaw[f] || o.trim === false ? raw : raw.trim(); });
            return { value };
        }

        const api = {
            '~standard': { version: 1, vendor: 'form-and-file-validator', validate: run },
            rules,
            fields,
            safeParse(data) {
                const r = run(data);
                if (!r.issues) return { success: true, data: r.value, errors: {}, issues: [] };
                const error = new ValidationError(r.issues);
                return { success: false, error, errors: error.errors, issues: r.issues };
            },
            parse(data) {
                const r = run(data);
                if (r.issues) throw new ValidationError(r.issues);
                return r.value;
            },
            check: data => checkValues(data, rules, o)
        };
        return api;
    }

    return {
        init,
        schema,        // (rules, options?) -> Standard Schema with parse / safeParse / check
        ValidationError,
        validate,      // async (form, rules?) -> true / false (waits for remote and file checks)
        isValid,       // sync (form, rules?) -> true / false, like jQuery's valid()
        checkValue,
        checkValues,
        registerRule,
        remoteDefaults: REMOTE_DEFAULTS,
        addMethod,
        addClassRules,
        format,
        setDefaults: obj => Object.assign(DEFAULTS, obj),
        getRule: name => validators[name] || null,
        messages: DEFAULT_MESSAGES,     // mutable: FormValidator.messages.required = 'Pflichtfeld'
        defaults: DEFAULTS,             // mutable global defaults
        getInstance: t => { const f = resolveForm(t); return f ? f._fvInstance || null : null; },
        version: '2.9.0'
    };
});
