// Copies the OCR engine and its Arabic + English language data from node_modules into public/tesseract,
// so receipt scanning is served from the app's own origin: no third-party CDN, and photos never leave the phone.
// Runs before dev and build; the output is git-ignored.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (p) => join(root, "node_modules", p);
const out = join(root, "public", "tesseract");

const need = [
  [nm("tesseract.js/dist/worker.min.js"), join(out, "worker.min.js")],
  [nm("@tesseract.js-data/ara/4.0.0_best_int/ara.traineddata.gz"), join(out, "lang", "ara.traineddata.gz")],
  [nm("@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"), join(out, "lang", "eng.traineddata.gz")],
];
const coreDir = nm("tesseract.js-core");
if (existsSync(coreDir)) {
  for (const f of readdirSync(coreDir).filter((n) => n.endsWith(".wasm.js"))) need.push([join(coreDir, f), join(out, "core", f)]);
}

mkdirSync(out, { recursive: true });
let copied = 0;
for (const [from, to] of need) {
  if (!existsSync(from)) { console.warn(`copy-ocr: missing ${from}`); continue; }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
  copied++;
}
console.log(`copy-ocr: ${copied}/${need.length} files -> public/tesseract`);
