/** highlightMention: wraps every @folio token in a <mark>, case-insensitively, leaves the rest untouched. */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { highlightMention } from "../highlight-mention";

describe("highlightMention", () => {
  it("wraps a single @folio mention in a <mark>", () => {
    const { container } = render(<>{highlightMention("hey @folio what's the plan?")}</>);
    const mark = container.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("@folio");
    expect(container.textContent).toBe("hey @folio what's the plan?");
  });

  it("wraps every occurrence when @folio appears more than once", () => {
    const { container } = render(<>{highlightMention("@folio ping @folio again")}</>);
    expect(container.querySelectorAll("mark")).toHaveLength(2);
  });

  it("matches case-insensitively", () => {
    const { container } = render(<>{highlightMention("Ping @Folio please")}</>);
    const mark = container.querySelector("mark");
    expect(mark?.textContent).toBe("@Folio");
  });

  it("renders plain text unchanged when there is no mention", () => {
    const { container } = render(<>{highlightMention("no trigger here")}</>);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("no trigger here");
  });
});
