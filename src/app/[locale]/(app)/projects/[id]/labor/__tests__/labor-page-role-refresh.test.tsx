/**
 * LaborPage — what a role rename or delete in the worker dialog reloads.
 *
 * Workers carry their role's name and color (the summary reads them from the
 * workers list), and attendance entries carry `role_color`, so after a rename
 * or delete in the role picker both must be refetched: workers always,
 * entries when the attendance tab is open (opening it later fetches them).
 * Heavy tab bodies are mocked out; the add-worker dialog mock exposes the
 * role callbacks the page hands it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LaborPageClient } from "../labor-page-client";
import type { Worker } from "@/types/labor";
import type { LaborRole } from "@/types/labor-role";

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

const { WORKERS, ROLE } = vi.hoisted(() => ({
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
  ROLE: {
    id: "r-custom",
    name: "Electrician",
    color: "#0EA5E9",
    created_at: "2026-01-02T00:00:00Z",
    slug: null,
  } as LaborRole,
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
  fetchLaborRolesAction: vi
    .fn()
    .mockResolvedValue({ success: true, data: { roles: [ROLE], palette: [] } }),
}));

vi.mock("@/components/labor/add-worker-dialog", () => ({
  // Two instances render (add and edit); only the add one exposes buttons.
  AddWorkerDialog: (props: {
    editWorker?: Worker | null;
    onRoleUpdated?: (role: LaborRole) => void;
    onRoleDeleted?: (roleId: string) => void;
  }) =>
    props.editWorker === undefined ? (
      <div>
        <button type="button" onClick={() => props.onRoleUpdated?.({ ...ROLE, color: "#10B981" })}>
          role-updated
        </button>
        <button type="button" onClick={() => props.onRoleDeleted?.(ROLE.id)}>
          role-deleted
        </button>
      </div>
    ) : null,
}));
vi.mock("@/components/labor/worker-list", () => ({ WorkerList: () => null }));
vi.mock("@/components/labor/attendance-table", () => ({
  AttendanceTable: () => <div data-testid="attendance-table" />,
}));
vi.mock("@/components/labor/attendance-calendar", () => ({
  AttendanceCalendar: () => <div data-testid="attendance-table" />,
}));
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

async function renderPage() {
  render(<LaborPageClient initialDate="2026-09-27" />);
  await waitFor(() => expect(screen.getByTestId("labor-summary")).toBeInTheDocument());
  await waitFor(() => expect(labor.fetchWorkers).toHaveBeenCalled());
}

describe("LaborPage — role rename / delete refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reloads workers and the open attendance entries after a rename", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "labor.attendance" }));
    await waitFor(() => expect(labor.fetchLaborEntries).toHaveBeenCalled());
    vi.mocked(labor.fetchWorkers).mockClear();
    vi.mocked(labor.fetchLaborEntries).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "role-updated" }));

    await waitFor(() => expect(labor.fetchWorkers).toHaveBeenCalledTimes(1));
    expect(labor.fetchLaborEntries).toHaveBeenCalledTimes(1);
  });

  it("reloads workers and the open attendance entries after a delete", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "labor.attendance" }));
    await waitFor(() => expect(labor.fetchLaborEntries).toHaveBeenCalled());
    vi.mocked(labor.fetchWorkers).mockClear();
    vi.mocked(labor.fetchLaborEntries).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "role-deleted" }));

    await waitFor(() => expect(labor.fetchWorkers).toHaveBeenCalledTimes(1));
    expect(labor.fetchLaborEntries).toHaveBeenCalledTimes(1);
  });

  it("leaves entries for the attendance tab to fetch when it is not open", async () => {
    await renderPage();
    vi.mocked(labor.fetchWorkers).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "role-updated" }));

    await waitFor(() => expect(labor.fetchWorkers).toHaveBeenCalledTimes(1));
    expect(labor.fetchLaborEntries).not.toHaveBeenCalled();
  });
});
