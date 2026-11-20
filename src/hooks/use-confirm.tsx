"use client";

/**
 * In-app confirmation in place of the browser's confirm() (unstyled,
 * "localhost indique", OK / Cancel in the browser's language rather than the
 * app's). Same pattern as chiffrage/use-confirm-dialog, with the wording
 * passed in by the caller:
 *
 *   const { ask, dialog, isOpen } = useConfirm();
 *   if (!(await ask({ title: t("deleteTitle", { name }), destructive: true }))) return;
 *   return <>{…}{dialog}</>;
 *
 * Asking again while a question is open answers the previous one "no".
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

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Defaults to "Continue". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** A delete or a discard: the confirm button is red. */
  destructive?: boolean;
}

export function useConfirm() {
  const t = useTranslations("settings.confirmDialog");
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOptions(next);
      }),
    []
  );

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = (
    <AlertDialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          {/* Always rendered: Radix warns when an alert dialog has no description. */}
          <AlertDialogDescription className={options?.description ? undefined : "sr-only"}>
            {options?.description ?? options?.title}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{options?.cancelLabel ?? t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={
              options?.destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined
            }
            onClick={() => settle(true)}
          >
            {options?.confirmLabel ?? t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog, isOpen: options !== null };
}
