/*!
 * React bindings v1.0.0 — useFormValidator() and <FileDropzone>. Needs react >= 17 (peer dependency).
 *
 *   import { useFormValidator, FileDropzone } from 'form-and-file-validator/react';
 *
 *   function Signup() {
 *     const { ref, validate, errors } = useFormValidator({ rules: { email: ['required', 'email'] } });
 *     return <form ref={ref} onSubmit={async e => { e.preventDefault(); if (await validate()) send(); }}>...</form>;
 *   }
 *   <FileDropzone name="photos" config={{ accept: 'image/*', maxFiles: 3 }} options={{ preview: true }} onChange={files => setFiles(files)} />
 *
 * Changelog
 *   1.0.0  First release.
 */
import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FormValidator, FileValidator } from 'form-and-file-validator';

/**
 * Attaches FormValidator to the <form> that gets `ref`. `deps` (default []) decide when it is created again, for example when the rules change.
 * Returns { ref, validate(options), errors, instance() }. `errors` is refreshed after every validate() call and when the form is reset.
 */
export function useFormValidator(options, deps) {
    const ref = useRef(null);
    const instance = useRef(null);
    const latest = useRef(options);
    latest.current = options;
    const [errors, setErrors] = useState([]);
    useEffect(() => {
        const form = ref.current;
        if (!form) return undefined;
        const o = latest.current || {};
        instance.current = FormValidator.init({ form, rules: o.rules || {}, config: o.config, messages: o.messages, context: o.context });
        return () => { if (instance.current) instance.current.destroy(); instance.current = null; };
    }, deps || []);   // eslint-disable-line react-hooks/exhaustive-deps
    const validate = useCallback(async (opts) => {
        if (!instance.current) return false;
        const ok = await instance.current.validate(opts);
        setErrors(instance.current.getErrors());
        return ok;
    }, []);
    const reset = useCallback(() => { if (instance.current) { instance.current.resetForm(); setErrors([]); } }, []);
    return { ref, validate, reset, errors, instance: () => instance.current };
}

/**
 * Drag-and-drop file zone. Props: config (FileValidator options), options (widget options), onChange(files, entries), onReject(rejected),
 * name, id, className, label (text inside the zone), inputProps. A ref gives the widget controller ({ files, validate(), clear(), appendTo(formData) ... }).
 */
export const FileDropzone = forwardRef(function FileDropzone(props, forwardedRef) {
    const { config, options, onChange, onReject, name, id, className, label, inputProps } = props;
    const zone = useRef(null), input = useRef(null), list = useRef(null), messages = useRef(null), status = useRef(null);
    const controller = useRef(null);
    const callbacks = useRef({});
    callbacks.current = { onChange, onReject };
    useImperativeHandle(forwardedRef, () => ({
        get files() { return controller.current ? controller.current.files : []; },
        get entries() { return controller.current ? controller.current.entries : []; },
        validate: () => controller.current.validate(),
        clear: () => controller.current && controller.current.clear(),
        add: (files, meta) => controller.current.add(files, meta),
        appendTo: (formData, n) => controller.current.appendTo(formData, n || name)
    }), [name]);
    const key = JSON.stringify([config, options && Object.keys(options)]);   // create the widget again only when the settings change
    useEffect(() => {
        controller.current = FileValidator.widget(zone.current, config || {}, Object.assign({
            input: input.current, list: list.current, messageElement: messages.current, statusElement: status.current
        }, options, {
            onChange: (files, entries, info) => { if (callbacks.current.onChange) callbacks.current.onChange(files, entries, info); },
            onReject: (rejected, info) => { if (callbacks.current.onReject) callbacks.current.onReject(rejected, info); }
        }));
        return () => { if (controller.current) controller.current.destroy(); controller.current = null; };
    }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
    const multiple = !config || config.maxFiles !== 1;
    return createElement('div', { ref: zone, className: className || 'fv-zone' },
        createElement('input', Object.assign({ ref: input, type: 'file', name, id, multiple, accept: config && config.accept }, inputProps)),
        label ? createElement('p', { className: 'fv-zone-label' }, label) : null,
        createElement('ul', { ref: list, className: 'fv-list' }),
        createElement('div', { ref: messages, className: 'fv-messages' }),
        createElement('div', { ref: status, className: 'fv-status', 'aria-live': 'polite' }));
});

export default { useFormValidator, FileDropzone };
