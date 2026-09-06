"use client";

/**
 * AttendancePendingRow — one worker-submitted day awaiting validation, inside the bell.
 * Main area navigates to the project's attendance tab; Validate applies at once,
 * Reject asks for an inline confirmation first (the row is deleted server-side).
 */

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { AttendancePending } from "@/lib/api/notifications";

interface AttendancePendingRowProps {
  item: AttendancePending;
  /** A validate/reject request for this row is in flight — actions disabled. */
  busy?: boolean;
  onValidate?: (item: AttendancePending) => void;
  onReject?: (item: AttendancePending) => void;
  onNavigate: () => void;
}

/** YYYY-MM-DD → short localized day, e.g. "6 Sept". Falls back to the raw string. */
function formatDay(date: string, locale: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function AttendancePendingRow({
  item,
  busy = false,
  onValidate,
  onReject,
  onNavigate,
}: AttendancePendingRowProps) {
  const t = useTranslations("notifications");
  const tLabor = useTranslations("labor");
  const router = useRouter();
  const locale = useLocale();
  const [confirmingReject, setConfirmingReject] = useState(false);

  const shift =
    item.shift_type === "full"
      ? tLabor("shiftFull")
      : item.shift_type === "half"
        ? tLabor("shiftHalf")
        : item.shift_type === "overtime"
          ? tLabor("shiftOvertime")
          : null;
  const details = [formatDay(item.date, locale), shift, item.supplement_hours > 0 ? `+${item.supplement_hours}h` : null]
    .filter(Boolean)
    .join(" · ");

  function handleClickThrough() {
    router.push(`/${locale}/projects/${item.project_id}/labor?tab=attendance`);
    onNavigate();
  }

  return (
    <div className="group flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent/40 transition-colors">
      <button
        type="button"
        onClick={handleClickThrough}
        className="min-w-0 flex-1 text-left focus:outline-none focus-visible:underline"
        aria-label={t("aria.goToAttendance", { worker: item.worker_name })}
      >
        <p
          className="truncate text-sm font-medium leading-snug"
          style={{ color: "var(--foreground)" }}
        >
          {item.worker_name}
          <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>
            {" · "}
            {item.project_name}
          </span>
        </p>
        <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>
          {details}
          {item.note ? ` — ${item.note}` : ""}
        </p>
      </button>

      {confirmingReject ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => {
              setConfirmingReject(false);
              onReject?.(item);
            }}
            className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            style={{ background: "var(--destructive)" }}
          >
            {t("attendance.confirmReject")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReject(false)}
            className="rounded px-2 py-1 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("attendance.cancel")}
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => onValidate?.(item)}
            aria-label={t("attendance.validate")}
            title={t("attendance.validate")}
            className="rounded p-1 hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Check className="h-4 w-4" style={{ color: "var(--primary)" }} />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingReject(true)}
            aria-label={t("attendance.reject")}
            title={t("attendance.reject")}
            className="rounded p-1 hover:bg-destructive/10 transition-colors"
          >
            <X className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>
      )}
    </div>
  );
}
