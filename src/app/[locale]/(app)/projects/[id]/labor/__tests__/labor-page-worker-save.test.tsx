/**
 * LaborPage — adding or editing a worker.
 *
 * A failed save must reach AddWorkerDialog (the promise rejects) so the
 * dialog stays open with the typed values and its own error, instead of the
 * page swallowing it into a banner that sticks on every tab. A successful
 * save confirms with a toast. A page-level banner clears on a tab change.
 * Heavy tab bodies are mocked out; the dialog and worker-list mocks expose
 * the callbacks the page hands them.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LaborPageClient } from "../labor-page-client";
import { ApiError } from "@/lib/api/http";
import type { Worker } from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1" }),
  usePathname: () => "/en/projects/proj-1/labor",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const { WORKERS } = vi.hoisted(() => ({
  WORKERS: [
    {
      id: "worker-1",
      project_id: "proj-1",
      name: "Jean Dupont",
      phone: null,
      daily_rate: 150,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ] as Worker[],
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: { permissions: ["project:manage_labor"] } })),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ projects: [{ id: "proj-1", my_permissions: [] }] }),
}));

vi.mock("@/lib/api/labor", () => ({
  fetchWorkers: vi.fn().mockResolvedValue(WORKERS),
  createWorker: vi.fn(),
  updateWorker: vi.fn(),
  deleteWorker: vi.fn(),
  reactivateWorker: vi.fn(),
  fetchLaborEntries: vi.fn().mockResolvedValue([]),
  updateAttendance: vi.fn(),
  deleteAttendance: vi.fn(),
  fetchLaborSummary: vi.fn().mockResolvedValue({
    rows: [],
    total_days: 0,
    total_cost: 0,
    total_banked_hours: 0,
    total_bonus_days: 0,
    total_bonus_cost: 0,
  }),
  fetchLaborMonthlySummary: vi.fn().mockResolvedValue({ rows: [] }),
  fetchLaborPaymentsSummary: vi.fn().mockResolvedValue({ months: [] }),
  fetchLaborActivities: vi.fn().mockResolvedValue([]),
  createLaborActivity: vi.fn(),
  updateLaborActivity: vi.fn(),
  deleteLaborActivity: vi.fn(),
  fetchLaborDayDescriptions: vi.fn().mockResolvedValue([]),
  setLaborDayDescription: vi.fn(),
}));

vi.mock("@/components/labor/labor-role-actions", () => ({
  fetchLaborRolesAction: vi.fn().mockResolvedValue({ success: true, data: { roles: [], palette: [] } }),
}));
vi.mock("../actions", () => ({
  fetchAttendanceChangeRequestsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock("@/components/labor/add-worker-dialog", async () => {
  const { useState } = await import("react");
  return {
    // Two instances render: add (editWorker undefined) and edit (null until
    // a worker is picked). Each exposes a save button and the outcome.
    AddWorkerDialog: (props: {
      open: boolean;
      editWorker?: Worker | null;
      onSave: (payload: { name: string }) => Promise<void>;
    }) => {
      const [outcome, setOutcome] = useState("");
      if (!props.open) return null;
      const kind = props.editWorker === undefined ? "add" : "edit";
      return (
        <div data-testid={`${kind}-dialog`}>
          <button
            type="button"
            onClick={() =>
              props.onSave({ name: "Jean" }).then(
                () => setOutcome("saved"),
                () => setOutcome("rejected"),
              )
            }
          >
            save-{kind}
          </button>
          <span data-testid={`${kind}-outcome`}>{outcome}</span>
        </div>
      );
    },
  };
});
vi.mock("@/components/labor/worker-list", () => ({
  WorkerList: (props: { onAdd: () => void; onEdit: (w: Worker) => void }) => (
    <div>
      <button type="button" onClick={props.onAdd}>
        open-add
      </button>
      <button type="button" onClick={() => props.onEdit(WORKERS[0])}>
        open-edit
      </button>
    </div>
  ),
}));
vi.mock("@/components/labor/attendance-table", () => ({ AttendanceTable: () => null }));
vi.mock("@/components/labor/attendance-calendar", () => ({ AttendanceCalendar: () => null }));
vi.mock("@/components/labor/view-toggle", () => ({ ViewToggle: () => null }));
vi.mock("@/components/labor/log-day-dialog", () => ({ LogDayDialog: () => null }));
vi.mock("@/components/labor/edit-attendance-dialog", () => ({ EditAttendanceDialog: () => null }));
vi.mock("@/components/labor/labor-summary", () => ({
  LaborSummary: () => <div data-testid="labor-summary" />,
}));
vi.mock("@/components/labor/activity-dialog", () => ({ ActivityDialog: () => null }));
vi.mock("@/components/labor/labor-export-dialog", () => ({ LaborExportDialog: () => null }));
vi.mock("@/components/labor/labor-payments-tab", () => ({ LaborPaymentsTab: () => null }));

const labor = await import("@/lib/api/labor");
const { toast } = await import("sonner");

async function openWorkersTab() {
  render(<LaborPageClient initialDate="2026-09-27" />);
  await waitFor(() => expect(screen.getByTestId("labor-summary")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "labor.workers" }));
  await screen.findByRole("button", { name: "open-add" });
}

describe("LaborPage — add / edit worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hands a failed edit back to the dialog, with no page banner", async () => {
    vi.mocked(labor.updateWorker).mockRejectedValue(
      new ApiError("HTTP 400: BAD REQUEST", 400, { message: "Invalid input: phone" }),
    );
    await openWorkersTab();

    fireEvent.click(screen.getByRole("button", { name: "open-edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "save-edit" }));

    await waitFor(() => expect(screen.getByTestId("edit-outcome").textContent).toBe("rejected"));
    // The dialog stays open (the page did not clear editWorker).
    expect(screen.getByTestId("edit-dialog")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("hands a failed add back to the dialog, with no page banner", async () => {
    vi.mocked(labor.createWorker).mockRejectedValue(new ApiError("HTTP 409: CONFLICT", 409, {}));
    await openWorkersTab();

    fireEvent.click(screen.getByRole("button", { name: "open-add" }));
    fireEvent.click(await screen.findByRole("button", { name: "save-add" }));

    await waitFor(() => expect(screen.getByTestId("add-outcome").textContent).toBe("rejected"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("confirms a successful add and edit with a toast", async () => {
    vi.mocked(labor.createWorker).mockResolvedValue({ ...WORKERS[0], id: "worker-2", name: "Ana" });
    vi.mocked(labor.updateWorker).mockResolvedValue({ ...WORKERS[0], person_name: "Jean D." });
    await openWorkersTab();

    fireEvent.click(screen.getByRole("button", { name: "open-add" }));
    fireEvent.click(await screen.findByRole("button", { name: "save-add" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("labor.workerAdded"));

    fireEvent.click(screen.getByRole("button", { name: "open-edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "save-edit" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("labor.workerUpdated"));
    // A successful edit closes the edit dialog.
    await waitFor(() => expect(screen.queryByTestId("edit-dialog")).toBeNull());
  });

  it("clears a page-level error when the user switches tab", async () => {
    vi.mocked(labor.fetchLaborMonthlySummary).mockRejectedValueOnce(new Error("boom"));
    render(<LaborPageClient initialDate="2026-09-27" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("labor.errors.loadSummaryFailed");

    fireEvent.click(screen.getByRole("button", { name: "labor.workers" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
