/**
 * P-04 / TW-14: accounts are only created in the mobile app, and the backend answers a code
 * request for a number without one exactly as for any other (it never says which). A person a
 * company added by phone used to wait on this page for an SMS that never came. Both steps now
 * say where accounts come from — to everyone, so nothing is given away (D6).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginStage } from "../LoginStage";

const TRANSLATIONS: Record<string, string> = {
  phoneLabel: "Phone number",
  phonePlaceholder: "6 12 34 56 78",
  phoneHint: "French numbers only, with or without the leading 0. A 6-digit code by SMS.",
  sendCode: "Send code",
  sendingCode: "Sending code...",
  codeSentTo: "Code sent to <mono>{phone}</mono>.",
  codeLabel: "SMS code",
  codeDigit: "Digit {position} of {total}",
  codeExpires: "Expires in {minutes} minutes",
  codeExpired: "Code expired — ask for a new one",
  verifyCode: "Sign in",
  verifyingCode: "Signing in...",
  verified: "Verified",
  resendCode: "Resend code",
  resendIn: "Resend in {seconds} s",
  codeAlreadySent: "A code was already sent to this number — enter it, or get a new one in {seconds} s.",
  changeNumber: "Change number",
  stepBadge: "Step {current} / {total}",
  errorPhoneRequired: "Please enter your phone number",
  errorInvalidPhone: "Enter a French phone number",
  errorCodeRequired: "Please enter the 6-digit code",
  errorInvalidCode: "Wrong or expired code",
  errorThrottled: "Too many requests. Wait a minute and try again.",
  errorHourlyLimit: "Too many codes were requested for this number. Try again in {minutes} minutes.",
  errorSmsFailed: "The SMS could not be sent. Try again later.",
  errorPhoneLoginUnavailable: "Phone sign-in is not available on this server.",
  errorCodeLocked: "Too many tries: this code no longer works. Ask for a new code.",
  codeRecentlySent: "A code was sent to this number less than a minute ago: type it below.",
  codeHelp: "No SMS? Only Folio accounts receive a code.",
  noAccountUseMobileApp: "No account yet? Accounts are created in the Folio mobile app.",
  installMobileApp: "Get the Folio app",
  codeRefusedNoAccount: "This number may not have an account yet: create one in the Folio mobile app first, then sign in here again.",
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
  useLocale: () => "en",
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

// The language control needs the locale router; it has its own tests.
vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => null,
}));
vi.mock("@/components/legal-links", () => ({
  LegalLinks: () => <nav data-testid="legal-links" />,
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

describe("a number without an account is not left waiting (D6)", () => {
  beforeEach(() => {
    mockRequestOtpAction.mockReset().mockResolvedValue({ success: true, expiresIn: 300 });
    mockLoginWithPhone.mockReset();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("says on the phone step where accounts are created", () => {
    render(<LoginStage />);

    expect(screen.getByTestId("login-no-account")).toHaveTextContent(
      "No account yet? Accounts are created in the Folio mobile app."
    );
    // No install page configured: the app is named, with no link to nowhere.
    expect(screen.queryByTestId("login-install-app")).toBeNull();
  });

  it("links the mobile app's install page when the deployment has one", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_INSTALL_URL", "https://example.test/folio");
    render(<LoginStage />);

    expect(screen.getByTestId("login-install-app")).toHaveAttribute("href", "https://example.test/folio");
  });

  it("adds the hint under a refused code, and not before", async () => {
    mockLoginWithPhone.mockResolvedValue({ success: false, error: "invalid_code" });
    const user = userEvent.setup();
    render(<LoginStage />);
    await sendCodeTo(user, "611111191");
    expect(screen.queryByTestId("login-no-account-hint")).toBeNull();
    expect(screen.queryByTestId("login-no-account")).toBeNull();

    await typeCode(user, "123456");

    expect(await screen.findByTestId("login-no-account-hint")).toHaveTextContent(
      "This number may not have an account yet: create one in the Folio mobile app first, then sign in here again."
    );
  });

  it("leaves a successful sign-in as it was", async () => {
    mockLoginWithPhone.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<LoginStage />);
    await sendCodeTo(user, "612345678");

    await typeCode(user, "424242");

    await waitFor(() => expect(screen.getByTestId("login-verified")).toBeInTheDocument());
    expect(screen.queryByTestId("login-no-account-hint")).toBeNull();
  });
});
