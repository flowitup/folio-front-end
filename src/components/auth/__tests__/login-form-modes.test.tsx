/**
 * LoginForm — loginMode switching.
 *
 * "email" renders only the email form, "phone" renders only the phone form,
 * and "both" renders the phone form first with a toggle that swaps to the
 * email form (and back) without losing either form's markup/ids.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/lib/auth/otp-actions", () => ({
  requestOtpAction: vi.fn(),
}));

describe("LoginForm — loginMode", () => {
  it('renders only the phone form for loginMode="phone"', () => {
    render(<LoginForm loginMode="phone" />);
    expect(screen.getByLabelText("phoneLabel")).toBeInTheDocument();
    expect(document.querySelector("#email")).toBeNull();
  });

  it('renders only the email form for loginMode="email"', () => {
    render(<LoginForm loginMode="email" />);
    expect(document.querySelector("#email")).not.toBeNull();
    expect(document.querySelector("#phone")).toBeNull();
  });

  it('renders phone first for loginMode="both", and the toggle swaps to email and back', async () => {
    const user = userEvent.setup();
    render(<LoginForm loginMode="both" />);

    // Phone form first.
    expect(document.querySelector("#phone")).not.toBeNull();
    expect(document.querySelector("#email")).toBeNull();

    await user.click(screen.getByTestId("login-use-email"));

    expect(document.querySelector("#email")).not.toBeNull();
    expect(document.querySelector("#phone")).toBeNull();

    await user.click(screen.getByTestId("login-use-phone"));

    expect(document.querySelector("#phone")).not.toBeNull();
    expect(document.querySelector("#email")).toBeNull();
  });
});
