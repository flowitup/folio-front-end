/**
 * InvoiceAttachments — deleting a file asks in the app, naming the file,
 * instead of the browser's confirm().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { Invoice, InvoiceAttachment } from "@/types/invoice";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string, params?: Record<string, unknown>) => {
    const raw = ns ? `${ns}.${key}` : key;
    return params
      ? Object.entries(params).reduce((acc, [k, v]) => `${acc} ${k}=${String(v)}`, raw)
      : raw;
  },
  useLocale: () => "en",
}));

vi.mock("@/lib/api/invoice-api", () => ({
  fetchAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  renameAttachment: vi.fn(),
  fetchAttachmentBlobUrl: vi.fn(),
}));

vi.mock("../invoice-attachment-preview-dialog", () => ({
  InvoiceAttachmentPreviewDialog: () => null,
}));

import { deleteAttachment, fetchAttachments } from "@/lib/api/invoice-api";
import { InvoiceAttachments } from "../invoice-attachments";

const ATTACHMENT: InvoiceAttachment = {
  id: "att-1",
  invoice_id: "inv-1",
  filename: "receipt.pdf",
  mime_type: "application/pdf",
  size_bytes: 2048,
  uploaded_at: "2026-06-01T10:00:00Z",
  uploaded_by: "user-1",
  download_url: "/api/v1/attachments/att-1/download",
};

const INVOICE = { id: "inv-1", project_id: "proj-1" } as unknown as Invoice;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAttachments).mockResolvedValue([ATTACHMENT]);
  vi.mocked(deleteAttachment).mockResolvedValue(undefined);
});

describe("InvoiceAttachments delete", () => {
  it("asks in the app, naming the file, and deletes only on yes", async () => {
    const nativeConfirm = vi.spyOn(window, "confirm");
    render(<InvoiceAttachments invoice={INVOICE} canManage />);
    await screen.findByText("receipt.pdf");

    fireEvent.click(screen.getByTitle("invoices.delete"));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("invoices.attachmentDeleteTitle name=receipt.pdf");
    fireEvent.click(within(dialog).getByRole("button", { name: "invoices.cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleteAttachment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle("invoices.delete"));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "invoices.delete" })
    );
    await waitFor(() => expect(deleteAttachment).toHaveBeenCalledWith("att-1"));
    expect(nativeConfirm).not.toHaveBeenCalled();
  });
});
