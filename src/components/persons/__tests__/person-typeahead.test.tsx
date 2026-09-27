import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("@/lib/api/persons", () => ({ fetchPersons: mockFetch, createPerson: vi.fn() }));

import { PersonTypeahead } from "../person-typeahead";

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue([]);
});

describe("PersonTypeahead", () => {
  it("does not search with fewer than two characters (the API refuses them)", async () => {
    render(<PersonTypeahead value={null} onChange={vi.fn()} debounceMs={0} />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(await screen.findByTestId("person-typeahead-input"), { target: { value: "a" } });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("person-typeahead-input"), { target: { value: "an" } });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith({ q: "an", limit: 20 }));
  });

  it("offers no Create entry when creating is not allowed", async () => {
    render(<PersonTypeahead value={null} onChange={vi.fn()} debounceMs={0} allowCreate={false} />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(await screen.findByTestId("person-typeahead-input"), { target: { value: "Nobody" } });
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.queryByText(/Create/)).toBeNull();
  });
});
