# Hood Lens

**Uma ferramenta Behood para explorar seus dados. / A Behood tool to explore your data.** Open, search, sort and export CSV data locally in your browser. No account and no file uploads.

Hood Lens is the next version of CSV Lens. The product name has changed; the existing `michel-brotherhood/csv-lens` repository and GitHub Pages address can stay as they are.

## What it does

- Import a CSV by choosing a file or dropping it into the workspace (up to 20 MB).
- Detect commas, semicolons and tabs, or select the delimiter yourself.
- Search across every column, ignoring case and accents.
- Sort by column and browse 25, 50 or 100 rows per page.
- Export all matching rows as a semicolon-separated CSV with UTF-8 BOM.
- Cancel an import or close the file to clear the application's table and file references.
- Try the synthetic sample dataset without supplying a file.

## Run locally

Requires Node.js 24 or newer for development. The website itself has no runtime dependencies or backend.

```bash
npm ci
npm test
npm run build
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open `http://localhost:8080`. Do not open `index.html` through `file://`: module scripts and module workers require an HTTP server. The source directory can also be served directly.

## Publish with GitHub Pages

1. Copy the contents of this project into the root of your existing `csv-lens` repository, including `assets`, `.github` and `.nojekyll`.
2. Commit and push the changes.
3. In **Settings → Pages**, select **Deploy from a branch**, **main**, **/ (root)** and save.
4. Wait for the Pages deployment in **Actions**, then open the URL shown in Pages settings.

All application URLs are relative so the app works under a repository subpath. No repository rename or custom domain is required. If Pages is already set to `main` and `/ (root)`, keep those settings.

Alternatively, `npm run build` creates `dist/` with only public application assets. Cloudflare Pages can use build command `npm run build` and output directory `dist`. The `_headers` file configures HTTP headers on Cloudflare Pages; GitHub Pages does not interpret it.

## Design and language

Version 1.3 provides Portuguese (default) and English via the PT/EN switch. Interface labels, metadata, errors, pagination, accessible labels and generated column names update immediately, preserving the open file, search and page. The language preference is stored locally; CSV data is never saved to local storage or translated. The synthetic sample remains data rather than translated interface content.

The design uses a light workspace, a compact sidebar, readable typography and the supplied Hood emblem with its black background removed. Artwork assets use real alpha transparency. No remote fonts or analytics are loaded. Reduced-motion preferences are respected.

© 2026 Behood — [behood.com.br](https://behood.com.br).

The supplied artwork is included as optimized WebP assets. `LICENSE` covers the source code; it does not grant rights to the Behood/Hood brand or supplied artwork.

## Data handling and limits

Files are parsed in a module Web Worker on the device. The app does not upload file contents, use analytics, or save records in local storage. Loading the sample fetches only the public synthetic CSV from this site's origin. Hosting the website still involves normal HTTP requests for its public assets.

CSV text and rows are held in memory while open. Closing a file clears application references and the rendered table; this is not a guarantee of forensic memory erasure. Search, sort and export still run on the main thread, and a 20 MB limit does not guarantee smooth performance on every device. Files must be UTF-8. Detection is heuristic; use the delimiter selector for ambiguous input.

Export prefixes formula-like cells with an apostrophe, including cells with leading control characters. This changes those exported values and is not a guarantee of safety in every spreadsheet application. Numeric-looking strings and identifiers remain strings during import.

## Verification

```bash
npm ci
npm test
npm run build
npm run benchmark
```

The automated suite covers parsing, formula protection, import cancellation, competing reads, search, sort, export and DOM cleanup. DOM tests simulate the Worker and network; a separate test checks the worker message handler. These checks do not replace browser layout, assistive technology or spreadsheet compatibility testing. See `VALIDATION.md` for the results recorded for this release.

## Project structure

| Path                       | Purpose                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `index.html`, `styles.css` | Responsive interface and visual identity                    |
| `i18n.js`                  | Portuguese/English interface messages and error translation |
| `app.js`                   | Import lifecycle, filtering, table and export               |
| `csv.js`, `csv-worker.js`  | CSV parser, formula protection and worker                   |
| `assets/`                  | Hood artwork and small brand image                          |
| `examples/demo.csv`        | Synthetic sample inventory                                  |
| `*.test.js`                | Regression and interface tests                              |
| `scripts/build.mjs`        | Public-file build with an explicit allowlist                |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Never attach client data or confidential CSVs to issues. Report vulnerabilities using [SECURITY.md](SECURITY.md).
