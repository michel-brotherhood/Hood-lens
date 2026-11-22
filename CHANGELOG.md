# Changelog

## 1.2.0 — Hood Lens

- Renames the product to Hood Lens; repository URLs remain unchanged.
- Replaces the interface with a dark editorial workspace using the supplied Hood artwork.
- Translates interface text, errors, generated column names and synthetic sample data into English.
- Collapses the introduction and artwork when data is open.
- Adds keyboard-visible focus, a skip link, a focusable table region and reduced-motion handling.
- Includes optimized local artwork and a `.nojekyll` file for static GitHub Pages publishing.
- Preserves the import, search, sort, pagination, export and cancellation behavior from 1.1.

## 1.1.0

- Improves delimiter detection and supports explicitly empty records.
- Adds manual delimiter selection and cancellable worker imports.
- Prevents stale reads from overwriting newer files.
- Clears table data on close and debounces search.
- Expands spreadsheet formula protection.
- Adds lifecycle regression tests and an explicit static build.

## 1.0.0

- Initial CSV explorer: local import, search, sorting, pagination and filtered export.
