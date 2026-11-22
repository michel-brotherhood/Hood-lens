# Release verification — Hood Lens 1.3.0

## Completed

- `npm test`: 31 tests passed, including parser edge cases, search, sorting, export, cancellation, competing reads, DOM cleanup and worker message handling.
- PT/EN switching, translated errors, generated headers, language persistence and copyright checked by the DOM suite.
- `npm run build`: completed; exact public-file allowlist verified, including both artwork assets and `.nojekyll`.
- JavaScript syntax checked for the application, parser, worker and build script.
- Application and sample use relative asset paths for GitHub Pages repository-subpath hosting.

## Not completed in this environment

A real-browser visual/interaction pass could not be completed in this environment. Earlier local preview access was unavailable, and this release’s local-file navigation was rejected by the browser URL policy. No browser-policy workaround was attempted. Responsive CSS is provided, but no specific viewport is claimed as visually verified.

The automated interface tests use jsdom and a simulated Worker; the separate handler test runs the actual worker handler in an isolated JavaScript context. These are not substitutes for a real browser.

## Check after publishing

- Open on desktop, tablet and a narrow mobile viewport; check wrapping and horizontal overflow.
- Verify both transparent Hood images load, then try the sample dataset.
- Switch PT/EN with data open, during import, with an error, and after reload. Check the About dialog and footer links.
- Search for `stationery`, sort by `Stock`, advance pages and export the matches.
- Import a comma-separated CSV, a semicolon-separated CSV and a tab-separated CSV.
- Change the delimiter and verify reimport.
- Cancel an import; close an open file and verify the opening layout returns.
- Check keyboard focus, screen-reader announcements, reduced motion and the horizontal table region.
- Confirm there are no missing assets, worker failures or application errors in the browser console.
