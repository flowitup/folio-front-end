/**
 * Tests for NotificationsBell component.
 *
 * Timer strategy:
 *   vi.useFakeTimers() throughout each test.
 *   vi.advanceTimersByTimeAsync(N) to advance clock + flush Promise microtasks.
 *   Avoids infinite-loop trap from vi.runAllTimersAsync() (hook reschedules itself).
 *   Avoids fake/real timer switching deadlock.
 *
 * Covers:
 * - Badge shows count, caps at "9+"
 * - No badge when count is 0
 * - Clicking bell opens popover
 * - Dismiss: optimistic remove + badge decrement
 * - Dismiss rollback on failure + error toast
 * - Polling fires immediately on mount
 * - Polling fires again after 60s interval
 * - document.hidden: poll skipped when tab hidden
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NotificationsBell } from "../notifications-bell";
import type { DueNotification } from "@/lib/api/notifications";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/labor", () => ({
  validateAttendance: vi.fn(),
  rejectAttendance: vi.fn(),
}));

vi.mock("../actions", () => ({
  fetchNotificationsFeedAction: vi.fn(),
  dismissNotificationAction: vi.fn(),
}));

// ---- Imports after mocks ----

const { fetchNotificationsFeedAction, dismissNotificationAction } = await import("../actions");
const { validateAttendance, rejectAttendance } = await import("@/lib/api/labor");
const mockValidate = vi.mocked(validateAttendance);
const mockReject = vi.mocked(rejectAttendance);
const mockFetch = vi.mocked(fetchNotificationsFeedAction);
const mockDismiss = vi.mocked(dismissNotificationAction);

const { toast } = await import("sonner");
const mockToast = toast as unknown as { error: ReturnType<typeof vi.fn> };

// ---- Helpers ----

/** Flush initial async tick without entering infinite-loop territory */
async function flushTick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
}

// ---- Fixtures ----

function makeNotification(id: string): DueNotification {
  return {
    note: {
      id,
      project_id: "proj-1",
      created_by: "user-1",
      title: `Note ${id}`,
      description: null,
      category: "general",
      status: "open" as const,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    dismissed: false,
  };
}

// ---- Tests ----

describe("NotificationsBell — badge display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows no badge when there are 0 notifications", async () => {
    mockFetch.mockResolvedValue({ items: [], attendance: [] });
    render(<NotificationsBell />);
    await flushTick();

    expect(screen.queryByText("1")).toBeNull();
    expect(screen.queryByText("9+")).toBeNull();
  });

  it("shows badge with count when 1-9 notifications", async () => {
    const items = [makeNotification("n1"), makeNotification("n2")];
    mockFetch.mockResolvedValue({ items, attendance: [] });
    render(<NotificationsBell />);
    await flushTick();

    expect(screen.getByText("2")).toBeDefined();
  });

  it('shows "9+" badge when more than 9 notifications', async () => {
    const items = Array.from({ length: 10 }, (_, i) => makeNotification(`n${i}`));
    mockFetch.mockResolvedValue({ items, attendance: [] });
    render(<NotificationsBell />);
    await flushTick();

    expect(screen.getByText("9+")).toBeDefined();
  });

  it("counts attendance awaiting validation in the badge", async () => {
    const items = [makeNotification("n1")];
    const attendance = [
      {
        kind: "attendance_pending" as const,
        entry_id: "e1",
        project_id: "p1",
        project_name: "Chantier",
        worker_id: "w1",
        worker_name: "Tho",
        date: "2026-09-06",
        shift_type: "full" as const,
        supplement_hours: 0,
        note: null,
        submitted_at: "2026-09-06T06:00:00",
      },
    ];
    mockFetch.mockResolvedValue({ items, attendance });
    render(<NotificationsBell />);
    await flushTick();

    expect(screen.getByText("2")).toBeDefined();
  });

  it('shows "9" badge for exactly 9 notifications (boundary)', async () => {
    const items = Array.from({ length: 9 }, (_, i) => makeNotification(`n${i}`));
    mockFetch.mockResolvedValue({ items, attendance: [] });
    render(<NotificationsBell />);
    await flushTick();

    expect(screen.getByText("9")).toBeDefined();
  });
});

const PENDING = {
  kind: "attendance_pending" as const,
  entry_id: "e1",
  project_id: "p1",
  project_name: "Chantier",
  worker_id: "w1",
  worker_name: "Tho",
  date: "2026-09-06",
  shift_type: "full" as const,
  supplement_hours: 0,
  note: null,
  submitted_at: "2026-09-06T06:00:00",
};

