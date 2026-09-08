/**
 * Settings → Notifications section.
 *
 * Pins the contract with the preferences API: one switch per event family plus the
 * master switch, partial PUT bodies, optimistic toggles that snap back on failure,
 * and category switches greyed out while the master switch is off.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { NotificationPreferencesSection } from "../notification-preferences-section";
import type { NotificationPreferences } from "@/types/notification-preferences";

const fetchAction = vi.fn();
const updateAction = vi.fn();
const toastError = vi.fn();

vi.mock("@/app/[locale]/(app)/settings/_actions/notification-preferences-actions", () => ({
  fetchNotificationPreferencesAction: (...args: unknown[]) => fetchAction(...args),
  updateNotificationPreferencesAction: (...args: unknown[]) => updateAction(...args),
}));

vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() },
}));

const ALL_ON: NotificationPreferences = {
  push_enabled: true,
  chat: true,
  attendance: true,
  tasks: true,
  membership: true,
  billing: true,
};

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <NotificationPreferencesSection />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotificationPreferencesSection", () => {
  it("renders the master switch plus one switch per category from the server state", async () => {
    fetchAction.mockResolvedValue({ ok: true, data: { ...ALL_ON, chat: false } });
    renderSection();

    const switches = await screen.findAllByRole("switch");
    expect(switches).toHaveLength(6);
    expect(screen.getByRole("switch", { name: "Push notifications" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Team chat" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Money" })).toBeChecked();
  });

  it("sends only the toggled field and applies the server's answer", async () => {
    fetchAction.mockResolvedValue({ ok: true, data: ALL_ON });
    updateAction.mockResolvedValue({ ok: true, data: { ...ALL_ON, tasks: false } });
    renderSection();

    const tasks = await screen.findByRole("switch", { name: "Tasks" });
    fireEvent.click(tasks);

    await waitFor(() => expect(updateAction).toHaveBeenCalledWith({ tasks: false }));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Tasks" })).not.toBeChecked());
    expect(toastError).not.toHaveBeenCalled();
  });

  it("snaps the switch back and reports the error when the save fails", async () => {
    fetchAction.mockResolvedValue({ ok: true, data: ALL_ON });
    updateAction.mockResolvedValue({ ok: false, error: "unknown" });
    renderSection();

    const billing = await screen.findByRole("switch", { name: "Money" });
    fireEvent.click(billing);

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("switch", { name: "Money" })).toBeChecked();
  });

  it("greys out every category while the master switch is off", async () => {
    fetchAction.mockResolvedValue({ ok: true, data: { ...ALL_ON, push_enabled: false } });
    renderSection();

    await screen.findByRole("switch", { name: "Push notifications" });
    expect(screen.getByRole("switch", { name: "Push notifications" })).not.toBeDisabled();
    for (const name of ["Team chat", "Attendance", "Tasks", "Team & access", "Money"]) {
      expect(screen.getByRole("switch", { name })).toBeDisabled();
    }
  });

  it("shows the load error instead of switches when the fetch fails", async () => {
    fetchAction.mockResolvedValue({ ok: false, error: "unknown" });
    renderSection();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load your notification settings."
    );
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });
});
