'use strict';
/*
 * ESLint plugin: catches rule mistakes in your code before the browser does.
 *
 *   // eslint.config.js
 *   import fv from 'form-and-file-validator/eslint-plugin';
 *   export default [fv.configs.recommended];
 *
 * Rule `form-and-file-validator/valid-rules` (error): in FormValidator.init / schema / checkValues / checkValue / action / toJsonSchema, useFormValidator and the
 * Angular helpers fvValidator / fvControls, an unknown rule name ("emial" -> did you mean "email"?), a range that can never pass, a minlength that is not a number,
 * an invalid pattern. Rules you register in the same file (registerRule / addMethod / addClassRules) are known; for others use
 * settings: { 'form-and-file-validator': { allow: ['myRule'] } }. Parts the plugin cannot read statically (variables, calls) are skipped, never guessed.
 */
const { checkRules, listRules, closest } = require('./fv-check.js');

const DYNAMIC = { __dynamic: true };
function keyName(p) {
    if (p.computed && p.key.type !== 'Literal') return null;
    if (p.key.type === 'Identifier') return p.key.name;
    if (p.key.type === 'Literal') return String(p.key.value);
    return null;
}
function toValue(node) {
    if (!node) return DYNAMIC;
    switch (node.type) {
        case 'Literal': return node.regex ? new RegExp(node.regex.pattern, node.regex.flags) : node.value;
        case 'TemplateLiteral': return node.expressions.length === 0 ? node.quasis.map(q => q.value.cooked).join('') : DYNAMIC;
        case 'UnaryExpression': { const v = toValue(node.argument); return node.operator === '-' && typeof v === 'number' ? -v : (node.operator === '!' && v !== DYNAMIC ? !v : DYNAMIC); }
        case 'ArrayExpression': return node.elements.map(e => (e && e.type !== 'SpreadElement') ? toValue(e) : DYNAMIC);
        case 'ObjectExpression': {
            const o = {};
            for (const p of node.properties) {
                if (p.type !== 'Property') return DYNAMIC;
                const k = keyName(p);
                if (k === null) return DYNAMIC;
                o[k] = p.kind === 'init' && p.value ? toValue(p.value) : DYNAMIC;
            }
            return o;
        }
        default: return DYNAMIC;
    }
}
const hasDynamic = v => v === DYNAMIC || (Array.isArray(v) ? v.some(hasDynamic) : (v && typeof v === 'object' && !(v instanceof RegExp) ? Object.keys(v).some(k => hasDynamic(v[k])) : false));

// where the rules are in each call: [callee name, which argument, 'rules' property of an options object?, whole map or one field spec]
const CALLS = {
    init: { arg: 0, prop: 'rules' }, schema: { arg: 0 }, checkValues: { arg: 1 }, checkValue: { arg: 1, single: true }, action: { arg: 0 }, toJsonSchema: { arg: 0 },
    useFormValidator: { arg: 0, prop: 'rules' }, fvValidator: { arg: 0, single: true }, fvControls: { arg: 0 }, fvSchema: { arg: 0 }, fvGroupValidator: { arg: 0 }
};
function calleeName(c) {
    if (c.type === 'Identifier') return c.name;
    if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') return c.property.name;
    return null;
}
function isFormValidatorCall(c, name) {
    if (c.type === 'Identifier') return ['useFormValidator', 'fvValidator', 'fvControls', 'fvSchema', 'fvGroupValidator'].indexOf(name) >= 0;
    return c.type === 'MemberExpression' && c.object.type === 'Identifier' && /^(FormValidator|FV)$/.test(c.object.name);
}

const validRules = {
    meta: {
        type: 'problem',
        docs: { description: 'Rule names and parameters passed to form-and-file-validator must exist and make sense' },
        schema: [{ type: 'object', properties: { allow: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
        messages: { problem: '{{message}}' }
    },
    create(context) {
        let known = null;
        const getKnown = () => {
            if (known) return known;
            let names = [];
            try { names = require('../dist/validator.js').FormValidator.ruleNames(); } catch (e) { names = []; }
            const opt = (context.options[0] && context.options[0].allow) || [];
            const setting = (context.settings && context.settings['form-and-file-validator'] && context.settings['form-and-file-validator'].allow) || [];
            const text = (context.sourceCode || context.getSourceCode()).text;
            const local = [];
            text.replace(/\b(?:registerRule|addMethod|addClassRules)\s*\(\s*['"]([\w$-]+)['"]/g, (m, n) => { local.push(n); return m; });
            known = names.concat(opt, setting, local);
            return known;
        };
        function checkSpec(rulesNode, single, reportNode) {
            const value = toValue(rulesNode);
            if (value === DYNAMIC) return;
            const map = single ? { value } : value;
            if (!map || typeof map !== 'object' || Array.isArray(map)) return;
            const knownNames = getKnown();
            if (!knownNames.length) return;
            const nodes = {};
            if (rulesNode.type === 'ObjectExpression' && !single) rulesNode.properties.forEach(p => { if (p.type === 'Property') { const k = keyName(p); if (k !== null) nodes[k] = p.value; } });
            Object.keys(map).forEach(field => {
                const spec = map[field];
                const at = nodes[field] || reportNode;
                if (spec === DYNAMIC) return;
                const findings = hasDynamic(spec)
                    ? listRules(spec).filter(r => knownNames.indexOf(r.type) < 0).map(r => ({ message: 'Unknown rule "' + r.type + '".' + (closest(r.type, knownNames) ? ' Did you mean "' + closest(r.type, knownNames) + '"?' : '') }))
                    : checkRules({ [field]: spec }, { known: knownNames, fieldsKnown: false }).filter(f => f.severity === 'error');
                findings.forEach(f => context.report({ node: at, messageId: 'problem', data: { message: (single ? '' : field + ': ') + f.message } }));
            });
        }
        return {
            CallExpression(node) {
                const name = calleeName(node.callee);
                const spec = name && Object.prototype.hasOwnProperty.call(CALLS, name) ? CALLS[name] : null;
                if (!spec || !isFormValidatorCall(node.callee, name)) return;
                let arg = node.arguments[spec.arg];
                if (!arg) return;
                if (spec.prop) {
                    if (arg.type !== 'ObjectExpression') return;
                    const p = arg.properties.find(x => x.type === 'Property' && keyName(x) === spec.prop);
                    if (!p) return;
                    arg = p.value;
                }
                checkSpec(arg, !!spec.single, arg);
            }
        };
    }
};

const plugin = { meta: { name: 'form-and-file-validator', version: require('../package.json').version }, rules: { 'valid-rules': validRules }, configs: {} };
plugin.configs.recommended = { name: 'form-and-file-validator/recommended', plugins: { 'form-and-file-validator': plugin }, rules: { 'form-and-file-validator/valid-rules': 'error' } };
module.exports = plugin;