describe("NotificationsBell — validate / reject attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function openBellWithPending() {
    mockFetch.mockResolvedValue({ items: [], attendance: [PENDING] });
    render(<NotificationsBell />);
    await flushTick();
    expect(screen.getByText("1")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "notifications.aria.bell" }));
    await flushTick();
  }

  it("validate removes the row at once, clears the badge and toasts success", async () => {
    mockValidate.mockResolvedValue(undefined);
    await openBellWithPending();
    fireEvent.click(screen.getByLabelText("notifications.attendance.validate"));
    await flushTick();

    expect(mockValidate).toHaveBeenCalledWith("p1", "e1");
    expect(screen.queryByText("Tho")).toBeNull();
    expect(screen.queryByText("1")).toBeNull();
    expect(toast.success).toHaveBeenCalled();
  });

  it("a failed validate restores the row and toasts the error", async () => {
    mockValidate.mockRejectedValue(new Error("boom"));
    await openBellWithPending();
    fireEvent.click(screen.getByLabelText("notifications.attendance.validate"));
    await flushTick();

    expect(screen.getByText("Tho")).toBeDefined();
    expect(toast.error).toHaveBeenCalledWith("notifications.errors.validateFailed");
  });

  it("reject only calls the API after the inline confirmation", async () => {
    mockReject.mockResolvedValue(undefined);
    await openBellWithPending();
    fireEvent.click(screen.getByLabelText("notifications.attendance.reject"));
    expect(mockReject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("notifications.attendance.confirmReject"));
    await flushTick();

    expect(mockReject).toHaveBeenCalledWith("p1", "e1");
    expect(screen.queryByText("Tho")).toBeNull();
  });
});

describe("NotificationsBell — popover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    mockFetch.mockResolvedValue({ items: [], attendance: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clicking bell button opens the popover (aria-label check)", async () => {
    render(<NotificationsBell />);
    await flushTick();

    const bellBtn = screen.getByRole("button", { name: /notifications\.aria\.bell/i });
    fireEvent.click(bellBtn);

    expect(screen.getByText("notifications.title")).toBeDefined();
  });
});

describe("NotificationsBell — dismiss flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("optimistically removes dismissed item from list (badge decrements)", async () => {
    const items = [makeNotification("n1"), makeNotification("n2")];
    mockFetch.mockResolvedValue({ items, attendance: [] });
    mockDismiss.mockResolvedValue({ success: true });

    render(<NotificationsBell />);
    await flushTick();

    expect(screen.getByText("2")).toBeDefined();

    // Open popover
    fireEvent.click(screen.getByRole("button", { name: /notifications\.aria\.bell/i }));
    expect(screen.getByText("Note n1")).toBeDefined();

    // Click first dismiss button
    const dismissBtns = screen.getAllByRole("button", { name: /notifications\.dismissButton/i });
    fireEvent.click(dismissBtns[0]);

    // Flush the async dismiss action
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByText("1")).toBeDefined();
    expect(mockDismiss).toHaveBeenCalledWith("n1");
  }, 15000);

  it("rolls back dismissed item and shows error toast on failure", async () => {
    const items = [makeNotification("n1")];
    mockFetch.mockResolvedValue({ items, attendance: [] });
    mockDismiss.mockResolvedValue({ success: false, error: "generic" });

    render(<NotificationsBell />);
    await flushTick();

    expect(screen.getByText("1")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /notifications\.aria\.bell/i }));
    expect(screen.getByText("Note n1")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /notifications\.dismissButton/i }));

    // Flush async dismiss — rollback should restore the item
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByText("1")).toBeDefined();
    expect(mockToast.error).toHaveBeenCalled();
  }, 15000);
});

describe("NotificationsBell — polling cadence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // jitter = 0
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    mockFetch.mockResolvedValue({ items: [], attendance: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fires poll immediately on mount", async () => {
    render(<NotificationsBell />);
    await flushTick();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fires second poll after 60s interval", async () => {
    render(<NotificationsBell />);

    // Let initial tick complete
    await flushTick();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance past the 60s interval (jitter=0 via Math.random mock returning 0.5)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 15000);

  it("does not poll when document is hidden", async () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });

    render(<NotificationsBell />);
    await flushTick();

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
