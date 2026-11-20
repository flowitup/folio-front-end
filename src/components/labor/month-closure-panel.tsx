"use client";

/**
 * "Chốt tháng" on the labor Summary tab, for the month being viewed
 * (owner decision QĐ-10).
 *
 *  - Open month, manager: a "Chốt tháng 11/2026" button. Its confirm dialog
 *    lists what is still loose: days waiting for validation, labor payments
 *    with no worker or no month, and what is still owed to the workers.
 *  - Closed month: "Đã chốt tháng 11/2026 · bởi A, ngày D" and, for a
 *    manager, "Mở lại" (undo).
 *  - Changed after closing: a warning naming how many times, the last person
 *    and when, with the list of changes.
 *
 * Closing locks nothing (owner's words: "vẫn sửa được nhưng hiện cảnh báo và
 * ghi lại ai sửa, không khóa cứng").
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Loader2, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { fetchLaborEntries, formatEUR } from "@/lib/api/labor";
import { formatClosureMonth } from "@/lib/labor/month-closure";
import { formatDate, formatDateTime } from "@/lib/utils/formatters";
import { useLaborMonthClosures } from "@/components/labor/month-closure-context";
import type { LaborMonthClosureEdit } from "@/types/labor";

const KNOWN_KINDS = new Set([
  "entry_created",
  "entry_updated",
  "entry_deleted",
  "entry_self_logged",
  "entry_self_edited",
  "entry_validated",
  "entry_rejected",
  "change_approved",
  "payment_created",
  "payment_updated",
  "payment_deleted",
  "rate_changed",
  "rate_change_deleted",
]);

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

interface MonthClosurePanelProps {
  projectId: string;
  /** The viewed month, "YYYY-MM". */
  month: string;
  /** Still owed to the workers this month (positive balances only); null while unknown. */
  owed: number | null;
  /** Labor payments of the month with no worker, plus those with no month. */
  unsettledPayments: number;
}

