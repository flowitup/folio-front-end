/**
 * Leaving a company takes its projects with it: the shared project list must
 * be refetched, and someone left with no company at all must go through the
 * dashboard's onboarding gate instead of staying on stale data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const { mockFetchMyCompanies, mockRefetchProjects } = vi.hoisted(() => ({
  mockFetchMyCompanies: vi.fn(),
  mockRefetchProjects: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  fetchMyCompaniesAction: mockFetchMyCompanies,
}));
vi.mock("@/context/ProjectContext", () => ({
  useOptionalProject: () => ({ refetch: mockRefetchProjects }),
}));
vi.mock("@/components/companies/my-company-card", () => ({
  MyCompanyCard: ({ onDetached }: { onDetached?: () => void }) => (
    <button type="button" onClick={onDetached}>
      leave company
    </button>
  ),
}));
vi.mock("@/components/companies/join-company-dialog", () => ({ JoinCompanyDialog: () => null }));
vi.mock("@/components/companies/company-labor-roles-card", () => ({
  CompanyLaborRolesCard: () => null,
}));

import { CompanySettingsSection } from "../company-settings-section";

const company = (id: string, is_primary: boolean) => ({
  id,
  legal_name: `Company ${id}`,
  role: "member",
  is_primary,
  attached_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  join_code: null,
});

const originalLocation = window.location;
const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, assign },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

function renderSection() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CompanySettingsSection />
    </NextIntlClientProvider>
  );
}

describe("CompanySettingsSection after leaving a company", () => {
  it("refetches the project list when other companies remain", async () => {
    mockFetchMyCompanies
      .mockResolvedValueOnce({ ok: true, data: [company("c1", true), company("c2", false)] })
      .mockResolvedValueOnce({ ok: true, data: [company("c2", true)] });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "leave company" }));

    await waitFor(() => expect(mockRefetchProjects).toHaveBeenCalledOnce());
    expect(assign).not.toHaveBeenCalled();
  });

  it("sends someone left with no company through the dashboard gate", async () => {
    mockFetchMyCompanies
      .mockResolvedValueOnce({ ok: true, data: [company("c1", true)] })
      .mockResolvedValueOnce({ ok: true, data: [] });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "leave company" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/en/dashboard"));
  });
});
