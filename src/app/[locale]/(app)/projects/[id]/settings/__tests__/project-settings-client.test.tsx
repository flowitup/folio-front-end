import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Project } from "@/types/project";

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("../actions", () => ({ updateInvoicePrefix: vi.fn() }));
vi.mock("../bank-credit-card", () => ({ BankCreditCard: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ProjectSettingsClient } from "../project-settings-client";

const PROJECT = {
  id: "p-1",
  name: "Villa",
  invoice_prefix: "VIL",
  my_permissions: ["project:read"],
} as unknown as Project;

function renderClient(project: Project = PROJECT) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProjectSettingsClient project={project} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("ProjectSettingsClient — who may edit", () => {
  it("shows the prefix read-only, without Save, to a member", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"] } });
    renderClient();
    expect(screen.getByLabelText(en.projects.invoicePrefix)).toBeDisabled();
    expect(screen.queryByRole("button", { name: en.projects.save })).toBeNull();
    expect(screen.getByTestId("settings-read-only")).toHaveTextContent(en.projects.settingsReadOnly);
  });

  it("lets a manager edit and save", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: [] } });
    renderClient({ ...PROJECT, my_permissions: ["project:read", "project:update"] } as Project);
    expect(screen.getByLabelText(en.projects.invoicePrefix)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: en.projects.save })).toBeInTheDocument();
  });
});
