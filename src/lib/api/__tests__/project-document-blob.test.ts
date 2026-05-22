import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchProjectDocumentBlob, downloadProjectDocument } from "../project-document-blob";

vi.mock("../http", () => ({
  getCsrfToken: vi.fn(),
}));

vi.mock("../refresh", () => ({
  refreshAccessTokenViaCookie: vi.fn(),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://api.test/api/v1" },
}));

import { getCsrfToken } from "../http";
import { refreshAccessTokenViaCookie } from "../refresh";

// ---- Helpers ----

function makeOkResponse(body: string, contentType = "application/pdf") {
  const blob = new Blob([body], { type: contentType });
  return new Response(blob, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

function makeErrorResponse(status: number, body = "") {
  return new Response(body, { status });
}

// ---- Setup ----

beforeEach(() => {
  vi.mocked(getCsrfToken).mockReturnValue(null);
  vi.mocked(refreshAccessTokenViaCookie).mockResolvedValue(false);

  vi.stubGlobal("URL", {
    createObjectURL: vi.fn().mockReturnValue("blob:fake-url"),
    revokeObjectURL: vi.fn(),
  });

  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// ── fetchProjectDocumentBlob ──────────────────────────────────────────────────

describe("fetchProjectDocumentBlob", () => {
  it("builds correct URL with encoded projectId and docId", async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse("pdf-bytes"));

    await fetchProjectDocumentBlob("proj/special", "doc&id");

    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/v1/projects/proj%2Fspecial/documents/doc%26id/download",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends credentials include for cookie auth", async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse("pdf-bytes"));

    await fetchProjectDocumentBlob("proj-1", "doc-1");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("does not include X-CSRF-TOKEN header when csrf is null", async () => {
    vi.mocked(getCsrfToken).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(makeOkResponse("pdf-bytes"));

    await fetchProjectDocumentBlob("proj-1", "doc-1");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-CSRF-TOKEN"]).toBeUndefined();
  });

  it("includes X-CSRF-TOKEN header when csrf cookie is present", async () => {
    vi.mocked(getCsrfToken).mockReturnValue("csrf-value");
    vi.mocked(fetch).mockResolvedValue(makeOkResponse("pdf-bytes"));

    await fetchProjectDocumentBlob("proj-1", "doc-1");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-CSRF-TOKEN"]).toBe("csrf-value");
  });

  it("retries after 401 when refresh succeeds", async () => {
    vi.mocked(refreshAccessTokenViaCookie).mockResolvedValue(true);
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeErrorResponse(401))
      .mockResolvedValueOnce(makeOkResponse("pdf-bytes"));

    const result = await fetchProjectDocumentBlob("proj-1", "doc-1");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(refreshAccessTokenViaCookie).toHaveBeenCalledTimes(1);
    expect(result.objectUrl).toBe("blob:fake-url");
  });

  it("throws fetch_failed on 401 when refresh fails", async () => {
    vi.mocked(refreshAccessTokenViaCookie).mockResolvedValue(false);
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(401, "Unauthorized"));

    await expect(fetchProjectDocumentBlob("proj-1", "doc-1")).rejects.toThrow(
      "fetch_failed:401",
    );
  });

  it("throws fetch_failed:<status> on 403", async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(403, "Forbidden"));

    await expect(fetchProjectDocumentBlob("proj-1", "doc-1")).rejects.toThrow(
      "fetch_failed:403",
    );
  });

  it("throws fetch_failed:<status> on 500", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeErrorResponse(500, "Internal Server Error"),
    );

    await expect(fetchProjectDocumentBlob("proj-1", "doc-1")).rejects.toThrow(
      "fetch_failed:500",
    );
  });

  it("returns objectUrl and contentType on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeOkResponse("pdf-bytes", "application/pdf"),
    );

    const result = await fetchProjectDocumentBlob("proj-1", "doc-1");

    expect(result.objectUrl).toBe("blob:fake-url");
    expect(result.contentType).toBe("application/pdf");
    expect(typeof result.revoke).toBe("function");
  });

  it("defaults contentType to application/octet-stream when content-type header is absent", async () => {
    const res = new Response(new Blob(["data"]), {
      status: 200,
      headers: { "content-type": "" },
    });
    vi.spyOn(res.headers, "get").mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(res);

    const result = await fetchProjectDocumentBlob("proj-1", "doc-1");

    expect(result.contentType).toBe("application/octet-stream");
  });

  it("revoke() calls URL.revokeObjectURL with the object URL", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeOkResponse("img-bytes", "image/png"),
    );

    const result = await fetchProjectDocumentBlob("proj-1", "doc-1");
    result.revoke();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("passes AbortSignal to fetch", async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse("pdf-bytes"));
    const controller = new AbortController();

    await fetchProjectDocumentBlob("proj-1", "doc-1", controller.signal);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

// ── downloadProjectDocument ───────────────────────────────────────────────────

describe("downloadProjectDocument", () => {
  beforeEach(() => {
    vi.stubGlobal("setTimeout", (fn: () => void) => fn());
  });

  it("creates and clicks a transient <a> element with correct attributes", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeOkResponse("pdf-bytes", "application/pdf"),
    );

    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => document.body);

    await downloadProjectDocument("proj-1", "doc-1", "report.pdf");

    const anchor = appendChildSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.tagName.toLowerCase()).toBe("a");
    expect(anchor.href).toContain("blob:fake-url");
    expect(anchor.download).toBe("report.pdf");

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("revokes the object URL after download", async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse("pdf-bytes"));
    vi.spyOn(document.body, "appendChild");
    vi.spyOn(document.body, "removeChild").mockImplementation(
      () => document.body,
    );

    await downloadProjectDocument("proj-1", "doc-1", "report.pdf");

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("propagates fetch errors to the caller", async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(403));

    await expect(
      downloadProjectDocument("proj-1", "doc-1", "report.pdf"),
    ).rejects.toThrow("fetch_failed:403");
  });
});
