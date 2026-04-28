/**
 * Tests for UserSearch component
 *
 * Covers:
 * - input <3 chars → no API call (searchUsersAction not called)
 * - input ≥3 chars → debounced call after 250ms (fake timers to advance debounce,
 *   then real timers restored before async waitFor assertions)
 * - dropdown shows results when API returns items
 * - click result item → onSelect called with the user object
 * - empty result set → empty-state message rendered
 *
 * Timer strategy:
 *   1. vi.useFakeTimers() to control debounce setTimeout
 *   2. fireEvent.change (synchronous) to set input value
 *   3. vi.advanceTimersByTime(300) to trigger the debounce callback
 *   4. vi.useRealTimers() BEFORE waitFor so waitFor's own polling timers work
 *   This avoids deadlocks where waitFor's internal setTimeout is also frozen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { UserSearch } from "../user-search";
import type { UserSearchItem } from "@/lib/api/admin";

// ---- Module mocks ----

vi.mock("../actions", () => ({
  searchUsersAction: vi.fn(),
  bulkAddMembershipsAction: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (_ns: string) => (key: string) => {
    // Keys must match the nested paths used by user-search.tsx (admin.bulkAdd.userSearch.*)
    const map: Record<string, string> = {
      "userSearch.label": "Search for a user",
      "userSearch.placeholder": "Type at least 3 characters",
      "userSearch.searching": "Searching...",
      "userSearch.empty": "No users match your search",
    };
    return map[key] ?? key;
  },
}));

// ---- Import mocked module ----

const { searchUsersAction } = await import("../actions");
const mockSearch = vi.mocked(searchUsersAction);

// ---- Fixtures ----

const USERS: UserSearchItem[] = [
  { id: "user-1", email: "alice@example.com", display_name: "Alice A" },
  { id: "user-2", email: "bob@example.com", display_name: null },
];

function renderSearch(onSelect = vi.fn()) {
  return { onSelect, ...render(<UserSearch onSelect={onSelect} />) };
}

/** Set input value synchronously via fireEvent (avoids fake-timer deadlock in userEvent.type). */
function setInputValue(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

/**
 * Advance fake timers past the debounce window, then restore real timers so
 * that waitFor's internal polling setTimeout works correctly.
 */
async function triggerDebounce() {
  vi.advanceTimersByTime(300);
  vi.useRealTimers();
  // Flush pending microtasks (Promise resolutions from mockSearch)
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ---- Tests ----

describe("UserSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // No API call for short queries
  // ---------------------------------------------------------------------------

  describe("query length guard", () => {
    it("does not call searchUsersAction for 1-char input", () => {
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "a");
      vi.advanceTimersByTime(300);

      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("does not call searchUsersAction for 2-char input", () => {
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "ab");
      vi.advanceTimersByTime(300);

      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("does not fire again when query drops back below 3 chars", async () => {
      mockSearch.mockResolvedValue({ items: USERS });
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      // 3 chars → triggers debounce
      setInputValue(input, "ali");
      await triggerDebounce();

      vi.clearAllMocks();
      vi.useFakeTimers();

      // Drop to 2 chars
      setInputValue(input, "al");
      vi.advanceTimersByTime(300);

      expect(mockSearch).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Debounced call for ≥3 chars
  // ---------------------------------------------------------------------------

  describe("debounced API call", () => {
    it("does NOT call searchUsersAction before 250ms have elapsed", () => {
      mockSearch.mockResolvedValue({ items: USERS });
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "ali");
      vi.advanceTimersByTime(100); // still within debounce window

      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("calls searchUsersAction with query after 250ms debounce", async () => {
      mockSearch.mockResolvedValue({ items: USERS });
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "ali");
      await triggerDebounce();

      expect(mockSearch).toHaveBeenCalledWith("ali");
    });

    it("debounces rapid changes — only fires for the last value", async () => {
      mockSearch.mockResolvedValue({ items: [] });
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      // Change value within debounce window — first timer cancelled
      setInputValue(input, "ali");
      vi.advanceTimersByTime(100);
      setInputValue(input, "alice");
      await triggerDebounce();

      expect(mockSearch).toHaveBeenCalledTimes(1);
      expect(mockSearch).toHaveBeenCalledWith("alice");
    });
  });

  // ---------------------------------------------------------------------------
  // Dropdown shows results
  // ---------------------------------------------------------------------------

  describe("dropdown with results", () => {
    it("renders a listbox with user results after search", async () => {
      mockSearch.mockResolvedValue({ items: USERS });
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "ali");
      await triggerDebounce();

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeDefined();
      });

      // User with display_name shows display_name as option text
      expect(screen.getByRole("option", { name: /Alice A/i })).toBeDefined();
      // User with no display_name shows email as option text
      expect(screen.getByRole("option", { name: /bob@example.com/i })).toBeDefined();
    });

    it("shows email as sub-label when display_name is set", async () => {
      mockSearch.mockResolvedValue({ items: [USERS[0]] });
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "ali");
      await triggerDebounce();

      await waitFor(() => {
        expect(screen.getByText("alice@example.com")).toBeDefined();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Item selection
  // ---------------------------------------------------------------------------

  describe("item selection", () => {
    it("calls onSelect with the correct user object on item mousedown", async () => {
      const onSelect = vi.fn();
      mockSearch.mockResolvedValue({ items: USERS });
      render(<UserSearch onSelect={onSelect} />);
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "ali");
      await triggerDebounce();

      await waitFor(() => screen.getByRole("listbox"));

      // Component uses onMouseDown to fire before blur
      const option = screen.getByRole("option", { name: /Alice A/i });
      await act(async () => {
        fireEvent.mouseDown(option);
      });

      expect(onSelect).toHaveBeenCalledWith(USERS[0]);
    });

    it("clears the input and closes dropdown after selection", async () => {
      const onSelect = vi.fn();
      mockSearch.mockResolvedValue({ items: [USERS[0]] });
      render(<UserSearch onSelect={onSelect} />);
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "ali");
      await triggerDebounce();

      await waitFor(() => screen.getByRole("listbox"));

      const option = screen.getByRole("option", { name: /Alice A/i });
      await act(async () => {
        fireEvent.mouseDown(option);
      });

      // Input cleared, dropdown closed
      expect((input as HTMLInputElement).value).toBe("");
      expect(screen.queryByRole("listbox")).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  describe("empty state", () => {
    it("renders empty-state message when API returns no results", async () => {
      mockSearch.mockResolvedValue({ items: [] });
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "zzz");
      await triggerDebounce();

      await waitFor(() => {
        expect(screen.getByText(/no users match your search/i)).toBeDefined();
      });

      // No selectable options rendered
      expect(screen.queryByRole("option")).toBeNull();
    });

    it("renders empty-state message on API error (graceful fallback)", async () => {
      mockSearch.mockRejectedValue(new Error("network error"));
      renderSearch();
      const input = screen.getByRole("textbox", { name: /search for a user/i });

      setInputValue(input, "err");
      await triggerDebounce();

      // Component catches error → hasSearched=true, results=[] → empty state
      await waitFor(() => {
        expect(screen.getByText(/no users match your search/i)).toBeDefined();
      });
    });
  });
});
