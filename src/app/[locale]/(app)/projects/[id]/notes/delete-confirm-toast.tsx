"use client";

/**
 * Delete confirmation via sonner toast with undo action.
 * Exports `confirmDelete(options)` — call it, it removes the row
 * optimistically and fires the real delete after a 4-second window.
 *
 * - Undo cancels the delete and calls `onUndo` so the row comes back.
 * - A delete still waiting when the page is closed or reloaded (`pagehide`)
 *   or when the notes view unmounts (client-side navigation) is sent at once
 *   through `sendNow`, which must not depend on the notes route being mounted
 *   (a server action fired from another route never ran): the user was told
 *   the note was deleted, so it must be.
 */

import { toast } from "sonner";

interface ConfirmDeleteOptions {
  /** i18n label shown in the toast body */
  label: string;
  /** i18n label for the Undo button */
  undoLabel: string;
  /** Called immediately when the toast appears (optimistic removal) */
  onRemove: () => void;
  /** Called when the user clicks Undo: restore the row */
  onUndo: () => void;
  /** Called after the undo window expires without clicking Undo */
  onConfirm: () => Promise<void>;
  /** Sends the delete right away, without any UI follow-up (page leaving). */
  sendNow: () => void;
  /** Called if the server delete fails (after undo window) */
  onError?: (errorKey: string) => void;
  /** i18n key for server error toast */
  errorLabel?: string;
}

const UNDO_WINDOW_MS = 4000;

/** Deletes inside their undo window, by a unique token. */
const pending = new Map<symbol, { timer: ReturnType<typeof setTimeout>; sendNow: () => void }>();
let pagehideListening = false;

/** Send every delete still in its undo window now, without waiting. */
export function flushPendingDeletes(): void {
  for (const [token, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(token);
    entry.sendNow();
  }
}

function listenForPagehide(): void {
  if (pagehideListening || typeof window === "undefined") return;
  pagehideListening = true;
  window.addEventListener("pagehide", flushPendingDeletes);
}

export function confirmDelete({
  label,
  undoLabel,
  onRemove,
  onUndo,
  onConfirm,
  sendNow,
  onError,
  errorLabel,
}: ConfirmDeleteOptions): void {
  const token = Symbol("note-delete");
  listenForPagehide();

  // Optimistically remove the row right away
  onRemove();

  // After the undo window, commit the delete unless it was undone or flushed.
  const timer = setTimeout(async () => {
    if (!pending.delete(token)) return;
    try {
      await onConfirm();
    } catch {
      if (onError) {
        onError(errorLabel ?? "generic");
      }
    }
  }, UNDO_WINDOW_MS);
  pending.set(token, { timer, sendNow });

  toast(label, {
    duration: UNDO_WINDOW_MS,
    action: {
      label: undoLabel,
      onClick: () => {
        // Already sent (page flushed it) — nothing left to undo.
        if (!pending.delete(token)) return;
        clearTimeout(timer);
        onUndo();
      },
    },
  });
}
