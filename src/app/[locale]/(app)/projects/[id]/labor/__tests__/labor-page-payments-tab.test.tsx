/**
 * Tests for LaborPage — Payments tab wiring.
 *
 * Covers: the tab button renders and switches to it, LaborPaymentsTab
 * receives the invoices-permission flag (not the labor-entry one) plus the
 * already-loaded workers list, and the other tabs still default correctly.
 * Heavy tab bodies (WorkerList, LaborSummary, etc.) are mocked out — this
 * test only asserts the Payments wiring added in labor/page.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LaborPage from "../page";
import type { Worker } from "@/types/labor";

// ── Mocks ──────────────────────────────────────────────────────────────────────

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

// vi.mock factories are hoisted above top-level const declarations, so the
// fixture referenced inside the "@/lib/api/labor" factory below must go
// through vi.hoisted to avoid a temporal-dead-zone ReferenceError.
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
  useAuth: vi.fn(() => ({ user: { permissions: ["project:manage_invoices"] } })),
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
  fetchLaborActivities: vi.fn().mockResolvedValue([]),
  createLaborActivity: vi.fn(),
  updateLaborActivity: vi.fn(),
  deleteLaborActivity: vi.fn(),
  fetchLaborDayDescriptions: vi.fn().mockResolvedValue([]),
  setLaborDayDescription: vi.fn(),
}));

vi.mock("../actions", () => ({
  fetchLaborRolesAction: vi.fn().mockResolvedValue({ success: true, data: { roles: [], palette: [] } }),
  fetchProjectTagsAction: vi.fn().mockResolvedValue({ success: true, tags: [] }),
}));

vi.mock("@/components/labor/worker-list", () => ({ WorkerList: () => <div data-testid="worker-list" /> }));
vi.mock("@/components/labor/add-worker-dialog", () => ({ AddWorkerDialog: () => null }));
vi.mock("@/components/labor/attendance-table", () => ({ AttendanceTable: () => null }));
vi.mock("@/components/labor/attendance-calendar", () => ({ AttendanceCalendar: () => null }));
vi.mock("@/components/labor/view-toggle", () => ({ ViewToggle: () => null }));
vi.mock("@/components/labor/log-day-dialog", () => ({ LogDayDialog: () => null }));
vi.mock("@/components/labor/edit-attendance-dialog", () => ({ EditAttendanceDialog: () => null }));
vi.mock("@/components/labor/labor-summary", () => ({ LaborSummary: () => <div data-testid="labor-summary" /> }));
vi.mock("@/components/labor/activity-dialog", () => ({ ActivityDialog: () => null }));
vi.mock("@/components/labor/labor-export-dialog", () => ({ LaborExportDialog: () => null }));
vi.mock("@/components/tags/tag-filter-select", () => ({ TagFilterSelect: () => null }));

vi.mock("@/components/labor/labor-payments-tab", () => ({
  LaborPaymentsTab: (props: { projectId: string; canManage: boolean; workers: Worker[] }) => (
    <div
      data-testid="labor-payments-tab"
      data-project-id={props.projectId}
      data-can-manage={String(props.canManage)}
      data-workers-count={props.workers.length}
    />
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LaborPage — Payments tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Payments tab button alongside the existing three", async () => {
    render(<LaborPage />);
    await waitFor(() => expect(screen.getByTestId("labor-summary")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "labor.payments.tab" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "labor.summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "labor.attendance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "labor.workers" })).toBeInTheDocument();
  });

  it("defaults to the Summary tab, not Payments", async () => {
    render(<LaborPage />);
    await waitFor(() => expect(screen.getByTestId("labor-summary")).toBeInTheDocument());
    expect(screen.queryByTestId("labor-payments-tab")).not.toBeInTheDocument();
  });

  it("switches to LaborPaymentsTab on click, passing projectId + workers + invoices-permission flag", async () => {
    render(<LaborPage />);
    await waitFor(() => expect(screen.getByTestId("labor-summary")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "labor.payments.tab" }));

    const tab = await screen.findByTestId("labor-payments-tab");
    expect(tab).toHaveAttribute("data-project-id", "proj-1");
    // user.permissions carries project:manage_invoices only (not manage_labor)
    // — this confirms the Payments tab is gated on the invoices flag.
    expect(tab).toHaveAttribute("data-can-manage", "true");
    expect(tab).toHaveAttribute("data-workers-count", "1");
  });

  it("gates canManage=false when the user lacks project:manage_invoices", async () => {
    const { useAuth } = await import("@/context/AuthContext");
    vi.mocked(useAuth).mockReturnValue({
      user: { permissions: ["project:manage_labor"] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<LaborPage />);
    await waitFor(() => expect(screen.getByTestId("labor-summary")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "labor.payments.tab" }));

    const tab = await screen.findByTestId("labor-payments-tab");
    expect(tab).toHaveAttribute("data-can-manage", "false");
  });
});
