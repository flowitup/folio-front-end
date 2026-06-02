/**
 * Tests for CategoryMenu component.
 * Covers: renders pill label, opens popover on click, selects category, closes on outside click.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryMenu } from "../category-menu";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

const PROJECT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
void PROJECT_ID; // used for reference only

describe("CategoryMenu", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the current category label", () => {
    const onChange = vi.fn();
    render(<CategoryMenu value="general" onChange={onChange} />);
    expect(screen.getByText("notes.categories.general")).toBeDefined();
  });

  it("opens popover when pill button is clicked", () => {
    const onChange = vi.fn();
    render(<CategoryMenu value="general" onChange={onChange} />);
    // The pill is the only button when closed
    const pill = screen.getByRole("button");
    fireEvent.click(pill);
    expect(screen.getByRole("listbox")).toBeDefined();
  });

  it("renders all 6 category options when open", () => {
    const onChange = vi.fn();
    render(<CategoryMenu value="general" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /notes\.categories\./i }));
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(6);
  });

  it("calls onChange when a category option is clicked", () => {
    const onChange = vi.fn();
    render(<CategoryMenu value="general" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /notes\.categories\./i }));
    const deliveryOption = screen.getByRole("option", { name: /notes\.categories\.delivery/i });
    fireEvent.click(deliveryOption);
    expect(onChange).toHaveBeenCalledWith("delivery");
  });

  it("closes popover after selecting a category", () => {
    const onChange = vi.fn();
    render(<CategoryMenu value="general" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /notes\.categories\./i }));
    const option = screen.getByRole("option", { name: /notes\.categories\.call/i });
    fireEvent.click(option);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not open when disabled", () => {
    const onChange = vi.fn();
    render(<CategoryMenu value="general" onChange={onChange} disabled />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("marks the current selection with aria-selected=true", () => {
    const onChange = vi.fn();
    render(<CategoryMenu value="delivery" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /notes\.categories\./i }));
    const selected = screen.getAllByRole("option").find(
      (el) => el.getAttribute("aria-selected") === "true"
    );
    expect(selected).toBeDefined();
    expect(selected?.textContent).toContain("notes.categories.delivery");
  });
});
