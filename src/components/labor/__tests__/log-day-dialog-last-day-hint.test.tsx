/**
 * The "Same as last day" button's hint shows the date as the app writes dates
 * (dd/mm/yyyy), never the raw ISO "2026-10-02".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Worker } from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${ns}.${key}(${JSON.stringify(values)})` : `${ns}.${key}`,
  useLocale: () => "fr",
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/hooks/use-last-logged-day", () => ({
  useLastLoggedDay: () => ({
    date: "2026-10-02",
    workers: [{ worker_id: "w-1", shift_type: "full", supplement_hours: 0 }],
  }),
}));
vi.mock("@/hooks/use-cross-project-conflicts", () => ({
  useCrossProjectConflicts: () => ({ groups: [], byPersonId: new Map(), refetch: vi.fn() }),
}));
vi.mock("@/lib/api/labor", () => ({
  bulkLogAttendance: vi.fn(),
  fetchLaborDayDescriptions: vi.fn().mockResolvedValue([]),
  fetchLaborEntries: vi.fn().mockResolvedValue([]),
  setLaborDayDescription: vi.fn(),
}));
vi.mock("@/components/labor/cross-project-conflict-modal", () => ({
  CrossProjectConflictModal: () => null,
}));
vi.mock("@/components/labor/log-day-tile-grid", () => ({
  LogDayTileGrid: () => null,
}));

import { LogDayDialog } from "../log-day-dialog";

const WORKER = {
  id: "w-1",
  project_id: "p-1",
  name: "Alice",
  phone: null,
  daily_rate: 100,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
} as Worker;

describe("LogDayDialog — same as last day hint", () => {
  it("writes the last day as dd/mm/yyyy", () => {
    render(
      <LogDayDialog
        open
        onOpenChange={vi.fn()}
        projectId="p-1"
        workers={[WORKER]}
        entries={[]}
        initialDate="2026-10-03"
        onSaved={vi.fn()}
      />
    );
    const button = screen.getByRole("button", { name: "labor.logDayDialog.sameAsLastDay" });
    expect(button.getAttribute("title")).toBe('labor.logDayDialog.sameAsLastDayHint({"date":"02/10/2026"})');
  });
});
