"use client";

/**
 * The two pieces of a labor payment note on a worker row — the muted note
 * text and the add/edit icon button — shared by the Payments tab rows and
 * the Summary tables so the note looks and behaves the same everywhere.
 */

import { useTranslations } from "next-intl";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaymentNoteText({ note, testId }: { note?: string; testId?: string }) {
  if (!note) return null;
  return (
    <p
      className="flex items-start gap-1.5 text-[12px]"
      style={{ color: "var(--muted)" }}
      title={note}
      data-testid={testId}
    >
      <StickyNote size={12} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <span className="line-clamp-2 min-w-0 whitespace-pre-line">{note}</span>
    </p>
  );
}

export function PaymentNoteButton({
  hasNote,
  onClick,
  testId,
}: {
  hasNote: boolean;
  onClick: () => void;
  testId?: string;
}) {
  const t = useTranslations("labor.payments");
  const label = t(hasNote ? "editNote" : "addNote");
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={(e) => {
        // Summary month rows drill down on click — keep the button local.
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      data-testid={testId}
    >
      <StickyNote size={14} aria-hidden="true" />
    </Button>
  );
}
