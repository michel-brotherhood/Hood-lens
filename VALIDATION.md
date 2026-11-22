# Release verification — Hood Lens 1.2.0

## Completed

- `npm test`: 28 tests passed, including parser edge cases, search, sorting, export, cancellation, competing reads, DOM cleanup and worker message handling.
- English document language and compact-workspace state transitions checked by the DOM regression suite.
- `npm run build`: completed; exact public-file allowlist verified, including both artwork assets and `.nojekyll`.
- JavaScript syntax checked for the application, parser, worker and build script.
- Application and sample use relative asset paths for GitHub Pages repository-subpath hosting.

## Not completed in this environment

A real-browser visual/interaction pass could not be completed. The local Chromium executable could not start because of runtime process/socket restrictions. The managed browser could not access this workspace's local preview (it returned HTTP 404), and downloading the standalone headless browser was denied by the network.

The automated interface tests use jsdom and a simulated Worker; the separate handler test runs the actual worker handler in an isolated JavaScript context. These are not substitutes for a real browser.

## Check after publishing

- Open on desktop, tablet and a narrow mobile viewport; check wrapping and horizontal overflow.
- Verify both Hood images load, then try the sample dataset.
- Search for `stationery`, sort by `Stock`, advance pages and export the matches.
- Import a comma-separated CSV, a semicolon-separated CSV and a tab-separated CSV.
- Change the delimiter and verify reimport.
- Cancel an import; close an open file and verify the opening layout returns.
- Check keyboard focus, screen-reader announcements, reduced motion and the horizontal table region.
- Confirm there are no missing assets, worker failures or application errors in the browser console.
