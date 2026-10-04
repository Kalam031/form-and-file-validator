/*!
 * Vue 3 bindings v1.0.0 — useFormValidator(), the v-form-validator directive and <FileDropzone>. Needs vue >= 3 (peer dependency).
 *
 *   import { useFormValidator, FileDropzone, vFormValidator } from 'form-and-file-validator/vue';
 *
 *   <script setup>
 *   const { formRef, validate, errors } = useFormValidator({ rules: { email: ['required', 'email'] } });
 *   </script>
 *   <form ref="formRef" @submit.prevent="validate().then(ok => ok && send())">...</form>
 *   or, with the validated values:  const { formRef, handleSubmit } = useFormValidator(...);   <form ref="formRef" @submit="handleSubmit(async values => { await api.post(values) })">
 *   (a handler that returns { errors: { field: message } } shows the server's messages on the fields)
 *   <FileDropzone name="photos" :config="{ accept: 'image/*', maxFiles: 3 }" :options="{ preview: true }" @change="files => ..." />
 *   <form v-form-validator="{ rules: { email: ['required', 'email'] } }">...</form>       <!-- directive form, no script needed -->
 *
 * Changelog
 *   1.0.0  First release.
 */
import { defineComponent, h, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { FormValidator, FileValidator } from 'form-and-file-validator';

const initOptions = (form, o) => ({ form, rules: (o && o.rules) || {}, config: o && o.config, messages: o && o.messages, context: o && o.context });

/** Composable: bind `formRef` to your <form ref="formRef">. Returns { formRef, validate(options), reset(), errors (ref), instance }. */
export function useFormValidator(options) {
    const formRef = ref(null);
    const instance = shallowRef(null);
    const errors = ref([]);
    let ownSubmit = false;   // handleSubmit() was used: your @submit does the validating, so the engine must not swallow the submit event
    const create = () => {
        if (instance.value) instance.value.destroy();
        const o = initOptions(formRef.value, typeof options === 'function' ? options() : (options && options.value !== undefined ? options.value : options));
        if (ownSubmit) o.config = Object.assign({}, o.config, { interceptSubmit: false });
        instance.value = formRef.value ? FormValidator.init(o) : null;
    };
    onMounted(create);
    onBeforeUnmount(() => { if (instance.value) instance.value.destroy(); instance.value = null; });
    if (typeof options === 'function' || (options && options.__v_isRef)) watch(options, create, { deep: true });   // getter or ref: re-create when the rules change
    const validate = async (opts) => {
        if (!instance.value) return false;
        const ok = await instance.value.validate(opts);
        errors.value = instance.value.getErrors();
        return ok;
    };
    const reset = () => { if (instance.value) { instance.value.resetForm(); errors.value = []; } };
    /** Event handler: validates, then calls fn(values, event) only when the form is valid. fn may return { errors: { field: message } } from your server to show them. */
    const handleSubmit = fn => {
        ownSubmit = true;   // call handleSubmit() in setup (as in the example), before the validator is created
        return async event => {
            if (!instance.value) { if (event && event.preventDefault) event.preventDefault(); return { valid: false, values: {}, errors: [] }; }
            const r = await instance.value.handleSubmit(fn)(event);
            errors.value = instance.value ? instance.value.getErrors() : [];
            return r;
        };
    };
    const getValues = () => (instance.value ? instance.value.getValues() : {});
    const setServerErrors = map => { if (!instance.value) return Object.keys(map || {}); const missed = instance.value.setErrors(map); errors.value = instance.value.getErrors(); return missed; };
    return { formRef, validate, reset, errors, handleSubmit, getValues, setErrors: setServerErrors, instance };
}

/** Directive: v-form-validator="{ rules, config, messages }" on a <form>. The instance is reachable as form.__fvInstance. */
export const vFormValidator = {
    mounted(el, binding) { el.__fvInstance = FormValidator.init(initOptions(el, binding.value)); },
    updated(el, binding) {
        if (JSON.stringify(binding.value) === JSON.stringify(binding.oldValue)) return;
        if (el.__fvInstance) el.__fvInstance.destroy();
        el.__fvInstance = FormValidator.init(initOptions(el, binding.value));
    },
    unmounted(el) { if (el.__fvInstance) el.__fvInstance.destroy(); el.__fvInstance = null; }
};

/** <FileDropzone :config :options name id label @change @reject /> ; a template ref exposes { files, entries, validate(), clear(), add(), appendTo(formData) }. */
export const FileDropzone = defineComponent({
    name: 'FileDropzone',
    props: { config: { type: Object, default: () => ({}) }, options: { type: Object, default: () => ({}) }, name: String, id: String, label: String },
    emits: ['change', 'reject'],
    setup(props, { emit, expose }) {
        const zone = ref(null), input = ref(null), list = ref(null), messages = ref(null), status = ref(null);
        let controller = null;
        const create = () => {
            if (controller) controller.destroy();
            controller = FileValidator.widget(zone.value, props.config, Object.assign({
                input: input.value, list: list.value, messageElement: messages.value, statusElement: status.value
            }, props.options, {
                onChange: (files, entries, info) => emit('change', files, entries, info),
                onReject: (rejected, info) => emit('reject', rejected, info)
            }));
        };
        onMounted(create);
        onBeforeUnmount(() => { if (controller) controller.destroy(); controller = null; });
        watch(() => JSON.stringify([props.config, Object.keys(props.options)]), () => { if (zone.value) create(); });
        expose({
            get files() { return controller ? controller.files : []; },
            get entries() { return controller ? controller.entries : []; },
            validate: () => controller.validate(),
            clear: () => controller && controller.clear(),
            add: (files, meta) => controller.add(files, meta),
            appendTo: (formData, n) => controller.appendTo(formData, n || props.name)
        });
        return () => h('div', { ref: zone, class: 'fv-zone' }, [
            h('input', { ref: input, type: 'file', name: props.name, id: props.id, multiple: props.config.maxFiles !== 1, accept: props.config.accept }),
            props.label ? h('p', { class: 'fv-zone-label' }, props.label) : null,
            h('ul', { ref: list, class: 'fv-list' }),
            h('div', { ref: messages, class: 'fv-messages' }),
            h('div', { ref: status, class: 'fv-status', 'aria-live': 'polite' })
        ]);
    }
});

/** app.use(FormValidatorPlugin) registers <FileDropzone> and v-form-validator globally. */
export const FormValidatorPlugin = { install(app) { app.component('FileDropzone', FileDropzone); app.directive('form-validator', vFormValidator); } };

export default { useFormValidator, vFormValidator, FileDropzone, FormValidatorPlugin };
