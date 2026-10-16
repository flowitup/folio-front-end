/**
 * Tests for BillingPdfPreviewDialog: the rendered devis / facture PDF opens
 * in the page (PDF.js), and a failed render offers no dead pane.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillingPdfPreviewDialog } from "../billing-pdf-preview-dialog";
import { clearBillingFileCache } from "@/lib/api/billing/billing-file-client";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/app/[locale]/(app)/projects/[id]/documents/pdf-canvas-viewer", () => ({
  PdfCanvasViewer: ({ data }: { data?: ArrayBuffer }) => (
    <div data-testid="pdf-bytes">{data?.byteLength}</div>
  ),
}));

const doc = { id: "doc 1", document_number: "FAC-2026-001" };

describe("BillingPdfPreviewDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearBillingFileCache();
  });

  it("fetches the rendered PDF and hands its bytes to the viewer", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("%PDF-1.7", { status: 200 }));

    render(<BillingPdfPreviewDialog document={doc} onClose={vi.fn()} />);

    expect(await screen.findByTestId("pdf-bytes")).toHaveTextContent("8");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/billing-documents\/doc%201\/pdf$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });
    expect(screen.getByText("FAC-2026-001")).toBeInTheDocument();
  });

  it("shows the error message when the PDF cannot be rendered", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));

    render(<BillingPdfPreviewDialog document={doc} onClose={vi.fn()} />);

    expect(await screen.findByText("error")).toBeInTheDocument();
    expect(screen.queryByTestId("pdf-bytes")).toBeNull();
    // Not a dead end: a retry, and Download stays usable
    expect(screen.getByRole("button", { name: /retry/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/ })).toBeEnabled();
  });

  it("says how long to wait when the API rate-limits the render", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "TooManyRequests", retry_after: 42 }), {
        status: 429,
        headers: { "Retry-After": "42" },
      }),
    );

    render(<BillingPdfPreviewDialog document={doc} onClose={vi.fn()} />);

    expect(await screen.findByText("rateLimit.seconds")).toBeInTheDocument();
  });

  it("reuses the bytes of an unchanged document instead of rendering it again", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("%PDF-1.7", { status: 200 }));
    const versioned = { ...doc, updated_at: "2026-10-01T10:00:00Z" };

    const first = render(<BillingPdfPreviewDialog document={versioned} onClose={vi.fn()} />);
    await screen.findByTestId("pdf-bytes");
    first.unmount();
    render(<BillingPdfPreviewDialog document={versioned} onClose={vi.fn()} />);
    await screen.findByTestId("pdf-bytes");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stays closed without a document", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<BillingPdfPreviewDialog document={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
