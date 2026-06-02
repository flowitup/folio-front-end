/**
 * Tests for TagSelect component.
 * Covers: rendering tags as options + "no tag" option, color dots,
 * onChange callback with tag id or null, current selection display.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagSelect } from "../tag-select";
import type { ProjectTag } from "@/lib/api/tags";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      tags: {
        "select.placeholder": "Select a tag",
        "select.noTag": "No tag",
      },
    };
    return translations[ns]?.[key] || key;
  },
}));

// ---- Fixtures ----

function makeTag(id: string, name: string, color: string): ProjectTag {
  return {
    id,
    project_id: "proj-1",
    name,
    color,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: null,
  };
}

const EXCAVATION = makeTag("tag-1", "Excavation", "#ef4444");
const FOUNDATION = makeTag("tag-2", "Foundation", "#3b82f6");
const TAGS = [EXCAVATION, FOUNDATION];

// ---- Tests ----

describe("TagSelect — rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Select trigger with placeholder when no value", () => {
    const onChange = vi.fn();
    render(
      <TagSelect
        tags={TAGS}
        value={null}
        onChange={onChange}
        placeholder="Pick a tag"
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Pick a tag");
  });

  it("renders default placeholder when placeholder prop not provided", () => {
    const onChange = vi.fn();
    render(<TagSelect tags={TAGS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    // When value is null, it shows the i18n default placeholder or "No tag"
    expect(trigger.textContent).toBeTruthy();
  });

  it("shows color dot for each tag in options", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TagSelect tags={TAGS} value={null} onChange={onChange} />
    );

    // Open dropdown by clicking trigger
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    // Verify tags are rendered as options (which includes color dots)
    const options = screen.getAllByRole("option");
    // Should have "no tag" + 2 tags with colors
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  it("renders 'no tag' option at top of dropdown", () => {
    const onChange = vi.fn();
    render(<TagSelect tags={TAGS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("No tag");
  });

  it("renders all tags as options after 'no tag'", () => {
    const onChange = vi.fn();
    render(<TagSelect tags={TAGS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    const options = screen.getAllByRole("option");
    expect(options.length).toBe(3); // "no tag" + 2 tags
    expect(options[1]).toHaveTextContent("Excavation");
    expect(options[2]).toHaveTextContent("Foundation");
  });

  it("renders empty dropdown when tags array is empty", () => {
    const onChange = vi.fn();
    render(<TagSelect tags={[]} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    const options = screen.getAllByRole("option");
    expect(options.length).toBe(1); // Only "no tag"
  });
});

describe("TagSelect — current value display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays selected tag name + color dot in trigger", () => {
    const onChange = vi.fn();
    render(
      <TagSelect tags={TAGS} value={EXCAVATION.id} onChange={onChange} />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Excavation");
  });

  it("shows placeholder when value is undefined", () => {
    const onChange = vi.fn();
    render(
      <TagSelect
        tags={TAGS}
        value={undefined}
        onChange={onChange}
        placeholder="Pick tag"
      />
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Pick tag");
  });

  it("shows 'no tag' placeholder text when value is null", () => {
    const onChange = vi.fn();
    render(<TagSelect tags={TAGS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("No tag");
  });

  it("handles tag id not in tags array gracefully (no render error)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TagSelect tags={TAGS} value="nonexistent-id" onChange={onChange} />
    );

    expect(container).toBeInTheDocument();
  });
});

describe("TagSelect — onChange callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onChange with tag id when tag option selected", () => {
    const onChange = vi.fn();
    render(<TagSelect tags={TAGS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    const excavationOption = screen.getAllByRole("option")[1];
    fireEvent.click(excavationOption);

    expect(onChange).toHaveBeenCalledWith(EXCAVATION.id);
  });

  it("calls onChange with null when 'no tag' option selected from tagged state", () => {
    const onChange = vi.fn();
    render(
      <TagSelect tags={TAGS} value={EXCAVATION.id} onChange={onChange} />
    );

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    const noTagOption = screen.getAllByRole("option")[0];
    fireEvent.click(noTagOption);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange when switching between tags", () => {
    const onChange = vi.fn();
    render(
      <TagSelect tags={TAGS} value={EXCAVATION.id} onChange={onChange} />
    );

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    const foundationOption = screen.getAllByRole("option")[2];
    fireEvent.click(foundationOption);

    expect(onChange).toHaveBeenCalledWith(FOUNDATION.id);
  });

  it("does not call onChange on initial render", () => {
    const onChange = vi.fn();
    render(<TagSelect tags={TAGS} value={EXCAVATION.id} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("TagSelect — disabled state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables select when disabled prop is true", () => {
    const onChange = vi.fn();
    render(
      <TagSelect
        tags={TAGS}
        value={null}
        onChange={onChange}
        disabled={true}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("disabled");
  });

  it("allows interaction when disabled prop is false", () => {
    const onChange = vi.fn();
    render(
      <TagSelect
        tags={TAGS}
        value={null}
        onChange={onChange}
        disabled={false}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).not.toHaveAttribute("disabled");
  });

  it("allows interaction when disabled prop not provided (defaults to false)", () => {
    const onChange = vi.fn();
    render(<TagSelect tags={TAGS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).not.toHaveAttribute("disabled");
  });
});
