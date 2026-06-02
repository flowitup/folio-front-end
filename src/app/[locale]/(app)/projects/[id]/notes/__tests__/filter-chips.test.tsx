/**
 * Tests for FilterChips component.
 * Covers: All chip, per-category chips with counts, active state, onPick callback.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterChips } from "../filter-chips";
import type { NoteCategory } from "@/lib/api/notes";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

function makeCounts(overrides: Partial<Record<NoteCategory, number>> = {}): Record<NoteCategory, number> {
  return {
    inspection: 0, delivery: 0, payment: 0, decision: 0, call: 0, general: 0,
    ...overrides,
  };
}

describe("FilterChips", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the All chip with total count", () => {
    const counts = makeCounts({ delivery: 2, general: 3 });
    render(<FilterChips counts={counts} active="all" onPick={vi.fn()} />);
    // All chip should show total = 5
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("notes.filterAll")).toBeDefined();
  });

  it("renders chips only for categories with count > 0", () => {
    const counts = makeCounts({ delivery: 1 });
    render(<FilterChips counts={counts} active="all" onPick={vi.fn()} />);
    expect(screen.getByText("notes.categories.delivery")).toBeDefined();
    // inspection has count 0 — should not appear
    expect(screen.queryByText("notes.categories.inspection")).toBeNull();
  });

  it("marks All chip as active when activeCat=all", () => {
    const counts = makeCounts({ delivery: 1 });
    render(<FilterChips counts={counts} active="all" onPick={vi.fn()} />);
    const allChip = screen.getByText("notes.filterAll").closest("button");
    expect(allChip?.className).toContain("on");
  });

  it("marks category chip as active when that cat is selected", () => {
    const counts = makeCounts({ call: 2 });
    render(<FilterChips counts={counts} active="call" onPick={vi.fn()} />);
    const callChip = screen.getByText("notes.categories.call").closest("button");
    expect(callChip?.className).toContain("on");
    const allChip = screen.getByText("notes.filterAll").closest("button");
    expect(allChip?.className).not.toContain("on");
  });

  it("calls onPick('all') when All chip is clicked", () => {
    const onPick = vi.fn();
    render(<FilterChips counts={makeCounts()} active="all" onPick={onPick} />);
    fireEvent.click(screen.getByText("notes.filterAll"));
    expect(onPick).toHaveBeenCalledWith("all");
  });

  it("calls onPick with category id when category chip is clicked", () => {
    const onPick = vi.fn();
    const counts = makeCounts({ payment: 3 });
    render(<FilterChips counts={counts} active="all" onPick={onPick} />);
    fireEvent.click(screen.getByText("notes.categories.payment").closest("button")!);
    expect(onPick).toHaveBeenCalledWith("payment");
  });

  it("shows correct count next to each category chip", () => {
    const counts = makeCounts({ decision: 4, call: 7 });
    render(<FilterChips counts={counts} active="all" onPick={vi.fn()} />);
    // Total = 11
    expect(screen.getByText("11")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
  });
});
