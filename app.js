import { protectSpreadsheetFormula } from "./csv.js";
import { text, errorText } from "./i18n.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const state = {
  headers: [],
  rows: [],
  filtered: [],
  page: 1,
  pageSize: 25,
  query: "",
  sortColumn: -1,
  sortDirection: 1,
  fileName: "",
  fileSize: 0,
  delimiter: ",",
  generatedHeaderIndices: [],
};
const el = (id) => document.getElementById(id);
const fileInput = el("file-input");
const dropzone = el("dropzone");
let loadVersion = 0;
let activeWorker;
let selectedFile;
let searchTimer;
let demoController;
let language = "pt";
let lastError = "";
let lastAnnouncement;
try {
  language = localStorage.getItem("hood-lens-language") === "en" ? "en" : "pt";
} catch {}
const t = (key, values) => text(language, key, values);
const locale = () => (language === "pt" ? "pt-BR" : "en-US");
const number = (value) => value.toLocaleString(locale());
const announcement = (key, values = {}) =>
  t(
    key,
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        typeof value === "number" ? number(value) : value,
      ]),
    ),
  );
const displayHeader = (index) =>
  state.generatedHeaderIndices.includes(index)
    ? t("column", { index: index + 1 })
    : state.headers[index];
function metadata() {
  el("file-meta").textContent = t("meta", {
    rows: number(state.rows.length),
    columns: number(state.headers.length),
    size: formatBytes(state.fileSize),
    delimiter: t(
      state.delimiter === "\t"
        ? "delimiterTab"
        : state.delimiter === ";"
          ? "delimiterSemicolon"
          : "delimiterComma",
    ),
  });
}
function applyLanguage(next, persist = false) {
  language = next === "en" ? "en" : "pt";
  document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  document.title = t("title");
  document.querySelector('meta[name="description"]').content = t("description");
  document.querySelector('meta[property="og:title"]').content = t("title");
  document.querySelector('meta[property="og:description"]').content =
    t("description");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  for (const attr of ["placeholder", "aria-label"]) {
    document
      .querySelectorAll(`[data-i18n-${attr}]`)
      .forEach((node) =>
        node.setAttribute(attr, t(node.getAttribute(`data-i18n-${attr}`))),
      );
  }
  document
    .querySelectorAll("[data-language]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.language === language),
      ),
    );
  if (persist) {
    try {
      localStorage.setItem("hood-lens-language", language);
    } catch {}
  }
  if (state.headers.length) {
    metadata();
    render();
  }
  if (!el("error-box").hidden && lastError)
    el("error-box").textContent = errorText(language, lastError);
  if (lastAnnouncement)
    el("status").textContent = announcement(
      lastAnnouncement.key,
      lastAnnouncement.values,
    );
}

function stopPending() {
  loadVersion++;
  activeWorker?.terminate();
  activeWorker = undefined;
  demoController?.abort();
  demoController = undefined;
  clearTimeout(searchTimer);
  setBusy(false);
}

function setBusy(busy) {
  el("loading").hidden = !busy;
  el("workspace").setAttribute("aria-busy", String(busy));
  for (const id of ["search", "export", "page-size", "previous", "next"])
    el(id).disabled = busy;
  if (!busy) {
    const pages = Math.max(
      1,
      Math.ceil(state.filtered.length / state.pageSize),
    );
    el("previous").disabled = state.page <= 1;
    el("next").disabled = state.page >= pages;
  }
}

function clearData() {
  document.body.classList.remove("has-data");
  state.headers = [];
  state.rows = [];
  state.filtered = [];
  state.page = 1;
  state.query = "";
  state.sortColumn = -1;
  state.sortDirection = 1;
  state.fileName = "";
  state.fileSize = 0;
  state.generatedHeaderIndices = [];
  lastAnnouncement = undefined;
  for (const id of [
    "file-name",
    "file-meta",
    "result-count",
    "page-label",
    "status",
  ])
    el(id).textContent = "";
  el("search").value = "";
  el("stats").replaceChildren();
  el("data-table").querySelector("thead").replaceChildren();
  el("data-table").querySelector("tbody").replaceChildren();
  el("workspace").hidden = true;
}

