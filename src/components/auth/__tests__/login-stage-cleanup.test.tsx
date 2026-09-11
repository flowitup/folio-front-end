/**
 * Regression test: no email/password credential UI on the sign-in screen.
 *
 * Email and password sign-in was removed entirely — the backend has no
 * /auth/login endpoint any more. This guards the UI half: the sign-in screen
 * must never render an email field, a password field, or a toggle offering to
 * sign in with email, whatever the backend replies.
 *
 * It also keeps the older dead-trigger guard (a "Forgot?" anchor and a
 * "Continue with Google" button that never did anything) from regressing.
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
    loginWithPhone: vi.fn(),
    isLoading: false,
  }),
}));

describe("Login screen — email credentials removed", () => {
  it("renders no email input", () => {
    const { container } = render(<LoginStage />);
    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(container.querySelector("#email")).toBeNull();
  });

  it("renders no password input", () => {
    const { container } = render(<LoginStage />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector("#password")).toBeNull();
  });

  it("offers no way to switch to email sign-in", () => {
    render(<LoginStage />);
    expect(screen.queryByTestId("login-use-email")).toBeNull();
    expect(screen.queryByText(/useEmailInstead/i)).toBeNull();
  });

  it("does not render Forgot password link", () => {
    render(<LoginStage />);
    expect(screen.queryByText("forgot")).toBeNull();
  });

  it("does not render Continue with Google button", () => {
    render(<LoginStage />);
    expect(screen.queryByRole("button", { name: /continueWithGoogle/i })).toBeNull();
  });
});
