/**
 * image-url-field.test.tsx — ImageUrlField, the supplier-link input shared by
 * the chiffrage article image dialog and the library product dialogs.
 *
 * Tests: fetch button only with onFetch; disabled while empty or fetching;
 * Enter fetches without submitting a surrounding form; inline error is
 * announced and marks the input invalid.
 */

import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageUrlField } from "../image-url-field";

function Harness({
  initial = "",
  onFetch,
  fetching,
  error,
}: {
  initial?: string;
  onFetch?: () => void;
  fetching?: boolean;
  error?: string | null;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ImageUrlField
      id="image-url"
      label="Supplier link"
      value={value}
      onChange={setValue}
      note="Supplier sites only."
      error={error}
      fetchLabel="Fetch"
      onFetch={onFetch}
      fetching={fetching}
    />
  );
}

describe("ImageUrlField", () => {
  it("renders the label, note and no button without onFetch", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Supplier link")).toBeInTheDocument();
    expect(screen.getByText("Supplier sites only.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("enables the fetch button only once a link is typed", () => {
    const onFetch = vi.fn();
    render(<Harness onFetch={onFetch} />);
    const button = screen.getByRole("button", { name: "Fetch" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Supplier link"), {
      target: { value: "https://media.adeo.com/a.jpg" },
    });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onFetch).toHaveBeenCalledTimes(1);
  });

  it("locks the field and the button while a fetch is in flight", () => {
    render(<Harness initial="https://media.adeo.com/a.jpg" onFetch={vi.fn()} fetching />);
    expect(screen.getByLabelText("Supplier link")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fetch" })).toBeDisabled();
  });

  it("Enter fetches and does not submit the surrounding form", () => {
    const onFetch = vi.fn();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness initial="https://media.adeo.com/a.jpg" onFetch={onFetch} />
      </form>
    );

    // fireEvent returns false when the handler called preventDefault — that is
    // what stops the browser's implicit form submission on Enter.
    const notPrevented = fireEvent.keyDown(screen.getByLabelText("Supplier link"), {
      key: "Enter",
    });

    expect(notPrevented).toBe(false);
    expect(onFetch).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the error as an alert and marks the input invalid", () => {
    render(<Harness onFetch={vi.fn()} error="This site is not accepted." />);
    expect(screen.getByRole("alert")).toHaveTextContent("This site is not accepted.");
    expect(screen.getByLabelText("Supplier link")).toHaveAttribute("aria-invalid", "true");
  });
});
