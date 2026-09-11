/**
 * join-company-dialog.test.tsx
 *
 * Required regression test:
 *   test_join_company_uniform_error_on_invalid_code
 *
 * Also covers: success path, already-attached (409), submit guard.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { JoinCompanyDialog } from "@/components/companies/join-company-dialog";

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
    joinCompanyByCodeAction: vi.fn(),
  })
);

import { joinCompanyByCodeAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { toast } from "sonner";

const mockJoin = vi.mocked(joinCompanyByCodeAction);
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
  role: "admin" as const,
};

function renderDialog(onAttached = vi.fn(), onOpenChange = vi.fn()) {
  return render(
    <JoinCompanyDialog
      open={true}
      onOpenChange={onOpenChange}
      onAttached={onAttached}
    />
  );
}

// ---------------------------------------------------------------------------
// test_join_company_uniform_error_on_invalid_code
// ---------------------------------------------------------------------------

describe("test_join_company_uniform_error_on_invalid_code", () => {
  beforeEach(() => vi.clearAllMocks());

  it("not_found code → shows uniform invalid-code toast", async () => {
    mockJoin.mockResolvedValueOnce({
      ok: false,
      error: { code: "not_found", message: "raw backend msg" },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "AAAA2222" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledOnce();
      // must NOT surface the raw backend message — must be the i18n key text
      const [msg] = mockToast.error.mock.calls[0] as [string];
      expect(msg).not.toBe("raw backend msg");
      // The translated message describes an invalid or revoked code
      expect(msg.toLowerCase()).toMatch(/invalid|revoked/);
    });
  });

  it("validation code (local length guard) → same uniform toast", async () => {
    mockJoin.mockResolvedValueOnce({
      ok: false,
      error: { code: "validation", message: "Validation error" },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "AB" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      const [msg] = mockToast.error.mock.calls[0] as [string];
      expect(msg.toLowerCase()).toMatch(/invalid|revoked/);
    });
  });

  it("thrown exception → uniform toast (not rethrown)", async () => {
    mockJoin.mockRejectedValueOnce(new Error("Network failure"));

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "AAAA2222" } });

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

describe("JoinCompanyDialog — success path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes the trimmed input to joinCompanyByCodeAction and calls onAttached", async () => {
    mockJoin.mockResolvedValueOnce({ ok: true, data: ATTACHED_COMPANY });
    const onAttached = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <JoinCompanyDialog
        open={true}
        onOpenChange={onOpenChange}
        onAttached={onAttached}
      />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: " uynv-lygl " } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      expect(mockJoin).toHaveBeenCalledWith("uynv-lygl");
      expect(onAttached).toHaveBeenCalledOnce();
      expect(mockToast.success).toHaveBeenCalledOnce();
    });
  });
});

// ---------------------------------------------------------------------------
// Already-attached (409 company_already_attached — surfaces raw message)
// ---------------------------------------------------------------------------

describe("JoinCompanyDialog — already-attached error", () => {
  beforeEach(() => vi.clearAllMocks());

  it("non-invalid-code error → surfaces result.error.message directly", async () => {
    mockJoin.mockResolvedValueOnce({
      ok: false,
      error: { code: "company_already_attached", message: "Already a member." },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "AAAA2222" } });

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
// (policy: only "code doesn't work" codes get the uniform toast; others are
// actionable — preserved from the pre-code-only dialog)
// ---------------------------------------------------------------------------

describe("JoinCompanyDialog — non-uniform error codes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rate_limited code → surfaces rate_limited message (not uniform toast)", async () => {
    const msg = "Too many requests. Please wait and try again.";
    mockJoin.mockResolvedValueOnce({
      ok: false,
      error: { code: "rate_limited", message: msg },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "AAAA2222" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(msg);
    });
  });

  it("unauthorized code → surfaces session-expired message (not uniform toast)", async () => {
    const msg = "Session expired. Please log in again.";
    mockJoin.mockResolvedValueOnce({
      ok: false,
      error: { code: "unauthorized", message: msg },
    });

    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "AAAA2222" } });

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

describe("JoinCompanyDialog — submit guard", () => {
  it("Attach button is disabled when code input is empty", () => {
    renderDialog();
    const submitBtn = screen.getByRole("button", { name: /attach/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Attach button is enabled when code has non-whitespace content", () => {
    renderDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "AAAA2222" } });
    const submitBtn = screen.getByRole("button", { name: /attach/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
