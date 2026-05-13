/**
 * Tests for DatePickerWithArrows + the shiftDate helper (Phase 3e).
 *
 * shiftDate has to survive DST boundaries — we test on the spring-
 * forward and fall-back days in Europe (Folio's primary tz) to make
 * sure the "log next day" toast action doesn't skip a day.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DatePickerWithArrows, shiftDate } from "../date-picker-with-arrows";

describe("shiftDate", () => {
  it("adds days within a month", () => {
    expect(shiftDate("2026-05-13", 1)).toBe("2026-05-14");
  });

  it("crosses month boundary forwards", () => {
    expect(shiftDate("2026-05-31", 1)).toBe("2026-06-01");
  });

  it("crosses month boundary backwards", () => {
    expect(shiftDate("2026-06-01", -1)).toBe("2026-05-31");
  });

  it("survives spring-forward DST day (CET → CEST 2026-03-29)", () => {
    expect(shiftDate("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("survives fall-back DST day (CEST → CET 2026-10-25)", () => {
    expect(shiftDate("2026-10-24", 1)).toBe("2026-10-25");
    expect(shiftDate("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("returns the input unchanged on malformed dates", () => {
    expect(shiftDate("not-a-date", 1)).toBe("not-a-date");
  });
});

describe("DatePickerWithArrows component", () => {
  it("calls onChange when prev arrow is clicked", () => {
    const onChange = vi.fn();
    render(<DatePickerWithArrows value="2026-05-13" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Previous day"));
    expect(onChange).toHaveBeenCalledWith("2026-05-12");
  });

  it("calls onChange when next arrow is clicked", () => {
    const onChange = vi.fn();
    render(<DatePickerWithArrows value="2026-05-13" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Next day"));
    expect(onChange).toHaveBeenCalledWith("2026-05-14");
  });

  it("disables controls when disabled prop is set", () => {
    render(<DatePickerWithArrows value="2026-05-13" onChange={() => {}} disabled />);
    expect(screen.getByLabelText("Previous day")).toBeDisabled();
    expect(screen.getByLabelText("Next day")).toBeDisabled();
  });
});
