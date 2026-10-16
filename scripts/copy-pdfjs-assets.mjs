// Copies the pdf.js runtime assets the PDF preview needs from the installed pdfjs-dist into
// public/, so they always match the library version: the worker, the WebAssembly decoders
// AND their no-WebAssembly JavaScript fallbacks (Lockdown Mode, strict browser policies),
// the ICC colour profiles, the character maps and the standard fonts.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules", "pdfjs-dist");
const pub = join(root, "public");

if (!existsSync(dist)) {
  console.error("pdfjs-dist is not installed; run npm install first");
  process.exit(1);
}

cpSync(join(dist, "legacy", "build", "pdf.worker.min.mjs"), join(pub, "pdf.worker.min.mjs"));
for (const dir of ["wasm", "iccs", "cmaps", "standard_fonts"]) {
  const from = join(dist, dir);
  if (!existsSync(from)) continue;
  mkdirSync(join(pub, dir), { recursive: true });
  cpSync(from, join(pub, dir), { recursive: true });
}
