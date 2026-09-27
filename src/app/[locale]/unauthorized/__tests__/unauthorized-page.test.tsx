import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import fr from "@/messages/fr.json";

vi.mock("next-intl/server", () => ({
  getLocale: async () => "fr",
  getTranslations: async (ns: string) => (key: string) =>
    key.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], (fr as Record<string, unknown>)[ns]),
}));

import UnauthorizedPage from "../page";

describe("/unauthorized", () => {
  it("speaks the app language and links to the localized dashboard", async () => {
    render(await UnauthorizedPage());
    expect(screen.getByText(fr.errors.accessDenied)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: fr.errors.notFound.back })).toHaveAttribute("href", "/fr/dashboard");
  });
});
