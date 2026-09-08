/**
 * Regression tests for the M3 fix: AssignMemberDialog must only offer the
 * "manager" role option when the caller is a company admin — a plain
 * manager assigning an insider may only ever hand out "member" (mirrors
 * the backend's PUT /assignments authorization, see assignments.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssignMemberDialog } from "../assign-member-dialog";
import type { CompanyDirectoryEntry } from "@/lib/api/companies-members";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const t: Record<string, string> = {
      "assign.dialogTitle": "Assign a member",
      "assign.dialogDescription": "Assign an existing company member to this project.",
      "assign.personLabel": "Person",
      "assign.personPlaceholder": "Search…",
      "assign.personEmpty": "No one found",
      "assign.roleLabel": "Role",
      "assign.roleMember": "Member",
      "assign.roleManager": "Manager",
      "assign.submit": "Assign",
      "assign.successToast": "Assigned.",
      "invite.cancel": "Cancel",
    };
    return t[key] ?? key;
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { ENTRIES } = vi.hoisted(() => ({
  ENTRIES: [
    {
      person_id: "p1",
      name: "Alice Manager",
      phone: "+33600000001",
      linked_user_id: "u1",
      assigned_project_ids: [],
      is_active: true,
      pending: false,
      labor_role_id: null,
      default_daily_rate: null,
    },
  ] as CompanyDirectoryEntry[],
}));

const mockFetchDirectory = vi.fn();
const mockAssign = vi.fn();

vi.mock("@/app/[locale]/(app)/settings/_actions/company-settings-actions", () => ({
  fetchCompanyDirectoryAction: (...args: unknown[]) => mockFetchDirectory(...args),
  assignProjectMemberAction: (...args: unknown[]) => mockAssign(...args),
}));

// Mock the Combobox as a native <select> for testability.
vi.mock("@/components/ui/combobox", () => ({
  Combobox: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select aria-label="Person" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

// Mock the Select as a native <select> for testability.
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
    <select aria-label="Role" value={value} onChange={(e) => onValueChange(e.target.value)}>
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

describe("AssignMemberDialog — role options (M3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchDirectory.mockResolvedValue({ ok: true, data: ENTRIES });
  });

  it("offers only Member when the caller is not a company admin", async () => {
    render(
      <AssignMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        companyId="c1"
        excludeUserIds={[]}
        canAssignManager={false}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Person")).toBeInTheDocument());
    const roleSelect = screen.getByLabelText("Role") as HTMLSelectElement;
    const optionValues = Array.from(roleSelect.options).map((o) => o.value);
    expect(optionValues).toEqual(["member"]);
  });

  it("offers Member and Manager when the caller is a company admin", async () => {
    render(
      <AssignMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        companyId="c1"
        excludeUserIds={[]}
        canAssignManager={true}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Person")).toBeInTheDocument());
    const roleSelect = screen.getByLabelText("Role") as HTMLSelectElement;
    const optionValues = Array.from(roleSelect.options).map((o) => o.value);
    expect(optionValues).toEqual(["member", "manager"]);
  });

  it("submits with the manager role only when the caller can assign it", async () => {
    mockAssign.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();

    render(
      <AssignMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        companyId="c1"
        excludeUserIds={[]}
        canAssignManager={true}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Person")).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("Person"), "u1");
    await user.selectOptions(screen.getByLabelText("Role"), "manager");
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith("proj-1", "u1", "manager");
    });
  });

  it("surfaces a directory fetch failure instead of an empty picker", async () => {
    mockFetchDirectory.mockResolvedValue({
      ok: false,
      error: { code: "generic", message: "Could not load the directory." },
    });
    const { toast } = await import("sonner");

    render(
      <AssignMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        companyId="c1"
        excludeUserIds={[]}
        canAssignManager={true}
      />
    );

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Could not load the directory.");
    });
  });
});
