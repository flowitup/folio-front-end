/**
 * Tests for fetchInvoiceExport — phase 04
 *
 * Covers: input validation guards (sync throws), URL construction,
 * Content-Disposition parsing, fallback filename, 422/404 ApiError paths,
 * optional type filter query param.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchInvoiceExport } from "../invoice-api";
import { ApiError } from "../http";

// Mock the http module — keep ApiError + getApiAccessToken real
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

describe("fetchInvoiceExport — input validation guards (sync throws)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when projectId is empty string", async () => {
    await expect(
      fetchInvoiceExport("", { from: "2026-01", to: "2026-03" }, "xlsx")
    ).rejects.toThrow("projectId is required");
  });

  it("throws when 'from' does not match YYYY-MM (year only)", async () => {
    await expect(
      fetchInvoiceExport("proj-1", { from: "2026", to: "2026-03" }, "xlsx")
    ).rejects.toThrow("Invalid 'from' month format");
  });

  it("throws when 'from' has invalid month (13)", async () => {
    await expect(
      fetchInvoiceExport("proj-1", { from: "2026-13", to: "2026-03" }, "xlsx")
    ).rejects.toThrow("Invalid 'from' month format");
  });

  it("throws when 'to' does not match YYYY-MM (day-level precision)", async () => {
    await expect(
      fetchInvoiceExport("proj-1", { from: "2026-01", to: "2026-01-15" }, "xlsx")
    ).rejects.toThrow("Invalid 'to' month format");
  });

  it("throws when 'to' has invalid month (00)", async () => {
    await expect(
      fetchInvoiceExport("proj-1", { from: "2026-01", to: "2026-00" }, "xlsx")
    ).rejects.toThrow("Invalid 'to' month format");
  });

  it("throws when from > to (reversed range)", async () => {
    await expect(
      fetchInvoiceExport("proj-1", { from: "2026-04", to: "2026-01" }, "xlsx")
    ).rejects.toThrow("'from' must be <= 'to'");
  });

  it("throws for invalid format (csv)", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional bad value
      fetchInvoiceExport("proj-1", { from: "2026-01", to: "2026-03" }, "csv" as any)
    ).rejects.toThrow("Invalid format 'csv'");
  });

  it("does not call fetch when validation fails", async () => {
    await expect(
      fetchInvoiceExport("proj-1", { from: "2026-04", to: "2026-01" }, "xlsx")
    ).rejects.toThrow();

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

// ── URL construction ──────────────────────────────────────────────────────────

describe("fetchInvoiceExport — URL construction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("constructs URL with /invoices-export path and correct query params", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    await fetchInvoiceExport("proj-abc", { from: "2026-01", to: "2026-03" }, "xlsx");

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const url = fetchCall[0] as string;

    expect(url).toContain("/projects/proj-abc/invoices-export");
    expect(url).toContain("from=2026-01");
    expect(url).toContain("to=2026-03");
    expect(url).toContain("format=xlsx");
  });

  it("includes optional type param when typeFilter is provided", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    await fetchInvoiceExport("proj-abc", { from: "2026-01", to: "2026-03" }, "xlsx", "client");

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const url = fetchCall[0] as string;

    expect(url).toContain("type=client");
  });

  it("omits type param when typeFilter is undefined", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    await fetchInvoiceExport("proj-abc", { from: "2026-01", to: "2026-03" }, "pdf", undefined);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const url = fetchCall[0] as string;

    expect(url).not.toContain("type=");
  });

  it("URL-encodes projectId with special characters", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    await fetchInvoiceExport("proj/with space", { from: "2026-01", to: "2026-01" }, "pdf");

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const url = fetchCall[0] as string;

    expect(url).toContain(encodeURIComponent("proj/with space"));
  });

  it("constructs correct URL for all three type filters", async () => {
    for (const typeFilter of ["client", "labor", "supplier"] as const) {
      const fakeBlob = new Blob(["bytes"]);
      const mockResponse = new Response(fakeBlob, { status: 200 });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await fetchInvoiceExport("proj-1", { from: "2026-01", to: "2026-03" }, "xlsx", typeFilter);

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const url = fetchCall[0] as string;
      expect(url).toContain(`type=${typeFilter}`);

      vi.unstubAllGlobals();
    }
  });
});

// ── Happy path — Content-Disposition ─────────────────────────────────────────

describe("fetchInvoiceExport — happy path with Content-Disposition", () => {
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
        "Content-Disposition": 'attachment; filename="invoices-2026-01-to-2026-03.xlsx"',
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchInvoiceExport("proj-1", { from: "2026-01", to: "2026-03" }, "xlsx");

    expect(result.filename).toBe("invoices-2026-01-to-2026-03.xlsx");
    // Duck-type blob check (undici vs globalThis.Blob class identity differs in CI)
    expect(typeof result.blob).toBe("object");
    expect(result.blob).not.toBeNull();
    expect(typeof (result.blob as Blob).size).toBe("number");
  });

  it("returns { blob, filename } with filename from CD header (RFC 5987 UTF-8 encoded)", async () => {
    const fakeBlob = new Blob(["fake-pdf-bytes"], { type: "application/pdf" });
    const encodedName = encodeURIComponent("invoices-société-2026-01.pdf");
    const mockResponse = new Response(fakeBlob, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchInvoiceExport("proj-1", { from: "2026-01", to: "2026-01" }, "pdf");

    expect(result.filename).toBe("invoices-société-2026-01.pdf");
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

    const result = await fetchInvoiceExport("proj-2", { from: "2026-03", to: "2026-06" }, "pdf");

    expect(result.filename).toBe("report.pdf");
    expect(typeof result.blob).toBe("object");
  });
});

// ── Fallback filename ─────────────────────────────────────────────────────────

describe("fetchInvoiceExport — missing Content-Disposition fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to invoices-{from}-to-{to}.{ext} when CD absent", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchInvoiceExport("proj-1", { from: "2026-02", to: "2026-04" }, "pdf");

    expect(result.filename).toBe("invoices-2026-02-to-2026-04.pdf");
  });

  it("falls back to xlsx extension when format=xlsx and CD absent", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchInvoiceExport("proj-1", { from: "2026-01", to: "2026-01" }, "xlsx");

    expect(result.filename).toBe("invoices-2026-01-to-2026-01.xlsx");
  });
});

// ── Error paths ───────────────────────────────────────────────────────────────

describe("fetchInvoiceExport — non-2xx error paths", () => {
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

    const err = await fetchInvoiceExport(
      "proj-1",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).message).toContain("422");
  });

  it("throws ApiError with status=404 when project not found", async () => {
    const errorBody = { detail: "project_not_found" };
    const mockResponse = new Response(JSON.stringify(errorBody), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const err = await fetchInvoiceExport(
      "nonexistent-project",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
  });

  it("ApiError carries the response body as .data", async () => {
    const errorBody = { detail: "export_range_too_large" };
    const mockResponse = new Response(JSON.stringify(errorBody), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const err = await fetchInvoiceExport(
      "proj-1",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).data).toMatchObject({ detail: "export_range_too_large" });
  });
});
