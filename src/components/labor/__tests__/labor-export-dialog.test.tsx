/**
 * Tests for LaborExportDialog component — phase 08
 *
 * Covers: trigger render, range validation UI, format toggle, submit happy path
 * with Blob + anchor-click mock, error toast on rejection, cancel closes dialog.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LaborExportDialog } from "../labor-export-dialog";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/api/labor", () => ({
  fetchLaborExport: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn().mockReturnValue("toast-id-1"),
  },
}));

// Import after mocking
import { fetchLaborExport } from "@/lib/api/labor";
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
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  // Tracks all anchor elements created during the test
  const anchorClicks: HTMLAnchorElement[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    anchorClicks.length = 0;

    createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);

    // Spy on createElement to intercept anchor creation without disrupting rendering.
    // We call the original but override click() on every anchor so we can assert it.
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string, ...args: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spread for overload compat
      const el = originalCreateElement(tag, ...(args as any[]));
      if (tag === "a") {
        // Track and stub click so it doesn't open a navigation
        vi.spyOn(el as HTMLAnchorElement, "click").mockReturnValue(undefined);
        anchorClicks.push(el as HTMLAnchorElement);
      }
      return el;
    });
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

    // URL.createObjectURL called with the blob
    expect(createObjectURLSpy).toHaveBeenCalledWith(fakeBlob);

    // An anchor was created with the correct download attribute
    const anchor = anchorClicks[anchorClicks.length - 1];
    expect(anchor).toBeDefined();
    expect(anchor.download).toBe("labor-proj-test-1-2026-01-to-2026-03.xlsx");

    // anchor.click() was called (triggering the download)
    expect(anchor.click).toHaveBeenCalled();

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

  // Verifies URL.createObjectURL is called (revokeObjectURL runs via setTimeout(0) in production)
  it("URL.createObjectURL is called with the response blob", async () => {
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
        expect(createObjectURLSpy).toHaveBeenCalledWith(fakeBlob);
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
