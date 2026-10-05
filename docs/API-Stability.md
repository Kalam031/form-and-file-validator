# API stability and support policy

This page says what you can rely on when you upgrade.

## Versioning

The package follows [semver](https://semver.org/). `MAJOR.MINOR.PATCH`:

- **PATCH**: bug fixes, new or corrected translations, documentation. Never changes how a correct call behaves.
- **MINOR**: new rules, options, methods, languages and integrations. Existing calls keep working. A new *default* that changes what users see is never done in a minor; it is opt-in (for example `validateOn: 'smart'` is the default, other presets are options).
- **MAJOR**: anything listed below under "What counts as breaking".

Every release is in [CHANGELOG.md](../CHANGELOG.md). Each source file also keeps its own changelog in its header.

## What is public (stable)

- Everything documented in [FormValidator](FormValidator.md), [FileValidator](FileValidator.md) and [Server and frameworks](Server-and-Frameworks.md), and everything in `types/*.d.ts`.
- The entry points in `package.json` `exports` (`.`, `/core`, `/form`, `/file`, `/upload`, `/widget`, `/server`, `/testing`, `/scanners`, `/password`, `/react`, `/vue`, `/angular`, `/angular-signals`, `/svelte`, `/lit`, `/solid`, `/alpine`, `/jquery`, `/jquery-additional`, `/locales/*`).
- Error **codes** (`required`, `email.format`, `FILE_TOO_LARGE`, ...), rule names, option names, the `fv:*` events, CSS classes the library adds (`error`, `fv-valid`, `fv-submitting`, ...) and the `data-fv*` attributes.
- The shared test vectors in `spec/*.vectors.json` (they pin the behaviour of every rule).

## What is not public

- Anything with a leading underscore (`inst._errors`, `inst._stateSubs`, ...), and anything not in the types or the docs.
- The exact wording of **English messages** and the machine-quality translations. Messages can be corrected in a minor or patch release; rely on **codes**, not text, in tests and logic.
- The exact bytes and layout of `dist/` files beyond the documented names, and the order of the keys in returned objects.
- The devtools panel's markup and the console warnings' wording.

## What counts as breaking (needs a major version)

- Removing or renaming a public function, option, rule, code, event, export path or type.
- A valid input that used to pass now fails, or the reverse, **for a rule's documented behaviour** (a fix for a documented-wrong result is a bug fix and goes in a minor or patch, with a changelog line).
- Raising the minimum supported runtime (see below).
- Changing an option default in a way users can see.

Security fixes may tighten behaviour in a patch release (for example a file that is a polyglot is now blocked). They are always in the changelog.

## Deprecation

Something is deprecated for at least one **minor** release before it is removed in the next major. The deprecation is in the changelog, in the types (`@deprecated`) and, where it makes sense, as a one-time console warning that names the replacement.

## Supported runtimes

| | Supported |
| --- | --- |
| Node | the current LTS lines and newer (CI runs 18, 20, 22, 24, 26). A Node line is dropped in a minor release only after it reached end of life, and is announced in the changelog first. |
| Browsers | the last two major versions of Chrome, Edge, Firefox and Safari (the real-browser tests run Chromium, Firefox and WebKit). |
| Others | Deno, Bun and Cloudflare Workers work for the Node-free parts (`/core`, `/server`); they are tested in CI only where listed in the docs. |
| TypeScript | the declarations compile with the current stable TypeScript; types are checked in CI. |
| Frameworks | the peer ranges in `package.json` (`peerDependencies`); the listed integrations are tested against real installs of those versions. |

## Pre-release and unstable pieces

- Language packs marked "machine-quality" may change wording at any time (patch).
- Anything documented as **experimental** can change in a minor release. It says so on its documentation page.

## Reporting a problem

Use GitHub issues for bugs and [SECURITY.md](../SECURITY.md) for vulnerabilities.
