"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { Loader2 } from "lucide-react";

// ---- Types ----

type PdfCanvasViewerProps = {
  /** Presigned S3 URL pointing to the PDF */
  src: string;
  /** Raw PDF bytes — when provided, bypasses network fetch entirely */
  data?: ArrayBuffer;
  /** Accessible label for the viewer container */
  label?: string;
};

type PageState = {
  rendered: boolean;
  height: number;
  width: number;
};

// ---- Lazy PDF.js loader ----

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

// ---- Component ----

/**
 * Progressive PDF viewer using PDF.js canvas rendering.
 *
 * Renders the first page immediately, then lazily renders additional pages
 * as they scroll into view via IntersectionObserver. Much faster perceived
 * load than the `<embed>` approach which waits for the entire file.
 */
export function PdfCanvasViewer({ src, data, label }: PdfCanvasViewerProps) {
  // Unique prefix for canvas IDs — prevents collision if multiple viewers mount
  const idPrefix = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Keep the PDF document reference alive for on-demand page rendering
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  // Track which pages are currently being rendered to avoid double-render
  const renderingRef = useRef<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Guard against canvas writes after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Render a single page into its canvas element
  const renderPage = useCallback(
    async (pageNum: number) => {
      const doc = pdfDocRef.current;
      if (!doc || renderingRef.current.has(pageNum)) return;
      renderingRef.current.add(pageNum);

      try {
        const page = await doc.getPage(pageNum);
        if (!mountedRef.current) return;

        // Scale to fill container width
        const containerWidth = containerRef.current?.clientWidth ?? 800;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.getElementById(
          `${idPrefix}-pdf-page-${pageNum}`,
        ) as HTMLCanvasElement | null;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Use devicePixelRatio for crisp rendering on HiDPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        ctx.scale(dpr, dpr);

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        if (!mountedRef.current) return;

        setPages((prev) => {
          const next = [...prev];
          next[pageNum - 1] = {
            rendered: true,
            width: viewport.width,
            height: viewport.height,
          };
          return next;
        });
      } finally {
        renderingRef.current.delete(pageNum);
      }
    },
    [idPrefix],
  );

  // Load the PDF document and render the first page
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const pdfjs = await loadPdfjs();
        const loadingTask = data
          ? pdfjs.getDocument({ data })
          : pdfjs.getDocument({ url: src });
        const doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        const count = doc.numPages;
        setPageCount(count);

        // Initialize page states with placeholder dimensions
        const initial: PageState[] = Array.from({ length: count }, () => ({
          rendered: false,
          width: 0,
          height: 0,
        }));
        setPages(initial);

        // Render first page immediately for fast perceived load
        if (count > 0) {
          await renderPage(1);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [src, data, renderPage]);

  // Set up IntersectionObserver to lazily render pages as they scroll into view
  useEffect(() => {
    if (pageCount <= 1) return; // First page already rendered eagerly

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const pageNum = Number(entry.target.getAttribute("data-page"));
          if (pageNum > 0) {
            renderPage(pageNum);
            observer.unobserve(entry.target);
          }
        }
      },
      {
        root: containerRef.current?.closest("[data-scroll-root]") ?? null,
        rootMargin: "200px 0px", // Pre-render pages 200px before visible
      },
    );

    observerRef.current = observer;

    // Observe all page placeholders (skip page 1 — already rendered)
    for (let i = 2; i <= pageCount; i++) {
      const el = document.getElementById(`${idPrefix}-pdf-wrapper-${i}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [pageCount, renderPage, idPrefix]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-destructive">
        Failed to load PDF: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-2 w-full h-full overflow-auto"
      data-scroll-root=""
      role="document"
      aria-label={label ?? "PDF viewer"}
    >
      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {Array.from({ length: pageCount }, (_, i) => {
        const pageNum = i + 1;
        const page = pages[i];
        return (
          <div
            key={pageNum}
            id={`${idPrefix}-pdf-wrapper-${pageNum}`}
            data-page={pageNum}
            className="w-full flex justify-center bg-white shadow-sm rounded"
            style={
              page?.height
                ? { minHeight: `${page.height}px` }
                : { minHeight: "400px" }
            }
          >
            <canvas
              id={`${idPrefix}-pdf-page-${pageNum}`}
              className="block"
            />
          </div>
        );
      })}
    </div>
  );
}
