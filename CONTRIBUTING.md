# Contributing

Thanks for helping. The code is open source (MIT), but changes only reach `main` after review by a maintainer.

1. Fork the repo and create a branch. Nobody except the maintainers can push to this repository directly.
2. `npm ci`, change files in `src/` (never edit `dist/` by hand), then `npm run build`.
3. `npm test`, `npm run test:jquery3` and, if you touched the widget or the form engine, `npm run test:browser` must pass.
4. Add or update tests for what you changed. Bug fixes need a test that failed before the fix.
5. Open a pull request. CI must be green and a maintainer must approve before it is merged.

Language packs live in `src/locales/`: keep every key and every `{placeholder}` of the English text (the tests check this).

Security problems: do not open a public issue, see [SECURITY.md](SECURITY.md).
