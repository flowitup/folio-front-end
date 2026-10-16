/**
 * AddWorkerDialog — the role list never goes stale (QA round 3, owner bug).
 *
 * - Opening the dialog reloads the company's roles.
 * - A save refused because of the role (400 InvalidLaborRole: deleted elsewhere,
 *   or another company's) clears the role, reloads the list and says so under the
 *   Role field instead of the generic "Failed to save worker.".
 * - The project's company reaches the role picker (inline Create adds there).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { AddWorkerDialog } from "../add-worker-dialog";
import { ApiError } from "@/lib/api/http";
import type { Worker } from "@/types/labor";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/persons/person-typeahead", () => ({ PersonTypeahead: () => null }));

const pickerProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
vi.mock("@/components/labor/role-select-with-create", () => ({
  RoleSelectWithCreate: (props: Record<string, unknown>) => {
    pickerProps.current = props;
    return <span data-testid="role-value">{String(props.value)}</span>;
  },
}));

const WORKER: Worker = {
  id: "worker-1",
  project_id: "proj-1",
  name: "Alice",
  phone: null,
  daily_rate: 120,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  role_id: "role-gone",
  role_name: "Thợ chính",
  role_color: "#3B82F6",
  role_slug: "tho_chinh",
};

const ROLE = { id: "role-1", name: "Carreleur", color: "#10B981", created_at: "2026-01-01" };

describe("AddWorkerDialog — role scope", () => {
  const onRefreshRoles = vi.fn().mockResolvedValue([ROLE]);
  const onSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    pickerProps.current = null;
  });

  function renderEdit() {
    return render(
      <AddWorkerDialog
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        editWorker={WORKER}
        roles={[ROLE]}
        palette={["#10B981"]}
        companyId="co-b"
        onRefreshRoles={onRefreshRoles}
      />,
    );
  }

  it("reloads the roles when it opens and passes the project's company on", () => {
    renderEdit();
    expect(onRefreshRoles).toHaveBeenCalledTimes(1);
    expect(pickerProps.current?.companyId).toBe("co-b");
    // The worker's own role shows even though it is not in the loaded list.
    expect(pickerProps.current?.selectedFallback).toEqual({
      name: "Thợ chính",
      color: "#3B82F6",
      slug: "tho_chinh",
    });
  });

  it("clears a refused role, reloads the list and explains it under the field", async () => {
    onSave.mockRejectedValueOnce(
      new ApiError("HTTP 400", 400, { error: "InvalidLaborRole", message: "Labor role not found" }),
    );
    renderEdit();
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(screen.getByText("errors.roleUnavailable")).toBeInTheDocument());
    expect(screen.getByTestId("role-value").textContent).toBe("null");
    expect(onRefreshRoles).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("errors.saveWorkerFailed")).toBeNull();
  });
});
