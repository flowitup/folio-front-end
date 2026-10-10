/**
 * Values shown inside labor strings follow the app language: shift names in the
 * cross-project conflict tooltip, the vi calendar header's case.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";
import viMessages from "@/messages/vi.json";
import { WorkerTile } from "../worker-tile";
import { AttendanceCalendar } from "../attendance-calendar";
import type { ConflictGroup, Worker } from "@/types/labor";

const WORKER = {
  id: "w-1",
  project_id: "p-1",
  name: "Alpha",
  phone: null,
  daily_rate: 100,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
} as Worker;

const CONFLICT: ConflictGroup = {
  person_id: "person-1",
  person_name: "Alpha",
  entries: [
    { project_id: "p-2", project_name: "Second", shift_type: "half", supplement_hours: 0 },
    { project_id: "p-3", project_name: "Third", shift_type: null, supplement_hours: 2 },
  ],
};

describe("WorkerTile conflict tooltip", () => {
  it("names the other projects' shifts in the app language", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={frMessages}>
        <WorkerTile
          worker={WORKER}
          checked={false}
          shiftType="full"
          conflict={CONFLICT}
          onToggle={vi.fn()}
          onShiftChange={vi.fn()}
        />
      </NextIntlClientProvider>
    );
    const badge = screen.getByLabelText(frMessages.labor.logDayDialog.tile.conflictBadge);
    expect(badge.getAttribute("title")).toBe(
      `Second: ${frMessages.labor.shiftHalf}, Third: ${frMessages.labor.supplement.standaloneShiftLabel}`
    );
    expect(badge.getAttribute("title")).not.toMatch(/half|\(supplement\)/);
  });
});

describe("AttendanceCalendar month header", () => {
  it("capitalises only the first letter of the vi month", () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <AttendanceCalendar
          entries={[]}
          workers={[]}
          isLoading={false}
          canManage={false}
          month="2026-10"
          workerFilter="all"
          onMonthChange={vi.fn()}
          onWorkerFilterChange={vi.fn()}
          onDelete={vi.fn()}
        />
      </NextIntlClientProvider>
    );
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.textContent).toBe("Tháng 10 năm 2026");
    expect(heading.className).not.toContain("capitalize");
  });
});
