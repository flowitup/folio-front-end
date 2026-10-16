/**
 * LaborPage — labor roles come from the PROJECT's company (QA round 3 owner bug).
 *
 * A user in two companies opens a project of the company that is not their
 * primary one: the role picker must list, create in and be gated by that
 * project's company. Listing the primary company's roles made every save fail
 * with 400 "Labor role not found".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
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
  useAuth: vi.fn(() => ({
    user: {
      permissions: ["project:manage_labor"],
      companies: [
        { id: "co-a", legal_name: "A", role: "member", is_primary: true },
        { id: "co-b", legal_name: "B", role: "admin", is_primary: false },
      ],
    },
  })),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [{ id: "proj-1", company_id: "co-b", my_permissions: ["project:manage_labor"] }],
    isLoading: false,
  }),
}));

vi.mock("@/lib/api/projects", () => ({
  fetchProjectById: vi.fn().mockResolvedValue({ id: "proj-1", company_id: "co-b" }),
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
vi.mock("../actions", () => ({
  fetchAttendanceChangeRequestsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

const dialogProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
vi.mock("@/components/labor/add-worker-dialog", () => ({
  AddWorkerDialog: (props: Record<string, unknown>) => {
    if (props.editWorker === undefined) dialogProps.current = props;
    return null;
  },
}));
vi.mock("@/components/labor/worker-list", () => ({ WorkerList: () => null }));
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

const roleActions = await import("@/components/labor/labor-role-actions");

describe("LaborPage — roles of the project's company", () => {
  beforeEach(() => {
    dialogProps.current = null;
  });

  it("loads the roles of the project's company, not the primary company", async () => {
    render(<LaborPageClient initialDate="2026-09-27" />);
    await waitFor(() => expect(roleActions.fetchLaborRolesAction).toHaveBeenCalledWith("co-b"));
    expect(roleActions.fetchLaborRolesAction).not.toHaveBeenCalledWith(undefined);
    expect(roleActions.fetchLaborRolesAction).not.toHaveBeenCalledWith();
  });

  it("hands the dialog the project's company and its admin rights there", async () => {
    render(<LaborPageClient initialDate="2026-09-27" />);
    await waitFor(() => expect(dialogProps.current?.companyId).toBe("co-b"));
    // Admin of B (only a member of the primary company A): may manage B's roles.
    expect(dialogProps.current?.canManageRoles).toBe(true);
    await waitFor(() => expect(dialogProps.current?.roles).toEqual([ROLE]));
    const refresh = dialogProps.current?.onRefreshRoles as () => Promise<LaborRole[] | null>;
    await expect(refresh()).resolves.toEqual([ROLE]);
  });
});
