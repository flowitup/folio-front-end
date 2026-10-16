/**
 * QA3 sweep-stale-pickers-07/08, permissions-roles-05/09: an open web session follows changes
 * made elsewhere (role, grants, project assignments, deactivation) without a full reload.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/auth/types";
import { emitSessionEvent } from "@/lib/auth/session-events";

let mockPathname = "/fr/projects";
const mockRouter = { refresh: vi.fn(), replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));
vi.mock("next-intl", () => ({
  useLocale: () => "fr",
  useTranslations: () => (key: string) => key,
}));
const mockToast = vi.hoisted(() => ({ info: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: mockToast }));

let mockUser: User | null = null;
const mockRefreshUser = vi.fn(async () => {});
vi.mock("@/context/AuthContext", () => ({
  useOptionalAuth: () => ({ user: mockUser, refreshUser: mockRefreshUser }),
}));

const mockRefetch = vi.fn(async () => {});
const mockClearAccessLost = vi.fn();
let mockAccessLost: string | null = null;
vi.mock("@/context/ProjectContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/ProjectContext")>();
  return {
    projectIdFromPath: actual.projectIdFromPath,
    useProject: () => ({
      refetch: mockRefetch,
      accessLostProjectId: mockAccessLost,
      clearAccessLost: mockClearAccessLost,
    }),
  };
});

import { SessionFreshness } from "../session-freshness";

function member(role: "member" | "admin"): User {
  return {
    id: "u4",
    email: "u4@example.com",
    permissions: [],
    companies: [{ id: "beta", legal_name: "Bêta", role, is_primary: true }],
  };
}

let now = 1_000_000;

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("SessionFreshness", () => {
  beforeEach(() => {
    now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    mockPathname = "/fr/projects";
    mockUser = member("member");
    mockAccessLost = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("re-reads the user and the project list on window focus, at most every 30 s", async () => {
    render(<SessionFreshness />);
    // The page was just rendered from fresh data.
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(mockRefetch).not.toHaveBeenCalled();

    now += 31_000;
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await flush();
    expect(mockRefetch).toHaveBeenCalledWith({ silent: true });
    expect(mockRefreshUser).toHaveBeenCalledTimes(1);

    now += 5_000;
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await flush();
    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
  });

  it("re-reads on client navigation", async () => {
    const { rerender } = render(<SessionFreshness />);
    now += 31_000;
    mockPathname = "/fr/settings";
    rerender(<SessionFreshness />);
    await flush();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
  });

  it("re-reads soon after a 403 from the API", async () => {
    render(<SessionFreshness />);
    now += 6_000;
    act(() => emitSessionEvent("access-denied"));
    await flush();
    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
  });

  it("refreshes the server-rendered layout and says so when another admin changed the role", async () => {
    const { rerender } = render(<SessionFreshness />);
    now += 31_000;
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await flush();
    mockUser = member("admin");
    rerender(<SessionFreshness />);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    expect(mockToast.info).toHaveBeenCalledWith("accessChanged");
  });

  it("refreshes the layout quietly after the user's own change", () => {
    const { rerender } = render(<SessionFreshness />);
    now += 60_000;
    mockUser = member("admin");
    rerender(<SessionFreshness />);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    expect(mockRefetch).toHaveBeenCalledWith({ silent: true });
    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it("leaves a project the user was removed from and tells them", () => {
    mockPathname = "/fr/projects/p1/planning";
    mockAccessLost = "p1";
    render(<SessionFreshness />);
    expect(mockClearAccessLost).toHaveBeenCalled();
    expect(mockToast.warning).toHaveBeenCalledWith("projectAccessLost");
    expect(mockRouter.replace).toHaveBeenCalledWith("/fr/projects");
  });

  it("sends a refused session to sign in with the reason, back to the same page", () => {
    mockPathname = "/fr/projects/p1/notes";
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, assign },
    });
    try {
      render(<SessionFreshness />);
      act(() => {
        emitSessionEvent("session-ended");
        emitSessionEvent("session-ended");
      });
      expect(assign).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledWith(
        "/fr/login?callbackUrl=%2Ffr%2Fprojects%2Fp1%2Fnotes&reason=session_ended"
      );
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });
});
