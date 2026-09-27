"use client";

/**
 * ChangeRequestsPanel — managers' list of worker change requests on validated
 * days (attendance tab). Each row shows the day as it stands next to what the
 * worker asked for, with Apply / Refuse. Renders nothing when there is nothing
 * to review and nothing failed to load.
 *
 * RefuseChangeDialog — confirmation before a request is refused.
 */

import { Check, Loader2, PencilLine, RotateCw, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { describeChangeRequest } from "@/lib/labor/change-requests";
import { formatDate } from "@/lib/utils/formatters";
import type { AttendanceChangeRequest } from "@/types/labor";

interface ChangeRequestsPanelProps {
  requests: AttendanceChangeRequest[];
  /** A (re)load of the request list is in flight. */
  isLoading: boolean;
  /** The last load failed — the list may be incomplete. */
  loadFailed: boolean;
  /** Entry ids with a decision in flight — their buttons are disabled. */
  settlingIds: ReadonlySet<string>;
  onApprove: (request: AttendanceChangeRequest) => void;
  onRefuse: (request: AttendanceChangeRequest) => void;
  onRetry: () => void;
}

export function ChangeRequestsPanel({
  requests,
  isLoading,
  loadFailed,
  settlingIds,
  onApprove,
  onRefuse,
  onRetry,
}: ChangeRequestsPanelProps) {
  const t = useTranslations("labor");

  if (requests.length === 0 && !loadFailed) return null;

  return (
    <Card
      className="gap-0 overflow-hidden border-amber-500/40 p-0"
      role="region"
      aria-label={t("changeRequest.panelTitle", { count: requests.length })}
      data-testid="change-requests-panel"
    >
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <PencilLine className="mt-0.5 h-4 w-4 flex-none text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">
            {t("changeRequest.panelTitle", { count: requests.length })}
          </h3>
          <p className="text-muted-foreground text-xs">{t("changeRequest.panelHint")}</p>
        </div>
        {isLoading && (
          <Loader2
            className="text-muted-foreground h-4 w-4 flex-none animate-spin"
            aria-label={t("changeRequest.refreshing")}
          />
        )}
      </div>

      {loadFailed && (
        <div
          role="alert"
          className="text-destructive flex items-center justify-between gap-3 border-b px-4 py-2 text-xs"
        >
          <span>{t("changeRequest.loadFailed")}</span>
          <Button variant="outline" size="xs" onClick={onRetry} disabled={isLoading}>
            <RotateCw aria-hidden="true" />
            {t("changeRequest.retry")}
          </Button>
        </div>
      )}

      {requests.length > 0 && (
        <ul className="divide-border max-h-72 divide-y overflow-y-auto">
          {requests.map((request) => {
            const busy = settlingIds.has(request.entry_id);
            const { current, proposed } = describeChangeRequest(t, request);
            const who = `${request.worker_name} · ${formatDate(request.date)}`;
            return (
              <li
                key={request.entry_id}
                data-testid={`change-request-${request.entry_id}`}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {request.worker_name}
                    <span className="text-muted-foreground font-normal">
                      {" · "}
                      {formatDate(request.date)}
                    </span>
                  </p>
                  <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-muted-foreground">{t("changeRequest.current")}</dt>
                    <dd className="text-muted-foreground truncate" data-testid="change-request-current">
                      {current}
                    </dd>
                    <dt className="font-medium text-amber-700 dark:text-amber-300">
                      {t("changeRequest.proposed")}
                    </dt>
                    <dd className="truncate font-medium" data-testid="change-request-proposed">
                      {proposed}
                    </dd>
                  </dl>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onApprove(request)}
                    aria-label={`${t("changeRequest.apply")} — ${who}`}
                  >
                    {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                    {t("changeRequest.apply")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onRefuse(request)}
                    aria-label={`${t("changeRequest.refuse")} — ${who}`}
                  >
                    <X aria-hidden="true" />
                    {t("changeRequest.refuse")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

interface RefuseChangeDialogProps {
  /** The request being refused; null keeps the dialog closed. */
  request: AttendanceChangeRequest | null;
  /** The refusal is in flight — both buttons are disabled. */
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RefuseChangeDialog({ request, busy, onConfirm, onCancel }: RefuseChangeDialogProps) {
  const t = useTranslations("labor");

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("changeRequest.refuseTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {request
              ? t("changeRequest.refuseConfirm", {
                  worker: request.worker_name,
                  date: formatDate(request.date),
                })
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {t("changeRequest.refuse")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
