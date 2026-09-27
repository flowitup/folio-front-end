"use client";

/**
 * LibraryImportDialog — add the lines of a supplier purchase export (JSON) to
 * the company library (POST /bibliotheque/import).
 *
 * Flow: pick the file (and, for a user of several companies, the target
 * company, the page's one by default) → review (lines the API would refuse
 * are listed and left out) → send in requests of up to 1000 lines with a
 * progress bar → summary of products created / updated, purchases added,
 * lines already imported and lines that failed. The endpoint is idempotent
 * per purchase line, so the same file can be imported again safely.
 *
 * Every run ends on the summary: a rate limit pauses and retries, Stop ends
 * a pause at once, and a call that fails outright stops the run.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  clipDetail,
  ImportFileDropzone,
  ImportIssueList,
  ImportProgress,
  ImportStats,
} from "@/components/import/import-dialog-parts";
import {
  importPurchasesAction,
  type ImportPurchasesErrorCode,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import {
  parseLibraryImportFile,
  type LibraryImportIssue,
} from "@/lib/bibliotheque/library-import";
import { callWithRateLimitRetry } from "@/lib/import/rate-limit-retry";
import { MAX_IMPORT_FILE_BYTES, readImportFileText } from "@/lib/import/read-text-file";
import type { UserCompanySummary } from "@/lib/auth/permissions";

/** Answers that would fail every remaining request the same way. */
const FATAL_CODES = new Set<ImportPurchasesErrorCode>(["unauthorized", "forbidden", "rate_limited"]);

interface LoadedFile {
  name: string;
  text: string;
}

interface Outcome {
  created: number;
  updated: number;
  purchasesAdded: number;
  skipped: number;
  failed: { supplier: string; lines: number; code: ImportPurchasesErrorCode; detail: string }[];
  notProcessed: number;
  stopReason: "user" | ImportPurchasesErrorCode | null;
}

export interface LibraryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Company whose library the page shows; the default target. */
  companyId: string;
  /** Companies the user belongs to; a picker is shown when there are several. */
  companies?: Pick<UserCompanySummary, "id" | "legal_name" | "is_primary">[];
  /** Called once a run added or changed something, with the company imported into. */
  onImported: (companyId: string) => void;
}

