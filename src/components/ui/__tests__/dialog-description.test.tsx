/**
 * Every dialog has a description or opts out of one. Radix points the
 * content's aria-describedby at a Description and warns in the console (in
 * production too) when none is rendered: a Dialog can opt out with
 * aria-describedby={undefined}, an AlertDialog needs a real description.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { ConfirmDeleteDialog } from "@/components/labor/confirm-delete-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

const srcRoot = path.resolve(__dirname, "../../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

/** Dialog contents (file:line) with neither a description nor an opt-out. */
function undescribedDialogs(): string[] {
  const missing: string[] = [];
  for (const file of sourceFiles(srcRoot)) {
    if (file.includes(`${path.sep}components${path.sep}ui${path.sep}`)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/<(Alert)?DialogContent\b/g)) {
      const name = match[0].slice(1);
      const start = match.index ?? 0;
      const openingTag = source.slice(start, source.indexOf(">", start));
      const body = source.slice(start, source.indexOf(`</${name}>`, start));
      const description = match[1] ? "AlertDialogDescription" : "DialogDescription";
      const optedOut = !match[1] && openingTag.includes("aria-describedby");
      if (!optedOut && !new RegExp(`<${description}\\b`).test(body)) {
        missing.push(`${path.relative(srcRoot, file)}:${source.slice(0, start).split("\n").length}`);
      }
    }
  }
  return missing;
}

describe("dialog descriptions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("every DialogContent and AlertDialogContent in src has a description or opts out", () => {
    expect(undescribedDialogs()).toEqual([]);
  });

  it("an opted-out dialog does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-describedby");
    expect(warn).not.toHaveBeenCalled();
  });

  it("the labor delete confirmation is described and does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ConfirmDeleteDialog open title="Delete this entry?" onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription("labor.deleteIrreversible");
    expect(warn).not.toHaveBeenCalled();
  });
});
