/**
 * Tests for labor API client — phase 08 supplement_hours guard coverage
 *
 * Validates the defense-in-depth guards in logAttendance / updateAttendance
 * before the request hits the network layer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logAttendance, updateAttendance } from "../labor";

// Mock the http module so no real fetch occurs
vi.mock("../http", () => ({
  api: {
    post: vi.fn(),
    put: vi.fn(),
  },
}));

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
