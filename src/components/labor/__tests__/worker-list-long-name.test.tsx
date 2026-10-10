/**
 * A long worker name must truncate inside its card: the identity block is a
 * flex item of an items-center column, so without w-full it sizes to the
 * unwrapped text and the `truncate` never clips. The full name stays
 * reachable through the title attribute.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { WorkerList } from "../worker-list";
import type { Worker } from "@/types/labor";

vi.mock("@/components/labor/labor-export-dialog", () => ({ LaborExportDialog: () => null }));
vi.mock("@/components/labor/adjust-rate-dialog", () => ({ AdjustRateDialog: () => null }));

const LONG_NAME = "Jean-Baptiste Émile de la Fontaine-Saint-Germain";

const WORKER: Worker = {
  id: "w1",
  project_id: "p1",
  name: LONG_NAME,
  phone: null,
  daily_rate: 150,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

describe("WorkerList long names", () => {
  it("constrains the identity block to the card width and keeps the full name in a tooltip", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <WorkerList
          workers={[WORKER]}
          canManage={false}
          projectId="p1"
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          onDeactivate={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    const name = screen.getByText(LONG_NAME);
    expect(name.className).toContain("truncate");
    expect(name).toHaveAttribute("title", LONG_NAME);
    expect(name.parentElement!.className).toMatch(/(^|\s)w-full(\s|$)/);
    expect(name.parentElement!.className).toContain("min-w-0");
  });
});
