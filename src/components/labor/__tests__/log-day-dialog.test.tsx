/**
 * LogDayDialog — checks the API's limits before sending, and never shows the
 * raw "HTTP 400: BAD REQUEST" of a refused save.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  fetchLaborEntries: vi.fn().mockResolvedValue([]),
  setLaborDayDescription: vi.fn(),
}));
vi.mock("@/components/labor/cross-project-conflict-modal", () => ({
  CrossProjectConflictModal: () => null,
}));
// The grid exposes the tile callbacks as plain buttons.
vi.mock("@/components/labor/log-day-tile-grid", () => ({
  LogDayTileGrid: ({
    workers,
    tileStates,
    onToggle,
    onSupplementHoursChange,
    onAmountOverrideChange,
  }: {
    workers: Worker[];
    tileStates: Record<string, { locked: boolean }>;
    onToggle: (id: string, next: boolean) => void;
    onSupplementHoursChange: (id: string, next: number) => void;
    onAmountOverrideChange: (id: string, next: number | undefined) => void;
  }) => (
    <div>
      {workers.map((w) => (
        <div key={w.id}>
          {tileStates[w.id]?.locked && <span>locked {w.name}</span>}
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

import { bulkLogAttendance, fetchLaborEntries } from "@/lib/api/labor";
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchLaborEntries).mockResolvedValue([]);
});

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

describe("LogDayDialog — date range", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderOn(initialDate: string, onLogNextDay?: (d: string) => void) {
    render(
      <LogDayDialog
        open
        onOpenChange={vi.fn()}
        projectId="p-1"
        workers={[WORKER]}
        entries={[]}
        initialDate={initialDate}
        onLogNextDay={onLogNextDay}
        onSaved={vi.fn()}
      />
    );
  }

  it("stops the ▶ arrow and the date input at today", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 9, 12) });
    renderOn("2026-10-09");
    await screen.findByRole("button", { name: "pick Alice" });

    expect(screen.getByRole("button", { name: "labor.nextDay" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "labor.prevDay" })).toBeEnabled();
    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input.max).toBe("2026-10-09");
    expect(input.min).toBe("2000-01-01");
  });

  it("refuses a typed future day before sending", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 9, 12) });
    renderOn("2031-12-25");
    fireEvent.click(await screen.findByRole("button", { name: "pick Alice" }));
    save();

    expect(await screen.findByText("labor.errors.dateOutOfRange")).toBeInTheDocument();
    expect(bulkLogAttendance).not.toHaveBeenCalled();
  });

  it("translates the server's out-of-range refusal", async () => {
    vi.mocked(bulkLogAttendance).mockRejectedValue(
      new ApiError("HTTP 400: BAD REQUEST", 400, { error: "AttendanceDateOutOfRange", message: "..." })
    );
    renderOn("2026-09-20");
    fireEvent.click(await screen.findByRole("button", { name: "pick Alice" }));
    save();

    expect(await screen.findByText("labor.errors.dateOutOfRange")).toBeInTheDocument();
  });

  it("offers no 'Log next day' action after logging today", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 9, 12) });
    const { toast } = await import("sonner");
    vi.mocked(bulkLogAttendance).mockResolvedValue({ created: [{}], skipped_worker_ids: [] } as never);
    renderOn("2026-10-09", vi.fn());
    fireEvent.click(await screen.findByRole("button", { name: "pick Alice" }));
    save();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(vi.mocked(toast.success).mock.calls[0][1]).toBeUndefined();
  });
});

describe("LogDayDialog — 'Log next day' toast action", () => {
  it("asks the page to reopen the dialog on the next day", async () => {
    const { toast } = await import("sonner");
    vi.mocked(bulkLogAttendance).mockResolvedValue({ created: [{}], skipped_worker_ids: [] } as never);
    const onLogNextDay = vi.fn();
    render(
      <LogDayDialog
        open
        onOpenChange={vi.fn()}
        projectId="p-1"
        workers={[WORKER]}
        entries={[]}
        initialDate="2026-09-20"
        onLogNextDay={onLogNextDay}
        onSaved={vi.fn()}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: "pick Alice" }));
    save();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const options = vi.mocked(toast.success).mock.calls[0][1] as unknown as {
      action: { onClick: () => void };
    };
    options.action.onClick();
    expect(onLogNextDay).toHaveBeenCalledWith("2026-09-21");
  });
});

describe("LogDayDialog — what is already logged on the picked date", () => {
  it("locks a worker logged that day even when the page's month does not hold it", async () => {
    vi.mocked(fetchLaborEntries).mockResolvedValue([
      {
        id: "e-1",
        worker_id: "w-1",
        worker_name: "Alice",
        date: "2026-09-20",
        amount_override: null,
        effective_cost: 100,
        note: null,
        shift_type: "full",
        supplement_hours: 0,
        created_at: "2026-09-20T08:00:00Z",
      },
    ] as never);
    renderDialog(); // the page passes no entries (another month is shown)

    expect(await screen.findByText("locked Alice")).toBeInTheDocument();
    expect(fetchLaborEntries).toHaveBeenCalledWith("p-1", { from: "2026-08-21", to: "2026-09-20" });
  });
});

