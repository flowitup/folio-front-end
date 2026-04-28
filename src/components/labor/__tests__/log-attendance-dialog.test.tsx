/**
 * Tests for LogAttendanceDialog component — phase 05 supplement hours
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogAttendanceDialog } from "../log-attendance-dialog";
import type { Worker } from "@/types/labor";

// Mock next-intl — returns key as fallback so i18n keys work without translation files
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockWorkers: Worker[] = [
  {
    id: "worker-1",
    project_id: "proj-1",
    name: "Alice",
    phone: null,
    daily_rate: 100,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onSave: vi.fn(),
  workers: mockWorkers,
};

describe("LogAttendanceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onSave.mockResolvedValue(undefined);
  });

  describe("Submit button disabled states", () => {
    it("disables submit button when no shift selected and supplement_hours = 0 (empty row)", () => {
      render(<LogAttendanceDialog {...defaultProps} />);

      // Default state: shiftType=null, supplementHours=0 → empty row
      const submitBtn = screen.getByRole("button", { name: /save/i });
      expect(submitBtn).toBeDisabled();
    });

    it("disables submit button when supplement_hours is out of range (> 12)", () => {
      render(<LogAttendanceDialog {...defaultProps} />);

      // Set supplement hours to 13 (out of range)
      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      fireEvent.change(supplementInput, { target: { value: "13" } });

      const submitBtn = screen.getByRole("button", { name: /save/i });
      expect(submitBtn).toBeDisabled();
    });

    it("enables submit when no shift but supplement_hours = 3 (supplement-only row)", async () => {
      render(<LogAttendanceDialog {...defaultProps} />);

      // Select worker first
      const workerSelect = screen.getAllByRole("combobox")[0];
      fireEvent.change(workerSelect, { target: { value: "worker-1" } });

      // Set supplement hours to 3
      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      fireEvent.change(supplementInput, { target: { value: "3" } });

      const submitBtn = screen.getByRole("button", { name: /save/i });
      // No shift + supplement=3 is valid → button should NOT be disabled due to canSubmit
      // (worker selection is separate validation that runs on submit, not on canSubmit)
      expect(submitBtn).not.toBeDisabled();
    });
  });

  describe("Supplement-only submission (shift_type=null, supplement_hours>0)", () => {
    it("calls onSave with shift_type=null and supplement_hours=3 when no shift is selected", async () => {
      const user = userEvent.setup();
      render(<LogAttendanceDialog {...defaultProps} />);

      // Select the worker by clicking on combobox — use Radix Select pattern
      // The worker select is the first combobox
      const workerTriggers = screen.getAllByRole("combobox");
      // We need to interact with Radix Select — fire a direct value change via fireEvent on the hidden input
      // or we can directly set via the underlying select value. Since Radix UI in jsdom doesn't open popovers,
      // we trigger state via fireEvent on the hidden select element.
      // Workaround: find the hidden native select or use fireEvent on trigger.
      // Actually in jsdom, Radix Select renders a hidden <select> for form submission.
      // Let's use getAllByRole("option") after opening — fallback: set workerId via direct DOM manipulation.
      // Instead, re-render with a pre-set workerId by finding hidden select.
      const hiddenSelects = document.querySelectorAll("select");
      if (hiddenSelects.length > 0) {
        // First hidden select is the worker selector
        fireEvent.change(hiddenSelects[0], { target: { value: "worker-1" } });
      } else {
        // Fallback: click the worker trigger and select
        await user.click(workerTriggers[0]);
        const aliceOption = screen.queryByText("Alice");
        if (aliceOption) await user.click(aliceOption);
      }

      // Set supplement hours to 3
      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      fireEvent.change(supplementInput, { target: { value: "3" } });

      // Submit the form
      const submitBtn = screen.getByRole("button", { name: /save/i });
      await user.click(submitBtn);

      // onSave should have been called with shift_type: null and supplement_hours: 3
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          shift_type: null,
          supplement_hours: 3,
        })
      );
    });
  });

  describe("Out-of-range supplement_hours", () => {
    it("blocks submit when supplement_hours = 13", async () => {
      render(<LogAttendanceDialog {...defaultProps} />);

      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      fireEvent.change(supplementInput, { target: { value: "13" } });

      const submitBtn = screen.getByRole("button", { name: /save/i });
      expect(submitBtn).toBeDisabled();

      // Ensure onSave is never called
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it("allows submit when supplement_hours = 12 (boundary)", async () => {
      render(<LogAttendanceDialog {...defaultProps} />);

      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      fireEvent.change(supplementInput, { target: { value: "12" } });

      const submitBtn = screen.getByRole("button", { name: /save/i });
      // 12 is valid, no shift selected but supplement>0 → canSubmit=true
      expect(submitBtn).not.toBeDisabled();
    });
  });

  describe("Override without shift", () => {
    it("disables submit when amount_override is set but shift_type is null", () => {
      render(<LogAttendanceDialog {...defaultProps} />);

      // Set amount override (shift is null by default)
      const overrideInput = screen.getByRole("spinbutton", { name: /override/i });
      fireEvent.change(overrideInput, { target: { value: "150" } });

      // Also set supplement to 0 — override + null shift + supplement=0
      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      fireEvent.change(supplementInput, { target: { value: "0" } });

      const submitBtn = screen.getByRole("button", { name: /save/i });
      expect(submitBtn).toBeDisabled();
    });
  });

  describe("Default state", () => {
    it("renders supplement hours input with default value 0", () => {
      render(<LogAttendanceDialog {...defaultProps} />);

      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      expect((supplementInput as HTMLInputElement).value).toBe("0");
    });

    it("renders supplement hours input with min=0 and max=12", () => {
      render(<LogAttendanceDialog {...defaultProps} />);

      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      expect(supplementInput).toHaveAttribute("min", "0");
      expect(supplementInput).toHaveAttribute("max", "12");
    });
  });

  // Phase 08 — edit-mode population test
  // The dialog is currently create-only (no initialEntry prop).
  // This test group verifies that supplement + null-shift state can be
  // pre-populated via fireEvent and that the payload preserves both
  // fields on submit — locking in the expected contract for a future
  // edit-mode prop addition.
  describe("Edit-mode field population (phase 08)", () => {
    it("populates supplement_hours=4 and null shift_type via fireEvent; submit preserves both", async () => {
      const user = userEvent.setup();
      render(<LogAttendanceDialog {...defaultProps} />);

      // Simulate selecting a worker via the hidden native select (Radix Select in jsdom)
      const hiddenSelects = document.querySelectorAll("select");
      if (hiddenSelects.length > 0) {
        fireEvent.change(hiddenSelects[0], { target: { value: "worker-1" } });
      }

      // Pre-populate supplement_hours = 4 (simulates edit-mode initialEntry.supplement_hours)
      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      fireEvent.change(supplementInput, { target: { value: "4" } });

      // Verify input reflects the value
      expect((supplementInput as HTMLInputElement).value).toBe("4");

      // Shift type stays null (shiftType === null, i.e. __none__ sentinel selected)
      // The shift select should show the "(none)" option — verified by the submit payload below

      // Submit button should be enabled: null-shift + supplement=4 is valid standalone
      const submitBtn = screen.getByRole("button", { name: /save/i });
      expect(submitBtn).not.toBeDisabled();

      // Submit and verify payload preserves supplement_hours=4 and shift_type=null
      await user.click(submitBtn);

      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          shift_type: null,
          supplement_hours: 4,
        })
      );
    });

    it("preserves supplement_hours=4 and shift_type=null unchanged when submitted without edits", async () => {
      const user = userEvent.setup();
      render(<LogAttendanceDialog {...defaultProps} />);

      // Select worker
      const hiddenSelects = document.querySelectorAll("select");
      if (hiddenSelects.length > 0) {
        fireEvent.change(hiddenSelects[0], { target: { value: "worker-1" } });
      }

      // Set fields to match an existing entry: supplement_hours=4, shift_type=null
      const supplementInput = screen.getByRole("spinbutton", { name: /supplement/i });
      fireEvent.change(supplementInput, { target: { value: "4" } });

      // Submit without any further changes
      const submitBtn = screen.getByRole("button", { name: /save/i });
      await user.click(submitBtn);

      // Payload must include the exact values — no coercion or default override
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          supplement_hours: 4,
          shift_type: null,
        })
      );
    });
  });
});
