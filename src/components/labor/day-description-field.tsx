"use client";

/**
 * DayDescriptionField — inline per-day free-text description block.
 *
 * Sits under each day heading in AttendanceTable and AttendanceDayDetailSheet,
 * visually distinct from per-worker charge notes and from activity rows.
 *
 * - canManage + onSave: renders a controlled Textarea; saves on blur only when
 *   the value changed vs the last-persisted value.
 * - Read-only: renders the description text when non-empty; nothing when empty.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";

interface DayDescriptionFieldProps {
  date: string;
  value: string;
  canManage: boolean;
  onSave?: (date: string, description: string) => Promise<void>;
}

export function DayDescriptionField({
  date,
  value,
  canManage,
  onSave,
}: DayDescriptionFieldProps) {
  const t = useTranslations("labor.dayDescription");

  // Local draft — kept in sync when the persisted value prop changes externally.
  const [draft, setDraft] = useState(value);
  // Track the last persisted value so we only call onSave when it changed.
  const savedRef = useRef(value);
  const [saving, setSaving] = useState(false);

  // Sync draft when the parent pushes a new persisted value (e.g. after reload).
  useEffect(() => {
    setDraft(value);
    savedRef.current = value;
  }, [value]);

  const handleBlur = async () => {
    if (!onSave) return;
    const trimmed = draft.trim();
    if (trimmed === savedRef.current) return;
    setSaving(true);
    try {
      await onSave(date, trimmed);
      savedRef.current = trimmed;
      // Normalize stored draft to trimmed value.
      setDraft(trimmed);
    } catch {
      // Save failed — leave savedRef un-advanced so the next blur retries.
      // The parent (handleSaveDayDescription) surfaces the error toast.
    } finally {
      setSaving(false);
    }
  };

  if (canManage && onSave) {
    return (
      <div className="space-y-1 px-1 pb-1 pt-0.5">
        <Label className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
          <FileText className="h-3 w-3" />
          {t("label")}
          {saving && (
            <span className="text-muted-foreground/60 ml-1 text-[10px]">
              {t("saving")}
            </span>
          )}
        </Label>
        <Textarea
          rows={2}
          value={draft}
          maxLength={2000}
          placeholder={t("placeholder")}
          className="min-h-0 resize-none text-sm"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          aria-label={t("label")}
        />
      </div>
    );
  }

  // Read-only: render nothing when empty.
  if (!value) return null;

  return (
    <div className="text-muted-foreground flex items-start gap-1.5 px-1 pb-1 pt-0.5 text-sm">
      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="leading-snug">{value}</p>
    </div>
  );
}
