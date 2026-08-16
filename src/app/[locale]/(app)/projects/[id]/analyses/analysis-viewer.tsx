"use client";

/**
 * AnalysisViewer — the security-critical reader for a stored analysis report.
 * Fetches the raw HTML body as an authenticated blob and renders it inside a
 * sandboxed iframe that never gets `allow-same-origin`. See the `sandbox`
 * prop below for the full rationale, paired with the backend docstring on
 * `GET /projects/<id>/analyses/<id>/content`.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertCircle } from "lucide-react";
import { fetchProjectAnalysisBlob } from "@/lib/api/project-analysis-blob";

// ---- Props ----

type Props = {
  projectId: string;
  analysisId: string;
  title: string;
};

// ---- Component ----

// Callers should render this component with `key={analysisId}` so switching
// analyses remounts it — that resets blobUrl/error to their initial values
// for free and keeps the fetch effect's cleanup as the single place that
// revokes the previous object URL (on unmount, whether from navigating away
// or from the key change itself).
export function AnalysisViewer({ projectId, analysisId, title }: Props) {
  const t = useTranslations("analyses.viewer");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revokeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const blob = await fetchProjectAnalysisBlob(projectId, analysisId, controller.signal);
        if (controller.signal.aborted) {
          blob.revoke();
          return;
        }
        revokeRef.current = blob.revoke;
        setBlobUrl(blob.objectUrl);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    void load();

    return () => {
      controller.abort();
      if (revokeRef.current) {
        revokeRef.current();
        revokeRef.current = null;
      }
    };
  }, [projectId, analysisId]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border text-center text-sm text-muted-foreground">
        <AlertCircle className="size-5" aria-hidden />
        {t("error")}
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border text-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {t("loading")}
      </div>
    );
  }

  return (
    <iframe
      src={blobUrl}
      // SECURITY — do not add "allow-same-origin" to this sandbox list.
      // `allow-scripts` alone gives the report document an OPAQUE origin: its
      // own inline scripts and Google Fonts requests still run, but it has no
      // way to read Folio's cookies, localStorage, or the parent DOM. Adding
      // `allow-same-origin` alongside `allow-scripts` would let the sandboxed
      // document resynchronize with Folio's real origin, turning every stored
      // analysis report into stored XSS against the Folio session. This is
      // one security decision split across two phases — paired with the
      // docstring on the backend GET /projects/<id>/analyses/<id>/content
      // route (BE phase 04 / FE phase 06). Do not change one half without
      // re-reviewing the other.
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title={title}
      className="h-full w-full rounded-md border bg-white"
    />
  );
}
