/**
 * company-members-table-pickers.test.tsx
 *
 * Covers the Company and Projects multi-selects and the pending-row D2
 * behaviour:
 *  - Company options are scoped to the caller's admin companies only (D4).
 *  - Ticking a company calls attachUserToCompanyAction directly.
 *  - Unticking a company is destructive: it must open the confirm dialog
 *    first, only calling bootAttachedUserAction (companies-actions.ts) once
 *    confirmed — and not at all if cancelled.
 *  - Ticking/unticking a project always assigns as "member" (D3) and wraps
 *    assignProjectMemberAction / unassignProjectMemberAction.
 *  - A pending (no-account) row shows the Pending badge with Role/Company/
 *    Projects disabled (D2).
 *
 * Radix DropdownMenu/AlertDialog need real pointer events (userEvent, not
 * fireEvent) to open — same interaction strategy as billing-status-menu.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyMembersTable } from "@/components/companies/company-members-table";
import type { AttachedUser, MyCompany } from "@/types/companies";
import type { CompanyDirectoryEntry } from "@/lib/api/companies-members";
import type { Project } from "@/types/project";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return (path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string) ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let val = resolve(en, `${ns}.${key}`);
    if (typeof val !== "string") return key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(`{${k}}`, String(v));
      });
    }
    return val;
  };
  return { useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const FIXTURE_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Chantier A",
    address: null,
    owner_id: "owner-1",
    user_count: 1,
    created_at: "2026-01-01T00:00:00Z",
    company_id: "co-1",
  },
  {
    id: "proj-2",
    name: "Chantier B",
    address: null,
    owner_id: "owner-1",
    user_count: 1,
    created_at: "2026-01-01T00:00:00Z",
    company_id: "co-1",
  },
  {
    id: "proj-3",
    name: "Other Company Project",
    address: null,
    owner_id: "owner-1",
    user_count: 1,
    created_at: "2026-01-01T00:00:00Z",
    company_id: "co-2",
  },
];

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ projects: FIXTURE_PROJECTS }),
}));

vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  fetchAttachedUsersAction: vi.fn(),
  setMemberRoleAction: vi.fn(),
  bootAttachedUserAction: vi.fn(),
  fetchMyCompaniesAction: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/settings/_actions/company-settings-actions", () => ({
  fetchCompanyDirectoryAction: vi.fn(),
  assignProjectMemberAction: vi.fn(),
  unassignProjectMemberAction: vi.fn(),
  attachUserToCompanyAction: vi.fn(),
}));

vi.mock("@/components/companies/add-member-by-phone-dialog", () => ({
  AddMemberByPhoneDialog: () => null,
}));
vi.mock("@/components/companies/import-members-dialog", () => ({
  ImportMembersDialog: () => null,
}));
vi.mock("@/components/companies/member-grants-editor", () => ({
  MemberGrantsEditor: () => null,
}));

import {
  fetchAttachedUsersAction,
  fetchMyCompaniesAction,
  bootAttachedUserAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import {
  fetchCompanyDirectoryAction,
  assignProjectMemberAction,
  unassignProjectMemberAction,
  attachUserToCompanyAction,
} from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";

const mockFetchUsers = vi.mocked(fetchAttachedUsersAction);
const mockFetchCompanies = vi.mocked(fetchMyCompaniesAction);
const mockFetchDirectory = vi.mocked(fetchCompanyDirectoryAction);
const mockBoot = vi.mocked(bootAttachedUserAction);
const mockAttachCompany = vi.mocked(attachUserToCompanyAction);
const mockAssignProject = vi.mocked(assignProjectMemberAction);
const mockUnassignProject = vi.mocked(unassignProjectMemberAction);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CARLA: AttachedUser = {
  user_id: "user-3",
  email: "carla@example.com",
  display_name: "Carla",
  phone: null,
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  role: "member",
  companies: [{ id: "co-1", legal_name: "Maison Lavandou" }],
};

const CARLA_DIRECTORY: CompanyDirectoryEntry = {
  person_id: "person-3",
  name: "Carla",
  phone: "+33612345678",
  linked_user_id: "user-3",
  assigned_project_ids: ["proj-1"],
  is_active: true,
  pending: false,
  labor_role_id: null,
  default_daily_rate: null,
};

const PENDING_ENTRY: CompanyDirectoryEntry = {
  person_id: "person-4",
  name: "Dylan",
  phone: "+33698765432",
  linked_user_id: null,
  assigned_project_ids: [],
  is_active: true,
  pending: true,
  labor_role_id: null,
  default_daily_rate: null,
};

function makeCompany(overrides: Partial<MyCompany> = {}): MyCompany {
  return {
    id: "co-1",
    legal_name: "Maison Lavandou",
    address: "12 rue des Oliviers",
    siret: null,
    tva_number: null,
    iban: null,
    bic: null,
    logo_url: null,
    default_payment_terms: null,
    prefix_override: null,
    join_code: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    is_primary: true,
    attached_at: "2026-01-01T00:00:00Z",
    role: "admin",
    ...overrides,
  };
}

const ADMIN_COMPANIES: MyCompany[] = [
  makeCompany({ id: "co-1", legal_name: "Maison Lavandou", role: "admin" }),
  makeCompany({ id: "co-2", legal_name: "Atelier Sud", is_primary: false, role: "admin" }),
  makeCompany({ id: "co-3", legal_name: "Chantier Nord", is_primary: false, role: "member" }),
];

function renderTable(
  users: AttachedUser[],
  directory: CompanyDirectoryEntry[],
  onMutated = vi.fn()
) {
  mockFetchUsers.mockResolvedValueOnce({ ok: true, data: users });
  mockFetchDirectory.mockResolvedValueOnce({ ok: true, data: directory });
  mockFetchCompanies.mockResolvedValueOnce({ ok: true, data: ADMIN_COMPANIES });
  render(
    <CompanyMembersTable
      companyId="co-1"
      adminOfMultiple={false}
      sourceCompanies={[]}
      onMutated={onMutated}
    />
  );
  return onMutated;
}

/** Open a Radix DropdownMenu by its trigger's accessible name; returns its checkbox items. */
async function openPicker(user: ReturnType<typeof userEvent.setup>, triggerName: RegExp | string) {
  const trigger = screen.getByRole("button", { name: triggerName });
  await user.click(trigger);
  await waitFor(() => {
    if (document.querySelectorAll("[role='menuitemcheckbox']").length === 0) {
      throw new Error("checklist items not rendered yet");
    }
  });
  return Array.from(document.querySelectorAll("[role='menuitemcheckbox']"));
}

