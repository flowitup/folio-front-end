/**
 * redeem-invite-token-dialog.test.tsx
 *
 * Required regression test:
 *   test_redeem_invite_token_uniform_error_on_410
 *
 * Also covers: success path, already-attached (409).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RedeemInviteTokenDialog } from "@/components/companies/redeem-invite-token-dialog";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string) => resolve(en, `${ns}.${key}`);
  return { useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  } as unknown as { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
}));

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    redeemInviteTokenAction: vi.fn(),
  })
);

import { redeemInviteTokenAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { toast } from "sonner";

const mockRedeem = vi.mocked(redeemInviteTokenAction);
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const ATTACHED_COMPANY = {
  id: "co-1",
  legal_name: "ACME Corp",
  address: "Paris",
  siret: null,
  tva_number: null,
  iban: null,
  bic: null,
  logo_url: null,
  default_payment_terms: null,
  prefix_override: null,
  created_by: "user-admin",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  is_primary: false,
  attached_at: "2026-05-07T00:00:00Z",
};

function renderDialog(onAttached = vi.fn(), onOpenChange = vi.fn()) {
  return render(
    <RedeemInviteTokenDialog
      open={true}
      onOpenChange={onOpenChange}
      onAttached={onAttached}
    />
  );
}

// ---------------------------------------------------------------------------
// test_redeem_invite_token_uniform_error_on_410
// ---------------------------------------------------------------------------

describe("test_redeem_invite_token_uniform_error_on_410", () => {
  beforeEach(() => vi.clearAllMocks());

  it("token_invalid code → shows tokenInvalidError toast", async () => {
    mockRedeem.mockResolvedValueOnce({
      ok: false,
      error: { code: "token_invalid", message: "raw backend msg" },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "bad-token" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledOnce();
      // must NOT surface the raw backend message — must be the i18n key text
      const [msg] = mockToast.error.mock.calls[0] as [string];
      expect(msg).not.toBe("raw backend msg");
      // The translated message contains "invalid" or "expired"
      expect(msg.toLowerCase()).toMatch(/invalid|expired|used/);
    });
  });

  it("not_found code → same uniform toast (not raw message)", async () => {
    mockRedeem.mockResolvedValueOnce({
      ok: false,
      error: { code: "not_found", message: "Not found" },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "missing" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      const [msg] = mockToast.error.mock.calls[0] as [string];
      expect(msg.toLowerCase()).toMatch(/invalid|expired|used/);
    });
  });

  it("validation code → same uniform toast", async () => {
    mockRedeem.mockResolvedValueOnce({
      ok: false,
      error: { code: "validation", message: "Validation error" },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "bad" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      const [msg] = mockToast.error.mock.calls[0] as [string];
      expect(msg.toLowerCase()).toMatch(/invalid|expired|used/);
    });
  });

  it("thrown exception → uniform toast (not rethrown)", async () => {
    mockRedeem.mockRejectedValueOnce(new Error("Network failure"));

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "tok" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledOnce();
    });
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("RedeemInviteTokenDialog — success path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls onAttached with the company and closes dialog on success", async () => {
    mockRedeem.mockResolvedValueOnce({ ok: true, data: ATTACHED_COMPANY });
    const onAttached = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <RedeemInviteTokenDialog
        open={true}
        onOpenChange={onOpenChange}
        onAttached={onAttached}
      />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "valid-token" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      expect(mockRedeem).toHaveBeenCalledWith("valid-token");
      expect(onAttached).toHaveBeenCalledWith(ATTACHED_COMPANY);
      expect(mockToast.success).toHaveBeenCalledOnce();
    });
  });
});

// ---------------------------------------------------------------------------
// Already-attached (409 company_already_attached — surfaces raw message)
// ---------------------------------------------------------------------------

describe("RedeemInviteTokenDialog — already-attached error", () => {
  beforeEach(() => vi.clearAllMocks());

  it("non-token error code → surfaces result.error.message directly", async () => {
    mockRedeem.mockResolvedValueOnce({
      ok: false,
      error: { code: "company_already_attached", message: "Already a member." },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "tok" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Already a member.");
    });
  });
});

// ---------------------------------------------------------------------------
// H-3 chosen behavior: rate_limited / unauthorized surface distinct messages
// (policy: only 410-family codes get the uniform toast; others are actionable)
// ---------------------------------------------------------------------------

describe("RedeemInviteTokenDialog — H-3 non-uniform error codes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rate_limited code → surfaces rate_limited message (not uniform toast)", async () => {
    const msg = "Too many requests. Please wait and try again.";
    mockRedeem.mockResolvedValueOnce({
      ok: false,
      error: { code: "rate_limited", message: msg },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "tok" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(msg);
    });
  });

  it("unauthorized code → surfaces session-expired message (not uniform toast)", async () => {
    const msg = "Session expired. Please log in again.";
    mockRedeem.mockResolvedValueOnce({
      ok: false,
      error: { code: "unauthorized", message: msg },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "tok" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(msg);
    });
  });
});

// ---------------------------------------------------------------------------
// Submit button disabled when input empty
// ---------------------------------------------------------------------------

describe("RedeemInviteTokenDialog — submit guard", () => {
  it("Attach button is disabled when token input is empty", () => {
    renderDialog();
    const submitBtn = screen.getByRole("button", { name: /attach/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Attach button is enabled when token has non-whitespace content", () => {
    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "tok" } });
    const submitBtn = screen.getByRole("button", { name: /attach/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
