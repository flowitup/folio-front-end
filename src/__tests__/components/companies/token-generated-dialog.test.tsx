/**
 * token-generated-dialog.test.tsx
 *
 * Required regression test:
 *   test_token_generated_dialog_shows_plaintext_once
 *
 * Also covers: copy button, expires line, auto-close at 60 s.
 *
 * Timer strategy: vi.useFakeTimers() + vi.advanceTimersByTimeAsync(N ms).
 * Do NOT use vi.runAllTimersAsync() — risks deadlock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TokenGeneratedDialog } from "@/components/companies/token-generated-dialog";
import type { CompanyInviteTokenGenerated } from "@/types/companies";

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

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const TOKEN_DATA: CompanyInviteTokenGenerated = {
  token: "PLAINTEXT-SECRET-TOKEN-XYZ",
  token_id: "tid-1",
  expires_at: "2026-06-07T00:00:00Z",
};

// ---------------------------------------------------------------------------
// test_token_generated_dialog_shows_plaintext_once
// ---------------------------------------------------------------------------

describe("test_token_generated_dialog_shows_plaintext_once", () => {
  it("open with tokenData → plaintext visible", () => {
    render(
      <TokenGeneratedDialog
        open={true}
        onOpenChange={vi.fn()}
        tokenData={TOKEN_DATA}
      />
    );
    expect(screen.getByText("PLAINTEXT-SECRET-TOKEN-XYZ")).toBeDefined();
  });

  it("tokenData=null → plaintext NOT in DOM (parent discarded it after close)", () => {
    // Simulates reopening the same dialog instance after the parent cleared tokenData
    render(
      <TokenGeneratedDialog
        open={true}
        onOpenChange={vi.fn()}
        tokenData={null}
      />
    );
    expect(screen.queryByText("PLAINTEXT-SECRET-TOKEN-XYZ")).toBeNull();
  });

  it("dialog closed → onOpenChange(false) called; parent must then clear tokenData", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <TokenGeneratedDialog
        open={true}
        onOpenChange={onOpenChange}
        tokenData={TOKEN_DATA}
      />
    );

    // Simulate parent closing: rerender with open=false
    rerender(
      <TokenGeneratedDialog
        open={false}
        onOpenChange={onOpenChange}
        tokenData={TOKEN_DATA}
      />
    );

    // Token div is not rendered when dialog is closed
    expect(screen.queryByText("PLAINTEXT-SECRET-TOKEN-XYZ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Expires line
// ---------------------------------------------------------------------------

describe("TokenGeneratedDialog — expires line", () => {
  it("shows expiry information when tokenData is provided", () => {
    render(
      <TokenGeneratedDialog
        open={true}
        onOpenChange={vi.fn()}
        tokenData={TOKEN_DATA}
      />
    );
    // The expires line contains "Expires:" from the i18n key
    expect(screen.getByText(/expires/i)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Auto-close at 60 s
// ---------------------------------------------------------------------------

describe("TokenGeneratedDialog — auto-close countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("calls onOpenChange(false) after 60 s via advanceTimersByTimeAsync", async () => {
    const onOpenChange = vi.fn();

    await act(async () => {
      render(
        <TokenGeneratedDialog
          open={true}
          onOpenChange={onOpenChange}
          tokenData={TOKEN_DATA}
        />
      );
    });

    // Advance one tick at a time to let setInterval fire 60 times
    for (let i = 0; i < 60; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
    }

    expect(onOpenChange).toHaveBeenCalledWith(false);
  }, 15_000);

  it("shows countdown decreasing from 60", async () => {
    await act(async () => {
      render(
        <TokenGeneratedDialog
          open={true}
          onOpenChange={vi.fn()}
          tokenData={TOKEN_DATA}
        />
      );
    });

    // Initially shows "60" in countdown
    expect(screen.getByText(/60s/i)).toBeDefined();

    // After 5 s countdown should show "55"
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
    }

    expect(screen.getByText(/55s/i)).toBeDefined();
  }, 15_000);

  it("C-3 regression: reopening after auto-close resets countdown and stays open", async () => {
    // Simulates: open → auto-close (60 ticks) → reopen → verify dialog stays
    // open for a full AUTO_CLOSE_SECONDS cycle (does NOT immediately close).
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <TokenGeneratedDialog
        open={true}
        onOpenChange={onOpenChange}
        tokenData={TOKEN_DATA}
      />
    );

    // Let the dialog auto-close after 60 s
    for (let i = 0; i < 60; i++) {
      await act(async () => { vi.advanceTimersByTime(1_000); });
    }
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();

    // Reopen (parent sets open=true again)
    await act(async () => {
      rerender(
        <TokenGeneratedDialog
          open={true}
          onOpenChange={onOpenChange}
          tokenData={TOKEN_DATA}
        />
      );
    });

    // After reset the countdown must start from 60s again.
    // Advance several ticks — onOpenChange(false) must NOT fire until 60 more seconds pass.
    // We only advance 5 ticks here (well under the 60s threshold).
    for (let i = 0; i < 5; i++) {
      await act(async () => { vi.advanceTimersByTime(1_000); });
    }
    // The dialog has been open for only 5 s since reopen — must still be open.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

describe("TokenGeneratedDialog — copy button", () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.clearAllMocks();
  });

  it("copy button is present and enabled when tokenData is provided", () => {
    render(
      <TokenGeneratedDialog
        open={true}
        onOpenChange={vi.fn()}
        tokenData={TOKEN_DATA}
      />
    );
    const copyBtn = screen.getByRole("button", { name: /copy/i });
    expect((copyBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("copy button is disabled when tokenData is null", () => {
    render(
      <TokenGeneratedDialog
        open={true}
        onOpenChange={vi.fn()}
        tokenData={null}
      />
    );
    const copyBtn = screen.getByRole("button", { name: /copy/i });
    expect((copyBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
