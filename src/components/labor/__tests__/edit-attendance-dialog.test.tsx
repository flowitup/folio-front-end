/**
 * Tests for EditAttendanceDialog component (Phase 3d).
 *
 * The dialog is edit-only — it hydrates from an existing entry, lets
 * the user tweak shift/supplement/override/note, and calls onSave with
 * the updated payload. The worker + date are fixed identity for the
 * row and are surfaced as read-only labels.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditAttendanceDialog } from "../edit-attendance-dialog";
import type { LaborEntry } from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockEntry: LaborEntry = {
  id: "entry-1",
  worker_id: "worker-1",
  worker_name: "Alice",
  date: "2026-05-13",
  amount_override: null,
  effective_cost: 100,
  note: null,
  shift_type: "full",
  supplement_hours: 0,
  created_at: "2026-05-13T00:00:00Z",
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof EditAttendanceDialog>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  render(
    <EditAttendanceDialog
      open
      entry={mockEntry}
      onSave={onSave}
      onOpenChange={onOpenChange}
      {...overrides}
    />,
  );
  return { onSave, onOpenChange };
}

describe("EditAttendanceDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the worker name + date as read-only labels", () => {
    renderDialog();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    // Date is formatted; just check the year is rendered.
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("hydrates form fields from the entry", () => {
    renderDialog({
      entry: {
        ...mockEntry,
        amount_override: 150,
        supplement_hours: 2,
        note: "double shift",
      },
    });
    expect(screen.getByLabelText(/override/i)).toHaveValue(150);
    expect(screen.getByLabelText(/supplement/i)).toHaveValue(2);
    expect(screen.getByLabelText(/^note$/i)).toHaveValue("double shift");
  });

  it("disables save when supplement is out of range (> 12)", () => {
    renderDialog();
    const supplement = screen.getByLabelText(/supplement/i);
    fireEvent.change(supplement, { target: { value: "13" } });
    const save = screen.getByRole("button", { name: /save/i });
    expect(save).toBeDisabled();
  });

  it("calls onSave with the modified payload", async () => {
    const { onSave } = renderDialog();
    const note = screen.getByLabelText(/^note$/i);
    fireEvent.change(note, { target: { value: "updated" } });
    const save = screen.getByRole("button", { name: /save/i });
    fireEvent.click(save);
    // Wait for the promise to settle.
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ note: "updated", shift_type: "full" }),
    );
  });

  it("renders nothing inside when entry is null", () => {
    renderDialog({ entry: null });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("sends explicit nulls when override and note are cleared", async () => {
    // PATCH semantics: undefined would be dropped from the JSON body and the
    // server would keep the old values — null is the only way to clear.
    const { onSave } = renderDialog({
      entry: { ...mockEntry, amount_override: 150, note: "stale" },
    });
    fireEvent.change(screen.getByLabelText(/override/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^note$/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ amount_override: null, note: null }),
    );
  });
});
