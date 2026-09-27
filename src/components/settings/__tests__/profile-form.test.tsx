/**
 * profile-form.test.tsx
 *
 * Covers: initial values from useAuth(), the read-only sign-in phone with its
 * "Change number" dialog, trimmed submit payload (display name only), success
 * toast + router.refresh(), and the save-failed toast.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ProfileForm } from "@/components/settings/profile-form";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return (path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string) ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const val = resolve(en, `${ns}.${key}`);
    if (typeof val !== "string") return key;
    return val.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? `{${name}}`));
  };
  return { useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/app/[locale]/(app)/settings/_actions/profile-actions", () => ({
  updateProfileAction: vi.fn(),
  requestPhoneChangeCodeAction: vi.fn(),
  confirmPhoneChangeAction: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import {
  confirmPhoneChangeAction,
  requestPhoneChangeCodeAction,
  updateProfileAction,
} from "@/app/[locale]/(app)/settings/_actions/profile-actions";
const mockUpdate = vi.mocked(updateProfileAction);
const mockRequestCode = vi.mocked(requestPhoneChangeCodeAction);
const mockConfirm = vi.mocked(confirmPhoneChangeAction);

const BASE_USER = {
  id: "user-1",
  email: "alice@example.com",
  display_name: "Alice",
  phone: "+33612345678",
  permissions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: BASE_USER, updateUser: vi.fn() });
});

// ---------------------------------------------------------------------------
// Initial values
// ---------------------------------------------------------------------------

describe("ProfileForm — initial values", () => {
  it("hydrates fields from useAuth().user", () => {
    render(<ProfileForm />);
    expect(screen.getByLabelText("Display name")).toHaveValue("Alice");
    expect(screen.getByLabelText("Phone")).toHaveValue("+336 12 34 56 78");
    expect(screen.getByLabelText("Email")).toHaveValue("alice@example.com");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
  });

  it("shows display_name ?? email as the card title", () => {
    render(<ProfileForm />);
    expect(screen.getByText("Alice")).toBeDefined();
  });

  it("keeps the sign-in phone read-only", () => {
    render(<ProfileForm />);
    expect(screen.getByLabelText("Phone")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Change number" })).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

describe("ProfileForm — submit", () => {
  it("saves the trimmed display name and never sends the phone", async () => {
    mockUpdate.mockResolvedValueOnce({ success: true, user: BASE_USER });
    render(<ProfileForm />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "  Alice Dupont  " },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ display_name: "Alice Dupont" });
    });
  });

  it("shows the success toast and refreshes the router on success", async () => {
    mockUpdate.mockResolvedValueOnce({ success: true, user: BASE_USER });
    const { toast } = await import("sonner");
    render(<ProfileForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Profile saved");
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  it("shows the save-failed toast without refreshing", async () => {
    mockUpdate.mockResolvedValueOnce({ success: false, error: "unknown" });
    const { toast } = await import("sonner");
    render(<ProfileForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't save your profile. Please try again.");
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Change number
// ---------------------------------------------------------------------------

describe("ProfileForm — change number", () => {
  it("sends a code to the new number, confirms it and shows the new phone", async () => {
    mockRequestCode.mockResolvedValueOnce({ success: true, expiresIn: 300 });
    mockConfirm.mockResolvedValueOnce({
      success: true,
      user: { ...BASE_USER, phone: "+33698765432" },
    });
    const { toast } = await import("sonner");
    render(<ProfileForm />);

    fireEvent.click(screen.getByRole("button", { name: "Change number" }));
    fireEvent.change(screen.getByTestId("change-phone-phone"), {
      target: { value: "6 98 76 54 32" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("change-phone-send"));
    });
    expect(mockRequestCode).toHaveBeenCalledWith("+33698765432");
    expect(screen.getByText("Enter the code sent to +336 98 76 54 32.")).toBeDefined();

    // Pasting the texted code fills the row and submits it.
    await act(async () => {
      fireEvent.paste(screen.getByTestId("change-phone-code-0"), {
        clipboardData: { getData: () => "123456" },
      });
    });

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith("+33698765432", "123456");
      expect(toast.success).toHaveBeenCalledWith(
        "Phone number changed. Your other devices have been signed out; sign in with your new number from now on."
      );
      expect(mockRefresh).toHaveBeenCalledOnce();
      expect(screen.getByLabelText("Phone")).toHaveValue("+336 98 76 54 32");
    });
  });

  it("explains a number taken by another account and stays on the first step", async () => {
    mockRequestCode.mockResolvedValueOnce({ success: false, error: "phone_taken" });
    render(<ProfileForm />);

    fireEvent.click(screen.getByRole("button", { name: "Change number" }));
    fireEvent.change(screen.getByTestId("change-phone-phone"), {
      target: { value: "0698765432" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("change-phone-send"));
    });

    expect(screen.getByTestId("change-phone-error")).toHaveTextContent(
      "This phone number is already used by another account."
    );
    expect(screen.getByTestId("change-phone-phone")).toBeDefined();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("keeps the dialog open on a wrong code and does not resubmit it unchanged", async () => {
    mockRequestCode.mockResolvedValueOnce({ success: true, expiresIn: 300 });
    mockConfirm.mockResolvedValueOnce({ success: false, error: "invalid_code" });
    render(<ProfileForm />);

    fireEvent.click(screen.getByRole("button", { name: "Change number" }));
    fireEvent.change(screen.getByTestId("change-phone-phone"), {
      target: { value: "0698765432" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("change-phone-send"));
    });
    await act(async () => {
      fireEvent.paste(screen.getByTestId("change-phone-code-0"), {
        clipboardData: { getData: () => "000000" },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("change-phone-error")).toHaveTextContent("Wrong or expired code");
    });
    expect(screen.getByTestId("change-phone-confirm")).toBeDisabled();
    expect(screen.getByLabelText("Phone")).toHaveValue("+336 12 34 56 78");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("refuses a foreign number before asking the server", () => {
    render(<ProfileForm />);
    fireEvent.click(screen.getByRole("button", { name: "Change number" }));
    fireEvent.change(screen.getByTestId("change-phone-phone"), {
      target: { value: "+84912345678" },
    });
    expect(screen.getByTestId("change-phone-send")).toBeDisabled();
    expect(mockRequestCode).not.toHaveBeenCalled();
  });
});
