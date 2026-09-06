/**
 * Tests for the attendance-to-validate section of the bell.
 *
 * Covers:
 * - Dropdown renders the attendance section and rows when attendance is present
 * - Validate button calls onValidate with the item
 * - Reject requires an inline confirmation before calling onReject
 * - Main area navigates to the project's attendance tab
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationsDropdown } from "../notifications-dropdown";
import { AttendancePendingRow } from "../attendance-pending-row";
import type { AttendancePending } from "@/lib/api/notifications";

const push = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, vars?: Record<string, string>) =>
    vars?.worker ? `${ns}.${key}:${vars.worker}` : `${ns}.${key}`,
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const ITEM: AttendancePending = {
  kind: "attendance_pending",
  entry_id: "e1",
  project_id: "proj-1",
  project_name: "Chantier AV",
  worker_id: "w1",
  worker_name: "Nguyen Van Tho",
  date: "2026-09-06",
  shift_type: "full",
  supplement_hours: 2,
  note: "arrived 7am",
  submitted_at: "2026-09-06T06:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotificationsDropdown — attendance section", () => {
  it("renders the attendance section with the worker, project and shift", () => {
    render(
      <NotificationsDropdown
        items={[]}
        attendance={[ITEM]}
        isLoading={false}
        onDismiss={vi.fn()}
        onValidate={vi.fn()}
        onReject={vi.fn()}
        onClickRow={vi.fn()}
      />
    );
    expect(screen.getAllByText("notifications.attendance.title").length).toBeGreaterThan(0);
    expect(screen.getByText("Nguyen Van Tho")).toBeDefined();
    expect(screen.getByText(/Chantier AV/)).toBeDefined();
    expect(screen.getByText(/labor\.shiftFull/)).toBeDefined();
    expect(screen.getByText(/\+2h/)).toBeDefined();
    expect(screen.queryByText("notifications.empty")).toBeNull();
  });
});

describe("AttendancePendingRow — actions", () => {
  it("validate calls onValidate immediately", () => {
    const onValidate = vi.fn();
    render(
      <AttendancePendingRow item={ITEM} onValidate={onValidate} onReject={vi.fn()} onNavigate={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText("notifications.attendance.validate"));
    expect(onValidate).toHaveBeenCalledWith(ITEM);
  });

  it("reject asks for confirmation, cancel keeps the row, confirm calls onReject", () => {
    const onReject = vi.fn();
    render(
      <AttendancePendingRow item={ITEM} onValidate={vi.fn()} onReject={onReject} onNavigate={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText("notifications.attendance.reject"));
    expect(onReject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("notifications.attendance.cancel"));
    expect(screen.getByLabelText("notifications.attendance.reject")).toBeDefined();

    fireEvent.click(screen.getByLabelText("notifications.attendance.reject"));
    fireEvent.click(screen.getByText("notifications.attendance.confirmReject"));
    expect(onReject).toHaveBeenCalledWith(ITEM);
  });

  it("main area navigates to the project's attendance tab and closes the popover", () => {
    const onNavigate = vi.fn();
    render(
      <AttendancePendingRow item={ITEM} onValidate={vi.fn()} onReject={vi.fn()} onNavigate={onNavigate} />
    );
    fireEvent.click(screen.getByLabelText("notifications.aria.goToAttendance:Nguyen Van Tho"));
    expect(push).toHaveBeenCalledWith("/en/projects/proj-1/labor?tab=attendance");
    expect(onNavigate).toHaveBeenCalled();
  });
});
