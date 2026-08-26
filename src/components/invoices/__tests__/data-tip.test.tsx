import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDataTip } from "@/components/invoices/data-tip";

/** Host wiring the hook the way every dataviz card does. */
function Host() {
  const { onMouseMove, onMouseLeave, overlay } = useDataTip();
  return (
    <div onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <span data-tip="Mark|1 234 €|meta" data-testid="mark" />
      {overlay}
    </div>
  );
}

function markWithRect(rect: Partial<DOMRect>) {
  const mark = screen.getByTestId("mark");
  mark.getBoundingClientRect = () =>
    ({ left: 100, width: 50, top: 300, bottom: 320, ...rect }) as DOMRect;
  return mark;
}

function tipEl(): HTMLElement {
  // The overlay portals to document.body so its fixed px offsets escape the
  // app shell's zoomed content wrapper (which rescales them off the mark).
  const tip = document.body.querySelector<HTMLElement>(":scope > .fixed.z-50");
  expect(tip, "tip should portal to document.body").not.toBeNull();
  return tip!;
}

describe("useDataTip placement", () => {
  it("anchors above the mark's top-center when there is headroom", () => {
    render(<Host />);
    fireEvent.mouseMove(markWithRect({ top: 300, bottom: 320 }));

    const tip = tipEl();
    expect(tip.style.left).toBe("125px");
    expect(tip.style.top).toBe("300px");
    expect(tip.style.transform).toContain("-130%");
    expect(tip.textContent).toContain("1 234 €");
  });

  it("flips below the mark when too close to the viewport top to fit above", () => {
    render(<Host />);
    fireEvent.mouseMove(markWithRect({ top: 40, bottom: 60 }));

    const tip = tipEl();
    expect(tip.style.top).toBe("60px");
    expect(tip.style.transform).toContain("10px");
    expect(tip.style.transform).not.toContain("-130%");
  });

  it("clears the tip when the pointer leaves the container", () => {
    render(<Host />);
    const mark = markWithRect({});
    fireEvent.mouseMove(mark);
    expect(document.body.querySelector(":scope > .fixed.z-50")).not.toBeNull();

    fireEvent.mouseLeave(mark.parentElement!);
    expect(document.body.querySelector(":scope > .fixed.z-50")).toBeNull();
  });
});
