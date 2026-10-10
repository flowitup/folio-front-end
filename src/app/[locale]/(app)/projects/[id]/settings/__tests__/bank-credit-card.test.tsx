import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Project } from "@/types/project";

const { mockUpdate, mockRefetch } = vi.hoisted(() => ({ mockUpdate: vi.fn(), mockRefetch: vi.fn() }));
vi.mock("../actions", () => ({ updateBankCredit: mockUpdate }));
vi.mock("@/context/ProjectContext", () => ({ useOptionalProject: () => ({ refetch: mockRefetch }) }));
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

  it("reloads the cached project list so Overview, Projects and Expense show the new credit", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    mockRefetch.mockClear();
    renderCard();
    fireEvent.change(screen.getByLabelText(en.projects.budgetLabel), { target: { value: "31000" } });
    fireEvent.click(screen.getByRole("button", { name: en.projects.save }));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
  });

  it("does not reload the project list when the save fails", async () => {
    mockUpdate.mockResolvedValue({ ok: false, error: "server" });
    mockRefetch.mockClear();
    renderCard();
    fireEvent.change(screen.getByLabelText(en.projects.budgetLabel), { target: { value: "31000" } });
    fireEvent.click(screen.getByRole("button", { name: en.projects.save }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});

describe("BankCreditCard — network failure", () => {
  it("toasts the error and frees Save when the save action cannot be reached", async () => {
    const { toast } = await import("sonner");
    // What a server action call does offline: the promise rejects.
    mockUpdate.mockRejectedValue(new TypeError("Failed to fetch"));
    renderCard();
    fireEvent.change(screen.getByLabelText(en.projects.budgetLabel), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: en.projects.save }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.projects.settingsSaveError));
    // Back to "Save", enabled: the amount is still unsaved.
    await waitFor(() => expect(screen.getByRole("button", { name: en.projects.save })).not.toBeDisabled());
    expect(screen.queryByText(en.projects.saving)).toBeNull();
  });
});
