import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { AttachedUser } from "@/types/companies";

const { mockList, mockSet } = vi.hoisted(() => ({ mockList: vi.fn(), mockSet: vi.fn() }));
vi.mock("@/app/[locale]/(app)/settings/_actions/company-settings-actions", () => ({
  listMemberGrantsAction: mockList,
  setMemberGrantAction: mockSet,
  removeMemberGrantAction: vi.fn(),
}));
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ projects: [{ id: "p-1", name: "Tower", company_id: "c-1" }] }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MemberGrantsEditor } from "../member-grants-editor";

function renderEditor() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MemberGrantsEditor
        open
        onOpenChange={vi.fn()}
        companyId="c-1"
        target={{ user_id: "u-1", display_name: "Bravo" } as AttachedUser}
      />
    </NextIntlClientProvider>
  );
}

describe("MemberGrantsEditor scope", () => {
  beforeEach(() => {
    mockList.mockReset();
    mockSet.mockReset();
    mockSet.mockResolvedValue({ ok: true, data: {} });
  });

  it("locks a company-wide-only permission (library) to the company-wide scope", async () => {
    mockList.mockResolvedValue({
      ok: true,
      data: {
        grants: [],
        customisable: ["bibliotheque:manage", "project:update"],
        company_wide_only: ["bibliotheque:manage", "inventory:manage"],
      },
    });
    renderEditor();
    await screen.findByText(en.companySettings.grants.empty);
    const [, , scope] = screen.getAllByRole("combobox");
    expect(scope).toBeDisabled();
    expect(scope).toHaveTextContent(en.companySettings.grants.scopeCompanyWide);

    fireEvent.click(screen.getByRole("button", { name: en.companySettings.grants.add }));
    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith("c-1", "u-1", "bibliotheque:manage", "grant", null)
    );
  });

  it("keeps the project scope available for project permissions", async () => {
    mockList.mockResolvedValue({
      ok: true,
      data: { grants: [], customisable: ["project:update"], company_wide_only: ["bibliotheque:manage"] },
    });
    renderEditor();
    await screen.findByText(en.companySettings.grants.empty);
    const [, , scope] = screen.getAllByRole("combobox");
    expect(scope).not.toBeDisabled();
  });
});
