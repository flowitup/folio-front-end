/**
 * ChangeRequestsPanel / RefuseChangeDialog — the managers' review list of
 * worker change requests on the attendance tab.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "@/messages/en.json";
import { ChangeRequestsPanel, RefuseChangeDialog } from "../change-requests-panel";
import type { AttendanceChangeRequest } from "@/types/labor";

const REQUEST: AttendanceChangeRequest = {
  entry_id: "e1",
  worker_id: "w1",
  worker_name: "Nguyen Van Tho",
  date: "2026-09-06",
  shift_type: "full",
  supplement_hours: 2,
  note: "arrived 7am",
  proposed_shift_type: "half",
  proposed_supplement_hours: 0,
  proposed_note: null,
  requested_at: "2026-09-08T18:00:00",
};

function withIntl(ui: React.ReactElement) {
  return <NextIntlClientProvider locale="en" messages={enMessages}>{ui}</NextIntlClientProvider>;
}

function renderPanel(props: Partial<React.ComponentProps<typeof ChangeRequestsPanel>> = {}) {
  const handlers = { onApprove: vi.fn(), onRefuse: vi.fn(), onRetry: vi.fn() };
  render(
    withIntl(
      <ChangeRequestsPanel
        requests={[REQUEST]}
        isLoading={false}
        loadFailed={false}
        settlingIds={new Set()}
        {...handlers}
        {...props}
      />,
    ),
  );
  return handlers;
}

describe("ChangeRequestsPanel", () => {
  it("renders nothing when there is nothing to review", () => {
    renderPanel({ requests: [] });
    expect(screen.queryByTestId("change-requests-panel")).toBeNull();
  });

  it("lists each request with the current and the requested values", () => {
    renderPanel();
    expect(screen.getByText("Change requests (1)")).toBeDefined();
    const row = screen.getByTestId("change-request-e1");
    expect(within(row).getByText("Nguyen Van Tho")).toBeDefined();
    expect(within(row).getByText(/06\/09\/2026/)).toBeDefined();
    expect(within(row).getByTestId("change-request-current").textContent).toBe("Full day · +2h — arrived 7am");
    expect(within(row).getByTestId("change-request-proposed").textContent).toBe("Half day — note removed");
  });

  it("Apply and Refuse hand the request to the page", () => {
    const { onApprove, onRefuse } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^Apply/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Refuse/ }));
    expect(onApprove).toHaveBeenCalledWith(REQUEST);
    expect(onRefuse).toHaveBeenCalledWith(REQUEST);
  });

  it("disables a row's buttons while its decision is in flight", () => {
    renderPanel({ settlingIds: new Set(["e1"]) });
    expect(screen.getByRole("button", { name: /^Apply/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /^Refuse/ })).toHaveProperty("disabled", true);
  });

  it("shows the load error with a retry, even with nothing listed", () => {
    const { onRetry } = renderPanel({ requests: [], loadFailed: true });
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load all change requests.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows a refresh spinner while reloading", () => {
    renderPanel({ isLoading: true });
    expect(screen.getByLabelText("Refreshing change requests")).toBeDefined();
  });
});

describe("RefuseChangeDialog", () => {
  it("is closed without a request", () => {
    render(withIntl(<RefuseChangeDialog request={null} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />));
    expect(screen.queryByText("Refuse this change?")).toBeNull();
  });

  it("names the worker and day, confirms or cancels", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(withIntl(<RefuseChangeDialog request={REQUEST} busy={false} onConfirm={onConfirm} onCancel={onCancel} />));

    expect(screen.getByText("Refuse this change?")).toBeDefined();
    expect(
      screen.getByText("Nguyen Van Tho's day of 06/09/2026 stays as validated and the request is dropped."),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Refuse" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while the refusal is in flight", () => {
    render(withIntl(<RefuseChangeDialog request={REQUEST} busy onConfirm={vi.fn()} onCancel={vi.fn()} />));
    expect(screen.getByRole("button", { name: "Refuse" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", true);
  });
});
