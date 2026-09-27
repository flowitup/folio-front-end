import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PrivacyPage, { generateMetadata } from "../privacy/page";
import SupportPage from "../support/page";

const params = (locale: string) => Promise.resolve({ locale });

describe("legal pages", () => {
  it("titles the English privacy page in English", async () => {
    expect((await generateMetadata({ params: params("en") })).title).toBe("Folio · Privacy Policy");
    expect((await generateMetadata({ params: params("fr") })).title).toBe("Folio · Politique de confidentialité");
  });

  it("declares the French text it shows on /vi as French", async () => {
    const { container } = render(await PrivacyPage({ params: params("vi") }));
    expect(container.querySelector('[lang="fr"]')).not.toBeNull();
    const support = render(await SupportPage({ params: params("vi") }));
    expect(support.container.querySelector('[lang="fr"]')).not.toBeNull();
  });
});
