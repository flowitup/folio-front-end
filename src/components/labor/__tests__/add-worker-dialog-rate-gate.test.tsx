/**
 * Tests for AddWorkerDialog rate field gating.
 *
 * Covers:
 * - daily_rate input is PRESENT in create mode.
 * - daily_rate input is ABSENT in edit mode.
 * - Edit submit does NOT include daily_rate in the onSave payload.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { AddWorkerDialog } from "../add-worker-dialog";
import type { Worker } from "@/types/labor";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/persons/person-typeahead", () => ({
  PersonTypeahead: ({
    onChange,
  }: {
    value: unknown;
    onChange: (p: { id: string; name: string; phone: string | null }) => void;
    placeholder?: string;
  }) => (
    <button
      type="button"
      data-testid="person-typeahead"
      onClick={() => onChange({ id: "person-1", name: "Alice", phone: null })}
    >
      Select person
    </button>
  ),
}));

vi.mock(
  "@/app/[locale]/(app)/projects/[id]/labor/components/role-select-with-create",
  () => ({
    RoleSelectWithCreate: () => null,
  }),
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EDIT_WORKER: Worker = {
  id: "worker-1",
  project_id: "proj-1",
  name: "Alice Dupont",
  phone: "+33612345678",
  daily_rate: 120,
  current_daily_rate: 150,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const BASE_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AddWorkerDialog — daily_rate field visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    BASE_PROPS.onSave.mockResolvedValue(undefined);
  });

  it("shows daily_rate input in create mode", () => {
    render(<AddWorkerDialog {...BASE_PROPS} />);
    expect(document.querySelector("#dailyRate")).toBeTruthy();
  });

  it("hides daily_rate input in edit mode", () => {
    render(<AddWorkerDialog {...BASE_PROPS} editWorker={EDIT_WORKER} />);
    expect(document.querySelector("#dailyRate")).toBeNull();
  });
});

describe("AddWorkerDialog — edit submit payload excludes daily_rate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    BASE_PROPS.onSave.mockResolvedValue(undefined);
  });

  it("edit submit calls onSave without daily_rate", async () => {
    render(<AddWorkerDialog {...BASE_PROPS} editWorker={EDIT_WORKER} />);

    // Update name field to ensure valid submit
    const nameInput = document.querySelector("#name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Alice Updated" } });

    // Submit the form
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(BASE_PROPS.onSave).toHaveBeenCalledTimes(1);
    });

    const payload = BASE_PROPS.onSave.mock.calls[0][0] as Record<string, unknown>;
    expect("daily_rate" in payload).toBe(false);
    expect(payload.name).toBe("Alice Updated");
  });
});