function findItem(items: Element[], label: RegExp) {
  const item = items.find((el) => label.test(el.textContent ?? ""));
  if (!item) throw new Error(`No checklist item matches ${label}`);
  return item;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Company column
// ---------------------------------------------------------------------------

describe("CompanyMembersTable — Company column", () => {
  it("only offers companies the caller administers, checked for the ones the member already belongs to", async () => {
    const user = userEvent.setup();
    renderTable([CARLA], [CARLA_DIRECTORY]);
    await waitFor(() => screen.getByText("Carla"));

    const items = await openPicker(user, "Maison Lavandou");
    const labels = items.map((el) => el.textContent);
    expect(labels).toEqual(["Maison Lavandou", "Atelier Sud"]); // never "Chantier Nord" (D4)
    expect(findItem(items, /Maison Lavandou/).getAttribute("data-state")).toBe("checked");
    expect(findItem(items, /Atelier Sud/).getAttribute("data-state")).toBe("unchecked");
  });

  it("ticking a company the member doesn't belong to attaches them directly", async () => {
    const user = userEvent.setup();
    mockAttachCompany.mockResolvedValueOnce({ ok: true, data: undefined });
    const onMutated = renderTable([CARLA], [CARLA_DIRECTORY]);
    await waitFor(() => screen.getByText("Carla"));

    const items = await openPicker(user, "Maison Lavandou");
    await user.click(findItem(items, /Atelier Sud/));

    await waitFor(() => {
      expect(mockAttachCompany).toHaveBeenCalledWith("co-2", "user-3");
    });
    expect(mockBoot).not.toHaveBeenCalled();
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
  });

  it("unticking a company the member belongs to opens the confirm dialog instead of calling boot directly", async () => {
    const user = userEvent.setup();
    renderTable([CARLA], [CARLA_DIRECTORY]);
    await waitFor(() => screen.getByText("Carla"));

    const items = await openPicker(user, "Maison Lavandou");
    await user.click(findItem(items, /Maison Lavandou/));

    expect(await screen.findByText(/Remove Carla from Maison Lavandou/)).toBeDefined();
    expect(mockBoot).not.toHaveBeenCalled();
  });

  it("confirming the dialog calls bootAttachedUserAction for that company and refreshes", async () => {
    const user = userEvent.setup();
    mockBoot.mockResolvedValueOnce({ ok: true, data: undefined });
    const onMutated = renderTable([CARLA], [CARLA_DIRECTORY]);
    await waitFor(() => screen.getByText("Carla"));

    const items = await openPicker(user, "Maison Lavandou");
    await user.click(findItem(items, /Maison Lavandou/));
    await screen.findByText(/Remove Carla from Maison Lavandou/);

    await user.click(screen.getByRole("button", { name: "Remove from company" }));

    await waitFor(() => {
      expect(mockBoot).toHaveBeenCalledWith("co-1", "user-3");
    });
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
  });

  it("cancelling the confirm dialog never calls bootAttachedUserAction", async () => {
    const user = userEvent.setup();
    renderTable([CARLA], [CARLA_DIRECTORY]);
    await waitFor(() => screen.getByText("Carla"));

    const items = await openPicker(user, "Maison Lavandou");
    await user.click(findItem(items, /Maison Lavandou/));
    await screen.findByText(/Remove Carla from Maison Lavandou/);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText(/Remove Carla from Maison Lavandou/)).toBeNull();
    });
    expect(mockBoot).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Projects column
// ---------------------------------------------------------------------------

describe("CompanyMembersTable — Projects column", () => {
  it("only offers this company's projects, checked for the ones already assigned", async () => {
    const user = userEvent.setup();
    renderTable([CARLA], [CARLA_DIRECTORY]);
    await waitFor(() => screen.getByText("Carla"));

    const items = await openPicker(user, "Chantier A");
    const labels = items.map((el) => el.textContent);
    expect(labels).toEqual(["Chantier A", "Chantier B"]); // never "Other Company Project"
    expect(findItem(items, /Chantier A/).getAttribute("data-state")).toBe("checked");
    expect(findItem(items, /Chantier B/).getAttribute("data-state")).toBe("unchecked");
  });

  it("ticking an unassigned project assigns the member as 'member' (D3)", async () => {
    const user = userEvent.setup();
    mockAssignProject.mockResolvedValueOnce({ ok: true, data: undefined });
    const onMutated = renderTable([CARLA], [CARLA_DIRECTORY]);
    await waitFor(() => screen.getByText("Carla"));

    const items = await openPicker(user, "Chantier A");
    await user.click(findItem(items, /Chantier B/));

    await waitFor(() => {
      expect(mockAssignProject).toHaveBeenCalledWith("proj-2", "user-3", "member");
    });
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
  });

  it("unticking an assigned project unassigns it, with no confirm dialog", async () => {
    const user = userEvent.setup();
    mockUnassignProject.mockResolvedValueOnce({ ok: true, data: undefined });
    const onMutated = renderTable([CARLA], [CARLA_DIRECTORY]);
    await waitFor(() => screen.getByText("Carla"));

    const items = await openPicker(user, "Chantier A");
    await user.click(findItem(items, /Chantier A/));

    await waitFor(() => {
      expect(mockUnassignProject).toHaveBeenCalledWith("proj-1", "user-3");
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(onMutated).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// Pending rows (D2)
// ---------------------------------------------------------------------------

describe("CompanyMembersTable — pending rows", () => {
  it("shows a Pending badge with Role, Company and Projects disabled", async () => {
    renderTable([], [PENDING_ENTRY]);
    await waitFor(() => screen.getByText("Dylan"));

    expect(screen.getByText("Pending")).toBeDefined();
    // Role has nothing to select — rendered as a dash, not a <select>.
    expect(screen.getByText("—")).toBeDefined();
    expect(screen.getByRole("button", { name: "Add company" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Assign project" })).toBeDisabled();
  });
});
