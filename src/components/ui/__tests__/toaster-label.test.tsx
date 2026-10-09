/**
 * The toast region is a landmark screen readers announce; sonner names it
 * "Notifications" in English unless told otherwise, so the wrapper passes the
 * page's language.
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Toaster } from "../sonner";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

describe("Toaster", () => {
  it("labels the notifications region with the translated name", () => {
    const { container } = render(<Toaster />);
    const region = container.querySelector("section");
    expect(region?.getAttribute("aria-label")).toMatch(/^common\.notificationsRegion /);
  });
});
