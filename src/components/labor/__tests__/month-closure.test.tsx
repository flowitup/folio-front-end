/**
 * "Chốt tháng" (owner decision QĐ-10): the Summary tab's close / closed panel,
 * and the "Tháng X đã chốt. Vẫn lưu?" question every save into a closed month
 * asks first. Closing locks nothing: confirming saves as usual.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";

import { MonthClosurePanel } from "../month-closure-panel";
import { EditAttendanceDialog } from "../edit-attendance-dialog";
import { LaborMonthClosureContext, useLaborMonthClosuresState } from "../month-closure-context";
import type { LaborEntry, LaborMonthClosure } from "@/types/labor";

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  // "key|param|param": lets a test read which values a message was given.
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? [key, ...Object.values(params).map(String)].join("|") : key,
}));

const fetchLaborMonthClosures = vi.fn();
const closeLaborMonth = vi.fn();
const reopenLaborMonth = vi.fn();
const fetchLaborEntries = vi.fn();
vi.mock("@/lib/api/labor", () => ({
  fetchLaborMonthClosures: (...a: unknown[]) => fetchLaborMonthClosures(...a),
  closeLaborMonth: (...a: unknown[]) => closeLaborMonth(...a),
  reopenLaborMonth: (...a: unknown[]) => reopenLaborMonth(...a),
  fetchLaborEntries: (...a: unknown[]) => fetchLaborEntries(...a),
  formatEUR: (n: number) => `${n.toFixed(2)} €`,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CLOSED: LaborMonthClosure = {
  project_id: "p1",
  month: "2026-10",
  closed_at: "2026-11-02T09:00:00Z",
  closed_by_user_id: "u-admin",
  closed_by_name: "Admin An",
  edited_after_close: 0,
  last_edited_at: null,
  last_edited_by_user_id: null,
  last_edited_by_name: null,
  edits: [],
};

const EDITED: LaborMonthClosure = {
  ...CLOSED,
  edited_after_close: 2,
  last_edited_at: "2026-11-20T14:15:00Z",
  last_edited_by_user_id: "u-bob",
  last_edited_by_name: "Bob Manager",
  edits: [
    {
      kind: "entry_created",
      edited_at: "2026-11-20T14:15:00Z",
      user_id: "u-bob",
      user_name: "Bob Manager",
      entry_id: "e1",
      worker_id: "w1",
      worker_name: "Jean Dupont",
      entry_date: "2026-10-15",
    },
    {
      kind: "payment_created",
      edited_at: "2026-11-19T10:00:00Z",
      user_id: "u-admin",
      user_name: "Admin An",
      entry_id: "i1",
      worker_id: "w1",
      worker_name: "Jean Dupont",
      entry_date: null,
    },
  ],
};

/** Mounts the real state hook as the page does, with `closures` from the API. */
function Provider({ children, canManage = true }: { children: ReactNode; canManage?: boolean }) {
  const { api, dialog } = useLaborMonthClosuresState({ projectId: "p1", enabled: true, canManage });
  return (
    <LaborMonthClosureContext.Provider value={api}>
      {children}
      {dialog}
    </LaborMonthClosureContext.Provider>
  );
}

async function renderPanel(closures: LaborMonthClosure[], { canManage = true, owed = 0, unsettled = 0 } = {}) {
  fetchLaborMonthClosures.mockResolvedValue(closures);
  render(
    <Provider canManage={canManage}>
      <MonthClosurePanel projectId="p1" month="2026-10" owed={owed} unsettledPayments={unsettled} />
    </Provider>,
  );
  await waitFor(() => expect(fetchLaborMonthClosures).toHaveBeenCalledWith("p1"));
  // Let the fetched list land.
  await act(async () => {});
}

