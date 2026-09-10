/**
 * profile-form.test.tsx
 *
 * Covers: initial values from useAuth(), trimmed submit payload, success
 * toast + router.refresh(), and the phone_taken error toast.
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
  const makeT = (ns: string) => (key: string) => {
    const val = resolve(en, `${ns}.${key}`);
    return typeof val === "string" ? val : key;
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
}));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import { updateProfileAction } from "@/app/[locale]/(app)/settings/_actions/profile-actions";
const mockUpdate = vi.mocked(updateProfileAction);

const BASE_USER = {
  id: "user-1",
  email: "alice@example.com",
  display_name: "Alice",
  phone: "+33612345678",
  permissions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: BASE_USER });
});

// ---------------------------------------------------------------------------
// Initial values
// ---------------------------------------------------------------------------

describe("ProfileForm — initial values", () => {
  it("hydrates fields from useAuth().user", () => {
    render(<ProfileForm />);
    expect(screen.getByLabelText("Display name")).toHaveValue("Alice");
    expect(screen.getByLabelText("Phone")).toHaveValue("+33612345678");
    expect(screen.getByLabelText("Email")).toHaveValue("alice@example.com");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
  });

  it("shows display_name ?? email as the card title", () => {
    render(<ProfileForm />);
    expect(screen.getByText("Alice")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

describe("ProfileForm — submit", () => {
  it("calls updateProfileAction with trimmed values", async () => {
    mockUpdate.mockResolvedValueOnce({ success: true, user: BASE_USER });
    render(<ProfileForm />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "  Alice Dupont  " },
    });
    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: "  0612345678  " },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        display_name: "Alice Dupont",
        phone: "0612345678",
      });
    });
  });

  it("shows the success toast and refreshes the router on success", async () => {
    mockUpdate.mockResolvedValueOnce({ success: true, user: BASE_USER });
    const { toast } = await import("sonner");
    render(<ProfileForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Profile saved");
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  it("shows the phone-taken error toast without refreshing", async () => {
    mockUpdate.mockResolvedValueOnce({ success: false, error: "phone_taken" });
    const { toast } = await import("sonner");
    render(<ProfileForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "This phone number is already used by another account"
      );
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("shows the invalid-phone error toast", async () => {
    mockUpdate.mockResolvedValueOnce({ success: false, error: "invalid_phone" });
    const { toast } = await import("sonner");
    render(<ProfileForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid phone number");
    });
  });
});
