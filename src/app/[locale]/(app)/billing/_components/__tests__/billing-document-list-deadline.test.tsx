/**
 * BillingDocumentList — factures show their due date, their project and how
 * many days an unpaid one is overdue; devis show their validity date.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BillingDocumentList } from "../billing-document-list";
import type { BillingDocument, BillingDocumentKind } from "@/types/billing";
import type { Project } from "@/types/project";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/billing/factures",
}));
vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  importBillingDocumentAction: vi.fn(),
  deleteBillingDocumentAction: vi.fn(),
  convertDevisToFactureAction: vi.fn(),
}));
const projects = [{ id: "p1", name: "Shopping Mall" }] as Project[];
vi.mock("@/context/ProjectContext", () => ({
  useOptionalProject: () => ({ projects }),
}));

const doc = (over: Partial<BillingDocument>) =>
  ({
    id: over.document_number,
    kind: "facture",
    status: "sent",
    recipient_name: "Client",
    issue_date: "2026-10-01",
    payment_due_date: null,
    validity_until: null,
    project_id: null,
    total_ttc: "120.00",
    issuer_legal_name: "Epsilon",
    ...over,
  }) as BillingDocument;

function renderList(kind: BillingDocumentKind, docs: BillingDocument[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BillingDocumentList kind={kind} initialDocuments={docs} initialTotal={docs.length} />
    </NextIntlClientProvider>,
  );
}

function rowOf(number: string) {
  return screen.getAllByRole("row").find((r) => r.textContent?.includes(number))!;
}

describe("BillingDocumentList due date, project and overdue", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("shows the due date, the project name and the days overdue of a sent facture", () => {
    renderList("facture", [
      doc({ document_number: "FAC-2026-002", payment_due_date: "2026-10-31", project_id: "p1" }),
    ]);
    const row = rowOf("FAC-2026-002");
    expect(within(row).getByTestId("billing-row-deadline").textContent).toBe("31/10/2026");
    expect(within(row).getByTestId("billing-row-project").textContent).toBe("Shopping Mall");
    expect(within(row).getByTestId("billing-overdue-days").textContent).toBe("20 days overdue");
    expect(within(row).getByText("Sent")).toBeDefined();
    expect(screen.getByText("Due")).toBeDefined();
  });

  it("shows no overdue label on a paid facture, one not yet due or one without project", () => {
    renderList("facture", [
      doc({ document_number: "FAC-1", status: "paid", payment_due_date: "2026-10-31" }),
      doc({ document_number: "FAC-2", payment_due_date: "2026-11-20" }),
    ]);
    expect(within(rowOf("FAC-1")).queryByTestId("billing-overdue-days")).toBeNull();
    expect(within(rowOf("FAC-2")).queryByTestId("billing-overdue-days")).toBeNull();
    expect(within(rowOf("FAC-1")).getByTestId("billing-row-project").textContent).toBe("—");
  });

  it("shows the days on a facture marked overdue by hand, in place of its plain pill", () => {
    renderList("facture", [
      doc({ document_number: "FAC-3", status: "overdue", payment_due_date: "2026-11-19" }),
    ]);
    const row = rowOf("FAC-3");
    expect(within(row).getByTestId("billing-overdue-days").textContent).toBe("1 day overdue");
    expect(within(row).queryByText("Overdue")).toBeNull();
  });

  it("shows the validity date of a devis, never an overdue label", () => {
    renderList("devis", [
      doc({ document_number: "DEV-1", kind: "devis", validity_until: "2026-10-01" }),
    ]);
    const row = rowOf("DEV-1");
    expect(within(row).getByTestId("billing-row-deadline").textContent).toBe("01/10/2026");
    expect(within(row).queryByTestId("billing-overdue-days")).toBeNull();
    expect(screen.getByText("Valid until")).toBeDefined();
  });
});
