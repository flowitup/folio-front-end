/**
 * Tests for the "Tag this day" action + tag color badges shipped across
 * the attendance calendar sheet, the attendance table day headers, and
 * the calendar cell.
 *
 * Interaction strategy mirrors payment-method-select.test.tsx: fireEvent
 * to open Radix Select/Popover, waitFor to settle async state. next-intl
 * is mocked as a key-passthrough (matches attendance-table.test.tsx /
 * day-description-field.test.tsx) except for the CalendarCell suite,
 * which uses NextIntlClientProvider + real messages (matches
 * calendar-i18n.test.tsx) since CalendarCell needs useLocale() too.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { AttendanceDayDetailSheet } from "../attendance-day-detail-sheet";
import { AttendanceTable } from "../attendance-table";
import { CalendarCell } from "../calendar-cell";
import enMessages from "@/messages/en.json";

import type { LaborEntry, Worker } from "@/types/labor";
import type { ProjectTag } from "@/lib/api/tags";

// ---- Mocks ----

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return {
    ...actual,
    useTranslations: () => (key: string) => key,
    useLocale: () => "en",
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/labor", () => ({
  formatEUR: (value: number) => `€${value.toFixed(2)}`,
}));

// ---- Fixtures ----

function makeTag(id: string, name: string, color: string): ProjectTag {
  return {
    id,
    project_id: "proj-1",
    name,
    color,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
  };
}

const EXCAVATION = makeTag("tag-1", "Excavation", "#ef4444");
const FOUNDATION = makeTag("tag-2", "Foundation", "#3b82f6");
const TAGS = [EXCAVATION, FOUNDATION];

const WORKERS: Worker[] = [
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
    tag_id: null,
    ...overrides,
  };
}

// =============================================================================
// AttendanceDayDetailSheet — day-tag row
// =============================================================================

describe("AttendanceDayDetailSheet — day tag", () => {
  const defaultSheetProps = {
    date: new Date(2026, 3, 28),
    open: true,
    onOpenChange: vi.fn(),
    canManage: true,
    onDelete: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it("shows the shared tag when all entries carry the same tag_id", () => {
    const entries = [
      makeEntry({ id: "e1", tag_id: EXCAVATION.id }),
      makeEntry({ id: "e2", worker_id: "worker-2", tag_id: EXCAVATION.id }),
    ];
    render(
      <AttendanceDayDetailSheet
        {...defaultSheetProps}
        entries={entries}
        tags={TAGS}
        onSaveDayTag={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const row = screen.getByTestId("day-tag-select");
    expect(within(row).getByRole("combobox")).toHaveTextContent("Excavation");
  });

  it("shows the mixed placeholder when entries disagree on tag_id", () => {
    const entries = [
      makeEntry({ id: "e1", tag_id: EXCAVATION.id }),
      makeEntry({ id: "e2", worker_id: "worker-2", tag_id: FOUNDATION.id }),
    ];
    render(
      <AttendanceDayDetailSheet
        {...defaultSheetProps}
        entries={entries}
        tags={TAGS}
        onSaveDayTag={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const row = screen.getByTestId("day-tag-select");
    expect(within(row).getByRole("combobox")).toHaveTextContent("dayTag.mixed");
  });

  it("calls onSaveDayTag with the tag id when a tag is selected", () => {
    const onSaveDayTag = vi.fn().mockResolvedValue(undefined);
    const entries = [makeEntry({ id: "e1", tag_id: EXCAVATION.id })];
    render(
      <AttendanceDayDetailSheet
        {...defaultSheetProps}
        entries={entries}
        tags={TAGS}
        onSaveDayTag={onSaveDayTag}
      />,
    );

    const row = screen.getByTestId("day-tag-select");
    fireEvent.click(within(row).getByRole("combobox"));
    const foundationOption = screen.getAllByRole("option").find((o) =>
      o.textContent?.includes("Foundation"),
    );
    fireEvent.click(foundationOption!);

    expect(onSaveDayTag).toHaveBeenCalledWith(FOUNDATION.id);
  });

  it("calls onSaveDayTag with null when the 'no tag' option is selected", () => {
    const onSaveDayTag = vi.fn().mockResolvedValue(undefined);
    const entries = [makeEntry({ id: "e1", tag_id: EXCAVATION.id })];
    render(
      <AttendanceDayDetailSheet
        {...defaultSheetProps}
        entries={entries}
        tags={TAGS}
        onSaveDayTag={onSaveDayTag}
      />,
    );

    const row = screen.getByTestId("day-tag-select");
    fireEvent.click(within(row).getByRole("combobox"));
    const noTagOption = screen.getAllByRole("option")[0];
    fireEvent.click(noTagOption);

    expect(onSaveDayTag).toHaveBeenCalledWith(null);
  });

  it("calls onSaveDayTag with null when 'No tag' is chosen from a mixed-tag day", () => {
    const onSaveDayTag = vi.fn().mockResolvedValue(undefined);
    const entries = [
      makeEntry({ id: "e1", tag_id: EXCAVATION.id }),
      makeEntry({ id: "e2", worker_id: "worker-2", tag_id: FOUNDATION.id }),
    ];
    render(
      <AttendanceDayDetailSheet
        {...defaultSheetProps}
        entries={entries}
        tags={TAGS}
        onSaveDayTag={onSaveDayTag}
      />,
    );

    const row = screen.getByTestId("day-tag-select");
    fireEvent.click(within(row).getByRole("combobox"));
    const noTagOption = screen.getAllByRole("option")[0];
    fireEvent.click(noTagOption);

    expect(onSaveDayTag).toHaveBeenCalledWith(null);
  });

  it("hides the tag row when the project has no tags", () => {
    render(
      <AttendanceDayDetailSheet
        {...defaultSheetProps}
        entries={[makeEntry({})]}
        tags={[]}
        onSaveDayTag={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("day-tag-select")).toBeNull();
  });

  it("hides the tag row when canManage is false", () => {
    render(
      <AttendanceDayDetailSheet
        {...defaultSheetProps}
        canManage={false}
        entries={[makeEntry({})]}
        tags={TAGS}
        onSaveDayTag={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("day-tag-select")).toBeNull();
  });

  it("hides the tag row when onSaveDayTag is not provided", () => {
    render(
      <AttendanceDayDetailSheet
        {...defaultSheetProps}
        entries={[makeEntry({})]}
        tags={TAGS}
      />,
    );
    expect(screen.queryByTestId("day-tag-select")).toBeNull();
  });
});

// =============================================================================
// AttendanceTable — day-header tag badges + action
// =============================================================================

describe("AttendanceTable — day tag badges + action", () => {
  const defaultTableProps = {
    workers: WORKERS,
    isLoading: false,
    canManage: true,
    month: "2026-04",
    workerFilter: "all",
    onMonthChange: vi.fn(),
    onWorkerFilterChange: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it("renders a single color+name badge when the day's entries share one tag", () => {
    const entries = [makeEntry({ id: "e1", tag_id: EXCAVATION.id })];
    render(
      <AttendanceTable {...defaultTableProps} entries={entries} tags={TAGS} />,
    );

    const badge = screen.getByText("Excavation");
    expect(badge).toHaveStyle({ backgroundColor: "#ef4444" });
  });

  it("renders dots (no names) when the day's entries carry different tags", () => {
    const entries = [
      makeEntry({ id: "e1", tag_id: EXCAVATION.id }),
      makeEntry({ id: "e2", worker_id: "worker-2", tag_id: FOUNDATION.id }),
    ];
    render(
      <AttendanceTable {...defaultTableProps} entries={entries} tags={TAGS} />,
    );

    expect(screen.getByTestId("day-tag-dots-mixed")).toBeDefined();
    expect(screen.queryByText("Excavation")).toBeNull();
    expect(screen.queryByText("Foundation")).toBeNull();
  });

  it("renders no badge when entries are untagged", () => {
    const entries = [makeEntry({ id: "e1", tag_id: null })];
    render(
      <AttendanceTable {...defaultTableProps} entries={entries} tags={TAGS} />,
    );
    expect(screen.queryByTestId("day-tag-dots-mixed")).toBeNull();
  });

  it("hides the tag action button when the project has no tags", () => {
    const entries = [makeEntry({ id: "e1" })];
    render(
      <AttendanceTable {...defaultTableProps} entries={entries} tags={[]} onSaveDayTag={vi.fn()} />,
    );
    expect(screen.queryByLabelText("dayTag.action")).toBeNull();
  });

  it("hides the tag action button when canManage is false", () => {
    const entries = [makeEntry({ id: "e1" })];
    render(
      <AttendanceTable
        {...defaultTableProps}
        canManage={false}
        entries={entries}
        tags={TAGS}
        onSaveDayTag={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("dayTag.action")).toBeNull();
  });

  it("hides the tag action button when onSaveDayTag is not provided", () => {
    const entries = [makeEntry({ id: "e1" })];
    render(
      <AttendanceTable {...defaultTableProps} entries={entries} tags={TAGS} />,
    );
    expect(screen.queryByLabelText("dayTag.action")).toBeNull();
  });

  it("opens the popover and calls onSaveDayTag(date, tagId) when a tag is picked", async () => {
    const onSaveDayTag = vi.fn().mockResolvedValue(undefined);
    const entries = [makeEntry({ id: "e1", date: "2026-04-15", tag_id: null })];
    render(
      <AttendanceTable
        {...defaultTableProps}
        entries={entries}
        tags={TAGS}
        onSaveDayTag={onSaveDayTag}
      />,
    );

    fireEvent.click(screen.getByLabelText("dayTag.action"));

    const popover = await screen.findByTestId("day-tag-popover");
    fireEvent.click(within(popover).getByRole("combobox"));
    const excavationOption = await screen.findAllByRole("option");
    fireEvent.click(excavationOption.find((o) => o.textContent?.includes("Excavation"))!);

    await waitFor(() => {
      expect(onSaveDayTag).toHaveBeenCalledWith("2026-04-15", EXCAVATION.id);
    });
  });

  it("calls onSaveDayTag(date, null) when clearing via the popover", async () => {
    const onSaveDayTag = vi.fn().mockResolvedValue(undefined);
    const entries = [makeEntry({ id: "e1", date: "2026-04-15", tag_id: EXCAVATION.id })];
    render(
      <AttendanceTable
        {...defaultTableProps}
        entries={entries}
        tags={TAGS}
        onSaveDayTag={onSaveDayTag}
      />,
    );

    fireEvent.click(screen.getByLabelText("dayTag.action"));

    const popover = await screen.findByTestId("day-tag-popover");
    fireEvent.click(within(popover).getByRole("combobox"));
    const noTagOption = (await screen.findAllByRole("option"))[0];
    fireEvent.click(noTagOption);

    await waitFor(() => {
      expect(onSaveDayTag).toHaveBeenCalledWith("2026-04-15", null);
    });
  });

  it("calls onSaveDayTag(date, null) when 'No tag' is chosen from a mixed-tag day", async () => {
    const onSaveDayTag = vi.fn().mockResolvedValue(undefined);
    const entries = [
      makeEntry({ id: "e1", date: "2026-04-15", tag_id: EXCAVATION.id }),
      makeEntry({ id: "e2", worker_id: "worker-2", date: "2026-04-15", tag_id: FOUNDATION.id }),
    ];
    render(
      <AttendanceTable
        {...defaultTableProps}
        entries={entries}
        tags={TAGS}
        onSaveDayTag={onSaveDayTag}
      />,
    );

    fireEvent.click(screen.getByLabelText("dayTag.action"));

    const popover = await screen.findByTestId("day-tag-popover");
    fireEvent.click(within(popover).getByRole("combobox"));
    const noTagOption = (await screen.findAllByRole("option"))[0];
    fireEvent.click(noTagOption);

    await waitFor(() => {
      expect(onSaveDayTag).toHaveBeenCalledWith("2026-04-15", null);
    });
  });
});

// =============================================================================
// CalendarCell — tag color dots
// =============================================================================

describe("CalendarCell — tag color dots", () => {
  const DAY = new Date(2026, 3, 15); // Not a French holiday.
  const tagMap = { [EXCAVATION.id]: EXCAVATION, [FOUNDATION.id]: FOUNDATION };

  function renderCell(props: Partial<React.ComponentProps<typeof CalendarCell>>) {
    return render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CalendarCell date={DAY} entries={[]} {...props} />
      </NextIntlClientProvider>,
    );
  }

  it("renders a color dot for a tagged entry when tagMap is provided", () => {
    const entries = [makeEntry({ id: "e1", date: "2026-04-15", tag_id: EXCAVATION.id })];
    renderCell({ entries, tagMap });

    const dots = screen.getByTestId("calendar-cell-tag-dots");
    expect(within(dots).getAllByTitle(EXCAVATION.name)).toHaveLength(1);
  });

  it("renders nothing tag-related when entries are untagged", () => {
    const entries = [makeEntry({ id: "e1", date: "2026-04-15", tag_id: null })];
    renderCell({ entries, tagMap });
    expect(screen.queryByTestId("calendar-cell-tag-dots")).toBeNull();
  });

  it("renders nothing tag-related when no tagMap is supplied", () => {
    const entries = [makeEntry({ id: "e1", date: "2026-04-15", tag_id: EXCAVATION.id })];
    renderCell({ entries });
    expect(screen.queryByTestId("calendar-cell-tag-dots")).toBeNull();
  });

  it("caps dots at 3 and shows an overflow count for more distinct tags", () => {
    const tag3 = makeTag("tag-3", "Framing", "#22c55e");
    const tag4 = makeTag("tag-4", "Roofing", "#eab308");
    const bigTagMap = { ...tagMap, [tag3.id]: tag3, [tag4.id]: tag4 };
    const entries = [
      makeEntry({ id: "e1", worker_id: "w1", date: "2026-04-15", tag_id: EXCAVATION.id }),
      makeEntry({ id: "e2", worker_id: "w2", date: "2026-04-15", tag_id: FOUNDATION.id }),
      makeEntry({ id: "e3", worker_id: "w3", date: "2026-04-15", tag_id: tag3.id }),
      makeEntry({ id: "e4", worker_id: "w4", date: "2026-04-15", tag_id: tag4.id }),
    ];
    renderCell({ entries, tagMap: bigTagMap });

    const dots = screen.getByTestId("calendar-cell-tag-dots");
    expect(within(dots).getAllByTitle(/./)).toHaveLength(3);
    expect(within(dots).getByText("+1")).toBeDefined();
  });
});
