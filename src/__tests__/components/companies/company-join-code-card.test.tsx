/**
 * company-join-code-card.test.tsx
 *
 * Covers: empty state → create, active code display + copy, renew (confirm) and
 * revoke (confirm) flows, error toast when the action fails.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CompanyJoinCodeCard } from "@/components/companies/company-join-code-card";

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
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    setJoinCodeAction: vi.fn(),
    revokeJoinCodeAction: vi.fn(),
  })
);

import {
  revokeJoinCodeAction,
  setJoinCodeAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { toast } from "sonner";

const mockSet = vi.mocked(setJoinCodeAction);
const mockRevoke = vi.mocked(revokeJoinCodeAction);
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

describe("CompanyJoinCodeCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the empty state and creates a code", async () => {
    mockSet.mockResolvedValueOnce({ ok: true, data: "UYNVLYGL" });
    render(<CompanyJoinCodeCard companyId={COMPANY_ID} initialCode={null} />);

    expect(screen.getByTestId("company-join-code-empty")).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create code/i }));
    });

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith(COMPANY_ID);
      expect(screen.getByTestId("company-join-code-value").textContent).toBe("UYNV-LYGL");
      expect(mockToast.success).toHaveBeenCalledOnce();
    });
  });

  it("renders the active code formatted and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CompanyJoinCodeCard companyId={COMPANY_ID} initialCode="ABCD2345" />);

    expect(screen.getByTestId("company-join-code-value").textContent).toBe("ABCD-2345");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^copy$/i }));
    });
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("ABCD-2345"));
  });

  it("renews after confirmation and shows the new code", async () => {
    mockSet.mockResolvedValueOnce({ ok: true, data: "WXYZ6789" });
    render(<CompanyJoinCodeCard companyId={COMPANY_ID} initialCode="ABCD2345" />);

    fireEvent.click(screen.getByRole("button", { name: /new code/i }));
    // Confirm button inside the alert dialog carries the same label.
    const confirm = await screen.findAllByRole("button", { name: /new code/i });
    await act(async () => {
      fireEvent.click(confirm[confirm.length - 1]);
    });

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith(COMPANY_ID);
      expect(screen.getByTestId("company-join-code-value").textContent).toBe("WXYZ-6789");
    });
  });

  it("revokes after confirmation and returns to the empty state", async () => {
    mockRevoke.mockResolvedValueOnce({ ok: true, data: undefined });
    render(<CompanyJoinCodeCard companyId={COMPANY_ID} initialCode="ABCD2345" />);

    fireEvent.click(screen.getByRole("button", { name: /revoke code/i }));
    const confirm = await screen.findAllByRole("button", { name: /revoke code/i });
    await act(async () => {
      fireEvent.click(confirm[confirm.length - 1]);
    });

    await waitFor(() => {
      expect(mockRevoke).toHaveBeenCalledWith(COMPANY_ID);
      expect(screen.getByTestId("company-join-code-empty")).toBeDefined();
    });
  });

  it("surfaces the action error as a toast and keeps the empty state", async () => {
    mockSet.mockResolvedValueOnce({
      ok: false,
      error: { code: "forbidden_admin_required", message: "Admin access is required." },
    });
    render(<CompanyJoinCodeCard companyId={COMPANY_ID} initialCode={null} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create code/i }));
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Admin access is required.");
      expect(screen.getByTestId("company-join-code-empty")).toBeDefined();
    });
  });
});
