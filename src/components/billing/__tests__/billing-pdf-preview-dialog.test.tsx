/**
 * Tests for BillingPdfPreviewDialog: the rendered devis / facture PDF opens
 * in the page (PDF.js), and a failed render offers no dead pane.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillingPdfPreviewDialog } from "../billing-pdf-preview-dialog";

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
  });

  it("stays closed without a document", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<BillingPdfPreviewDialog document={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
