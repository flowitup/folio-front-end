/**
 * Tests for RefundableExpenseAttachmentsCell.
 *
 * Verifies:
 *   - Empty array renders a muted em-dash (no button)
 *   - Single attachment renders a ghost button with filename; clicking opens preview dialog
 *   - Multiple attachments render a count button; dropdown lists filenames;
 *     clicking a filename opens the preview dialog
 *
 * Mocking strategy:
 *   - @/lib/api/invoice-api: stub fetchAttachmentBlob so the dialog can render
 *     without hitting the network (dialog is NOT stubbed — we verify it opens)
 *   - next-intl: key-lookup against en.json
 *   - Radix DropdownMenu: userEvent.setup() (no fake timers) works in jsdom
 *
 * Interaction: userEvent for Radix pointer events; fireEvent avoided for
 * Radix triggers because pointer-events checks are active by default.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks (before component imports)
// ---------------------------------------------------------------------------

// Prevent the preview dialog from firing real fetch calls in tests.
vi.mock("@/lib/api/invoice-api", () => ({
  fetchAttachmentBlob: vi.fn().mockResolvedValue(new Blob(["data"], { type: "application/pdf" })),
  fetchAttachmentBlobUrl: vi.fn().mockResolvedValue("blob:http://localhost/fake"),
}));

// Stub PDF/resizable dialog internals — not relevant to cell behaviour.
vi.mock(
  "@/app/[locale]/(app)/projects/[id]/documents/pdf-canvas-viewer",
  () => ({ PdfCanvasViewer: () => <div data-testid="pdf-viewer" /> })
);
vi.mock(
  "@/app/[locale]/(app)/projects/[id]/documents/resizable-dialog-handles",
  () => ({ ResizableDialogHandles: () => null })
);

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let str = resolve(en, `${ns}.${key}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  };
  return {
    useLocale: () => "en",
    useTranslations: (ns: string) => makeT(ns),
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { RefundableExpenseAttachmentsCell } from "@/components/billing/refundable-expense-attachments-cell";
import type { RefundableExpenseAttachment } from "@/types/invoice";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAttachment(overrides: Partial<RefundableExpenseAttachment> = {}): RefundableExpenseAttachment {
  return {
    id: "att-1",
    filename: "invoice.pdf",
    mime_type: "application/pdf",
    size_bytes: 12345,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RefundableExpenseAttachmentsCell", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a muted dash when attachments is empty", () => {
    render(<RefundableExpenseAttachmentsCell attachments={[]} />);
    // No button should be present
    expect(screen.queryByRole("button")).toBeNull();
    // The em-dash character is present
    expect(screen.getByText("—")).toBeDefined();
  });

  it("renders a button with truncated filename for a single attachment", () => {
    const att = makeAttachment({ filename: "receipt-2026-03.pdf" });
    render(<RefundableExpenseAttachmentsCell attachments={[att]} />);

    const btn = screen.getByRole("button");
    expect(btn).toBeDefined();
    expect(btn.textContent).toContain("receipt-2026-03.pdf");
  });

  it("clicking the single-file button opens the preview dialog", async () => {
    const user = userEvent.setup();
    const att = makeAttachment({ filename: "invoice.pdf" });
    render(<RefundableExpenseAttachmentsCell attachments={[att]} />);

    await user.click(screen.getByRole("button"));

    // The dialog header shows the filename once the dialog is open
    await waitFor(() => {
      // DialogTitle renders the filename
      expect(screen.getByRole("dialog")).toBeDefined();
    });
  });

  it("renders a count button for multiple attachments", () => {
    const atts = [
      makeAttachment({ id: "a1", filename: "file1.pdf" }),
      makeAttachment({ id: "a2", filename: "file2.jpg" }),
      makeAttachment({ id: "a3", filename: "file3.png" }),
    ];
    render(<RefundableExpenseAttachmentsCell attachments={atts} />);

    const btn = screen.getByRole("button");
    // en.json: attachments.count = "{n} files"
    expect(btn.textContent).toContain("3 files");
  });

  it("multi-file dropdown lists all filenames", async () => {
    const user = userEvent.setup();
    const atts = [
      makeAttachment({ id: "a1", filename: "alpha.pdf" }),
      makeAttachment({ id: "a2", filename: "beta.pdf" }),
    ];
    render(<RefundableExpenseAttachmentsCell attachments={atts} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      const items = document.querySelectorAll("[role='menuitem']");
      if (items.length === 0) throw new Error("menu items not rendered");
    });

    const labels = Array.from(document.querySelectorAll("[role='menuitem']")).map(
      (el) => el.textContent ?? ""
    );
    expect(labels).toContain("alpha.pdf");
    expect(labels).toContain("beta.pdf");
  });

  it("clicking a menu item from multi-file dropdown opens the preview dialog", async () => {
    const user = userEvent.setup();
    const atts = [
      makeAttachment({ id: "a1", filename: "alpha.pdf" }),
      makeAttachment({ id: "a2", filename: "beta.pdf" }),
    ];
    render(<RefundableExpenseAttachmentsCell attachments={atts} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      const items = document.querySelectorAll("[role='menuitem']");
      if (items.length === 0) throw new Error("menu items not rendered");
    });

    const alphaItem = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => el.textContent?.includes("alpha.pdf")
    )!;
    await user.click(alphaItem);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });
  });
});
