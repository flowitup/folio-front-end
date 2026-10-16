/**
 * The API client tells the app layout when the session went stale under the user: a 403
 * (permissions changed since the page loaded) and a 401 the refresh token cannot fix
 * (account deactivated, session revoked).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../http";
import { onSessionEvent } from "@/lib/auth/session-events";

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("http session events", () => {
  const denied = vi.fn();
  const ended = vi.fn();
  let offs: (() => void)[] = [];

  beforeEach(() => {
    offs = [onSessionEvent("access-denied", denied), onSessionEvent("session-ended", ended)];
  });

  afterEach(() => {
    offs.forEach((off) => off());
    denied.mockReset();
    ended.mockReset();
    vi.unstubAllGlobals();
  });

  it("signals a 403 so the user and the project list are re-read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(403, { error: "Missing permission" })));
    await expect(api.get("/projects/p1/labor-entries/conflicts")).rejects.toBeInstanceOf(ApiError);
    expect(denied).toHaveBeenCalledTimes(1);
    expect(ended).not.toHaveBeenCalled();
  });

  it("signals the end of the session when the refresh token is refused", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/auth/refresh") ? response(401) : response(401, { msg: "Token has been revoked" })
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.get("/tasks")).rejects.toMatchObject({ status: 401 });
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the refresh only failed to reach the API", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/refresh")) throw new TypeError("Failed to fetch");
      return response(401);
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.get("/tasks")).rejects.toMatchObject({ status: 401 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/auth/refresh") ? response(503) : response(401)))
    );
    await expect(api.get("/tasks")).rejects.toMatchObject({ status: 401 });
    expect(ended).not.toHaveBeenCalled();
  });

  it("retries after a successful refresh without signalling anything", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/auth/refresh")) return response(200, {});
        calls += 1;
        return calls === 1 ? response(401) : response(200, { ok: true });
      })
    );
    await expect(api.get("/tasks")).resolves.toEqual({ ok: true });
    expect(ended).not.toHaveBeenCalled();
    expect(denied).not.toHaveBeenCalled();
  });
});
