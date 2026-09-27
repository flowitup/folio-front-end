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
    expect(sandboxOf(res)).toBe("sandbox allow-scripts");
  });

  it("sandboxes the error document too", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("", { status: 404 }));
    const res = await GET(new Request("http://app/analysis-report/p-1/a-1"), { params });

    expect(res.status).toBe(404);
    expect(sandboxOf(res)).toBe("sandbox allow-scripts");
  });

  it("next.config sets the same sandbox on the report path", () => {
    const config = readFileSync(resolve(__dirname, "../../../../../../next.config.ts"), "utf-8");
    const block = config.slice(config.indexOf("const analysisReportHeaders"));
    expect(block.slice(0, block.indexOf("];"))).toContain('"sandbox allow-scripts"');
  });
});
