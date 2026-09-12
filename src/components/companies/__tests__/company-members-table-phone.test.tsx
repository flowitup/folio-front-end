/**
 * company-members-table-phone.test.tsx
 *
 * Covers the standalone Phone column: renders a French E.164 number
 * formatted via formatFrenchPhone when present, and falls back to an em
 * dash when the merged row has none (phone-only sign-in is rolling out, so
 * an admin needs to spot at a glance who still lacks a phone).
 *
 * The merge of attached-users + directory into one row per person has its
 * own coverage in src/lib/companies/__tests__/merge-member-rows.test.ts —
 * this file only exercises the table's own rendering of that merged data.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CompanyMembersTable } from "@/components/companies/company-members-table";
import type { AttachedUser } from "@/types/companies";
import type { CompanyDirectoryEntry } from "@/lib/api/companies-members";

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
  const makeT = (ns: string) => (key: string) => {
    const val = resolve(en, `${ns}.${key}`);
    return typeof val === "string" ? val : key;
  };
  return { useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// This table lives under the app layout's ProjectProvider in production;
// stub the hook directly rather than rendering the real provider (which
// would fetch projects over the network).
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ projects: [] }),
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

// Child dialogs are exercised by their own tests — stub them here so this
// test stays focused on the table's phone column.
vi.mock("@/components/companies/add-member-by-phone-dialog", () => ({
  AddMemberByPhoneDialog: () => null,
}));
vi.mock("@/components/companies/import-members-dialog", () => ({
  ImportMembersDialog: () => null,
}));
vi.mock("@/components/companies/member-grants-editor", () => ({
  MemberGrantsEditor: () => null,
}));

import { fetchAttachedUsersAction, fetchMyCompaniesAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { fetchCompanyDirectoryAction } from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";

const mockFetchUsers = vi.mocked(fetchAttachedUsersAction);
const mockFetchCompanies = vi.mocked(fetchMyCompaniesAction);
const mockFetchDirectory = vi.mocked(fetchCompanyDirectoryAction);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WITH_PHONE: AttachedUser = {
  user_id: "user-1",
  email: "alice@example.com",
  display_name: "Alice",
  phone: "+33612345678",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  role: "admin",
  companies: [],
};

const WITHOUT_PHONE: AttachedUser = {
  user_id: "user-2",
  email: "bob@example.com",
  display_name: null,
  phone: null,
  is_primary: false,
  attached_at: "2026-02-01T00:00:00Z",
  role: "member",
  companies: [],
};

function renderTable(users: AttachedUser[], directory: CompanyDirectoryEntry[] = []) {
  mockFetchUsers.mockResolvedValueOnce({ ok: true, data: users });
  mockFetchDirectory.mockResolvedValueOnce({ ok: true, data: directory });
  mockFetchCompanies.mockResolvedValueOnce({ ok: true, data: [] });
  return render(
    <CompanyMembersTable
      companyId="co-1"
      adminOfMultiple={false}
      sourceCompanies={[]}
      onMutated={vi.fn()}
    />
  );
}

describe("CompanyMembersTable — phone column", () => {
  it("has a standalone Phone column header, separate from Name", async () => {
    renderTable([WITH_PHONE]);
    await waitFor(() => screen.getByText("Alice"));
    expect(screen.getByText("Phone")).toBeDefined();
    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.queryByText("Name / Phone")).toBeNull();
  });

  it("renders a French E.164 phone formatted as +33X XX XX XX XX", async () => {
    renderTable([WITH_PHONE]);
    await waitFor(() => screen.getByText("Alice"));
    expect(screen.getByText("+336 12 34 56 78")).toBeDefined();
    expect(screen.queryByText("+33612345678")).toBeNull();
  });

  it("falls back to display_name ?? phone ?? email on the Name column, phone stays null-safe", async () => {
    renderTable([WITHOUT_PHONE]);
    // Bob has no display_name and no phone — Name column falls back to email.
    await waitFor(() => screen.getByText("bob@example.com"));
  });

  it("renders an em dash in the Phone column when the member has no phone on file", async () => {
    renderTable([WITHOUT_PHONE]);
    await waitFor(() => screen.getByText("bob@example.com"));
    expect(screen.getByText("—")).toBeDefined();
  });
});
