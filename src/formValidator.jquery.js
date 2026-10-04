/*!
 * FormValidator — jQuery Validation compatibility layer v1.2.0
 *
 * Load order:  jQuery  →  formValidator.js (2.2+)  →  formValidator.jquery.js
 * Then replace the jQuery Validation plugin (jquery.validate.js, additional-methods.js, localization files) with these scripts.
 * Your existing code keeps working:
 *
 *   $('#myform').validate({
 *       rules:    { email: { required: true, email: true }, pw: { minlength: 8 }, pw2: { equalTo: '#pw' } },
 *       messages: { email: { required: 'We need your email' } },
 *       errorPlacement: function (error, element) { error.insertAfter(element); },
 *       submitHandler: function (form) { form.submit(); }
 *   });
 *   $('#myform').valid();                         // synchronous, like the original
 *   $('#email').rules('add', { minlength: 3 });
 *   $.validator.addMethod('even', function (value, element, param) { return this.optional(element) || value % 2 === 0; }, 'Even numbers only');
 *
 * Supported: $.fn.validate / valid / rules, $.validator.{addMethod, addClassRules, setDefaults, format, messages, methods,
 * defaults, classRuleSettings, normalizeRule(s)}, all built-in and "additional" methods, per-field messages, data-rule-* /
 * data-msg-*, HTML5 attributes, class rules, depends, normalizer, remote, highlight/unhighlight/success/errorPlacement,
 * errorContainer/errorLabelContainer/wrapper, submitHandler/invalidHandler, focusCleanup, ignore, debug, onsubmit/onfocusout/
 * onkeyup/onclick, ".cancel" and formnovalidate buttons, validator.form/element/resetForm/showErrors/numberOfInvalids/...
 * Also supported: the `groups` option (one visible error per group) and the `showErrors` option (with this.defaultShowErrors()).
 * Differences that are improvements: text values are trimmed (set trim:false for the original behaviour), the URL check is
 * done by the URL parser, and validation runs on the modern engine (accessible errors, dynamic fields, no dependencies on layout plugins).
 *
 * Changelog
 *   1.2.0  `groups` and `showErrors` options.
 *   1.1.0  `pending` class (and aria-busy) on a field while a remote or file check runs; the new FileValidator options
 *          (methods, custom, remote, duplicateContent, duration limits) work inside the `fileValidator` method.
 *   1.0.0  First release, including the `fileValidator` method:
 *            rules: { avatar: { fileValidator: { accept: '.png,.jpg', maxFileSizeMB: 2 } } }   (needs fileValidator.js)
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) define(['jquery'], function ($) { return factory(root, $); });
    else if (typeof module === 'object' && module.exports) {
        module.exports = factory(root, root.jQuery || (function () { try { return require('jquery'); } catch (e) { return null; } })());
    } else factory(root, root.jQuery);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, $) {
    'use strict';

    if (!$ || !$.fn) throw new Error('formValidator.jquery.js needs jQuery to be loaded first');
    const FV = root.FormValidator || (typeof require === 'function' ? require('./formValidator.js') : null);
    if (!FV || !FV.getRule) throw new Error('formValidator.jquery.js needs formValidator.js v2.2 or newer to be loaded first');
    if ($.validator && $.validator.__fv) return $.validator;
    if ($.validator && root.console) console.warn('formValidator.jquery.js: replacing the jQuery Validation plugin that was loaded before it.');

    const isFn = f => typeof f === 'function';
    const D = () => root.document;
    const trim = s => String(s == null ? '' : s).trim(); // $.trim was removed in jQuery 4
    const cap = m => m.charAt(0).toUpperCase() + m.substring(1).toLowerCase();
    const escName = n => String(n).replace(/(["\\])/g, '\\$1');

    // ------------------------------------------------------------------ Validator
    function Validator(options, form) {
        this.settings = $.extend(true, {}, Validator.defaults, options);
        this.currentForm = form;
        this.submitted = {};
        this._init();
    }

    Validator.__fv = true;
    Validator.version = '1.2.0';
    Validator.autoCreateRanges = false;

    Validator.format = function (source, params) {
        if (arguments.length === 1) {
            return function () {
                const args = $.makeArray(arguments);
                args.unshift(source);
                return Validator.format.apply(this, args);
            };
        }
        if (params === undefined) return source;
        if (arguments.length > 2 && params.constructor !== Array) params = $.makeArray(arguments).slice(1);
        if (params.constructor !== Array) params = [params];
        $.each(params, function (i, n) { source = source.replace(new RegExp('\\{' + i + '\\}', 'g'), function () { return n; }); });
        return source;
    };

    Validator.defaults = {
        messages: {}, groups: {}, rules: {},
        errorClass: 'error', pendingClass: 'pending', validClass: 'valid', errorElement: 'label',
        focusCleanup: false, focusInvalid: true,
        errorContainer: $([]), errorLabelContainer: $([]),
        onsubmit: true, ignore: ':hidden', ignoreTitle: false,
        onfocusout: true, onkeyup: true, onclick: true,
        onfocusin: function (element) { this.lastActive = element; },   // called on every focusin; with focusCleanup the error is cleared as well
        ariaDescribedByCleanup: false,                                  // accepted for compatibility: aria-describedby is always kept in step with the errors
        highlight: function (element, errorClass, validClass) {
            if (element.type === 'radio') this.findByName(element.name).addClass(errorClass).removeClass(validClass);
            else $(element).addClass(errorClass).removeClass(validClass);
        },
        unhighlight: function (element, errorClass, validClass) {
            if (element.type === 'radio') this.findByName(element.name).removeClass(errorClass).addClass(validClass);
            else $(element).removeClass(errorClass).addClass(validClass);
        }
    };

    Validator.setDefaults = function (settings) { $.extend(Validator.defaults, settings); };

    Validator.messages = {
        required: 'This field is required.',
        remote: 'Please fix this field.',
        email: 'Please enter a valid email address.',
        url: 'Please enter a valid URL.',
        date: 'Please enter a valid date.',
        dateISO: 'Please enter a valid date (ISO).',
        number: 'Please enter a valid number.',
        digits: 'Please enter only digits.',
        equalTo: 'Please enter the same value again.',
        maxlength: Validator.format('Please enter no more than {0} characters.'),
        minlength: Validator.format('Please enter at least {0} characters.'),
        rangelength: Validator.format('Please enter a value between {0} and {1} characters long.'),
        range: Validator.format('Please enter a value between {0} and {1}.'),
        max: Validator.format('Please enter a value less than or equal to {0}.'),
        min: Validator.format('Please enter a value greater than or equal to {0}.'),
        step: Validator.format('Please enter a multiple of {0}.'),
        creditcard: 'Please enter a valid credit card number.',
        accept: 'Please enter a value with a valid mimetype.',
        extension: 'Please enter a value with a valid extension.',
        pattern: 'Invalid format.',
        maxWords: Validator.format('Please enter {0} words or less.'),
        minWords: Validator.format('Please enter at least {0} words.'),
        rangeWords: Validator.format('Please enter between {0} and {1} words.'),
        integer: 'A positive or negative non-decimal number please',
        lettersonly: 'Letters only please',
        letterswithbasicpunc: 'Letters or punctuation only please',
        alphanumeric: 'Letters, numbers, and underscores only please',
        nowhitespace: 'No white space please',
        ipv4: 'Please enter a valid IP v4 address.',
        ipv6: 'Please enter a valid IP v6 address.',
        time: 'Please enter a valid time, between 00:00 and 23:59',
        time12h: 'Please enter a valid time in 12-hour am/pm format',
        phoneUS: 'Please specify a valid phone number',
        iban: 'Please specify a valid IBAN',
        require_from_group: Validator.format('Please fill at least {0} of these fields.'),
        skip_or_fill_minimum: Validator.format('Please either skip these fields or fill at least {0} of them.'),
        notEqualTo: 'Please enter a different value, values must not be the same.'
    };

    Validator.classRuleSettings = {
        required: { required: true }, email: { email: true }, url: { url: true }, date: { date: true },
        dateISO: { dateISO: true }, number: { number: true }, digits: { digits: true }, creditcard: { creditcard: true }
    };

    Validator.addClassRules = function (className, rules) {
        if (className.constructor === String) Validator.classRuleSettings[className] = rules;
        else $.extend(Validator.classRuleSettings, className);
    };

    Validator.addMethod = function (name, method, message) {
        Validator.methods[name] = method;
        Validator.messages[name] = message !== undefined ? message : Validator.messages[name];
        if (method.length < 3) Validator.addClassRules(name, Validator.normalizeRule(name));
    };

    // ------------------------------------------------------------------ methods (same signatures and semantics as jQuery Validation)
    const stripHtml = v => v.replace(/<.[^<>]*?>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/[.(),;:!?%#$'"_+=\/\-\u201c\u201d\u2019]*/g, '');
    const words = v => stripHtml(v).match(/\b\w+\b/g) || [];
    const decimals = n => { const m = ('' + n).match(/(?:\.(\d+))?$/); return m && m[1] ? m[1].length : 0; };

    function isIPv6(v) {
        if (!/^[0-9a-f:.]+$/i.test(v) || v.split('::').length > 2) return false;
        let tail4 = null, s = v;
        const lastColon = s.lastIndexOf(':');
        if (s.indexOf('.') > -1) {
            tail4 = s.slice(lastColon + 1);
            if (!/^(\d{1,3})(\.\d{1,3}){3}$/.test(tail4) || tail4.split('.').some(n => +n > 255)) return false;
            s = s.slice(0, lastColon + 1) + '0:0';
        }
        const groups = s.split('::');
        const parse = part => part === '' ? [] : part.split(':');
        const left = parse(groups[0]), right = groups.length === 2 ? parse(groups[1]) : [];
        if ([...left, ...right].some(g => !/^[0-9a-f]{1,4}$/i.test(g))) return false;
        return groups.length === 2 ? left.length + right.length < 8 : left.length === 8;
    }

    function ibanOk(v) {
        v = v.replace(/\s+/g, '').toUpperCase();
        if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
        const rearranged = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, c => c.charCodeAt(0) - 55);
        let rem = 0;
        for (let i = 0; i < rearranged.length; i++) rem = (rem * 10 + +rearranged[i]) % 97;
        return rem === 1;
    }

    function urlOk(v) {
        if (!/^(?:(?:https?|ftp):)?\/\//i.test(v) || /\s/.test(v)) return false;
        let u;
        try { u = new URL(v.startsWith('//') ? 'http:' + v : v); } catch (e) { return false; }
        const host = u.hostname;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
            const p = host.split('.').map(Number);
            if (p.some(n => n > 255) || p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
                (p[0] === 169 && p[1] === 254) || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)) return false;
            return true;
        }
        return /^(?:[a-z\u00a1-\uffff0-9](?:[a-z\u00a1-\uffff0-9-]*[a-z\u00a1-\uffff0-9])?\.)+[a-z\u00a1-\uffff]{2,}\.?$/i.test(host);
    }

    Validator.methods = {
        required: function (value, element, param) {
            if (!this.depend(param, element)) return 'dependency-mismatch';
            if (element.nodeName.toLowerCase() === 'select') { const val = $(element).val(); return !!val && val.length > 0; }
            if (this.checkable(element)) return this.getLength(value, element) > 0;
            if (value === undefined || value === null) return false;
            return typeof value === 'string' ? (this.settings.trim === false ? value.length > 0 : trim(value).length > 0) : value.length > 0;
        },
        remote: function () { return true; }, // executed by the engine (see remoteRule below)
        minlength: function (value, element, param) { const length = Array.isArray(value) ? value.length : this.getLength(value, element); return this.optional(element) || length >= param; },
        maxlength: function (value, element, param) { const length = Array.isArray(value) ? value.length : this.getLength(value, element); return this.optional(element) || length <= param; },
        rangelength: function (value, element, param) { const length = Array.isArray(value) ? value.length : this.getLength(value, element); return this.optional(element) || (length >= param[0] && length <= param[1]); },
        min: function (value, element, param) { return this.optional(element) || value >= param; },
        max: function (value, element, param) { return this.optional(element) || value <= param; },
        range: function (value, element, param) { return this.optional(element) || (value >= param[0] && value <= param[1]); },
        step: function (value, element, param) {
            const type = $(element).attr('type');
            if (type && !/\b(text|number|range)\b/.test(type)) throw new Error('Step attribute on input type ' + type + ' is not supported.');
            const places = decimals(param), toInt = n => Math.round(n * Math.pow(10, places));
            const valid = decimals(value) <= places && toInt(value) % toInt(param) === 0;
            return this.optional(element) || valid;
        },
        email: function (value, element) { return this.optional(element) || /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value); },
        url: function (value, element) { return this.optional(element) || urlOk(value); },
        date: function (value, element) { return this.optional(element) || !/Invalid|NaN/.test(new Date(value).toString()); },
        dateISO: function (value, element) { return this.optional(element) || /^\d{4}[\/\-](0?[1-9]|1[012])[\/\-](0?[1-9]|[12][0-9]|3[01])$/.test(value); },
        number: function (value, element) { return this.optional(element) || /^(?:-?\d+|-?\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/.test(value); },
        digits: function (value, element) { return this.optional(element) || /^\d+$/.test(value); },
        equalTo: function (value, element, param) {
            const target = $(param);
            return target.length > 0 && value === this.elementValue(target[0]);
        },
        notEqualTo: function (value, element, param) { return this.optional(element) || !Validator.methods.equalTo.call(this, value, element, param); },
        creditcard: function (value, element) {
            if (this.optional(element)) return 'dependency-mismatch';
            if (/[^0-9 \-]+/.test(value)) return false;
            let nCheck = 0, bEven = false;
            value = value.replace(/\D/g, '');
            if (value.length < 13 || value.length > 19) return false;
            for (let n = value.length - 1; n >= 0; n--) {
                let nDigit = parseInt(value.charAt(n), 10);
                if (bEven && (nDigit *= 2) > 9) nDigit -= 9;
                nCheck += nDigit; bEven = !bEven;
            }
            return nCheck % 10 === 0;
        },
        extension: function (value, element, param) {
            param = typeof param === 'string' ? param.replace(/,/g, '|') : 'png|jpe?g|gif';
            return this.optional(element) || new RegExp('\\.(' + param + ')$', 'i').test(value);
        },
        accept: function (value, element, param) {
            let typeParam = typeof param === 'string' ? param.replace(/\s/g, '') : 'image/*';
            if (this.optional(element)) return 'dependency-mismatch';
            if ($(element).attr('type') === 'file') {
                typeParam = typeParam.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, '\\$&').replace(/,/g, '|').replace(/\\\/\*/g, '\\/.*');
                const re = new RegExp('.?(' + typeParam + ')$', 'i');
                return Array.from(element.files || []).every(f => !f.type || re.test(f.type));
            }
            return true;
        },
        pattern: function (value, element, param) {
            if (this.optional(element)) return true;
            const re = typeof param === 'string' ? new RegExp('^(?:' + param + ')$') : param;
            re.lastIndex = 0;
            return re.test(value);
        },
        maxWords: function (value, element, param) { return this.optional(element) || words(value).length <= param; },
        minWords: function (value, element, param) { return this.optional(element) || words(value).length >= param; },
        rangeWords: function (value, element, param) { const n = words(value).length; return this.optional(element) || (n >= param[0] && n <= param[1]); },
        integer: function (value, element) { return this.optional(element) || /^-?\d+$/.test(value); },
        lettersonly: function (value, element) { return this.optional(element) || /^[a-z]+$/i.test(value); },
        letterswithbasicpunc: function (value, element) { return this.optional(element) || /^[a-z\-.,()'"\s]+$/i.test(value); },
        alphanumeric: function (value, element) { return this.optional(element) || /^\w+$/i.test(value); },
        nowhitespace: function (value, element) { return this.optional(element) || /^\S+$/i.test(value); },
        ipv4: function (value, element) { return this.optional(element) || /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/i.test(value); },
        ipv6: function (value, element) { return this.optional(element) || isIPv6(value); },
        time: function (value, element) { return this.optional(element) || /^([01]\d|2[0-3]|[0-9])(:[0-5]\d){1,2}$/.test(value); },
        time12h: function (value, element) { return this.optional(element) || /^((0?[1-9]|1[012])(:[0-5]\d){1,2}( ?[AP]M))$/i.test(value); },
        phoneUS: function (value, element) {
            value = value.replace(/\s+/g, '');
            return this.optional(element) || (value.length > 9 && /^(\+?1-?)?(\([2-9]([02-9]\d|1[02-9])\)|[2-9]([02-9]\d|1[02-9]))-?[2-9]\d{2}-?\d{4}$/.test(value));
        },
        iban: function (value, element) { return this.optional(element) || ibanOk(value); },
        require_from_group: function (value, element, options) {
            const $fields = $(options[1], element.form), self = this;
            return $fields.filter(function () { return !!self.elementValue(this); }).length >= options[0];
        },
        skip_or_fill_minimum: function (value, element, options) {
            const $fields = $(options[1], element.form), self = this;
            const filled = $fields.filter(function () { return !!self.elementValue(this); }).length;
            return filled === 0 || filled >= options[0];
        }
    };

    // FileValidator as a jQuery-Validation method:  rules: { avatar: { fileValidator: { accept: '.png,.jpg', maxFileSizeMB: 2 } } }
    // or  data-rule-filevalidator='{"maxFileSizeMB":2}'.  Answers asynchronously; valid() treats it as pending until it arrives.
    Validator.methods.fileValidator = function (value, element, param) {
        if (this.optional(element)) return 'dependency-mismatch';
        const FileV = root.FileValidator || (typeof require === 'function' ? (function () { try { return require('./fileValidator.js'); } catch (e) { return null; } })() : null);
        if (!FileV) { if (root.console) console.warn('fileValidator method needs fileValidator.js to be loaded'); return true; }
        const files = Array.from(element.files || []);
        if (!files.length) return true;
        const options = param && typeof param === 'object' ? param : {};
        return FileV.validateFiles(files, options).then(function (res) {
            if (res.isValid) return true;
            return { valid: false, message: FileV.summary(res, { fileNames: files.length > 1 })[0] };
        });
    };
    Validator.messages.fileValidator = 'Please choose a valid file.';

    // ------------------------------------------------------------------ rule discovery (class, attributes, data-*, static)
    Validator.normalizeRule = function (data) {
        if (typeof data === 'string') {
            const transformed = {};
            $.each(data.split(/\s/), function () { if (this !== '') transformed[this] = true; });
            return transformed;
        }
        return data;
    };

    function normalizeAttributeRule(rules, type, method, value) {
        if (/min|max|step/.test(method) && (type === null || /number|range|text/.test(type))) {
            value = Number(value);
            if (isNaN(value)) value = undefined;
        }
        if (value || value === 0) rules[method] = value;
        else if (type === method && type !== 'range') rules[type === 'date' ? 'dateISO' : type] = true;
    }

    Validator.normalizeAttributeRule = normalizeAttributeRule;

    Validator.classRules = function (element) {
        const rules = {}, classes = $(element).attr('class');
        if (classes) $.each(classes.split(' '), function () { if (this in Validator.classRuleSettings) $.extend(rules, Validator.classRuleSettings[this]); });
        return rules;
    };

    Validator.attributeRules = function (element) {
        const rules = {}, $el = $(element), type = element.getAttribute('type');
        for (const method in Validator.methods) {
            let value;
            if (method === 'required') { value = element.getAttribute(method); if (value === '') value = true; value = !!value; }
            else value = $el.attr(method);
            normalizeAttributeRule(rules, type, method, value);
        }
        if (rules.maxlength && /-1|2147483647|524288/.test(rules.maxlength)) delete rules.maxlength;
        return rules;
    };

    Validator.dataRules = function (element) {
        const rules = {}, $el = $(element), type = element.getAttribute('type');
        for (const method in Validator.methods) {
            let value = $el.data('rule' + cap(method));
            if (value === '') value = true;
            normalizeAttributeRule(rules, type, method, value);
        }
        return rules;
    };

    Validator.staticRules = function (element) {
        const validator = $.data(element.form, 'validator');
        return (validator && validator.settings.rules ? Validator.normalizeRule(validator.settings.rules[element.name]) : null) || {};
    };

    Validator.normalizeRules = function (rules, element) {
        $.each(rules, function (prop, val) {
            if (val === false) { delete rules[prop]; return; }
            if (val && (val.param || val.depends)) {
                let keep = true;
                switch (typeof val.depends) {
                    case 'string': keep = !!$(val.depends, element.form).length; break;
                    case 'function': keep = val.depends.call(element, element); break;
                }
                if (keep) rules[prop] = val.param !== undefined ? val.param : true;
                else delete rules[prop];
            }
        });
        $.each(rules, function (rule, parameter) { rules[rule] = isFn(parameter) && rule !== 'normalizer' ? parameter(element) : parameter; });
        $.each(['minlength', 'maxlength'], function (i, name) { if (rules[name]) rules[name] = Number(rules[name]); });
        $.each(['rangelength', 'range'], function (i, name) {
            if (!rules[name]) return;
            if (Array.isArray(rules[name])) rules[name] = [Number(rules[name][0]), Number(rules[name][1])];
            else if (typeof rules[name] === 'string') {
                const parts = rules[name].replace(/[\[\]]/g, '').split(/[\s,]+/);
                rules[name] = [Number(parts[0]), Number(parts[1])];
            }
        });
        if (Validator.autoCreateRanges) {
            if (rules.min != null && rules.max != null) { rules.range = [rules.min, rules.max]; delete rules.min; delete rules.max; }
            if (rules.minlength != null && rules.maxlength != null) { rules.rangelength = [rules.minlength, rules.maxlength]; delete rules.minlength; delete rules.maxlength; }
        }
        return rules;
    };

    function rulesFor(element) {
        if (!element.form || !element.name) return {};
        let data = Validator.normalizeRules($.extend({}, Validator.classRules(element), Validator.attributeRules(element),
            Validator.dataRules(element), Validator.staticRules(element)), element);
        if (data.messages) delete data.messages;
        if (data.required) { const p = data.required; delete data.required; data = $.extend({ required: p }, data); $(element).attr('aria-required', 'true'); }
        if (data.remote) { const p = data.remote; delete data.remote; data = $.extend(data, { remote: p }); }
        return data;
    }

    // ------------------------------------------------------------------ engine bridge
    const registered = {};

    function dependsOnFor(method, param) {
        if ((method === 'equalTo' || method === 'notEqualTo') && typeof param === 'string') return param;
        if ((method === 'require_from_group' || method === 'skip_or_fill_minimum') && param && typeof param[1] === 'string') return param[1];
        return undefined;
    }

    function remoteRule(value, rule, env) {
        const validator = $.data(env.form, 'validator');
        if (validator.optional(env.field)) return true;
        const p = typeof rule.param === 'string' ? { url: rule.param } : (rule.param || {});
        const coreRule = {
            type: 'remote',
            url: p.url,
            method: (p.type || p.method || 'GET'),
            encoding: /json/i.test(p.contentType || '') ? 'json' : 'form',
            headers: p.headers,
            timeout: p.timeout,
            cache: p.cache !== false,
            credentials: p.xhrFields && p.xhrFields.withCredentials ? 'include' : undefined,
            data: () => { const d = {}; $.each(p.data || {}, function (k, v) { d[k] = isFn(v) ? v() : v; }); return d; }
        };
        return FV.getRule('remote').fn(value, coreRule, env);
    }

    function ensureRegistered(method) {
        if (registered[method]) return;
        registered[method] = true;
        const key = 'jq:' + method;
        if (method === 'remote') { FV.registerRule(key, remoteRule, { remote: true }); return; }
        FV.registerRule(key, function (value, rule, env) {
            const validator = $.data(env.form, 'validator'), fn = Validator.methods[method];
            if (!validator || !fn) return true;
            let val = validator.elementValue(env.field);
            if (isFn(rule.normalizer)) val = rule.normalizer.call(env.field, val);
            const res = fn.call(validator, val, env.field, rule.param);
            if (res === 'dependency-mismatch' || res === 'pending') return true;
            if (res && isFn(res.then)) return res;
            return !!res;
        }, { runOnEmpty: true }); // jQuery methods decide for themselves via this.optional(element)
    }

    // ------------------------------------------------------------------ Validator instance
    $.extend(Validator.prototype, {
        _init() {
            const self = this, s = this.settings, form = this.currentForm;
            $.data(form, 'validator', this);
            this.fv = FV.init({ form, rules: {}, config: this._buildConfig() });
            if (s.invalidHandler) $(form).on('invalid-form.validate', s.invalidHandler);
            const onFocusIn = function (e) { // native listener: works in every browser and jQuery version
                if (isFn(s.onfocusin)) s.onfocusin.call(self, e.target, e);
                if (!s.focusCleanup) return;
                const u = self.fv.unitOf(e.target);
                if (u && self.fv._errors.has(u.key)) self.fv.clearError(u.fields[0].name);
            };
            form.addEventListener('focusin', onFocusIn);
            this.fv._listeners.push(() => form.removeEventListener('focusin', onFocusIn));
            this._syncContainers();
        },

        _buildConfig() {
            const self = this, s = this.settings;
            let validateHidden = true, ignore = null;
            if (typeof s.ignore === 'string' && s.ignore.trim()) {
                const parts = s.ignore.split(',').map(x => x.trim()).filter(Boolean);
                validateHidden = !parts.includes(':hidden');
                const rest = parts.filter(x => x !== ':hidden').join(',');
                ignore = rest || null;
            }
            this._groupOf = {};
            Object.keys(s.groups || {}).forEach(g => String(s.groups[g]).split(/\s+/).filter(Boolean).forEach(n => { this._groupOf[n] = g; }));
            this._holder = D().createElement('div');   // showErrors mode: messages wait here, detached, until defaultShowErrors() places them
            const errorPlacement = isFn(s.showErrors) ? function (errorEl) { self._holder.appendChild(errorEl); }
                : (isFn(s.errorPlacement) || $(s.errorLabelContainer).length || s.wrapper
                    ? function (errorEl, field) { self._place($(errorEl), field); } : null);
            return {
                trim: s.trim !== false,
                novalidate: true,
                focusInvalid: s.focusInvalid,
                validateHidden, ignore,
                validateOn: s.onfocusout === false ? ['change'] : ['blur', 'change'],
                validateAfterSubmit: s.onkeyup !== false,
                liveInput: s.onkeyup !== false,
                skipEmptyUntilSubmit: true,
                debounce: 0,
                errorElement: s.errorElement,
                errorClass: s.errorClass,
                pendingClass: s.pendingClass,   // jQuery Validation adds "pending" to a field while a remote check runs
                invalidClass: '',
                errorPlacement,
                interceptSubmit: s.onsubmit !== false,
                skipSubmitter: '.cancel',
                fieldRules: field => self._coreRules(field),
                resolveMessage: (rule, env, dynamic) => {
                    // a message the developer wrote for this field wins over FileValidator's detailed one; server (remote) messages always win
                    if (dynamic && rule.method === 'fileValidator' && self._hasCustomMessage(env.field, rule.method)) dynamic = null;
                    return dynamic || self.defaultMessage(env.field, { method: rule.method, parameters: rule.param });
                },
                highlight: (field, unit) => { if (field === unit.fields[0]) { self.settings.highlight.call(self, field, s.errorClass, s.validClass); self._syncContainers(); self._afterErrorChange(); } },
                unhighlight: (field, unit) => { if (field === unit.fields[0]) { self._removeSuccess(field); self.settings.unhighlight.call(self, field, s.errorClass, s.validClass); self._syncContainers(); self._afterErrorChange(); } },
                onFieldValid: field => self._success(field),
                onError: () => { $(self.currentForm).triggerHandler('invalid-form', [self]); },
                // AJAX in one step: onSubmit(values, event, validator) gets the validated values; returning { errors: { field: message } } shows the server's messages
                onSubmit: isFn(s.onSubmit) ? function (values, event) { return s.onSubmit.call(self, values, event, self); } : undefined,
                submitHandler: s.debug || isFn(s.submitHandler) ? function (form, event, values) {
                    if (s.debug) { if (root.console) console.log('Submit handler called. The form is not submitted because "debug" is on.'); return false; }
                    let hidden = null;
                    const sub = event && event.submitter;
                    if (sub && sub.name) hidden = $('<input type="hidden"/>').attr('name', sub.name).val($(sub).val()).appendTo(form);
                    const r = s.submitHandler.call(self, form, event, values);   // jQuery Validation passes (form, event); the validated values are a third argument
                    if (hidden) hidden.remove();
                    return r;
                } : null
            };
        },

        _coreRules(element) {
            const self = this, rules = rulesFor(element), out = [];
            $.each(rules, function (method, param) {
                if (method === 'normalizer') return;
                ensureRegistered(method);
                out.push({ type: 'jq:' + method, method, param, normalizer: rules.normalizer, dependsOn: dependsOnFor(method, param) });
            });
            return out;
        },

        _place($error, field) {
            const s = this.settings, $field = $(field);
            const container = $(s.errorLabelContainer);
            let node = $error;
            if (s.wrapper) { node = $error.wrap('<' + s.wrapper + '/>').parent(); this._wrappers = this._wrappers || new Map(); this._wrappers.set(field, node); }
            if (container.length) { container.append(node); return; }
            if (isFn(s.errorPlacement)) s.errorPlacement.call(this, node, $field);
            else node.insertAfter($field);
        },

        _success(field) {
            const s = this.settings;
            if (!s.success || this.optional(field)) return;
            const $label = $('<' + s.errorElement + '/>').addClass(s.validClass).attr('for', field.id || '').text('');
            if (typeof s.success === 'string') $label.addClass(s.success); else if (isFn(s.success)) s.success.call(this, $label, field);
            this._successLabels = this._successLabels || new Map();
            this._successLabels.set(field, $label);
            if (isFn(s.errorPlacement)) s.errorPlacement.call(this, $label, $(field)); else $label.insertAfter(field);
        },

        _removeSuccess(field) {
            if (this._successLabels && this._successLabels.has(field)) { this._successLabels.get(field).remove(); this._successLabels.delete(field); }
            if (this._wrappers && this._wrappers.has(field)) { this._wrappers.get(field).remove(); this._wrappers.delete(field); }
        },

        // ---- groups: one visible message per group; showErrors: hand the messages to your own renderer
        _syncGroups() {
            if (!this._groupOf || !Object.keys(this._groupOf).length) return;
            const seen = {};
            this.fv.getErrors().sort((a, b) => (a.field.compareDocumentPosition(b.field) & 4 ? -1 : 1)).forEach(e => {
                const g = this._groupOf[e.name];
                if (!g) return;
                e.el.hidden = !!seen[g];       // the first error of a group shows, later ones are hidden (and not announced)
                seen[g] = true;
            });
        },

        _afterErrorChange() {
            this._syncGroups();
            if (isFn(this.settings.showErrors) && !this._showQueued) {   // async paths (blur, typing, submit): call it once per tick
                this._showQueued = true;
                Promise.resolve().then(() => { if (this._showQueued) this._runShowErrors(); });
            }
        },

        _runShowErrors() {
            this._showQueued = false;
            if (isFn(this.settings.showErrors)) this.settings.showErrors.call(this, this.errorMap, this.errorList);
        },

        /** Place every current message the normal way (after its field, or through errorPlacement). For use inside your showErrors. */
        defaultShowErrors() {
            this.fv.getErrors().forEach(e => {
                if (this.settings.errorLabelContainer && $(this.settings.errorLabelContainer).length || isFn(this.settings.errorPlacement) || this.settings.wrapper) this._place($(e.el), e.field);
                else $(e.field).after(e.el);
            });
            this._syncGroups();
            this._syncContainers();
        },

        _syncContainers() {
            const s = this.settings, all = $(s.errorContainer).add(s.errorLabelContainer);
            if (!all.length) return;
            if (this.fv && this.fv.getErrors().length) all.show(); else all.hide();
        },

        // ---- public API of the original validator object
        form() {
            const ok = this.fv.validateSync({ submit: true });
            this._syncContainers();
            this._runShowErrors();
            return ok;
        },
        element(element) {
            element = this.validationTargetFor(this.clean(element));
            const r = this.fv.validateElementSync(element);
            this._syncContainers();
            this._runShowErrors();
            return r !== false;
        },
        valid() { return this.size() === 0; },
        size() { return this.fv.getErrors().length; },
        numberOfInvalids() { return this.size(); },
        resetForm() { this.submitted = {}; this.fv.resetForm(); this._syncContainers(); },
        showErrors(errors) {
            if (errors) { Object.keys(errors).forEach(name => this.fv.setError(name, errors[name])); this._syncContainers(); }
        },
        /** The validated values as an object, ready for $.ajax / fetch: text trimmed, checkbox groups and multiple selects as arrays (passwords never trimmed). */
        getValues() { return this.fv.getValues(); },
        /** Resolves to { valid, values, errors }; shows the errors like form() does. */
        validateAndGetValues(options) { const self = this; return this.fv.validateAndGetValues(options).then(r => { self._syncContainers(); return r; }); },
        /** An event handler: validates, then calls fn(values, event, validator) only when the form is valid. fn may return { errors: { field: message } } from the server. */
        handleSubmit(fn) { const self = this; return event => this.fv.handleSubmit(fn)(event).then(r => { self._syncContainers(); return r; }); },
        hideErrors() { this.fv.clearErrors(); this._syncContainers(); },
        focusInvalid() {
            const e = this.fv.getErrors()[0];
            if (e) { try { e.field.focus(); } catch (x) { /* not focusable */ } }
        },
        destroy() {
            this.resetForm();
            this.fv.destroy();
            $(this.currentForm).off('.validate').removeData('validator');
        },
        clean(selector) { return $(selector)[0]; },
        validationTargetFor(element) {
            if (this.checkable(element)) element = this.findByName(element.name)[0] || element;
            return element;
        },
        findLastActive() {
            const last = this.lastActive;
            return last && $.grep(this.fv.getErrors(), n => n.field === last).length === 1 && last;
        },
        idOrName(element) { return element.id || element.name || ''; },
        escapeCssMeta(string) { return string.replace(/([\\!"#$%&'()*+,./:;<=>?@\[\]^`{|}~])/g, '\\$1'); },
        objectLength(obj) { return Object.keys(obj).length; },
        /** The error labels that belong to a field (matched by their `for` attribute). */
        errorsFor(element) {
            const id = this.idOrName(this.clean(element)), s = this.settings;
            return $(this.currentForm).find(s.errorElement + '.' + String(s.errorClass).split(' ').join('.')).filter(function () { return $(this).attr('for') === id; });
        },
        checkable(element) { return /radio|checkbox/i.test(element.type); },
        findByName(name) { return $(this.currentForm).find('[name="' + escName(name) + '"]'); },
        getLength(value, element) {
            switch (element.nodeName.toLowerCase()) {
                case 'select': return $('option:selected', element).length;
                case 'input': if (this.checkable(element)) return this.findByName(element.name).filter(':checked').length;
            }
            return value.length;
        },
        depend(param, element) {
            switch (typeof param) {
                case 'boolean': return param;
                case 'string': return !!$(param, element.form).length;
                case 'function': return param(element);
                default: return true;
            }
        },
        optional(element) {
            const val = this.elementValue(element);
            return !Validator.methods.required.call(this, val, element) && 'dependency-mismatch';
        },
        elementValue(element) {
            const $el = $(element), type = element.type;
            let val;
            if (type === 'radio' || type === 'checkbox') return this.findByName(element.name).filter(':checked').val();
            if (type === 'number' && element.validity !== undefined) return element.validity.badInput ? 'NaN' : $el.val();
            val = element.hasAttribute('contenteditable') ? $el.text() : $el.val();
            if (type === 'file') {
                if (element.files && element.files.length) return element.files[0].name; // more robust than the "fakepath" value
                if (val.substr(0, 12) === 'C:\\fakepath\\') return val.substr(12);
                const idx = val.lastIndexOf('/'); if (idx >= 0) return val.substr(idx + 1);
                const idx2 = val.lastIndexOf('\\'); if (idx2 >= 0) return val.substr(idx2 + 1);
                return val;
            }
            if (typeof val === 'string') {
                val = val.replace(/\r/g, '');
                if (this.settings.trim !== false && type !== 'password') val = trim(val);
            }
            return val;
        },
        elements() {
            const self = this;
            const seen = {};
            return $(this.currentForm).find('input, select, textarea, [contenteditable]')
                .not(':submit, :reset, :image, :disabled').filter(function () {
                    if (!this.name || seen[this.name] || $.isEmptyObject(rulesFor(this))) return false;
                    seen[this.name] = true;
                    return true;
                });
        },
        invalidElements() { return $(this.fv.getErrors().map(e => e.field)); },
        validElements() { const bad = this.fv.getErrors().map(e => e.field); return this.elements().not(function () { return bad.indexOf(this) > -1; }); },
        _hasCustomMessage(element, method) {
            const m = this.settings.messages[element.name];
            return !!((m && (m.constructor === String ? m : m[method])) || $(element).data('msg' + cap(method)) || $(element).data('msg'));
        },
        defaultMessage(element, rule) {
            if (typeof rule === 'string') rule = { method: rule };
            const s = this.settings, method = rule.method;
            const custom = (() => { const m = s.messages[element.name]; return m && (m.constructor === String ? m : m[method]); })();
            const dataMsg = $(element).data('msg' + cap(method)) || $(element).data('msg');
            const message = [custom, dataMsg, (!s.ignoreTitle && element.title) || undefined, Validator.messages[method],
                '<strong>Warning: No message defined for ' + element.name + '</strong>'].find(m => m !== undefined && m !== '');
            const re = /\$?\{(\d+)\}/g;
            if (isFn(message)) return message.call(this, rule.parameters, element);
            if (re.test(message)) return Validator.format(message.replace(re, '{$1}'), rule.parameters);
            return message;
        }
    });

    Object.defineProperty(Validator.prototype, 'errorList', {
        get() { return this.fv.getErrors().map(e => ({ message: e.message, element: e.field, method: undefined })); }
    });
    Object.defineProperty(Validator.prototype, 'errorMap', {
        get() { const m = {}; this.fv.getErrors().forEach(e => { m[e.name] = e.message; }); return m; }
    });

    // ------------------------------------------------------------------ jQuery plugin surface
    $.validator = Validator;

    $.extend($.fn, {
        validate(options) {
            if (!this.length) { if (options && options.debug && root.console) console.warn("Nothing selected, can't validate, returning nothing."); return; }
            let validator = $.data(this[0], 'validator');
            if (validator) return validator;
            this.attr('novalidate', 'novalidate');
            validator = new Validator(options, this[0]);
            $.data(this[0], 'validator', validator);
            return validator;
        },
        valid() {
            let valid, validator, errorList;
            if ($(this[0]).is('form')) valid = this.validate().form();
            else {
                errorList = [];
                valid = true;
                validator = $(this[0].form).validate();
                this.each(function () { valid = validator.element(this) && valid; if (!valid) errorList = errorList.concat(validator.errorList); });
            }
            return valid;
        },
        rules(command, argument) {
            const element = this[0];
            if (!element) return;
            if (command) {
                const settings = $.data(element.form, 'validator').settings, staticRules = settings.rules, existing = Validator.staticRules(element);
                switch (command) {
                    case 'add':
                        $.extend(existing, Validator.normalizeRule(argument));
                        delete existing.messages;
                        staticRules[element.name] = existing;
                        if (argument.messages) settings.messages[element.name] = $.extend(settings.messages[element.name], argument.messages);
                        break;
                    case 'remove':
                        if (!argument) { delete staticRules[element.name]; return existing; }
                        const filtered = {};
                        $.each(argument.split(/\s/), function (i, method) { filtered[method] = existing[method]; delete existing[method]; });
                        return filtered;
                }
            }
            return rulesFor(element);
        }
    });

    const pseudos = $.expr.pseudos || $.expr[':'];
    $.extend(pseudos, {
        blank: a => !trim('' + $(a).val()),
        filled: a => { const v = $(a).val(); return v !== null && !!trim('' + v); },
        unchecked: a => !$(a).prop('checked')
    });

    return Validator;
});
