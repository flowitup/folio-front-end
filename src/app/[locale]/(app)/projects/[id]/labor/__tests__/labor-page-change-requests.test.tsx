/**
 * LaborPage — worker change requests (manager side).
 *
 * - A manager sees the open requests counted on the Attendance tab and listed
 *   in a panel there; Apply / Refuse (after confirmation) hit the change
 *   routes and reload the attendance entries.
 * - The decide actions are handed to the calendar so the day sheet offers them.
 * - A user without project:manage_labor loads and sees none of it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { LaborPageClient } from "../labor-page-client";
import type { AttendanceChangeRequest, Worker } from "@/types/labor";

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

const { WORKERS, REQUEST } = vi.hoisted(() => ({
  WORKERS: [
    {
      id: "w1",
      project_id: "proj-1",
      name: "Tho",
      phone: null,
      daily_rate: 150,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ] as Worker[],
  REQUEST: {
    entry_id: "e1",
    worker_id: "w1",
    worker_name: "Tho",
    date: "2026-09-06",
    shift_type: "full",
    supplement_hours: 0,
    note: null,
    proposed_shift_type: "half",
    proposed_supplement_hours: 0,
    proposed_note: null,
    requested_at: "2026-09-08T18:00:00",
  } as AttendanceChangeRequest,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: { permissions: ["project:manage_labor"] } })),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ projects: [{ id: "proj-1", my_permissions: [] }], isLoading: false }),
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
  approveAttendanceChange: vi.fn().mockResolvedValue(undefined),
  rejectAttendanceChange: vi.fn().mockResolvedValue(undefined),
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
  fetchAttendanceChangeRequestsAction: vi.fn(),
}));

vi.mock("@/components/labor/worker-list", () => ({ WorkerList: () => null }));
vi.mock("@/components/labor/add-worker-dialog", () => ({ AddWorkerDialog: () => null }));
vi.mock("@/components/labor/attendance-table", () => ({ AttendanceTable: () => null }));
vi.mock("@/components/labor/attendance-calendar", () => ({
  AttendanceCalendar: (props: { changeRequestActions?: unknown }) => (
    <div data-testid="attendance-calendar" data-has-change-actions={String(!!props.changeRequestActions)} />
  ),
}));
vi.mock("@/components/labor/view-toggle", () => ({ ViewToggle: () => null }));
vi.mock("@/components/labor/log-day-dialog", () => ({ LogDayDialog: () => null }));
vi.mock("@/components/labor/edit-attendance-dialog", () => ({ EditAttendanceDialog: () => null }));
vi.mock("@/components/labor/labor-summary", () => ({ LaborSummary: () => <div data-testid="labor-summary" /> }));
vi.mock("@/components/labor/labor-payments-tab", () => ({ LaborPaymentsTab: () => null }));
vi.mock("@/components/labor/activity-dialog", () => ({ ActivityDialog: () => null }));
vi.mock("@/components/labor/labor-export-dialog", () => ({ LaborExportDialog: () => null }));
vi.mock("@/components/labor/day-roster", () => ({ DayRoster: () => null }));

const { fetchAttendanceChangeRequestsAction } = await import("../actions");
const { approveAttendanceChange, rejectAttendanceChange, fetchLaborEntries } = await import("@/lib/api/labor");
const { useAuth } = await import("@/context/AuthContext");
const mockFetchRequests = vi.mocked(fetchAttendanceChangeRequestsAction);

async function openAttendanceTab() {
  render(<LaborPageClient initialDate="2026-09-08" />);
  await waitFor(() => expect(screen.getByTestId("labor-summary")).toBeInTheDocument());
  await waitFor(() => expect(screen.getByTestId("attendance-change-count")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /^labor\.attendance/ }));
  return screen.findByTestId("change-requests-panel");
}

describe("LaborPage — worker change requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { permissions: ["project:manage_labor"] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockFetchRequests.mockResolvedValue({ success: true, data: [REQUEST] });
  });

  it("counts the open requests on the Attendance tab before it is opened", async () => {
    render(<LaborPageClient initialDate="2026-09-08" />);
    const badge = await screen.findByTestId("attendance-change-count");
    expect(within(badge).getByText("1")).toBeInTheDocument();
    expect(mockFetchRequests).toHaveBeenCalledWith("proj-1");
  });

  it("lists them on the Attendance tab and hands the decide actions to the calendar", async () => {
    const panel = await openAttendanceTab();
    expect(within(panel).getByTestId("change-request-e1")).toBeInTheDocument();
    expect(screen.getByTestId("attendance-calendar")).toHaveAttribute("data-has-change-actions", "true");
  });

  it("Apply calls the change route and reloads the entries", async () => {
    const panel = await openAttendanceTab();
    const entryLoads = vi.mocked(fetchLaborEntries).mock.calls.length;
    mockFetchRequests.mockResolvedValue({ success: true, data: [] });

    fireEvent.click(within(panel).getByRole("button", { name: /^labor\.changeRequest\.apply/ }));

    await waitFor(() => expect(approveAttendanceChange).toHaveBeenCalledWith("proj-1", "e1"));
    await waitFor(() => expect(vi.mocked(fetchLaborEntries).mock.calls.length).toBeGreaterThan(entryLoads));
    await waitFor(() => expect(screen.queryByTestId("change-requests-panel")).not.toBeInTheDocument());
  });

  it("Refuse asks for confirmation before calling the change route", async () => {
    const panel = await openAttendanceTab();
    fireEvent.click(within(panel).getByRole("button", { name: /^labor\.changeRequest\.refuse/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(rejectAttendanceChange).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "labor.changeRequest.refuse" }));

    await waitFor(() => expect(rejectAttendanceChange).toHaveBeenCalledWith("proj-1", "e1"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("does not load or show requests without project:manage_labor", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { permissions: ["project:view_pay"] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<LaborPageClient initialDate="2026-09-08" />);
    await waitFor(() => expect(screen.getByTestId("labor-summary")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "labor.attendance" }));
    await screen.findByTestId("attendance-calendar");

    expect(mockFetchRequests).not.toHaveBeenCalled();
    expect(screen.queryByTestId("attendance-change-count")).not.toBeInTheDocument();
    expect(screen.queryByTestId("change-requests-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("attendance-calendar")).toHaveAttribute("data-has-change-actions", "false");
  });
});
