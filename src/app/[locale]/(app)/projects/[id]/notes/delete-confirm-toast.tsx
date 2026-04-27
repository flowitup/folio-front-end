"use client";

/**
 * Delete confirmation via sonner toast with undo action.
 * Exports `confirmDelete(options)` — call it, it removes the row
 * optimistically and fires the real delete after a 4-second window.
 */

import { toast } from "sonner";

interface ConfirmDeleteOptions {
  /** i18n label shown in the toast body */
  label: string;
  /** i18n label for the Undo button */
  undoLabel: string;
  /** Called immediately when the toast appears (optimistic removal) */
  onRemove: () => void;
  /** Called after the undo window expires without clicking Undo */
  onConfirm: () => Promise<void>;
  /** Called if the server delete fails (after undo window) */
  onError?: (errorKey: string) => void;
  /** i18n key for server error toast */
  errorLabel?: string;
}

const UNDO_WINDOW_MS = 4000;

export function confirmDelete({
  label,
  undoLabel,
  onRemove,
  onConfirm,
  onError,
  errorLabel,
}: ConfirmDeleteOptions): void {
  let cancelled = false;

  // Optimistically remove the row right away
  onRemove();

  toast(label, {
    duration: UNDO_WINDOW_MS,
    action: {
      label: undoLabel,
      onClick: () => {
        cancelled = true;
      },
    },
  });

  // After the undo window, commit the delete if not cancelled
  setTimeout(async () => {
    if (cancelled) return;
    try {
      await onConfirm();
    } catch {
      if (onError) {
        onError(errorLabel ?? "generic");
      }
    }
  }, UNDO_WINDOW_MS);
}
