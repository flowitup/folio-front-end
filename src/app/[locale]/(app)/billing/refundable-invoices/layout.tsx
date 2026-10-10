import type { ReactNode } from "react";
import { pageTitle } from "@/lib/i18n/page-title";

/** Refundable invoices: a client page, so its tab title is set here. */
export const generateMetadata = pageTitle("billing.refundable.title");

export default function RefundableInvoicesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
