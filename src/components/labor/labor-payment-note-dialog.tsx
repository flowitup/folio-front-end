"use client";

/**
 * LaborPaymentNoteDialog — add, edit or clear the note on one worker's month
 * in the Payments tab. Saving an empty note removes it.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MAX_NOTE_LENGTH = 2000;

export interface LaborPaymentNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerName: string;
  /** Localized "September 2026"-style label of the viewed month. */
  periodLabel: string;
  initialNote: string;
  onSave: (note: string) => Promise<void>;
}

export function LaborPaymentNoteDialog({
  open,
  onOpenChange,
  workerName,
  periodLabel,
  initialNote,
  onSave,
}: LaborPaymentNoteDialogProps) {
  const t = useTranslations("labor.payments");
  const [draft, setDraft] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(initialNote);
  }, [open, initialNote]);

  async function handleSave() {
    const cleared = draft.trim() === "";
    setIsSaving(true);
    try {
      await onSave(draft);
      toast.success(t(cleared ? "noteClearedToast" : "noteSavedToast"));
      onOpenChange(false);
    } catch {
      toast.error(t("noteSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("noteTitle", { name: workerName, month: periodLabel })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Textarea
            rows={4}
            value={draft}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("notePlaceholder")}
            disabled={isSaving}
            autoFocus
            data-testid="labor-payment-note-input"
          />
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>
            {t("noteHint")}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("noteCancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || draft.trim() === initialNote.trim()}>
            {t("noteSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
