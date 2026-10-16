/**
 * The analysis-report proxy serves uploaded, untrusted HTML from the Folio
 * origin. Opened directly (not in the sandboxed viewer iframe) its scripts ran
 * as Folio and could read storage and drive the app with the viewer's
 * session. Every response must carry a CSP `sandbox` (without
 * allow-same-origin) so the document always gets an opaque origin.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer t" }),
}));
vi.mock("@/lib/config/env", () => ({ env: { apiBaseUrl: "http://api/api/v1" } }));

import { GET } from "../route";

const params = Promise.resolve({ id: "p-1", analysisId: "a-1" });
const SANDBOX = "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox";

function sandboxOf(res: Response): string | undefined {
  return res.headers
    .get("Content-Security-Policy")
    ?.split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("sandbox"));
}

describe("analysis-report proxy route", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("serves the report sandboxed: scripts allowed, never same-origin", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("<script>document.cookie</script>", { status: 200 })
    );
    const res = await GET(new Request("http://app/analysis-report/p-1/a-1"), { params });

    expect(res.status).toBe(200);
    expect(sandboxOf(res)).toBe(SANDBOX);
  });

  it("sandboxes the error document too", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("", { status: 404 }));
    const res = await GET(new Request("http://app/analysis-report/p-1/a-1"), { params });

    expect(res.status).toBe(404);
    expect(sandboxOf(res)).toBe(SANDBOX);
  });

  it("next.config sets the same sandbox on the report path", () => {
    const config = readFileSync(resolve(__dirname, "../../../../../../next.config.ts"), "utf-8");
    const block = config.slice(config.indexOf("const analysisReportHeaders"));
    expect(block.slice(0, block.indexOf("];"))).toContain(`"${SANDBOX}"`);
  });

  it("opens plain report links in a new tab and keeps in-page anchors", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('<html><head><title>R</title></head><body><a href="https://x">x</a></body></html>', {
        status: 200,
      })
    );
    const res = await GET(new Request("http://app/analysis-report/p-1/a-1"), { params });
    const html = await res.text();
    expect(html.startsWith('<html><head><base target="_blank"><script>')).toBe(true);
    expect(html).toContain("'_self'");
    expect(html).toContain('<a href="https://x">x</a>');
  });

  it("localizes the error document from the NEXT_LOCALE cookie, then Accept-Language", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("", { status: 404 }));
    const fr = await GET(
      new Request("http://app/analysis-report/p-1/a-1", {
        headers: { cookie: "a=b; NEXT_LOCALE=fr", "accept-language": "vi" },
      }),
      { params }
    );
    expect(await fr.text()).toContain("Ce rapport n'est plus disponible.");

    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("", { status: 403 }));
    const vi_ = await GET(
      new Request("http://app/analysis-report/p-1/a-1", {
        headers: { "accept-language": "vi-VN,vi;q=0.9" },
      }),
      { params }
    );
    expect(await vi_.text()).toContain("Bạn không có quyền xem báo cáo này.");
  });

  it("sends a signed-out direct visit to the sign-in page, back to the analysis page", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("", { status: 401 }));
    const res = await GET(
      new Request("http://app/analysis-report/p-1/a-1", {
        headers: { cookie: "NEXT_LOCALE=fr", "sec-fetch-dest": "document" },
      }),
      { params }
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe(
      `/fr/login?callbackUrl=${encodeURIComponent("/fr/projects/p-1/analyses/a-1")}`
    );
  });

  it("offers a sign-in link inside the viewer frame when the session expired", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("", { status: 401 }));
    const res = await GET(
      new Request("http://app/analysis-report/p-1/a-1", {
        headers: { cookie: "NEXT_LOCALE=en", "sec-fetch-dest": "iframe" },
      }),
      { params }
    );
    expect(res.status).toBe(401);
    const html = await res.text();
    expect(html).toContain("Sign in");
    expect(html).toContain("/en/login?callbackUrl=");
  });
});
