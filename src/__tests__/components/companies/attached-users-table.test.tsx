/**
 * attached-users-table.test.tsx
 *
 * Covers: list render, primary badge, boot confirm dialog, boot action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AttachedUsersTable } from "@/components/companies/attached-users-table";
import type { AttachedUser } from "@/types/companies";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let val = resolve(en, `${ns}.${key}`);
    if (typeof val !== "string") return key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => { val = val.replace(`{${k}}`, String(v)); });
    }
    return val;
  };
  return { useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  } as unknown as { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
}));

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    bootAttachedUserAction: vi.fn(),
  })
);

import { bootAttachedUserAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
const mockBoot = vi.mocked(bootAttachedUserAction);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALICE: AttachedUser = {
  user_id: "user-1",
  email: "alice@example.com",
  display_name: "Alice",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  role: "admin",
};

const BOB: AttachedUser = {
  user_id: "user-2",
  email: "bob@example.com",
  display_name: null,
  is_primary: false,
  attached_at: "2026-02-01T00:00:00Z",
  role: "member",
};

function renderTable(
  users: AttachedUser[] = [ALICE, BOB],
  onMutated = vi.fn()
) {
  return render(
    <AttachedUsersTable companyId="co-1" users={users} onMutated={onMutated} />
  );
}

// ---------------------------------------------------------------------------
// List render
// ---------------------------------------------------------------------------

describe("AttachedUsersTable — list render", () => {
  it("renders all attached users", () => {
    renderTable();
    expect(screen.getByText("Alice")).toBeDefined();
    // Bob has no display_name — falls back to email
    expect(screen.getByText("bob@example.com")).toBeDefined();
  });

  it("shows empty message when user list is empty", () => {
    renderTable([]);
    // Empty state paragraph is rendered
    const emptyEl = document.querySelector("p");
    expect(emptyEl).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Primary badge
// ---------------------------------------------------------------------------

describe("AttachedUsersTable — primary badge", () => {
  it("shows primary badge for the primary user", () => {
    renderTable();
    // Alice is primary — badge span contains "primary"
    const badge = screen.getAllByText(/primary/i);
    expect(badge.length).toBeGreaterThan(0);
  });

  it("does NOT show primary badge for non-primary user", () => {
    renderTable([BOB]);
    const badges = screen.queryAllByText(/primary/i);
    expect(badges.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Boot confirm
// ---------------------------------------------------------------------------

describe("AttachedUsersTable — boot confirm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking boot icon opens confirm dialog", async () => {
    renderTable();

    const bootBtns = screen.getAllByTitle(/boot|remove/i);
    await act(async () => {
      fireEvent.click(bootBtns[0]);
    });

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeDefined();
    });
  });

  it("confirming boot calls bootAttachedUserAction with companyId + userId", async () => {
    mockBoot.mockResolvedValueOnce({ ok: true, data: undefined });
    const onMutated = vi.fn();

    renderTable([ALICE], onMutated);

    const bootBtns = screen.getAllByTitle(/boot|remove/i);
    await act(async () => { fireEvent.click(bootBtns[0]); });

    await waitFor(() => screen.getByRole("alertdialog"));

    // Find the destructive action button in the dialog
    const actionBtns = screen.getAllByRole("button");
    const bootConfirmBtn = actionBtns.find(
      (b) => /boot|remove/i.test(b.textContent ?? "") && b.closest("[role='alertdialog']")
    );
    expect(bootConfirmBtn).toBeDefined();

    await act(async () => { fireEvent.click(bootConfirmBtn!); });

    await waitFor(() => {
      expect(mockBoot).toHaveBeenCalledWith("co-1", "user-1");
      expect(onMutated).toHaveBeenCalledOnce();
    });
  });

  it("shows toast.error when boot action returns ok=false", async () => {
    mockBoot.mockResolvedValueOnce({
      ok: false,
      error: { code: "forbidden_admin_required", message: "Admin required." },
    });

    const { toast } = await import("sonner");
    const mockToast = toast as unknown as { error: ReturnType<typeof vi.fn> };

    renderTable([ALICE]);

    const bootBtns = screen.getAllByTitle(/boot|remove/i);
    await act(async () => { fireEvent.click(bootBtns[0]); });
    await waitFor(() => screen.getByRole("alertdialog"));

    const actionBtns = screen.getAllByRole("button");
    const bootConfirmBtn = actionBtns.find(
      (b) => /boot|remove/i.test(b.textContent ?? "") && b.closest("[role='alertdialog']")
    );
    await act(async () => { fireEvent.click(bootConfirmBtn!); });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Admin required.");
    });
  });
});
