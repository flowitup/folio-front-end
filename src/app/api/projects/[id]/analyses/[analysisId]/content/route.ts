/**
 * Same-origin proxy that serves a stored analysis report to the viewer iframe.
 *
 * Why this route exists rather than passing markup through `srcdoc`:
 * a `srcdoc` document INHERITS the embedding page's Content-Security-Policy.
 * Folio's app CSP is deliberately tight (`font-src 'self' data:`, no external
 * style hosts), so a report loaded that way silently lost its Google Fonts and
 * would break unpredictably on any other external asset. Loading the report
 * from its own URL makes it a separate document with the CSP set below, so the
 * report gets exactly the allowances it needs while the app's CSP stays strict.
 *
 * The iframe embedding this response is sandboxed WITHOUT `allow-same-origin`
 * (see analysis-viewer.tsx), which is what actually contains the untrusted
 * markup: the document runs with an opaque origin and cannot reach Folio's
 * cookies, storage, or parent DOM. `script-src 'unsafe-inline'` below is
 * acceptable only under that sandbox — do not relax one without the other.
 */

import { sessionAuthHeader } from "@/lib/api/auth-header";
import { env } from "@/lib/config/env";

// Mirrors the CSP the backend sets on GET .../analyses/<id>/content. Reports
// inline their own CSS and a scroll-reveal script, and pull webfonts from
// Google Fonts.
const REPORT_CSP = [
  "default-src 'none'",
  "img-src 'self' data: https:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'unsafe-inline'",
  "frame-ancestors 'self'",
].join("; ");

const BASE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": REPORT_CSP,
};

/** Minimal, self-contained placeholder shown inside the frame on failure. */
function errorDocument(status: number): string {
  const message =
    status === 403
      ? "You do not have access to this report."
      : status === 404
        ? "This report is no longer available."
        : "This report could not be loaded.";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report unavailable</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font:14px system-ui,sans-serif;color:#6b7280;background:#fff">${message}</body></html>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  const { id: projectId, analysisId } = await params;
  const authHeaders = await sessionAuthHeader();

  const upstream = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId)}/content`;

  let response: Response;
  try {
    response = await fetch(upstream, {
      method: "GET",
      headers: { ...authHeaders },
      cache: "no-store",
    });
  } catch {
    return new Response(errorDocument(502), { status: 502, headers: BASE_HEADERS });
  }

  if (!response.ok) {
    return new Response(errorDocument(response.status), {
      status: response.status,
      headers: BASE_HEADERS,
    });
  }

  return new Response(await response.text(), { status: 200, headers: BASE_HEADERS });
}
