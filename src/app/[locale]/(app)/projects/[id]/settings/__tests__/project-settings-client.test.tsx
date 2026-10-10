import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Project } from "@/types/project";

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
const { mockUpdatePrefix, mockRefetch } = vi.hoisted(() => ({ mockUpdatePrefix: vi.fn(), mockRefetch: vi.fn() }));
vi.mock("../actions", () => ({ updateInvoicePrefix: mockUpdatePrefix }));
vi.mock("@/context/ProjectContext", () => ({ useOptionalProject: () => ({ refetch: mockRefetch }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
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

describe("ProjectSettingsClient — after a save", () => {
  it("treats the saved prefix as the new baseline", async () => {
    mockUseAuth.mockReturnValue({ user: { permissions: [] } });
    mockUpdatePrefix.mockResolvedValue({ ok: true });
    renderClient({ ...PROJECT, my_permissions: ["project:update"] } as Project);
    const input = screen.getByLabelText(en.projects.invoicePrefix);
    const save = screen.getByRole("button", { name: en.projects.save });

    fireEvent.change(input, { target: { value: "QAPM2" } });
    fireEvent.click(save);
    await waitFor(() => expect(mockUpdatePrefix).toHaveBeenCalledWith("p-1", "QAPM2"));
    await waitFor(() => expect(screen.getByRole("button", { name: en.projects.save })).toBeDisabled());

    // Going back to the old value is a change again.
    fireEvent.change(input, { target: { value: "VIL" } });
    expect(screen.getByRole("button", { name: en.projects.save })).not.toBeDisabled();
  });

  it("reloads the cached project list after a save", async () => {
    mockUseAuth.mockReturnValue({ user: { permissions: [] } });
    mockUpdatePrefix.mockResolvedValue({ ok: true });
    renderClient({ ...PROJECT, my_permissions: ["project:update"] } as Project);
    fireEvent.change(screen.getByLabelText(en.projects.invoicePrefix), { target: { value: "QAPM2" } });
    fireEvent.click(screen.getByRole("button", { name: en.projects.save }));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
  });
});

describe("ProjectSettingsClient — layout", () => {
  it("keeps the side gutters of the other project pages", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"] } });
    renderClient();
    // Without them the cards touched the screen edge at 375px and the sidebar on desktop.
    const root = screen.getByTestId("project-settings");
    expect(root.className).toContain("px-4");
    expect(root.className).toContain("lg:px-8");
    expect(root.className).toContain("pb-12");
  });
});

describe("ProjectSettingsClient — network failure", () => {
  it("toasts the error and frees Save when the save action cannot be reached", async () => {
    const { toast } = await import("sonner");
    mockUseAuth.mockReturnValue({ user: { permissions: [] } });
    // What a server action call does offline: the promise rejects.
    mockUpdatePrefix.mockRejectedValue(new TypeError("Failed to fetch"));
    renderClient({ ...PROJECT, my_permissions: ["project:update"] } as Project);
    fireEvent.change(screen.getByLabelText(en.projects.invoicePrefix), { target: { value: "QAV" } });
    fireEvent.click(screen.getByRole("button", { name: en.projects.save }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.projects.settingsSaveError));
    // Back to "Save", enabled: the prefix is still unsaved.
    await waitFor(() => expect(screen.getByRole("button", { name: en.projects.save })).not.toBeDisabled());
    expect(screen.queryByText(en.projects.saving)).toBeNull();
  });
});
