/**
 * At 375 the French quick-add hint ("Enregistrée à la date du jour") ran past the card, and a
 * long unbroken word in a note ran out of its card and was cut off.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.resolve(__dirname, "../../../../../../globals.css"), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`));
  expect(match, selector).not.toBeNull();
  return match![1];
}

describe("notes at narrow widths", () => {
  it("lets the quick-add input shrink so the hint stays inside the card", () => {
    expect(rule(".quickadd-input")).toMatch(/min-width:\s*0;/);
    expect(css).toMatch(
      /@media \(max-width: 639px\) \{\s*\.quickadd-hint \{[^}]*white-space:\s*normal;/
    );
  });

  it("wraps a long word inside the note card", () => {
    expect(rule(".nc-title")).toMatch(/overflow-wrap:\s*anywhere;/);
    expect(rule(".nc-body")).toMatch(/overflow-wrap:\s*anywhere;/);
  });
});
