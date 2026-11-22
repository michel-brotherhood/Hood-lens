# Hood Lens — usability notes

## Intended use

Quick inspection of CSV files: find records, check the shape of a table and export a filtered subset. This is not a spreadsheet editor or statistical analysis suite.

## Main flow

Open a file or try the synthetic sample, inspect rows, search, sort, and export. Import settings remain available after opening a file. The introduction and artwork collapse while data is open to prioritize the table. Closing the file returns to the opening view.

## States

- Empty: explanation, file picker, delimiter selection and synthetic sample.
- Loading: worker processing with a cancel action; prior reads cannot replace newer selections.
- Error: plain-English error and another import attempt.
- No search matches: explicit empty result, with search remaining available.
- Data: filename, metadata, row/column counts, search, sort, pagination and export.

## Accessibility

Semantic labels, visible keyboard focus, a skip link, live status announcements, sortable column semantics, a keyboard-focusable horizontal table region and reduced-motion support are provided. This does not constitute an accessibility certification. Browser and assistive technology checks are still necessary.

## Known limits

Only CSV/UTF-8 input; a header and at least one data row are required. The 20 MB limit is not a performance guarantee. Delimiter detection is heuristic, and manual selection is available. Search and sorting are textual; there is no numeric type inference, cell editing or per-column filter. Displayed long values are clipped, and their full text is available in the cell title.
