"use client";

/**
 * AnalysisViewer — the security-critical reader for a stored analysis report.
 *
 * The report is loaded from the same-origin proxy route
 * `/api/projects/<id>/analyses/<id>/content`, which attaches the session and
 * serves the markup with the report's own CSP. See that route for why the
 * markup is NOT passed through `srcdoc` (a srcdoc document inherits the app's
 * CSP and loses the report's webfonts).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

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

  const src = `/api/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId)}/content`;

  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md border text-center text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          {t("loading")}
        </div>
      )}
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
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        title={title}
        className="h-full w-full rounded-md border bg-white"
      />
    </div>
  );
}
