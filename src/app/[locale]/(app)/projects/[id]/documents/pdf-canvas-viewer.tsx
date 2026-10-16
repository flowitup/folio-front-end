"use client";

import { useEffect, useRef, useState, useCallback, useId, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Loader2, Maximize2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---- Types ----

type PdfCanvasViewerProps = {
  /** Presigned S3 URL pointing to the PDF */
  src: string;
  /** Raw PDF bytes — when provided, bypasses network fetch entirely */
  data?: ArrayBuffer;
  /** Accessible label for the viewer container */
  label?: string;
  /**
   * Called when the PDF fails to load or its first page cannot be drawn
   * (unreachable URL, corrupt bytes). Lets the caller degrade to another
   * source instead of showing a dead pane. Not called for a password-protected
   * file: the viewer asks for the password itself.
   */
  onLoadError?: (message: string) => void;
};

type PageState = {
  rendered: boolean;
  height: number;
  width: number;
};

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDoc = import("pdfjs-dist/legacy/build/pdf.mjs").PDFDocumentProxy;
type RenderTask = { cancel: () => void; promise: Promise<void> };

/** pdf.js PasswordResponses.INCORRECT_PASSWORD */
const INCORRECT_PASSWORD = 2;
/** Frames to wait for a page's canvas to be committed before giving up. */
const CANVAS_WAIT_FRAMES = 30;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

// ---- Lazy PDF.js loader ----

// The legacy build bundles core-js polyfills (e.g. Map.prototype.getOrInsertComputed,
// only native from Chrome 145 / Safari 26.2 / Firefox 144). The modern build throws
// on older browsers, so every PDF preview failed there. The worker copied to
// public/ by predev/prebuild must come from the same legacy build.
let pdfjsPromise: Promise<PdfjsModule> | null = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 16);
  });
}

function isCancelled(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "RenderingCancelledException"
  );
}

// ---- Component ----

/**
 * Progressive PDF viewer using PDF.js canvas rendering.
 *
 * Pages are drawn only once their <canvas> is in the DOM: page 1 right after
 * the page list is committed, the others as they scroll into view. Drawing
 * page 1 straight after loading (before React had committed its canvas) used
 * to leave the first page blank, silently, whenever pdf.js answered faster
 * than React rendered — the whole preview of a one-page devis/facture.
 *
 * Toolbar: zoom out / fit width / zoom in and a page indicator with
 * previous / next, so plans can be read on a phone. A password-protected PDF
 * gets a password field; any failure to draw page 1 is reported (onLoadError)
 * or shown with a retry instead of an empty white sheet.
 */
