/**
 * "Sign out and continue" brings the visitor back to the invitation: the
 * server redirects there, and the page then loads it in full, never /login.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockLogout } = vi.hoisted(() => ({ mockLogout: vi.fn() }));
vi.mock("@/lib/auth/actions", () => ({ logout: mockLogout }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

import { LoggedInOther } from "../logged-in-other";

const assign = vi.fn();

beforeEach(() => {
  mockLogout.mockReset();
  assign.mockReset();
  Object.defineProperty(window, "location", { value: { assign }, writable: true });
});

describe("LoggedInOther", () => {
  it("signs out back to the invitation", async () => {
    // The server action's redirect() rejects on the client with NEXT_REDIRECT.
    mockLogout.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/fr/accept-invite/tok" }));
    render(<LoggedInOther currentEmail="Dave" returnPath="/fr/accept-invite/tok" />);

    await userEvent.click(screen.getByRole("button", { name: /loggedInOther.signOut/ }));

    expect(mockLogout).toHaveBeenCalledWith("/fr/accept-invite/tok");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/fr/accept-invite/tok"));
  });
});
