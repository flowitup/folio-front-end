/**
 * Phone + SMS-code sign-in, mounted through LoginStage because the flow it
 * drives is shared by the copy column and the paper card.
 *
 * Covers: normalising the typed number into E.164, refusing a number from
 * another country before a code is ever requested, request errors staying on
 * step 1, the six boxes auto-submitting on the sixth digit, a rejected code
 * keeping the digits, the resend countdown gating a second request, and
 * "Change number" returning to step 1.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginStage } from "../LoginStage";

const TRANSLATIONS: Record<string, string> = {
  phoneLabel: "Phone number",
  phonePlaceholder: "6 12 34 56 78",
  phoneHint: "French numbers only — without the leading 0. A 6-digit code by SMS.",
  sendCode: "Send code",
  sendingCode: "Sending code...",
  codeSentTo: "Code sent to <mono>{phone}</mono>.",
  codeLabel: "SMS code",
  codeDigit: "Digit {position} of {total}",
  codeExpires: "Expires in {minutes} minutes",
  verifyCode: "Sign in",
  verifyingCode: "Signing in...",
  verified: "Verified",
  resendCode: "Resend code",
  resendIn: "Resend in {seconds} s",
  changeNumber: "Change number",
  stepBadge: "Step {current} / {total}",
  errorPhoneRequired: "Please enter your phone number",
  errorInvalidPhone: "Enter a French phone number",
  errorCodeRequired: "Please enter the 6-digit code",
  errorInvalidCode: "Wrong or expired code",
  errorThrottled: "Too many requests. Wait a minute and try again.",
  errorSmsFailed: "The SMS could not be sent. Try again later.",
  errorPhoneLoginUnavailable: "Phone sign-in is not available on this server.",
};

function fill(key: string, params?: Record<string, unknown>): string {
  const template = TRANSLATIONS[key] ?? key;
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [name, value]) => acc.replace(`{${name}}`, String(value)),
    template
  );
}

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string, params?: Record<string, unknown>) => fill(key, params);
    // `t.rich` renders tag markers as components; the plain text it wraps is
    // what the assertions need, so the mock just strips the markers.
    return Object.assign(translate, {
      rich: (key: string, params?: Record<string, unknown>) =>
        fill(key, params).replace(/<\/?[a-z]+>/g, ""),
    });
  },
}));

const mockRequestOtpAction = vi.fn();
vi.mock("@/lib/auth/otp-actions", () => ({
  requestOtpAction: (...args: unknown[]) => mockRequestOtpAction(...args),
}));

const mockLoginWithPhone = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithPhone: (...args: unknown[]) => mockLoginWithPhone(...args),
    isLoading: false,
  }),
}));

/** Types `digits` across the six boxes the way a person does, one per box. */
async function typeCode(user: ReturnType<typeof userEvent.setup>, digits: string) {
  for (const [index, digit] of [...digits].entries()) {
    await user.type(screen.getByTestId(`login-code-${index}`), digit);
  }
}

async function sendCodeTo(user: ReturnType<typeof userEvent.setup>, national: string) {
  await user.type(screen.getByLabelText("Phone number"), national);
  await user.click(screen.getByTestId("login-send-code"));
  await waitFor(() => expect(screen.getByTestId("login-code-0")).toBeInTheDocument());
}

