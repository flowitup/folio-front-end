/**
 * company-members-table-phone.test.tsx
 *
 * Covers the phone-instead-of-email column: renders the phone as the muted
 * second line when present, and falls back to an em dash when the member
 * has no phone on file (phone-only sign-in is rolling out, so an admin
 * needs to spot at a glance who still lacks one).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CompanyMembersTable } from "@/components/companies/company-members-table";
import type { AttachedUser } from "@/types/companies";

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

vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  fetchAttachedUsersAction: vi.fn(),
  setMemberRoleAction: vi.fn(),
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

import { fetchAttachedUsersAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
const mockFetchUsers = vi.mocked(fetchAttachedUsersAction);

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
};

const WITHOUT_PHONE: AttachedUser = {
  user_id: "user-2",
  email: "bob@example.com",
  display_name: null,
  phone: null,
  is_primary: false,
  attached_at: "2026-02-01T00:00:00Z",
  role: "member",
};

function renderTable(users: AttachedUser[]) {
  mockFetchUsers.mockResolvedValueOnce({ ok: true, data: users });
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
  it("uses the Name / Phone header instead of Name / Email", async () => {
    renderTable([WITH_PHONE]);
    await waitFor(() => screen.getByText("Alice"));
    expect(screen.getByText("Name / Phone")).toBeDefined();
    expect(screen.queryByText("Name / Email")).toBeNull();
  });

  it("renders the phone as the muted second line when present", async () => {
    renderTable([WITH_PHONE]);
    await waitFor(() => screen.getByText("Alice"));
    expect(screen.getByText("+33612345678")).toBeDefined();
  });

  it("falls back to display_name ?? phone ?? email on the first line, phone stays null-safe", async () => {
    renderTable([WITHOUT_PHONE]);
    // Bob has no display_name and no phone — first line falls back to email.
    await waitFor(() => screen.getByText("bob@example.com"));
  });

  it("renders an em dash when the member has no phone on file", async () => {
    renderTable([WITHOUT_PHONE]);
    await waitFor(() => screen.getByText("bob@example.com"));
    expect(screen.getByText("—")).toBeDefined();
  });
});
