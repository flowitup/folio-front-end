/**
 * Tests for payment-methods-actions.ts server actions.
 *
 * Strategy: mock the payment-methods-api module; verify that each action
 * correctly forwards calls, maps happy-path results, and classifies BE errors.
 *
 * Error classification:
 *   409 + reason="duplicate"  → duplicate_label
 *   403                       → forbidden
 *   404                       → not_found
 *   409 + reason="delete"     → builtin_delete
 *   401                       → unauthorized
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks (must come before any imports of the module under test) ----

vi.mock("@/lib/api/payment-methods-api", () => ({
  fetchPaymentMethods: vi.fn(),
  createPaymentMethod: vi.fn(),
  updatePaymentMethod: vi.fn(),
  deletePaymentMethod: vi.fn(),
}));

// Server-action session guard is mocked as authenticated by default so
// existing tests focus on BE-error classification. A dedicated test
// below covers the unauthenticated branch.
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "11111111-1111-1111-1111-111111111111" },
    accessToken: "test-token",
    expiresAt: Date.now() + 60_000,
  }),
}));

// ---- Imports after mocks ----

const {
  listPaymentMethodsAction,
  createPaymentMethodAction,
  updatePaymentMethodAction,
  deletePaymentMethodAction,
} = await import("../payment-methods-actions");

const {
  fetchPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} = await import("@/lib/api/payment-methods-api");

const mockFetch = vi.mocked(fetchPaymentMethods);
const mockCreate = vi.mocked(createPaymentMethod);
const mockUpdate = vi.mocked(updatePaymentMethod);
const mockDelete = vi.mocked(deletePaymentMethod);

// ---- Helpers ----

function httpError(
  status: number,
  body: Record<string, unknown> | null = null
): Error & { status: number; body: Record<string, unknown> | null } {
  const err = new Error(`HTTP ${status}`) as Error & {
    status: number;
    body: Record<string, unknown> | null;
  };
  err.status = status;
  err.body = body;
  return err;
}

// Valid UUIDs — actions reject non-UUID identifiers as defense-in-depth.
const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const PM_ID = "22222222-2222-2222-2222-222222222222";

const PAYMENT_METHOD = {
  id: PM_ID,
  companyId: COMPANY_ID,
  label: "Bank Transfer",
  isBuiltin: false,
  isActive: true,
  usageCount: 0,
  isCompanyPayment: false,
};

const BUILTIN_METHOD = {
  id: "pm-builtin-1",
  companyId: COMPANY_ID,
  label: "Cash",
  isBuiltin: true,
  isActive: true,
  usageCount: 3,
  isCompanyPayment: false,
};

const METHODS_LIST = [BUILTIN_METHOD, PAYMENT_METHOD];

// ---- Tests ----

describe("listPaymentMethodsAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — returns ok:true with data from fetchPaymentMethods", async () => {
    mockFetch.mockResolvedValueOnce(METHODS_LIST);
    const result = await listPaymentMethodsAction(COMPANY_ID);
    expect(result).toEqual({ ok: true, data: METHODS_LIST });
    expect(mockFetch).toHaveBeenCalledWith(COMPANY_ID, { includeInactive: false });
  });

  it("passes includeInactive=true when requested", async () => {
    mockFetch.mockResolvedValueOnce(METHODS_LIST);
    await listPaymentMethodsAction(COMPANY_ID, true);
    expect(mockFetch).toHaveBeenCalledWith(COMPANY_ID, { includeInactive: true });
  });

  it("403 → ok:false, error.code='forbidden'", async () => {
    mockFetch.mockRejectedValueOnce(httpError(403));
    const result = await listPaymentMethodsAction(COMPANY_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("401 → ok:false, error.code='unauthorized'", async () => {
    mockFetch.mockRejectedValueOnce(httpError(401));
    const result = await listPaymentMethodsAction(COMPANY_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("network error → ok:false, error.code='generic'", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const result = await listPaymentMethodsAction(COMPANY_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("generic");
  });
});

describe("createPaymentMethodAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — creates then fetches full list", async () => {
    mockCreate.mockResolvedValueOnce(PAYMENT_METHOD);
    mockFetch.mockResolvedValueOnce(METHODS_LIST);

    const result = await createPaymentMethodAction(COMPANY_ID, "Bank Transfer");

    expect(result).toEqual({ ok: true, data: METHODS_LIST });
    expect(mockCreate).toHaveBeenCalledWith(COMPANY_ID, "Bank Transfer");
    // Should refetch the full list after creation
    expect(mockFetch).toHaveBeenCalledWith(COMPANY_ID);
  });

  it("409 + reason='duplicate' → ok:false, error.code='duplicate_label'", async () => {
    mockCreate.mockRejectedValueOnce(
      httpError(409, { reason: "duplicate", message: "Label already exists." })
    );
    const result = await createPaymentMethodAction(COMPANY_ID, "Cash");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("duplicate_label");
  });

  it("403 → ok:false, error.code='forbidden'", async () => {
    mockCreate.mockRejectedValueOnce(httpError(403));
    const result = await createPaymentMethodAction(COMPANY_ID, "Wise");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("400 → ok:false, error.code='validation'", async () => {
    // The BE may reject a label that FE didn't catch (e.g. semantic
    // duplicate-after-trim). Send a label that passes FE validation so
    // the mocked BE 400 is what produces the error.
    mockCreate.mockRejectedValueOnce(httpError(400, { message: "Label not allowed." }));
    const result = await createPaymentMethodAction(COMPANY_ID, "Bank Wire");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });

  it("rejects labels exceeding max length before hitting BE", async () => {
    const result = await createPaymentMethodAction(COMPANY_ID, "x".repeat(200));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("429 → ok:false, error.code='rate_limited'", async () => {
    mockCreate.mockRejectedValueOnce(httpError(429));
    const result = await createPaymentMethodAction(COMPANY_ID, "Stripe");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("rate_limited");
  });
});

describe("updatePaymentMethodAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — patches then returns refreshed list", async () => {
    const renamed = { ...PAYMENT_METHOD, label: "Wire Transfer" };
    mockUpdate.mockResolvedValueOnce(renamed);
    mockFetch.mockResolvedValueOnce([BUILTIN_METHOD, renamed]);

    const result = await updatePaymentMethodAction(COMPANY_ID, PM_ID, {
      label: "Wire Transfer",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[1].label).toBe("Wire Transfer");
    expect(mockUpdate).toHaveBeenCalledWith(COMPANY_ID, PM_ID, {
      label: "Wire Transfer",
    });
  });

  it("409 + reason='duplicate' → duplicate_label", async () => {
    mockUpdate.mockRejectedValueOnce(
      httpError(409, { reason: "duplicate" })
    );
    const result = await updatePaymentMethodAction(COMPANY_ID, PM_ID, {
      label: "Cash",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("duplicate_label");
  });

  it("404 → not_found", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(404));
    const result = await updatePaymentMethodAction(COMPANY_ID, PM_ID, {
      label: "X",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

describe("deletePaymentMethodAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — deletes then returns refreshed list", async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    mockFetch.mockResolvedValueOnce([BUILTIN_METHOD]);

    const result = await deletePaymentMethodAction(COMPANY_ID, PM_ID);

    expect(result).toEqual({ ok: true, data: [BUILTIN_METHOD] });
    expect(mockDelete).toHaveBeenCalledWith(COMPANY_ID, PM_ID);
  });

  it("409 + reason='delete' → builtin_delete", async () => {
    mockDelete.mockRejectedValueOnce(
      httpError(409, { reason: "delete" })
    );
    const result = await deletePaymentMethodAction(COMPANY_ID, PM_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("builtin_delete");
  });

  it("403 → forbidden (permission_denied mapping)", async () => {
    mockDelete.mockRejectedValueOnce(httpError(403));
    const result = await deletePaymentMethodAction(COMPANY_ID, PM_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("404 → not_found", async () => {
    mockDelete.mockRejectedValueOnce(httpError(404));
    const result = await deletePaymentMethodAction(COMPANY_ID, PM_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("401 → unauthorized", async () => {
    mockDelete.mockRejectedValueOnce(httpError(401));
    const result = await deletePaymentMethodAction(COMPANY_ID, PM_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });
});
