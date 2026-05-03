/**
 * Regression tests for DashboardPage CTAs.
 *
 * Guards against the "dashboard hero buttons do nothing" bug. Each remaining
 * CTA must hand off to its real owning page; CTAs whose backing feature
 * doesn't exist (photo upload, calendar integration) must be gone.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage from "../page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    if (vars && typeof vars.n === "number") return `${key}:${vars.n}`;
    if (vars) return `${key}:${JSON.stringify(vars)}`;
    return key;
  },
}));

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseProject.mockReturnValue({
    selectedProject: { id: "p-1", name: "Test", address: "Somewhere" },
  });
});

describe("DashboardPage CTAs — wired to existing routes", () => {
  it("Log entry navigates to the labor page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getByRole("button", { name: /logEntry/ }));
    expect(mockPush).toHaveBeenCalledWith("/en/projects/p-1/labor");
  });

  it("Daily report navigates to the notes page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getByRole("button", { name: /dailyReport/ }));
    expect(mockPush).toHaveBeenCalledWith("/en/projects/p-1/notes");
  });

  it("View Gantt navigates to the planning page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getByRole("button", { name: /viewGantt/ }));
    expect(mockPush).toHaveBeenCalledWith("/en/projects/p-1/planning");
  });

  it("See full journal navigates to the notes page", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getByRole("button", { name: /seeFullJournal/ }));
    expect(mockPush).toHaveBeenCalledWith("/en/projects/p-1/notes");
  });

  it("CTAs are disabled when no project is selected", async () => {
    mockUseProject.mockReturnValue({ selectedProject: null });
    render(<DashboardPage />);
    expect(screen.getByRole("button", { name: /logEntry/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /dailyReport/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /viewGantt/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /seeFullJournal/ })).toBeDisabled();
  });
});

describe("DashboardPage Dismiss alert", () => {
  it("clicking Dismiss hides the alert card", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    expect(screen.getByTestId("rebar-alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dismiss/ }));
    expect(screen.queryByTestId("rebar-alert")).toBeNull();
  });
});

describe("DashboardPage — dead photo / calendar CTAs are removed", () => {
  it("Add photos / Add photo / Add N more / Add to calendar are gone", () => {
    render(<DashboardPage />);
    expect(screen.queryByRole("button", { name: /addPhotos/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^addPhoto$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /addNMore/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /addToCalendar/ })).toBeNull();
  });
});
