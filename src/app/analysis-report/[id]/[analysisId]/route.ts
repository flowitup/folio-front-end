/**
 * Same-origin proxy that serves a stored analysis report to the viewer iframe.
 *
 * Mounted at /analysis-report/<projectId>/<analysisId>, deliberately NOT under
 * /api: in production the whole /api/* prefix is routed to the Flask backend,
 * so a Next route handler there is shadowed and 404s. It only appeared to work
 * locally because the frontend and backend run on separate ports there.
 *
 * Why this route exists rather than passing markup through `srcdoc`:
 * a `srcdoc` document INHERITS the embedding page's Content-Security-Policy.
 * Folio's app CSP is deliberately tight (`font-src 'self' data:`, no external
 * style hosts), so a report loaded that way silently lost its Google Fonts and
 * would break unpredictably on any other external asset. Loading the report
 * from its own URL makes it a separate document with the CSP set below, so the
 * report gets exactly the allowances it needs while the app's CSP stays strict.
 *
 * The untrusted markup is contained by a sandbox, applied twice: the iframe in
 * analysis-viewer.tsx is sandboxed WITHOUT `allow-same-origin`, and the CSP
 * below carries the same `sandbox allow-scripts` directive so the document
 * also gets an opaque origin when this URL is opened directly (a shared link,
 * "open frame in new tab") — without it, a report's script would run as the
 * Folio origin and could read storage and drive the app with the viewer's
 * session. The report cannot reach Folio's cookies, storage, or DOM either
 * way. `script-src 'unsafe-inline'` is acceptable only under that sandbox —
 * do not relax one without the other.
 *
 * A CSP sandbox is INTERSECTED with the iframe's sandbox attribute, so it must
 * carry `allow-popups allow-popups-to-escape-sandbox` too, or the iframe's
 * popup flags are cancelled and every report link is dead. Plain links are
 * sent to a new tab by an injected `<base target="_blank">`: navigating the
 * frame itself would be refused by the app's `frame-src` and blank the report
 * (see src/lib/analysis-report-document.ts).
 */

import { sessionAuthHeader } from "@/lib/api/auth-header";
import { env } from "@/lib/config/env";
import { errorDocument, requestLocale, withLinkShim } from "@/lib/analysis-report-document";

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
  // Opaque origin even on top-level navigation; scripts still run, as in the
  // sandboxed viewer iframe, and links may open new tabs. Never add
  // allow-same-origin or allow-top-navigation.
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
].join("; ");

const BASE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": REPORT_CSP,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  const { id: projectId, analysisId } = await params;
  const locale = requestLocale(request);
  const authHeaders = await sessionAuthHeader();

  const upstream = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId)}/content`;
  const pagePath = `/${locale}/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId)}`;
  const loginUrl = `/${locale}/login?callbackUrl=${encodeURIComponent(pagePath)}`;

  let response: Response;
  try {
    response = await fetch(upstream, {
      method: "GET",
      headers: { ...authHeaders },
      cache: "no-store",
    });
  } catch {
    return new Response(errorDocument(502, locale), { status: 502, headers: BASE_HEADERS });
  }

  if (!response.ok) {
    // Opened directly (a copied link, "open frame in new tab") while signed
    // out: go to the sign-in page, which returns to the analysis page. Inside
    // the viewer iframe the placeholder offers a sign-in link instead.
    if (response.status === 401 && request.headers.get("sec-fetch-dest") === "document") {
      return new Response(null, {
        status: 303,
        headers: { Location: loginUrl, "Cache-Control": "private, no-store" },
      });
    }
    return new Response(
      errorDocument(response.status, locale, response.status === 401 ? loginUrl : undefined),
      { status: response.status, headers: BASE_HEADERS }
    );
  }

  return new Response(withLinkShim(await response.text()), { status: 200, headers: BASE_HEADERS });
}
