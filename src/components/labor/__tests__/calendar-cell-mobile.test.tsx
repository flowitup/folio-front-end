/**
 * CalendarCell at phone width: a compact day total and initials instead of a
 * total cut to "1 170,0" and names cut to 5 letters. Both forms are in the DOM;
 * CSS (sm:) picks one.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import frMessages from "@/messages/fr.json";
import { CalendarCell } from "../calendar-cell";
import type { LaborEntry } from "@/types/labor";

const DAY = new Date(2026, 8, 8);

function entry(id: string, name: string, cost: number): LaborEntry {
  return {
    id,
    worker_id: `w-${id}`,
    worker_name: name,
    date: "2026-09-08",
    amount_override: null,
    effective_cost: cost,
    note: null,
    shift_type: "full",
    supplement_hours: 0,
    created_at: "2026-09-08T06:00:00",
    status: "validated",
  };
}

describe("CalendarCell — phone width", () => {
  it("offers a compact total and initials for small screens", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={frMessages}>
        <CalendarCell date={DAY} entries={[entry("1", "Laurent Vasseur", 1170)]} />
      </NextIntlClientProvider>,
    );

    const compact = container.querySelector(".sm\\:hidden.tabular-nums");
    expect(compact?.textContent?.replace(/\s/g, " ")).toMatch(/^1,17 k\s?€$/);
    expect(screen.getByText("LV")).toHaveClass("sm:hidden");
    expect(screen.getByText("Laurent Vasseur")).toHaveClass("hidden");
  });
});
