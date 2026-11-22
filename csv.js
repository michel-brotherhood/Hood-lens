const DELIMITERS = [",", ";", "\t"];

function parseRecords(source, delimiter) {
  const records = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let afterQuote = false;
  let recordHasSyntax = false;

  const finishField = () => {
    row.push(field);
    field = "";
    afterQuote = false;
  };
  const finishRow = () => {
    finishField();
    if (recordHasSyntax) records.push(row);
    row = [];
    recordHasSyntax = false;
  };

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char !== "\n" && char !== "\r") recordHasSyntax = true;

    if (inQuotes) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
        afterQuote = true;
      } else {
        field += char;
      }
      continue;
    }

    if (afterQuote) {
      if (char === delimiter) finishField();
      else if (char === "\n" || char === "\r") {
        if (char === "\r" && source[index + 1] === "\n") index++;
        finishRow();
      } else if (char === " " || char === "\t") {
        // Espaços entre o fechamento das aspas e o separador são ignorados.
      } else {
        throw new Error("Unexpected text after a quoted field.");
      }
    } else if (char === '"') {
      if (field.length !== 0)
        throw new Error("A quote was found inside an unquoted field.");
      inQuotes = true;
    } else if (char === delimiter) {
      finishField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      finishRow();
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new Error("The file contains an unclosed quoted field.");
  finishRow();
  return records;
}

function chooseDelimiter(source) {
  const counts = [0, 0, 0];
  const totals = [0, 0, 0];
  const firstWidths = [null, null, null];
  const matchingRecords = [0, 0, 0];
  let inQuotes = false;
  let rowHasContent = false;
  let records = 0;

  const finishRecord = () => {
    if (rowHasContent || counts.some((count) => count > 0)) {
      records++;
      counts.forEach((count, index) => {
        const width = count + 1;
        firstWidths[index] ??= width;
        totals[index] += width;
        if (width === firstWidths[index]) matchingRecords[index]++;
      });
    }
    counts.fill(0);
    rowHasContent = false;
  };

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      rowHasContent = true;
      if (inQuotes && source[index + 1] === '"') {
        rowHasContent = true;
        index++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (inQuotes) {
      rowHasContent = true;
    } else if (!inQuotes) {
      const delimiterIndex = DELIMITERS.indexOf(char);
      if (delimiterIndex >= 0) {
        counts[delimiterIndex]++;
        rowHasContent = true;
      }
      if (char === "\n" || char === "\r") {
        if (char === "\r" && source[index + 1] === "\n") index++;
        finishRecord();
      } else {
        rowHasContent = true;
      }
    }
  }
  finishRecord();

  if (records === 0) throw new Error("Could not parse this CSV.");

  const scores = totals.map((total, index) => {
    const width = firstWidths[index] ?? 1;
    const averageWidth = total / records;
    const consistency = matchingRecords[index] / records;
    return (
      (width > 1 ? 1000 : 0) +
      consistency * 100 +
      Math.min(width, 50) +
      Math.min(averageWidth, 50) / 100
    );
  });
  return DELIMITERS[scores.indexOf(Math.max(...scores))];
}

function parseCSV(
  text,
  { delimiter: selectedDelimiter, includeHeaderMetadata = false } = {},
) {
  if (
    selectedDelimiter !== undefined &&
    !DELIMITERS.includes(selectedDelimiter)
  )
    throw new Error("Invalid delimiter. Choose comma, semicolon or tab.");
  const source = text.replace(/^\uFEFF/, "");
  const delimiter = selectedDelimiter ?? chooseDelimiter(source);
  const records = parseRecords(source, delimiter);
  if (records.length < 2)
    throw new Error("The file needs a header and at least one data row.");

  const columnCount = records.reduce(
    (maximum, record) => Math.max(maximum, record.length),
    0,
  );
  const headers = Array.from({ length: columnCount }, (_, index) => {
    const value = records[0][index]?.trim();
    return value || `Column ${index + 1}`;
  });
  const rows = records
    .slice(1)
    .map((record) =>
      Array.from({ length: columnCount }, (_, index) => record[index] ?? ""),
    );

  const result = { headers, rows, delimiter };
  if (includeHeaderMetadata)
    result.generatedHeaderIndices = headers.flatMap((_, index) =>
      records[0][index]?.trim() ? [] : [index],
    );
  return result;
}

function protectSpreadsheetFormula(value) {
  const text = String(value);
  const formulaLike = /^[\u0000-\u0020\uFEFF]*[=+@-]/.test(text);
  const numeric = /^[\t ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text);
  return formulaLike && !numeric ? `'${text}` : text;
}

export { parseCSV, protectSpreadsheetFormula };
