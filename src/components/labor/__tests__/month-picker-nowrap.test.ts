/**
 * The month picker pill ("Tous les mois", long month names) must stay on one
 * line in narrow card headers instead of wrapping onto two.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe(".folio-month-picker", () => {
  it("never wraps its label", () => {
    const css = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf8");
    const rule = css.match(/\.folio-month-picker \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/white-space:\s*nowrap;/);
  });
});
