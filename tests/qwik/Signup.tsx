import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { fvQwik } from 'form-and-file-validator/qwik';

export const Signup = component$(() => {
    const errors = useSignal<{ name: string; message: string }[]>([]);
    const valid = useSignal<boolean | null>(null);
    const formRef = useSignal<HTMLFormElement>();
    useVisibleTask$(({ cleanup }) => {
        const form = formRef.value!;
        const fv = fvQwik(form, {
            rules: { email: ['required', 'email'], name: { required: true, minlength: 3 } },
            onErrors: list => { errors.value = list; },
            onValid: ok => { valid.value = ok; }
        });
        (window as any).__fv = fv;
        cleanup(() => fv.destroy());
    }, { strategy: 'document-ready' });
    return (
        <form ref={formRef} id="signup" preventdefault:submit noValidate>
            <input name="email" />
            <input name="name" />
            <ul id="errs">{errors.value.map(e => <li key={e.name}>{e.name}: {e.message}</li>)}</ul>
            <p id="state">{valid.value === null ? 'unchecked' : valid.value ? 'valid' : 'invalid'}</p>
            <button type="submit">Save</button>
        </form>
    );
});
