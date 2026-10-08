/*
 * Angular: the validators run on REAL @angular/forms controls and give the answers of spec/form-rules.vectors.json,
 * the same file the browser engine, Node and the .NET package are tested with.
 * Angular 22 needs Node 22.22+ / 24.15+ / 26+, so on older Node versions these tests skip themselves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const spec = require('../spec/form-rules.vectors.json');

let forms = null, loadError = null;
try { await import('@angular/compiler'); forms = await import('@angular/forms'); } catch (e) { loadError = e; }   // the JIT compiler lets Angular classes run outside an Angular build
const skip = forms ? false : 'Angular could not be loaded (it needs Node 22.22+, 24.15+ or 26+): ' + String(loadError && loadError.message).split('\n')[0];

const { fvValidator, fvControls, fvGroupValidator, fvMessage, fvText, fvWatch } = await import('../dist/integrations/angular.mjs');

test('every vector gives the same answer on a real Angular FormControl', { skip }, () => {
    const { FormControl, FormGroup } = forms;
    const bad = [];
    for (const c of spec.cases) {
        const field = new FormControl(c.value, fvValidator(c.rule));
        // rules that look at other fields (equalTo / notEqualTo) need the sibling controls of a group
        const group = { field };
        Object.entries(c.values || {}).forEach(([k, v]) => { group[k] = new FormControl(v); });
        new FormGroup(group);
        field.updateValueAndValidity();
        const valid = field.valid;
        const failed = field.errors && field.errors.fv && field.errors.fv.rule;
        if (valid !== c.valid || (c.failedRule && failed !== c.failedRule) || (!valid && !fvMessage(field))) bad.push(JSON.stringify(c.rule) + ' on ' + JSON.stringify(c.value) + ': expected ' + c.valid + ', got ' + valid + ' (' + failed + ')');
    }
    assert.equal(bad.length, 0, bad.length + ' of ' + spec.cases.length + ' vectors differ:\n' + bad.slice(0, 30).join('\n'));
});

test('errors carry the rule and a message, in the shape Angular templates expect', { skip }, () => {
    const { FormControl } = forms;
    const c = new FormControl('a@b', fvValidator(['required', 'email']));
    assert.equal(c.hasError('email'), true);
    assert.equal(c.getError('email').message, 'Please enter a valid email address.');
    assert.deepEqual(c.errors.fv, { rule: 'email', message: 'Please enter a valid email address.' });
    assert.equal(fvMessage(c), 'Please enter a valid email address.');
    c.setValue('a@b.co');
    assert.equal(c.valid, true);
    assert.equal(fvMessage(c), '');
});

test('fvControls + FormBuilder build a whole FormGroup; fvWatch keeps the confirm field in step', { skip }, () => {
    const { FormBuilder } = forms;
    const schema = {
        email: ['required', 'email'],
        pw: { required: true, pwcheck: { minLength: 8, requireUppercase: true, requireDigit: true } },
        pw2: { equalTo: 'pw' },
        born: ['required', { type: 'date', format: 'd/M/y' }]
    };
    const g = new FormBuilder().group(fvControls(schema, { email: 'a@b.co', pw: 'Abcdefg1', pw2: 'Abcdefg1', born: '29/2/2024' }));
    g.updateValueAndValidity();
    g.get('pw2').updateValueAndValidity();         // validators ran before the group existed: check once more now it is attached
    assert.equal(g.valid, true);
    g.get('born').setValue('29/2/2023');
    assert.equal(g.valid, false);
    assert.equal(fvMessage(g.get('born')), 'Please enter a valid date.');
    g.get('born').setValue('29/2/2024');
    g.get('pw').setValue('Different1');
    assert.equal(g.get('pw2').valid, true);           // Angular does not re-check the confirm field by itself ...
    const stop = fvWatch(g, schema);
    g.get('pw').setValue('Another1x');
    assert.equal(g.get('pw2').hasError('equalTo'), true);   // ... but fvWatch does
    g.get('pw2').setValue('Another1x');
    assert.equal(g.get('pw2').valid, true);
    stop();
    g.get('pw').setValue('Third1xyz');
    assert.equal(g.get('pw2').valid, true);           // stopped watching
});

test('fvGroupValidator reports every field at once', { skip }, () => {
    const { FormGroup, FormControl } = forms;
    const g = new FormGroup({ a: new FormControl('x'), b: new FormControl('') }, { validators: fvGroupValidator({ a: ['email'], b: ['required'] }) });
    assert.equal(g.valid, false);
    assert.deepEqual(Object.keys(g.errors.fv.errors).sort(), ['a', 'b']);
});

test('values: null is blank, numbers and booleans become text, a Date becomes its local calendar date', () => {
    assert.equal(fvText(null), '');
    assert.equal(fvText(undefined), '');
    assert.equal(fvText(42), '42');
    assert.equal(fvText(true), 'true');
    assert.equal(fvText(new Date(2024, 1, 29, 23, 59)), '2024-02-29');
    assert.equal(fvText(new Date('x')), '');
});

test('a blank control skips every rule except required, like the browser form', () => {
    const control = { value: null, parent: null };
    assert.equal(fvValidator(['email'])(control), null);
    assert.equal(fvValidator(['required'])(control).required.message, 'This field is required.');
});

test('fvSubmit: touches and checks everything, calls you only for a valid form with trimmed values, shows the server messages', { skip }, async () => {
    const { FormBuilder } = forms;
    const { fvSubmit, fvValues, fvSetErrors } = await import('../dist/integrations/angular.mjs');
    const schema = { email: ['required', 'email'], password: { required: true }, born: [{ type: 'date', format: 'd/M/y' }] };
    const g = new FormBuilder().group(fvControls(schema, { email: '', password: ' pw ', born: '' }));
    const sent = [];
    let r = await fvSubmit(g, async values => { sent.push(values); });
    assert.equal(r.valid, false);
    assert.equal(sent.length, 0, 'invalid: not called');
    assert.equal(g.get('email').touched, true, 'every control is touched so its message shows');
    assert.equal(fvMessage(g.get('email')), 'This field is required.');

    g.patchValue({ email: '  taken@example.com ', born: '29/2/2000' });
    r = await fvSubmit(g, async values => { sent.push(values); return values.email === 'taken@example.com' ? { errors: { Email: 'Already registered' } } : { ok: 1 }; });
    assert.deepEqual(sent, [{ email: 'taken@example.com', password: ' pw ', born: '29/2/2000' }], 'trimmed, the password is not');
    assert.equal(r.valid, false, 'the server said no');
    assert.equal(fvMessage(g.get('email')), 'Already registered');

    g.get('email').setValue('free@example.com');
    r = await fvSubmit(g, async () => ({ ok: 1 }));
    assert.equal(r.valid, true);
    assert.deepEqual(r.result, { ok: 1 });
    assert.deepEqual(fvValues(g), { email: 'free@example.com', password: ' pw ', born: '29/2/2000' });
    assert.deepEqual(fvSetErrors(g, { password: 'Too weak', nothere: 'x' }), ['nothere']);
});

test('fvServerErrors shows a backend answer on the controls and the group; fvPrecognition asks the real endpoint', { skip }, async () => {
    const { FormControl, FormGroup } = forms;
    const { fvServerErrors, fvPrecognition } = await import('../dist/integrations/angular.mjs');
    const g = new FormGroup({ email: new FormControl('a@b.co', fvValidator(['required', 'email'])), name: new FormControl('Bob') });
    const r = fvServerErrors(g, { type: 'about:blank', status: 422, errors: { Email: ['Already registered'], Nothere: ['x'], '': ['Try later'] } });
    assert.equal(fvMessage(g.get('email')), 'Already registered');
    assert.deepEqual(r.missed, ['Nothere']);
    assert.ok(g.errors && g.errors.server, 'what belongs to no control lands on the group');

    const g2 = new FormGroup({ email: new FormControl('a@b.co'), name: new FormControl('Bob') });
    const calls = [];
    const fetchStub = async (url, init) => { calls.push({ url: String(url), headers: init && init.headers }); return { ok: false, status: 422, headers: { get: () => 'application/json' }, json: async () => ({ errors: { email: ['Taken'] } }), text: async () => '' }; };
    const p = await fvPrecognition(g2, '/api/signup', { fetch: fetchStub, only: ['email'] });
    assert.equal(p.valid, false);
    assert.equal(calls.length, 1);
    assert.equal(fvMessage(g2.get('email')), 'Taken');
    const ok = await fvPrecognition(new FormGroup({ email: new FormControl('x') }), '/api/signup', { fetch: async () => ({ ok: true, status: 204, headers: { get: () => null }, json: async () => ({}), text: async () => '' }) });
    assert.equal(ok.valid, true);
    const offline = await fvPrecognition(new FormGroup({ email: new FormControl('x') }), '/api/signup', { fetch: async () => { throw new Error('offline'); } });
    assert.equal(offline.valid, null, 'could not check: nothing is shown');
});
