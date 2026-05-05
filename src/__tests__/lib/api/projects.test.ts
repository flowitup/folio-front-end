/**
 * Regression tests for projects API wrappers.
 *
 * Guards against updateProject/deleteProject calling wrong endpoints,
 * using wrong HTTP methods, or failing to pass parameters correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the http client before importing the modules under test
vi.mock("@/lib/api/http", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { updateProject, deleteProject } from "@/lib/api/projects";
import { api } from "@/lib/api/http";

const mockApi = vi.mocked(api);

describe("projects API wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("updateProject", () => {
    it("calls api.put with correct path and payload", async () => {
      const mockProject = {
        id: "p-1",
        name: "Updated Name",
        address: "12 New Street",
        owner_id: "u-1",
        user_count: 5,
        created_at: "2026-05-03T00:00:00Z",
      };

      mockApi.put.mockResolvedValueOnce(mockProject);

      const payload = { name: "Updated Name", address: "12 New Street" };
      const result = await updateProject("p-1", payload);

      expect(mockApi.put).toHaveBeenCalledOnce();
      expect(mockApi.put).toHaveBeenCalledWith("/projects/p-1", payload);
      expect(result).toEqual(mockProject);
    });

    it("sends null address when address is null", async () => {
      const mockProject = {
        id: "p-1",
        name: "Project",
        address: null,
        owner_id: "u-1",
        user_count: 0,
        created_at: "2026-05-03T00:00:00Z",
      };

      mockApi.put.mockResolvedValueOnce(mockProject);

      const payload = { name: "Project", address: null };
      await updateProject("p-1", payload);

      expect(mockApi.put).toHaveBeenCalledWith("/projects/p-1", payload);
    });

    it("returns the updated project from API response", async () => {
      const updated = {
        id: "p-xyz",
        name: "New Name",
        address: "123 St",
        owner_id: "u-1",
        user_count: 10,
        created_at: "2026-01-01T00:00:00Z",
      };

      mockApi.put.mockResolvedValueOnce(updated);

      const result = await updateProject("p-xyz", { name: "New Name", address: "123 St" });

      expect(result).toBe(updated);
    });

    it("rejects when api.put rejects", async () => {
      mockApi.put.mockRejectedValueOnce(new Error("API error"));

      await expect(updateProject("p-1", { name: "X", address: null })).rejects.toThrow("API error");
    });
  });

  describe("deleteProject", () => {
    it("calls api.delete with correct path", async () => {
      mockApi.delete.mockResolvedValueOnce(undefined);

      await deleteProject("p-1");

      expect(mockApi.delete).toHaveBeenCalledOnce();
      expect(mockApi.delete).toHaveBeenCalledWith("/projects/p-1");
    });

    it("rejects when api.delete rejects", async () => {
      mockApi.delete.mockRejectedValueOnce(new Error("Forbidden"));

      await expect(deleteProject("p-1")).rejects.toThrow("Forbidden");
    });
  });
});
