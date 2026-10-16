/**
 * QA3: a refunded expense's attachments are read-only (the API refuses
 * upload, rename and delete), a file deleted elsewhere closes the preview
 * dialog, and an image the browser cannot decode (HEIC) falls back to the
 * "no preview — download" panel instead of an empty area.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";
import type { Invoice, InvoiceAttachment } from "@/types/invoice";

vi.mock("@/lib/api/invoice-api", () => ({
  fetchAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  renameAttachment: vi.fn(),
  fetchAttachmentBlob: vi.fn(),
  fetchAttachmentBlobUrl: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/projects/[id]/documents/pdf-canvas-viewer", () => ({
  PdfCanvasViewer: () => null,
}));

import { fetchAttachments, fetchAttachmentBlob } from "@/lib/api/invoice-api";
import { ApiError } from "@/lib/api/http";
import { InvoiceAttachments } from "../invoice-attachments";
import { InvoiceAttachmentPreviewDialog } from "../invoice-attachment-preview-dialog";
import { isRefundedLockError } from "../refunded-lock";

const PNG: InvoiceAttachment = {
  id: "att-1",
  invoice_id: "inv-1",
  filename: "ticket.heic",
  mime_type: "image/heic",
  size_bytes: 45,
  uploaded_at: "2026-10-09T10:00:00Z",
  uploaded_by: "user-1",
  download_url: "/api/v1/attachments/att-1/download",
};

function withIntl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {node}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAttachments).mockResolvedValue([{ ...PNG, mime_type: "application/pdf", filename: "a.pdf" }]);
});

describe("refunded expense attachments", () => {
  it("offers no upload, rename or delete and says why", async () => {
    const invoice = { id: "inv-1", project_id: "proj-1", refundable_status: "refunded" } as unknown as Invoice;
    render(withIntl(<InvoiceAttachments invoice={invoice} canManage />));
    await screen.findByText("a.pdf");
    expect(screen.getByTestId("attachments-refunded-locked").textContent).toBe(
      frMessages.invoices.errorRefundedLocked
    );
    expect(screen.queryByText(frMessages.invoices.chooseFiles)).toBeNull();
    expect(screen.queryByTitle(frMessages.invoices.rename)).toBeNull();
    expect(screen.queryByTitle(frMessages.invoices.delete)).toBeNull();
  });

  it("recognises the API's lock refusal", () => {
    expect(
      isRefundedLockError(
        new ApiError("HTTP 400", 400, { message: "Refunded expenses are locked; clear the refund status first" })
      )
    ).toBe(true);
    expect(isRefundedLockError(new ApiError("HTTP 400", 400, { message: "other" }))).toBe(false);
  });
});

describe("InvoiceAttachmentPreviewDialog", () => {
  it("closes and reports a file deleted elsewhere (404)", async () => {
    vi.mocked(fetchAttachmentBlob).mockRejectedValue(new ApiError("Download failed: 404", 404));
    const onClose = vi.fn();
    const onGone = vi.fn();
    render(withIntl(<InvoiceAttachmentPreviewDialog attachment={PNG} onClose={onClose} onGone={onGone} />));
    await waitFor(() => expect(onGone).toHaveBeenCalledWith(PNG));
    expect(onClose).toHaveBeenCalled();
  });

  it("falls back to the download panel when the image cannot be decoded", async () => {
    vi.mocked(fetchAttachmentBlob).mockResolvedValue(new Blob(["x"], { type: "image/heic" }));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(withIntl(<InvoiceAttachmentPreviewDialog attachment={PNG} onClose={vi.fn()} />));
    const img = await screen.findByRole("img", { name: PNG.filename });
    fireEvent.error(img);
    expect(await screen.findByText(frMessages.invoices.attachmentPreview.fallback)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: PNG.filename })).toBeNull();
  });
});
