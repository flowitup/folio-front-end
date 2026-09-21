/**
 * Regression tests for CreateProjectDialog.
 *
 * Guards against the "create-project buttons do nothing" bug — proves the
 * dialog opens, submits to the API, surfaces errors, and notifies the parent
 * on success.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateProjectDialog } from "../create-project-dialog";

vi.mock("@/lib/api/projects", () => ({
  createProject: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const t: Record<string, string> = {
      createProjectTitle: "Create new project",
      projectNameOptional: "Project name (optional)",
      projectNamePlaceholder: "Defaults to the address",
      projectAddress: "Address",
      projectAddressPlaceholder: "e.g. 12 Rue des Martyrs, Paris",
      budgetLabel: "Budget (€)",
      budgetSourceLabelOptional: "Funding source (optional)",
      budgetSourcePlaceholder: "e.g. Bank loan BNP",
      budgetInvalid: "Budget must be a positive number",
      create: "Create",
      creating: "Creating...",
      cancel: "Cancel",
      createProjectError: "Failed to create project. Please try again.",
      createProjectAddressRequired: "Address is required",
    };
    return t[key] ?? key;
  },
}));

const { createProject } = await import("@/lib/api/projects");
const mockCreateProject = vi.mocked(createProject);

const FAKE_PROJECT = {
  id: "p-1",
  name: "Riverside Tower",
  address: "12 Rue des Martyrs",
  owner_id: "u-1",
  user_count: 0,
  created_at: "2026-05-03T00:00:00Z",
};

describe("CreateProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form fields when open", () => {
    render(
      <CreateProjectDialog open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.getByText("Create new project")).toBeInTheDocument();
    const addressInput = screen.getByLabelText("Address");
    const nameInput = screen.getByLabelText("Project name (optional)");
    expect(addressInput).toBeRequired();
    expect(nameInput).not.toBeRequired();
    // The address is the first field: it precedes the name in the DOM.
    expect(addressInput.compareDocumentPosition(nameInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("submits valid input, calls API, and notifies parent", async () => {
    mockCreateProject.mockResolvedValueOnce(FAKE_PROJECT);
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CreateProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onCreated={onCreated}
      />
    );

    await user.type(screen.getByLabelText("Address"), "12 Rue des Martyrs");
    await user.type(screen.getByLabelText("Project name (optional)"), "Riverside Tower");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        address: "12 Rue des Martyrs",
        name: "Riverside Tower",
      });
    });
    expect(onCreated).toHaveBeenCalledWith(FAKE_PROJECT);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("omits the name when blank so the backend labels the project by its address", async () => {
    mockCreateProject.mockResolvedValueOnce(FAKE_PROJECT);
    const user = userEvent.setup();

    render(<CreateProjectDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Address"), "12 Rue des Martyrs");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        address: "12 Rue des Martyrs",
      });
    });
  });

  it("disables Create button until an address is typed, even with a name", async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog open={true} onOpenChange={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Create" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Project name (optional)"), "Nameless");
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Address"), "12 Rue des Martyrs");
    expect(submit).toBeEnabled();
  });

  it("shows error message when API call fails", async () => {
    mockCreateProject.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <CreateProjectDialog open={true} onOpenChange={onOpenChange} />
    );

    await user.type(screen.getByLabelText("Address"), "X");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(
      await screen.findByText("Failed to create project. Please try again.")
    ).toBeInTheDocument();
    // Dialog stays open so user can retry.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("Cancel button closes the dialog without API call", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <CreateProjectDialog open={true} onOpenChange={onOpenChange} />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders budget and funding source inputs", () => {
    render(<CreateProjectDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("Budget (€)")).toBeInTheDocument();
    expect(screen.getByLabelText("Funding source (optional)")).toBeInTheDocument();
  });

  it("submits with budget and funding source when provided", async () => {
    mockCreateProject.mockResolvedValueOnce(FAKE_PROJECT);
    const user = userEvent.setup();

    render(<CreateProjectDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Address"), "12 Rue des Martyrs");
    await user.type(screen.getByLabelText("Budget (€)"), "100000");
    await user.type(screen.getByLabelText("Funding source (optional)"), "Bank loan BNP");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        address: "12 Rue des Martyrs",
        budget: 100000,
        budget_source: "Bank loan BNP",
      });
    });
  });

  it("omits budget and budget_source from payload when inputs are empty", async () => {
    mockCreateProject.mockResolvedValueOnce(FAKE_PROJECT);
    const user = userEvent.setup();

    render(<CreateProjectDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Address"), "12 Rue des Martyrs");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        address: "12 Rue des Martyrs",
      });
    });
  });

  it("shows error when budget is negative", async () => {
    const user = userEvent.setup();

    render(<CreateProjectDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Address"), "12 Rue des Martyrs");
    await user.type(screen.getByLabelText("Budget (€)"), "-500");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(
      await screen.findByText("Budget must be a positive number")
    ).toBeInTheDocument();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});
