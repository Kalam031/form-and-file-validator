/*!
 * FormValidator inputs add-on v1.1.0 — one-time-code fields and numbers / dates typed the way the visitor's country writes them.
 *
 *   FormValidator.otp('#code', { length: 6, name: 'code', onComplete: code => form.requestSubmit() })   // 6 boxes, paste and SMS autofill spread over them, WebOTP optional
 *   FormValidator.parseNumber('1.234,56', 'de')       // 1234.56   (NaN when it is not a number written that way)
 *   FormValidator.parseDate('22.11.2033', 'de')       // '2033-11-22'  (null for 31.02.2033, 22/11/33 -> 2033-11-22 with a two-digit year)
 *   rules: { zip: { postalCode: { countryField: 'country' } }, phone: { phoneCountry: { country: 'GB' } } }   // postal code / phone plausibility per country (FormValidator.regions)
 *   rules: { price: { localeNumber: { locale: 'de', min: 0, decimals: 2 } }, born: { localeDate: { locale: 'en-GB', max: '2010-01-01' } } }
 *
 * Part of the one-file bundle; on its own it needs formValidator.js loaded first. No data leaves the page: the separators and the day / month / year order come from the browser's Intl.
 *
 * Changelog
 *   1.1.0  postalCode / phoneCountry rules and FormValidator.regions: postal code and phone plausibility for about 60 countries (the data lives only in this add-on, the core stays small).
 *   1.0.0  First release.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['./formValidator'], function (FV) { return factory(root, FV); });
    else if (typeof module === 'object' && module.exports) module.exports = factory(root, require('./formValidator.js'));
    else factory(root, root.FormValidator);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, FV) {
    'use strict';
    if (!FV) throw new Error('formValidator.inputs.js needs FormValidator loaded first');

    const isFn = f => typeof f === 'function';
    const isNum = v => typeof v === 'number' && isFinite(v);

    // ------------------------------------------------------------------ locale-aware numbers and dates
    function defaultLocale() {
        try {
            if (FV.locale && FV.locale !== 'en') return FV.locale;
            const lang = root.document && root.document.documentElement && root.document.documentElement.lang;
            if (lang) return lang;
            return (root.navigator && (root.navigator.languages && root.navigator.languages[0] || root.navigator.language)) || 'en';
        } catch (e) { return 'en'; }
    }
    const goodLocale = l => { try { return Intl.NumberFormat.supportedLocalesOf([l]).length ? l : 'en'; } catch (e) { return 'en'; } };
    const forceLatin = l => { try { return new Intl.Locale(l, { numberingSystem: 'latn', calendar: 'gregory' }).toString(); } catch (e) { return 'en'; } };

    const symbolCache = {};
    /** { group, decimal, minus, digits: { nativeDigit: asciiDigit } } of a language, from Intl. */
    function numberSymbols(locale) {
        const loc = goodLocale(locale || defaultLocale());
        if (symbolCache[loc]) return symbolCache[loc];
        const parts = new Intl.NumberFormat(loc).formatToParts(-1234567.5);
        const find = t => { const p = parts.find(x => x.type === t); return p ? p.value : ''; };
        const digits = {};
        const nf = new Intl.NumberFormat(loc, { useGrouping: false });
        for (let d = 0; d < 10; d++) digits[nf.format(d)] = String(d);
        const sym = { locale: loc, group: find('group'), decimal: find('decimal') || '.', minus: find('minusSign') || '-', digits };
        symbolCache[loc] = sym;
        return sym;
    }
    const SPACES = /[\s    ]/;
    const MINUS = /^[-−‒–—﹣－]/;

    /**
     * Number written the way a country writes it: parseNumber('1.234,56', 'de') -> 1234.56, parseNumber('1,234.56', 'en') -> 1234.56, parseNumber('١٢٣٫٥', 'ar-EG') -> 123.5.
     * Strict: a group separator must sit between groups of three digits (two for en-IN), one decimal separator at most, nothing else. Returns NaN otherwise.
     * options: { group: false } refuses group separators altogether.
     */
    function parseNumber(text, locale, options) { const r = parseNumberDetailed(text, locale, options); return r ? r.value : NaN; }
    /** { value, decimals } (decimals = digits after the decimal separator) or null. */
    function parseNumberDetailed(text, locale, options) {
        const o = options || {};
        const bad = null;
        if (typeof text === 'number') return isFinite(text) ? { value: text, decimals: (String(text).split('.')[1] || '').length } : bad;
        if (text === null || text === undefined) return bad;
        const sym = numberSymbols(locale);
        let s = String(text).trim();
        if (!s) return bad;
        s = Array.from(s).map(ch => sym.digits[ch] !== undefined ? sym.digits[ch] : ch).join('');
        let sign = '';
        if (MINUS.test(s) || s.charAt(0) === sym.minus) { sign = '-'; s = s.slice(1).trim(); }
        else if (s.charAt(0) === '+') s = s.slice(1).trim();
        if (!s) return bad;
        const dec = sym.decimal;
        const decCount = s.split(dec).length - 1;
        if (decCount > 1) return bad;
        let int = decCount ? s.slice(0, s.indexOf(dec)) : s;
        const frac = decCount ? s.slice(s.indexOf(dec) + dec.length) : '';
        if (decCount && !/^\d+$/.test(frac)) return bad;
        if (!int && decCount) int = '0';                                   // ",5" and ".5"
        const groupChar = sym.group;
        const spaceGroup = !groupChar || SPACES.test(groupChar);
        const sepClass = spaceGroup ? '[\\s\\u00a0\\u202f\\u2009\\u2007\\u0027\\u2019]' : '[' + groupChar.replace(/[\\\]^-]/g, '\\$&') + (groupChar === '’' ? '\\u0027' : '') + ']';
        if (new RegExp('^\\d+$').test(int)) { /* no separators */ }
        else if (o.group === false) return bad;
        else if (new RegExp('^\\d{1,3}(?:' + sepClass + '\\d{3})+$').test(int) || new RegExp('^\\d{1,2}(?:' + sepClass + '\\d{2})*' + sepClass + '\\d{3}$').test(int)) int = int.replace(new RegExp(sepClass, 'g'), '');
        else return bad;
        if (!/^\d+$/.test(int)) return bad;
        const n = Number(sign + int + (frac ? '.' + frac : ''));
        return isFinite(n) ? { value: n, decimals: frac.length } : bad;
    }

    const orderCache = {};
    /** ['day','month','year'] in the order the language writes them (from Intl). */
    function dateOrder(locale) {
        const loc = forceLatin(goodLocale(locale || defaultLocale()));
        if (orderCache[loc]) return orderCache[loc];
        const order = new Intl.DateTimeFormat(loc, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(Date.UTC(2033, 10, 22, 12)))
            .filter(p => p.type === 'day' || p.type === 'month' || p.type === 'year').map(p => p.type);
        orderCache[loc] = order.length === 3 ? order : ['year', 'month', 'day'];
        return orderCache[loc];
    }
    const daysIn = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    const pad = (n, w) => String(n).padStart(w, '0');

    /**
     * A date typed the local way -> 'YYYY-MM-DD', or null when it is not a real calendar date: parseDate('22.11.2033', 'de'), parseDate('11/22/2033', 'en-US'), parseDate('22/11/33', 'en-GB').
     * The order of day, month and year comes from the language. Separators: space . / - and the CJK characters. Digits of other scripts are understood.
     * options: { pivot: 50 } two-digit years up to the pivot are 20xx, above it 19xx; { twoDigitYear: false } refuses them.
     */
    function parseDate(text, locale, options) {
        const o = options || {};
        if (text === null || text === undefined) return null;
        const sym = numberSymbols(locale);
        let s = Array.from(String(text).trim()).map(ch => sym.digits[ch] !== undefined ? sym.digits[ch] : ch).join('');
        if (!s || !/^[\d\s./\-年月日‎‏،,]+$/.test(s)) return null;
        const nums = s.match(/\d+/g);
        if (!nums || nums.length !== 3) return null;
        const order = dateOrder(locale), v = {};
        order.forEach((t, i) => { v[t] = nums[i]; });
        let year = Number(v.year);
        if (v.year.length === 2) {
            if (o.twoDigitYear === false) return null;
            year += year <= (isNum(o.pivot) ? o.pivot : 50) ? 2000 : 1900;
        } else if (v.year.length !== 4) return null;
        const month = Number(v.month), day = Number(v.day);
        if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null;
        return pad(year, 4) + '-' + pad(month, 2) + '-' + pad(day, 2);
    }

    const localeOf = r => r.locale;
    FV.registerRule('localeNumber', (v, r) => {
        const parsed = parseNumberDetailed(v, localeOf(r), { group: r.group });
        if (!parsed) return FV.messages.number;
        const n = parsed.value;
        if (r.integer && (!Number.isInteger(n) || parsed.decimals)) return FV.messages.integer || FV.messages.number;
        if (isNum(r.decimals) && parsed.decimals > r.decimals) return FV.messages.number;
        if (isNum(r.min) && n < r.min) return String(FV.messages.min || '').replace(/\{min\}/g, r.min);
        if (isNum(r.max) && n > r.max) return String(FV.messages.max || '').replace(/\{max\}/g, r.max);
        return true;
    });
    FV.registerRule('localeDate', (v, r) => {
        const iso = parseDate(v, localeOf(r), { pivot: r.pivot, twoDigitYear: r.twoDigitYear });
        if (!iso) return FV.messages.date;
        if (r.min && iso < String(r.min)) return String(FV.messages.minDate || '').replace(/\{min\}/g, r.min);
        if (r.max && iso > String(r.max)) return String(FV.messages.maxDate || '').replace(/\{max\}/g, r.max);
        return true;
    });

    // ------------------------------------------------------------------ one-time code boxes
    const DEFAULT_LABEL = (i, n) => 'Digit ' + (i + 1) + ' of ' + n;
    /**
     * Turns a container into a one-time-code field with `length` boxes.
     *   const otp = FormValidator.otp('#code', { length: 6, name: 'code', numeric: true, onComplete(code) { form.requestSubmit(); }, webotp: true });
     * The container may already hold <input> elements (one per box) or stay empty (the boxes are created). A hidden input called `name` always holds the whole code,
     * so the form posts ONE field and FormValidator rules work on it: rules: { code: { required: true, digits: true, minlength: 6 } }.
     * Typing moves forward, Backspace moves back, arrows move, a paste or an SMS autofill that puts several characters in one box is spread over the boxes.
     * webotp: true also asks the browser for the SMS code (WebOTP API, Chrome on Android); it is ignored where it does not exist and never throws.
     * Returns { getValue, setValue, clear, focus, inputs, hidden, destroy }.
     */
    function otp(target, options) {
        const o = options || {};
        const D = root.document;
        const host = typeof target === 'string' ? D.querySelector(target) : (target && target.jquery ? target[0] : target);
        if (!host) throw new Error('FormValidator.otp: container not found');
        const length = Math.max(1, Math.min(12, Math.floor(isNum(o.length) ? o.length : 6)));
        const numeric = o.numeric !== false;
        const accept = ch => numeric ? /^\d$/.test(ch) : /^[A-Za-z0-9]$/.test(ch);
        const clean = text => Array.from(String(text === null || text === undefined ? '' : text)).map(ch => ch.normalize('NFKC')).join('').split('').filter(accept);
        let inputs = Array.from(host.querySelectorAll('input')).filter(i => i.type !== 'hidden' && i.getAttribute('data-fv-otp-hidden') === null);
        const created = [];
        while (inputs.length < length) { const i = D.createElement('input'); host.appendChild(i); created.push(i); inputs.push(i); }
        inputs = inputs.slice(0, length);
        const labelFn = isFn(o.label) ? o.label : DEFAULT_LABEL;
        host.setAttribute('role', host.getAttribute('role') || 'group');
        if (o.groupLabel && !host.getAttribute('aria-label')) host.setAttribute('aria-label', String(o.groupLabel));
        const names = o.name ? String(o.name) : '';
        let hidden = null, createdHidden = false;
        if (names) {
            hidden = host.querySelector('input[data-fv-otp-hidden]');
            if (!hidden) { hidden = D.createElement('input'); hidden.setAttribute('data-fv-otp-hidden', ''); host.appendChild(hidden); createdHidden = true; }
            // a visually hidden TEXT input (FormValidator skips type="hidden" fields): it holds the whole code, so rules and the posted form see one field
            hidden.type = 'text'; hidden.name = names; hidden.tabIndex = -1; hidden.setAttribute('aria-hidden', 'true'); hidden.setAttribute('autocomplete', 'off');
            hidden.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
        }
        inputs.forEach((el, i) => {
            el.type = 'text';
            el.setAttribute('inputmode', numeric ? 'numeric' : 'text');
            el.setAttribute('autocomplete', i === 0 ? 'one-time-code' : 'off');
            el.setAttribute('autocapitalize', 'off'); el.setAttribute('autocorrect', 'off'); el.setAttribute('spellcheck', 'false');
            el.setAttribute('aria-label', labelFn(i, length));
            if (numeric) el.setAttribute('pattern', '[0-9]*');
            el.setAttribute('data-fv-otp', String(i));
            el.removeAttribute('name');            // the boxes are not posted or validated: the hidden holder is
        });
        const listeners = [];
        const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push(() => el.removeEventListener(type, fn)); };
        const value = () => inputs.map(i => i.value).join('');
        let lastComplete = '';
        function sync(fromUser) {
            const v = value();
            if (hidden) {
                const changed = hidden.value !== v;
                hidden.value = v;
                if (changed && fromUser) { hidden.dispatchEvent(new root.Event('input', { bubbles: true })); hidden.dispatchEvent(new root.Event('change', { bubbles: true })); }
            }
            if (v.length === length && v !== lastComplete) { lastComplete = v; if (isFn(o.onComplete)) { try { o.onComplete(v); } catch (e) { if (root.console) console.error(e); } } }
            if (v.length < length) lastComplete = '';
        }
        function fill(from, chars) {
            let i = from;
            chars.forEach(ch => { if (i < length) inputs[i++].value = ch; });
            const next = Math.min(i, length - 1);
            inputs[next].focus();
            if (inputs[next].select) inputs[next].select();
            sync(true);
        }
        inputs.forEach((el, i) => {
            on(el, 'input', () => {
                const chars = clean(el.value);
                el.value = '';
                if (!chars.length) { sync(true); return; }
                fill(i, chars);                     // one typed character, or several (paste, SMS autofill, a keyboard suggestion)
            });
            on(el, 'keydown', e => {
                const k = e.key;
                if (k === 'Backspace' && !el.value && i > 0) { e.preventDefault(); inputs[i - 1].value = ''; inputs[i - 1].focus(); sync(true); }
                else if (k === 'ArrowLeft' && i > 0) { e.preventDefault(); inputs[i - 1].focus(); }
                else if (k === 'ArrowRight' && i < length - 1) { e.preventDefault(); inputs[i + 1].focus(); }
                else if (k === 'Home') { e.preventDefault(); inputs[0].focus(); }
                else if (k === 'End') { e.preventDefault(); inputs[length - 1].focus(); }
            });
            on(el, 'paste', e => {
                const text = e.clipboardData && e.clipboardData.getData ? e.clipboardData.getData('text') : '';
                if (!text) return;
                e.preventDefault();
                fill(0, clean(text).slice(0, length));
            });
            on(el, 'focus', () => { if (el.select) el.select(); });
        });

        let abort = null;
        if (o.webotp && root.navigator && root.navigator.credentials && root.navigator.credentials.get && typeof root.AbortController === 'function') {
            abort = new root.AbortController();
            Promise.resolve().then(() => root.navigator.credentials.get({ otp: { transport: ['sms'] }, signal: abort.signal }))
                .then(cred => { if (cred && cred.code) fill(0, clean(cred.code).slice(0, length)); })
                .catch(() => { /* not supported, cancelled or no SMS: typing still works */ });
        }
        sync(false);
        return {
            inputs, hidden, length,
            getValue: value,
            setValue(text) { inputs.forEach(i => { i.value = ''; }); const chars = clean(text).slice(0, length); chars.forEach((ch, i) => { inputs[i].value = ch; }); sync(true); },
            clear() { inputs.forEach(i => { i.value = ''; }); sync(true); inputs[0].focus(); },
            focus() { const first = inputs.find(i => !i.value) || inputs[length - 1]; first.focus(); },
            destroy() {
                listeners.forEach(f => f()); listeners.length = 0;
                if (abort) { try { abort.abort(); } catch (e) { /* already done */ } abort = null; }
                created.forEach(i => i.parentNode && i.parentNode.removeChild(i));
                if (createdHidden && hidden.parentNode) hidden.parentNode.removeChild(hidden);
            }
        };
    }

    // ------------------------------------------------------------------ postal codes and phone numbers by country (a plausibility check, not a registry)
    // Postal codes: the national format. A country that has no postal code system is not listed and accepts anything.
    const POSTAL = {
        US: '\\d{5}(?:-\\d{4})?', CA: '[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z][ -]?\\d[ABCEGHJ-NPRSTV-Z]\\d', GB: '(?:GIR ?0AA|[A-PR-UWYZ](?:\\d{1,2}|[A-HK-Y]\\d(?:[\\dABEHMNPRV-Y])?|\\d[A-HJKPS-UW]) ?\\d[ABD-HJLNP-UW-Z]{2})',
        DE: '\\d{5}', FR: '\\d{5}', ES: '(?:0[1-9]|[1-4]\\d|5[0-2])\\d{3}', IT: '\\d{5}', NL: '[1-9]\\d{3} ?[A-Z]{2}', BE: '[1-9]\\d{3}', AT: '\\d{4}', CH: '[1-9]\\d{3}', LI: '94\\d{2}',
        SE: '\\d{3} ?\\d{2}', NO: '\\d{4}', DK: '\\d{4}', FI: '\\d{5}', IS: '\\d{3}', PL: '\\d{2}-\\d{3}', PT: '\\d{4}-\\d{3}', IE: '[AC-FHKNPRTV-Y]\\d{2} ?[0-9AC-FHKNPRTV-Y]{4}',
        LU: '\\d{4}', CZ: '\\d{3} ?\\d{2}', SK: '\\d{3} ?\\d{2}', HU: '\\d{4}', RO: '\\d{6}', GR: '\\d{3} ?\\d{2}', BG: '\\d{4}', HR: '\\d{5}', SI: '\\d{4}', UA: '\\d{5}', RU: '\\d{6}', TR: '\\d{5}',
        AU: '\\d{4}', NZ: '\\d{4}', JP: '\\d{3}-?\\d{4}', CN: '\\d{6}', KR: '\\d{5}', IN: '[1-9]\\d{5}', PK: '\\d{5}', BD: '\\d{4}', ID: '\\d{5}', VN: '\\d{6}', TH: '\\d{5}', MY: '\\d{5}', PH: '\\d{4}', SG: '\\d{6}',
        BR: '\\d{5}-?\\d{3}', MX: '\\d{5}', AR: '(?:[A-Z]\\d{4}[A-Z]{3}|\\d{4})', CL: '\\d{7}', CO: '\\d{6}', PE: '\\d{5}',
        ZA: '\\d{4}', EG: '\\d{5}', SA: '\\d{5}(?:-\\d{4})?', IL: '\\d{5}(?:\\d{2})?', MA: '\\d{5}', NG: '\\d{6}', KE: '\\d{5}'
    };
    // Phones: [calling code, shortest, longest national number (digits after the country code, without the trunk 0)]
    const PHONE = {
        US: [1, 10, 10], CA: [1, 10, 10], GB: [44, 9, 10], DE: [49, 7, 13], FR: [33, 9, 9], ES: [34, 9, 9], IT: [39, 6, 11], NL: [31, 9, 9], BE: [32, 8, 9], AT: [43, 7, 13], CH: [41, 9, 9],
        SE: [46, 7, 10], NO: [47, 8, 8], DK: [45, 8, 8], FI: [358, 6, 10], PL: [48, 9, 9], PT: [351, 9, 9], IE: [353, 7, 9], CZ: [420, 9, 9], GR: [30, 10, 10], HU: [36, 8, 9], RO: [40, 9, 9],
        UA: [380, 9, 9], RU: [7, 10, 10], TR: [90, 10, 10], AU: [61, 9, 9], NZ: [64, 8, 10], JP: [81, 9, 10], CN: [86, 10, 11], KR: [82, 9, 10], IN: [91, 10, 10], PK: [92, 10, 10],
        BD: [880, 10, 10], ID: [62, 8, 12], VN: [84, 9, 10], TH: [66, 8, 9], MY: [60, 7, 10], PH: [63, 10, 10], SG: [65, 8, 8], HK: [852, 8, 8], BR: [55, 10, 11], MX: [52, 10, 10],
        AR: [54, 10, 11], CL: [56, 9, 9], CO: [57, 10, 10], ZA: [27, 9, 9], EG: [20, 9, 10], SA: [966, 9, 9], AE: [971, 8, 9], IL: [972, 8, 9], NG: [234, 8, 10], KE: [254, 9, 9]
    };
    const KEEPS_ZERO = { US: 1, CA: 1, IT: 1, RU: 1 };   // the leading 0 is part of the number there (or there is no trunk 0)
    const postalCache = {};
    const upper = c => String(c === undefined || c === null ? '' : c).trim().toUpperCase();
    /** isPostalCode('SW1A 1AA', 'GB') -> true | false | null (null: no rule for that country, so nothing can be said). */
    function isPostalCode(value, country) {
        const c = upper(country);
        if (!Object.prototype.hasOwnProperty.call(POSTAL, c)) return null;
        const re = postalCache[c] || (postalCache[c] = new RegExp('^' + POSTAL[c] + '$', 'i'));
        return re.test(String(value).trim());
    }
    /** isPhone('+44 20 7946 0958', 'GB') or isPhone('020 7946 0958', 'GB') -> true | false | null. Checks the prefix and the length, not whether the number exists. */
    function isPhone(value, country) {
        const c = upper(country);
        if (!Object.prototype.hasOwnProperty.call(PHONE, c)) return null;
        const cc = String(PHONE[c][0]), min = PHONE[c][1], max = PHONE[c][2];
        const text = String(value).trim();
        if (!/^\+?[\d\s\-().\/]+$/.test(text)) return false;
        let digits = text.replace(/\D/g, '');
        const intl = text.charAt(0) === '+' || (digits.indexOf('00') === 0 && digits.length > 6);
        if (intl) {
            if (text.charAt(0) !== '+') digits = digits.slice(2);
            if (digits.indexOf(cc) !== 0) return false;
            let rest = digits.slice(cc.length);
            if (rest.charAt(0) === '0' && !KEEPS_ZERO[c]) rest = rest.slice(1);   // +44 (0) 20 ...
            return rest.length >= min && rest.length <= max;
        }
        if (digits.charAt(0) === '0' && !KEEPS_ZERO[c]) digits = digits.slice(1);
        else if (c === 'RU' && digits.charAt(0) === '8') digits = digits.slice(1);
        else if ((c === 'US' || c === 'CA') && digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
        return digits.length >= min && digits.length <= max;
    }
    const countryOf = (r, env) => {
        if (r.countryField) {
            const vals = env.values || (env.inst && typeof env.inst.getValues === 'function' ? env.inst.getValues() : null);
            const v = vals ? vals[r.countryField] : undefined;
            return upper(Array.isArray(v) ? v[0] : v);
        }
        return upper(r.country !== undefined ? r.country : r.param);
    };
    // postalCode: { country: 'GB' } | { countryField: 'country' } (the value of another field decides; an unknown country accepts anything)
    FV.registerRule('postalCode', (v, r, env) => isPostalCode(v, countryOf(r, env)) !== false);
    FV.registerRule('phoneCountry', (v, r, env) => isPhone(v, countryOf(r, env)) !== false);
    if (!FV.messages.postalCode) FV.messages.postalCode = 'Please enter a valid postal code.';
    if (!FV.messages.phoneCountry) FV.messages.phoneCountry = 'Please enter a valid phone number.';
    FV.regions = { postalCodes: Object.keys(POSTAL), phoneCountries: Object.keys(PHONE), callingCode: c => { const e = PHONE[upper(c)]; return e ? e[0] : null; }, isPostalCode, isPhone };

    FV.parseNumber = parseNumber;
    FV.parseDate = parseDate;
    FV.otp = otp;
    return { parseNumber, parseDate, otp, numberSymbols, dateOrder, regions: FV.regions };
});
