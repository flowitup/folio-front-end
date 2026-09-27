import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProjectDocument } from "@/lib/api/project-documents";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

import { DocumentsDeleteDialog } from "../documents-delete-dialog";

const DOC = {
  id: "d0000000-0000-0000-0000-000000000001",
  filename: "plan.pdf",
} as ProjectDocument;

describe("DocumentsDeleteDialog", () => {
  it("closes on Escape", () => {
    const onCancel = vi.fn();
    render(<DocumentsDeleteDialog doc={DOC} onCancel={onCancel} onConfirm={vi.fn()} />);

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });

    expect(onCancel).toHaveBeenCalled();
  });
});
