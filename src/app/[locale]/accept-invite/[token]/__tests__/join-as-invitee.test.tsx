/**
 * JoinAsInvitee — the signed-in account is the one the invitation was sent to,
 * so it joins from its session (no sign-out, no phone step).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinAsInvitee } from "../join-as-invitee";

vi.mock("@/lib/auth/actions", () => ({
  acceptInviteAsMeAction: vi.fn(),
  acceptInviteAction: vi.fn(),
  requestInviteCodeAction: vi.fn(),
}));

const TRANSLATIONS: Record<string, string> = {
  "joinAsMe.title": "Join {projectName}",
  "joinAsMe.body": "You're signed in as {currentUser}, the account this invitation was sent to.",
  "joinAsMe.submit": "Join the project",
  "joinAsMe.submitting": "Joining…",
  "errors.generic": "Something went wrong. Please try again.",
  "errors.expired": "This invitation has expired.",
  "errors.wrongAccount": "This invitation was sent to another email address.",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const template = TRANSLATIONS[key] ?? key;
    return Object.entries(params ?? {}).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), template);
  },
}));

Object.defineProperty(window, "location", { value: { href: "" }, writable: true });

const { acceptInviteAsMeAction } = await import("@/lib/auth/actions");
const mockJoin = vi.mocked(acceptInviteAsMeAction);

function renderJoin() {
  return render(
    <JoinAsInvitee token="tok-2" locale="fr" projectName="1 rue Principale, Paris" currentUser="Invité Six" />
  );
}

describe("JoinAsInvitee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = "";
  });

  it("names the project and the signed-in account", () => {
    renderJoin();
    expect(screen.getByRole("heading", { name: "Join 1 rue Principale, Paris" })).toBeInTheDocument();
    expect(
      screen.getByText("You're signed in as Invité Six, the account this invitation was sent to.")
    ).toBeInTheDocument();
  });

  it("joins with the session and lands on the dashboard", async () => {
    mockJoin.mockResolvedValue({ success: true, projectId: "p-1" });
    const user = userEvent.setup();
    renderJoin();

    await user.click(screen.getByRole("button", { name: /Join the project/ }));

    expect(mockJoin).toHaveBeenCalledWith("tok-2");
    expect(window.location.href).toBe("/fr/dashboard");
  });

  it("explains a refusal and stays on the page", async () => {
    mockJoin.mockResolvedValue({ success: false, error: "expired" });
    const user = userEvent.setup();
    renderJoin();

    await user.click(screen.getByRole("button", { name: /Join the project/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation has expired.");
    expect(window.location.href).toBe("");
    expect(screen.getByRole("button", { name: /Join the project/ })).toBeEnabled();
  });
});
