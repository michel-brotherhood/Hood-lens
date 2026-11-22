import { protectSpreadsheetFormula } from "./csv.js";

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
};
const el = (id) => document.getElementById(id);
const fileInput = el("file-input");
const dropzone = el("dropzone");
let loadVersion = 0;
let activeWorker;
let selectedFile;
let searchTimer;
let demoController;

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
    .toLocaleLowerCase("en-US");
}
function announce(message) {
  el("status").textContent = message;
}
function formatBytes(bytes) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function showError(message) {
  const box = el("error-box");
  box.textContent = message;
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
        a[state.sortColumn].localeCompare(b[state.sortColumn], "en-US", {
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
  state.headers.forEach((header, index) => {
    const th = document.createElement("th");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${header}${state.sortColumn === index ? (state.sortDirection === 1 ? " ↑" : " ↓") : ""}`;
    button.setAttribute("aria-label", `Sort by ${header}`);
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
    td.textContent = "No matches. Try a different search.";
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
  el("result-count").textContent =
    `${total.toLocaleString("en-US")} match${total === 1 ? "" : "es"}`;
  el("page-label").textContent = `Page ${state.page} of ${pages}`;
  el("previous").disabled = state.page <= 1;
  el("next").disabled = state.page >= pages;
  const stats = [
    ["ROWS", state.rows.length],
    ["COLUMNS", state.headers.length],
    ["MATCHES", total],
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
      metric.textContent = value.toLocaleString("en-US");
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
  announce("Reading your file.");
  try {
    const selection = el("delimiter").value;
    const delimiter =
      selection === "auto" ? undefined : selection === "tab" ? "\t" : selection;
    const {
      headers,
      rows,
      delimiter: detected,
    } = await parseFile(file, delimiter);
    if (version !== loadVersion) return;
    state.headers = headers;
    state.rows = rows;
    state.fileName = file.name;
    state.query = "";
    state.sortColumn = -1;
    state.sortDirection = 1;
    el("search").value = "";
    el("file-name").textContent = file.name;
    el("file-meta").textContent =
      `${rows.length.toLocaleString("en-US")} rows · ${headers.length} columns · ${formatBytes(file.size)} · delimiter: ${detected === "\t" ? "tab" : detected === ";" ? "semicolon" : "comma"}`;
    el("workspace").hidden = false;
    document.body.classList.add("has-data");
    updateFiltered();
    announce(`${file.name} opened with ${rows.length} rows.`);
    el("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (version !== loadVersion) return;
    announce("Could not open the file.");
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
  announce("File closed.");
}
el("clear-file").addEventListener("click", closeFile);
el("cancel-load").addEventListener("click", closeFile);
el("export").addEventListener("click", () => {
  clearTimeout(searchTimer);
  updateFiltered();
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [state.headers, ...state.filtered.map((row) => row)]
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
  link.download = `${state.fileName.replace(/\.csv$/i, "").replace(/[^\p{L}\p{N}._-]+/gu, "_")}-filtered.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(`${state.filtered.length} rows exported.`);
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    if (el("workspace").hidden || el("search").disabled) return;
    e.preventDefault();
    el("search").focus();
  }
});
