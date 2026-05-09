/**
 * Tests for AttendanceTable component — phase 05 supplement hours badge
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttendanceTable } from "../attendance-table";
import type { LaborEntry, Worker } from "@/types/labor";

// Mock next-intl — returns key as fallback
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock formatEUR from api/labor
vi.mock("@/lib/api/labor", () => ({
  formatEUR: (value: number) => `€${value.toFixed(2)}`,
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

function makeEntry(overrides: Partial<LaborEntry>): LaborEntry {
  return {
    id: "entry-1",
    worker_id: "worker-1",
    worker_name: "Alice",
    date: "2026-04-28",
    shift_type: "full",
    supplement_hours: 0,
    amount_override: null,
    effective_cost: 100,
    note: null,
    created_at: "2026-04-28T08:00:00Z",
    ...overrides,
  };
}

const defaultTableProps = {
  workers: mockWorkers,
  isLoading: false,
  canManage: false,
  month: "2026-04",
  workerFilter: "all",
  onMonthChange: vi.fn(),
  onWorkerFilterChange: vi.fn(),
  onDelete: vi.fn(),
};

describe("AttendanceTable", () => {
  describe("Shift chip rendering", () => {
    it("renders shift chip for full-day entry without supplement badge", () => {
      const entries = [makeEntry({ shift_type: "full", supplement_hours: 0 })];
      render(<AttendanceTable {...defaultTableProps} entries={entries} />);

      // Shift chip should show shift label key
      expect(screen.getByText("shiftFull")).toBeDefined();

      // No supplement badge
      expect(screen.queryByText(/\+\d+h/)).toBeNull();
    });

    it("renders +2h badge alongside full shift chip when supplement_hours=2", () => {
      const entries = [makeEntry({ shift_type: "full", supplement_hours: 2 })];
      render(<AttendanceTable {...defaultTableProps} entries={entries} />);

      // Regular shift chip still present
      expect(screen.getByText("shiftFull")).toBeDefined();

      // Supplement badge present
      expect(screen.getByText("+2h")).toBeDefined();
    });

    it("renders +5h badge and standalone label (no shift chip) when shift_type=null and supplement_hours=5", () => {
      const entries = [makeEntry({ shift_type: null, supplement_hours: 5 })];
      render(<AttendanceTable {...defaultTableProps} entries={entries} />);

      // No regular shift chips (shiftFull / shiftHalf / shiftOvertime)
      expect(screen.queryByText("shiftFull")).toBeNull();
      expect(screen.queryByText("shiftHalf")).toBeNull();
      expect(screen.queryByText("shiftOvertime")).toBeNull();

      // Supplement badge present
      expect(screen.getByText("+5h")).toBeDefined();

      // Standalone label present (i18n key as fallback)
      expect(screen.getByText("supplement.standaloneShiftLabel")).toBeDefined();
    });

    it("renders nothing for shift column when shift_type=null and supplement_hours=0", () => {
      const entries = [makeEntry({ shift_type: null, supplement_hours: 0 })];
      render(<AttendanceTable {...defaultTableProps} entries={entries} />);

      expect(screen.queryByText("shiftFull")).toBeNull();
      expect(screen.queryByText(/\+\d+h/)).toBeNull();
      expect(screen.queryByText("supplement.standaloneShiftLabel")).toBeNull();
    });

    it("renders +3h badge tooltip attribute on badge element", () => {
      const entries = [makeEntry({ shift_type: "full", supplement_hours: 3 })];
      render(<AttendanceTable {...defaultTableProps} entries={entries} />);

      const badge = screen.getByText("+3h");
      expect(badge).toBeDefined();
      // Tooltip is set via title attribute
      expect(badge).toHaveAttribute("title");
    });
  });

  describe("Loading state", () => {
    it("renders loading spinner when isLoading=true", () => {
      render(
        <AttendanceTable {...defaultTableProps} entries={[]} isLoading={true} />
      );
      // Loader renders via Loader2 icon — check spinner is in DOM
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeDefined();
    });
  });

  describe("Empty state", () => {
    it("renders empty state message when entries is empty", () => {
      render(<AttendanceTable {...defaultTableProps} entries={[]} />);
      expect(screen.getByText("noEntries")).toBeDefined();
    });
  });

  describe("Month filter — opt-in clear", () => {
    it("hides Clear button when month is empty (all-history default)", () => {
      render(
        <AttendanceTable {...defaultTableProps} entries={[]} month="" />
      );
      // No element with the clear-filter aria-label / title.
      expect(screen.queryByLabelText("filterMonthClear")).toBeNull();
    });

    it("shows Clear button when month is set and resets month on click", () => {
      const onMonthChange = vi.fn();
      render(
        <AttendanceTable
          {...defaultTableProps}
          entries={[]}
          month="2026-04"
          onMonthChange={onMonthChange}
        />
      );

      const clearBtn = screen.getByLabelText("filterMonthClear");
      expect(clearBtn).toBeDefined();

      fireEvent.click(clearBtn);
      expect(onMonthChange).toHaveBeenCalledWith("");
    });
  });
});