export function PdfCanvasViewer({ src, data, label, onLoadError }: PdfCanvasViewerProps) {
  const t = useTranslations("documents.preview");
  // Unique prefix for element IDs — prevents collision if multiple viewers mount
  const idPrefix = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageState[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstPageDrawn, setFirstPageDrawn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  // Password prompt: pdf.js hands a callback that takes the password
  const [passwordPrompt, setPasswordPrompt] = useState<{
    submit: (password: string) => void;
    incorrect: boolean;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  // Keep the PDF document reference alive for on-demand page rendering
  const pdfDocRef = useRef<PdfDoc | null>(null);
  // Canvas elements by page number, filled by ref callbacks at commit time
  const canvasesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  // Render in progress per page, with the layout key it was started for
  const renderTasksRef = useRef<Map<number, { key: string; task: RenderTask | null }>>(new Map());
  // Layout key each page was last drawn at (skip redrawing an up-to-date page)
  const drawnKeysRef = useRef<Map<number, string>>(new Map());
  // Guard against canvas writes after unmount
  const mountedRef = useRef(true);
  // Held in a ref so a caller's inline callback never re-triggers the load effect
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  const layoutKey = `${zoom}:${containerWidth}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Track the pane width so pages are sized from the real layout (and
  // re-drawn when the dialog is resized or the phone rotates).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 0) setContainerWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageCount]);

  const failFirstPage = useCallback((message: string) => {
    if (!mountedRef.current) return;
    setError(message);
    setLoading(false);
    onLoadErrorRef.current?.(message);
  }, []);

  // Render a single page into its canvas element
  const renderPage = useCallback(
    async (pageNum: number) => {
      const doc = pdfDocRef.current;
      if (!doc) return;
      if (drawnKeysRef.current.get(pageNum) === layoutKey) return;
      const running = renderTasksRef.current.get(pageNum);
      if (running && running.key === layoutKey) return;
      running?.task?.cancel();
      const entry: { key: string; task: RenderTask | null } = { key: layoutKey, task: null };
      renderTasksRef.current.set(pageNum, entry);

      try {
        const page = await doc.getPage(pageNum);
        if (!mountedRef.current || renderTasksRef.current.get(pageNum) !== entry) return;

        // The canvas may not be committed yet (the page list was just set):
        // wait a few frames for it instead of giving up silently.
        let canvas = canvasesRef.current.get(pageNum) ?? null;
        for (let i = 0; !canvas && i < CANVAS_WAIT_FRAMES; i++) {
          await nextFrame();
          if (!mountedRef.current || renderTasksRef.current.get(pageNum) !== entry) return;
          canvas = canvasesRef.current.get(pageNum) ?? null;
        }
        if (!canvas) throw new Error(`Page ${pageNum}: canvas not available`);

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error(`Page ${pageNum}: no 2D context`);

        // Fit the pane width, times the zoom factor
        const width = containerWidth || containerRef.current?.clientWidth || 800;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = (width / unscaledViewport.width) * zoom;
        const viewport = page.getViewport({ scale });

        // Use devicePixelRatio for crisp rendering on HiDPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        // At fit width, let the height follow a capped width so the page stays
        // inside the pane on phones; zoomed in, keep the real size and scroll.
        canvas.style.height = zoom > 1 ? `${Math.floor(viewport.height)}px` : "auto";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const task = page.render({ canvasContext: ctx, viewport, canvas }) as unknown as RenderTask;
        entry.task = task;
        await task.promise;

        if (!mountedRef.current) return;
        drawnKeysRef.current.set(pageNum, entry.key);

        setPages((prev) => {
          const next = [...prev];
          next[pageNum - 1] = {
            rendered: true,
            width: viewport.width,
            height: viewport.height,
          };
          return next;
        });
        if (pageNum === 1) {
          setFirstPageDrawn(true);
          setLoading(false);
        }
      } catch (err) {
        if (isCancelled(err)) return;
        if (renderTasksRef.current.get(pageNum) !== entry) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (pageNum === 1) failFirstPage(msg);
      } finally {
        if (renderTasksRef.current.get(pageNum) === entry) renderTasksRef.current.delete(pageNum);
      }
    },
    [layoutKey, containerWidth, zoom, failFirstPage],
  );

  // Load the PDF document (pages are drawn once their canvases exist)
  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => void } | null = null;
    const renderTasks = renderTasksRef.current;
    const drawnKeys = drawnKeysRef.current;

    async function init() {
      try {
        setLoading(true);
        setError(null);
        setFirstPageDrawn(false);
        setPasswordPrompt(null);
        setPageCount(0);
        setPages([]);
        drawnKeys.clear();

        const pdfjs = await loadPdfjs();
        const docParams = {
          cMapUrl: "/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/standard_fonts/",
          wasmUrl: "/wasm/",
          iccUrl: "/iccs/",
          // PDF.js transfers the buffer to its worker and detaches it, so hand
          // it a copy: a re-run of this effect must still see the bytes.
          ...(data ? { data: new Uint8Array(data.slice(0)) } : { url: src }),
        };
        const task = pdfjs.getDocument(docParams);
        loadingTask = task as unknown as { destroy: () => void };
        // A user-password PDF: ask for it instead of failing with a generic error
        (task as unknown as {
          onPassword: (update: (password: string) => void, reason: number) => void;
        }).onPassword = (update, reason) => {
          if (cancelled) return;
          setLoading(false);
          setPasswordPrompt({ submit: update, incorrect: reason === INCORRECT_PASSWORD });
        };
        const doc = await task.promise;
        if (cancelled) {
          doc.loadingTask.destroy();
          return;
        }

        pdfDocRef.current = doc;
        setPasswordPrompt(null);
        const count = doc.numPages;
        setPages(Array.from({ length: count }, () => ({ rendered: false, width: 0, height: 0 })));
        setPageCount(count);
        setLoading(count > 0);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        failFirstPage(msg);
      }
    }

    init();

    return () => {
      cancelled = true;
      for (const { task } of renderTasks.values()) task?.cancel();
      renderTasks.clear();
      drawnKeys.clear();
      if (pdfDocRef.current) {
        pdfDocRef.current.loadingTask.destroy();
        pdfDocRef.current = null;
      } else {
        loadingTask?.destroy();
      }
    };
  }, [src, data, reloadNonce, failFirstPage]);

  // Draw page 1 once its canvas is committed, and again when the layout changes
  useEffect(() => {
    if (pageCount > 0) void renderPage(1);
  }, [pageCount, renderPage]);

  // Lazily draw every page (page 1 included, so a missed draw is retried) as
  // it scrolls into view; re-created on zoom/resize so visible pages redraw.
  useEffect(() => {
    if (pageCount === 0 || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const pageNum = Number(entry.target.getAttribute("data-page"));
          if (pageNum > 0) void renderPage(pageNum);
        }
      },
      {
        root: containerRef.current,
        rootMargin: "200px 0px", // Pre-render pages 200px before visible
      },
    );

    for (let i = 1; i <= pageCount; i++) {
      const el = document.getElementById(`${idPrefix}-pdf-wrapper-${i}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [pageCount, renderPage, idPrefix]);

  // Page indicator: the last page whose top is above the pane's upper third
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || pageCount === 0) return;
    const probe = el.scrollTop + el.clientHeight / 3;
    let current = 1;
    for (let i = 1; i <= pageCount; i++) {
      const wrapper = document.getElementById(`${idPrefix}-pdf-wrapper-${i}`);
      if (wrapper && wrapper.offsetTop - el.offsetTop <= probe) current = i;
    }
    setCurrentPage(current);
  }, [pageCount, idPrefix]);

  function goToPage(pageNum: number) {
    const target = Math.min(Math.max(1, pageNum), pageCount);
    const wrapper = document.getElementById(`${idPrefix}-pdf-wrapper-${target}`);
    wrapper?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    setCurrentPage(target);
  }

  function changeZoom(direction: 1 | -1) {
    setZoom((z) => {
      const idx = ZOOM_STEPS.findIndex((s) => s >= z - 1e-6);
      const at = idx === -1 ? ZOOM_STEPS.length - 1 : idx;
      return ZOOM_STEPS[Math.min(Math.max(at + direction, 0), ZOOM_STEPS.length - 1)] ?? z;
    });
  }

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (!passwordPrompt || !password) return;
    setLoading(true);
    const { submit } = passwordPrompt;
    setPasswordPrompt(null);
    submit(password);
    setPassword("");
  }

  const setCanvas = useCallback((pageNum: number, el: HTMLCanvasElement | null) => {
    if (el) canvasesRef.current.set(pageNum, el);
    else canvasesRef.current.delete(pageNum);
  }, []);

  if (passwordPrompt) {
    return (
      <form
        onSubmit={submitPassword}
        className="mx-auto flex h-full w-full max-w-xs flex-col items-stretch justify-center gap-3 p-4 text-center"
      >
        <p className="text-sm font-medium">{t("passwordPrompt")}</p>
        <label htmlFor={`${idPrefix}-pdf-password`} className="sr-only">
          {t("passwordLabel")}
        </label>
        <Input
          id={`${idPrefix}-pdf-password`}
          type="password"
          autoComplete="off"
          autoFocus
          placeholder={t("passwordLabel")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={passwordPrompt.incorrect || undefined}
        />
        {passwordPrompt.incorrect && (
          <p className="text-sm text-destructive" role="alert">
            {t("passwordIncorrect")}
          </p>
        )}
        <Button type="submit" disabled={!password}>
          {t("passwordSubmit")}
        </Button>
      </form>
    );
  }

  if (error) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"
        title={error}
        role="alert"
      >
        <p>{t("error")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setReloadNonce((n) => n + 1)}
        >
          <RotateCw className="size-4" aria-hidden />
          {t("retry")}
        </Button>
      </div>
    );
  }

  const busy = loading || (pageCount > 0 && !firstPageDrawn);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      {pageCount > 0 && (
        <div
          role="toolbar"
          aria-label={t("toolbar")}
          className="flex shrink-0 items-center justify-between gap-1 border-b px-1 py-1"
        >
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label={t("prevPage")}
              title={t("prevPage")}
            >
              <ChevronUp className="size-4" aria-hidden />
            </Button>
            <span className="min-w-14 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {t("pageOf", { page: currentPage, count: pageCount })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              aria-label={t("nextPage")}
              title={t("nextPage")}
            >
              <ChevronDown className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => changeZoom(-1)}
              disabled={zoom <= ZOOM_STEPS[0]}
              aria-label={t("zoomOut")}
              title={t("zoomOut")}
            >
              <ZoomOut className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 min-w-14 px-2 text-xs tabular-nums"
              onClick={() => setZoom(1)}
              aria-label={t("fitWidth")}
              title={t("fitWidth")}
            >
              {zoom === 1 ? <Maximize2 className="size-4" aria-hidden /> : `${Math.round(zoom * 100)} %`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => changeZoom(1)}
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              aria-label={t("zoomIn")}
              title={t("zoomIn")}
            >
              <ZoomIn className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-auto"
        data-scroll-root=""
        role="document"
        aria-label={label ?? "PDF viewer"}
        aria-busy={busy || undefined}
      >
        {busy && (
          <div className="absolute inset-x-0 top-0 z-10 flex h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">{t("loading")}</span>
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
              className={
                zoom > 1
                  ? "flex w-max min-w-full shrink-0 justify-center self-start"
                  : "flex w-full shrink-0 justify-center"
              }
              style={page?.height ? { minHeight: `${page.height}px` } : { minHeight: "400px" }}
            >
              <canvas
                ref={(el) => setCanvas(pageNum, el)}
                id={`${idPrefix}-pdf-page-${pageNum}`}
                className={
                  zoom > 1
                    ? "block rounded bg-white shadow-sm"
                    : "block max-w-full rounded bg-white shadow-sm"
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
