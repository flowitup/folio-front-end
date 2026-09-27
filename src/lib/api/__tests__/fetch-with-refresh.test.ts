/**
 * fetchWithRefresh — cookie-authenticated download GETs retry once after a
 * token refresh, so an export clicked after the access token expired works.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithRefresh } from "../refresh";
import { fetchLaborExport } from "../labor";

function res(status: number, body = "", headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : body, { status, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithRefresh", () => {
  it("returns the first response when it is not a 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, "ok"));
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchWithRefresh("http://api/x");

    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("refreshes and retries once on 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200)) // POST /auth/refresh
      .mockResolvedValueOnce(res(200, "pdf-bytes"));
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchWithRefresh("http://api/x");

    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/refresh$/);
    expect(fetchMock.mock.calls[2][0]).toBe("http://api/x");
  });

  it("returns the 401 when the refresh fails, without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(401)); // refresh rejected
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchWithRefresh("http://api/x");

    expect(out.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fetchLaborExport — expired access token", () => {
  it("downloads the file after refreshing the session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200))
      .mockResolvedValueOnce(
        res(200, "%PDF", { "Content-Disposition": 'attachment; filename="labor.pdf"' }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchLaborExport("p1", { from: "2026-09", to: "2026-09" }, "pdf");

    expect(out.filename).toBe("labor.pdf");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
