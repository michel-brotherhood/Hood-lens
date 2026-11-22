import { parseCSV } from "./csv.js";

self.onmessage = async ({ data: { file, delimiter } }) => {
  try {
    const text = await file.text();
    self.postMessage({ result: parseCSV(text, { delimiter }) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Could not read the file.",
    });
  }
};
