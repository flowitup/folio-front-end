/**
 * Tests for the rename flow in InvoiceAttachments.
 *
 * Covers: pencil button visibility gated by canManage, opening the rename
 * dialog, extension-preserve disabling, and the happy-path renameAttachment call.
 *
 * Interaction strategy: fireEvent (avoids userEvent + fake-timer issues).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Invoice, InvoiceAttachment } from "@/types/invoice";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key,
      );
    }
    return key;
  },
}));

vi.mock("@/lib/api/invoice-api", () => ({
  fetchAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  renameAttachment: vi.fn(),
  fetchAttachmentBlobUrl: vi.fn(),
}));

// Preview dialog renders a portal we don't need here — stub it out.
vi.mock("../invoice-attachment-preview-dialog", () => ({
  InvoiceAttachmentPreviewDialog: () => null,
}));

import {
  fetchAttachments,
  renameAttachment,
} from "@/lib/api/invoice-api";
import { InvoiceAttachments } from "../invoice-attachments";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  (fetchAttachments as ReturnType<typeof vi.fn>).mockResolvedValue([ATTACHMENT]);
  (renameAttachment as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...ATTACHMENT,
    filename: "Invoice March.pdf",
  });
});

describe("InvoiceAttachments rename", () => {
  it("hides the rename control when the user cannot manage", async () => {
    render(<InvoiceAttachments invoice={INVOICE} canManage={false} />);
    await screen.findByText("receipt.pdf");
    expect(screen.queryByTitle("rename")).toBeNull();
  });

  it("renames an attachment via the dialog (happy path)", async () => {
    render(<InvoiceAttachments invoice={INVOICE} canManage />);
    await screen.findByText("receipt.pdf");

    // Open the rename dialog
    fireEvent.click(screen.getByTitle("rename"));

    const input = await screen.findByDisplayValue("receipt.pdf");
    fireEvent.change(input, { target: { value: "Invoice March.pdf" } });

    // Save
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(renameAttachment).toHaveBeenCalledWith("att-1", "Invoice March.pdf");
    });
    // Dialog closes after a successful rename (rename control returns to the row)
    await waitFor(() => {
      expect(screen.queryByDisplayValue("Invoice March.pdf")).toBeNull();
    });
  });

  it("keeps Save disabled when the filename is unchanged", async () => {
    render(<InvoiceAttachments invoice={INVOICE} canManage />);
    await screen.findByText("receipt.pdf");

    fireEvent.click(screen.getByTitle("rename"));
    await screen.findByDisplayValue("receipt.pdf");

    const save = screen.getByText("save").closest("button") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });
});
