/**
 * Regression test: login-screen dead-button cleanup.
 *
 * Asserts the "Forgot?" anchor (preventDefault → no reset BE) and the
 * "Continue with Google" button (no OAuth flow) are gone, so they can't
 * regress as silently-dead UI.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginStage } from "../LoginStage";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string) => key;
    return Object.assign(translate, { rich: (key: string) => key });
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithPhone: vi.fn(),
    isLoading: false,
  }),
}));

describe("Login screen — dead triggers removed", () => {
  it("does not render Forgot password link", () => {
    render(<LoginStage loginMode="email" />);
    expect(screen.queryByText("forgot")).toBeNull();
  });

  it("does not render Continue with Google button", () => {
    render(<LoginStage loginMode="email" />);
    expect(screen.queryByRole("button", { name: /continueWithGoogle/i })).toBeNull();
  });

  it("still renders the real Sign in submit button", () => {
    render(<LoginStage loginMode="email" />);
    expect(screen.getByRole("button", { name: /signIn/i })).toBeInTheDocument();
  });
});
