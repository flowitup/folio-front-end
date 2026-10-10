/**
 * InvoiceAttachments with the real messages: file sizes in the reader's units
 * ("45 o" in French) and a failed download that says so instead of doing
 * nothing — a file deleted elsewhere (404) also leaves the list.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import viMessages from "@/messages/vi.json";
import type { Invoice, InvoiceAttachment } from "@/types/invoice";

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

import { fetchAttachments, fetchAttachmentBlobUrl } from "@/lib/api/invoice-api";
import { ApiError } from "@/lib/api/http";
import { InvoiceAttachments } from "../invoice-attachments";

const MESSAGES = { en: enMessages, fr: frMessages, vi: viMessages } as const;

const PDF: InvoiceAttachment = {
  id: "att-1",
  invoice_id: "inv-1",
  filename: "qa-dl-gone.pdf",
  mime_type: "application/pdf",
  size_bytes: 45,
  uploaded_at: "2026-10-09T10:00:00Z",
  uploaded_by: "user-1",
  download_url: "/api/v1/attachments/att-1/download",
};

const INVOICE = { id: "inv-1", project_id: "proj-1" } as unknown as Invoice;

function renderIn(locale: keyof typeof MESSAGES) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <InvoiceAttachments invoice={INVOICE} canManage={false} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAttachments).mockResolvedValue([PDF]);
});

describe("InvoiceAttachments file size", () => {
  it.each([
    ["fr", 45, "45 o"],
    ["fr", 3686, "3,6 Ko"],
    ["en", 3686, "3.6 KB"],
    ["vi", 1572864, "1,5 MB"],
  ] as const)("shows %s sizes in the reader's units (%i bytes → %s)", async (locale, size, expected) => {
    vi.mocked(fetchAttachments).mockResolvedValue([{ ...PDF, size_bytes: size }]);
    renderIn(locale);
    await screen.findByText(PDF.filename);
    const meta = (screen.getByText(PDF.filename).nextElementSibling!.textContent ?? "").replace(/[  ]/g, " ");
    expect(meta.startsWith(`${expected} ·`)).toBe(true);
  });
});

describe("InvoiceAttachments download failure", () => {
  it("says the file is gone and drops its row when the download answers 404", async () => {
    vi.mocked(fetchAttachmentBlobUrl).mockRejectedValue(new ApiError("Download failed: 404", 404));
    renderIn("fr");
    await screen.findByText(PDF.filename);

    vi.mocked(fetchAttachments).mockResolvedValue([]);
    fireEvent.click(screen.getByTitle("Ouvrir"));

    expect(await screen.findByText("qa-dl-gone.pdf n'est plus disponible")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Aucune pièce jointe")).toBeTruthy());
    expect(fetchAttachments).toHaveBeenCalledTimes(2);
  });

  it("says the download failed, and keeps the row, on any other error", async () => {
    vi.mocked(fetchAttachmentBlobUrl).mockRejectedValue(new ApiError("Download failed: 500", 500));
    renderIn("en");
    await screen.findByText(PDF.filename);

    fireEvent.click(screen.getByTitle("Open"));

    expect(await screen.findByText("Failed to download qa-dl-gone.pdf")).toBeTruthy();
    expect(screen.getByText(PDF.filename)).toBeTruthy();
    expect(fetchAttachments).toHaveBeenCalledTimes(1);
  });
});
