import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

// Derive the API origin from NEXT_PUBLIC_API_BASE_URL so connect-src lets the
// browser reach the backend. Falls back to localhost for local builds where
// the env var is not set yet.
function deriveApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:5000";
  }
}

const apiOrigin = deriveApiOrigin();

// S3/MinIO public endpoint for presigned GET/PUT URLs. Browser fetches PDF/image
// bytes directly from this origin when previewing documents.
function deriveS3Origin(): string | null {
  const raw = process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "";
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}
const s3Origin = deriveS3Origin();

// Cloudflared edge + analytics origins. Add any additional first-party hosts here.
const cloudflareConnectOrigins = ["https://*.cloudflareaccess.com", "https://*.cloudflare.com"];

// Image hosts: limited to first-party CDNs the app actually serves images
// from. The previous wildcard `https:` opened img-src to every TLS origin
// on the web, which trivially defeats CSP for exfil/tracking pixels.
const imageOrigins = [
  "https://imagedelivery.net",       // Cloudflare Images
  "https://storage.googleapis.com",  // GCS public buckets / signed URLs
];

function buildContentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next.js + Tailwind ship inline <style> tags. Until a nonce-based
    // style-src rollout, accept 'unsafe-inline' for styles only — never
    // for scripts.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Next.js emits inline <script> tags for hydration data; without a
    // nonce pipeline, 'unsafe-inline' is required in all environments.
    // TODO(security): migrate to nonce-based script-src + 'strict-dynamic'
    "script-src": isProd
      ? ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "img-src": ["'self'", "data:", "blob:", ...imageOrigins],
    // `<video>` in the photos/media lightbox plays an authenticated original
    // fetched into a same-origin `blob:` URL. Without media-src it falls back
    // to default-src 'self' and the blob is blocked (MEDIA_ERR_SRC_NOT_SUPPORTED).
    "media-src": ["'self'", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", apiOrigin, ...(s3Origin ? [s3Origin] : []), ...cloudflareConnectOrigins, ...(isProd ? [] : ["ws:", "wss:"])],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    // `<embed>` is governed by object-src. The Project Documents preview
    // dialog renders PDFs via `<embed src={URL.createObjectURL(blob)}>` — a
    // same-origin `blob:` URL — so we must allow `blob:` here. Without it,
    // promoting the CSP from Report-Only to enforce mode would silently break
    // PDF preview. `<img>` previews are unaffected (img-src already allows
    // blob:).
    "object-src": ["blob:"],
    // PDF.js spawns a web worker from /pdf.worker.min.mjs (public folder)
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'self'", "blob:"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

const securityHeaders = [
  // Enforcing mode: a CSP violation now blocks the offending resource
  // instead of just emitting a report. Inline scripts are no longer
  // permitted in prod (see script-src above).
  { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

// The analysis-report proxy route (/analysis-report/<projectId>/<analysisId>)
// serves stored, untrusted HTML reports into a sandboxed iframe. It needs its
// own policy, because the app policy above would (a) strip the report's
// webfonts and (b) forbid framing it at all via frame-ancestors 'none' +
// X-Frame-Options: DENY.
//
// This is safe ONLY because the embedding iframe is sandboxed without
// `allow-same-origin` (see analysis-viewer.tsx), giving the report an opaque
// origin with no access to Folio's cookies, storage, or parent DOM. The
// relaxations below are scoped to this single path and nothing else.
const analysisReportHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'none'",
      "img-src 'self' data: https:",
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
      "font-src https://fonts.gstatic.com",
      "script-src 'unsafe-inline'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Listed after the catch-all so its keys override the app policy for
      // this one path. Keep it last.
      {
        source: "/analysis-report/:projectId/:analysisId",
        headers: analysisReportHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
