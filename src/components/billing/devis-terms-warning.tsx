/**
 * Non-blocking hint under a facture's notes / terms (and in its "mark as
 * sent" dialog) when the text looks copied from the quote it came from.
 */

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

export function DevisTermsWarning({ id }: { id?: string }) {
  const t = useTranslations("billing.form");
  return (
    <p
      id={id}
      role="status"
      data-testid="devis-terms-warning"
      className="flex items-start gap-1.5 rounded-md border border-[var(--warning)]/40 bg-[var(--warning-tint)] px-2.5 py-1.5 text-[12.5px] text-[#8e6418]"
    >
      <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
      <span>{t("devisTermsWarning")}</span>
    </p>
  );
}
