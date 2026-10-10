"use client";

/**
 * Translated text for a failed inventory action. The server actions return
 * the API's error code plus an English message, so the dialogs show the
 * code's translation instead: a French user must not see "Not found." or
 * "This warehouse still holds equipment" after a refused save or delete.
 */

import { useCallback } from "react";
import { useTranslations } from "next-intl";

export function useInventoryErrorMessage() {
  const t = useTranslations("inventory");
  return useCallback(
    (
      result: { code?: string },
      /** `conflict`: the caller's wording for a 409; `fallback`: for every other failure. */
      messages: { conflict?: string; fallback: string }
    ): string => {
      if (result.code === "Forbidden") return t("toast.forbidden");
      if (result.code === "NotFound") return t("toast.notFound");
      if (result.code === "Conflict" && messages.conflict) return messages.conflict;
      return messages.fallback;
    },
    [t]
  );
}
