/** Legal pages: Vietnamese readers get the English text (not French), and the title follows the language. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage, { generateMetadata } from "../privacy/page";
import SupportPage from "../support/page";

describe("legal pages", () => {
  it("shows the English privacy policy, dated in English, to a Vietnamese reader", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "vi" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/confidentialité/);
    expect(screen.getByText(/Last updated: September 14, 2026/)).toBeInTheDocument();
  });

  it("keeps the French text for French readers", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(screen.getByText("Politique de confidentialité")).toBeInTheDocument();
    expect(screen.getByText(/14 septembre 2026/)).toBeInTheDocument();
  });

  it("titles the privacy page in the reader's language", async () => {
    expect((await generateMetadata({ params: Promise.resolve({ locale: "en" }) })).title).toBe(
      "Folio · Privacy Policy"
    );
    expect((await generateMetadata({ params: Promise.resolve({ locale: "fr" }) })).title).toBe(
      "Folio · Politique de confidentialité"
    );
  });

  it("declares the English text it shows on /vi as English", async () => {
    const { container } = render(await PrivacyPage({ params: Promise.resolve({ locale: "vi" }) }));
    expect(container.querySelector('[lang="en"]')).not.toBeNull();
    const support = render(await SupportPage({ params: Promise.resolve({ locale: "vi" }) }));
    expect(support.container.querySelector('[lang="en"]')).not.toBeNull();
  });

  it("shows the English support page to a Vietnamese reader", async () => {
    render(await SupportPage({ params: Promise.resolve({ locale: "vi" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Folio Support");
  });
});
