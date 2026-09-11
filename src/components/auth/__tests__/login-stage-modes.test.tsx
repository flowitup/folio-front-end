/**
 * LoginStage — loginMode switching.
 *
 * "email" renders only the email form, "phone" renders only the phone form,
 * and "both" renders the phone form first with a toggle that swaps to the
 * email form (and back) without losing either form's markup/ids. Mounted
 * through LoginStage because it owns the view the toggle changes.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/lib/auth/otp-actions", () => ({
  requestOtpAction: vi.fn(),
}));

describe("LoginStage — loginMode", () => {
  it('renders only the phone form for loginMode="phone"', () => {
    render(<LoginStage loginMode="phone" />);
    expect(screen.getByLabelText("phoneLabel")).toBeInTheDocument();
    expect(document.querySelector("#email")).toBeNull();
  });

  it('renders only the email form for loginMode="email"', () => {
    render(<LoginStage loginMode="email" />);
    expect(document.querySelector("#email")).not.toBeNull();
    expect(document.querySelector("#phone")).toBeNull();
  });

  it('renders phone first for loginMode="both", and the toggle swaps to email and back', async () => {
    const user = userEvent.setup();
    render(<LoginStage loginMode="both" />);

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

  it("drops the phone step strip while the email form is in view", async () => {
    const user = userEvent.setup();
    render(<LoginStage loginMode="both" />);

    expect(screen.getByText("stepEnterCode")).toBeInTheDocument();

    await user.click(screen.getByTestId("login-use-email"));

    expect(screen.queryByText("stepEnterCode")).toBeNull();
  });
});
