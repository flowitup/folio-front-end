/**
 * library-pagination.test.tsx — LibraryPagination component tests.
 *
 * Tests:
 *   - Renders current page + total
 *   - Prev disabled on first page, Next disabled on last page
 *   - Arrow clicks step the page
 *   - Typing a page + Enter jumps (clamped over/under bounds)
 *   - Blur commits; invalid (empty/non-numeric) reverts to current page
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LibraryPagination } from "../library-pagination";

vi.mock("next-intl", () => ({
  useTranslations: (_ns: string) => (key: string) => {
    const map: Record<string, string> = {
      page: "Page",
      goToPage: "Go to page",
      previousPage: "Previous page",
      nextPage: "Next page",
    };
    return map[key] ?? `bibliotheque.${key}`;
  },
}));

function renderPager(page: number, totalPages: number) {
  const onPageChange = vi.fn();
  render(
    <LibraryPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
  );
  return { onPageChange };
}

describe("LibraryPagination", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the current page value and total", () => {
    renderPager(3, 10);
    const input = screen.getByLabelText("Go to page") as HTMLInputElement;
    expect(input.value).toBe("3");
    expect(screen.getByText("/ 10")).toBeInTheDocument();
  });

  it("disables prev on the first page", () => {
    renderPager(1, 10);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).not.toBeDisabled();
  });

  it("disables next on the last page", () => {
    renderPager(10, 10);
    expect(screen.getByLabelText("Next page")).toBeDisabled();
    expect(screen.getByLabelText("Previous page")).not.toBeDisabled();
  });

  it("steps the page when arrows are clicked", () => {
    const { onPageChange } = renderPager(5, 10);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(onPageChange).toHaveBeenCalledWith(6);
    fireEvent.click(screen.getByLabelText("Previous page"));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("jumps to a typed page on Enter", () => {
    const { onPageChange } = renderPager(1, 10);
    const input = screen.getByLabelText("Go to page");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPageChange).toHaveBeenCalledWith(7);
  });

  it("clamps a page above the total down to the last page", () => {
    const { onPageChange } = renderPager(1, 10);
    const input = screen.getByLabelText("Go to page");
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPageChange).toHaveBeenCalledWith(10);
  });

  it("clamps a page below 1 up to the first page", () => {
    const { onPageChange } = renderPager(5, 10);
    const input = screen.getByLabelText("Go to page") as HTMLInputElement;
    // strips the minus sign, leaving "0"
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("reverts to the current page when the input is cleared", () => {
    const { onPageChange } = renderPager(4, 10);
    const input = screen.getByLabelText("Go to page") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onPageChange).not.toHaveBeenCalled();
    expect(input.value).toBe("4");
  });

  it("does not call onPageChange when committing the same page", () => {
    const { onPageChange } = renderPager(4, 10);
    const input = screen.getByLabelText("Go to page");
    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
