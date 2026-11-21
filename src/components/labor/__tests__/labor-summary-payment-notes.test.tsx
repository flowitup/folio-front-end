/**
 * LaborSummary shows each worker's monthly payment note in both table modes
 * (single month, and the all-history month sub-rows), with the add/edit
 * button only for people who can record payments.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaborSummary } from "../labor-summary";
import type { LaborMonthlySummaryResponse, LaborSummaryResponse } from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
  useLocale: () => "en",
}));

const fetchNotes = vi.fn();
vi.mock("@/lib/api/labor", () => ({
  formatEUR: (value: number) => `€${value.toFixed(2)}`,
  fetchLaborPaymentNotes: (...args: unknown[]) => fetchNotes(...args),
  setLaborPaymentNote: vi.fn(),
}));

vi.mock("../labor-export-dialog", () => ({ LaborExportDialog: () => null }));
vi.mock("../labor-payment-note-dialog", () => ({ LaborPaymentNoteDialog: () => null }));

const row = {
  worker_id: "w1",
  worker_name: "Lâm",
  days_worked: 20.5,
  total_cost: 1845,
  banked_hours: 0,
  bonus_full_days: 0,
  bonus_half_days: 0,
  bonus_cost: 0,
};

const summary: LaborSummaryResponse = {
  rows: [row],
  total_days: 20.5,
  total_cost: 1845,
  total_banked_hours: 0,
  total_bonus_days: 0,
  total_bonus_cost: 0,
};

const monthly: LaborMonthlySummaryResponse = {
  rows: [
    {
      year: 2026,
      month: 7,
      total_days: 20.5,
      total_cost: 1845,
      workers: [{ worker_id: "w1", worker_name: "Lâm", days_worked: 20.5, total_cost: 1845 }],
    },
  ],
} as LaborMonthlySummaryResponse;

const baseProps = { projectId: "p1", workers: [], isLoading: false, onMonthChange: () => {} };

beforeEach(() => {
  fetchNotes.mockReset();
  fetchNotes.mockResolvedValue([
    {
      id: "n1",
      project_id: "p1",
      worker_id: "w1",
      month: "2026-07",
      note: "Rest paid in cash on the 12th",
      created_by: null,
      created_at: "",
      updated_at: "",
    },
  ]);
});

describe("LaborSummary payment notes", () => {
  it("shows the month's note under the worker in single-month mode, with the edit button for managers", async () => {
    render(<LaborSummary {...baseProps} summary={summary} monthlySummary={null} month="2026-07" canEditNotes />);

    expect((await screen.findByTestId("summary-note-2026-07-w1")).textContent).toContain(
      "Rest paid in cash on the 12th",
    );
    expect(fetchNotes).toHaveBeenCalledWith("p1");
    expect(screen.getByTestId("summary-note-button-2026-07-w1").getAttribute("aria-label")).toBe(
      "labor.payments.editNote",
    );
  });

  it("shows the note in the all-history worker sub-row", async () => {
    render(<LaborSummary {...baseProps} summary={null} monthlySummary={monthly} month="" canEditNotes />);

    expect((await screen.findByTestId("summary-note-2026-07-w1")).textContent).toContain(
      "Rest paid in cash on the 12th",
    );
  });

  it("hides the edit button from people who cannot record payments", async () => {
    render(<LaborSummary {...baseProps} summary={summary} monthlySummary={null} month="2026-07" />);

    await screen.findByTestId("summary-note-2026-07-w1");
    expect(screen.queryByTestId("summary-note-button-2026-07-w1")).toBeNull();
  });

  it("does not show another month's note", async () => {
    render(<LaborSummary {...baseProps} summary={summary} monthlySummary={null} month="2026-08" canEditNotes />);

    await screen.findByTestId("summary-note-button-2026-08-w1");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("summary-note-2026-08-w1")).toBeNull();
    expect(screen.getByTestId("summary-note-button-2026-08-w1").getAttribute("aria-label")).toBe(
      "labor.payments.addNote",
    );
  });
});
