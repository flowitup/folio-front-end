"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { LaborActivity } from "@/types/labor";

interface ActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill date for new activity (YYYY-MM-DD). Ignored when editing. */
  initialDate?: string;
  /** When set, dialog operates in edit mode. */
  editActivity?: LaborActivity | null;
  onSave: (data: { date: string; title: string }) => Promise<void>;
}

export function ActivityDialog({
  open,
  onOpenChange,
  initialDate,
  editActivity,
  onSave,
}: ActivityDialogProps) {
  const t = useTranslations("labor");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editActivity;

  useEffect(() => {
    if (!open) return;
    if (editActivity) {
      setDate(editActivity.date);
      setTitle(editActivity.title);
    } else {
      setDate(initialDate ?? new Date().toISOString().slice(0, 10));
      setTitle("");
    }
    setError(null);
  }, [open, editActivity, initialDate]);

  const canSubmit = title.trim().length > 0 && date.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setIsSaving(true);
    try {
      await onSave({
        date,
        title: title.trim(),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? (t("activity.editTitle") || "Edit activity")
              : (t("activity.addTitle") || "Add activity")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activity-date">{t("date")}</Label>
            <Input
              id="activity-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity-title">
              {t("activity.titleField") || "Title"}
            </Label>
            <Input
              id="activity-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("activity.titlePlaceholder") || "What happened today?"}
              maxLength={255}
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving || !canSubmit}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
