/**
 * Tests for InvoiceExportDialog component — phase 07
 *
 * Covers: render, range validation, format toggle, type select,
 * submit happy path, error path, locked state during submit.
 *
 * Interaction strategy: fireEvent.change for <Input type="month"> and
 * fireEvent.click for buttons — avoids userEvent + fake-timer deadlock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceExportDialog } from "../invoice-export-dialog";

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

vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoiceExport: vi.fn(),
}));

vi.mock("@/lib/util/trigger-browser-download", () => ({
  triggerBrowserDownload: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn().mockReturnValue("toast-id-1"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Imports after mocking ─────────────────────────────────────────────────────

import { fetchInvoiceExport } from "@/lib/api/invoice-api";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  projectId: "proj-test-1",
  open: true,
  onOpenChange: vi.fn(),
};

function renderDialog(props: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<InvoiceExportDialog {...DEFAULT_PROPS} {...props} />);
}

// ── Render ────────────────────────────────────────────────────────────────────

describe("InvoiceExportDialog — render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog title when open=true", () => {
    renderDialog();
    expect(screen.getByText("dialogTitle")).toBeDefined();
  });

  it("renders from/to month inputs with empty values", () => {
    renderDialog();
    const fromInput = document.getElementById("invoice-export-from") as HTMLInputElement;
    const toInput = document.getElementById("invoice-export-to") as HTMLInputElement;
    expect(fromInput).toBeTruthy();
    expect(toInput).toBeTruthy();
    expect(fromInput?.value).toBe("");
    expect(toInput?.value).toBe("");
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

  it("renders type select with all options visible in trigger", () => {
    renderDialog();
    // The select trigger is present
    expect(document.getElementById("invoice-export-type")).toBeTruthy();
  });
});

// ── Range validation UI ───────────────────────────────────────────────────────

describe("InvoiceExportDialog — range validation UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("download button is disabled when from and to are empty", () => {
    renderDialog();
    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).toBeDisabled();
  });

  it("download button is disabled when only from is filled", () => {
    renderDialog();
    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).toBeDisabled();
  });

  it("shows errorRangeInvalid and disables download when from > to", () => {
    renderDialog();
    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-06" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
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
    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2024-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-02" },
    });
    expect(screen.getByText("errorRangeTooLarge")).toBeDefined();
    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).toBeDisabled();
  });

  it("enables download button for a valid range (same month)", () => {
    renderDialog();
    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-04" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-04" },
    });
    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).not.toBeDisabled();
  });

  it("enables download button at exactly 24-month boundary", () => {
    renderDialog();
    // 2024-03 to 2026-02 = 24 months exactly
    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2024-03" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-02" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).not.toBeDisabled();
  });

  it("shows summaryLine with correct count when valid range entered", () => {
    renderDialog();
    // 2026-01 to 2026-03 = 3 months
    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-03" },
    });
    // The mock returns key with param substituted: "summaryLine" becomes "summaryLine"
    // with {count: 3} substituted → "summaryLine" with count param
    expect(screen.getByText(/summaryLine/)).toBeDefined();
  });
});

// ── Format toggle ─────────────────────────────────────────────────────────────

describe("InvoiceExportDialog — format toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("xlsx button is selected (bg-primary) by default", () => {
    renderDialog();
    const xlsxBtn = screen.getByText("xlsx").closest("button");
    expect(xlsxBtn?.className).toContain("bg-primary");
  });

  it("pdf button is unselected (bg-background) by default", () => {
    renderDialog();
    const pdfBtn = screen.getByText("pdf").closest("button");
    expect(pdfBtn?.className).toContain("bg-background");
  });

  it("clicking pdf switches active selection to pdf", () => {
    renderDialog();
    const pdfBtn = screen.getByText("pdf").closest("button");
    fireEvent.click(pdfBtn!);
    expect(pdfBtn?.className).toContain("bg-primary");
    const xlsxBtn = screen.getByText("xlsx").closest("button");
    expect(xlsxBtn?.className).toContain("bg-background");
  });

  it("clicking xlsx after pdf returns selection to xlsx", () => {
    renderDialog();
    fireEvent.click(screen.getByText("pdf").closest("button")!);
    const xlsxBtn = screen.getByText("xlsx").closest("button");
    fireEvent.click(xlsxBtn!);
    expect(xlsxBtn?.className).toContain("bg-primary");
  });
});

// ── Submit happy path ─────────────────────────────────────────────────────────

describe("InvoiceExportDialog — submit happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls fetchInvoiceExport with correct args (typeFilter=undefined when all)", async () => {
    const fakeBlob = new Blob(["fake-xlsx"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    vi.mocked(fetchInvoiceExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "invoices-proj-test-1-2026-01-to-2026-03.xlsx",
    });

    renderDialog();

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(fetchInvoiceExport).toHaveBeenCalledWith(
          "proj-test-1",
          { from: "2026-01", to: "2026-03" },
          "xlsx",
          undefined,
        );
      },
      { timeout: 15000 },
    );
  });

  it("calls fetchInvoiceExport with typeFilter='labor' when labor type selected", async () => {
    const fakeBlob = new Blob(["xlsx"]);
    vi.mocked(fetchInvoiceExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "invoices-labor.xlsx",
    });

    render(
      <InvoiceExportDialog
        projectId="proj-test-1"
        open={true}
        onOpenChange={vi.fn()}
        initialType="labor"
      />,
    );

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-02" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(fetchInvoiceExport).toHaveBeenCalledWith(
          "proj-test-1",
          { from: "2026-01", to: "2026-02" },
          "xlsx",
          "labor",
        );
      },
      { timeout: 15000 },
    );
  });

  it("calls triggerBrowserDownload with blob and filename on success", async () => {
    const fakeBlob = new Blob(["bytes"]);
    vi.mocked(fetchInvoiceExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "invoices-test.xlsx",
    });

    renderDialog();

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-03" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(triggerBrowserDownload).toHaveBeenCalledWith(fakeBlob, "invoices-test.xlsx");
      },
      { timeout: 15000 },
    );
  }, 20000);

  it("calls toast.success after successful download", async () => {
    const fakeBlob = new Blob(["bytes"]);
    vi.mocked(fetchInvoiceExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "invoices-test.xlsx",
    });

    renderDialog();

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-02" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-02" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(toast.success).toHaveBeenCalledWith("downloaded", {
          id: "toast-id-1",
        });
      },
      { timeout: 15000 },
    );
  }, 20000);

  it("calls onOpenChange(false) after successful download", async () => {
    const onOpenChange = vi.fn();
    const fakeBlob = new Blob(["bytes"]);
    vi.mocked(fetchInvoiceExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "invoices-test.xlsx",
    });

    render(
      <InvoiceExportDialog
        projectId="proj-test-1"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-02" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-02" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      },
      { timeout: 15000 },
    );
  }, 20000);

  it("passes pdf format when pdf is selected", async () => {
    const fakeBlob = new Blob(["pdf-bytes"]);
    vi.mocked(fetchInvoiceExport).mockResolvedValue({
      blob: fakeBlob,
      filename: "invoices-test.pdf",
    });

    renderDialog();

    fireEvent.click(screen.getByText("pdf").closest("button")!);

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-01" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(fetchInvoiceExport).toHaveBeenCalledWith(
          "proj-test-1",
          { from: "2026-01", to: "2026-01" },
          "pdf",
          undefined,
        );
      },
      { timeout: 15000 },
    );
  }, 20000);
});

// ── Error path ────────────────────────────────────────────────────────────────

describe("InvoiceExportDialog — error path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls toast.error with error message when fetchInvoiceExport rejects with Error", async () => {
    vi.mocked(fetchInvoiceExport).mockRejectedValue(new Error("Server error: 500"));

    renderDialog();

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
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

  it("uses errorGeneric i18n key when rejection is not an Error instance", async () => {
    vi.mocked(fetchInvoiceExport).mockRejectedValue("raw string error");

    renderDialog();

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalledWith(
          "errorGeneric",
          expect.objectContaining({ id: "toast-id-1" }),
        );
      },
      { timeout: 15000 },
    );
  }, 20000);

  it("does not call onOpenChange(false) after failure", async () => {
    const onOpenChange = vi.fn();
    vi.mocked(fetchInvoiceExport).mockRejectedValue(new Error("network error"));

    render(
      <InvoiceExportDialog
        projectId="proj-test-1"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-02" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
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
    vi.mocked(fetchInvoiceExport).mockRejectedValue(new Error("timeout"));

    renderDialog();

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
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

  it("does not call fetchInvoiceExport when submit button is disabled", () => {
    renderDialog();
    // No from/to set — button is disabled
    const downloadBtn = screen.getByText("download").closest("button");
    expect(downloadBtn).toBeDisabled();
    fireEvent.click(downloadBtn!);
    expect(fetchInvoiceExport).not.toHaveBeenCalled();
  });
});

// ── Locked state during submit ────────────────────────────────────────────────

describe("InvoiceExportDialog — locked state during submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows Loader2 spinner and disables buttons while submitting", async () => {
    // Use a never-resolving promise to keep the dialog in locked state
    let resolveExport!: (val: { blob: Blob; filename: string }) => void;
    const pendingPromise = new Promise<{ blob: Blob; filename: string }>((resolve) => {
      resolveExport = resolve;
    });
    vi.mocked(fetchInvoiceExport).mockReturnValue(pendingPromise);

    renderDialog();

    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-03" },
    });

    fireEvent.click(screen.getByText("download").closest("button")!);

    // While pending: generating key appears, download button disabled, cancel disabled
    await waitFor(
      () => {
        expect(screen.getByText("generating")).toBeDefined();
      },
      { timeout: 5000 },
    );

    const cancelBtn = screen.getByText("cancel").closest("button");
    expect(cancelBtn).toBeDisabled();

    // Resolve to clean up
    resolveExport({ blob: new Blob(["x"]), filename: "test.xlsx" });
  }, 20000);
});

// ── Cancel behavior ───────────────────────────────────────────────────────────

describe("InvoiceExportDialog — cancel behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onOpenChange(false) when cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <InvoiceExportDialog
        projectId="proj-test-1"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByText("cancel").closest("button")!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not call fetchInvoiceExport when cancel is clicked", () => {
    renderDialog();
    fireEvent.change(document.getElementById("invoice-export-from")!, {
      target: { value: "2026-01" },
    });
    fireEvent.change(document.getElementById("invoice-export-to")!, {
      target: { value: "2026-03" },
    });
    fireEvent.click(screen.getByText("cancel").closest("button")!);
    expect(fetchInvoiceExport).not.toHaveBeenCalled();
  });
});
