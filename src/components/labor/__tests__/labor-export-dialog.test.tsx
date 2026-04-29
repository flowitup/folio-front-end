/**
 * Tests for LaborExportDialog component — phase 08 + round-2 H-4 DRY refactor
 *
 * Covers: trigger render, range validation UI, format toggle, submit happy path
 * with Blob + anchor-click mock, error toast on rejection, cancel closes dialog.
 * Also covers worker-prop mode (per-worker export) after H-4 unification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LaborExportDialog } from "../labor-export-dialog";
import type { Worker } from "@/types/labor";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
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
  fetchLaborExport: vi.fn(),
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
    loading: vi.fn().mockReturnValue("toast-id-1"),
  },
}));

// Import after mocking
import { fetchLaborExport, fetchWorkerLaborExport } from "@/lib/api/labor";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  projectId: "proj-test-1",
  open: true,
  onOpenChange: vi.fn(),
};

function renderDialog(props: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<LaborExportDialog {...DEFAULT_PROPS} {...props} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LaborExportDialog — render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog title when open=true", () => {
    renderDialog();
    // useTranslations mock returns key as-is, so "labor.export" -> key "dialogTitle"
    expect(screen.getByText("dialogTitle")).toBeDefined();
  });

  it("renders from/to month inputs", () => {
    renderDialog();
    const fromInput = document.getElementById("export-from");
    const toInput = document.getElementById("export-to");
    expect(fromInput).toBeTruthy();
    expect(toInput).toBeTruthy();
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

describe("LaborExportDialog — range validation UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("download button is disabled when from and to are empty", () => {
    renderDialog();
    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).toBeDisabled();
  });

  it("shows errorRangeInvalid and disables download when from > to", () => {
    renderDialog();

    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2026-06" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-03" },
    });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("errorRangeInvalid")).toBeDefined();

    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).toBeDisabled();
  });

  it("shows errorRangeTooLarge and disables download when span > 24 months", () => {
    renderDialog();

    // 2024-01 to 2026-02 = 25 months
    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2024-01" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-02" },
    });

    expect(screen.getByText("errorRangeTooLarge")).toBeDefined();

    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).toBeDisabled();
  });

  it("enables download button for a valid range (same month)", () => {
    renderDialog();

    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2026-04" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-04" },
    });

    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).not.toBeDisabled();
  });

  it("enables download button for a valid range at boundary (24 months)", () => {
    renderDialog();

    // 2024-03 to 2026-02 = 24 months exactly
    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2024-03" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-02" },
    });

    expect(screen.queryByRole("alert")).toBeNull();

    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).not.toBeDisabled();
  });
});

describe("LaborExportDialog — format toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("xlsx button has data-slot=button and pdf button is variant outline initially", () => {
    renderDialog();
    // The component renders format buttons with variant="default" for selected
    // and variant="outline" for unselected. shadcn Button renders variant="outline"
    // with a specific bg class (bg-background) while variant="default" has bg-primary.
    const xlsxBtn = screen.getByText("xlsx").closest("button");
    const pdfBtn = screen.getByText("pdf").closest("button");
    // xlsx is selected (default variant) → has bg-primary
    expect(xlsxBtn?.className).toContain("bg-primary");
    // pdf is unselected (outline variant) → has bg-background
    expect(pdfBtn?.className).toContain("bg-background");
  });

  it("clicking pdf button switches active selection", () => {
    renderDialog();

    const pdfBtn = screen.getByText("pdf").closest("button");
    fireEvent.click(pdfBtn!);

    // After clicking pdf, it becomes selected (bg-primary)
    expect(pdfBtn?.className).toContain("bg-primary");

    // xlsx should now be outline (bg-background)
    const xlsxBtn = screen.getByText("xlsx").closest("button");
    expect(xlsxBtn?.className).toContain("bg-background");
  });
});

describe("LaborExportDialog — submit happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls fetchLaborExport with correct args and triggers download on success", async () => {
    const fakeBlob = new Blob(["fake-xlsx"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    vi.mocked(fetchLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "labor-proj-test-1-2026-01-to-2026-03.xlsx",
    });

    renderDialog();

    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-03" },
    });

    const downloadBtn = screen.getByText("download").closest("button");
    fireEvent.click(downloadBtn!);

    await waitFor(
      () => {
        expect(fetchLaborExport).toHaveBeenCalledWith(
          "proj-test-1",
          { from: "2026-01", to: "2026-03" },
          "xlsx"
        );
      },
      { timeout: 15000 }
    );

    // triggerBrowserDownload called with blob + filename
    expect(triggerBrowserDownload).toHaveBeenCalledWith(
      fakeBlob,
      "labor-proj-test-1-2026-01-to-2026-03.xlsx",
    );

    // toast.success called
    expect(toast.success).toHaveBeenCalledWith("downloaded", {
      id: "toast-id-1",
    });
  });

  it("dialog calls onOpenChange(false) after successful download", async () => {
    const onOpenChange = vi.fn();
    const fakeBlob = new Blob(["bytes"]);

    vi.mocked(fetchLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "labor-test.xlsx",
    });

    render(
      <LaborExportDialog
        projectId="proj-test-1"
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2026-02" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-02" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      },
      { timeout: 15000 }
    );
  });

  it("triggerBrowserDownload is called with the response blob and filename", async () => {
    const fakeBlob = new Blob(["bytes"]);

    vi.mocked(fetchLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "labor-test.xlsx",
    });

    renderDialog();

    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2026-03" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(triggerBrowserDownload).toHaveBeenCalledWith(fakeBlob, "labor-test.xlsx");
      },
      { timeout: 15000 }
    );
  }, 20000);
});

describe("LaborExportDialog — error path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls toast.error with error message when fetchLaborExport rejects", async () => {
    vi.mocked(fetchLaborExport).mockRejectedValue(
      new Error("Server error: 500")
    );

    renderDialog();

    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalledWith(
          "Server error: 500",
          expect.objectContaining({ id: "toast-id-1" })
        );
      },
      { timeout: 15000 }
    );
  }, 20000);

  it("uses errorGeneric i18n key when rejection error is not an Error instance", async () => {
    vi.mocked(fetchLaborExport).mockRejectedValue("raw string error");

    renderDialog();

    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalledWith(
          "errorGeneric",
          expect.objectContaining({ id: "toast-id-1" })
        );
      },
      { timeout: 15000 }
    );
  }, 20000);

  it("does not call fetchLaborExport when submit is disabled", () => {
    renderDialog();

    // No from/to set — button is disabled
    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).toBeDisabled();

    fireEvent.click(downloadBtn!);
    expect(fetchLaborExport).not.toHaveBeenCalled();
  });
});

describe("LaborExportDialog — cancel behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onOpenChange(false) when cancel button clicked", () => {
    const onOpenChange = vi.fn();

    render(
      <LaborExportDialog
        projectId="proj-test-1"
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByText("cancel").closest("button")!);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not call fetchLaborExport when cancel is clicked", () => {
    renderDialog();

    fireEvent.change(document.getElementById("export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("cancel").closest("button")!);

    expect(fetchLaborExport).not.toHaveBeenCalled();
  });
});

// ── Worker prop (per-worker export mode) — H-4 DRY unification ───────────────

const ACTIVE_WORKER: Worker = {
  id: "worker-uuid-1",
  project_id: "proj-uuid-1",
  name: "Alice Dupont",
  phone: "+33612345678",
  daily_rate: 180,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

function renderWorkerDialog(workerOverride: Worker | null = ACTIVE_WORKER) {
  return render(
    <LaborExportDialog
      projectId="proj-uuid-1"
      open={!!workerOverride}
      onOpenChange={vi.fn()}
      worker={workerOverride}
    />,
  );
}

describe("LaborExportDialog — with worker prop (render)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when worker is null and open is false", () => {
    const { container } = render(
      <LaborExportDialog
        projectId="proj-1"
        open={false}
        onOpenChange={vi.fn()}
        worker={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders worker dialog title with worker name", () => {
    renderWorkerDialog();
    expect(screen.getByText("workerDialogTitle")).toBeDefined();
  });

  it("renders subtitle containing formatted daily rate", () => {
    renderWorkerDialog();
    expect(screen.getByText(/workerSubtitle/)).toBeDefined();
  });

  it("renders from/to inputs with worker-prefixed IDs", () => {
    renderWorkerDialog();
    expect(document.getElementById("worker-export-from")).toBeTruthy();
    expect(document.getElementById("worker-export-to")).toBeTruthy();
  });

  it("renders xlsx and pdf format toggle buttons", () => {
    renderWorkerDialog();
    expect(screen.getByText("xlsx")).toBeDefined();
    expect(screen.getByText("pdf")).toBeDefined();
  });

  it("download button is disabled when from/to are empty", () => {
    renderWorkerDialog();
    expect(screen.getByText("download").closest("button")).toBeDisabled();
  });
});

describe("LaborExportDialog — with worker prop (range validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows errorRangeInvalid when from > to", () => {
    renderWorkerDialog();
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

  it("shows errorRangeTooLarge when span > 24 months", () => {
    renderWorkerDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2024-01" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-02" },
    });
    expect(screen.getByText("errorRangeTooLarge")).toBeDefined();
    expect(screen.getByText("download").closest("button")).toBeDisabled();
  });

  it("enables download for valid range (same month)", () => {
    renderWorkerDialog();
    fireEvent.change(document.getElementById("worker-export-from")!, {
      target: { value: "2026-04" },
    });
    fireEvent.change(document.getElementById("worker-export-to")!, {
      target: { value: "2026-04" },
    });
    expect(screen.getByText("download").closest("button")).not.toBeDisabled();
  });
});

describe("LaborExportDialog — with worker prop (submit happy path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls fetchWorkerLaborExport with correct args on submit", async () => {
    const fakeBlob = new Blob(["xlsx-bytes"]);
    vi.mocked(fetchWorkerLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "worker-alice-2026-01-to-2026-03.xlsx",
    });

    renderWorkerDialog();
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
          "xlsx",
        );
      },
      { timeout: 15000 },
    );
  });

  it("calls triggerBrowserDownload with blob and filename on success", async () => {
    const fakeBlob = new Blob(["bytes"]);
    vi.mocked(fetchWorkerLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "worker-alice.xlsx",
    });

    renderWorkerDialog();
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
      { timeout: 15000 },
    );
  });

  it("shows workerToastSuccess toast on success", async () => {
    const fakeBlob = new Blob(["bytes"]);
    vi.mocked(fetchWorkerLaborExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "report.xlsx",
    });

    renderWorkerDialog();
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
          expect.objectContaining({ id: "toast-id-1" }),
        );
      },
      { timeout: 15000 },
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
      <LaborExportDialog
        projectId="proj-uuid-1"
        worker={ACTIVE_WORKER}
        open={true}
        onOpenChange={onOpenChange}
      />,
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
      { timeout: 15000 },
    );
  });
});

describe("LaborExportDialog — with worker prop (failure path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error toast with Error message when fetchWorkerLaborExport rejects", async () => {
    vi.mocked(fetchWorkerLaborExport).mockRejectedValue(new Error("Server error: 500"));

    renderWorkerDialog();
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
          expect.objectContaining({ id: "toast-id-1" }),
        );
      },
      { timeout: 15000 },
    );
  }, 20000);

  it("shows workerToastError i18n key when rejection is not an Error instance", async () => {
    vi.mocked(fetchWorkerLaborExport).mockRejectedValue("raw string error");

    renderWorkerDialog();
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
          expect.objectContaining({ id: "toast-id-1" }),
        );
      },
      { timeout: 15000 },
    );
  }, 20000);

  it("does not call onOpenChange(false) after failure", async () => {
    const onOpenChange = vi.fn();
    vi.mocked(fetchWorkerLaborExport).mockRejectedValue(new Error("network error"));

    render(
      <LaborExportDialog
        projectId="proj-uuid-1"
        worker={ACTIVE_WORKER}
        open={true}
        onOpenChange={onOpenChange}
      />,
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
      { timeout: 15000 },
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  }, 20000);

  it("triggerBrowserDownload is not called after failure", async () => {
    vi.mocked(fetchWorkerLaborExport).mockRejectedValue(new Error("timeout"));

    renderWorkerDialog();
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
      { timeout: 15000 },
    );
    expect(triggerBrowserDownload).not.toHaveBeenCalled();
  }, 20000);
});
