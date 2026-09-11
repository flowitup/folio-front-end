/**
 * AcceptInviteForm — accepting an invitation with a phone number and SMS code.
 *
 * The invitee no longer chooses a password: they confirm a French phone number
 * with a texted code, and the account they get is one they can sign back into.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcceptInviteForm } from "../accept-invite-form";
import type { VerifyInviteResponse } from "@/lib/auth/types";

vi.mock("@/lib/auth/actions", () => ({
  acceptInviteAction: vi.fn(),
  requestInviteCodeAction: vi.fn(),
}));

const TRANSLATIONS: Record<string, string> = {
  title: "You're invited to join {projectName}",
  intro: "Confirm your phone number to join the project.",
  subtitle: "{inviterName} invited you as {roleName}",
  emailLabel: "Email",
  nameLabel: "Your full name",
  phoneLabel: "Phone number",
  phonePlaceholder: "06 12 34 56 78",
  phoneHint: "French numbers only, e.g. 06 12 34 56 78",
  sendCode: "Send code",
  sendingCode: "Sending code...",
  codeSentTo: "Code sent to {phone}",
  codeLabel: "Code",
  codePlaceholder: "123456",
  changeNumber: "Change number",
  resendCode: "Resend code",
  resendIn: "Resend in {seconds}s",
  submit: "Create account",
  submitting: "Creating account...",
  backToLogin: "Go to login",
  "errors.generic": "Something went wrong. Please try again.",
  "errors.expired": "This invitation has expired.",
  "errors.revoked": "This invitation was revoked.",
  "errors.accepted": "This invitation was already used.",
  "errors.notFound": "This invitation link is invalid.",
  "errors.phoneRequired": "Please enter your phone number",
  "errors.invalidPhone": "Enter a French phone number",
  "errors.phoneRegistered": "This phone number already has an account. Sign in instead.",
  "errors.codeRequired": "Please enter the 6-digit code",
  "errors.invalidCode": "Wrong or expired code",
  "errors.throttled": "Too many requests. Wait a minute and try again.",
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

Object.defineProperty(window, "location", {
  value: { href: "" },
  writable: true,
});

const { acceptInviteAction, requestInviteCodeAction } = await import("@/lib/auth/actions");
const mockAccept = vi.mocked(acceptInviteAction);
const mockRequestCode = vi.mocked(requestInviteCodeAction);

const VERIFIED: VerifyInviteResponse = {
  email: "test@example.com",
  project_name: "Folio Project",
  role_name: "Member",
  inviter_name: "Alice Admin",
  expires_at: new Date(Date.now() + 86400000).toISOString(),
};

function renderForm(token = "tok123", locale = "en", verified = VERIFIED) {
  return render(<AcceptInviteForm token={token} locale={locale} verified={verified} />);
}

/** Fill the details step and send the code, landing on the code step. */
async function reachCodeStep(user: ReturnType<typeof userEvent.setup>) {
  mockRequestCode.mockResolvedValue({ success: true });
  await user.type(screen.getByLabelText("Your full name"), "Bob Builder");
  await user.type(screen.getByLabelText("Phone number"), "0612345678");
  await user.click(screen.getByRole("button", { name: /Send code/i }));
  await waitFor(() => {
    expect(screen.getByText("Code sent to +33612345678")).toBeInTheDocument();
  });
}

describe("AcceptInviteForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = "";
  });

  describe("details step", () => {
    it("shows the invited email read-only and asks for name and phone", () => {
      renderForm();
      const email = screen.getByDisplayValue("test@example.com");
      expect(email).toHaveAttribute("readOnly");
      expect(screen.getByLabelText("Your full name")).toBeInTheDocument();
      expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    });

    it("renders no password input", () => {
      const { container } = renderForm();
      expect(container.querySelector('input[type="password"]')).toBeNull();
    });

    it("refuses a non-French number before requesting a code", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText("Your full name"), "Bob Builder");
      await user.type(screen.getByLabelText("Phone number"), "+4915112345678");
      await user.click(screen.getByRole("button", { name: /Send code/i }));

      await waitFor(() => {
        expect(screen.getByText("Enter a French phone number")).toBeInTheDocument();
      });
      expect(mockRequestCode).not.toHaveBeenCalled();
    });

    it("sends the code in E.164 and moves to the code step", async () => {
      const user = userEvent.setup();
      renderForm();
      await reachCodeStep(user);
      expect(mockRequestCode).toHaveBeenCalledWith("tok123", "+33612345678");
    });

    it("stays on the details step when the phone already has an account", async () => {
      mockRequestCode.mockResolvedValue({ success: false, error: "phone_registered" });
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText("Your full name"), "Bob Builder");
      await user.type(screen.getByLabelText("Phone number"), "0612345678");
      await user.click(screen.getByRole("button", { name: /Send code/i }));

      await waitFor(() => {
        expect(
          screen.getByText("This phone number already has an account. Sign in instead.")
        ).toBeInTheDocument();
      });
      expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    });
  });

  describe("code step", () => {
    it("accepts the invitation and lands on the dashboard", async () => {
      const user = userEvent.setup();
      renderForm();
      await reachCodeStep(user);

      mockAccept.mockResolvedValue({ success: true });
      await user.type(screen.getByLabelText("Code"), "123456");
      await user.click(screen.getByRole("button", { name: /Create account/i }));

      await waitFor(() => {
        expect(mockAccept).toHaveBeenCalledWith(
          "tok123",
          "Bob Builder",
          "+33612345678",
          "123456"
        );
      });
      await waitFor(() => expect(window.location.href).toBe("/en/dashboard"));
    });

    it("reports a wrong code and stays put", async () => {
      const user = userEvent.setup();
      renderForm();
      await reachCodeStep(user);

      mockAccept.mockResolvedValue({ success: false, error: "invalid_code" });
      await user.type(screen.getByLabelText("Code"), "000000");
      await user.click(screen.getByRole("button", { name: /Create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Wrong or expired code")).toBeInTheDocument();
      });
      expect(window.location.href).toBe("");
    });

    it("reports an invitation that was already used", async () => {
      const user = userEvent.setup();
      renderForm();
      await reachCodeStep(user);

      mockAccept.mockResolvedValue({ success: false, error: "accepted" });
      await user.type(screen.getByLabelText("Code"), "123456");
      await user.click(screen.getByRole("button", { name: /Create account/i }));

      await waitFor(() => {
        expect(screen.getByText("This invitation was already used.")).toBeInTheDocument();
      });
    });

    it("goes back to the details step via Change number", async () => {
      const user = userEvent.setup();
      renderForm();
      await reachCodeStep(user);

      await user.click(screen.getByRole("button", { name: /Change number/i }));

      expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
      expect(screen.queryByLabelText("Code")).toBeNull();
    });
  });
});
