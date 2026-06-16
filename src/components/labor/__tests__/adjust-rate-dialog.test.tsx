/**
 * Tests for AdjustRateDialog component
 *
 * Covers: renders current base rate; lists fetched rate changes; submit calls
 * createWorkerRateChange with ISO date + numeric rate; delete calls
 * deleteWorkerRateChange; client-side rejection of amount <= 0.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { AdjustRateDialog } from "../adjust-rate-dialog";
import type { Worker, WorkerRateChange } from "@/types/labor";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key,
      );
    }
    return key;
  },
}));

vi.mock("@/lib/api/labor", () => ({
  fetchWorkerRateChanges: vi.fn(),
  createWorkerRateChange: vi.fn(),
  deleteWorkerRateChange: vi.fn(),
  formatEUR: (amount: number) => `€${amount.toFixed(2)}`,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules after vi.mock declarations
import {
  fetchWorkerRateChanges,
  createWorkerRateChange,
  deleteWorkerRateChange,
} from "@/lib/api/labor";
import { toast } from "sonner";

// Cast through `unknown` to access mocked toast without TS type errors.
// The runtime object is a vi.fn() stub; the narrow shape used in assertions
// is all the tests call.
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WORKER: Worker = {
  id: "worker-uuid-1",
  project_id: "proj-uuid-1",
  name: "Alice Dupont",
  phone: "+33612345678",
  daily_rate: 120,
  current_daily_rate: 150,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const RATE_CHANGE_1: WorkerRateChange = {
  id: "rc-uuid-1",
  worker_id: "worker-uuid-1",
  effective_date: "2026-07-01",
  daily_rate: 150,
  created_at: "2026-06-15T10:00:00Z",
};

const RATE_CHANGE_2: WorkerRateChange = {
  id: "rc-uuid-2",
  worker_id: "worker-uuid-1",
  effective_date: "2026-08-01",
  daily_rate: 180,
  created_at: "2026-06-15T10:05:00Z",
};

interface DialogProps {
  projectId: string;
  worker: Worker | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}

const DEFAULT_PROPS: DialogProps = {
  projectId: "proj-uuid-1",
  worker: WORKER,
  open: true,
  onOpenChange: vi.fn(),
};

function renderDialog(props: Partial<DialogProps> = {}) {
  return render(<AdjustRateDialog {...DEFAULT_PROPS} {...props} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdjustRateDialog — render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWorkerRateChanges).mockResolvedValue([]);
  });

  it("renders dialog title", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("rateChange.title")).toBeDefined();
    });
  });

  it("renders current_daily_rate when set (not base daily_rate)", async () => {
    renderDialog();
    await waitFor(() => {
      // WORKER has current_daily_rate=150, daily_rate=120; dialog must show €150.00
      expect(screen.getByText("€150.00")).toBeDefined();
    });
  });

  it("falls back to daily_rate when current_daily_rate is absent", async () => {
    const workerNoCurrentRate: Worker = { ...WORKER, current_daily_rate: undefined };
    renderDialog({ worker: workerNoCurrentRate });
    await waitFor(() => {
      expect(screen.getByText("€120.00")).toBeDefined();
    });
  });

  it("renders amount and date inputs", async () => {
    renderDialog();
    await waitFor(() => {
      expect(document.querySelector("[data-testid='adjust-rate-amount']")).toBeTruthy();
      expect(document.querySelector("[data-testid='adjust-rate-date']")).toBeTruthy();
    });
  });

  it("shows noChanges message when history is empty", async () => {
    // Initial render: rateChanges=[] and no loading spinner (initial load is
    // silent — no spinner). The noChanges text is immediately in the DOM.
    renderDialog();
    expect(screen.getByText("rateChange.noChanges")).toBeDefined();
    // Also verify the fetch was invoked (it resolves to [] in this describe block)
    await waitFor(() => {
      expect(fetchWorkerRateChanges).toHaveBeenCalledWith("proj-uuid-1", "worker-uuid-1");
    });
  });

  it("does not render when worker is null", () => {
    const { container } = renderDialog({ worker: null, open: false });
    // Dialog should not render content
    expect(container.querySelector("[data-testid='adjust-rate-form']")).toBeNull();
  });
});

describe("AdjustRateDialog — history list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWorkerRateChanges).mockResolvedValue([RATE_CHANGE_2, RATE_CHANGE_1]);
  });

  it("lists fetched rate changes", async () => {
    renderDialog();
    await waitFor(() => {
      // €150.00 appears twice: once as the worker's current_daily_rate header,
      // once as RATE_CHANGE_1's daily_rate in the history list.
      expect(screen.getAllByText("€150.00").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("€180.00")).toBeDefined();
    });
  });

  it("renders a delete button per rate change row", async () => {
    renderDialog();
    await waitFor(() => {
      const history = document.querySelector("[data-testid='adjust-rate-history']");
      expect(history).toBeTruthy();
      const deleteButtons = within(history as HTMLElement).getAllByRole("button");
      // Two rate changes → two delete buttons
      expect(deleteButtons.length).toBe(2);
    });
  });

  it("calls fetchWorkerRateChanges with correct projectId and workerId", async () => {
    renderDialog();
    await waitFor(() => {
      expect(fetchWorkerRateChanges).toHaveBeenCalledWith("proj-uuid-1", "worker-uuid-1");
    });
  });
});

describe("AdjustRateDialog — submit form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWorkerRateChanges).mockResolvedValue([]);
    vi.mocked(createWorkerRateChange).mockResolvedValue({
      ...RATE_CHANGE_1,
      effective_date: "2026-09-01",
      daily_rate: 160,
    });
  });

  it("calls createWorkerRateChange with ISO date and numeric rate", async () => {
    renderDialog();

    // Wait for form to be ready
    await waitFor(() => {
      expect(document.querySelector("[data-testid='adjust-rate-amount']")).toBeTruthy();
    });

    const amountInput = document.querySelector(
      "[data-testid='adjust-rate-amount']",
    ) as HTMLInputElement;
    const dateInput = document.querySelector(
      "[data-testid='adjust-rate-date']",
    ) as HTMLInputElement;

    fireEvent.change(amountInput, { target: { value: "160" } });
    fireEvent.change(dateInput, { target: { value: "2026-09-01" } });

    const form = document.querySelector("[data-testid='adjust-rate-form']") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createWorkerRateChange).toHaveBeenCalledWith(
        "proj-uuid-1",
        "worker-uuid-1",
        { effective_date: "2026-09-01", daily_rate: 160 },
      );
    });
  });

  it("shows success toast after creating a rate change", async () => {
    renderDialog();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='adjust-rate-amount']")).toBeTruthy();
    });

    const amountInput = document.querySelector(
      "[data-testid='adjust-rate-amount']",
    ) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "155" } });

    const form = document.querySelector("[data-testid='adjust-rate-form']") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("rateChange.addedToast");
    });
  });

  it("re-fetches list after creating", async () => {
    renderDialog();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='adjust-rate-amount']")).toBeTruthy();
    });

    const amountInput = document.querySelector(
      "[data-testid='adjust-rate-amount']",
    ) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "155" } });

    const form = document.querySelector("[data-testid='adjust-rate-form']") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      // Initial load call + re-fetch after create = 2 calls
      expect(fetchWorkerRateChanges).toHaveBeenCalledTimes(2);
    });
  });

  it("calls onChanged after successful create", async () => {
    const onChanged = vi.fn();
    renderDialog({ onChanged });

    await waitFor(() => {
      expect(document.querySelector("[data-testid='adjust-rate-amount']")).toBeTruthy();
    });

    const amountInput = document.querySelector(
      "[data-testid='adjust-rate-amount']",
    ) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "165" } });

    const form = document.querySelector("[data-testid='adjust-rate-form']") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });
});

describe("AdjustRateDialog — validation (amount <= 0)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWorkerRateChanges).mockResolvedValue([]);
  });

  it("does not call createWorkerRateChange when amount is 0", async () => {
    renderDialog();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='adjust-rate-amount']")).toBeTruthy();
    });

    const amountInput = document.querySelector(
      "[data-testid='adjust-rate-amount']",
    ) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "0" } });

    const form = document.querySelector("[data-testid='adjust-rate-form']") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      // Error shown, API not called
      expect(screen.getByRole("alert")).toBeDefined();
    });
    expect(createWorkerRateChange).not.toHaveBeenCalled();
  });

  it("does not call createWorkerRateChange when amount is negative", async () => {
    renderDialog();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='adjust-rate-amount']")).toBeTruthy();
    });

    const amountInput = document.querySelector(
      "[data-testid='adjust-rate-amount']",
    ) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "-10" } });

    const form = document.querySelector("[data-testid='adjust-rate-form']") as HTMLFormElement;
    fireEvent.submit(form);

    expect(createWorkerRateChange).not.toHaveBeenCalled();
  });

  it("does not call createWorkerRateChange when amount field is empty", async () => {
    renderDialog();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='adjust-rate-form']")).toBeTruthy();
    });

    // Submit without filling amount
    const form = document.querySelector("[data-testid='adjust-rate-form']") as HTMLFormElement;
    fireEvent.submit(form);

    expect(createWorkerRateChange).not.toHaveBeenCalled();
  });
});

describe("AdjustRateDialog — delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWorkerRateChanges).mockResolvedValue([RATE_CHANGE_1]);
    vi.mocked(deleteWorkerRateChange).mockResolvedValue(undefined);
  });

  it("calls deleteWorkerRateChange with correct ids", async () => {
    renderDialog();

    await waitFor(() => {
      expect(
        document.querySelector("[data-testid='delete-rate-change-rc-uuid-1']"),
      ).toBeTruthy();
    });

    const deleteBtn = document.querySelector(
      "[data-testid='delete-rate-change-rc-uuid-1']",
    ) as HTMLButtonElement;
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteWorkerRateChange).toHaveBeenCalledWith(
        "proj-uuid-1",
        "worker-uuid-1",
        "rc-uuid-1",
      );
    });
  });

  it("shows success toast after deleting", async () => {
    renderDialog();

    await waitFor(() => {
      expect(
        document.querySelector("[data-testid='delete-rate-change-rc-uuid-1']"),
      ).toBeTruthy();
    });

    fireEvent.click(
      document.querySelector("[data-testid='delete-rate-change-rc-uuid-1']") as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("rateChange.deletedToast");
    });
  });

  it("re-fetches list after deleting", async () => {
    renderDialog();

    await waitFor(() => {
      expect(
        document.querySelector("[data-testid='delete-rate-change-rc-uuid-1']"),
      ).toBeTruthy();
    });

    fireEvent.click(
      document.querySelector("[data-testid='delete-rate-change-rc-uuid-1']") as HTMLButtonElement,
    );

    await waitFor(() => {
      // Initial load + re-fetch after delete = 2 calls
      expect(fetchWorkerRateChanges).toHaveBeenCalledTimes(2);
    });
  });

  it("calls onChanged after successful delete", async () => {
    const onChanged = vi.fn();
    renderDialog({ onChanged });

    await waitFor(() => {
      expect(
        document.querySelector("[data-testid='delete-rate-change-rc-uuid-1']"),
      ).toBeTruthy();
    });

    fireEvent.click(
      document.querySelector("[data-testid='delete-rate-change-rc-uuid-1']") as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });
});
