"use client";

/**
 * ChatReportsCard — Settings › Company › Reported messages (company admins).
 *
 * The other half of "Report message": members report someone else's message, the company's
 * admins are notified, and here they see every open report of their company's conversations
 * and either remove the message for everyone or dismiss the report. Rendered only when the
 * deployment has chat; the parent keys it by company id.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useChat } from "@/context/ChatContext";
import { listChatReports, resolveChatReport, type ChatReport } from "@/lib/api/chat-client";
import { chatPersonName } from "@/lib/chat/person-name";
import { dayKeyOf, timeOf } from "@/lib/chat/group-messages-by-day";

function whenLabel(iso: string): string {
  const day = dayKeyOf(iso);
  return `${day.slice(8, 10)}/${day.slice(5, 7)} ${timeOf(iso)}`;
}

export function ChatReportsCard({ companyId }: { companyId: string }) {
  const t = useTranslations("chat.reports");
  const tChat = useTranslations("chat");
  const { enabled } = useChat();
  const [reports, setReports] = useState<ChatReport[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChatReport | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setReports(await listChatReports(companyId));
    } catch {
      setFailed(true);
    }
  }, [companyId]);

  useEffect(() => {
    if (enabled === true) void load();
  }, [enabled, load]);

  const resolve = useCallback(
    async (report: ChatReport, action: "dismiss" | "delete_message") => {
      setBusyId(report.id);
      try {
        await resolveChatReport(report.id, action);
        toast.success(t(action === "dismiss" ? "dismissed" : "deleted"));
        // One decision closes every report of that message.
        setReports((current) => (current ?? []).filter((r) => r.message.id !== report.message.id));
      } catch {
        toast.error(t("failed"));
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load, t]
  );

  if (enabled !== true) return null;

  return (
    <section className="folio-card p-7" data-testid="chat-reports-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[18px] font-medium tracking-tight">{t("title")}</h3>
          <p className="mt-0.5 mb-5 text-[13px]" style={{ color: "var(--muted)" }}>
            {t("description")}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-quiet h-8 w-8 flex-shrink-0 p-0"
          aria-label={t("retry")}
          onClick={() => void load()}
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>

      {reports === null && !failed ? (
        <div className="flex justify-center py-4" style={{ color: "var(--muted)" }}>
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        </div>
      ) : null}
      {failed ? (
        <div className="flex items-center gap-3 text-[13px]" style={{ color: "var(--muted)" }}>
          <span>{t("loadError")}</span>
          <button type="button" className="btn btn-quiet" onClick={() => void load()}>
            {t("retry")}
          </button>
        </div>
      ) : null}
      {reports && reports.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--muted)" }} data-testid="chat-reports-empty">
          {t("empty")}
        </p>
      ) : null}
      {reports && reports.length > 0 ? (
        <ul className="flex flex-col gap-3" data-testid="chat-reports-list">
          {reports.map((report) => {
            const author = chatPersonName(report.message.sender_name, report.message.sender_state, tChat);
            return (
              <li
                key={report.id}
                className="rounded-[12px] border p-3"
                style={{ borderColor: "var(--line)" }}
                data-testid={`chat-report-${report.id}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12px]" style={{ color: "var(--muted)" }}>
                  <span>
                    {t("from", { name: author })} · {report.channel_name}
                  </span>
                  <span className="num">{whenLabel(report.message.created_at)}</span>
                </div>
                <p
                  className="mt-1 whitespace-pre-wrap text-[14px] [overflow-wrap:anywhere]"
                  style={{ color: "var(--ink)" }}
                >
                  {report.message.body || tChat("attachment")}
                </p>
                <p className="mt-1.5 text-[12px]" style={{ color: "var(--muted)" }}>
                  {t("reportedBy", { name: report.reporter_name })} · {whenLabel(report.created_at)}
                  {report.reason ? ` · ${t("reason", { reason: report.reason })}` : ""}
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-quiet"
                    disabled={busyId === report.id}
                    onClick={() => void resolve(report, "dismiss")}
                    data-testid="chat-report-dismiss"
                  >
                    {t("dismiss")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    style={{ color: "var(--negative)" }}
                    disabled={busyId === report.id}
                    onClick={() => setConfirmDelete(report)}
                    data-testid="chat-report-delete"
                  >
                    {t("deleteMessage")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="chat-report-delete-confirm"
              onClick={() => {
                const report = confirmDelete;
                setConfirmDelete(null);
                if (report) void resolve(report, "delete_message");
              }}
            >
              {t("deleteMessage")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
