/**
 * Removing a member rotates the company's join code on the backend. The
 * settings page must refetch the company and show the new code, not keep
 * advertising the revoked one.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const { mockFetchMyCompanies } = vi.hoisted(() => ({ mockFetchMyCompanies: vi.fn() }));

vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  fetchMyCompaniesAction: mockFetchMyCompanies,
}));
vi.mock("@/components/companies/company-members-table", () => ({
  CompanyMembersTable: ({ onMutated }: { onMutated: () => void }) => (
    <button type="button" onClick={onMutated}>
      boot member
    </button>
  ),
}));
vi.mock("@/components/companies/company-join-code-card", () => ({
  CompanyJoinCodeCard: ({ initialCode }: { initialCode: string | null }) => (
    <p data-testid="join-code">{initialCode}</p>
  ),
}));
vi.mock("@/components/companies/my-company-card", () => ({ MyCompanyCard: () => null }));
vi.mock("@/components/companies/join-company-dialog", () => ({ JoinCompanyDialog: () => null }));
vi.mock("@/components/companies/company-payment-methods-card", () => ({
  CompanyPaymentMethodsCard: () => null,
}));
vi.mock("@/components/companies/company-labor-roles-card", () => ({
  CompanyLaborRolesCard: () => null,
}));
vi.mock("@/components/companies/company-profile-form", () => ({ CompanyProfileForm: () => null }));

import { CompanySettingsSection } from "../company-settings-section";

const company = (join_code: string) => ({
  id: "c1",
  legal_name: "Folio Demo",
  role: "admin",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  join_code,
});

describe("CompanySettingsSection join code", () => {
  it("shows the rotated join code after a member is removed", async () => {
    mockFetchMyCompanies
      .mockResolvedValueOnce({ ok: true, data: [company("T9HM-T9BD")] })
      .mockResolvedValueOnce({ ok: true, data: [company("N2TZ-H7QW")] });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CompanySettingsSection />
      </NextIntlClientProvider>
    );

    expect(await screen.findByTestId("join-code")).toHaveTextContent("T9HM-T9BD");
    await userEvent.click(screen.getByRole("button", { name: "boot member" }));
    await waitFor(() => expect(screen.getByTestId("join-code")).toHaveTextContent("N2TZ-H7QW"));
    expect(mockFetchMyCompanies).toHaveBeenCalledTimes(2);
  });
});
