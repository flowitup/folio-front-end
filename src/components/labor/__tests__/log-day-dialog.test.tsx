/**
 * LogDayDialog — checks the API's limits before sending, and never shows the
 * raw "HTTP 400: BAD REQUEST" of a refused save.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Worker } from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "en",
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/hooks/use-last-logged-day", () => ({
  useLastLoggedDay: () => ({ date: null, workers: [] }),
}));
vi.mock("@/hooks/use-cross-project-conflicts", () => ({
  useCrossProjectConflicts: () => ({ groups: [], byPersonId: new Map(), refetch: vi.fn() }),
}));
vi.mock("@/lib/api/labor", () => ({
  bulkLogAttendance: vi.fn(),
  fetchLaborDayDescriptions: vi.fn().mockResolvedValue([]),
  setLaborDayDescription: vi.fn(),
}));
vi.mock("@/components/labor/cross-project-conflict-modal", () => ({
  CrossProjectConflictModal: () => null,
}));
// The grid exposes the tile callbacks as plain buttons.
vi.mock("@/components/labor/log-day-tile-grid", () => ({
  LogDayTileGrid: ({
    workers,
    onToggle,
    onSupplementHoursChange,
    onAmountOverrideChange,
  }: {
    workers: Worker[];
    onToggle: (id: string, next: boolean) => void;
    onSupplementHoursChange: (id: string, next: number) => void;
    onAmountOverrideChange: (id: string, next: number | undefined) => void;
  }) => (
    <div>
      {workers.map((w) => (
        <div key={w.id}>
          <button type="button" onClick={() => onToggle(w.id, true)}>
            pick {w.name}
          </button>
          <button type="button" onClick={() => onSupplementHoursChange(w.id, 15)}>
            supplement 15 {w.name}
          </button>
          <button type="button" onClick={() => onAmountOverrideChange(w.id, -5)}>
            override -5 {w.name}
          </button>
        </div>
      ))}
    </div>
  ),
}));

import { bulkLogAttendance } from "@/lib/api/labor";
import { ApiError } from "@/lib/api/http";
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

function renderDialog() {
  render(
    <LogDayDialog
      open
      onOpenChange={vi.fn()}
      projectId="p-1"
      workers={[WORKER]}
      entries={[]}
      initialDate="2026-09-20"
      onSaved={vi.fn()}
    />
  );
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: /labor\.logDayDialog\.saveButton/ }));
}

beforeEach(() => vi.clearAllMocks());

describe("LogDayDialog — limits and errors", () => {
  it("refuses supplement hours past 12 before sending", async () => {
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "pick Alice" }));
    fireEvent.click(screen.getByRole("button", { name: "supplement 15 Alice" }));
    save();

    expect(await screen.findByText("labor.errors.supplementOutOfRange")).toBeInTheDocument();
    expect(bulkLogAttendance).not.toHaveBeenCalled();
  });

  it("refuses a negative amount before sending", async () => {
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "pick Alice" }));
    fireEvent.click(screen.getByRole("button", { name: "override -5 Alice" }));
    save();

    expect(await screen.findByText("labor.errors.overrideNegative")).toBeInTheDocument();
    expect(bulkLogAttendance).not.toHaveBeenCalled();
  });

  it("shows a translated message, not 'HTTP 400: BAD REQUEST', when the server refuses", async () => {
    vi.mocked(bulkLogAttendance).mockRejectedValue(
      new ApiError("HTTP 400: BAD REQUEST", 400, { error: "BadRequest" })
    );
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "pick Alice" }));
    save();

    await waitFor(() => expect(bulkLogAttendance).toHaveBeenCalled());
    expect(await screen.findByText("labor.logDayDialog.saveFailed")).toBeInTheDocument();
    expect(screen.queryByText(/HTTP 400/)).toBeNull();
  });
});
