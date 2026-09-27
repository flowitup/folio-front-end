/** The persons API refuses searches under 2 characters: the typeahead must not send them. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
vi.mock("@/lib/api/persons", () => ({
  fetchPersons: vi.fn().mockResolvedValue([]),
  createPerson: vi.fn(),
}));

import { fetchPersons } from "@/lib/api/persons";
import { PersonTypeahead } from "../person-typeahead";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

async function type(value: string) {
  fireEvent.change(screen.getByTestId("person-typeahead-input"), { target: { value } });
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

describe("PersonTypeahead", () => {
  it("does not search on open or with one character, and asks for more", async () => {
    render(<PersonTypeahead value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(fetchPersons).not.toHaveBeenCalled();
    expect(screen.getByText("labor.typeahead.typeToSearch")).toBeInTheDocument();

    await type("a");
    expect(fetchPersons).not.toHaveBeenCalled();

    await type(" ab ");
    expect(fetchPersons).toHaveBeenCalledWith({ q: "ab", limit: 20 });
  });

  it("offers no Create entry when creating is not allowed", async () => {
    render(<PersonTypeahead value={null} onChange={vi.fn()} allowCreate={false} />);
    fireEvent.click(screen.getByRole("combobox"));
    await type("Nobody");
    expect(fetchPersons).toHaveBeenCalled();
    expect(screen.queryByText(/labor\.typeahead\.create/)).toBeNull();
  });
});
