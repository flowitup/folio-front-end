"use client";

/**
 * Translated text for a failed billing action. The server actions return an
 * error code plus the API's own message, which is English (and can carry a
 * UUID or a field path), so a toast or banner shows the code's translation
 * instead, and the caller's own message (e.g. "Failed to delete document")
 * for codes with no wording of their own.
 */

import { useCallback } from "react";
import { useTranslations } from "next-intl";

export type BillingErrorSubject = "document" | "template";

export function useBillingErrorMessage(subject: BillingErrorSubject = "document") {
  const t = useTranslations("billing");
  return useCallback(
    (error: { code: string }, fallback: string): string => {
      switch (error.code) {
        case "not_found":
          return t(subject === "template" ? "errors.templateNotFound" : "errors.documentNotFound");
        case "validation":
          return t("errors.validation");
        case "forbidden":
          return t("form.errors.forbidden");
        case "unauthorized":
          return t("errors.unauthorized");
        case "rate_limited":
          return t("errors.rateLimited");
        case "company_profile_missing":
          return t("form.errors.companyProfileMissing");
        case "company_no_longer_attached":
          return t("form.toast.companyNoLongerAttached");
        case "devis_locked":
          return t("form.errors.devisLocked");
        default:
          return fallback;
      }
    },
    [t, subject]
  );
}
