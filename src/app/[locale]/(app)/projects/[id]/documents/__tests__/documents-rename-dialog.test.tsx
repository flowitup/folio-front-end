import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProjectDocument } from "@/lib/api/project-documents";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

import { DocumentsRenameDialog, fileExtension } from "../documents-rename-dialog";

const DOC = {
  id: "d0000000-0000-0000-0000-000000000001",
  filename: "budget.xlsx",
} as ProjectDocument;

describe("DocumentsRenameDialog", () => {
  it("refuses a name whose extension changed, with an inline message", () => {
    const onConfirm = vi.fn();
    render(<DocumentsRenameDialog doc={DOC} onCancel={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "budget.pdf" } });

    expect(screen.getByRole("alert")).toHaveTextContent("documents.rename.errorExtension");
    expect(screen.getByRole("button", { name: "documents.rename.save" })).toBeDisabled();
  });

  it("accepts a new name with the same extension", () => {
    render(<DocumentsRenameDialog doc={DOC} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Budget 2026.XLSX" } });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "documents.rename.save" })).toBeEnabled();
  });

  it("reads extensions the way the backend does", () => {
    expect(fileExtension("a.tar.gz")).toBe(".gz");
    expect(fileExtension("README")).toBe("");
    expect(fileExtension(".env")).toBe("");
  });
});
