/**
 * Tests for labor API client — phase 08 supplement_hours guard coverage + fetchLaborExport
 *
 * Validates the defense-in-depth guards in logAttendance / updateAttendance
 * before the request hits the network layer.
 * Also validates fetchLaborExport input guards, URL construction, blob handling,
 * Content-Disposition parsing, and non-2xx error path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logAttendance, updateAttendance, fetchLaborExport } from "../labor";
import { ApiError } from "../http";

// Mock the http module — keep ApiError + getApiAccessToken real; stub api methods
vi.mock("../http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../http")>();
  return {
    ...actual,
    api: {
      post: vi.fn(),
      put: vi.fn(),
    },
  };
});

import { api } from "../http";

const BASE_PAYLOAD = {
  worker_id: "worker-1",
  date: "2026-04-28",
};

// Minimal valid LaborEntry stub returned by mocked api.post
const STUB_ENTRY = {
  id: "entry-1",
  worker_id: "worker-1",
  worker_name: "Alice",
  date: "2026-04-28",
  shift_type: null,
  supplement_hours: 0,
  amount_override: null,
  effective_cost: 0,
  note: null,
  created_at: "2026-04-28T08:00:00Z",
};

describe("logAttendance — supplement_hours guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue(STUB_ENTRY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when supplement_hours is negative (-1)", async () => {
    await expect(
      logAttendance("proj-1", { ...BASE_PAYLOAD, shift_type: "full", supplement_hours: -1 })
    ).rejects.toThrow("supplement_hours must be an integer in [0, 12]");

    expect(api.post).not.toHaveBeenCalled();
  });

  it("throws when supplement_hours exceeds max (13)", async () => {
    await expect(
      logAttendance("proj-1", { ...BASE_PAYLOAD, shift_type: "full", supplement_hours: 13 })
    ).rejects.toThrow("supplement_hours must be an integer in [0, 12]");

    expect(api.post).not.toHaveBeenCalled();
  });

  it("throws when supplement_hours is a non-integer float (1.5)", async () => {
    await expect(
      logAttendance("proj-1", { ...BASE_PAYLOAD, shift_type: "full", supplement_hours: 1.5 })
    ).rejects.toThrow("supplement_hours must be an integer in [0, 12]");

    expect(api.post).not.toHaveBeenCalled();
  });

  it("throws when shift_type is null and supplement_hours is 0 (empty row)", async () => {
    await expect(
      logAttendance("proj-1", { ...BASE_PAYLOAD, shift_type: null, supplement_hours: 0 })
    ).rejects.toThrow("Either shift_type or supplement_hours must be set");

    expect(api.post).not.toHaveBeenCalled();
  });

  it("throws when shift_type is null and amount_override is set (override-without-shift)", async () => {
    await expect(
      logAttendance("proj-1", {
        ...BASE_PAYLOAD,
        shift_type: null,
        supplement_hours: 0,
        amount_override: 50,
      })
    ).rejects.toThrow();

    expect(api.post).not.toHaveBeenCalled();
  });

  it("succeeds when shift_type is null and supplement_hours is valid positive integer (standalone)", async () => {
    const result = await logAttendance("proj-1", {
      ...BASE_PAYLOAD,
      shift_type: null,
      supplement_hours: 5,
    });

    expect(api.post).toHaveBeenCalledOnce();
    expect(api.post).toHaveBeenCalledWith(
      "/projects/proj-1/labor-entries",
      expect.objectContaining({
        shift_type: null,
        supplement_hours: 5,
      })
    );
    expect(result).toEqual(STUB_ENTRY);
  });

  it("succeeds when shift_type is set and supplement_hours is valid (paired shift)", async () => {
    const result = await logAttendance("proj-1", {
      ...BASE_PAYLOAD,
      shift_type: "full",
      supplement_hours: 3,
    });

    expect(api.post).toHaveBeenCalledOnce();
    expect(api.post).toHaveBeenCalledWith(
      "/projects/proj-1/labor-entries",
      expect.objectContaining({
        shift_type: "full",
        supplement_hours: 3,
      })
    );
    expect(result).toEqual(STUB_ENTRY);
  });

  it("succeeds when supplement_hours is at boundary max (12)", async () => {
    await expect(
      logAttendance("proj-1", { ...BASE_PAYLOAD, shift_type: null, supplement_hours: 12 })
    ).resolves.toEqual(STUB_ENTRY);

    expect(api.post).toHaveBeenCalledOnce();
  });

  it("succeeds when supplement_hours is 0 and shift_type is set (no supplement, normal shift)", async () => {
    await expect(
      logAttendance("proj-1", { ...BASE_PAYLOAD, shift_type: "half", supplement_hours: 0 })
    ).resolves.toEqual(STUB_ENTRY);

    expect(api.post).toHaveBeenCalledOnce();
  });

  it("defaults supplement_hours to 0 when undefined and shift_type is set", async () => {
    await expect(
      logAttendance("proj-1", { ...BASE_PAYLOAD, shift_type: "full" })
    ).resolves.toEqual(STUB_ENTRY);

    expect(api.post).toHaveBeenCalledOnce();
  });

  it("includes supplement_hours in the request body payload", async () => {
    await logAttendance("proj-1", {
      ...BASE_PAYLOAD,
      shift_type: null,
      supplement_hours: 7,
    });

    const [, bodyArg] = vi.mocked(api.post).mock.calls[0];
    expect((bodyArg as Record<string, unknown>).supplement_hours).toBe(7);
  });
});

describe("updateAttendance — supplement_hours guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.put).mockResolvedValue(STUB_ENTRY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when supplement_hours is negative", async () => {
    await expect(
      updateAttendance("proj-1", "entry-1", { supplement_hours: -1 })
    ).rejects.toThrow("supplement_hours must be an integer in [0, 12]");

    expect(api.put).not.toHaveBeenCalled();
  });

  it("throws when supplement_hours exceeds max (13)", async () => {
    await expect(
      updateAttendance("proj-1", "entry-1", { supplement_hours: 13 })
    ).rejects.toThrow("supplement_hours must be an integer in [0, 12]");

    expect(api.put).not.toHaveBeenCalled();
  });

  it("throws when supplement_hours is a non-integer float", async () => {
    await expect(
      updateAttendance("proj-1", "entry-1", { supplement_hours: 2.5 })
    ).rejects.toThrow("supplement_hours must be an integer in [0, 12]");

    expect(api.put).not.toHaveBeenCalled();
  });

  it("succeeds when supplement_hours is valid (6)", async () => {
    const result = await updateAttendance("proj-1", "entry-1", { supplement_hours: 6 });

    expect(api.put).toHaveBeenCalledOnce();
    expect(result).toEqual(STUB_ENTRY);
  });

  it("succeeds when supplement_hours is undefined (field not being updated)", async () => {
    const result = await updateAttendance("proj-1", "entry-1", { note: "updated note" });

    expect(api.put).toHaveBeenCalledOnce();
    expect(result).toEqual(STUB_ENTRY);
  });

  it("succeeds when supplement_hours is 0 (clearing supplement)", async () => {
    const result = await updateAttendance("proj-1", "entry-1", { supplement_hours: 0 });

    expect(api.put).toHaveBeenCalledOnce();
    expect(result).toEqual(STUB_ENTRY);
  });
});

// ─── fetchLaborExport ─────────────────────────────────────────────────────────

describe("fetchLaborExport — input validation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global fetch mock
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when 'from' does not match YYYY-MM regex (year only)", async () => {
    await expect(
      fetchLaborExport("proj-1", { from: "2026", to: "2026-03" }, "xlsx")
    ).rejects.toThrow("Invalid 'from' month format");
  });

  it("throws when 'from' has an invalid month (13)", async () => {
    await expect(
      fetchLaborExport("proj-1", { from: "2026-13", to: "2026-03" }, "xlsx")
    ).rejects.toThrow("Invalid 'from' month format");
  });

  it("throws when from > to (reversed range)", async () => {
    await expect(
      fetchLaborExport("proj-1", { from: "2026-04", to: "2026-01" }, "xlsx")
    ).rejects.toThrow("'from' must be <= 'to'");
  });

  it("throws when span exceeds 24 months (25-month range)", async () => {
    // 2024-01 to 2026-02 = 25 months
    await expect(
      fetchLaborExport("proj-1", { from: "2024-01", to: "2026-02" }, "xlsx")
    ).rejects.toThrow("Range must be <= 24 months");
  });

  it("throws for invalid format (csv)", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional bad value for test
      fetchLaborExport("proj-1", { from: "2026-01", to: "2026-03" }, "csv" as any)
    ).rejects.toThrow("Invalid format 'csv'");
  });

  // No fetch calls should have been made for any guard-throw above
  it("does not call fetch when validation fails", async () => {
    await expect(
      fetchLaborExport("proj-1", { from: "2026-04", to: "2026-01" }, "xlsx")
    ).rejects.toThrow();

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe("fetchLaborExport — happy path (200 + Content-Disposition)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns { blob, filename } from Content-Disposition header and constructs correct URL", async () => {
    const fakeBlob = new Blob(["fake-xlsx-bytes"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const mockHeaders = new Headers({
      "Content-Disposition": 'attachment; filename="labor-foo-2026-01-to-2026-03.xlsx"',
    });

    const mockResponse = new Response(fakeBlob, {
      status: 200,
      headers: mockHeaders,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchLaborExport(
      "proj-1",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    );

    // Correct filename extracted from Content-Disposition
    expect(result.filename).toBe("labor-foo-2026-01-to-2026-03.xlsx");

    // Blob returned is the response blob.
    // Note: avoid toBeInstanceOf(Blob) — undici's fetch (used by Node CI runtime)
    // returns a Blob from undici/internal/blob.js whose constructor is a DIFFERENT
    // class identity than globalThis.Blob, causing toBeInstanceOf to fail in CI
    // even though the value is structurally a Blob. Verify by duck-typing instead.
    expect(typeof result.blob).toBe("object");
    expect(result.blob).not.toBeNull();
    expect(typeof (result.blob as Blob).size).toBe("number");
    expect(typeof (result.blob as Blob).type).toBe("string");

    // URL constructed with correct query params
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const url = fetchCall[0] as string;
    expect(url).toContain("from=2026-01");
    expect(url).toContain("to=2026-03");
    expect(url).toContain("format=xlsx");
    expect(url).toContain("proj-1");
    // URL-pinning: must not contain a doubled /api/v1 segment
    expect(url).toMatch(/^https?:\/\/.+\/projects\/[^/]+\/labor-export\?/);
    expect(url).not.toMatch(/api\/v1\/api\/v1/);
  });
});

describe("fetchLaborExport — missing Content-Disposition fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to timestamped default filename when Content-Disposition absent", async () => {
    const fakeBlob = new Blob(["bytes"]);
    const mockResponse = new Response(fakeBlob, { status: 200 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchLaborExport(
      "proj-1",
      { from: "2026-02", to: "2026-04" },
      "pdf"
    );

    // Fallback pattern: labor-export-{from}-to-{to}.{format}
    expect(result.filename).toBe("labor-export-2026-02-to-2026-04.pdf");
  });
});

describe("fetchLaborExport — non-2xx error path", () => {
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

    const err = await fetchLaborExport(
      "proj-1",
      { from: "2026-01", to: "2026-03" },
      "xlsx"
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).message).toContain("422");
  });
});
