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
import { ApiError } from "@/lib/api/http";
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
  "@/components/labor/role-select-with-create",
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

  it("pre-fills the name every screen shows (the person's), not the stale per-project copy", () => {
    render(
      <AddWorkerDialog {...BASE_PROPS} editWorker={{ ...EDIT_WORKER, person_id: "person-1", person_name: "Alice Martin" }} />,
    );
    expect((document.querySelector("#name") as HTMLInputElement).value).toBe("Alice Martin");
  });

  it("pre-fills the person's phone, not the stale per-project copy", () => {
    render(
      <AddWorkerDialog
        {...BASE_PROPS}
        editWorker={{ ...EDIT_WORKER, person_id: "person-1", person_phone: "+33699887766" }}
      />,
    );
    expect((document.querySelector("#phone") as HTMLInputElement).value).toBe("+33699887766");
  });

  it("sends an empty phone when the user clears it, so the API clears it", async () => {
    render(<AddWorkerDialog {...BASE_PROPS} editWorker={EDIT_WORKER} />);
    fireEvent.change(document.querySelector("#phone") as HTMLInputElement, { target: { value: "" } });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(BASE_PROPS.onSave).toHaveBeenCalled());
    expect(BASE_PROPS.onSave.mock.calls[0][0]).toMatchObject({ phone: "" });
  });
});

describe("AddWorkerDialog — daily rate cap", () => {
  it("refuses a rate above the API's cap without saving", async () => {
    const onSave = vi.fn();
    render(<AddWorkerDialog open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.click(document.querySelector('[data-testid="person-typeahead"]') as HTMLElement);
    fireEvent.change(document.querySelector("#dailyRate") as HTMLInputElement, {
      target: { value: "100000000" },
    });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(document.body.textContent).toContain("errors.amountTooLarge"));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("AddWorkerDialog — person already on the project", () => {
  async function submitWith(error: unknown) {
    const onSave = vi.fn().mockRejectedValue(error);
    render(<AddWorkerDialog open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.click(document.querySelector('[data-testid="person-typeahead"]') as HTMLElement);
    fireEvent.change(document.querySelector("#dailyRate") as HTMLInputElement, { target: { value: "100" } });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  }

  it("says the person is already a worker here on a 409", async () => {
    await submitWith(new ApiError("HTTP 409", 409, { error: "WorkerAlreadyOnProject", is_active: true }));
    await waitFor(() => expect(document.body.textContent).toContain("errors.workerAlreadyOnProject"));
    expect(document.body.textContent).not.toContain("errors.saveWorkerFailed");
  });

  it("points to Reactivate when the existing worker is deactivated", async () => {
    await submitWith(new ApiError("HTTP 409", 409, { error: "WorkerAlreadyOnProject", is_active: false }));
    await waitFor(() => expect(document.body.textContent).toContain("errors.workerAlreadyOnProjectInactive"));
  });

  it("keeps the generic message for other failures", async () => {
    await submitWith(new ApiError("HTTP 500", 500));
    await waitFor(() => expect(document.body.textContent).toContain("errors.saveWorkerFailed"));
  });
});

describe("AddWorkerDialog — phone the API refuses", () => {
  it("shows the invalid-phone message under the phone field and keeps the dialog open", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new ApiError("HTTP 400", 400, { error: "InvalidPhone", message: "Invalid phone number" }));
    const onOpenChange = vi.fn();
    render(<AddWorkerDialog open onOpenChange={onOpenChange} onSave={onSave} editWorker={EDIT_WORKER} />);
    const input = document.querySelector("#phone") as HTMLInputElement;
    expect(input.type).toBe("tel");
    fireEvent.change(input, { target: { value: "hello world" } });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(document.querySelector("#phone-error")?.textContent).toBe("errors.invalidPhone"));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("phone-error");
    expect(document.body.textContent).not.toContain("errors.saveWorkerFailed");
    expect(onOpenChange).not.toHaveBeenCalled();

    // Typing again clears the message.
    fireEvent.change(input, { target: { value: "06 12 34 56 78" } });
    expect(document.querySelector("#phone-error")).toBeNull();
  });

  it("keeps the generic message for another 400", async () => {
    const onSave = vi.fn().mockRejectedValue(new ApiError("HTTP 400", 400, { error: "ValidationError" }));
    render(<AddWorkerDialog open onOpenChange={vi.fn()} onSave={onSave} editWorker={EDIT_WORKER} />);
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(document.body.textContent).toContain("errors.saveWorkerFailed"));
    expect(document.querySelector("#phone-error")).toBeNull();
  });
});
