/**
 * A pending row (added by phone, no account yet) can have its invitation
 * cancelled, after a confirm, so a sign-up with that number no longer joins
 * the company. Attached members keep the boot path (Company column).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { CompanyMembersTable } from "@/components/companies/company-members-table";
import type { AttachedUser } from "@/types/companies";
import type { CompanyDirectoryEntry } from "@/lib/api/companies-members";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/context/ProjectContext", () => ({ useProject: () => ({ projects: [] }) }));
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
  cancelPendingMemberAction: vi.fn(),
}));
vi.mock("@/components/companies/add-member-by-phone-dialog", () => ({ AddMemberByPhoneDialog: () => null }));
vi.mock("@/components/companies/import-members-dialog", () => ({ ImportMembersDialog: () => null }));
vi.mock("@/components/companies/member-grants-editor", () => ({ MemberGrantsEditor: () => null }));

import { toast } from "sonner";
import {
  fetchAttachedUsersAction,
  fetchMyCompaniesAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import {
  fetchCompanyDirectoryAction,
  cancelPendingMemberAction,
} from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";

const ADMIN: AttachedUser = {
  user_id: "user-1",
  email: "alice@example.com",
  display_name: "Alice",
  phone: "+33612345678",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  role: "admin",
  companies: [],
};

const PENDING: CompanyDirectoryEntry = {
  person_id: "person-9",
  name: "Typo Quebec",
  phone: "+33620350088",
  linked_user_id: null,
  assigned_project_ids: [],
  is_active: true,
  pending: true,
  labor_role_id: null,
  default_daily_rate: null,
};

const m = en.companySettings.members;

function renderTable(onMutated = vi.fn()) {
  vi.mocked(fetchAttachedUsersAction).mockResolvedValueOnce({ ok: true, data: [ADMIN] });
  vi.mocked(fetchCompanyDirectoryAction).mockResolvedValueOnce({ ok: true, data: [PENDING] });
  vi.mocked(fetchMyCompaniesAction).mockResolvedValueOnce({ ok: true, data: [] });
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CompanyMembersTable companyId="co-1" adminOfMultiple={false} sourceCompanies={[]} onMutated={onMutated} />
    </NextIntlClientProvider>
  );
  return onMutated;
}

describe("CompanyMembersTable — cancel a pending invitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers the action on the pending row only and cancels after the confirm", async () => {
    vi.mocked(cancelPendingMemberAction).mockResolvedValueOnce({ ok: true, data: undefined });
    const onMutated = renderTable();
    await screen.findByText("Typo Quebec");

    // One button: the pending row's. The attached admin has none.
    const buttons = screen.getAllByRole("button", { name: m.cancelInvitation });
    expect(buttons).toHaveLength(1);

    fireEvent.click(buttons[0]);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Typo Quebec");
    expect(cancelPendingMemberAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: m.cancelInvitation }).at(-1)!);
    await waitFor(() => expect(cancelPendingMemberAction).toHaveBeenCalledWith("co-1", "person-9"));
    await waitFor(() => expect(onMutated).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith(m.invitationCancelledToast);
  });

  it("keeps the invitation when the admin backs out", async () => {
    renderTable();
    await screen.findByText("Typo Quebec");
    fireEvent.click(screen.getByRole("button", { name: m.cancelInvitation }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: m.keepInvitation }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(cancelPendingMemberAction).not.toHaveBeenCalled();
  });
});
