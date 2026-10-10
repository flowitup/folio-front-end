import type { ReactNode } from "react";
import { pageTitle } from "@/lib/i18n/page-title";

/** Invoices (list, new, edit): the tab title of every page in the section. */
export const generateMetadata = pageTitle("meta.invoices");

export default function FacturesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
