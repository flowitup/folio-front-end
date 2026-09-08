/**
 * Regression tests for the M1 company-scoping fix: CreateProjectDialog must
 * show a company picker (and send `company_id`) only for an admin of 2+
 * companies; a single-company admin gets no picker and no `company_id` in
 * the payload — unchanged behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateProjectDialog } from "../create-project-dialog";
import type { UserCompanySummary } from "@/lib/auth/permissions";

vi.mock("@/lib/api/projects", () => ({
  createProject: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const t: Record<string, string> = {
      createProjectTitle: "Create new project",
      projectName: "Project name",
      projectNamePlaceholder: "e.g. Riverside Tower",
      projectAddressOptional: "Address (optional)",
      projectAddressPlaceholder: "e.g. 12 Rue des Martyrs, Paris",
      budgetLabel: "Budget (€)",
      budgetSourceLabelOptional: "Funding source (optional)",
      budgetSourcePlaceholder: "e.g. Bank loan BNP",
      budgetInvalid: "Budget must be a positive number",
      create: "Create",
      creating: "Creating...",
      cancel: "Cancel",
      createProjectError: "Failed to create project. Please try again.",
      createProjectNameRequired: "Project name is required",
      createProjectCompanyLabel: "Company",
      createProjectCompanyPlaceholder: "Choose a company",
      createProjectCompanyRequired: "Choose which company this project belongs to",
    };
    return t[key] ?? key;
  },
}));

// Mock shadcn Select — renders a native <select> for testability.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="Company"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const { createProject } = await import("@/lib/api/projects");
const mockCreateProject = vi.mocked(createProject);

const FAKE_PROJECT = {
  id: "p-1",
  name: "Riverside Tower",
  address: null,
  owner_id: "u-1",
  user_count: 0,
  created_at: "2026-05-03T00:00:00Z",
};

const TWO_COMPANIES: UserCompanySummary[] = [
  { id: "c1", legal_name: "Folio Demo SARL", role: "admin", is_primary: true },
  { id: "c2", legal_name: "Second Co", role: "admin", is_primary: false },
];

const ONE_COMPANY: UserCompanySummary[] = [
  { id: "c1", legal_name: "Folio Demo SARL", role: "admin", is_primary: true },
];

describe("CreateProjectDialog — company scoping (M1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders no picker and omits company_id for a single-company admin", async () => {
    mockCreateProject.mockResolvedValueOnce(FAKE_PROJECT);
    const user = userEvent.setup();

    render(
      <CreateProjectDialog open={true} onOpenChange={vi.fn()} adminCompanies={ONE_COMPANY} />
    );

    expect(screen.queryByLabelText("Company")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Project name"), "Riverside Tower");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        name: "Riverside Tower",
        address: null,
      });
    });
  });

  it("renders a required picker and sends the picked company_id for an admin of 2+ companies", async () => {
    mockCreateProject.mockResolvedValueOnce(FAKE_PROJECT);
    const user = userEvent.setup();

    render(
      <CreateProjectDialog open={true} onOpenChange={vi.fn()} adminCompanies={TWO_COMPANIES} />
    );

    // Defaults to the primary company.
    expect(screen.getByLabelText("Company")).toHaveValue("c1");

    await user.selectOptions(screen.getByLabelText("Company"), "c2");
    await user.type(screen.getByLabelText("Project name"), "Riverside Tower");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        name: "Riverside Tower",
        address: null,
        company_id: "c2",
      });
    });
  });
});
