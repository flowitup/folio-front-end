/** Icon-only controls of the expense form have an accessible name. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceForm } from "../invoice-form";
import { InvoiceExportDialog } from "../invoice-export-dialog";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "en",
}));

describe("expense form and export dialog accessibility", () => {
  it("names the line-item delete buttons", () => {
    render(<InvoiceForm onSubmit={vi.fn()} />);

    // Desktop row and mobile card of the default line.
    expect(screen.getAllByRole("button", { name: "invoices.removeLine" })).toHaveLength(2);
  });

  it("describes the export dialog", () => {
    render(<InvoiceExportDialog projectId="p-1" open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "invoices.export.dialogDescription"
    );
  });
});
