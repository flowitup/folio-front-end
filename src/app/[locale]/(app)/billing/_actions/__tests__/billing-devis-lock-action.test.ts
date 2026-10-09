/**
 * A devis converted to a live facture is refused by the API with
 * 409 reason "devis_locked_by_facture": the actions report it as its own code,
 * so the UI can say "cancel the invoice first" instead of a status-race message.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/api/billing/documents", () => ({
  updateBillingDocument: vi.fn(),
  updateBillingDocumentStatus: vi.fn(),
}));
vi.mock("@/lib/api/billing/templates", () => ({}));

import { updateBillingDocumentAction, updateBillingDocumentStatusAction } from "../billing-actions";
import { updateBillingDocument, updateBillingDocumentStatus } from "@/lib/api/billing/documents";
import { getSession } from "@/lib/auth/session";

const mockUpdate = vi.mocked(updateBillingDocument);
const mockStatus = vi.mocked(updateBillingDocumentStatus);
const mockSession = vi.mocked(getSession);

const DOC = "11111111-2222-3333-4444-555555555555";
const LOCKED_MESSAGE = "Devis x was converted to a facture: cancel the facture before changing the devis";

function httpError(status: number, body: Record<string, unknown> | null) {
  return Object.assign(new Error(`HTTP ${status}`), { status, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue({ accessToken: "t" } as Awaited<ReturnType<typeof getSession>>);
});

describe("devis locked by its facture", () => {
  it("maps the status change refusal to devis_locked", async () => {
    mockStatus.mockRejectedValueOnce(
      httpError(409, { error: "Conflict", reason: "devis_locked_by_facture", message: LOCKED_MESSAGE })
    );
    expect(await updateBillingDocumentStatusAction(DOC, "sent")).toEqual({
      ok: false,
      error: { code: "devis_locked", message: LOCKED_MESSAGE },
    });
  });

  it("maps the edit refusal to devis_locked", async () => {
    mockUpdate.mockRejectedValueOnce(
      httpError(409, { error: "Conflict", reason: "devis_locked_by_facture", message: LOCKED_MESSAGE })
    );
    expect(await updateBillingDocumentAction(DOC, { notes: "x" })).toMatchObject({
      ok: false,
      error: { code: "devis_locked" },
    });
  });

  it("keeps a plain 409 (a status race) as conflict", async () => {
    mockStatus.mockRejectedValueOnce(httpError(409, { error: "Conflict", message: "Invalid transition" }));
    expect(await updateBillingDocumentStatusAction(DOC, "expired")).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
  });
});
