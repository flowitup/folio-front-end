/**
 * The in-app question asked before an expense is deleted: it names the
 * expense by its number and says how much, so the user knows what goes.
 */

import type { Invoice } from "@/types/invoice";
import { formatEUR } from "@/lib/utils/formatters";

type DeleteKey =
  | "deleteConfirmTitle"
  | "deleteConfirmBody"
  | "deleteConfirmBodyNoRecipient"
  | "delete"
  | "cancel";

export function expenseDeleteQuestion(
  t: (key: DeleteKey, values?: Record<string, string | number>) => string,
  invoice: Pick<Invoice, "invoice_number" | "total_amount" | "recipient_name">,
) {
  const amount = formatEUR(invoice.total_amount);
  const recipient = invoice.recipient_name?.trim();
  return {
    title: t("deleteConfirmTitle", { number: invoice.invoice_number }),
    description: recipient
      ? t("deleteConfirmBody", { amount, recipient })
      : t("deleteConfirmBodyNoRecipient", { amount }),
    confirmLabel: t("delete"),
    cancelLabel: t("cancel"),
    destructive: true,
  };
}
