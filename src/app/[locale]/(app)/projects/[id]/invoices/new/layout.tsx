import { pageTitle } from "@/lib/i18n/page-title";

/** "Nouvelle dépense · Folio" rather than the section's "Dépenses". */
export const generateMetadata = pageTitle("meta.newExpense");

export default function NewExpenseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
