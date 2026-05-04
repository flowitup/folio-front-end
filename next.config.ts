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

// Cloudflared edge + analytics origins. Add any additional first-party hosts here.
const cloudflareConnectOrigins = ["https://*.cloudflareaccess.com", "https://*.cloudflare.com"];

// CSP is intentionally shipped in report-only mode first so a stray inline
// style/script in prod cannot black-box the app. Flip to enforcing
// (Content-Security-Policy) after a week of clean reports — see TODO below.
function buildContentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next.js + Tailwind ship inline <style> tags. Strict-dynamic + nonces are
    // the long-term fix; for now we accept 'unsafe-inline' for styles only.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Inline + eval for HMR/dev-only; prod tightens to 'self' + inline (still
    // needed by Next.js' bootstrap script). nonces are the proper next step.
    "script-src": isProd
      ? ["'self'", "'unsafe-inline'"]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", apiOrigin, ...cloudflareConnectOrigins, ...(isProd ? [] : ["ws:", "wss:"])],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

const securityHeaders = [
  // TODO(security): after one week of clean CSP reports in prod, flip the key
  // below to "Content-Security-Policy" to enforce instead of report-only.
  { key: "Content-Security-Policy-Report-Only", value: buildContentSecurityPolicy() },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
    ];
  },
};

export default withNextIntl(nextConfig);
