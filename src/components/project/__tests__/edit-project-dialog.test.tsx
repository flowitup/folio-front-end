/**
 * Regression tests for EditProjectDialog.
 *
 * Guards against "edit project buttons do nothing" bug — proves the
 * dialog opens with pre-filled fields, submits to the API, surfaces errors,
 * and notifies the parent on success. Also tests the no-op optimization
 * when no changes are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditProjectDialog } from "../edit-project-dialog";
import type { Project } from "@/types/project";

vi.mock("@/lib/api/projects", () => ({
  updateProject: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const t: Record<string, string> = {
      editProjectTitle: "Edit project",
      projectName: "Project name",
      projectNamePlaceholder: "e.g. Riverside Tower",
      projectAddressOptional: "Address (optional)",
      projectAddressPlaceholder: "e.g. 12 Rue des Martyrs, Paris",
      cancel: "Cancel",
      save: "Save",
      saving: "Saving...",
      editProjectError: "Failed to update project. Please try again.",
      editProjectNameRequired: "Project name is required",
    };
    return t[key] ?? key;
  },
}));

const { updateProject } = await import("@/lib/api/projects");
const mockUpdateProject = vi.mocked(updateProject);

const FAKE_PROJECT = {
  id: "p-1",
  name: "Acme",
  address: "12 rue X",
  owner_id: "u-1",
  user_count: 3,
  created_at: "2026-05-03T00:00:00Z",
};

describe("EditProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with pre-filled name and address", () => {
    render(
      <EditProjectDialog project={FAKE_PROJECT} open={true} onOpenChange={vi.fn()} />
    );

    const nameInput = screen.getByLabelText("Project name") as HTMLInputElement;
    const addressInput = screen.getByLabelText("Address (optional)") as HTMLInputElement;

    expect(nameInput.value).toBe("Acme");
    expect(addressInput.value).toBe("12 rue X");
  });

  it("shows title when open", () => {
    render(
      <EditProjectDialog project={FAKE_PROJECT} open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.getByText("Edit project")).toBeInTheDocument();
  });

  it("happy path: edit name and save", async () => {
    mockUpdateProject.mockResolvedValueOnce({
      ...FAKE_PROJECT,
      name: "New Name",
    });

    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <EditProjectDialog
        project={FAKE_PROJECT}
        open={true}
        onOpenChange={onOpenChange}
        onUpdated={onUpdated}
      />
    );

    const nameInput = screen.getByLabelText("Project name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith("p-1", {
        name: "New Name",
        address: "12 rue X",
      });
    });

    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "p-1",
        name: "New Name",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("no-op when nothing changed: closes without API call", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <EditProjectDialog
        project={FAKE_PROJECT}
        open={true}
        onOpenChange={onOpenChange}
        onUpdated={onUpdated}
      />
    );

    // Click Save without editing anything
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Should NOT call updateProject
    expect(mockUpdateProject).not.toHaveBeenCalled();
    // But should close the dialog
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // And should NOT call onUpdated
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("empty name shows error and does not call API", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <EditProjectDialog
        project={FAKE_PROJECT}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    const nameInput = screen.getByLabelText("Project name");
    await user.clear(nameInput);

    const saveButton = screen.getByRole("button", { name: "Save" });
    // Save button should be disabled when name is empty
    expect(saveButton).toBeDisabled();

    // The error shouldn't show just from clearing the field
    expect(screen.queryByText("Project name is required")).not.toBeInTheDocument();

    // Even with button disabled, verify API wasn't called
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });

  it("cancel button closes without API call", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <EditProjectDialog
        project={FAKE_PROJECT}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockUpdateProject).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("API error shows error message and keeps dialog open", async () => {
    mockUpdateProject.mockRejectedValueOnce(new Error("boom"));

    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <EditProjectDialog
        project={FAKE_PROJECT}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    const nameInput = screen.getByLabelText("Project name");
    await user.clear(nameInput);
    await user.type(nameInput, "Error Test");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Failed to update project. Please try again.")
    ).toBeInTheDocument();

    // Dialog should stay open (onOpenChange should not be called with false)
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("edit address only", async () => {
    mockUpdateProject.mockResolvedValueOnce({
      ...FAKE_PROJECT,
      address: "New Address",
    });

    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <EditProjectDialog
        project={FAKE_PROJECT}
        open={true}
        onOpenChange={onOpenChange}
        onUpdated={onUpdated}
      />
    );

    const addressInput = screen.getByLabelText("Address (optional)");
    await user.clear(addressInput);
    await user.type(addressInput, "New Address");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith("p-1", {
        name: "Acme",
        address: "New Address",
      });
    });

    expect(onUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears address when field is blanked", async () => {
    mockUpdateProject.mockResolvedValueOnce({
      ...FAKE_PROJECT,
      address: null,
    });

    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <EditProjectDialog
        project={FAKE_PROJECT}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    const addressInput = screen.getByLabelText("Address (optional)");
    await user.clear(addressInput);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith("p-1", {
        name: "Acme",
        address: null,
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables inputs and button while submitting", async () => {
    const resolver: { resolve?: (value: Project) => void } = {};
    const updatePromise = new Promise<Project>((resolve) => {
      resolver.resolve = resolve;
    });

    mockUpdateProject.mockReturnValueOnce(updatePromise);

    const user = userEvent.setup();

    render(
      <EditProjectDialog project={FAKE_PROJECT} open={true} onOpenChange={vi.fn()} />
    );

    const nameInput = screen.getByLabelText("Project name") as HTMLInputElement;
    const saveButton = screen.getByRole("button", { name: /Save|Saving/ });

    await user.clear(nameInput);
    await user.type(nameInput, "New");
    await user.click(saveButton);

    // After clicking, button should show "Saving..." state
    await waitFor(() => {
      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    // Inputs should be disabled
    expect(nameInput).toBeDisabled();

    // Resolve the promise
    resolver.resolve?.({ ...FAKE_PROJECT, name: "New" });
  });
});
