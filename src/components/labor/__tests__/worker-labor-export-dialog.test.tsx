/**
 * Tests for WorkerLaborExportDialog component — phase 05
 *
 * Covers: closed-when-null, title with worker name, subtitle with rate,
 * submit disabled states, range errors, happy-path submit, failure path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkerLaborExportDialog } from "../worker-labor-export-dialog";
import type { Worker } from "@/types/labor";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      // Simple interpolation for test assertions (e.g. "Export labor for {name}")
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key
      );
    }
    return key;
  },
}));

vi.mock("@/lib/api/labor", () => ({
  fetchWorkerLaborExport: vi.fn(),
  formatEUR: (amount: number) => `€${amount.toFixed(2)}`,
}));

vi.mock("@/lib/util/trigger-browser-download", () => ({
  triggerBrowserDownload: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn().mockReturnValue("toast-id-worker"),
    info: vi.fn(),
    warning: vi.fn(),
  } as unknown as { success: typeof vi.fn; info: typeof vi.fn; warning: typeof vi.fn; error: typeof vi.fn },
}));

// Import after mocking
import { fetchWorkerLaborExport } from "@/lib/api/labor";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import { toast } from "sonner";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_WORKER: Worker = {
  id: "worker-uuid-1",
  project_id: "proj-uuid-1",
  name: "Alice Dupont",
  phone: "+33612345678",
  daily_rate: 180,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

interface DialogTestProps {
  projectId: string;
  worker: Worker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_PROPS: DialogTestProps = {
  projectId: "proj-uuid-1",
  worker: ACTIVE_WORKER,
  open: true,
  onOpenChange: vi.fn(),
};

function renderDialog(overrides: Partial<DialogTestProps> = {}) {
  return render(<WorkerLaborExportDialog {...DEFAULT_PROPS} {...overrides} />);
}

// ── Render tests ──────────────────────────────────────────────────────────────

describe("WorkerLaborExportDialog — render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when worker is null and open is false", () => {
    const { container } = renderDialog({ worker: null, open: false });
    // Component returns null when !worker && !open
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog title including worker name", () => {
    renderDialog();
    // useTranslations mock returns "workerDialogTitle" with {name} interpolated
    expect(screen.getByText("workerDialogTitle")).toBeDefined();
  });

  it("renders subtitle containing formatted daily rate", () => {
    renderDialog();
    // formatEUR(180) → €180.00; subtitle key interpolated
    expect(screen.getByText(/workerSubtitle/)).toBeDefined();
  });

  it("renders from/to month inputs", () => {
    renderDialog();
    expect(document.getElementById("worker-export-from")).toBeTruthy();
    expect(document.getElementById("worker-export-to")).toBeTruthy();
  });

  it("renders xlsx and pdf format toggle buttons", () => {
    renderDialog();
    expect(screen.getByText("xlsx")).toBeDefined();
    expect(screen.getByText("pdf")).toBeDefined();
  });

  it("renders cancel and download buttons", () => {
    renderDialog();
    expect(screen.getByText("cancel")).toBeDefined();
    expect(screen.getByText("download")).toBeDefined();
  });
});

// ── Submit disabled states ────────────────────────────────────────────────────

describe("WorkerLaborExportDialog — submit disabled states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("download button is disabled when from and to are both empty", () => {
    renderDialog();
    const btn = screen.getByText("download").closest("button");
    expect(btn).toBeDisabled();
  });

  it("download button is disabled when only from is set (to is empty)", () => {
    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-03" },
    });
    const btn = screen.getByText("download").closest("button");
    expect(btn).toBeDisabled();
  });

  it("download button is disabled when only to is set (from is empty)", () => {
    renderDialog();
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-03" },
    });
    const btn = screen.getByText("download").closest("button");
    expect(btn).toBeDisabled();
  });

  it("download button is enabled for valid range (same month)", () => {
    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-04" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-04" },
    });
    const btn = screen.getByText("download").closest("button");
    expect(btn).not.toBeDisabled();
  });

  it("download button is enabled at boundary (24 months span)", () => {
    renderDialog();
    // 2024-03 to 2026-02 = 24 months exactly
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2024-03" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-02" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    const btn = screen.getByText("download").closest("button");
    expect(btn).not.toBeDisabled();
  });
});

// ── Range errors ──────────────────────────────────────────────────────────────

describe("WorkerLaborExportDialog — range error messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows errorRangeInvalid and disables download when from > to", () => {
    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-06" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-03" },
    });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("errorRangeInvalid")).toBeDefined();
    expect(screen.getByText("download").closest("button")).toBeDisabled();
  });

  it("shows errorRangeTooLarge and disables download when span > 24 months", () => {
    renderDialog();
    // 2024-01 to 2026-02 = 25 months
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2024-01" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-02" },
    });

    expect(screen.getByText("errorRangeTooLarge")).toBeDefined();
    expect(screen.getByText("download").closest("button")).toBeDisabled();
  });

  it("no range error when range is valid", () => {
    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-06" },
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// ── Submit happy path ─────────────────────────────────────────────────────────

describe("WorkerLaborExportDialog — submit happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls fetchWorkerLaborExport with correct args on submit", async () => {
    const fakeBlob = new Blob(["xlsx-bytes"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    vi.mocked(fetchWorkerLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "worker-alice-2026-01-to-2026-03.xlsx",
    });

    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(fetchWorkerLaborExport).toHaveBeenCalledWith(
          "proj-uuid-1",
          "worker-uuid-1",
          { from: "2026-01", to: "2026-03" },
          "xlsx"
        );
      },
      { timeout: 15000 }
    );
  });

  it("calls triggerBrowserDownload with blob and filename on success", async () => {
    const fakeBlob = new Blob(["bytes"]);
    vi.mocked(fetchWorkerLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "worker-alice.xlsx",
    });

    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-02" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-02" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(triggerBrowserDownload).toHaveBeenCalledWith(fakeBlob, "worker-alice.xlsx");
      },
      { timeout: 15000 }
    );
  });

  it("shows workerToastSuccess toast on success", async () => {
    const fakeBlob = new Blob(["bytes"]);
    vi.mocked(fetchWorkerLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "report.xlsx",
    });

    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-01" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(toast.success).toHaveBeenCalledWith(
          "workerToastSuccess",
          expect.objectContaining({ id: "toast-id-worker" })
        );
      },
      { timeout: 15000 }
    );
  });

  it("calls onOpenChange(false) after successful download", async () => {
    const onOpenChange = vi.fn();
    const fakeBlob = new Blob(["bytes"]);
    vi.mocked(fetchWorkerLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "report.xlsx",
    });

    render(
      <WorkerLaborExportDialog
        projectId="proj-uuid-1"
        worker={ACTIVE_WORKER}
        open={true}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-04" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-04" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      },
      { timeout: 15000 }
    );
  });
});

// ── Submit failure path ───────────────────────────────────────────────────────

describe("WorkerLaborExportDialog — submit failure path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error toast when fetchWorkerLaborExport rejects with Error instance", async () => {
    vi.mocked(fetchWorkerLaborExport).mockRejectedValue(
      new Error("Server error: 500")
    );

    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalledWith(
          "Server error: 500",
          expect.objectContaining({ id: "toast-id-worker" })
        );
      },
      { timeout: 15000 }
    );
  }, 20000);

  it("shows workerToastError i18n key when rejection is not an Error instance", async () => {
    vi.mocked(fetchWorkerLaborExport).mockRejectedValue("raw string error");

    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalledWith(
          "workerToastError",
          expect.objectContaining({ id: "toast-id-worker" })
        );
      },
      { timeout: 15000 }
    );
  }, 20000);

  it("dialog does not call onOpenChange(false) after failure", async () => {
    const onOpenChange = vi.fn();
    vi.mocked(fetchWorkerLaborExport).mockRejectedValue(new Error("network error"));

    render(
      <WorkerLaborExportDialog
        projectId="proj-uuid-1"
        worker={ACTIVE_WORKER}
        open={true}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-02" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-02" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalled();
      },
      { timeout: 15000 }
    );
    // onOpenChange should NOT have been called with false (dialog stays open)
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  }, 20000);

  it("triggerBrowserDownload is not called after failure", async () => {
    vi.mocked(fetchWorkerLaborExport).mockRejectedValue(new Error("timeout"));

    renderDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-01" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalled();
      },
      { timeout: 15000 }
    );
    expect(triggerBrowserDownload).not.toHaveBeenCalled();
  }, 20000);
});
