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

vi.mock("../actions", () => ({
  fetchDueNotificationsAction: vi.fn(),
  dismissNotificationAction: vi.fn(),
}));

// ---- Imports after mocks ----

const { fetchDueNotificationsAction, dismissNotificationAction } = await import("../actions");
const mockFetch = vi.mocked(fetchDueNotificationsAction);
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
      due_date: "2024-06-15",
      lead_time_minutes: 0,
      status: "open",
      fire_at: "2024-06-15T09:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    fire_at: "2024-06-15T09:00:00Z",
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
    mockFetch.mockResolvedValue([]);
    render(<NotificationsBell />);
    await flushTick();

    expect(screen.queryByText("1")).toBeNull();
    expect(screen.queryByText("9+")).toBeNull();
  });

  it("shows badge with count when 1-9 notifications", async () => {
    const items = [makeNotification("n1"), makeNotification("n2")];
    mockFetch.mockResolvedValue(items);
    render(<NotificationsBell />);
    await flushTick();

    expect(screen.getByText("2")).toBeDefined();
  });

  it('shows "9+" badge when more than 9 notifications', async () => {
    const items = Array.from({ length: 10 }, (_, i) => makeNotification(`n${i}`));
    mockFetch.mockResolvedValue(items);
    render(<NotificationsBell />);
    await flushTick();

    expect(screen.getByText("9+")).toBeDefined();
  });

  it('shows "9" badge for exactly 9 notifications (boundary)', async () => {
    const items = Array.from({ length: 9 }, (_, i) => makeNotification(`n${i}`));
    mockFetch.mockResolvedValue(items);
    render(<NotificationsBell />);
    await flushTick();

    expect(screen.getByText("9")).toBeDefined();
  });
});

describe("NotificationsBell — popover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    mockFetch.mockResolvedValue([]);
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
    mockFetch.mockResolvedValue(items);
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
    mockFetch.mockResolvedValue(items);
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
    mockFetch.mockResolvedValue([]);
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
