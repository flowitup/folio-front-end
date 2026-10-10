/**
 * NewInvoicePage on a project the caller cannot open (another company's, or
 * one they are not on): the API refuses the project, so the page says so
 * instead of a full form whose save can only fail. Other load failures stay
 * non-fatal.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api/http";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api/invoice-api", () => ({ createInvoice: vi.fn() }));
vi.mock("@/lib/api/projects", () => ({ fetchProjectById: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/components/invoices/invoice-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/invoices/invoice-form")>();
  return { ...actual, InvoiceForm: () => <form data-testid="invoice-form" /> };
});

import { fetchProjectById } from "@/lib/api/projects";
import NewInvoicePage from "../page";

const mockFetchProject = vi.mocked(fetchProjectById);

beforeEach(() => vi.clearAllMocks());

describe("NewInvoicePage — project access", () => {
  it("shows a no-access message instead of the form when the API refuses the project", async () => {
    mockFetchProject.mockRejectedValue(new ApiError("HTTP 403: FORBIDDEN", 403, { error: "Forbidden" }));
    render(<NewInvoicePage />);

    await waitFor(() => expect(screen.getByText("loadForbidden")).toBeInTheDocument());
    expect(screen.queryByTestId("invoice-form")).toBeNull();
  });

  it("keeps the form when the project fetch fails for another reason", async () => {
    mockFetchProject.mockRejectedValue(new ApiError("HTTP 500: INTERNAL SERVER ERROR", 500, {}));
    render(<NewInvoicePage />);

    await waitFor(() => expect(mockFetchProject).toHaveBeenCalled());
    expect(screen.getByTestId("invoice-form")).toBeInTheDocument();
    expect(screen.queryByText("loadForbidden")).toBeNull();
  });

  it("renders the form for a project the caller can open", async () => {
    mockFetchProject.mockResolvedValue({ id: "proj-1", company_id: "c-1", my_permissions: [] } as never);
    render(<NewInvoicePage />);

    await waitFor(() => expect(mockFetchProject).toHaveBeenCalled());
    expect(screen.getByTestId("invoice-form")).toBeInTheDocument();
  });
});
