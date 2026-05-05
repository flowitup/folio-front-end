/**
 * Tests for BillingStatusMenu component.
 *
 * Required named tests:
 *   - test_status_menu_devis_transitions_only
 *   - test_status_menu_facture_transitions_only
 *
 * Verifies that:
 *   - Menu offers only kind-allowed transitions per status (transition matrix)
 *   - Terminal states render no dropdown trigger
 *   - Clicking a transition calls updateBillingDocumentStatusAction
 *   - On success: calls onStatusChanged + success toast
 *   - On conflict 409: calls toast.error with conflict message
 *
 * Interaction strategy:
 *   userEvent.setup() is required for Radix DropdownMenu — fireEvent does not
 *   trigger the pointer events that Radix uses to open the portal. No fake
 *   timers are used so userEvent is safe here.
 *
 * Transition matrix tests that do NOT need the dropdown open (terminal states,
 * "Change status" button absent) use synchronous assertions only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingStatusMenu } from "@/components/billing/billing-status-menu";
import type { BillingDocument, BillingDocumentStatus } from "@/types/billing";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock(
  "@/app/[locale]/(app)/billing/_actions/billing-actions",
  () => ({
    updateBillingDocumentStatusAction: vi.fn(),
  })
);

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  } as unknown as {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  },
}));

import { updateBillingDocumentStatusAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { toast } from "sonner";

const mockAction = vi.mocked(updateBillingDocumentStatusAction);
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeDoc(
  kind: "devis" | "facture",
  status: BillingDocumentStatus
): BillingDocument {
  return {
    id: "doc-1",
    user_id: "user-1",
    project_id: null,
    kind,
    document_number: "DOC-001",
    status,
    issue_date: "2026-01-01",
    validity_until: null,
    payment_due_date: null,
    payment_terms: null,
    recipient_name: "Client",
    recipient_address: null,
    recipient_email: null,
    recipient_siret: null,
    notes: null,
    terms: null,
    signature_block_text: null,
    items: [],
    issuer_legal_name: "My Co",
    issuer_address: "Paris",
    issuer_siret: null,
    issuer_tva_number: null,
    issuer_iban: null,
    issuer_bic: null,
    issuer_logo_url: null,
    source_devis_id: null,
    total_ht: "0",
    total_tva: "0",
    total_ttc: "0",
    vat_breakdown: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function renderMenu(
  kind: "devis" | "facture",
  status: BillingDocumentStatus,
  onStatusChanged = vi.fn()
) {
  const doc = makeDoc(kind, status);
  return render(
    <BillingStatusMenu document={doc} onStatusChanged={onStatusChanged} />
  );
}

/** Open the Radix DropdownMenu and return all visible menu item labels. */
async function openMenuAndGetLabels(
  user: ReturnType<typeof userEvent.setup>
): Promise<string[]> {
  const trigger = screen.queryByRole("button", { name: /change status/i });
  if (!trigger) return [];
  await user.click(trigger);
  // Radix renders portal content outside container — query document directly
  await waitFor(() => {
    const items = document.querySelectorAll("[role='menuitem']");
    if (items.length === 0) throw new Error("menuitems not rendered yet");
  });
  return Array.from(document.querySelectorAll("[role='menuitem']")).map(
    (el) => el.textContent ?? ""
  );
}

// ---------------------------------------------------------------------------
// test_status_menu_devis_transitions_only
// ---------------------------------------------------------------------------

