/**
 * A user removed from their only company is told so on onboarding, with the
 * join-by-code path one tap away, instead of a plain "Welcome to Folio".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  createCompanyAction: vi.fn(),
  joinCompanyByCodeAction: vi.fn(),
}));

import { OnboardingClient } from "../onboarding-client";

function renderWith(removedFrom: string | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <OnboardingClient removedFrom={removedFrom} />
    </NextIntlClientProvider>
  );
}

describe("OnboardingClient after a removal", () => {
  it("names the company and opens the join form from the banner", () => {
    renderWith("QA3 Perms Co A");

    expect(screen.getByTestId("onboarding-removed-banner")).toHaveTextContent("QA3 Perms Co A");
    fireEvent.click(screen.getByRole("button", { name: en.onboarding.removedFromJoin }));
    expect(screen.queryByTestId("onboarding-removed-banner")).not.toBeInTheDocument();
  });

  it("shows no banner to a brand-new user", () => {
    renderWith(null);
    expect(screen.queryByTestId("onboarding-removed-banner")).not.toBeInTheDocument();
  });
});
