/**
 * PhoneLoginForm — phone + SMS-code sign-in flow.
 *
 * Covers: send-code step calling requestOtpAction and moving to the code
 * step with the number shown, throttled request errors staying on step 1,
 * code submission calling loginWithPhone, invalid-code errors staying on
 * step 2, and "Change number" returning to step 1.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneLoginForm } from "../PhoneLoginForm";

const TRANSLATIONS: Record<string, string> = {
  phoneLabel: "Phone number",
  phonePlaceholder: "06 12 34 56 78",
  sendCode: "Send code",
  sendingCode: "Sending code...",
  codeSentTo: "Code sent to {phone}",
  codeLabel: "Code",
  codePlaceholder: "123456",
  verifyCode: "Sign in",
  verifyingCode: "Signing in...",
  resendCode: "Resend code",
  resendIn: "Resend in {seconds}s",
  changeNumber: "Change number",
  errorPhoneRequired: "Please enter your phone number",
  errorInvalidPhone: "Invalid phone number",
  errorCodeRequired: "Please enter the 6-digit code",
  errorInvalidCode: "Wrong or expired code",
  errorThrottled: "Too many requests. Wait a minute and try again.",
  errorSmsFailed: "The SMS could not be sent. Try again later.",
  errorPhoneLoginUnavailable: "Phone sign-in is not available on this server.",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const template = TRANSLATIONS[key] ?? key;
    if (!params) return template;
    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      template
    );
  },
}));

const mockRequestOtpAction = vi.fn();
vi.mock("@/lib/auth/otp-actions", () => ({
  requestOtpAction: (...args: unknown[]) => mockRequestOtpAction(...args),
}));

const mockLoginWithPhone = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    loginWithPhone: (...args: unknown[]) => mockLoginWithPhone(...args),
    isLoading: false,
  }),
}));

describe("PhoneLoginForm", () => {
  beforeEach(() => {
    mockRequestOtpAction.mockReset();
    mockLoginWithPhone.mockReset();
  });

  it("sends the code and moves to the code step showing the number", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    const user = userEvent.setup();
    render(<PhoneLoginForm />);

    await user.type(screen.getByLabelText("Phone number"), "0612345678");
    await user.click(screen.getByRole("button", { name: /Send code/i }));

    await waitFor(() => {
      expect(mockRequestOtpAction).toHaveBeenCalledWith("0612345678");
    });
    expect(screen.getByText("Code sent to 0612345678")).toBeInTheDocument();
    expect(screen.getByLabelText("Code")).toBeInTheDocument();
  });

  it("shows the throttled error and stays on the phone step", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: false, error: "throttled" });
    const user = userEvent.setup();
    render(<PhoneLoginForm />);

    await user.type(screen.getByLabelText("Phone number"), "0612345678");
    await user.click(screen.getByRole("button", { name: /Send code/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Too many requests. Wait a minute and try again.")
      ).toBeInTheDocument();
    });
    // Still on step 1 — phone input is present, code input is not.
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.queryByLabelText("Code")).toBeNull();
  });

  it("submits a 6-digit code via loginWithPhone(phone, code)", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    mockLoginWithPhone.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<PhoneLoginForm />);

    await user.type(screen.getByLabelText("Phone number"), "0612345678");
    await user.click(screen.getByRole("button", { name: /Send code/i }));
    await waitFor(() => expect(screen.getByLabelText("Code")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Code"), "123456");
    await user.click(screen.getByRole("button", { name: /Sign in/i }));

    await waitFor(() => {
      expect(mockLoginWithPhone).toHaveBeenCalledWith("0612345678", "123456");
    });
  });

  it("shows an invalid-code error and stays on the code step", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    mockLoginWithPhone.mockResolvedValue({ success: false, error: "invalid_code" });
    const user = userEvent.setup();
    render(<PhoneLoginForm />);

    await user.type(screen.getByLabelText("Phone number"), "0612345678");
    await user.click(screen.getByRole("button", { name: /Send code/i }));
    await waitFor(() => expect(screen.getByLabelText("Code")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Code"), "000000");
    await user.click(screen.getByRole("button", { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Wrong or expired code")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Code")).toBeInTheDocument();
  });

  it('"Change number" returns to the phone step', async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    const user = userEvent.setup();
    render(<PhoneLoginForm />);

    await user.type(screen.getByLabelText("Phone number"), "0612345678");
    await user.click(screen.getByRole("button", { name: /Send code/i }));
    await waitFor(() => expect(screen.getByLabelText("Code")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Change number/i }));

    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.queryByLabelText("Code")).toBeNull();
  });
});
