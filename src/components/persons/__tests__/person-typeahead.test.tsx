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
    vi.advanceTimersByTime(400);
  });
}

describe("PersonTypeahead", () => {
  it("does not search on open or with one character, and asks for more", async () => {
    render(<PersonTypeahead value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    await act(async () => {
      vi.advanceTimersByTime(400);
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

describe("PersonTypeahead — people already on the project", () => {
  it("lists them as unavailable and never picks them", async () => {
    vi.mocked(fetchPersons).mockResolvedValue([
      { id: "p-on", name: "Alpha Éloïse", phone: "+33620600001" },
      { id: "p-free", name: "Alpha Bravo", phone: null },
    ]);
    const onChange = vi.fn();
    render(<PersonTypeahead value={null} onChange={onChange} excludeIds={["p-on"]} />);
    fireEvent.click(screen.getByRole("combobox"));
    await type("Alpha");

    const taken = screen.getByText("Alpha Éloïse").closest("[cmdk-item]") as HTMLElement;
    expect(taken).toHaveAttribute("aria-disabled", "true");
    expect(taken.textContent).toContain("labor.typeahead.alreadyOnProject");
    fireEvent.click(taken);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Alpha Bravo"));
    expect(onChange).toHaveBeenCalledWith({ id: "p-free", name: "Alpha Bravo", phone: null });
  });
});

describe("PersonTypeahead — creating a new person", () => {
  it("hands back a draft and saves nothing (no orphan person on cancel)", async () => {
    vi.mocked(fetchPersons).mockResolvedValue([]);
    const onChange = vi.fn();
    render(<PersonTypeahead value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    await type("Hoàng Văn Mới");

    fireEvent.click(screen.getByText("labor.typeahead.create"));
    expect(onChange).toHaveBeenCalledWith({ id: "", name: "Hoàng Văn Mới", phone: null, draft: true });
  });

  it("a phone typed in another format finds the person and offers no duplicate", async () => {
    vi.mocked(fetchPersons).mockResolvedValue([{ id: "p-1", name: "Membre", phone: "+33620300004" }]);
    render(<PersonTypeahead value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    await type("06 20 30 00 04");

    expect(screen.getByText("Membre")).toBeInTheDocument();
    expect(screen.queryByText(/labor\.typeahead\.create/)).toBeNull();
  });

  it("an unknown phone becomes the draft's phone, not its name", async () => {
    vi.mocked(fetchPersons).mockResolvedValue([]);
    const onChange = vi.fn();
    render(<PersonTypeahead value={null} onChange={onChange} companyId="co-1" />);
    fireEvent.click(screen.getByRole("combobox"));
    await type("06 20 30 00 09");
    expect(fetchPersons).toHaveBeenCalledWith({ q: "06 20 30 00 09", limit: 20, companyId: "co-1" });

    fireEvent.click(screen.getByText("labor.typeahead.createWithPhone"));
    expect(onChange).toHaveBeenCalledWith({ id: "", name: "", phone: "06 20 30 00 09", draft: true });
  });
});

describe("PersonTypeahead — refused search", () => {
  it("shows the wait and hides Create when the search is rate limited", async () => {
    vi.mocked(fetchPersons).mockRejectedValue(Object.assign(new Error("429"), { status: 429, retryAfter: 12 }));
    render(<PersonTypeahead value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    await type("Phạm Đức");
    expect(screen.getByRole("alert").textContent).toContain("common.rateLimit.seconds");
    expect(screen.queryByText(/labor\.typeahead\.create/)).toBeNull();

    vi.mocked(fetchPersons).mockResolvedValue([]);
    fireEvent.click(screen.getByText("labor.typeahead.retrySearch"));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText("labor.typeahead.create")).toBeInTheDocument();
  });
});
