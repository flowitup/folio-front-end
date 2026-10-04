/**
 * Labor payment notes — the per-worker monthly note on the Payments tab:
 * the row shows the note and (for managers) the add/edit button, and the
 * dialog saves the typed text or clears it when emptied.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LaborPaymentRow } from "../labor-payment-row";
import { LaborPaymentNoteDialog } from "../labor-payment-note-dialog";
import type { WorkerPaymentRow } from "../labor-payments-tab-state";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string, params?: Record<string, unknown>) => {
    const full = ns ? `${ns}.${key}` : key;
    if (!params) return full;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), full);
  },
  useLocale: () => "en",
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

vi.mock("@/lib/api/invoice-api", () => ({ fetchInvoicesWithMeta: vi.fn() }));

const row: WorkerPaymentRow = {
  worker_id: "w1",
  worker_name: "Ana Lopez",
  days_worked: 10,
  owed: 1000,
  paid: 400,
  balance: 600,
  invoice_count: 1,
  status: "partial",
};

function renderRow(props: Partial<React.ComponentProps<typeof LaborPaymentRow>> = {}) {
  return render(
    <LaborPaymentRow
      row={row}
      projectId="p1"
      month="2026-09"
      canManage
      reloadSignal={0}
      onRecordPayment={vi.fn()}
      variant="mobile"
      {...props}
    />,
  );
}

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("LaborPaymentRow note", () => {
  it("shows the note and an edit button for managers", () => {
    const onEditNote = vi.fn();
    renderRow({ note: "Rest paid in cash", onEditNote });

    expect(screen.getByTestId("labor-payment-note-mobile-w1").textContent).toContain("Rest paid in cash");
    const button = screen.getByTestId("labor-payment-note-button-mobile-w1");
    expect(button.getAttribute("aria-label")).toBe("labor.payments.editNote");
    fireEvent.click(button);
    expect(onEditNote).toHaveBeenCalledOnce();
  });

  it("offers 'add note' when there is none and hides the note line", () => {
    renderRow({ onEditNote: vi.fn() });

    expect(screen.queryByTestId("labor-payment-note-mobile-w1")).toBeNull();
    expect(screen.getByTestId("labor-payment-note-button-mobile-w1").getAttribute("aria-label")).toBe(
      "labor.payments.addNote",
    );
  });

  it("shows the note read-only to people who cannot manage payments", () => {
    renderRow({ canManage: false, note: "Waiting for transfer", onEditNote: vi.fn() });

    expect(screen.getByTestId("labor-payment-note-mobile-w1").textContent).toContain("Waiting for transfer");
    expect(screen.queryByTestId("labor-payment-note-button-mobile-w1")).toBeNull();
  });
});

describe("LaborPaymentNoteDialog", () => {
  function renderDialog(initialNote: string, onSave = vi.fn().mockResolvedValue(undefined)) {
    const onOpenChange = vi.fn();
    render(
      <LaborPaymentNoteDialog
        open
        onOpenChange={onOpenChange}
        workerName="Ana Lopez"
        periodLabel="September 2026"
        initialNote={initialNote}
        onSave={onSave}
      />,
    );
    return { onSave, onOpenChange, input: screen.getByTestId("labor-payment-note-input") };
  }

  it("saves the typed note and closes", async () => {
    const { onSave, onOpenChange, input } = renderDialog("");
    expect(screen.getByText("labor.payments.noteTitle".replace("{name}", "Ana Lopez"))).toBeTruthy();

    const save = screen.getByRole("button", { name: "labor.payments.noteSave" });
    expect(save).toHaveProperty("disabled", true);

    fireEvent.change(input, { target: { value: "Paid the rest on the 12th" } });
    fireEvent.click(save);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSave).toHaveBeenCalledWith("Paid the rest on the 12th");
    expect(toastSuccess).toHaveBeenCalledWith("labor.payments.noteSavedToast");
  });

  it("clears the note when emptied", async () => {
    const { onSave, input } = renderDialog("Old note");

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "labor.payments.noteSave" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("labor.payments.noteClearedToast"));
    expect(onSave).toHaveBeenCalledWith("   ");
  });

  it("keeps the dialog open and reports a failed save", async () => {
    const { onOpenChange, input } = renderDialog("", vi.fn().mockRejectedValue(new Error("boom")));

    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "labor.payments.noteSave" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("labor.payments.noteSaveFailed"));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