function parseFile(file, delimiter) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./csv-worker.js", import.meta.url), {
      type: "module",
    });
    activeWorker = worker;
    const finish = () => {
      worker.terminate();
      if (activeWorker === worker) activeWorker = undefined;
    };
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.onerror = () => {
      finish();
      reject(
        new Error("Could not process this CSV. Reload the page and try again."),
      );
    };
    worker.postMessage({ file, delimiter });
  });
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase(locale());
}
function announce(key, values) {
  lastAnnouncement = { key, values };
  el("status").textContent = announcement(key, values);
}
function formatBytes(bytes) {
  const megabytes = bytes >= 1024 * 1024;
  const value = bytes / (megabytes ? 1024 * 1024 : 1024);
  return `${value.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${megabytes ? "MB" : "KB"}`;
}

function showError(message) {
  const box = el("error-box");
  lastError = message;
  box.textContent = errorText(language, message);
  box.hidden = false;
}

function updateFiltered() {
  const query = normalize(state.query.trim());
  state.filtered = state.rows.filter(
    (row) => !query || row.some((cell) => normalize(cell).includes(query)),
  );
  if (state.sortColumn >= 0) {
    state.filtered.sort(
      (a, b) =>
        a[state.sortColumn].localeCompare(b[state.sortColumn], locale(), {
          numeric: true,
          sensitivity: "base",
        }) * state.sortDirection,
    );
  }
  state.page = 1;
  render();
}

