"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";

/**
 * Backwards-compat redirect: the dedicated detail route now opens inline as
 * an expandable row in the invoice list via `?invoice=<id>`. Direct visits
 * land here and bounce to the list with the row expanded, preserving deep-link
 * behavior.
 */
export default function InvoiceDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const projectId = params.id as string;
  const invoiceId = params.invoiceId as string;

  useEffect(() => {
    router.replace(`/${locale}/projects/${projectId}/invoices?invoice=${invoiceId}`);
  }, [router, locale, projectId, invoiceId]);

  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
