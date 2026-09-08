/**
 * Regression tests for the H1 tab-latch bug: `LaborPage` used to derive
 * `isMemberPersona` (and the initial `activeTab`) from `useProject()` before
 * that context resolved. `projects` starts empty, so a manager whose ONLY
 * grant is project-level (D8 assignment, not a global permission) would be
 * misclassified as the member persona on first render, latch `activeTab` to
 * "roster" forever (`useState` initializers run once), and end up with the
 * segmented tab bar visible but nothing rendering underneath it once
 * ProjectContext resolved.
 *
 * `useProject()` is mocked with a controllable return so the test can render
 * once while it's still loading, then flip it to resolved and rerender —
 * simulating the async resolution the real ProjectProvider does.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LaborPageClient } from "../labor-page-client";
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

// No global manage_labor permission — the grant, once it exists, is
// project-level only (D8 assignment), which is exactly the case the old
// code misclassified while `projects` was still empty.
vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: { permissions: [] } })),
}));

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

vi.mock("@/lib/api/labor", () => ({
  fetchWorkers: vi.fn().mockResolvedValue(WORKERS),
  createWorker: vi.fn(),
  updateWorker: vi.fn(),
  deleteWorker: vi.fn(),
  fetchLaborEntries: vi.fn().mockResolvedValue([]),
  updateAttendance: vi.fn(),
  deleteAttendance: vi.fn(),
  validateAttendance: vi.fn(),
  rejectAttendance: vi.fn(),
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

vi.mock("@/lib/api/projects", () => ({
  fetchProjectById: vi.fn().mockResolvedValue({ company_id: null }),
}));

vi.mock("../actions", () => ({
  fetchLaborRolesAction: vi.fn().mockResolvedValue({ success: true, data: { roles: [], palette: [] } }),
}));

vi.mock("@/components/labor/worker-list", () => ({ WorkerList: () => <div data-testid="worker-list" /> }));
vi.mock("@/components/labor/add-worker-dialog", () => ({ AddWorkerDialog: () => null }));
vi.mock("@/components/labor/attendance-table", () => ({ AttendanceTable: () => null }));
vi.mock("@/components/labor/attendance-calendar", () => ({ AttendanceCalendar: () => null }));
vi.mock("@/components/labor/view-toggle", () => ({ ViewToggle: () => null }));
vi.mock("@/components/labor/log-day-dialog", () => ({ LogDayDialog: () => null }));
vi.mock("@/components/labor/edit-attendance-dialog", () => ({ EditAttendanceDialog: () => null }));
vi.mock("@/components/labor/labor-summary", () => ({ LaborSummary: () => <div data-testid="labor-summary" /> }));
vi.mock("@/components/labor/labor-payments-tab", () => ({ LaborPaymentsTab: () => <div data-testid="labor-payments-tab" /> }));
vi.mock("@/components/labor/activity-dialog", () => ({ ActivityDialog: () => null }));
vi.mock("@/components/labor/labor-export-dialog", () => ({ LaborExportDialog: () => null }));
vi.mock("@/components/labor/day-roster", () => ({ DayRoster: () => <div data-testid="day-roster" /> }));

describe("LaborPage — persona/tab reconciliation (H1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProject.mockReturnValue({ projects: [], isLoading: true });
  });

  it("shows the loader — not the roster — while ProjectContext is still resolving", () => {
    render(<LaborPageClient initialDate="2026-09-08" />);

    expect(screen.queryByTestId("day-roster")).not.toBeInTheDocument();
    expect(screen.queryByTestId("labor-summary")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "labor.summary" })).not.toBeInTheDocument();
  });

  it("lands a manager (project-level grant only) on the Summary tab once ProjectContext resolves late", async () => {
    const { rerender } = render(<LaborPageClient initialDate="2026-09-08" />);

    mockUseProject.mockReturnValue({
      projects: [{ id: "proj-1", my_permissions: ["project:manage_labor"] }],
      isLoading: false,
    });
    rerender(<LaborPageClient initialDate="2026-09-08" />);

    await waitFor(() => expect(screen.getByTestId("labor-summary")).toBeInTheDocument());
    expect(screen.queryByTestId("day-roster")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "labor.summary" })).toHaveClass("on");
  });

  it("keeps a member on the roster tab (no tab bar) once ProjectContext resolves", async () => {
    const { rerender } = render(<LaborPageClient initialDate="2026-09-08" />);

    mockUseProject.mockReturnValue({
      projects: [{ id: "proj-1", my_permissions: [] }],
      isLoading: false,
    });
    rerender(<LaborPageClient initialDate="2026-09-08" />);

    await waitFor(() => expect(screen.getByTestId("day-roster")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "labor.summary" })).not.toBeInTheDocument();
  });
});
