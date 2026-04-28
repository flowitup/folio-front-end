/**
 * Tests for UsersSection component
 *
 * Covers:
 * - Superadmin (*:*) path → BulkAddForm rendered
 * - Non-superadmin path → permission-denied panel rendered with i18n message
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsersSection } from "../users-section";

// ---- Module mocks ----

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (_ns: string) => (key: string) => {
    const map: Record<string, string> = {
      title: "Users & Roles",
      permissionDenied: "You don't have authorization to change roles of users.",
    };
    return map[key] ?? key;
  },
}));

// BulkAddForm is a complex component — stub it to keep the test focused on the gate logic
vi.mock("../bulk-add-form", () => ({
  BulkAddForm: () => <div data-testid="bulk-add-form">BulkAddForm</div>,
}));

// ---- Import mocked module ----

const { useAuth } = await import("@/context/AuthContext");
const mockUseAuth = vi.mocked(useAuth);

// ---- Tests ----

describe("UsersSection", () => {
  it("renders BulkAddForm when user has *:* permission", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseAuth.mockReturnValue({ user: { permissions: ["*:*"] } } as any);

    render(<UsersSection roles={[]} projects={[]} />);

    expect(screen.getByTestId("bulk-add-form")).toBeDefined();
  });

  it("renders permission-denied panel when user lacks *:* permission", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseAuth.mockReturnValue({ user: { permissions: [] } } as any);

    render(<UsersSection roles={[]} projects={[]} />);

    expect(
      screen.getByText("You don't have authorization to change roles of users.")
    ).toBeDefined();
    expect(screen.queryByTestId("bulk-add-form")).toBeNull();
  });
});
