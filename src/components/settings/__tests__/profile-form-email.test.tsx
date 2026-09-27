/** Phone-only accounts carry a synthetic address: the profile must not show it as an e-mail. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { User } from "@/lib/auth/types";

let mockUser: User;
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: mockUser, updateUser: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/[locale]/(app)/settings/_actions/profile-actions", () => ({
  updateProfileAction: vi.fn(),
  requestPhoneChangeCodeAction: vi.fn(),
  confirmPhoneChangeAction: vi.fn(),
}));

import { ProfileForm } from "../profile-form";

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProfileForm />
    </NextIntlClientProvider>
  );
}

describe("ProfileForm", () => {
  it("hides the synthetic address of a phone-only account", () => {
    mockUser = {
      id: "u1",
      email: "phone-33699271001@no-email.folio.flowitup.com",
      phone: "+33699271001",
      display_name: "",
      permissions: [],
    };
    renderForm();
    expect(document.body.textContent).not.toContain("no-email");
    expect(screen.queryByLabelText(en.settings.email)).toBeNull();
    expect(screen.queryByText(en.settings.emailReadOnlyHint)).toBeNull();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("+336 99 27 10 01");
  });

  it("shows a real e-mail read-only", () => {
    mockUser = { id: "u2", email: "dave@example.com", display_name: "Dave", permissions: [] };
    renderForm();
    expect(screen.getByLabelText(en.settings.email)).toHaveValue("dave@example.com");
  });
});
