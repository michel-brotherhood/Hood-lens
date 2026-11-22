import { mkdir, copyFile, rm } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);
await rm(output, { recursive: true, force: true });
await mkdir(new URL("examples/", output), { recursive: true });
await mkdir(new URL("assets/", output), { recursive: true });
for (const file of [
  "index.html",
  "styles.css",
  "app.js",
  "csv.js",
  "csv-worker.js",
  "examples/demo.csv",
  "_headers",
  "assets/hood-art.webp",
  "assets/hood-mark.webp",
  ".nojekyll",
])
  await copyFile(new URL(file, root), new URL(file, output));
console.log("Static site generated in dist/.");
