/**
 * addMemberByPhoneAction (company-settings-actions.ts): each backend refusal
 * maps onto a specific, translated message instead of the generic
 * "conflict" / "validation" texts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-intl/server", async () => {
  const fr = (await import("@/messages/fr.json")).default as unknown as Record<string, unknown>;
  return {
    getTranslations: async (ns: string) => (key: string) =>
      [...ns.split("."), key].reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], fr),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: "test-token" }),
}));

vi.mock("@/lib/api/companies-members", () => ({
  fetchCompanyDirectory: vi.fn(),
  addMemberByPhone: vi.fn(),
  cancelPendingMember: vi.fn(),
  importMembers: vi.fn(),
}));

const { addMemberByPhoneAction } = await import("../company-settings-actions");
const { addMemberByPhone } = await import("@/lib/api/companies-members");
const mockAdd = vi.mocked(addMemberByPhone);

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

function httpError(status: number, body: Record<string, unknown> | null = null) {
  return Object.assign(new Error(`HTTP ${status}`), { status, body });
}

describe("addMemberByPhoneAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("409 already_member → says the number is already in the company", async () => {
    mockAdd.mockRejectedValueOnce(
      httpError(409, { error: "Conflict", reason: "already_member", message: "This person is already a member" })
    );
    const result = await addMemberByPhoneAction(COMPANY_ID, { phone: "0620351102" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "already_member",
        message: "Ce numéro de téléphone est déjà dans votre entreprise.",
      },
    });
  });

  it.each(["+447700900123", "12345"])("400 invalid_phone (%s) → asks for a French number", async (phone) => {
    mockAdd.mockRejectedValueOnce(httpError(400, { error: "ValidationError", reason: "invalid_phone" }));
    const result = await addMemberByPhoneAction(COMPANY_ID, { phone });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_phone",
        message: "Saisissez un numéro de téléphone français (+33… ou 0…).",
      },
    });
  });

  it("keeps the generic mapping for other refusals", async () => {
    mockAdd.mockRejectedValueOnce(httpError(409, { error: "Conflict", reason: "concurrent_phone_conflict" }));
    const conflict = await addMemberByPhoneAction(COMPANY_ID, { phone: "0611110001" });
    expect(conflict.ok === false && conflict.error.code).toBe("conflict");

    mockAdd.mockRejectedValueOnce(httpError(400, { error: "ValidationError", message: "role must be one of" }));
    const invalid = await addMemberByPhoneAction(COMPANY_ID, { phone: "0611110001" });
    expect(invalid.ok === false && invalid.error.code).toBe("validation");
  });

  it("409 with person_id still reports the phone already in the company", async () => {
    mockAdd.mockRejectedValueOnce(httpError(409, { error: "Conflict", person_id: "p-1" }));
    const result = await addMemberByPhoneAction(COMPANY_ID, { phone: "0611110001" });
    expect(result.ok === false && result.error.code).toBe("phone_already_in_company");
  });
});
