import type { ReactNode } from "react";
import { pageTitle } from "@/lib/i18n/page-title";

/** Templates (list, new, edit): the tab title of every page in the section. */
export const generateMetadata = pageTitle("billing.templates.list.title");

export default function TemplatesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
