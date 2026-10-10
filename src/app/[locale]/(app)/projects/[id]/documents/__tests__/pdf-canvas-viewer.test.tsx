/**
 * Tests for PdfCanvasViewer's PDF.js loading.
 *
 * The modern pdfjs-dist build calls Map.prototype.getOrInsertComputed, which
 * only ships natively from Chrome 145 / Safari 26.2 / Firefox 144, so every
 * PDF preview failed on older browsers. The viewer must load the legacy build
 * (which bundles the polyfills) and the worker copied to public/ must come
 * from that same build.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const { getDocument, GlobalWorkerOptions } = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: "" },
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument,
  GlobalWorkerOptions,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { PdfCanvasViewer } from "../pdf-canvas-viewer";

describe("PdfCanvasViewer", () => {
  it("loads the PDF through the legacy PDF.js build and its worker", async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 0, destroy: vi.fn() }),
    });

    render(<PdfCanvasViewer src="https://files.example/plan.pdf" />);

    await waitFor(() => expect(getDocument).toHaveBeenCalled());
    expect(getDocument.mock.calls[0][0]).toMatchObject({
      url: "https://files.example/plan.pdf",
    });
    expect(GlobalWorkerOptions.workerSrc).toBe("/pdf.worker.min.mjs");
  });

  it("copies the worker from the legacy build so both sides carry the polyfills", () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../../../../../../../package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    for (const script of ["predev", "prebuild"]) {
      expect(pkg.scripts[script]).toContain(
        "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs public/pdf.worker.min.mjs",
      );
    }
  });
});