describe("test_status_menu_devis_transitions_only", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devis draft → only offers 'Mark as Sent'", async () => {
    const user = userEvent.setup();
    renderMenu("devis", "draft");
    const labels = await openMenuAndGetLabels(user);
    expect(labels).toEqual(["Mark as Sent"]);
  });

  it("devis sent → offers Accepted, Rejected, Expired — not Paid/Overdue/Cancelled", async () => {
    const user = userEvent.setup();
    renderMenu("devis", "sent");
    const labels = await openMenuAndGetLabels(user);
    expect(labels).toContain("Mark as Accepted");
    expect(labels).toContain("Mark as Rejected");
    expect(labels).toContain("Mark as Expired");
    expect(labels).not.toContain("Mark as Paid");
    expect(labels).not.toContain("Mark as Overdue");
    expect(labels).not.toContain("Mark as Cancelled");
  });

  it("devis accepted → only offers 'Revert to Sent'", async () => {
    const user = userEvent.setup();
    renderMenu("devis", "accepted");
    const labels = await openMenuAndGetLabels(user);
    expect(labels).toEqual(["Revert to Sent"]);
  });

  it("devis rejected → only offers 'Re-open (Draft)'", async () => {
    const user = userEvent.setup();
    renderMenu("devis", "rejected");
    const labels = await openMenuAndGetLabels(user);
    expect(labels).toEqual(["Re-open (Draft)"]);
  });

  it("devis expired → terminal state, no Change status button", () => {
    renderMenu("devis", "expired");
    expect(screen.queryByRole("button", { name: /change status/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// test_status_menu_facture_transitions_only
// ---------------------------------------------------------------------------

describe("test_status_menu_facture_transitions_only", () => {
  beforeEach(() => vi.clearAllMocks());

  it("facture draft → only offers 'Mark as Sent'", async () => {
    const user = userEvent.setup();
    renderMenu("facture", "draft");
    const labels = await openMenuAndGetLabels(user);
    expect(labels).toEqual(["Mark as Sent"]);
  });

  it("facture sent → offers Paid, Overdue, Cancelled — not Accepted/Rejected/Expired", async () => {
    const user = userEvent.setup();
    renderMenu("facture", "sent");
    const labels = await openMenuAndGetLabels(user);
    expect(labels).toContain("Mark as Paid");
    expect(labels).toContain("Mark as Overdue");
    expect(labels).toContain("Mark as Cancelled");
    expect(labels).not.toContain("Mark as Accepted");
    expect(labels).not.toContain("Mark as Rejected");
    expect(labels).not.toContain("Mark as Expired");
  });

  it("facture overdue → only offers 'Mark as Paid'", async () => {
    const user = userEvent.setup();
    renderMenu("facture", "overdue");
    const labels = await openMenuAndGetLabels(user);
    expect(labels).toEqual(["Mark as Paid"]);
  });

  it("facture paid → only offers 'Mark as Cancelled (refund)'", async () => {
    const user = userEvent.setup();
    renderMenu("facture", "paid");
    const labels = await openMenuAndGetLabels(user);
    expect(labels).toEqual(["Mark as Cancelled (refund)"]);
  });

  it("facture cancelled → terminal state, no Change status button", () => {
    renderMenu("facture", "cancelled");
    expect(screen.queryByRole("button", { name: /change status/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Transition action tests
// ---------------------------------------------------------------------------

describe("BillingStatusMenu — action invocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking a transition calls updateBillingDocumentStatusAction with correct args", async () => {
    const user = userEvent.setup();
    const updatedDoc = makeDoc("devis", "sent");
    mockAction.mockResolvedValueOnce({ ok: true, data: updatedDoc });

    renderMenu("devis", "draft");
    const labels = await openMenuAndGetLabels(user);
    expect(labels).toContain("Mark as Sent");

    const sentItem = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /mark as sent/i.test(el.textContent ?? "")
    )!;
    await user.click(sentItem);

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith("doc-1", "sent");
    });
  });

  it("calls onStatusChanged with updated doc on success", async () => {
    const user = userEvent.setup();
    const updatedDoc = makeDoc("devis", "sent");
    mockAction.mockResolvedValueOnce({ ok: true, data: updatedDoc });
    const onStatusChanged = vi.fn();

    renderMenu("devis", "draft", onStatusChanged);
    await openMenuAndGetLabels(user);

    const sentItem = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /mark as sent/i.test(el.textContent ?? "")
    )!;
    await user.click(sentItem);

    await waitFor(() => {
      expect(onStatusChanged).toHaveBeenCalledWith(updatedDoc);
    });
  });

  it("calls toast.success with status label on success", async () => {
    const user = userEvent.setup();
    const updatedDoc = makeDoc("devis", "sent");
    mockAction.mockResolvedValueOnce({ ok: true, data: updatedDoc });

    renderMenu("devis", "draft");
    await openMenuAndGetLabels(user);

    const sentItem = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /mark as sent/i.test(el.textContent ?? "")
    )!;
    await user.click(sentItem);

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining("Sent")
      );
    });
  });

  it("shows conflict error toast on conflict code", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "conflict", message: "Conflict" },
    });

    renderMenu("devis", "draft");
    await openMenuAndGetLabels(user);

    const sentItem = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /mark as sent/i.test(el.textContent ?? "")
    )!;
    await user.click(sentItem);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("not allowed")
      );
    });
  });

  it("shows generic error message toast on non-conflict error", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "generic", message: "Something went wrong" },
    });

    renderMenu("devis", "draft");
    await openMenuAndGetLabels(user);

    const sentItem = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /mark as sent/i.test(el.textContent ?? "")
    )!;
    await user.click(sentItem);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Something went wrong");
    });
  });

  it("shows error toast on thrown exception", async () => {
    const user = userEvent.setup();
    mockAction.mockRejectedValueOnce(new Error("Network failure"));

    renderMenu("devis", "draft");
    await openMenuAndGetLabels(user);

    const sentItem = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /mark as sent/i.test(el.textContent ?? "")
    )!;
    await user.click(sentItem);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update status")
      );
    });
  });
});
