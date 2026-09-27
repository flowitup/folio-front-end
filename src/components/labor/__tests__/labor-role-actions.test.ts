/**
 * Labor-role server actions: rename / recolor / delete, and the company scope
 * the Settings card passes to list and create.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const api = vi.hoisted(() => ({
  fetchLaborRoles: vi.fn(),
  createLaborRole: vi.fn(),
  updateLaborRole: vi.fn(),
  deleteLaborRole: vi.fn(),
}));

vi.mock("@/lib/api/labor-roles", () => api);
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import {
  createLaborRoleAction,
  deleteLaborRoleAction,
  fetchLaborRolesAction,
  updateLaborRoleAction,
} from "../labor-role-actions";

/** The error shape `buildHttpError` throws. */
function httpError(status: number, body: { error?: string; message?: string } | null) {
  return Object.assign(new Error(`HTTP ${status}`), { status, body });
}

const ROLE = {
  id: "r1",
  name: "Chef d'équipe",
  color: "#0EA5E9",
  created_at: "2026-01-01T00:00:00Z",
  slug: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateLaborRoleAction", () => {
  it("sends only the fields given, trimmed", async () => {
    api.updateLaborRole.mockResolvedValue(ROLE);

    const result = await updateLaborRoleAction("r1", { name: "  Chef d'équipe  " });

    expect(api.updateLaborRole).toHaveBeenCalledWith("r1", { name: "Chef d'équipe" });
    expect(result).toEqual({ success: true, role: ROLE });
  });

  it("refuses an empty edit without calling the backend", async () => {
    expect(await updateLaborRoleAction("r1", {})).toEqual({ success: false, error: "validation" });
    expect(await updateLaborRoleAction("r1", { name: "   " })).toEqual({
      success: false,
      error: "validation",
    });
    expect(api.updateLaborRole).not.toHaveBeenCalled();
  });

  it("classifies the failure and keeps the backend's message", async () => {
    api.updateLaborRole.mockRejectedValue(
      httpError(409, { error: "Conflict", message: "A labor role named 'X' already exists" })
    );

    expect(await updateLaborRoleAction("r1", { name: "X" })).toEqual({
      success: false,
      error: "duplicate",
      message: "A labor role named 'X' already exists",
    });
  });
});

describe("deleteLaborRoleAction", () => {
  it("reports success on a 204", async () => {
    api.deleteLaborRole.mockResolvedValue(undefined);

    expect(await deleteLaborRoleAction("r1")).toEqual({ success: true });
    expect(api.deleteLaborRole).toHaveBeenCalledWith("r1");
  });

  it("reports a 403 as forbidden", async () => {
    api.deleteLaborRole.mockRejectedValue(
      httpError(403, { error: "Forbidden", message: "Company admin or manager permission required" })
    );

    const result = await deleteLaborRoleAction("r1");

    expect(result).toMatchObject({ success: false, error: "forbidden" });
  });

  it("survives a non-JSON error body", async () => {
    api.deleteLaborRole.mockRejectedValue(httpError(500, null));

    expect(await deleteLaborRoleAction("r1")).toEqual({
      success: false,
      error: "generic",
      message: undefined,
    });
  });
});

describe("company scope", () => {
  it("passes the company id through to list and create", async () => {
    api.fetchLaborRoles.mockResolvedValue({ roles: [], palette: [] });
    api.createLaborRole.mockResolvedValue(ROLE);

    await fetchLaborRolesAction("c2");
    await createLaborRoleAction({ name: " Chef d'équipe ", color: "#0EA5E9" }, "c2");

    expect(api.fetchLaborRoles).toHaveBeenCalledWith("c2");
    expect(api.createLaborRole).toHaveBeenCalledWith(
      { name: "Chef d'équipe", color: "#0EA5E9" },
      "c2"
    );
  });

  it("leaves the scope to the backend (primary company) when none is given", async () => {
    api.fetchLaborRoles.mockResolvedValue({ roles: [], palette: [] });

    await fetchLaborRolesAction();

    expect(api.fetchLaborRoles).toHaveBeenCalledWith(undefined);
  });
});
