// Compile the app's Tailwind v4 stylesheet (globals.css) into a static,
// browser-ready CSS file: Folio :root tokens + @theme mapping + all utility
// classes used across the app. This is what /design-sync ships as cssEntry so
// shadcn components (styled purely by Tailwind utility classes) render with the
// real Folio look. Re-run on any source change (wired as cfg.buildCmd).
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const INPUT = resolve('src/app/globals.css');
const OUTPUT = resolve('.design-sync/folio-compiled.css');

const css = readFileSync(INPUT, 'utf8');
const result = await postcss([tailwindcss()]).process(css, { from: INPUT, to: OUTPUT });

// The app loads Inter / Fraunces / JetBrains Mono via next/font, which sets the
// --font-* CSS variables at runtime — absent in a standalone bundle. Resolve
// the brand fonts faithfully: a leading Google Fonts @import (must precede all
// rules) loads the real families, and a :root block binds the variables the
// @theme mapping reads (--font-sans/serif/mono), so font utilities resolve.
const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');\n";
const FONT_VARS = `\n:root {\n  --font-inter: "Inter", system-ui, -apple-system, sans-serif;\n  --font-fraunces: "Fraunces", ui-serif, Georgia, serif;\n  --font-jetbrains-mono: "JetBrains Mono", ui-monospace, monospace;\n}\n`;

writeFileSync(OUTPUT, FONT_IMPORT + result.css + FONT_VARS);
console.error(`compiled ${INPUT} -> ${OUTPUT} (${((FONT_IMPORT.length + result.css.length + FONT_VARS.length) / 1024).toFixed(0)} KB)`);
