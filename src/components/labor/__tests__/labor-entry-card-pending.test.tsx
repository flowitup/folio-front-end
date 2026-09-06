/**
 * LaborEntryCard — worker-submitted (pending) rows.
 *
 * - Pending badge shown, amount hidden (unpriced until validated)
 * - Managers get Validate / Reject instead of Delete on a pending row
 * - Validated rows keep the amount and the Delete button
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaborEntryCard } from "../labor-entry-card";
import type { LaborEntry } from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "en",
}));

function entry(overrides: Partial<LaborEntry>): LaborEntry {
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
    ...overrides,
  };
}

describe("LaborEntryCard — pending row", () => {
  it("shows the pending badge, hides the amount and offers validate / reject", () => {
    const onValidate = vi.fn();
    const onReject = vi.fn();
    render(
      <LaborEntryCard
        entry={entry({ status: "pending", effective_cost: 0 })}
        canManage
        onDelete={vi.fn()}
        onValidate={onValidate}
        onReject={onReject}
      />
    );
    expect(screen.getByTestId("entry-pending-badge")).toBeDefined();
    expect(screen.queryByText(/€/)).toBeNull();
    expect(screen.queryByLabelText("labor.delete")).toBeNull();

    fireEvent.click(screen.getByLabelText("labor.validate"));
    fireEvent.click(screen.getByLabelText("labor.reject"));
    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("validated row keeps the amount and the delete button", () => {
    render(
      <LaborEntryCard
        entry={entry({})}
        canManage
        onDelete={vi.fn()}
        onValidate={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.queryByTestId("entry-pending-badge")).toBeNull();
    expect(screen.getByLabelText("labor.delete")).toBeDefined();
    expect(screen.getByText(/120/)).toBeDefined();
  });

  it("a pending row without manager rights shows no action buttons", () => {
    render(
      <LaborEntryCard entry={entry({ status: "pending", effective_cost: 0 })} canManage={false} onDelete={vi.fn()} />
    );
    expect(screen.getByTestId("entry-pending-badge")).toBeDefined();
    expect(screen.queryByLabelText("labor.validate")).toBeNull();
    expect(screen.queryByLabelText("labor.delete")).toBeNull();
  });
});
