/**
 * CalendarCell — a day holding a worker's change request is flagged on the
 * attendance grid: an amber indicator counting the requests (visible even when
 * the worker's chip is folded into "+N"), a ringed chip, and the cell's label.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "@/messages/en.json";
import { CalendarCell } from "../calendar-cell";
import type { LaborEntry } from "@/types/labor";

// A plain Tuesday (no public holiday) so the label only carries the date + requests.
const DAY = new Date(2026, 8, 8);

function entry(id: string, workerId: string, name: string, overrides: Partial<LaborEntry> = {}): LaborEntry {
  return {
    id,
    worker_id: workerId,
    worker_name: name,
    date: "2026-09-08",
    amount_override: null,
    effective_cost: 100,
    note: null,
    shift_type: "full",
    supplement_hours: 0,
    created_at: "2026-09-08T06:00:00",
    status: "validated",
    ...overrides,
  };
}

const REQUESTED: Partial<LaborEntry> = {
  change_requested_at: "2026-09-09T07:00:00",
  proposed_shift_type: "half",
  proposed_supplement_hours: 0,
};

function renderCell(entries: LaborEntry[], maxChips?: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CalendarCell date={DAY} entries={entries} maxChips={maxChips} />
    </NextIntlClientProvider>,
  );
}

describe("CalendarCell — change requests", () => {
  it("shows no indicator on a day without requests", () => {
    renderCell([entry("e1", "w1", "An")]);
    expect(screen.queryByTestId("calendar-cell-change-indicator")).toBeNull();
    expect(document.querySelector("[data-change-requested]")).toBeNull();
  });

  it("flags the day, rings the worker's chip and mentions it in the cell label", () => {
    renderCell([entry("e1", "w1", "An", REQUESTED), entry("e2", "w2", "Binh")]);

    expect(screen.getByTestId("calendar-cell-change-indicator").getAttribute("title")).toBe(
      "1 change request",
    );
    const chip = screen.getByTitle("An · Change requested");
    expect(chip.getAttribute("data-change-requested")).toBe("true");
    expect(screen.getByTitle("Binh").getAttribute("data-change-requested")).toBeNull();
    expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(/— 1 change request$/);
  });

  it("counts every request of the day, even for chips folded into +N", () => {
    renderCell(
      [
        entry("e1", "w1", "An"),
        entry("e2", "w2", "Binh", REQUESTED),
        entry("e3", "w3", "Chi", REQUESTED),
      ],
      1,
    );
    expect(screen.getByTestId("calendar-cell-change-indicator").getAttribute("title")).toBe(
      "2 change requests",
    );
    expect(screen.getByText("+2")).toBeDefined();
  });
});
