/**
 * Regression test for the post-sign-in stale `user.companies` bug: the
 * sign-in response does not carry `companies`, so `AuthContext` must re-fetch
 * the canonical user via `getCurrentUserAction()` (backed by `GET /auth/me`)
 * before pushing state.
 *
 * Phone + SMS code is the only sign-in path — email/password login and
 * `AuthContext.login()` were removed with the `/auth/login` endpoint.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockGetCurrentUserAction = vi.fn();
const mockVerifyOtpAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => "/en/login",
}));

vi.mock("@/lib/auth/actions", () => ({
  logout: vi.fn(),
  getCurrentUserAction: () => mockGetCurrentUserAction(),
}));

vi.mock("@/lib/auth/otp-actions", () => ({
  verifyOtpAction: (...args: unknown[]) => mockVerifyOtpAction(...args),
}));

import { AuthProvider, useAuth } from "../AuthContext";

function LoginProbe() {
  const { user, loginWithPhone } = useAuth();
  return (
    <div>
      <span data-testid="companies-count">{user?.companies?.length ?? "none"}</span>
      <button
        onClick={() => {
          void loginWithPhone("+33612345678", "123456");
        }}
      >
        sign in with phone
      </button>
    </div>
  );
}

describe("AuthContext.loginWithPhone", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockGetCurrentUserAction.mockReset();
    mockVerifyOtpAction.mockReset();
  });

  it("populates user.companies from the post-sign-in /auth/me refetch", async () => {
    mockVerifyOtpAction.mockResolvedValue({
      success: true,
      user: { id: "u1", email: "admin2@example.com", permissions: [] },
    });
    mockGetCurrentUserAction.mockResolvedValue({
      id: "u1",
      email: "admin2@example.com",
      permissions: [],
      companies: [
        { id: "c1", legal_name: "Folio Demo SARL", role: "admin", is_primary: true },
      ],
    });

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "sign in with phone" }));

    expect(mockVerifyOtpAction).toHaveBeenCalledWith("+33612345678", "123456");
    await waitFor(() => {
      expect(mockGetCurrentUserAction).toHaveBeenCalled();
      expect(screen.getByTestId("companies-count").textContent).toBe("1");
    });
    expect(mockPush).toHaveBeenCalledWith("/en/dashboard");
  });

  it("falls back to the sign-in response user if the /auth/me refetch fails", async () => {
    mockVerifyOtpAction.mockResolvedValue({
      success: true,
      user: { id: "u2", email: "user.eve@example.com", permissions: [] },
    });
    mockGetCurrentUserAction.mockResolvedValue(null);

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "sign in with phone" }));

    await waitFor(() => {
      expect(screen.getByTestId("companies-count").textContent).toBe("0");
    });
  });
});
