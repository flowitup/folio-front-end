# design-sync notes — Folio front-end (shadcn/ui primitives)

This repo is a Next.js app, not a published DS package. The synced surface is the
16 shadcn/ui primitives in `src/components/ui/`. Re-sync is `node .ds-sync/resync.mjs`
(see base SKILL.md). Project: claude.ai/design (id in config `projectId`).

## How this build is wired (non-obvious)

- **No dist / no shipped `.d.ts`.** The bundle entry is a hand-written narrow
  re-export at `.design-sync/entry.tsx` (the 16 ui modules, `export *`), passed
  via `cfg.entry`. Do NOT let it fall back to synth-entry — that re-exports every
  `src/*.tsx` and tries to bundle the whole app (server components, next/navigation).
- **`cfg.tsconfig` = tsconfig.json** so esbuild resolves the `@/*` → `./src/*` alias.
- **Component discovery is `componentSrcMap`** (16 pins). `exportedNames` finds 0
  (no `.d.ts`), so without the map nothing is discovered. Add new primitives there.
- **All 16 `.d.ts` are hand-written via `cfg.dtsPropsFor`** — auto-extraction yields
  `[key: string]: unknown` because there's no shipped type tree. Update these by hand
  when a component's props change.
- **`sonner.tsx` exports `Toaster`** (not `Sonner`) — the catalog name is `Toaster`.

## CSS / fonts (the styling pipeline)

- `cfg.buildCmd = node .design-sync/compile-css.mjs` compiles `src/app/globals.css`
  (Tailwind v4 via the installed `@tailwindcss/postcss`) → `.design-sync/folio-compiled.css`
  (the `cssEntry`). It is **gitignored and regenerated** — re-sync re-runs buildCmd.
- The compile script prepends a Google Fonts `@import` (Inter / Fraunces / JetBrains
  Mono) and appends `:root` definitions for `--font-inter` / `--font-fraunces` /
  `--font-jetbrains-mono`, which the app normally gets from next/font at runtime.
  Validate reports `[FONT_REMOTE]` — expected, fonts load at runtime from Google.

## Known render warns (triaged legitimate)

- `[FONT_REMOTE]` Inter / JetBrains Mono / Fraunces — remote @import, by design.
- (No other warns at last sync. `[GRID_OVERFLOW]` on Card was fixed with
  `overrides.Card.cardMode: column`.)

## Previews

- 15/16 components have authored previews (`.design-sync/previews/*.tsx`), all graded
  good. **Toaster ships the floor card on purpose**: sonner's `toast()` and the bundled
  `<Toaster>` would be different module instances in a preview, so a toast never reaches
  it — it cannot render statically. Author later only if a static toast becomes possible.
- Overlay components (Dialog/AlertDialog/Popover/DropdownMenu) are previewed with the
  `open` prop forced + `overrides.<Name>.cardMode: single`. Select/Combobox are shown
  closed (their open state is portal/interaction-driven).
- Previews import from `"construction-front-end"` (the pkg name) → redirected to
  `window.Folio` by the story-imports shim. lucide-react icons bundle from node_modules.

## Re-sync risks (watch list)

- **`styles.css` is a compiled Tailwind snapshot.** It contains only the utility classes
  present in the app source at sync time. New primitives using new utilities need a
  `buildCmd` re-run (it rescans source). The conventions header tells the design agent to
  prefer raw `var(--*)` tokens for its own glue for this reason.
- **Brand fonts load remotely** from Google Fonts. If offline self-containment is wanted,
  switch to `cfg.extraFonts` with self-hosted woff2 instead of the @import in compile-css.mjs.
- **`.design-sync/entry.tsx` and the `dtsPropsFor` bodies are hand-maintained** and can
  drift from source. If a ui component is added/removed/renamed, update entry.tsx,
  componentSrcMap, and dtsPropsFor together.
- The build runs against the **shared front-end checkout** (`/Users/.../folio/folio-front-end`),
  not the monorepo worktree submodule (which is uninitialised). Parallel sessions can stash
  untracked files there — commit the durable `.design-sync/` inputs promptly.
