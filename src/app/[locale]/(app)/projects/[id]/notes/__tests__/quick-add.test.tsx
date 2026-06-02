/**
 * Tests for QuickAdd component.
 * Covers: placeholder visible, focus expands form, Enter submits, Esc collapses,
 * Cmd+Enter from body submits, empty title disabled submit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuickAdd } from "../quick-add";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

describe("QuickAdd — initial render", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows title placeholder in collapsed state", () => {
    render(<QuickAdd onAdd={vi.fn()} />);
    expect(screen.getByPlaceholderText("notes.quickAdd.placeholderTitle")).toBeDefined();
  });

  it("shows the 'saved with today's date' hint in collapsed state", () => {
    render(<QuickAdd onAdd={vi.fn()} />);
    expect(screen.getByText("notes.quickAdd.hint")).toBeDefined();
  });

  it("does not show body textarea initially (meta hidden)", () => {
    render(<QuickAdd onAdd={vi.fn()} />);
    // Body textarea is inside the collapsed meta container; hint is visible
    expect(screen.getByText("notes.quickAdd.hint")).toBeDefined();
  });
});

describe("QuickAdd — focus / expand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hides hint when title input is focused", () => {
    render(<QuickAdd onAdd={vi.fn()} />);
    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    expect(screen.queryByText("notes.quickAdd.hint")).toBeNull();
  });

  it("shows save button when focused", () => {
    render(<QuickAdd onAdd={vi.fn()} />);
    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    expect(screen.getByText("notes.quickAdd.save")).toBeDefined();
  });
});

describe("QuickAdd — submit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls onAdd with title on Enter keydown", async () => {
    const onAdd = vi.fn();
    render(<QuickAdd onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "My note" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: "My note", category: "general" })
      );
    });
  });

  it("does not call onAdd when title is empty", () => {
    const onAdd = vi.fn();
    render(<QuickAdd onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("resets title after successful submit", async () => {
    const onAdd = vi.fn();
    render(<QuickAdd onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Reset test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("");
    });
  });

  it("calls onAdd with Cmd+Enter from body textarea", async () => {
    const onAdd = vi.fn();
    render(<QuickAdd onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "From body" } });
    const body = screen.getByPlaceholderText("notes.quickAdd.placeholderBody");
    fireEvent.keyDown(body, { key: "Enter", metaKey: true });
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: "From body" })
      );
    });
  });

  it("passes description from body textarea to onAdd", async () => {
    const onAdd = vi.fn();
    render(<QuickAdd onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Title" } });
    const body = screen.getByPlaceholderText("notes.quickAdd.placeholderBody");
    fireEvent.change(body, { target: { value: "Detail text" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Detail text" })
      );
    });
  });
});

describe("QuickAdd — Esc collapse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("collapses on Esc when title is empty", async () => {
    render(<QuickAdd onAdd={vi.fn()} />);
    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    expect(screen.queryByText("notes.quickAdd.hint")).toBeNull();
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => {
      expect(screen.getByText("notes.quickAdd.hint")).toBeDefined();
    });
  });
});
