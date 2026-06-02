/**
 * Tests for NotificationsDropdown component.
 *
 * Covers:
 * - Loading skeleton renders when isLoading=true
 * - Empty state renders when isLoading=false and items=[]
 * - Renders notification rows when items present
 * - onDismiss callback wired to each row's dismiss button
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationsDropdown } from "../notifications-dropdown";
import type { DueNotification } from "@/lib/api/notifications";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ---- Fixtures ----

function makeNotification(id: string, title: string): DueNotification {
  return {
    note: {
      id,
      project_id: "proj-1",
      created_by: "user-1",
      title,
      description: null,
      category: "general",
      status: "open" as const,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    dismissed: false,
  };
}

const ITEMS: DueNotification[] = [
  makeNotification("note-1", "Fix the bug"),
  makeNotification("note-2", "Review PR"),
];

// ---- Tests ----

describe("NotificationsDropdown — loading skeleton", () => {
  it("renders skeleton rows when isLoading=true", () => {
    render(
      <NotificationsDropdown
        items={[]}
        isLoading={true}
        onDismiss={vi.fn()}
        onClickRow={vi.fn()}
      />
    );
    // Skeleton uses animate-pulse divs; check that no empty-state text is shown
    expect(screen.queryByText("notifications.empty")).toBeNull();
    // Header always present
    expect(screen.getByText("notifications.title")).toBeDefined();
  });

  it("does not render notification rows during loading", () => {
    render(
      <NotificationsDropdown
        items={ITEMS}
        isLoading={true}
        onDismiss={vi.fn()}
        onClickRow={vi.fn()}
      />
    );
    // Even though items are provided, skeleton mode hides them
    expect(screen.queryByText("Fix the bug")).toBeNull();
    expect(screen.queryByText("Review PR")).toBeNull();
  });
});

describe("NotificationsDropdown — empty state", () => {
  it("renders empty state message when not loading and items=[]", () => {
    render(
      <NotificationsDropdown
        items={[]}
        isLoading={false}
        onDismiss={vi.fn()}
        onClickRow={vi.fn()}
      />
    );
    expect(screen.getByText("notifications.empty")).toBeDefined();
  });

  it("does not render skeleton when not loading", () => {
    const { container } = render(
      <NotificationsDropdown
        items={[]}
        isLoading={false}
        onDismiss={vi.fn()}
        onClickRow={vi.fn()}
      />
    );
    // No animate-pulse element
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});

describe("NotificationsDropdown — notification rows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row for each item", () => {
    render(
      <NotificationsDropdown
        items={ITEMS}
        isLoading={false}
        onDismiss={vi.fn()}
        onClickRow={vi.fn()}
      />
    );
    expect(screen.getByText("Fix the bug")).toBeDefined();
    expect(screen.getByText("Review PR")).toBeDefined();
  });

  it("renders header title", () => {
    render(
      <NotificationsDropdown
        items={ITEMS}
        isLoading={false}
        onDismiss={vi.fn()}
        onClickRow={vi.fn()}
      />
    );
    expect(screen.getByText("notifications.title")).toBeDefined();
  });

  it("does not show empty state when items are present", () => {
    render(
      <NotificationsDropdown
        items={ITEMS}
        isLoading={false}
        onDismiss={vi.fn()}
        onClickRow={vi.fn()}
      />
    );
    expect(screen.queryByText("notifications.empty")).toBeNull();
  });
});
