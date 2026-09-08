/**
 * Regression tests for M4 (server-computed initialDate — no `new Date()`
 * during render) and M5 (day_type mapped to the existing
 * labor.shiftFull/shiftHalf/shiftOvertime labels, not raw BE strings).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DayRoster } from "../day-roster";
import type { RosterRow } from "@/lib/api/roster";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => {
    const messages: Record<string, string> = {
      "labor.roster.title": "Today's roster",
      "labor.roster.today": "Today",
      "labor.roster.statusPresent": "Present",
      "labor.roster.statusPending": "Pending",
      "labor.roster.statusAbsent": "Absent",
      "labor.roster.col.name": "Name",
      "labor.roster.col.status": "Status",
      "labor.roster.col.hours": "Hours",
      "labor.roster.col.dayType": "Day type",
      "labor.roster.empty": "No entries",
      "labor.roster.loadError": "Could not load the roster",
      "labor.shiftFull": "Full day",
      "labor.shiftHalf": "Half day",
      "labor.shiftOvertime": "Overtime",
    };
    return messages[`${ns}.${key}`] ?? key;
  },
}));

const mockFetchDayRosterAction = vi.fn();
vi.mock("@/app/[locale]/(app)/projects/[id]/labor/actions", () => ({
  fetchDayRosterAction: (...args: unknown[]) => mockFetchDayRosterAction(...args),
}));

const ROWS: RosterRow[] = [
  { worker_id: "w1", name: "Jean Dupont", status: "present", hours: 8, day_type: "full" },
  { worker_id: "w2", name: "Marie Curie", status: "present", hours: 4, day_type: "half" },
  { worker_id: "w3", name: "Ada Lovelace", status: "pending", hours: 10, day_type: "overtime" },
  { worker_id: "w4", name: "Grace Hopper", status: "absent", hours: 0, day_type: null },
];

describe("DayRoster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchDayRosterAction.mockResolvedValue({ success: true, data: { rows: ROWS } });
  });

  it("fetches using the server-supplied initialDate, not a client-computed today", async () => {
    render(<DayRoster projectId="proj-1" initialDate="2026-09-08" />);

    await waitFor(() => {
      expect(mockFetchDayRosterAction).toHaveBeenCalledWith("proj-1", "2026-09-08");
    });
    expect(screen.getByText("2026-09-08")).toBeInTheDocument();
  });

  it("maps day_type to the shared shift labels, not the raw BE string", async () => {
    render(<DayRoster projectId="proj-1" initialDate="2026-09-08" />);

    expect(await screen.findByText("Full day")).toBeInTheDocument();
    expect(screen.getByText("Half day")).toBeInTheDocument();
    expect(screen.getByText("Overtime")).toBeInTheDocument();
    // Raw BE strings never leak into the DOM.
    expect(screen.queryByText("full")).not.toBeInTheDocument();
    expect(screen.queryByText("half")).not.toBeInTheDocument();
    expect(screen.queryByText("overtime")).not.toBeInTheDocument();
  });

  it("falls back to an em dash when day_type is null", async () => {
    render(<DayRoster projectId="proj-1" initialDate="2026-09-08" />);
    expect(await screen.findByText("—")).toBeInTheDocument();
  });
});
