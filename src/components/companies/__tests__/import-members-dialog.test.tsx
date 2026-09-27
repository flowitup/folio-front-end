import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { MyCompany } from "@/types/companies";

const { mockDirectory } = vi.hoisted(() => ({ mockDirectory: vi.fn() }));
vi.mock("@/app/[locale]/(app)/settings/_actions/company-settings-actions", () => ({
  fetchCompanyDirectoryAction: mockDirectory,
  importMembersAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ImportMembersDialog } from "../import-members-dialog";

const entry = (person_id: string, name: string, phone: string) =>
  ({ person_id, name, phone }) as never;

describe("ImportMembersDialog", () => {
  it("marks people already in this company and leaves them unselectable", async () => {
    mockDirectory.mockImplementation(async (id: string) =>
      id === "target"
        ? { ok: true, data: [entry("p-1", "Ann", "+33600000071")] }
        : { ok: true, data: [entry("p-1", "Ann", "+33600000071"), entry("p-2", "Bob", "+33600000072")] }
    );
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ImportMembersDialog
          open
          onOpenChange={vi.fn()}
          companyId="target"
          sourceCompanies={[{ id: "source", legal_name: "Other" } as MyCompany]}
          onImported={vi.fn()}
        />
      </NextIntlClientProvider>
    );
    expect(await screen.findByText(en.companySettings.import.alreadyMember)).toBeInTheDocument();
    const [ann, bob] = screen.getAllByRole("checkbox");
    expect(ann).toBeDisabled();
    expect(bob).not.toBeDisabled();
    // Shown in the same format as the members table, not raw E.164.
    expect(screen.queryByText("+33600000071")).toBeNull();
  });
});
