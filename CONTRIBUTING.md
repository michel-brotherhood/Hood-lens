# Contributing to Hood Lens

Open an issue describing a bug or proposed behavior change before submitting a pull request. Keep changes focused and avoid runtime dependencies unless necessary. Never include client CSVs, personal information or credentials.

Use Node.js 24 or newer:

```bash
npm ci
npm test
npm run build
node --check app.js
node --check csv.js
node --check csv-worker.js
```

Serve `dist/` or the source directory over HTTP to test module scripts and workers. For visual changes, check narrow and wide layouts, keyboard navigation, focus, empty/error/loading states and reduced motion. Use synthetic data only in examples and screenshots.

Describe the problem, the resulting behavior and the checks actually performed in each pull request. Add meaningful parser and lifecycle regression tests when changing behavior. Source code is MIT licensed; brand artwork has separate rights as described in README.md.
