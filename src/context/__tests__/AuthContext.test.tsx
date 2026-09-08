/**
 * Regression test for the post-login stale `user.companies` bug: the
 * `POST /auth/login` response does not reliably carry `companies`, so
 * `AuthContext.login()` must re-fetch the canonical user via
 * `getCurrentUserAction()` (backed by `GET /auth/me`) before pushing state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockLoginAction = vi.fn();
const mockGetCurrentUserAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => "/en/login",
}));

vi.mock("@/lib/auth/actions", () => ({
  login: (...args: unknown[]) => mockLoginAction(...args),
  logout: vi.fn(),
  getCurrentUserAction: () => mockGetCurrentUserAction(),
}));

import { AuthProvider, useAuth } from "../AuthContext";

function LoginProbe() {
  const { user, login } = useAuth();
  return (
    <div>
      <span data-testid="companies-count">{user?.companies?.length ?? "none"}</span>
      <button
        onClick={() => {
          void login({ email: "admin2@example.com", password: "password123" });
        }}
      >
        sign in
      </button>
    </div>
  );
}

describe("AuthContext.login", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockLoginAction.mockReset();
    mockGetCurrentUserAction.mockReset();
  });

  it("populates user.companies from the post-login /auth/me refetch", async () => {
    mockLoginAction.mockResolvedValue({
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

    await userEvent.click(screen.getByRole("button", { name: "sign in" }));

    await waitFor(() => {
      expect(screen.getByTestId("companies-count").textContent).toBe("1");
    });
    expect(mockPush).toHaveBeenCalledWith("/en/dashboard");
  });

  it("falls back to the login response user if the /auth/me refetch fails", async () => {
    mockLoginAction.mockResolvedValue({
      success: true,
      user: { id: "u2", email: "user.eve@example.com", permissions: [] },
    });
    mockGetCurrentUserAction.mockResolvedValue(null);

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "sign in" }));

    await waitFor(() => {
      expect(screen.getByTestId("companies-count").textContent).toBe("0");
    });
  });
});
