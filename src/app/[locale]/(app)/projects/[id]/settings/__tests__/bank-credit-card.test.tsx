import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Project } from "@/types/project";

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }));
vi.mock("../actions", () => ({ updateBankCredit: mockUpdate }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BankCreditCard } from "../bank-credit-card";

const PROJECT = { id: "p-1", name: "Villa", budget: 10000, budget_source: "" } as unknown as Project;

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BankCreditCard project={PROJECT} />
    </NextIntlClientProvider>
  );
}

describe("BankCreditCard", () => {
  it("previews the typed amount with its cents", () => {
    renderCard();
    fireEvent.change(screen.getByLabelText(en.projects.budgetLabel), { target: { value: "50000,5" } });
    expect(screen.getByText((t) => t.replace(/[  ]/g, " ") === "50 000,50 €")).toBeInTheDocument();
  });

  it("treats the saved amount as the new baseline", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    renderCard();
    fireEvent.change(screen.getByLabelText(en.projects.budgetLabel), { target: { value: "12000" } });
    const save = screen.getByRole("button", { name: en.projects.save });
    fireEvent.click(save);
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: en.projects.save })).toBeDisabled());
    fireEvent.change(screen.getByLabelText(en.projects.budgetLabel), { target: { value: "10000" } });
    expect(screen.getByRole("button", { name: en.projects.save })).not.toBeDisabled();
  });
});
