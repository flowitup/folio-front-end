/**
 * The invitation screens are signed out and have no topbar: the layout must
 * still offer the language switcher above whatever step is shown.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

const AcceptInviteLayout = (await import("../../layout")).default;

describe("accept-invite layout", () => {
  it("renders the language switcher alongside the page", () => {
    render(
      <AcceptInviteLayout>
        <p>invite form</p>
      </AcceptInviteLayout>
    );
    expect(screen.getByTestId("language-switcher")).toBeTruthy();
    expect(screen.getByText("invite form")).toBeTruthy();
  });
});
