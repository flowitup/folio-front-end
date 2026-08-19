/**
 * Tests for DocumentsPreviewDialog.
 *
 * Covers the presigned-URL degradation path: when the API hands out a
 * presigned S3 URL that the browser cannot actually fetch (mis-routed public
 * endpoint), the dialog must fall back to streaming the file through the API
 * instead of leaving a dead viewer pane.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DocumentsPreviewDialog } from "../documents-preview-dialog";
import type { ProjectDocument } from "@/lib/api/project-documents";
import {
  fetchDocumentPreviewUrl,
  fetchProjectDocumentBlob,
} from "@/lib/api/project-document-blob";

// ---- Module mocks ----

vi.mock("@/lib/api/project-document-blob", () => ({
  fetchDocumentPreviewUrl: vi.fn(),
  fetchProjectDocumentBlob: vi.fn(),
  downloadProjectDocument: vi.fn().mockResolvedValue(undefined),
}));

// The real viewer pulls in pdfjs-dist; stand in for it and expose a button
// that simulates PDF.js failing to load the presigned URL.
vi.mock("../pdf-canvas-viewer", () => ({
  PdfCanvasViewer: ({
    src,
    onLoadError,
  }: {
    src: string;
    onLoadError?: (message: string) => void;
  }) => (
    <div>
      <span data-testid="pdfjs-src">{src}</span>
      <button type="button" onClick={() => onLoadError?.("404")}>
        simulate-load-error
      </button>
    </div>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// ---- Fixtures ----

const doc: ProjectDocument = {
  id: "doc-1",
  project_id: "proj-1",
  filename: "plan.pdf",
  kind: "pdf",
  content_type: "application/pdf",
  size_bytes: 1024,
  tags: [],
  uploaded_at: "2026-05-01T00:00:00+00:00",
  uploader_id: "user-1",
  download_url: "/api/v1/projects/proj-1/documents/doc-1/download",
};

// ---- Tests ----

describe("DocumentsPreviewDialog presigned fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:fake");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("streams through the API when the presigned URL fails to load", async () => {
    vi.mocked(fetchDocumentPreviewUrl).mockResolvedValue({
      url: "https://example.test/uploads/bucket/plan.pdf?sig=abc",
      contentType: "application/pdf",
      filename: "plan.pdf",
    });
    vi.mocked(fetchProjectDocumentBlob).mockResolvedValue({
      objectUrl: "blob:fake",
      contentType: "application/pdf",
      revoke: vi.fn(),
    });

    render(
      <DocumentsPreviewDialog doc={doc} projectId="proj-1" onClose={vi.fn()} />,
    );

    // PDF.js path is tried first, using the presigned URL
    const src = await screen.findByTestId("pdfjs-src");
    expect(src).toHaveTextContent("https://example.test/uploads/bucket/plan.pdf");
    expect(fetchProjectDocumentBlob).not.toHaveBeenCalled();

    // The presigned URL turns out to be unfetchable
    screen.getByText("simulate-load-error").click();

    await waitFor(() => {
      expect(fetchProjectDocumentBlob).toHaveBeenCalledWith(
        "proj-1",
        "doc-1",
        expect.anything(),
      );
    });

    // Second attempt must not ask for another dead presigned URL
    expect(fetchDocumentPreviewUrl).toHaveBeenCalledTimes(1);
  });

  it("uses the presigned URL when it loads fine", async () => {
    vi.mocked(fetchDocumentPreviewUrl).mockResolvedValue({
      url: "https://example.test/ok.pdf?sig=abc",
      contentType: "application/pdf",
      filename: "plan.pdf",
    });

    render(
      <DocumentsPreviewDialog doc={doc} projectId="proj-1" onClose={vi.fn()} />,
    );

    await screen.findByTestId("pdfjs-src");
    expect(fetchProjectDocumentBlob).not.toHaveBeenCalled();
  });
});