export function LibraryImportDialog({
  open,
  onOpenChange,
  companyId,
  companies = [],
  onImported,
}: LibraryImportDialogProps) {
  const t = useTranslations("bibliotheque");

  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pauseLeft, setPauseLeft] = useState<number | null>(null);
  const [stopping, setStopping] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [targetId, setTargetId] = useState(companyId);
  /** Set while a run is going; aborting it stops the run, even mid-pause. */
  const runRef = useRef<AbortController | null>(null);

  // Fresh dialog on every open, aimed at the page's company.
  useEffect(() => {
    if (!open) return;
    setTargetId(companyId);
    setFile(null);
    setFileError(null);
    setReading(false);
    setRunning(false);
    setProgress({ done: 0, total: 0 });
    setPauseLeft(null);
    setStopping(false);
    setOutcome(null);
  }, [open, companyId]);

  // Leaving the page mid-run stops sending.
  useEffect(() => () => runRef.current?.abort(), []);

  // Rate-limit pause countdown.
  useEffect(() => {
    if (pauseLeft === null || pauseLeft <= 0) return;
    const id = setTimeout(() => setPauseLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [pauseLeft]);

  const parsed = useMemo(() => (file ? parseLibraryImportFile(file.text) : null), [file]);
  const ready = parsed?.ok ? parsed : null;
  const parseIssues = ready?.issues ?? [];

  // ---------------------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------------------

  function issueLabel(issue: LibraryImportIssue): string {
    return t(`import.issues.${issue.code}`, {
      supplier: issue.supplier,
      position: issue.position ?? 0,
      count: issue.lines,
    });
  }

  function failureReason(code: ImportPurchasesErrorCode, detail: string): string {
    return t(`import.failures.${code}`, { detail: clipDetail(detail) });
  }

  const errorText =
    fileError ?? (parsed && !parsed.ok ? t(`import.fileErrors.${parsed.error}`) : null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleFile(picked: File) {
    setOutcome(null);
    setFileError(null);
    if (picked.size > MAX_IMPORT_FILE_BYTES) {
      setFile(null);
      setFileError(t("import.fileErrors.tooLarge"));
      return;
    }
    setReading(true);
    try {
      setFile({ name: picked.name, text: await readImportFileText(picked) });
    } catch {
      setFile(null);
      setFileError(t("import.fileErrors.unreadable"));
    } finally {
      setReading(false);
    }
  }

  async function handleImport() {
    if (!ready || ready.recordCount === 0) return;
    const target = targetId;
    const run = new AbortController();
    runRef.current = run;
    setStopping(false);
    setRunning(true);
    setOutcome(null);
    setPauseLeft(null);
    setProgress({ done: 0, total: ready.recordCount });

    const totals = { created: 0, updated: 0, purchasesAdded: 0, skipped: 0 };
    const failed: Outcome["failed"] = [];
    let sent = 0;
    let stopReason: Outcome["stopReason"] = null;

    try {
      for (const batch of ready.batches) {
        if (run.signal.aborted) {
          stopReason = "user";
          break;
        }
        let result: Awaited<ReturnType<typeof importPurchasesAction>>;
        try {
          result = await callWithRateLimitRetry(
            () => importPurchasesAction(target, batch),
            (r) => !r.ok && r.code === "rate_limited",
            {
              onPause: (seconds) => setPauseLeft(seconds),
              onResume: () => setPauseLeft(null),
              signal: run.signal,
            }
          );
        } catch (err) {
          // The call itself failed, so whether these lines reached the server
          // is unknown and the next calls would fail the same way.
          sent += batch.records.length;
          failed.push({
            supplier: batch.supplier_name,
            lines: batch.records.length,
            code: "generic",
            detail: err instanceof Error ? err.message : "",
          });
          stopReason = "generic";
          break;
        } finally {
          setPauseLeft(null);
        }

        if (!result.ok && result.code === "rate_limited" && run.signal.aborted) {
          stopReason = "user";
          break;
        }
        sent += batch.records.length;
        if (result.ok) {
          totals.created += result.data.created;
          totals.updated += result.data.updated;
          totals.purchasesAdded += result.data.purchases_added;
          totals.skipped += result.data.skipped;
        } else {
          failed.push({
            supplier: batch.supplier_name,
            lines: batch.records.length,
            code: result.code,
            detail: result.error,
          });
          if (FATAL_CODES.has(result.code)) {
            stopReason = result.code;
            break;
          }
        }
        setProgress({ done: sent, total: ready.recordCount });
      }
    } catch {
      stopReason = "generic";
    } finally {
      runRef.current = null;
      setOutcome({
        ...totals,
        failed,
        notProcessed: ready.recordCount - sent,
        stopReason,
      });
      setPauseLeft(null);
      setRunning(false);
      setStopping(false);
    }

    if (totals.purchasesAdded > 0) {
      toast.success(t("import.toastDone", { count: totals.purchasesAdded }));
    } else if (totals.created + totals.updated > 0) {
      // A re-import can enrich products without adding any purchase.
      toast.success(t("import.toastUpdated", { count: totals.created + totals.updated }));
    } else if (failed.length > 0) {
      toast.error(t("import.toastFailed"));
    }
    if (totals.created + totals.updated + totals.purchasesAdded > 0) onImported(target);
  }

  function handleChooseAnother() {
    setOutcome(null);
    setFile(null);
    setFileError(null);
  }

  function handleStop() {
    runRef.current?.abort();
    setStopping(true);
  }

  function handleOpenChange(next: boolean) {
    // Closing mid-run would leave requests going with no summary to show.
    if (!next && running) return;
    onOpenChange(next);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Primary company first, as in the other company pickers.
  const companyOptions = [...companies].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary)
  );
  const failedLines = outcome ? outcome.failed.reduce((n, f) => n + f.lines, 0) : 0;
  const canStart = !running && !reading && !!ready && ready.recordCount > 0;
  const lastFailure = outcome?.failed[outcome.failed.length - 1];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>{t("import.description")}</DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div className="space-y-4" data-testid="library-import-summary">
            <p className="text-sm font-medium">
              {outcome.stopReason ? t("import.stoppedTitle") : t("import.summaryTitle")}
            </p>
            {outcome.stopReason && outcome.stopReason !== "user" && (
              <Alert variant="destructive">
                <AlertDescription>
                  {failureReason(outcome.stopReason, lastFailure?.detail ?? "")}
                </AlertDescription>
              </Alert>
            )}
            <ImportStats
              stats={[
                { label: t("import.created"), value: outcome.created, tone: "positive" },
                { label: t("import.updated"), value: outcome.updated, tone: "positive" },
                { label: t("import.purchasesAdded"), value: outcome.purchasesAdded, tone: "positive" },
                { label: t("import.skipped"), value: outcome.skipped, tone: "neutral" },
                {
                  label: t("import.errors"),
                  value: failedLines + (ready?.rejectedCount ?? 0),
                  tone: "negative",
                },
              ]}
            />
            {outcome.notProcessed > 0 && (
              <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                {t("import.notProcessed", { count: outcome.notProcessed })}
              </p>
            )}
            <ImportIssueList
              title={t("import.errorList")}
              lines={[
                ...outcome.failed.map((f) =>
                  t("import.failures.batch", {
                    supplier: f.supplier,
                    count: f.lines,
                    reason: failureReason(f.code, f.detail),
                  })
                ),
                ...parseIssues.map(issueLabel),
              ]}
              moreLabel={(count) => t("import.more", { count })}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {companies.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="library-import-company">{t("import.company")}</Label>
                <Select value={targetId} onValueChange={setTargetId} disabled={running}>
                  <SelectTrigger id="library-import-company" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companyOptions.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <ImportFileDropzone
              id="library-import-file"
              accept=".json,application/json"
              prompt={t("import.dropzone")}
              fileName={file?.name ?? null}
              disabled={running || reading}
              onFile={handleFile}
            />
            <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
              {t("import.formatHint")}
            </p>

            {reading && (
              <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--muted)" }}>
                <Loader2 size={14} className="animate-spin" />
                {t("import.reading")}
              </p>
            )}

            {errorText && (
              <Alert variant="destructive">
                <AlertDescription>{errorText}</AlertDescription>
              </Alert>
            )}

            {ready && !running && (
              <div className="space-y-2" data-testid="library-import-preview">
                <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                  {ready.recordCount > 0
                    ? t("import.preview", {
                        count: ready.recordCount,
                        suppliers: ready.suppliers.join(", "),
                      })
                    : t("import.nothingToImport")}
                </p>
                <ImportIssueList
                  title={t("import.previewRejected", { count: ready.rejectedCount })}
                  lines={parseIssues.map(issueLabel)}
                  moreLabel={(count) => t("import.more", { count })}
                />
              </div>
            )}

            {running && (
              <ImportProgress
                value={progress.done}
                max={progress.total}
                label={t("import.progress", { done: progress.done, total: progress.total })}
                note={pauseLeft !== null ? t("import.paused", { seconds: pauseLeft }) : null}
              />
            )}
          </div>
        )}

        <DialogFooter>
          {outcome ? (
            <>
              <Button type="button" variant="outline" onClick={handleChooseAnother}>
                {t("import.chooseAnother")}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t("import.close")}
              </Button>
            </>
          ) : running ? (
            <Button type="button" variant="outline" onClick={handleStop} disabled={stopping}>
              {stopping ? t("import.stopping") : t("import.stop")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("actions.cancel")}
              </Button>
              <Button type="button" onClick={handleImport} disabled={!canStart}>
                {t("import.start", { count: ready?.recordCount ?? 0 })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
