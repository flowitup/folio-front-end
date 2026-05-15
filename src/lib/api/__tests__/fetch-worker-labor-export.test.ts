/**
 * Tests for fetchWorkerLaborExport — phase 05
 *
 * Covers: input validation guards (sync throws), URL construction,
 * Content-Disposition parsing, fallback filename, 422/404 ApiError paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWorkerLaborExport } from "../labor";
import { ApiError } from "../http";

// Mock the http module — keep ApiError + CSRF helpers real
vi.mock("../http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../http")>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

// ── Input validation guards ───────────────────────────────────────────────────

describe("fetchWorkerLaborExport — input validation guards (sync throws)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when 'from' does not match YYYY-MM (year only)", async () => {
    await expect(
      fetchWorkerLaborExport("proj-1", "worker-1", { from: "2026", to: "2026-03" }, "xlsx")
    ).rejects.toThrow("Invalid 'from' month format");
  });

  it("throws when 'from' has invalid month (13)", async () => {
    await expect(
      fetchWorkerLaborExport("proj-1", "worker-1", { from: "2026-13", to: "2026-03" }, "xlsx")
    ).rejects.toThrow("Invalid 'from' month format");
  });

  it("throws when 'to' does not match YYYY-MM (just a day)", async () => {
    await expect(
      fetchWorkerLaborExport("proj-1", "worker-1", { from: "2026-01", to: "2026-01-15" }, "xlsx")
    ).rejects.toThrow("Invalid 'to' month format");
  });

  it("throws when from > to (reversed range)", async () => {
    await expect(
      fetchWorkerLaborExport("proj-1", "worker-1", { from: "2026-04", to: "2026-01" }, "xlsx")
    ).rejects.toThrow("'from' must be <= 'to'");
  });

  it("throws when span exceeds 24 months (25-month range)", async () => {
    // 2024-01 to 2026-02 = 25 months
    await expect(
      fetchWorkerLaborExport("proj-1", "worker-1", { from: "2024-01", to: "2026-02" }, "xlsx")
    ).rejects.toThrow("Range must be <= 24 months");
  });

  it("throws for invalid format (csv)", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional bad value
      fetchWorkerLaborExport("proj-1", "worker-1", { from: "2026-01", to: "2026-03" }, "csv" as any)
    ).rejects.toThrow("Invalid format 'csv'");
  });

  it("does not call fetch when validation fails", async () => {
    await expect(
      fetchWorkerLaborExport("proj-1", "worker-1", { from: "2026-04", to: "2026-01" }, "xlsx")
    ).rejects.toThrow();

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

// ── URL construction ──────────────────────────────────────────────────────────

describe("fetchWorkerLaborExport — URL construction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("constructs URL with /workers/{workerId}/labor-export path and correct query params", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    await fetchWorkerLaborExport(
      "proj-abc",
      "worker-xyz",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    );

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const url = fetchCall[0] as string;

    expect(url).toContain("/projects/proj-abc/workers/worker-xyz/labor-export");
    expect(url).toContain("from=2026-01");
    expect(url).toContain("to=2026-03");
    expect(url).toContain("format=xlsx");
    // URL-pinning: must not contain a doubled /api/v1 segment
    expect(url).toMatch(/^https?:\/\/.+\/projects\/[^/]+\/workers\/[^/]+\/labor-export\?/);
    expect(url).not.toMatch(/api\/v1\/api\/v1/);
  });

  it("URL-encodes projectId and workerId with special characters", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    await fetchWorkerLaborExport(
      "proj/with space",
      "worker/with space",
      { from: "2026-01", to: "2026-01" },
      "pdf"
    );

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const url = fetchCall[0] as string;

    expect(url).toContain(encodeURIComponent("proj/with space"));
    expect(url).toContain(encodeURIComponent("worker/with space"));
  });
});

// ── Happy path — Content-Disposition ─────────────────────────────────────────

describe("fetchWorkerLaborExport — happy path xlsx with Content-Disposition", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns { blob, filename } with filename from CD header (quoted form)", async () => {
    const fakeBlob = new Blob(["fake-xlsx-bytes"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const mockResponse = new Response(fakeBlob, {
      status: 200,
      headers: {
        "Content-Disposition": 'attachment; filename="worker-alice-2026-01-to-2026-03.xlsx"',
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchWorkerLaborExport(
      "proj-1",
      "worker-1",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    );

    expect(result.filename).toBe("worker-alice-2026-01-to-2026-03.xlsx");
    // Duck-type blob check (undici vs globalThis.Blob class identity differs in CI)
    expect(typeof result.blob).toBe("object");
    expect(result.blob).not.toBeNull();
    expect(typeof (result.blob as Blob).size).toBe("number");
  });

  it("returns { blob, filename } with filename from CD header (RFC 5987 UTF-8 encoded)", async () => {
    const fakeBlob = new Blob(["fake-pdf-bytes"], { type: "application/pdf" });
    const encodedName = encodeURIComponent("worker-alice-dupont-2026-01.pdf");
    const mockResponse = new Response(fakeBlob, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchWorkerLaborExport(
      "proj-1",
      "worker-1",
      { from: "2026-01", to: "2026-01" },
      "pdf"
    );

    expect(result.filename).toBe("worker-alice-dupont-2026-01.pdf");
  });

  it("happy path pdf — returns blob and filename", async () => {
    const fakeBlob = new Blob(["pdf-bytes"], { type: "application/pdf" });
    const mockResponse = new Response(fakeBlob, {
      status: 200,
      headers: {
        "Content-Disposition": 'attachment; filename="report.pdf"',
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchWorkerLaborExport(
      "proj-2",
      "worker-2",
      { from: "2026-03", to: "2026-06" },
      "pdf"
    );

    expect(result.filename).toBe("report.pdf");
    expect(typeof result.blob).toBe("object");
  });
});

// ── Fallback filename ─────────────────────────────────────────────────────────

describe("fetchWorkerLaborExport — missing Content-Disposition fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to labor-export-{from}-to-{to}.{ext} when CD absent", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchWorkerLaborExport(
      "proj-1",
      "worker-1",
      { from: "2026-02", to: "2026-04" },
      "pdf"
    );

    expect(result.filename).toBe("labor-export-2026-02-to-2026-04.pdf");
  });

  it("falls back to xlsx extension when format=xlsx and CD absent", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchWorkerLaborExport(
      "proj-1",
      "worker-1",
      { from: "2026-01", to: "2026-01" },
      "xlsx"
    );

    expect(result.filename).toBe("labor-export-2026-01-to-2026-01.xlsx");
  });
});

// ── Error paths ───────────────────────────────────────────────────────────────

describe("fetchWorkerLaborExport — non-2xx error paths", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws ApiError with status=422 when server returns 422 with JSON body", async () => {
    const errorBody = { detail: "Unprocessable entity" };
    const mockResponse = new Response(JSON.stringify(errorBody), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const err = await fetchWorkerLaborExport(
      "proj-1",
      "worker-1",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).message).toContain("422");
  });

  it("throws ApiError with status=404 when worker not found", async () => {
    const errorBody = { detail: "worker_not_found" };
    const mockResponse = new Response(JSON.stringify(errorBody), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const err = await fetchWorkerLaborExport(
      "proj-1",
      "nonexistent-worker",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
  });

  it("ApiError carries the response body as .data", async () => {
    const errorBody = { detail: "span too large" };
    const mockResponse = new Response(JSON.stringify(errorBody), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const err = await fetchWorkerLaborExport(
      "proj-1",
      "worker-1",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).data).toMatchObject({ detail: "span too large" });
  });
});
