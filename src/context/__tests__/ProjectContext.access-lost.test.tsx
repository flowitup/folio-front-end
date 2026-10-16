/**
 * QA3 permissions-roles-05: a user removed from the project they are looking at learns it on
 * the next reload of the list, instead of keeping a dead project selected.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { ApiError } from "@/lib/api/http";

const projectA = { id: "aaa", name: "Project A", address: null, owner_id: "o", user_count: 1, created_at: "2024-01-01" };
const projectB = { id: "bbb", name: "Project B", address: null, owner_id: "o", user_count: 1, created_at: "2024-01-02" };

const mockFetchProjects = vi.fn();
const mockFetchProjectById = vi.fn();
vi.mock("@/lib/api/projects", () => ({
  fetchProjects: () => mockFetchProjects(),
  fetchProjectById: (id: string) => mockFetchProjectById(id),
}));

let mockPathname = "/fr/projects/bbb/planning";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { ProjectProvider, useProject } from "../ProjectContext";

const handle: { current: ReturnType<typeof useProject> | null } = { current: null };
function Consumer() {
  const ctx = useProject();
  useEffect(() => {
    handle.current = ctx;
  });
  return (
    <div>
      <span data-testid="count">{ctx.projects.length}</span>
      <span data-testid="loading">{ctx.isLoading ? "loading" : "loaded"}</span>
      <span data-testid="lost">{ctx.accessLostProjectId ?? "none"}</span>
    </div>
  );
}

function renderProvider() {
  return render(
    <ProjectProvider>
      <Consumer />
    </ProjectProvider>
  );
}

describe("ProjectContext access lost", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/fr/projects/bbb/planning";
  });

  afterEach(() => {
    vi.clearAllMocks();
    handle.current = null;
  });

  it("flags the page's project when a reload drops it and the API refuses it", async () => {
    mockFetchProjects.mockResolvedValueOnce([projectA, projectB]);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    mockFetchProjects.mockResolvedValueOnce([projectA]);
    mockFetchProjectById.mockRejectedValueOnce(new ApiError("HTTP 403", 403));
    await act(async () => {
      await handle.current!.refetch({ silent: true });
    });

    await waitFor(() => expect(screen.getByTestId("lost")).toHaveTextContent("bbb"));
    act(() => handle.current!.clearAccessLost());
    expect(screen.getByTestId("lost")).toHaveTextContent("none");
  });

  it("does not flag a link to a project the user never had", async () => {
    mockFetchProjects.mockResolvedValue([projectA]);
    mockFetchProjectById.mockRejectedValue(new ApiError("HTTP 404", 404));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("loaded"));
    await waitFor(() => expect(mockFetchProjectById).toHaveBeenCalledWith("bbb"));
    expect(screen.getByTestId("lost")).toHaveTextContent("none");
  });

  it("does not flag a project that only failed to load (network, 5xx)", async () => {
    mockFetchProjects.mockResolvedValueOnce([projectA, projectB]);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    mockFetchProjects.mockResolvedValueOnce([projectA]);
    mockFetchProjectById.mockRejectedValueOnce(new ApiError("HTTP 502", 502));
    await act(async () => {
      await handle.current!.refetch({ silent: true });
    });
    await waitFor(() => expect(mockFetchProjectById).toHaveBeenCalled());
    expect(screen.getByTestId("lost")).toHaveTextContent("none");
  });

  it("keeps the same list object when a reload returns the same projects", async () => {
    mockFetchProjects.mockResolvedValue([projectA, projectB]);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    const before = handle.current!.projects;
    await act(async () => {
      await handle.current!.refetch({ silent: true });
    });
    expect(handle.current!.projects).toBe(before);
  });
});
