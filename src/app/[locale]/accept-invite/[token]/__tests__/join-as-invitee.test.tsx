/**
 * JoinAsInvitee — the signed-in account is the one the invitation was sent to,
 * so it joins from its session (no sign-out, no phone step).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinAsInvitee } from "../join-as-invitee";

vi.mock("@/lib/auth/actions", () => ({
  logout: vi.fn(),
  acceptInviteAsMeAction: vi.fn(),
  acceptInviteAction: vi.fn(),
  requestInviteCodeAction: vi.fn(),
}));

const TRANSLATIONS: Record<string, string> = {
  "joinAsMe.title": "Join {projectName}",
  "joinAsMe.body": "You're signed in as {currentUser}, the account this invitation was sent to.",
  "joinAsMe.submit": "Join the project",
  "joinAsMe.submitting": "Joining…",
  "joinAsMe.bodyOther": "You're signed in as {currentUser}. Join with this account, or use another one.",
  "joinAsMe.switchAccount": "Use another account",
  "errors.generic": "Something went wrong. Please try again.",
  "errors.expired": "This invitation has expired.",
  "errors.wrongAccount": "This invitation was sent to another email address.",
  joinedToast: "You joined {projectName}",
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
    // The dashboard opens on the joined project, with a toast naming it.
    expect(localStorage.getItem("selectedProjectId")).toBe("p-1");
    expect(sessionStorage.getItem("folio:flash-toast")).toBe("You joined 1 rue Principale, Paris");
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

  it("offers another account a way to join as itself or to switch account", async () => {
    const { logout } = await import("@/lib/auth/actions");
    render(
      <JoinAsInvitee
        token="tok-2"
        locale="fr"
        projectName="P"
        currentUser="Dave"
        isInvitee={false}
        returnPath="/fr/accept-invite/tok-2"
      />
    );
    expect(screen.getByText("You're signed in as Dave. Join with this account, or use another one.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Use another account/ }));
    expect(vi.mocked(logout)).toHaveBeenCalledWith("/fr/accept-invite/tok-2");
  });
});
