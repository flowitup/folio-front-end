/**
 * LaborEntryCard — validated rows carrying a worker's change request.
 *
 * - "Change requested" badge + the requested values under the name
 * - Managers get Apply / Refuse (disabled while a decision is in flight)
 * - Without manager rights (or without handlers) nothing can be decided
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "@/messages/en.json";
import { LaborEntryCard, type ChangeRequestActions } from "../labor-entry-card";
import type { LaborEntry } from "@/types/labor";

function entry(overrides: Partial<LaborEntry> = {}): LaborEntry {
  return {
    id: "e1",
    worker_id: "w1",
    worker_name: "Nguyen Van Tho",
    date: "2026-09-06",
    amount_override: null,
    effective_cost: 120,
    note: null,
    shift_type: "full",
    supplement_hours: 0,
    created_at: "2026-09-06T06:00:00",
    status: "validated",
    change_requested_at: "2026-09-08T18:00:00",
    proposed_shift_type: "half",
    proposed_supplement_hours: 2,
    proposed_note: "left at noon",
    ...overrides,
  };
}

function actions(overrides: Partial<ChangeRequestActions> = {}): ChangeRequestActions {
  return { onApprove: vi.fn(), onRefuse: vi.fn(), busyIds: new Set(), ...overrides };
}

function renderCard(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("LaborEntryCard — change request", () => {
  it("shows the badge and the requested values, keeps the priced amount", () => {
    renderCard(<LaborEntryCard entry={entry()} canManage onDelete={vi.fn()} changeRequestActions={actions()} />);

    expect(screen.getByTestId("entry-change-badge").textContent).toBe("Change requested");
    expect(screen.getByTestId("entry-change-proposed").textContent).toBe(
      "Requested: Half day · +2h — left at noon",
    );
    expect(screen.getByText(/120/)).toBeDefined();
  });

  it("offers Apply / Refuse instead of Delete and hands over the request", () => {
    const onApprove = vi.fn();
    const onRefuse = vi.fn();
    renderCard(
      <LaborEntryCard
        entry={entry()}
        canManage
        onDelete={vi.fn()}
        changeRequestActions={actions({ onApprove, onRefuse })}
      />,
    );
    expect(screen.queryByLabelText("Delete")).toBeNull();

    fireEvent.click(screen.getByLabelText("Apply"));
    fireEvent.click(screen.getByLabelText("Refuse"));
    expect(onApprove).toHaveBeenCalledWith(
      expect.objectContaining({ entry_id: "e1", proposed_shift_type: "half", proposed_supplement_hours: 2 }),
    );
    expect(onRefuse).toHaveBeenCalledWith(expect.objectContaining({ entry_id: "e1" }));
  });

  it("disables both buttons while a decision on this entry is in flight", () => {
    renderCard(
      <LaborEntryCard
        entry={entry()}
        canManage
        onDelete={vi.fn()}
        changeRequestActions={actions({ busyIds: new Set(["e1"]) })}
      />,
    );
    expect(screen.getByLabelText("Apply")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Refuse")).toHaveProperty("disabled", true);
  });

  it("without manager rights shows the badge but no decision buttons", () => {
    renderCard(
      <LaborEntryCard entry={entry()} canManage={false} onDelete={vi.fn()} changeRequestActions={actions()} />,
    );
    expect(screen.getByTestId("entry-change-badge")).toBeDefined();
    expect(screen.queryByLabelText("Apply")).toBeNull();
    expect(screen.queryByLabelText("Refuse")).toBeNull();
  });

  it("a row without a change request keeps its Delete button and no badge", () => {
    renderCard(
      <LaborEntryCard
        entry={entry({
          change_requested_at: null,
          proposed_shift_type: null,
          proposed_supplement_hours: null,
          proposed_note: null,
        })}
        canManage
        onDelete={vi.fn()}
        changeRequestActions={actions()}
      />,
    );
    expect(screen.queryByTestId("entry-change-badge")).toBeNull();
    expect(screen.queryByTestId("entry-change-proposed")).toBeNull();
    expect(screen.getByLabelText("Delete")).toBeDefined();
  });
});
