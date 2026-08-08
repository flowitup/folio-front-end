/**
 * Tests for LaborWorkerSelect
 *
 * Covers:
 * - No options load when projectId is absent
 * - Workers fetched and rendered as options on mount, display person_name ?? name
 * - Active workers sorted before inactive
 * - Empty option always reads "Not linked" (workerNotLinked)
 * - Selecting an option calls onChange with (id, worker)
 * - Selecting the empty option calls onChange with (null, null)
 * - Fetch error falls back to an empty options list (no crash)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { LaborWorkerSelect } from "../labor-worker-select";
import type { Worker } from "@/types/labor";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      workerNotLinked: "Not linked",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/lib/api/labor", () => ({
  fetchWorkers: vi.fn(),
}));

import { fetchWorkers } from "@/lib/api/labor";
const mockFetchWorkers = vi.mocked(fetchWorkers);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: "w-1",
    project_id: "proj-1",
    name: "Legacy Name",
    phone: null,
    daily_rate: 100,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("LaborWorkerSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch and shows only the 'Not linked' option when projectId is absent", async () => {
    render(<LaborWorkerSelect value={null} onChange={vi.fn()} />);

    expect(mockFetchWorkers).not.toHaveBeenCalled();
    const select = screen.getByTestId("labor-worker-select") as HTMLSelectElement;
    expect(select.options).toHaveLength(1);
    expect(select.options[0].textContent).toBe("Not linked");
  });

  it("fetches and renders workers, preferring person_name over name", async () => {
    mockFetchWorkers.mockResolvedValue([
      makeWorker({ id: "w-1", name: "Legacy Name", person_name: "Jean Dupont" }),
      makeWorker({ id: "w-2", name: "No Person Link", person_name: null }),
    ]);

    render(<LaborWorkerSelect projectId="proj-1" value={null} onChange={vi.fn()} />);

    await waitFor(() => expect(mockFetchWorkers).toHaveBeenCalledWith("proj-1"));

    const select = screen.getByTestId("labor-worker-select");
    await waitFor(() => {
      expect(within(select).getByText("Jean Dupont")).toBeDefined();
      expect(within(select).getByText("No Person Link")).toBeDefined();
    });
  });

  it("sorts active workers before inactive workers", async () => {
    mockFetchWorkers.mockResolvedValue([
      makeWorker({ id: "w-inactive", person_name: "Zed Inactive", is_active: false }),
      makeWorker({ id: "w-active", person_name: "Amy Active", is_active: true }),
    ]);

    render(<LaborWorkerSelect projectId="proj-1" value={null} onChange={vi.fn()} />);

    const select = screen.getByTestId("labor-worker-select") as HTMLSelectElement;
    await waitFor(() => expect(select.options).toHaveLength(3)); // "Not linked" + 2 workers

    // index 0 = "Not linked", index 1 should be the active worker
    expect(select.options[1].textContent).toBe("Amy Active");
    expect(select.options[2].textContent).toBe("Zed Inactive");
  });

  it("calls onChange with (id, worker) when a worker is selected", async () => {
    const worker = makeWorker({ id: "w-1", person_name: "Jean Dupont" });
    mockFetchWorkers.mockResolvedValue([worker]);
    const onChange = vi.fn();

    render(<LaborWorkerSelect projectId="proj-1" value={null} onChange={onChange} />);

    const select = await screen.findByTestId("labor-worker-select");
    await waitFor(() => expect(within(select).getByText("Jean Dupont")).toBeDefined());

    fireEvent.change(select, { target: { value: "w-1" } });

    expect(onChange).toHaveBeenCalledWith("w-1", worker);
  });

  it("calls onChange with (null, null) when 'Not linked' is selected", async () => {
    mockFetchWorkers.mockResolvedValue([makeWorker({ id: "w-1", person_name: "Jean Dupont" })]);
    const onChange = vi.fn();

    render(<LaborWorkerSelect projectId="proj-1" value="w-1" onChange={onChange} />);

    const select = await screen.findByTestId("labor-worker-select");
    await waitFor(() => expect(within(select).getByText("Jean Dupont")).toBeDefined());

    fireEvent.change(select, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it("falls back to an empty options list when the fetch rejects", async () => {
    mockFetchWorkers.mockRejectedValue(new Error("network down"));

    render(<LaborWorkerSelect projectId="proj-1" value={null} onChange={vi.fn()} />);

    await waitFor(() => expect(mockFetchWorkers).toHaveBeenCalled());

    const select = screen.getByTestId("labor-worker-select") as HTMLSelectElement;
    await waitFor(() => expect(select.options).toHaveLength(1));
    expect(select.options[0].textContent).toBe("Not linked");
  });
});
