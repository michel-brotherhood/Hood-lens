import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { JSDOM } from "jsdom";
import { parseCSV, protectSpreadsheetFormula } from "./csv.js";
import { text, errorText } from "./i18n.js";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const source = (await readFile(new URL("./app.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "")
  .replaceAll("import.meta.url", '"https://csv.test/app.js"');

function setup(language = "en") {
  const dom = new JSDOM(html, {
    url: "https://csv.test/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  window.localStorage.setItem("hood-lens-language", language);
  window.text = text;
  window.errorText = errorText;
  const workers = [];
  window.protectSpreadsheetFormula = protectSpreadsheetFormula;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.Worker = class {
    constructor() {
      workers.push(this);
    }
    postMessage(data) {
      this.data = data;
    }
    terminate() {
      this.terminated = true;
    }
    finish() {
      try {
        this.onmessage({
          data: {
            result: parseCSV(this.data.file.contents, {
              delimiter: this.data.delimiter,
              includeHeaderMetadata: true,
            }),
          },
        });
      } catch (error) {
        this.onmessage({ data: { error: error.message } });
      }
    }
  };
  window.eval(source);
  const el = (id) => window.document.getElementById(id);
  const load = (name, contents, size = contents.length) => {
    const file = { name, contents, size, type: "text/csv" };
    Object.defineProperty(el("file-input"), "files", {
      configurable: true,
      value: [file],
    });
    el("file-input").dispatchEvent(new window.Event("change"));
    return workers.at(-1);
  };
  return { dom, window, workers, el, load };
}

test("imports, searches, sorts and clears data without interpreting HTML", async (t) => {
  const { dom, el, load, window } = setup();
  t.after(() => dom.window.close());
  load("sample.csv", "nome,valor\nZeta,2\nAna,1\n<img src=x>,3").finish();
  await delay(0);
  assert.equal(el("workspace").hidden, false);
  assert.equal(window.document.documentElement.lang, "en");
  assert.equal(window.document.body.classList.contains("has-data"), true);
  assert.equal(el("file-name").textContent, "sample.csv");
  assert.equal(el("data-table").querySelectorAll("tbody img").length, 0);
  el("data-table").querySelector("th button").click();
  assert.equal(
    el("data-table").querySelectorAll("tbody tr")[1].textContent,
    "Ana1",
  );
  el("search").value = "ana";
  el("search").dispatchEvent(new window.Event("input"));
  await delay(220);
  assert.equal(el("result-count").textContent, "1 match");
  el("clear-file").click();
  assert.equal(el("workspace").hidden, true);
  assert.equal(window.document.body.classList.contains("has-data"), false);
  assert.equal(el("data-table").querySelectorAll("tr").length, 0);
  assert.equal(el("file-name").textContent, "");
  assert.equal(el("file-meta").textContent, "");
  assert.equal(el("search").value, "");
});

test("latest selection wins even if the previous worker reports late", async (t) => {
  const { dom, el, load } = setup();
  t.after(() => dom.window.close());
  const old = load("old.csv", "a,b\nold,1");
  const latest = load("latest.csv", "a,b\nlatest,2");
  assert.equal(old.terminated, true);
  latest.finish();
  await delay(0);
  old.finish();
  await delay(0);
  assert.equal(el("file-name").textContent, "latest.csv");
});

test("cancel prevents delayed results from reopening the file", async (t) => {
  const { dom, el, load } = setup();
  t.after(() => dom.window.close());
  const worker = load("pending.csv", "a,b\n1,2");
  assert.equal(el("loading").hidden, false);
  el("cancel-load").click();
  worker.finish();
  await delay(0);
  assert.equal(el("loading").hidden, true);
  assert.equal(el("workspace").hidden, true);
  assert.equal(el("file-name").textContent, "");
});

test("changing the delimiter reimports the selected file", async (t) => {
  const { dom, el, load, workers, window } = setup();
  t.after(() => dom.window.close());
  load("ambiguous.csv", "a,b;c\n1,2;3").finish();
  await delay(0);
  el("delimiter").value = ";";
  el("delimiter").dispatchEvent(new window.Event("change"));
  assert.equal(workers.at(-1).data.delimiter, ";");
  workers.at(-1).finish();
  await delay(0);
  assert.match(el("file-meta").textContent, /semicolon/);
  assert.equal(el("data-table").querySelector("th button").textContent, "a,b");
});

test("shows parser and worker errors and restores controls", async (t) => {
  const { dom, el, load } = setup();
  t.after(() => dom.window.close());
  load("invalid.csv", 'a,b\n1,"broken').finish();
  await delay(0);
  assert.equal(el("error-box").hidden, false);
  assert.match(el("error-box").textContent, /unclosed quoted field/);
  assert.equal(el("loading").hidden, true);
  const worker = load("valid.csv", "a,b\n1,2");
  worker.onerror();
  await delay(0);
  assert.match(el("error-box").textContent, /Could not process/);
  assert.equal(el("loading").hidden, true);
});

test("rejects oversized files before starting a worker", (t) => {
  const { dom, el, load, workers } = setup();
  t.after(() => dom.window.close());
  load("large.csv", "a,b\n1,2", 21 * 1024 * 1024);
  assert.equal(workers.length, 0);
  assert.match(el("error-box").textContent, /20 MB/);
});

test("a late demo response cannot replace a subsequently selected file", async (t) => {
  const { dom, el, load, window } = setup();
  t.after(() => dom.window.close());
  let resolveFetch;
  window.fetch = () =>
    new Promise((resolve) => {
      resolveFetch = resolve;
    });
  el("load-demo").click();
  load("mine.csv", "a,b\nmine,1").finish();
  await delay(0);
  resolveFetch({ ok: true, text: async () => "a,b\ndemo,2" });
  await delay(0);
  assert.equal(el("file-name").textContent, "mine.csv");
});

test("export flushes the current search and protects header and data formulas", async (t) => {
  const { dom, el, load, window } = setup();
  t.after(() => dom.window.close());
  const blobs = [];
  window.Blob = Blob;
  window.URL.createObjectURL = (blob) => {
    blobs.push(blob);
    return "blob:test";
  };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = () => {};
  load("export.csv", '=header,value\n"\n=1+1",keep\nother,omit').finish();
  await delay(0);
  el("search").value = "keep";
  el("search").dispatchEvent(new window.Event("input"));
  el("export").click();
  const csv = await blobs[0].text();
  assert.match(csv, /"'=header"/);
  assert.match(csv, /"'\n=1\+1"/);
  assert.doesNotMatch(csv, /omit/);
});

test("worker reads the file and returns parsed records or a readable error", async () => {
  const { runInNewContext } = await import("node:vm");
  const workerSource = (
    await readFile(new URL("./csv-worker.js", import.meta.url), "utf8")
  ).replace(/^import .*;\n/gm, "");
  const messages = [];
  const self = { postMessage: (message) => messages.push(message) };
  runInNewContext(workerSource, { self, parseCSV, Error });
  await self.onmessage({
    data: { file: { text: async () => "nome;valor\nAna;10" }, delimiter: ";" },
  });
  assert.deepEqual(messages[0].result.rows, [["Ana", "10"]]);
  await self.onmessage({
    data: { file: { text: async () => 'a,b\n1,"broken' } },
  });
  assert.match(messages[1].error, /unclosed quoted field/);
});

test("language switch translates the open table without changing records, search or page", async (t) => {
  const { dom, el, load, window } = setup("pt");
  t.after(() => dom.window.close());
  load("bilingual.csv", "name,\nAna,1\nBeto,2").finish();
  await delay(0);
  assert.equal(window.document.documentElement.lang, "pt-BR");
  assert.equal(
    el("data-table").querySelectorAll("th button")[1].textContent,
    "Coluna 2",
  );
  el("search").value = "Ana";
  el("search").dispatchEvent(new window.Event("input"));
  await delay(220);
  window.document.querySelector('[data-language="en"]').click();
  assert.equal(window.document.documentElement.lang, "en");
  assert.equal(el("search").value, "Ana");
  assert.equal(el("result-count").textContent, "1 match");
  assert.equal(
    el("data-table").querySelectorAll("th button")[1].textContent,
    "Column 2",
  );
  assert.equal(el("data-table").querySelector("tbody").textContent, "Ana1");
  assert.equal(window.localStorage.getItem("hood-lens-language"), "en");
  window.document.querySelector('[data-language="pt"]').click();
  assert.equal(el("result-count").textContent, "1 resultado");
  assert.equal(el("page-label").textContent, "Página 1 de 1");
  assert.equal(el("search").placeholder, "O que você procura?");
});

test("an existing error translates immediately when the language changes", async (t) => {
  const { dom, el, load, window } = setup("pt");
  t.after(() => dom.window.close());
  load("invalid.csv", 'a,b\n1,"broken').finish();
  await delay(0);
  assert.match(el("error-box").textContent, /não foi fechado/);
  window.document.querySelector('[data-language="en"]').click();
  assert.match(el("error-box").textContent, /unclosed quoted field/);
});

test("language fallback and copyright are available without storing file data", () => {
  const { dom, window } = setup("unexpected");
  assert.equal(window.document.documentElement.lang, "pt-BR");
  assert.equal(
    window.document.querySelector(".footer a").href,
    "https://behood.com.br/",
  );
  assert.equal(
    window.document.querySelector("#copyright-year").textContent,
    String(new Date().getFullYear()),
  );
  assert.equal(window.localStorage.length, 1);
  dom.window.close();
});
