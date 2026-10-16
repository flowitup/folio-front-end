import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const updateCompanyAction = vi.fn();
vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  updateCompanyAction: (...args: unknown[]) => updateCompanyAction(...args),
}));

import { CompanyHiddenSectionsCard } from "../company-hidden-sections-card";

beforeEach(() => vi.clearAllMocks());

describe("CompanyHiddenSectionsCard", () => {
  it("saves the whole list in canonical order when a section is switched off", async () => {
    updateCompanyAction.mockResolvedValue({ ok: true, data: { hidden_sections: ["library", "photos"] } });
    const onSaved = vi.fn();
    render(
      <CompanyHiddenSectionsCard
        companyId="co-1"
        companyName="Alpha"
        initialHidden={["photos"]}
        onSaved={onSaved}
      />,
    );
    const photos = screen.getByTestId("hidden-section-toggle-photos") as HTMLInputElement;
    expect(photos.checked).toBe(false);
    fireEvent.click(screen.getByTestId("hidden-section-toggle-library"));
    await waitFor(() =>
      expect(updateCompanyAction).toHaveBeenCalledWith("co-1", {
        hidden_sections: ["library", "photos"],
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect((screen.getByTestId("hidden-section-toggle-library") as HTMLInputElement).checked).toBe(false);
  });

  it("switches a section back on", async () => {
    updateCompanyAction.mockResolvedValue({ ok: true, data: { hidden_sections: [] } });
    render(<CompanyHiddenSectionsCard companyId="co-1" companyName="Alpha" initialHidden={["photos"]} />);
    fireEvent.click(screen.getByTestId("hidden-section-toggle-photos"));
    await waitFor(() =>
      expect(updateCompanyAction).toHaveBeenCalledWith("co-1", { hidden_sections: [] }),
    );
  });
});
