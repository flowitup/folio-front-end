import type { ReactNode } from "react";
import { pageTitle } from "@/lib/i18n/page-title";

/** A project's expenses (list, new, detail): client pages, so their tab title is set here. */
export const generateMetadata = pageTitle("navigation.invoices");

export default function ProjectInvoicesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
