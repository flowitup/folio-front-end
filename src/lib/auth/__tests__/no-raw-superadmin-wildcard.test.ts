import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Guards the roles-permissions-redesign invariant: every superadmin/platform-ops
 * check MUST go through `isPlatformOps()` (or `isCompanyAdmin()`, which folds it
 * in) from `src/lib/auth/permissions.ts` — never a raw `"*:*"` string literal
 * scattered across the app. That module is the only file allowed to reference
 * the wildcard directly (it names the constant once).
 */

const SRC_DIR = join(__dirname, "..", "..", "..");
const WILDCARD_PATTERN = /["']\*:\*["']/;

// The one file allowed to define the wildcard constant.
const ALLOWED_FILES = new Set([join(SRC_DIR, "lib", "auth", "permissions.ts")]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIR_NAMES = new Set(["node_modules", "__tests__", ".next"]);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
    const ext = entry.slice(entry.lastIndexOf("."));
    if (SCAN_EXTENSIONS.has(ext)) out.push(full);
  }
  return out;
}

describe("no raw superadmin wildcard outside permissions.ts", () => {
  it("only src/lib/auth/permissions.ts references the literal \"*:*\" wildcard", () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_DIR)) {
      if (ALLOWED_FILES.has(file)) continue;
      const content = readFileSync(file, "utf8");
      if (WILDCARD_PATTERN.test(content)) {
        offenders.push(relative(SRC_DIR, file));
      }
    }
    expect(offenders, "raw \"*:*\" found outside permissions.ts — use isPlatformOps()/isCompanyAdmin()/can() instead").toEqual([]);
  });
});
