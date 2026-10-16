import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/fr/projects/p1/photos";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next-intl", () => ({
  useLocale: () => "fr",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ProjectSectionGuard } from "../project-section-guard";

describe("ProjectSectionGuard", () => {
  it("shows a notice instead of a section the project's company hides", () => {
    pathname = "/fr/projects/p1/photos";
    render(
      <ProjectSectionGuard projectId="p1" hiddenSections={["photos"]}>
        <p>photos page</p>
      </ProjectSectionGuard>,
    );
    expect(screen.getByTestId("project-section-hidden")).toBeTruthy();
    expect(screen.queryByText("photos page")).toBeNull();
    expect(screen.getByText("back").closest("a")?.getAttribute("href")).toBe("/projects/p1");
  });

  it("renders the other sections", () => {
    pathname = "/fr/projects/p1/notes";
    render(
      <ProjectSectionGuard projectId="p1" hiddenSections={["photos"]}>
        <p>notes page</p>
      </ProjectSectionGuard>,
    );
    expect(screen.getByText("notes page")).toBeTruthy();
  });
});
