/**
 * Tests for notifications server actions.
 * Mirrors admin/users/actions.test.ts pattern.
 *
 * Covers:
 * - fetchDueNotificationsAction: returns items on success, returns [] on any error
 * - dismissNotificationAction: UUID validation + classifyBackendError mapping
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks (must be before imports) ----

vi.mock("@/lib/api/notifications", () => ({
  listDueNotifications: vi.fn(),
  dismissNotification: vi.fn(),
}));

// ---- Imports after mocks ----

const { fetchDueNotificationsAction, dismissNotificationAction } = await import("../actions");
const { listDueNotifications, dismissNotification } = await import("@/lib/api/notifications");
const mockList = vi.mocked(listDueNotifications);
const mockDismiss = vi.mocked(dismissNotification);

// ---- Helpers ----

function httpError(
  status: number,
  body: { error?: string; message?: string } | null = null
): Error & { status: number; body: typeof body } {
  const err = new Error(`HTTP ${status}`) as Error & {
    status: number;
    body: typeof body;
  };
  err.status = status;
  err.body = body;
  return err;
}

function makeNotification(noteId = NOTE_ID) {
  return {
    note: {
      id: noteId,
      project_id: "proj-1",
      created_by: "user-1",
      title: "Test note",
      description: null,
      due_date: "2024-06-15",
      lead_time_minutes: 0 as const,
      status: "open" as const,
      fire_at: "2024-06-15T09:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    fire_at: "2024-06-15T09:00:00Z",
  };
}

const NOTE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BAD_UUID = "not-a-uuid";

// ---- fetchDueNotificationsAction ----

describe("fetchDueNotificationsAction — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns items array from listDueNotifications", async () => {
    const item = makeNotification();
    mockList.mockResolvedValueOnce({ items: [item], count: 1 });

    const result = await fetchDueNotificationsAction();
    expect(result).toHaveLength(1);
    expect(result[0].note.id).toBe(NOTE_ID);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when listDueNotifications returns empty", async () => {
    mockList.mockResolvedValueOnce({ items: [], count: 0 });
    const result = await fetchDueNotificationsAction();
    expect(result).toEqual([]);
  });
});

describe("fetchDueNotificationsAction — graceful error handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] on 500 error (bell shows last-known state without disrupting UI)", async () => {
    mockList.mockRejectedValueOnce(httpError(500));
    const result = await fetchDueNotificationsAction();
    expect(result).toEqual([]);
  });

  it("returns [] on 401 error (auth expired — don't crash the page)", async () => {
    mockList.mockRejectedValueOnce(httpError(401));
    const result = await fetchDueNotificationsAction();
    expect(result).toEqual([]);
  });

  it("returns [] on network error", async () => {
    mockList.mockRejectedValueOnce(new Error("Network error"));
    const result = await fetchDueNotificationsAction();
    expect(result).toEqual([]);
  });

  it("returns [] on 429 rate-limit error", async () => {
    mockList.mockRejectedValueOnce(httpError(429));
    const result = await fetchDueNotificationsAction();
    expect(result).toEqual([]);
  });
});

// ---- dismissNotificationAction — UUID validation ----

describe("dismissNotificationAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID noteId with validation error", async () => {
    const result = await dismissNotificationAction(BAD_UUID);
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it("rejects empty string noteId", async () => {
    const result = await dismissNotificationAction("");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockDismiss).not.toHaveBeenCalled();
  });
});

// ---- dismissNotificationAction — error mapping ----

describe("dismissNotificationAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("400 → validation", async () => {
    mockDismiss.mockRejectedValueOnce(httpError(400));
    const result = await dismissNotificationAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: "validation" });
  });

  it("401 → unauthorized", async () => {
    mockDismiss.mockRejectedValueOnce(httpError(401));
    const result = await dismissNotificationAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: "unauthorized" });
  });

  it("403 → forbidden", async () => {
    mockDismiss.mockRejectedValueOnce(httpError(403));
    const result = await dismissNotificationAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockDismiss.mockRejectedValueOnce(httpError(404));
    const result = await dismissNotificationAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: "notFound" });
  });

  it("429 → rateLimited", async () => {
    mockDismiss.mockRejectedValueOnce(httpError(429));
    const result = await dismissNotificationAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: "rateLimited" });
  });

  it("500 → generic", async () => {
    mockDismiss.mockRejectedValueOnce(httpError(500));
    const result = await dismissNotificationAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: "generic" });
  });

  it("missing body still classifies by status", async () => {
    mockDismiss.mockRejectedValueOnce(httpError(403, null));
    const result = await dismissNotificationAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: "forbidden" });
  });
});

// ---- dismissNotificationAction — happy path ----

describe("dismissNotificationAction — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls dismissNotification with noteId and returns success", async () => {
    mockDismiss.mockResolvedValueOnce(undefined);
    const result = await dismissNotificationAction(NOTE_ID);
    expect(mockDismiss).toHaveBeenCalledWith(NOTE_ID);
    expect(result).toEqual({ success: true });
  });
});
