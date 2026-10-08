# Tooling: command line, ESLint, codemods, export

Everything here is optional and ships in the same package (the `tools/` folder). Nothing is added to what your visitors download.

## The `fv` command line

```
npx fv check rules.json                  # lint a rules file
npx fv export rules.json --to zod        # rules as Zod / TypeScript / JSON Schema / HTML / React / Vue / Angular
npx fv import ./schema.mjs --from zod    # a Zod, Yup or Joi schema (or a JSON Schema file) as rules
npx fv migrate "src/**/*.js" --write     # jQuery Validation calls -> FormValidator
npx fv rules                             # every rule name
```

A rules file is JSON (`{ "rules": { ... } }`, a plain map, or a JSON Schema / OpenAPI object) or a `.js` / `.mjs` / `.cjs` module exporting the rules (default export, a `rules` export, or `module.exports`). `--export name` picks a named export. The exit code is `0` when clean, `1` when problems were found, `2` for a usage error, so `fv check` fits in CI.

### `fv check`

Finds the mistakes that would otherwise show up as a console warning on a live page:

```
error: email (emial): Unknown rule "emial". Did you mean "email"?
error: age (range): "range" has min 50 above max 10: nothing can pass.
error: age (minlength): "minlength" needs a number, got "x".
warning: pw2 (equalTo): "equalTo" refers to the field "pw", which has no rules here (fine if it is a plain field of the form).
```

Your own rules are unknown to a plain run: load the file that registers them with `--require ./setup.js`, or list them with `--allow myRule,otherRule`. `--json` prints the findings as JSON.

### `fv export` and the playground

`fv export rules.json --to zod --name Signup` writes a Zod schema and its inferred type; `typescript` an interface; `json-schema` a JSON Schema (2020-12); `html` a form with `data-fv` attributes; `react`, `vue`, `angular` a starter component. Rules that a target cannot say (`equalTo`, `requiredIf`, ...) are kept as a comment so nothing disappears silently. The [playground](playground.html) has the same exporter in a box: type the rules, pick a format, copy.

### `fv import`

Already have a schema? `fv import ./schema.mjs --from zod --export signupSchema > rules.json`. Zod 4, Yup and Joi schemas are read through their own public description; a JSON Schema or OpenAPI component works too (`--from json-schema`). Whatever has no rule equivalent (`refine`, unions, exclusive bounds) is listed on stderr. The same conversion is available in code as `FormValidator.fromZod(schema)` and `FormValidator.fromYup(schema)`.

### `fv migrate`

For code that should stop depending on jQuery: `$('#signup').validate({ rules, messages })` becomes `FormValidator.init({ form: '#signup', rules, messages })`, `.valid()` becomes `FormValidator.isValid(...)`, and `$.validator.addMethod` / `addClassRules` become `FormValidator.addMethod` / `addClassRules`. Without `--write` it only reports. Options other than `rules` and `messages` (`submitHandler`, `errorPlacement`, ...) stay in a `/* TODO */` comment and are listed, because they have a different shape in the new API ([migration guide](Migrating-from-jQuery-Validate.md)). If you keep jQuery, you do not need this: the compatibility layer runs your existing code unchanged.

## ESLint

```js
// eslint.config.js
import fv from 'form-and-file-validator/eslint-plugin';
export default [fv.configs.recommended];
```

The rule `form-and-file-validator/valid-rules` reads the rules you write in `FormValidator.init`, `schema`, `checkValues`, `checkValue`, `action`, `toJsonSchema`, `useFormValidator` and the Angular helpers, and reports unknown rule names (with a suggestion), impossible ranges, non-numeric lengths and invalid patterns, right in the editor. Rules registered in the same file with `registerRule` / `addMethod` are known; others go in `settings: { 'form-and-file-validator': { allow: ['myRule'] } }`. Anything it cannot read statically (variables, function calls) is skipped, never guessed.

## Editor help

`snippets/form-and-file-validator.code-snippets` has VS Code snippets, and `schemas/rules.schema.json` is a JSON Schema for a rules file: point your editor at it (`"$schema": "./node_modules/form-and-file-validator/schemas/rules.schema.json"`) for completion and checks while you type.

## Cookbook

[Recipes](Recipes.md) has copy-ready answers (all run by the test suite), plus Storybook and Playwright examples.
