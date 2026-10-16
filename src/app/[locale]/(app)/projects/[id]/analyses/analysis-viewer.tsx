"use client";

/**
 * AnalysisViewer — the security-critical reader for a stored analysis report.
 *
 * The report is loaded from the same-origin proxy route
 * `/analysis-report/<projectId>/<analysisId>`, which attaches the session and
 * serves the markup with the report's own CSP. See that route for why the
 * markup is NOT passed through `srcdoc` (a srcdoc document inherits the app's
 * CSP and loses the report's webfonts).
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";

// The loading layer never stays longer than this, even if no load event
// arrives: it is only a hint, and the report below it stays usable.
const LOADING_HINT_MAX_MS = 8000;

// ---- Props ----

type Props = {
  projectId: string;
  analysisId: string;
  title: string;
};

// ---- Component ----

// Callers should render this with `key={analysisId}` so switching analyses
// remounts it and the loading state resets for free.
export function AnalysisViewer({ projectId, analysisId, title }: Props) {
  const t = useTranslations("analyses.viewer");
  const [loaded, setLoaded] = useState(false);
  // The iframe is created on the client only. Server-rendered, it could fire
  // its load event before hydration attached onLoad, leaving the loading
  // layer on top of the report for good.
  const mounted = useHydrated();

  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), LOADING_HINT_MAX_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const src = `/analysis-report/${encodeURIComponent(projectId)}/${encodeURIComponent(analysisId)}`;

  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md border text-center text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          {t("loading")}
        </div>
      )}
      {mounted && (
        <iframe
          src={src}
          onLoad={() => setLoaded(true)}
          // SECURITY — do not add "allow-same-origin" to this sandbox list.
          // `allow-scripts` alone gives the report document an OPAQUE origin: its
          // own inline scripts and Google Fonts requests still run, but it has no
          // way to read Folio's cookies, localStorage, or the parent DOM. Adding
          // `allow-same-origin` alongside `allow-scripts` would let the sandboxed
          // document resynchronize with Folio's real origin, turning every stored
          // analysis report into stored XSS against the Folio session. This is
          // one security decision split across three places — paired with the
          // docstring on the backend GET /projects/<id>/analyses/<id>/content
          // route and the CSP on the same-origin proxy route. Do not change one
          // without re-reviewing the others.
          //
          // `allow-popups` + `allow-popups-to-escape-sandbox` let a report's
          // links (target=_blank) open in a new tab as ordinary pages; they give
          // the report itself no access to Folio. Never add `allow-same-origin`
          // or `allow-top-navigation`.
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          title={title}
          className="h-full w-full rounded-md border bg-white"
        />
      )}
    </div>
  );
}
