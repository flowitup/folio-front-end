/**
 * Regression test: LoginForm dead-button cleanup.
 *
 * Asserts the "Forgot?" anchor (preventDefault → no reset BE) and the
 * "Continue with Google" button (no OAuth flow) are gone, so they can't
 * regress as silently-dead UI.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "../LoginForm";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithPhone: vi.fn(),
    isLoading: false,
  }),
}));

describe("LoginForm — dead triggers removed", () => {
  it("does not render Forgot password link", () => {
    render(<LoginForm loginMode="email" />);
    expect(screen.queryByText("forgot")).toBeNull();
  });

  it("does not render Continue with Google button", () => {
    render(<LoginForm loginMode="email" />);
    expect(screen.queryByRole("button", { name: /continueWithGoogle/i })).toBeNull();
  });

  it("still renders the real Sign in submit button", () => {
    render(<LoginForm loginMode="email" />);
    expect(screen.getByRole("button", { name: /signIn/i })).toBeInTheDocument();
  });
});