describe("Phone sign-in", () => {
  beforeEach(() => {
    mockRequestOtpAction.mockReset();
    mockLoginWithPhone.mockReset();
  });

  it("normalises the typed number and moves to the code step", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    const user = userEvent.setup();
    render(<LoginStage loginMode="phone" />);

    // Typed as the French write it; the +33 the field states replaces the 0.
    await sendCodeTo(user, "0612345678");

    expect(mockRequestOtpAction).toHaveBeenCalledWith("+33612345678");
    expect(screen.getByText("Code sent to +33612345678.")).toBeInTheDocument();
  });

  it("states the dial code the number is read with", () => {
    render(<LoginStage loginMode="phone" />);

    expect(screen.getByTestId("login-country")).toHaveTextContent("FR");
    expect(screen.getByTestId("login-country")).toHaveTextContent("+33");
  });

  it("tells the user up front that only French numbers work", () => {
    render(<LoginStage loginMode="phone" />);

    expect(
      screen.getByText("French numbers only — without the leading 0. A 6-digit code by SMS.")
    ).toBeInTheDocument();
  });

  it("refuses a number from another country without asking for a code", async () => {
    const user = userEvent.setup();
    render(<LoginStage loginMode="phone" />);

    await user.type(screen.getByLabelText("Phone number"), "+84912345678");

    // Nothing to send: the button never enables for a non-French number.
    expect(screen.getByTestId("login-send-code")).toBeDisabled();
    expect(mockRequestOtpAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId("login-code-0")).toBeNull();
  });

  it("refuses a number that is too short to be French", async () => {
    const user = userEvent.setup();
    render(<LoginStage loginMode="phone" />);

    await user.type(screen.getByLabelText("Phone number"), "0612");

    expect(screen.getByTestId("login-send-code")).toBeDisabled();
    expect(mockRequestOtpAction).not.toHaveBeenCalled();
  });

  it("shows the throttled error and stays on the phone step", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: false, error: "throttled" });
    const user = userEvent.setup();
    render(<LoginStage loginMode="phone" />);

    await user.type(screen.getByLabelText("Phone number"), "0612345678");
    await user.click(screen.getByTestId("login-send-code"));

    await waitFor(() => {
      expect(
        screen.getByText("Too many requests. Wait a minute and try again.")
      ).toBeInTheDocument();
    });
    // Still on step 1 — phone input is present, the code boxes are not.
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.queryByTestId("login-code-0")).toBeNull();
  });

  it("signs in on its own once the sixth digit is typed", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    mockLoginWithPhone.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<LoginStage loginMode="phone" />);

    await sendCodeTo(user, "0612345678");
    await typeCode(user, "123456");

    await waitFor(() => {
      expect(mockLoginWithPhone).toHaveBeenCalledWith("+33612345678", "123456");
    });
    expect(await screen.findByTestId("login-verified")).toBeInTheDocument();
  });

  it("spreads a pasted code across the boxes", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    mockLoginWithPhone.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<LoginStage loginMode="phone" />);

    await sendCodeTo(user, "0612345678");
    await user.click(screen.getByTestId("login-code-0"));
    await user.paste("482917");

    await waitFor(() => {
      expect(mockLoginWithPhone).toHaveBeenCalledWith("+33612345678", "482917");
    });
    expect(screen.getByTestId("login-code-5")).toHaveValue("7");
  });

  it("keeps the digits when the code is rejected", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    mockLoginWithPhone.mockResolvedValue({ success: false, error: "invalid_code" });
    const user = userEvent.setup();
    render(<LoginStage loginMode="phone" />);

    await sendCodeTo(user, "0612345678");
    await typeCode(user, "000000");

    await waitFor(() => {
      expect(screen.getByText("Wrong or expired code")).toBeInTheDocument();
    });
    expect(screen.getByTestId("login-code-0")).toHaveValue("0");
    expect(screen.getByTestId("login-code-5")).toHaveValue("0");
  });

  it("gates a second request behind the resend countdown", async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    const user = userEvent.setup();
    render(<LoginStage loginMode="phone" />);

    await sendCodeTo(user, "0612345678");

    const resend = screen.getByTestId("login-resend");
    expect(resend).toBeDisabled();
    expect(resend).toHaveTextContent("Resend in 60 s");
    expect(mockRequestOtpAction).toHaveBeenCalledTimes(1);
  });

  it('"Change number" returns to the phone step, keeping the number', async () => {
    mockRequestOtpAction.mockResolvedValue({ success: true, expiresIn: 300 });
    const user = userEvent.setup();
    render(<LoginStage loginMode="phone" />);

    await sendCodeTo(user, "0612345678");
    await user.click(screen.getByTestId("login-change-number"));

    expect(screen.getByLabelText("Phone number")).toHaveValue("0612345678");
    expect(screen.queryByTestId("login-code-0")).toBeNull();
  });
});
