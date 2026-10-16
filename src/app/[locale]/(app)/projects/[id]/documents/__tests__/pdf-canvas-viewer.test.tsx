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
import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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

beforeEach(() => {
  getDocument.mockReset();
});

import { PdfCanvasViewer } from "../pdf-canvas-viewer";

describe("PdfCanvasViewer", () => {
  it("loads the PDF through the legacy PDF.js build and its worker", async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 0, loadingTask: { destroy: vi.fn() } }),
    });

    render(<PdfCanvasViewer src="https://files.example/plan.pdf" />);

    await waitFor(() => expect(getDocument).toHaveBeenCalled());
    expect(getDocument.mock.calls[0][0]).toMatchObject({
      url: "https://files.example/plan.pdf",
    });
    expect(GlobalWorkerOptions.workerSrc).toBe("/pdf.worker.min.mjs");
  });

  it("releases the document through its loading task when unmounted", async () => {
    const destroy = vi.fn();
    getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 0, loadingTask: { destroy } }),
    });

    const { unmount } = render(<PdfCanvasViewer src="https://files.example/plan.pdf" />);
    await waitFor(() => expect(getDocument).toHaveBeenCalled());
    await getDocument.mock.results[0].value.promise;
    await Promise.resolve();
    unmount();

    expect(destroy).toHaveBeenCalled();
  });

  it("copies the worker from the legacy build so both sides carry the polyfills", () => {
    const root = path.resolve(__dirname, "../../../../../../../..");
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    for (const script of ["predev", "prebuild"]) {
      expect(pkg.scripts[script]).toContain("scripts/copy-pdfjs-assets.mjs");
    }
    const copier = readFileSync(path.join(root, "scripts/copy-pdfjs-assets.mjs"), "utf8");
    expect(copier).toContain('"legacy", "build", "pdf.worker.min.mjs"');
    // The no-WebAssembly decoders and colour profiles ship too (scans render blank without them)
    for (const dir of ["wasm", "iccs", "cmaps", "standard_fonts"]) {
      expect(copier).toContain(`"${dir}"`);
    }
  });

  it("draws page 1 of a one-page PDF once its canvas is committed", async () => {
    const render1 = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
      render: render1,
    };
    // getPage answers at once, before React has committed the page canvases
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn(() => Promise.resolve(page)),
        loadingTask: { destroy: vi.fn() },
      }),
    });
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ({ setTransform: vi.fn() }) as unknown as CanvasRenderingContext2D,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const onLoadError = vi.fn();
    const { container } = render(
      <PdfCanvasViewer src="" data={new ArrayBuffer(8)} onLoadError={onLoadError} />,
    );

    await waitFor(() => expect(render1).toHaveBeenCalledTimes(1));
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(render1.mock.calls[0][0]).toMatchObject({ canvas });
    expect(onLoadError).not.toHaveBeenCalled();
    expect(screen.getByText("pageOf")).toBeInTheDocument();
  });

  it("asks for the password of a protected PDF instead of failing", async () => {
    let onPassword: ((update: (p: string) => void, reason: number) => void) | undefined;
    const task = {
      promise: new Promise(() => {}),
      set onPassword(fn: (update: (p: string) => void, reason: number) => void) {
        onPassword = fn;
        fn(vi.fn(), 1);
      },
      get onPassword() {
        return onPassword!;
      },
    };
    getDocument.mockReturnValue(task);
    const onLoadError = vi.fn();

    render(<PdfCanvasViewer src="https://files.example/locked.pdf" onLoadError={onLoadError} />);

    expect(await screen.findByText("passwordPrompt")).toBeInTheDocument();
    expect(onLoadError).not.toHaveBeenCalled();
  });

  it("reports a document that cannot be loaded and offers a retry", async () => {
    getDocument.mockReturnValue({ promise: Promise.reject(new Error("Invalid PDF structure")) });
    const onLoadError = vi.fn();

    render(<PdfCanvasViewer src="https://files.example/broken.pdf" onLoadError={onLoadError} />);

    await waitFor(() => expect(onLoadError).toHaveBeenCalledWith("Invalid PDF structure"));
    expect(screen.getByText("retry")).toBeInTheDocument();
  });
});
