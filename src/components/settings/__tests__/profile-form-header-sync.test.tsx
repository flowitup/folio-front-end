/**
 * After a profile save the header (and every other reader of the auth
 * context) shows the new name without a reload.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { AuthProvider } from "@/context/AuthContext";
import type { User } from "@/lib/auth/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/en/settings",
}));
vi.mock("@/lib/auth/actions", () => ({ logout: vi.fn(), getCurrentUserAction: vi.fn() }));
vi.mock("@/lib/auth/otp-actions", () => ({ verifyOtpAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }));
vi.mock("@/app/[locale]/(app)/settings/_actions/profile-actions", () => ({ updateProfileAction: mockUpdate }));

import { ProfileForm } from "../profile-form";

const USER = { id: "u1", email: "one@example.com", display_name: "QA-auth User One", phone: null, permissions: [] } as unknown as User;

describe("ProfileForm header after save", () => {
  it("shows the saved display name at once", async () => {
    mockUpdate.mockResolvedValue({ success: true, user: { ...USER, display_name: "Renamed" } });
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AuthProvider initialUser={USER}>
          <ProfileForm />
        </AuthProvider>
      </NextIntlClientProvider>
    );
    expect(screen.getByRole("heading", { name: "QA-auth User One" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(en.settings.displayName), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: en.settings.save }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Renamed" })).toBeInTheDocument());
  });
});
