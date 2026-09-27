/**
 * Deleting an entry from the calendar day sheet asks for confirmation first,
 * like the list view does.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { AttendanceCalendar } from "../attendance-calendar";
import type { LaborEntry } from "@/types/labor";

const ENTRY: LaborEntry = {
  id: "e1",
  worker_id: "w1",
  worker_name: "Karim",
  date: "2026-09-15",
  amount_override: null,
  effective_cost: 120,
  note: null,
  shift_type: "full",
  supplement_hours: 0,
  created_at: "2026-09-15T08:00:00Z",
};

describe("AttendanceCalendar entry delete", () => {
  it("only deletes after the confirmation", () => {
    const onDelete = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AttendanceCalendar
          entries={[ENTRY]}
          workers={[]}
          isLoading={false}
          canManage
          month="2026-09"
          workerFilter="all"
          onMonthChange={vi.fn()}
          onWorkerFilterChange={vi.fn()}
          onDelete={onDelete}
        />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Tuesday, September 15|September 15/ }));
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: enMessages.labor.delete }));
    expect(onDelete).not.toHaveBeenCalled();

    const confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByText(enMessages.labor.confirmDelete)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole("button", { name: enMessages.labor.delete }));
    expect(onDelete).toHaveBeenCalledWith(ENTRY);
  });
});