export function MonthClosurePanel({ projectId, month, owed, unsettledPayments }: MonthClosurePanelProps) {
  const t = useTranslations("labor.monthClose");
  const tConfirm = useTranslations("settings.confirmDialog");
  const { closureFor, canManage, close, reopen } = useLaborMonthClosures();
  const closure = closureFor(month);
  const label = formatClosureMonth(month);
  const { ask, dialog } = useConfirm();

  const [checklistOpen, setChecklistOpen] = useState(false);
  const [pendingDays, setPendingDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEdits, setShowEdits] = useState(false);

  // Days waiting for validation are counted when the checklist opens, so the
  // figure is the month's, whatever the Attendance tab happens to show.
  useEffect(() => {
    if (!checklistOpen) return;
    let cancelled = false;
    setPendingDays(null);
    fetchLaborEntries(projectId, monthRange(month))
      .then((entries) => {
        if (!cancelled) setPendingDays(entries.filter((e) => e.status === "pending").length);
      })
      .catch(() => {
        if (!cancelled) setPendingDays(0);
      });
    return () => {
      cancelled = true;
    };
  }, [checklistOpen, projectId, month]);

  async function handleClose() {
    setBusy(true);
    try {
      await close(month);
      toast.success(t("closedToast", { month: label }));
      setChecklistOpen(false);
    } catch {
      toast.error(t("closeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    const ok = await ask({
      title: t("reopenTitle", { month: label }),
      description: t("reopenDescription"),
      confirmLabel: t("reopen"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      await reopen(month);
      toast.success(t("reopenedToast", { month: label }));
    } catch {
      toast.error(t("reopenFailed"));
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = (e: LaborMonthClosureEdit) => t(`kinds.${KNOWN_KINDS.has(e.kind) ? e.kind : "other"}`);

  if (!closure) {
    if (!canManage) return null;
    const owedAmount = owed ?? 0;
    const loose = (pendingDays ?? 0) > 0 || unsettledPayments > 0 || owedAmount > 0.01;
    const checks: { key: string; label: string; value: string; warn: boolean; testId: string }[] = [
      {
        key: "pending",
        label: t("checkPending"),
        value: pendingDays === null ? t("checkCounting") : pendingDays > 0 ? String(pendingDays) : t("checkOk"),
        warn: (pendingDays ?? 0) > 0,
        testId: "month-close-check-pending",
      },
      {
        key: "unassigned",
        label: t("checkUnassigned"),
        value: unsettledPayments > 0 ? String(unsettledPayments) : t("checkOk"),
        warn: unsettledPayments > 0,
        testId: "month-close-check-unassigned",
      },
      {
        key: "owed",
        label: t("checkOwed"),
        value: owedAmount > 0.01 ? formatEUR(owedAmount) : t("checkOk"),
        warn: owedAmount > 0.01,
        testId: "month-close-check-owed",
      },
    ];
    return (
      <div className="flex flex-wrap items-center justify-end gap-2" data-testid="month-close-bar">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setChecklistOpen(true)}
          data-testid="month-close-button"
        >
          <Lock className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t("closeButton", { month: label })}
        </Button>
        <AlertDialog open={checklistOpen} onOpenChange={(open) => !busy && setChecklistOpen(open)}>
          <AlertDialogContent data-testid="month-close-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("closeTitle", { month: label })}</AlertDialogTitle>
              <AlertDialogDescription>{t("closeIntro")}</AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="space-y-2 text-[13.5px]">
              {checks.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3" data-testid={c.testId}>
                  <span className="flex items-center gap-2">
                    {c.warn ? (
                      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--warning)" }} aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--positive)" }} aria-hidden="true" />
                    )}
                    {c.label}
                  </span>
                  <span className="num font-medium" style={c.warn ? { color: "#8e6418" } : { color: "var(--muted)" }}>
                    {c.value}
                  </span>
                </li>
              ))}
            </ul>
            {loose && (
              <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }} data-testid="month-close-check-warning">
                {t("checkWarning")}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{tConfirm("cancel")}</AlertDialogCancel>
              <Button type="button" onClick={() => void handleClose()} disabled={busy} data-testid="month-close-confirm">
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("closeConfirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const closedAt = closure.closed_at ? formatDate(new Date(closure.closed_at)) : "";
  const edited = closure.edited_after_close;
  return (
    <div className="space-y-2" data-testid="month-closed-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="stamp positive num" data-testid="month-closed-badge" style={{ textTransform: "none", letterSpacing: 0 }}>
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          {t("closedBadge", { month: label })}
          {" · "}
          {t("closedBy", { name: closure.closed_by_name ?? t("unknownUser"), date: closedAt })}
        </span>
        {canManage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleReopen()}
            disabled={busy}
            data-testid="month-reopen-button"
          >
            <LockOpen className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("reopen")}
          </Button>
        )}
      </div>
      {edited > 0 && (
        <div
          className="rounded-lg p-3 text-[13px]"
          style={{ background: "var(--warning-tint)", border: "1px solid #e8d199", color: "#6f4e12" }}
          role="status"
          data-testid="month-edited-after-close"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("editedAfterClose", {
                count: edited,
                name: closure.last_edited_by_name ?? t("unknownUser"),
                time: closure.last_edited_at ? formatDateTime(new Date(closure.last_edited_at)) : "",
              })}
            </span>
            <button
              type="button"
              className="text-[12.5px] font-medium underline-offset-2 hover:underline"
              onClick={() => setShowEdits((v) => !v)}
              aria-expanded={showEdits}
              data-testid="month-edits-toggle"
            >
              {showEdits ? t("hideEdits") : t("showEdits")}
            </button>
          </div>
          {showEdits && (
            <ul className="mt-2 space-y-1" data-testid="month-edits-list">
              {closure.edits.map((e, i) => (
                <li key={`${e.edited_at}-${i}`} className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    {[kindLabel(e), e.worker_name, e.entry_date ? formatDate(e.entry_date) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="num" style={{ color: "#8e6418" }}>
                    {e.user_name ?? t("unknownUser")}
                    {e.edited_at ? `, ${formatDateTime(new Date(e.edited_at))}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {dialog}
    </div>
  );
}
