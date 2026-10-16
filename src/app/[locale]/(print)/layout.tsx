import { pageTitle } from "@/lib/i18n/page-title";

/** "Facture · Folio" on the printable expense, not the generic app title. */
export const generateMetadata = pageTitle("invoices.print.heading");

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
