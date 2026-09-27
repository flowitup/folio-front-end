/**
 * Settings › Project shows the saved invoice prefix (the project list the
 * context holds does not carry it) and can clear it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const { mockFetchProjectById, mockUpdate, mockToastError } = vi.hoisted(() => ({
  mockFetchProjectById: vi.fn(),
  mockUpdate: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    selectedProject: { id: "p1", name: "Downtown", invoice_prefix: null },
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/api/projects", () => ({ fetchProjectById: mockFetchProjectById }));
vi.mock("../_actions/invoice-prefix-actions", () => ({ updateInvoicePrefix: mockUpdate }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mockToastError } }));

import { InvoicePrefixSection } from "../invoice-prefix-section";

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <InvoicePrefixSection />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchProjectById.mockResolvedValue({ id: "p1", name: "Downtown", invoice_prefix: "QAMGR" });
  mockUpdate.mockResolvedValue({ ok: true });
});

describe("InvoicePrefixSection", () => {
  it("shows the saved prefix and its preview", async () => {
    renderSection();
    await waitFor(() => expect(screen.getByLabelText(en.projects.invoicePrefix)).toHaveValue("QAMGR"));
    expect(screen.getByText(`QAMGR-${new Date().getFullYear()}-0001`)).toBeInTheDocument();
  });

  it("can clear a saved prefix", async () => {
    renderSection();
    const input = screen.getByLabelText(en.projects.invoicePrefix);
    await waitFor(() => expect(input).toHaveValue("QAMGR"));
    await userEvent.clear(input);
    const save = screen.getByRole("button", { name: en.projects.save });
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(mockUpdate).toHaveBeenCalledWith("p1", "");
  });

  it("says a refused save is a permission problem, not 'try again'", async () => {
    mockUpdate.mockResolvedValue({ ok: false, error: "forbidden" });
    renderSection();
    const input = screen.getByLabelText(en.projects.invoicePrefix);
    await waitFor(() => expect(input).toHaveValue("QAMGR"));
    await userEvent.type(input, "X");
    await userEvent.click(screen.getByRole("button", { name: en.projects.save }));
    expect(mockToastError).toHaveBeenCalledWith(en.projects.settingsForbidden);
  });
});
