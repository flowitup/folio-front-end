import type { ReactNode } from "react";
import { pageTitle } from "@/lib/i18n/page-title";

/** Quotes (list, new, edit): the tab title of every page in the section. */
export const generateMetadata = pageTitle("meta.quotes");

export default function DevisLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
