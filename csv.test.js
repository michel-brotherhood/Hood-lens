import test from "node:test";
import assert from "node:assert/strict";
import { parseCSV, protectSpreadsheetFormula } from "./csv.js";

test("parses 200 thousand rows without exceeding the argument limit", () => {
  const { headers, rows } = parseCSV("a,b\n" + "1,2\n".repeat(200000));
  assert.deepEqual(headers, ["a", "b"]);
  assert.equal(rows.length, 200000);
  assert.deepEqual(rows.at(-1), ["1", "2"]);
});

test("parses comma-delimited rows and trims header names", () => {
  assert.deepEqual(parseCSV("\uFEFF name ,age\nAna,32\nBeto,28"), {
    headers: ["name", "age"],
    rows: [
      ["Ana", "32"],
      ["Beto", "28"],
    ],
    delimiter: ",",
  });
});

test("detects semicolon delimiter even when values contain commas", () => {
  assert.deepEqual(parseCSV('nome;observacao\nAna;"Rio, Niterói"'), {
    headers: ["nome", "observacao"],
    rows: [["Ana", "Rio, Niterói"]],
    delimiter: ";",
  });
});

test("detects tab delimiter", () => {
  assert.deepEqual(parseCSV("nome\tidade\nAna\t32"), {
    headers: ["nome", "idade"],
    rows: [["Ana", "32"]],
    delimiter: "\t",
  });
});

test("keeps delimiter detection across records with quoted newlines", () => {
  assert.deepEqual(
    parseCSV('id;descricao;status\n1;"linha um\nlinha dois";ativo\n2;;'),
    {
      headers: ["id", "descricao", "status"],
      rows: [
        ["1", "linha um\nlinha dois", "ativo"],
        ["2", "", ""],
      ],
      delimiter: ";",
    },
  );
});

test("preserves escaped quotes, delimiters and newlines inside quoted fields", () => {
  assert.deepEqual(parseCSV('id,texto\n1,"disse ""olá,""\nsegunda linha"'), {
    headers: ["id", "texto"],
    rows: [["1", 'disse "olá,"\nsegunda linha']],
    delimiter: ",",
  });
});

test("preserves irregular rows by adding columns and padding missing values", () => {
  assert.deepEqual(parseCSV("a,b\n1\n2,3,4"), {
    headers: ["a", "b", "Column 3"],
    rows: [
      ["1", "", ""],
      ["2", "3", "4"],
    ],
    delimiter: ",",
  });
});

test("ignores blank lines and supports CRLF line endings", () => {
  assert.deepEqual(parseCSV("a,b\r\n1,2\r\n\r\n3,4\r\n"), {
    headers: ["a", "b"],
    rows: [
      ["1", "2"],
      ["3", "4"],
    ],
    delimiter: ",",
  });
});

test("rejects an unclosed quoted field", () => {
  assert.throws(() => parseCSV('a,b\n1,"broken'), /unclosed quoted field/);
});

test("preserves records with explicitly empty fields while ignoring blank lines", () => {
  assert.deepEqual(parseCSV('a,b\r\n,\r\n\r\n"",""\r\n1,2\r\n'), {
    headers: ["a", "b"],
    rows: [
      ["", ""],
      ["", ""],
      ["1", "2"],
    ],
    delimiter: ",",
  });
});

test("preserves a quoted empty record in a single-column CSV", () => {
  assert.deepEqual(parseCSV('name\n\n""\nAna\n'), {
    headers: ["name"],
    rows: [[""], ["Ana"]],
    delimiter: ",",
  });
});

test("accepts an empty data record and generates names for empty headers", () => {
  assert.deepEqual(parseCSV(";\n;"), {
    headers: ["Column 1", "Column 2"],
    rows: [["", ""]],
    delimiter: ";",
  });
});

test("rejects invalid content after a quoted field", () => {
  assert.throws(() => parseCSV('a,b\n"value"oops,2'), /Unexpected text/);
});

test("rejects files with no data rows", () => {
  assert.throws(() => parseCSV("a,b"), /header and at least one data row/);
});

test("protects formula-like spreadsheet values without changing numbers", () => {
  assert.equal(protectSpreadsheetFormula("=1+1"), "'=1+1");
  assert.equal(protectSpreadsheetFormula("  @SUM(A1:A2)"), "'  @SUM(A1:A2)");
  assert.equal(protectSpreadsheetFormula("-42.50"), "-42.50");
  assert.equal(protectSpreadsheetFormula("Texto normal"), "Texto normal");
});

test("prefers the header delimiter over commas in unquoted values", () => {
  assert.deepEqual(
    parseCSV("produto;tags\nA;azul,verde,vermelho\nB;preto,branco,cinza"),
    {
      headers: ["produto", "tags"],
      rows: [
        ["A", "azul,verde,vermelho"],
        ["B", "preto,branco,cinza"],
      ],
      delimiter: ";",
    },
  );
});

test("accepts files made entirely of quoted empty fields", () => {
  assert.deepEqual(parseCSV('""\n""'), {
    headers: ["Column 1"],
    rows: [[""]],
    delimiter: ",",
  });
});

test("supports an explicit delimiter for ambiguous CSV files", () => {
  assert.deepEqual(
    parseCSV("nome,completo;valor\nAna;10", { delimiter: ";" }),
    {
      headers: ["nome,completo", "valor"],
      rows: [["Ana", "10"]],
      delimiter: ";",
    },
  );
  assert.throws(
    () => parseCSV("a|b\n1|2", { delimiter: "|" }),
    /Invalid delimiter/,
  );
});

test("neutralizes formulas after leading control characters", () => {
  for (const prefix of ["\n", "\r\n", "\t", "\u0000", " \n\t", "\uFEFF"]) {
    assert.equal(
      protectSpreadsheetFormula(prefix + "=1+1"),
      "'" + prefix + "=1+1",
    );
  }
  assert.equal(protectSpreadsheetFormula("-42.50"), "-42.50");
  assert.equal(protectSpreadsheetFormula("texto\n=1+1"), "texto\n=1+1");
});
