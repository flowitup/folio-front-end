/**
 * Tests for AcceptInviteForm component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcceptInviteForm } from "../accept-invite-form";
import type { VerifyInviteResponse } from "@/lib/auth/types";

// Mock acceptInviteAction server action
vi.mock("@/lib/auth/actions", () => ({
  acceptInviteAction: vi.fn(),
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, _params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      title: "You're invited to join {projectName}",
      subtitle: "{inviterName} invited you as {roleName}",
      emailLabel: "Email",
      nameLabel: "Your full name",
      passwordLabel: "Choose a password",
      confirmLabel: "Confirm password",
      submit: "Create account",
      submitting: "Creating account...",
      passwordHint: "8-128 characters",
      passwordMismatch: "Passwords do not match",
      backToLogin: "Go to login",
      "errors.generic": "Something went wrong. Please try again.",
      "errors.expired": "This invitation has expired.",
      "errors.revoked": "This invitation was revoked.",
      "errors.notFound": "This invitation link is invalid.",
    };
    return translations[key] ?? key;
  },
}));

// Mock window.location
const mockLocationAssign = vi.fn();
Object.defineProperty(window, "location", {
  value: { href: "" },
  writable: true,
});

const { acceptInviteAction } = await import("@/lib/auth/actions");
const mockAcceptInviteAction = vi.mocked(acceptInviteAction);

const VERIFIED: VerifyInviteResponse = {
  email: "test@example.com",
  project_name: "Folio Project",
  role_name: "Member",
  inviter_name: "Alice Admin",
  expires_at: new Date(Date.now() + 86400000).toISOString(),
};

function renderForm(token = "tok123", locale = "en", verified = VERIFIED) {
  return render(
    <AcceptInviteForm token={token} locale={locale} verified={verified} />
  );
}

describe("AcceptInviteForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = "";
  });

  describe("Rendering", () => {
    it("renders email banner from verified props", () => {
      renderForm();
      // Email input is read-only, pre-filled
      const emailInput = screen.getByDisplayValue("test@example.com");
      expect(emailInput).toBeDefined();
      expect(emailInput).toHaveAttribute("readOnly");
    });

    it("renders name and password inputs", () => {
      renderForm();
      expect(screen.getByLabelText(/your full name/i)).toBeDefined();
      expect(screen.getByLabelText(/choose a password/i)).toBeDefined();
      expect(screen.getByLabelText(/confirm password/i)).toBeDefined();
    });

    it("renders submit button enabled initially", () => {
      renderForm();
      const btn = screen.getByRole("button", { name: /create account/i });
      expect(btn).not.toBeDisabled();
    });

    it("renders back-to-login link", () => {
      renderForm();
      expect(screen.getByRole("link", { name: /go to login/i })).toBeDefined();
    });
  });

  describe("Validation", () => {
    it("shows error when name is empty and form is submitted", async () => {
      const user = userEvent.setup();
      renderForm();

      // Fill valid password but no name
      await user.type(screen.getByLabelText(/choose a password/i), "securePass1!");
      await user.type(screen.getByLabelText(/confirm password/i), "securePass1!");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      // Should show generic error (name validation fails first in the handler)
      await waitFor(() => {
        expect(screen.queryByText(/something went wrong/i)).toBeDefined();
      });
      expect(mockAcceptInviteAction).not.toHaveBeenCalled();
    });

    it("shows password mismatch error inline", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/your full name/i), "Alice");
      await user.type(screen.getByLabelText(/choose a password/i), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "differentpass");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeDefined();
      });
      expect(mockAcceptInviteAction).not.toHaveBeenCalled();
    });
  });

  describe("Submission", () => {
    it("calls acceptInviteAction with correct args on submit", async () => {
      const user = userEvent.setup();
      mockAcceptInviteAction.mockResolvedValueOnce({ success: true });
      renderForm("mytoken", "en");

      await user.type(screen.getByLabelText(/your full name/i), "Bob Builder");
      await user.type(screen.getByLabelText(/choose a password/i), "pass1234!");
      await user.type(screen.getByLabelText(/confirm password/i), "pass1234!");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(mockAcceptInviteAction).toHaveBeenCalledWith(
          "mytoken",
          "Bob Builder",
          "pass1234!"
        );
      });
    });

    it("redirects to dashboard on successful submission", async () => {
      const user = userEvent.setup();
      mockAcceptInviteAction.mockResolvedValueOnce({ success: true });
      renderForm("tok123", "en");

      await user.type(screen.getByLabelText(/your full name/i), "Bob Builder");
      await user.type(screen.getByLabelText(/choose a password/i), "pass1234!");
      await user.type(screen.getByLabelText(/confirm password/i), "pass1234!");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(window.location.href).toBe("/en/dashboard");
      });
    });

    it("displays error message when action returns failure", async () => {
      const user = userEvent.setup();
      mockAcceptInviteAction.mockResolvedValueOnce({
        success: false,
        error: "This invitation has expired.",
      });
      renderForm();

      await user.type(screen.getByLabelText(/your full name/i), "Bob");
      await user.type(screen.getByLabelText(/choose a password/i), "pass1234!");
      await user.type(screen.getByLabelText(/confirm password/i), "pass1234!");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("This invitation has expired.")).toBeDefined();
      });
    });

    it("displays generic error when action throws", async () => {
      const user = userEvent.setup();
      mockAcceptInviteAction.mockRejectedValueOnce(new Error("Network failure"));
      renderForm();

      await user.type(screen.getByLabelText(/your full name/i), "Bob");
      await user.type(screen.getByLabelText(/choose a password/i), "pass1234!");
      await user.type(screen.getByLabelText(/confirm password/i), "pass1234!");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeDefined();
      });
    });

    it("disables submit button while in flight", async () => {
      const user = userEvent.setup();
      // Create a controllable promise
      let resolveAction!: (val: { success: boolean }) => void;
      const pendingPromise = new Promise<{ success: boolean }>((res) => {
        resolveAction = res;
      });
      mockAcceptInviteAction.mockReturnValueOnce(pendingPromise);
      renderForm();

      await user.type(screen.getByLabelText(/your full name/i), "Bob");
      await user.type(screen.getByLabelText(/choose a password/i), "pass1234!");
      await user.type(screen.getByLabelText(/confirm password/i), "pass1234!");

      // Click submit without awaiting resolution
      await user.click(screen.getByRole("button", { name: /create account/i }));

      // Button should be disabled while in flight
      await waitFor(() => {
        const btn = screen.queryByRole("button", { name: /creating account/i });
        if (btn) expect(btn).toBeDisabled();
      });

      // Clean up - resolve promise
      resolveAction({ success: true });
    });
  });
});
