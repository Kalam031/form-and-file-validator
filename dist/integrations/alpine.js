/*!
 * Alpine.js plugin v1.0.0 — x-validate on a <form>, x-dropzone on a file zone. Plain script: load it BEFORE Alpine, after the validator bundle.
 *
 *   <script src="dist/validator.min.js"></script>
 *   <script src="dist/integrations/alpine.js"></script>
 *   <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
 *
 *   <form x-data x-validate="{ rules: { email: ['required', 'email'] } }">
 *     <input name="email"> <button>Send</button>
 *   </form>
 *
 *   <div x-data="{ files: [] }" x-dropzone="{ config: { accept: 'image/*', maxFiles: 3 }, options: { preview: true } }"
 *        @fv-change="files = $event.detail.files">
 *     <input type="file" name="photos"> <ul class="fv-list"></ul> <div class="fv-messages"></div> <div class="fv-status" aria-live="polite"></div>
 *   </div>
 *
 * Inside the element: $el.__fvInstance (form) or $el.__fvWidget (zone). The zone dispatches "fv-change" and "fv-reject" events with { detail }.
 * Elements with the classes fv-list / fv-messages / fv-status inside the zone are used automatically.
 *
 * Changelog
 *   1.0.0  First release.
 */
(function (root) {
    'use strict';
    function register(Alpine) {
        var FV = root.FormValidator, FF = root.FileValidator;
        if (!FV || !FF) throw new Error('Load the FormValidator bundle (dist/validator.min.js) before the Alpine plugin');

        Alpine.directive('validate', function (el, directive, utilities) {
            var evaluate = utilities.evaluateLater(directive.expression || '{}');
            var cleanup = utilities.cleanup;
            evaluate(function (o) {
                o = o || {};
                el.__fvInstance = FV.init({ form: el, rules: o.rules || {}, config: o.config, messages: o.messages, context: o.context });
            });
            cleanup(function () { if (el.__fvInstance) el.__fvInstance.destroy(); el.__fvInstance = null; });
        });

        Alpine.directive('dropzone', function (el, directive, utilities) {
            var evaluate = utilities.evaluateLater(directive.expression || '{}');
            var cleanup = utilities.cleanup;
            evaluate(function (o) {
                o = o || {};
                var pick = function (cls) { return el.querySelector('.' + cls); };
                var fire = function (name, detail) { el.dispatchEvent(new root.CustomEvent(name, { bubbles: true, detail: detail })); };
                var options = Object.assign({ list: pick('fv-list'), messageElement: pick('fv-messages'), statusElement: pick('fv-status') }, o.options, {
                    onChange: function (files, entries, info) { fire('fv-change', { files: files, entries: entries, info: info }); },
                    onReject: function (rejected, info) { fire('fv-reject', { rejected: rejected, info: info }); }
                });
                el.__fvWidget = FF.widget(el, o.config || {}, options);
            });
            cleanup(function () { if (el.__fvWidget) el.__fvWidget.destroy(); el.__fvWidget = null; });
        });
    }
    if (root.Alpine) register(root.Alpine);
    else if (root.document) root.document.addEventListener('alpine:init', function () { register(root.Alpine); });
    if (typeof module === 'object' && module.exports) module.exports = register;
    root.FVAlpine = register;   // Alpine bundled by your build tool: import Alpine from 'alpinejs'; window.FVAlpine(Alpine)
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
