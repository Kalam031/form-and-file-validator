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
