/**
 * chiffrage-library-inventory-01: the merge result names the company profiles
 * moved or merged and the carried account; two different accounts (409) get
 * their own message.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/persons", () => ({ mergePersons: vi.fn() }));

let pick = 0;
vi.mock("@/components/persons/person-typeahead", () => ({
  PersonTypeahead: ({ onChange }: { onChange: (p: { id: string; name: string }) => void }) => {
    const n = ++pick;
    return (
      <button type="button" onClick={() => onChange({ id: `p${n % 2}`, name: `Person ${n % 2}` })}>
        pick {n % 2}
      </button>
    );
  },
}));

import { toast } from "sonner";
import { mergePersons } from "@/lib/api/persons";
import { ApiError } from "@/lib/api/http";
import { PersonMergeForm } from "../person-merge-form";

function renderForm() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PersonMergeForm />
    </NextIntlClientProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: "pick 1" }));
  fireEvent.click(screen.getByRole("button", { name: "pick 0" }));
  const merges = screen.getAllByRole("button", { name: enMessages.personsMerge.merge });
  fireEvent.click(merges[0]);
}

async function confirm() {
  const buttons = await screen.findAllByRole("button", { name: enMessages.personsMerge.merge });
  fireEvent.click(buttons[buttons.length - 1]);
}

beforeEach(() => {
  vi.clearAllMocks();
  pick = 0;
});

describe("PersonMergeForm", () => {
  it("names the profiles moved and merged and the carried account", async () => {
    vi.mocked(mergePersons).mockResolvedValue({
      target_person_id: "p0",
      workers_reassigned: 0,
      profiles_moved: 1,
      profiles_merged: 2,
      account_linked: true,
    });
    renderForm();
    await confirm();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const description = vi.mocked(toast.success).mock.calls[0][1]?.description as string;
    expect(description).toContain("Company profiles: 1 moved, 2 merged.");
    expect(description).toContain(enMessages.personsMerge.mergedAccount);
  });

  it("explains a refusal between two different accounts", async () => {
    vi.mocked(mergePersons).mockRejectedValue(new ApiError("HTTP 409", 409));
    renderForm();
    await confirm();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(enMessages.personsMerge.conflictAccounts)
    );
  });
});
