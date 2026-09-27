/**
 * Worker card actions must be reachable on touch screens: the bar is hidden
 * only through .hover-reveal (a (hover: hover) media rule in globals.css),
 * never with a bare opacity-0 that nothing reveals on a phone.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { WorkerList } from "../worker-list";
import type { Worker } from "@/types/labor";

vi.mock("@/components/labor/labor-export-dialog", () => ({ LaborExportDialog: () => null }));
vi.mock("@/components/labor/adjust-rate-dialog", () => ({ AdjustRateDialog: () => null }));

const WORKER: Worker = {
  id: "w1",
  project_id: "p1",
  name: "Karim",
  phone: null,
  daily_rate: 150,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

describe("WorkerList action bar", () => {
  it("is hidden only where the device can hover", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <WorkerList
          workers={[WORKER]}
          canManage
          projectId="p1"
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          onDeactivate={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    const bar = screen.getByRole("button", { name: enMessages.labor.editWorker }).parentElement!;
    expect(bar.className).toContain("hover-reveal");
    expect(bar.className).not.toMatch(/(^|\s)opacity-0(\s|$)/);

    const css = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf8");
    expect(css).toMatch(/@media \(hover: hover\) \{\s*\.hover-reveal \{\s*opacity: 0;/);
  });
});
