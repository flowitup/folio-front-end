/**
 * api-keys-section.test.tsx
 *
 * Covers: rows render after load, the empty state, the one-time token panel
 * appearing after create and disappearing on dismiss, revoke only firing
 * after the confirm dialog is accepted, and the error state on a failed load.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ApiKeysSection } from "../api-keys-section";
import type { ApiKey, CreatedApiKey } from "@/lib/api/api-keys";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: (_ns: string) => (key: string) => {
    const map: Record<string, string> = {
      title: "API Keys",
      intro: "Generate personal API keys to call the Folio API.",
      namePlaceholder: "Key name",
      createCta: "Create key",
      creating: "Creating…",
      createdTitle: "Your new API key",
      createdWarning: "Copy this key now — we can't show it to you again.",
      copy: "Copy",
      copied: "Copied",
      copyFailed: "Couldn't copy to clipboard.",
      dismiss: "Dismiss",
      listEmpty: "You haven't created any API keys yet.",
      created: "Created",
      lastUsed: "Last used",
      neverUsed: "Never used",
      revoke: "Revoke",
      revokeConfirmTitle: "Revoke API key",
      revokeConfirmBody: "Revoke this key? This cannot be undone.",
      revokeConfirmCta: "Revoke key",
      cancel: "Cancel",
      usageHintTitle: "Using your key",
      usageHintBody: "Send it as a bearer token in the Authorization header.",
      "errors.invalid_name": "Please enter a name for this key.",
      "errors.limit_reached": "You've reached the maximum number of API keys.",
      "errors.not_found": "This API key no longer exists.",
      "errors.unauthorized": "Your session has expired.",
      "errors.unknown": "Something went wrong. Please try again.",
    };
    return map[key] ?? key;
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/app/[locale]/(app)/settings/_actions/api-keys-actions", () => ({
  fetchApiKeysAction: vi.fn(),
  createApiKeyAction: vi.fn(),
  deleteApiKeyAction: vi.fn(),
}));

import {
  fetchApiKeysAction,
  createApiKeyAction,
  deleteApiKeyAction,
} from "@/app/[locale]/(app)/settings/_actions/api-keys-actions";

const mockFetch = vi.mocked(fetchApiKeysAction);
const mockCreate = vi.mocked(createApiKeyAction);
const mockDelete = vi.mocked(deleteApiKeyAction);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KEY_1: ApiKey = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "CI pipeline",
  prefix: "folio_sk_AbCd",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastUsedAt: "2026-02-01T00:00:00.000Z",
};

const KEY_2: ApiKey = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Backup script",
  prefix: "folio_sk_WxYz",
  createdAt: "2026-01-05T00:00:00.000Z",
  lastUsedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ApiKeysSection — load", () => {
  it("renders rows after load", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, data: [KEY_1, KEY_2] });
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(screen.getByText("CI pipeline")).toBeDefined();
      expect(screen.getByText("Backup script")).toBeDefined();
    });
    expect(screen.getByText(/folio_sk_AbCd/)).toBeDefined();
    expect(screen.getByText(/folio_sk_WxYz/)).toBeDefined();
  });

  it("renders the empty state when there are no keys", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, data: [] });
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(screen.getByText("You haven't created any API keys yet.")).toBeDefined();
    });
  });

  it("renders the error state when the initial load fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, error: "unknown" });
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(screen.getByTestId("api-keys-error")).toBeDefined();
      expect(screen.getByText("Something went wrong. Please try again.")).toBeDefined();
    });
  });
});

describe("ApiKeysSection — create", () => {
  it("reveals the one-time token panel after create, once, and dismiss removes it", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, data: [] });
    const created: CreatedApiKey = {
      id: "33333333-3333-4333-8333-333333333333",
      name: "New key",
      prefix: "folio_sk_New1",
      createdAt: "2026-03-01T00:00:00.000Z",
      lastUsedAt: null,
      token: "folio_sk_supersecretplaintexttoken",
    };
    mockCreate.mockResolvedValueOnce({ ok: true, data: created });
    render(<ApiKeysSection />);

    await waitFor(() =>
      expect(screen.getByText("You haven't created any API keys yet.")).toBeDefined()
    );

    expect(screen.queryByTestId("api-key-created-panel")).toBeNull();

    const input = screen.getByRole("textbox", { name: "Key name" });
    await act(async () => {
      fireEvent.change(input, { target: { value: "New key" } });
      fireEvent.click(screen.getByRole("button", { name: /create key/i }));
    });

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith("New key");
      expect(screen.getAllByTestId("api-key-created-panel")).toHaveLength(1);
      expect(screen.getByTestId("api-key-token").textContent).toBe(
        "folio_sk_supersecretplaintexttoken"
      );
    });
    // The key itself lands in the list too, alongside the token panel.
    expect(screen.getByText("New key")).toBeDefined();
    // The input clears after a successful submit.
    expect(input).toHaveValue("");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    });

    expect(screen.queryByTestId("api-key-created-panel")).toBeNull();
    // Dismissing the panel only clears the secret — the key stays in the list.
    expect(screen.getByText("New key")).toBeDefined();
  });

  it("surfaces a create error as a toast without opening the token panel", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, data: [] });
    mockCreate.mockResolvedValueOnce({ ok: false, error: "limit_reached" });
    const { toast } = await import("sonner");
    render(<ApiKeysSection />);

    await waitFor(() =>
      expect(screen.getByText("You haven't created any API keys yet.")).toBeDefined()
    );

    const input = screen.getByRole("textbox", { name: "Key name" });
    await act(async () => {
      fireEvent.change(input, { target: { value: "One too many" } });
      fireEvent.click(screen.getByRole("button", { name: /create key/i }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("You've reached the maximum number of API keys.");
    });
    expect(screen.queryByTestId("api-key-created-panel")).toBeNull();
  });
});

describe("ApiKeysSection — revoke", () => {
  it("revokes only after the confirm dialog is accepted", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, data: [KEY_1] });
    mockDelete.mockResolvedValueOnce({ ok: true });
    render(<ApiKeysSection />);

    await waitFor(() => expect(screen.getByText("CI pipeline")).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    });

    // Dialog is open, but nothing has been called yet.
    expect(mockDelete).not.toHaveBeenCalled();

    const confirmButtons = screen.getAllByRole("button", { name: /revoke key/i });
    await act(async () => {
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    });

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(KEY_1.id);
      expect(screen.queryByText("CI pipeline")).toBeNull();
    });
  });

  it("keeps the row when the confirm dialog is cancelled", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, data: [KEY_1] });
    render(<ApiKeysSection />);

    await waitFor(() => expect(screen.getByText("CI pipeline")).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });

    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText("CI pipeline")).toBeDefined();
  });
});
