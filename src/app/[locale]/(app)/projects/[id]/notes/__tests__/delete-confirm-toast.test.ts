import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock("sonner", () => ({ toast: mockToast }));

import { confirmDelete, flushPendingDeletes } from "../delete-confirm-toast";

function start() {
  const handlers = {
    onRemove: vi.fn(),
    onUndo: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    sendNow: vi.fn(),
  };
  confirmDelete({ label: "Note deleted", undoLabel: "Undo", ...handlers });
  const undo = mockToast.mock.calls.at(-1)![1].action.onClick as () => void;
  return { ...handlers, undo };
}

beforeEach(() => {
  vi.useFakeTimers();
  mockToast.mockClear();
});
afterEach(() => {
  flushPendingDeletes();
  vi.useRealTimers();
});

describe("confirmDelete", () => {
  it("commits the delete after the undo window", async () => {
    const h = start();
    expect(h.onRemove).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4000);
    expect(h.onConfirm).toHaveBeenCalledTimes(1);
    expect(h.sendNow).not.toHaveBeenCalled();
  });

  it("Undo restores the row and never deletes", async () => {
    const h = start();
    h.undo();
    expect(h.onUndo).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(h.onConfirm).not.toHaveBeenCalled();
  });

  it("sends a pending delete at once when the page is closed or reloaded", async () => {
    const h = start();
    window.dispatchEvent(new Event("pagehide"));
    expect(h.sendNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(h.onConfirm).not.toHaveBeenCalled();
    h.undo(); // too late: already sent
    expect(h.onUndo).not.toHaveBeenCalled();
  });
});
