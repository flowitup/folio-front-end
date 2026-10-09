/**
 * "Load more" navigates to the next ?page= and stays busy (spinner, disabled)
 * until that page is rendered, not just for the tick router.push takes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Suspense, use, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BillingDocumentList } from "../billing-document-list";
import type { BillingDocument } from "@/types/billing";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("status=draft"),
  usePathname: () => "/en/billing/devis",
}));

vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  importBillingDocumentAction: vi.fn(),
  deleteBillingDocumentAction: vi.fn(),
  convertDevisToFactureAction: vi.fn(),
}));

const DOC = {
  id: "doc-1",
  kind: "devis",
  document_number: "DEV-2026-070",
  status: "draft",
  recipient_name: "Dupont",
  issue_date: "2026-09-01",
  total_ttc: "120.00",
} as BillingDocument;

/** Stands in for the server render of the next page: suspends until resolved. */
function NextPage({ ready }: { ready: Promise<void> }) {
  use(ready);
  return null;
}

/** Like the App Router, router.push renders the next page inside the caller's transition. */
function Harness({ ready }: { ready: Promise<void> }) {
  const [navigated, setNavigated] = useState(false);
  mockPush.mockImplementation(() => setNavigated(true));
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Suspense fallback={null}>
        <BillingDocumentList kind="devis" initialDocuments={[DOC]} initialTotal={70} />
        {navigated && <NextPage ready={ready} />}
      </Suspense>
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("BillingDocumentList load more", () => {
  // Outside act(): a transition that suspends inside a synchronous act scope is
  // never retried, so the click and the resolution run as they would in a browser.
  const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let previousActEnv: boolean | undefined;
  beforeEach(() => {
    previousActEnv = actEnv.IS_REACT_ACT_ENVIRONMENT;
  });
  afterEach(() => {
    actEnv.IS_REACT_ACT_ENVIRONMENT = previousActEnv;
  });

  it("stays disabled with a spinner until the next page has rendered", async () => {
    let finish!: () => void;
    const ready = new Promise<void>((resolve) => (finish = resolve));
    render(<Harness ready={ready} />);
    const button = screen.getByRole("button", { name: /load more/i }) as HTMLButtonElement;

    actEnv.IS_REACT_ACT_ENVIRONMENT = false;
    button.click();

    expect(mockPush).toHaveBeenCalledWith("/en/billing/devis?status=draft&page=2", { scroll: false });
    await waitFor(() => expect(button.disabled).toBe(true));
    expect(button.querySelector(".animate-spin")).not.toBeNull();
    // Still busy while the next page is loading.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(button.disabled).toBe(true);

    finish();

    await waitFor(() => expect(button.disabled).toBe(false));
    expect(button.querySelector(".animate-spin")).toBeNull();
  });
});