describe("MonthClosurePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLaborEntries.mockResolvedValue([]);
  });

  it("offers a manager 'Chốt tháng' with a checklist computed from the page's data", async () => {
    fetchLaborEntries.mockResolvedValue([
      { id: "a", status: "pending" },
      { id: "b", status: "validated" },
      { id: "c", status: "pending" },
    ]);
    await renderPanel([], { owed: 450, unsettled: 3 });

    fireEvent.click(screen.getByTestId("month-close-button"));
    expect(screen.getByTestId("month-close-button")).toHaveTextContent("closeButton|10/2026");
    await waitFor(() => expect(screen.getByTestId("month-close-check-pending")).toHaveTextContent("2"));
    expect(fetchLaborEntries).toHaveBeenCalledWith("p1", { from: "2026-10-01", to: "2026-10-31" });
    expect(screen.getByTestId("month-close-check-unassigned")).toHaveTextContent("3");
    expect(screen.getByTestId("month-close-check-owed")).toHaveTextContent("450.00 €");
    expect(screen.getByTestId("month-close-check-warning")).toBeInTheDocument();

    closeLaborMonth.mockResolvedValue(CLOSED);
    fetchLaborMonthClosures.mockResolvedValue([CLOSED]);
    fireEvent.click(screen.getByTestId("month-close-confirm"));
    await waitFor(() => expect(closeLaborMonth).toHaveBeenCalledWith("p1", "2026-10"));
    // After closing, the badge replaces the button.
    expect(await screen.findByTestId("month-closed-badge")).toHaveTextContent("closedBadge|10/2026");
  });

  it("shows an all-clear checklist when nothing is loose", async () => {
    await renderPanel([], { owed: 0, unsettled: 0 });
    fireEvent.click(screen.getByTestId("month-close-button"));
    await waitFor(() => expect(screen.getByTestId("month-close-check-pending")).toHaveTextContent("checkOk"));
    expect(screen.getByTestId("month-close-check-owed")).toHaveTextContent("checkOk");
    expect(screen.queryByTestId("month-close-check-warning")).not.toBeInTheDocument();
  });

  it("shows nothing to a viewer who may not close an open month", async () => {
    await renderPanel([], { canManage: false });
    expect(screen.queryByTestId("month-close-button")).not.toBeInTheDocument();
  });

  it("shows who closed the month and when, and lets a manager reopen it after asking", async () => {
    await renderPanel([CLOSED]);
    const badge = screen.getByTestId("month-closed-badge");
    expect(badge).toHaveTextContent("closedBadge|10/2026");
    expect(badge).toHaveTextContent("closedBy|Admin An|02/11/2026");
    expect(screen.queryByTestId("month-edited-after-close")).not.toBeInTheDocument();

    reopenLaborMonth.mockResolvedValue(undefined);
    fetchLaborMonthClosures.mockResolvedValue([]);
    fireEvent.click(screen.getByTestId("month-reopen-button"));
    // An in-app dialog, never window.confirm.
    fireEvent.click(await screen.findByRole("button", { name: "reopen" }));
    await waitFor(() => expect(reopenLaborMonth).toHaveBeenCalledWith("p1", "2026-10"));
    expect(await screen.findByTestId("month-close-button")).toBeInTheDocument();
  });

  it("a viewer without manage_labor sees the badge but no reopen", async () => {
    await renderPanel([CLOSED], { canManage: false });
    expect(screen.getByTestId("month-closed-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("month-reopen-button")).not.toBeInTheDocument();
  });

  it("warns when the month was changed after closing, naming the last person, with the list", async () => {
    await renderPanel([EDITED]);
    const warning = screen.getByTestId("month-edited-after-close");
    expect(warning).toHaveTextContent("editedAfterClose|2|Bob Manager|");
    expect(screen.queryByTestId("month-edits-list")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("month-edits-toggle"));
    const list = screen.getByTestId("month-edits-list");
    expect(list).toHaveTextContent("kinds.entry_created · Jean Dupont · 15/10/2026");
    expect(list).toHaveTextContent("kinds.payment_created · Jean Dupont");
    expect(list).toHaveTextContent("Bob Manager");
  });
});

describe("saving into a closed month", () => {
  const entry: LaborEntry = {
    id: "entry-1",
    worker_id: "w1",
    worker_name: "Jean Dupont",
    date: "2026-10-15",
    amount_override: null,
    effective_cost: 100,
    note: null,
    shift_type: "full",
    supplement_hours: 0,
    created_at: "2026-10-15T00:00:00Z",
  };

  async function renderEdit(closures: LaborMonthClosure[], day = entry.date) {
    fetchLaborMonthClosures.mockResolvedValue(closures);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <Provider>
        <EditAttendanceDialog open entry={{ ...entry, date: day }} onSave={onSave} onOpenChange={vi.fn()} />
      </Provider>,
    );
    await waitFor(() => expect(fetchLaborMonthClosures).toHaveBeenCalled());
    await act(async () => {});
    return onSave;
  }

  beforeEach(() => vi.clearAllMocks());

  it("asks 'Tháng X đã chốt. Vẫn lưu?' and saves once confirmed", async () => {
    const onSave = await renderEdit([CLOSED]);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText("writeTitle|10/2026")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "writeConfirm" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("does not save when the user cancels", async () => {
    const onSave = await renderEdit([CLOSED]);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await screen.findByText("writeTitle|10/2026");
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    await act(async () => {});
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves without asking when the month is open", async () => {
    const onSave = await renderEdit([CLOSED], "2026-11-03");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/writeTitle/)).not.toBeInTheDocument();
  });
});
