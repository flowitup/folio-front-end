"use client";

/**
 * In-app confirmation for chiffrage deletes, in place of the browser's
 * confirm() (unstyled, "localhost indique", OK/Cancel in the browser's
 * language).
 *
 *   const { ask, dialog } = useConfirmDialog();
 *   if (await ask(t("confirmDeletePoste", { name }))) …
 *   return <>{…}{dialog}</>;
 */

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function useConfirmDialog() {
  const t = useTranslations("chiffrage");
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback(
    (text: string) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setMessage(text);
      }),
    []
  );

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setMessage(null);
  };

  const dialog = (
    <AlertDialog open={message !== null} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmDeleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("confirmDeleteCancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => settle(true)}
          >
            {t("confirmDeleteAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog };
}