function render() {
  const total = state.filtered.length;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * state.pageSize;
  const visible = state.filtered.slice(start, start + state.pageSize);
  const thead = el("data-table").querySelector("thead");
  const tbody = el("data-table").querySelector("tbody");
  thead.replaceChildren();
  tbody.replaceChildren();

  const headRow = document.createElement("tr");
  state.headers.forEach((_, index) => {
    const header = displayHeader(index);
    const th = document.createElement("th");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${header}${state.sortColumn === index ? (state.sortDirection === 1 ? " ↑" : " ↓") : ""}`;
    button.setAttribute("aria-label", t("sort", { header }));
    th.scope = "col";
    th.setAttribute(
      "aria-sort",
      state.sortColumn === index
        ? state.sortDirection === 1
          ? "ascending"
          : "descending"
        : "none",
    );
    button.addEventListener("click", () => {
      state.sortDirection =
        state.sortColumn === index ? -state.sortDirection : 1;
      state.sortColumn = index;
      updateFiltered();
    });
    th.append(button);
    headRow.append(th);
  });
  thead.append(headRow);
  if (visible.length === 0) {
    const tr = document.createElement("tr"),
      td = document.createElement("td");
    td.colSpan = state.headers.length;
    td.className = "empty";
    td.textContent = t("noMatches");
    tr.append(td);
    tbody.append(tr);
  } else {
    visible.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        td.title = value;
        tr.append(td);
      });
      tbody.append(tr);
    });
  }
  el("result-count").textContent = t("resultCount", {
    count: number(total),
    plural: total === 1 ? "" : language === "pt" ? "s" : "es",
  });
  el("page-label").textContent = t("page", {
    page: number(state.page),
    pages: number(pages),
  });
  el("previous").disabled = state.page <= 1;
  el("next").disabled = state.page >= pages;
  const stats = [
    [t("rows"), state.rows.length],
    [t("columns"), state.headers.length],
    [t("matches"), total],
  ];
  el("stats").replaceChildren(
    ...stats.map(([label, value]) => {
      const card = document.createElement("div");
      card.className = "stat";
      const caption = document.createElement("span");
      caption.className = "stat-label";
      caption.textContent = label;
      const metric = document.createElement("span");
      metric.className = "stat-value";
      metric.textContent = number(value);
      card.append(caption, metric);
      return card;
    }),
  );
}

async function loadFile(file) {
  if (!file) return;
  stopPending();
  const version = loadVersion;
  selectedFile = file;
  el("error-box").hidden = true;
  if (file.size > MAX_FILE_SIZE) {
    showError("This file exceeds the 20 MB limit.");
    return;
  }
  if (
    !file.name.toLowerCase().endsWith(".csv") &&
    file.type !== "text/csv" &&
    file.type !== "text/plain"
  ) {
    showError("Choose a CSV file.");
    return;
  }
  clearData();
  setBusy(true);
  announce("reading");
  try {
    const selection = el("delimiter").value;
    const delimiter =
      selection === "auto" ? undefined : selection === "tab" ? "\t" : selection;
    const {
      headers,
      rows,
      delimiter: detected,
      generatedHeaderIndices = [],
    } = await parseFile(file, delimiter);
    if (version !== loadVersion) return;
    state.headers = headers;
    state.rows = rows;
    state.generatedHeaderIndices = generatedHeaderIndices;
    state.fileSize = file.size;
    state.delimiter = detected;
    state.fileName = file.name;
    state.query = "";
    state.sortColumn = -1;
    state.sortDirection = 1;
    el("search").value = "";
    el("file-name").textContent = file.name;
    metadata();
    el("workspace").hidden = false;
    document.body.classList.add("has-data");
    updateFiltered();
    announce("opened", { name: file.name, count: rows.length });
    el("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (version !== loadVersion) return;
    announce("failed");
    showError(
      error instanceof Error ? error.message : "Could not read this file.",
    );
  } finally {
    if (version === loadVersion) setBusy(false);
  }
}

el("choose-file").addEventListener("click", () => fileInput.click());
el("load-demo").addEventListener("click", async () => {
  stopPending();
  const version = loadVersion;
  const controller = new AbortController();
  demoController = controller;
  el("error-box").hidden = true;
  setBusy(true);
  try {
    const response = await fetch(
      new URL("./examples/demo.csv", import.meta.url),
      { signal: controller.signal },
    );
    if (!response.ok) throw new Error("Could not load the sample.");
    const text = await response.text();
    if (version !== loadVersion) return;
    demoController = undefined;
    await loadFile(new File([text], "demo.csv", { type: "text/csv" }));
  } catch (error) {
    if (version !== loadVersion || error.name === "AbortError") return;
    showError("Could not load the sample. Try again or open a CSV file.");
    setBusy(false);
  }
});
el("delimiter").addEventListener("change", () => {
  if (selectedFile) loadFile(selectedFile);
});
fileInput.addEventListener("change", () => {
  loadFile(fileInput.files[0]);
  fileInput.value = "";
});
for (const event of ["dragenter", "dragover"])
  dropzone.addEventListener(event, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragging");
  });
for (const event of ["dragleave", "drop"])
  dropzone.addEventListener(event, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragging");
  });
dropzone.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));
el("search").addEventListener("input", (e) => {
  state.query = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(updateFiltered, 180);
});
el("page-size").addEventListener("change", (e) => {
  state.pageSize = Number(e.target.value);
  updateFiltered();
});
el("previous").addEventListener("click", () => {
  state.page--;
  render();
});
el("next").addEventListener("click", () => {
  state.page++;
  render();
});
function closeFile() {
  stopPending();
  selectedFile = undefined;
  clearData();
  el("error-box").textContent = "";
  el("error-box").hidden = true;
  el("choose-file").focus();
  announce("closed");
}
el("clear-file").addEventListener("click", closeFile);
el("cancel-load").addEventListener("click", closeFile);
el("export").addEventListener("click", () => {
  clearTimeout(searchTimer);
  updateFiltered();
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [
    state.headers.map((_, index) => displayHeader(index)),
    ...state.filtered.map((row) => row),
  ]
    .map((row) =>
      row.map((value) => quote(protectSpreadsheetFormula(value))).join(";"),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.hidden = true;
  link.download = `${state.fileName.replace(/\.csv$/i, "").replace(/[^\p{L}\p{N}._-]+/gu, "_")}-${t("filteredSuffix")}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce("exported", { count: state.filtered.length });
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    if (el("workspace").hidden || el("search").disabled) return;
    e.preventDefault();
    el("search").focus();
  }
});

document
  .querySelectorAll("[data-language]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      applyLanguage(button.dataset.language, true),
    ),
  );
el("copyright-year").textContent = new Date().getFullYear();
const about = el("about-dialog");
el("about-open").addEventListener("click", () => about.showModal());
for (const id of ["about-close", "about-x"])
  el(id).addEventListener("click", () => about.close());
applyLanguage(language);
