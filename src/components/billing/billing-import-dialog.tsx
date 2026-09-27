"use client";

/**
 * BillingImportDialog — bring quotes or invoices issued before Folio into the
 * list, with their original numbers (POST /billing-documents/import).
 *
 * Flow: pick a CSV or JSON file → review what will be sent (documents the
 * API would refuse are listed and left out) → import one document per request
 * with a progress bar → summary of imported / already present / failed.
 *
 * A number already used for this company and kind answers 409 and is counted
 * as skipped, so the same file can be imported again after fixing a few rows.
 * Rate-limit answers pause the run and retry; an answer that would fail every
 * remaining document (session expired, access removed) stops it, and so does
 * a call that fails outright (connection lost, app updated mid-run). Every
 * run ends on the summary, whatever happened.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, Loader2 } from "lucide-react";
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
import { CompanyPickerSelect } from "@/components/billing/company-picker-select";
import {
  clipDetail,
  ImportFileDropzone,
  ImportIssueList,
  ImportProgress,
  ImportStats,
} from "@/components/import/import-dialog-parts";
import { importBillingDocumentAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import {
  DEFAULT_IMPORT_STATUS,
  IMPORT_STATUSES_BY_KIND,
  REQUIRED_CSV_COLUMNS,
  buildBillingImportTemplate,
  parseBillingImportFile,
  type BillingImportIssue,
  type BillingImportRef,
} from "@/lib/billing/billing-import";
import { callWithRateLimitRetry } from "@/lib/import/rate-limit-retry";
import { MAX_IMPORT_FILE_BYTES, readImportFileText } from "@/lib/import/read-text-file";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import type { BillingDocumentKind, ImportBillingDocumentStatus } from "@/types/billing";
import type { MyCompany } from "@/types/companies";

/** Answers that would fail every remaining document the same way. */
const FATAL_CODES = new Set([
  "unauthorized",
  "forbidden",
  "company_no_longer_attached",
  "company_profile_missing",
  "rate_limited",
]);

const FAILURE_CODES = new Set([
  "validation",
  "forbidden",
  "unauthorized",
  "company_no_longer_attached",
  "company_profile_missing",
  "rate_limited",
  "not_found",
]);

interface LoadedFile {
  name: string;
  text: string;
}

interface Outcome {
  created: number;
  skipped: string[];
  failed: { number: string; code: string; detail: string }[];
  notProcessed: number;
  /** Why the run ended early: "user" for Stop, otherwise the error code; null when complete. */
  stopReason: string | null;
}

export interface BillingImportDialogProps {
  kind: BillingDocumentKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Companies the caller may issue documents for (admin role). */
  companies: MyCompany[];
  /** Called once a run imported at least one document, to refresh the list. */
  onImported: () => void;
}

export function BillingImportDialog({
  kind,
  open,
  onOpenChange,
  companies,
  onImported,
}: BillingImportDialogProps) {
  const t = useTranslations("billing");
  const locale = useLocale();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<ImportBillingDocumentStatus>(
    DEFAULT_IMPORT_STATUS[kind]
  );
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pauseLeft, setPauseLeft] = useState<number | null>(null);
  const [stopping, setStopping] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /** Set while a run is going; aborting it stops the run, even mid-pause. */
  const runRef = useRef<AbortController | null>(null);

  // Fresh dialog on every open (the company picker keeps its own last-used memory).
  useEffect(() => {
    if (!open) return;
    setDefaultStatus(DEFAULT_IMPORT_STATUS[kind]);
    setFile(null);
    setFileError(null);
    setReading(false);
    setRunning(false);
    setProgress({ done: 0, total: 0 });
    setPauseLeft(null);
    setStopping(false);
    setOutcome(null);
  }, [open, kind]);

  // Leaving the page mid-run stops sending.
  useEffect(() => () => runRef.current?.abort(), []);

  // Rate-limit pause countdown.
  useEffect(() => {
    if (pauseLeft === null || pauseLeft <= 0) return;
    const id = setTimeout(() => setPauseLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [pauseLeft]);

  // Re-parsed when the fallback status changes, since it fills rows without one.
  // English users may write month-first dates, so an ambiguous one is refused
  // for them instead of being read day-first.
  const parsed = useMemo(
    () =>
      file
        ? parseBillingImportFile(file.text, file.name, kind, defaultStatus, {
            assumeDayFirst: locale !== "en",
          })
        : null,
    [file, kind, defaultStatus, locale]
  );

  const documents = parsed?.ok ? parsed.documents : [];
  const parseIssues = parsed?.ok ? parsed.issues : [];
  const parseError = parsed && !parsed.ok ? parsed : null;
  // Rows without a number are CSV rows, not documents: counted apart.
  const ignoredRows = parseIssues.filter((issue) => issue.ref.type === "line").length;
  const leftOutDocuments = parseIssues.length - ignoredRows;

  // ---------------------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------------------

  function refLabel(ref: BillingImportRef): string {
    if (ref.type === "number") return ref.value;
    if (ref.type === "line") return t("import.ref.line", { line: ref.value });
    return t("import.ref.position", { position: ref.value });
  }

  function issueLabel(issue: BillingImportIssue): string {
    return `${refLabel(issue.ref)} — ${t(`import.issues.${issue.code}`, issue.params ?? {})}`;
  }

  function failureLabel(code: string, detail: string): string {
    const known = FAILURE_CODES.has(code) ? code : "generic";
    return t(`import.failures.${known}`, { detail: clipDetail(detail) });
  }

  /** Sentences above the list of what the file loses before sending. */
  function leftOutTitle(): string {
    return [
      leftOutDocuments > 0 ? t("import.previewRejected", { count: leftOutDocuments }) : null,
      ignoredRows > 0 ? t("import.rowsIgnored", { count: ignoredRows }) : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  /** API values, with the label Folio shows when it differs (paid (Payée)). */
  function statusChoices(): string {
    return IMPORT_STATUSES_BY_KIND[kind]
      .map((s) => {
        const label = t(`${kind}.status.${s}`);
        return label.toLowerCase() === s ? s : `${s} (${label})`;
      })
      .join(", ");
  }

  function fileErrorLabel(): string | null {
    if (fileError) return fileError;
    if (!parseError) return null;
    if (parseError.error === "missingColumns") {
      return t("import.fileErrors.missingColumns", {
        columns: (parseError.columns ?? []).join(", "),
      });
    }
    return t(`import.fileErrors.${parseError.error}`);
  }

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
      const text = await readImportFileText(picked);
      setFile({ name: picked.name, text });
    } catch {
      setFile(null);
      setFileError(t("import.fileErrors.unreadable"));
    } finally {
      setReading(false);
    }
  }

  function handleDownloadTemplate() {
    // Excel opens ";"-separated files in locales whose decimal mark is a comma.
    const delimiter = locale === "en" ? "," : ";";
    const csv = buildBillingImportTemplate(kind, delimiter);
    triggerBrowserDownload(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `folio-${kind}-import.csv`
    );
  }

  async function handleImport() {
    if (!companyId || documents.length === 0) return;
    const run = new AbortController();
    runRef.current = run;
    setStopping(false);
    setRunning(true);
    setOutcome(null);
    setPauseLeft(null);
    setProgress({ done: 0, total: documents.length });

    let created = 0;
    const skipped: string[] = [];
    const failed: Outcome["failed"] = [];
    let processed = 0;
    let stopReason: Outcome["stopReason"] = null;

    try {
      for (const doc of documents) {
        if (run.signal.aborted) {
          stopReason = "user";
          break;
        }
        let result: Awaited<ReturnType<typeof importBillingDocumentAction>>;
        try {
          result = await callWithRateLimitRetry(
            () => importBillingDocumentAction({ ...doc, company_id: companyId }),
            (r) => !r.ok && r.error.code === "rate_limited",
            {
              onPause: (seconds) => setPauseLeft(seconds),
              onResume: () => setPauseLeft(null),
              signal: run.signal,
            }
          );
        } catch (err) {
          // The call itself failed, so whether this document reached the
          // server is unknown and the next calls would fail the same way.
          processed += 1;
          failed.push({
            number: doc.document_number,
            code: "generic",
            detail: err instanceof Error ? err.message : "",
          });
          stopReason = "generic";
          break;
        } finally {
          setPauseLeft(null);
        }

        if (!result.ok && result.error.code === "rate_limited" && run.signal.aborted) {
          stopReason = "user";
          break;
        }
        processed += 1;
        if (result.ok) {
          created += 1;
        } else if (result.error.code === "document_already_exists") {
          skipped.push(doc.document_number);
        } else {
          failed.push({
            number: doc.document_number,
            code: result.error.code,
            detail: result.error.message,
          });
          if (FATAL_CODES.has(result.error.code)) {
            stopReason = result.error.code;
            break;
          }
        }
        setProgress({ done: processed, total: documents.length });
      }
    } catch {
      stopReason = "generic";
    } finally {
      runRef.current = null;
      setOutcome({
        created,
        skipped,
        failed,
        notProcessed: documents.length - processed,
        stopReason,
      });
      setPauseLeft(null);
      setRunning(false);
      setStopping(false);
    }

    if (created > 0) {
      toast.success(t("import.toastDone", { count: created }));
      onImported();
    } else if (failed.length > 0) {
      toast.error(t("import.toastFailed"));
    }
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

  const statuses = IMPORT_STATUSES_BY_KIND[kind];
  const lastFailure = outcome?.failed[outcome.failed.length - 1];
  const errorText = fileErrorLabel();
  const canStart = !running && !reading && !!companyId && documents.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`${kind}.list.importTitle`)}</DialogTitle>
          <DialogDescription>{t(`import.description.${kind}`)}</DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div className="space-y-4" data-testid="billing-import-summary">
            <p className="text-sm font-medium">
              {outcome.stopReason ? t("import.stoppedTitle") : t("import.summaryTitle")}
            </p>
            {outcome.stopReason && outcome.stopReason !== "user" && (
              <Alert variant="destructive">
                <AlertDescription>
                  {failureLabel(outcome.stopReason, lastFailure?.detail ?? "")}
                </AlertDescription>
              </Alert>
            )}
            <ImportStats
              stats={[
                { label: t("import.created"), value: outcome.created, tone: "positive" },
                { label: t("import.skipped"), value: outcome.skipped.length, tone: "neutral" },
                {
                  label: t("import.errors"),
                  value: outcome.failed.length + leftOutDocuments,
                  tone: "negative",
                },
              ]}
            />
            {outcome.notProcessed > 0 && (
              <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                {t("import.notProcessed", { count: outcome.notProcessed })}
              </p>
            )}
            {ignoredRows > 0 && (
              <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                {t("import.rowsIgnored", { count: ignoredRows })}
              </p>
            )}
            <ImportIssueList
              title={t("import.skippedList")}
              lines={outcome.skipped}
              tone="neutral"
              moreLabel={(count) => t("import.more", { count })}
            />
            <ImportIssueList
              title={t("import.errorList")}
              lines={[
                ...outcome.failed.map((f) => `${f.number} — ${failureLabel(f.code, f.detail)}`),
                ...parseIssues.map(issueLabel),
              ]}
              moreLabel={(count) => t("import.more", { count })}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* One company renders as a label; the picker still reports its id. */}
            <CompanyPickerSelect
              kind={kind}
              attachedCompanies={companies}
              value={companyId}
              onChange={setCompanyId}
              disabled={running}
            />

            <ImportFileDropzone
              id={`billing-import-file-${kind}`}
              accept=".csv,.json,text/csv,application/json"
              prompt={t("import.dropzone")}
              fileName={file?.name ?? null}
              disabled={running || reading}
              onFile={handleFile}
            />

            <div className="space-y-1.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
              <p>{t("import.csvHint", { columns: REQUIRED_CSV_COLUMNS.join(", ") })}</p>
              <p>{t("import.jsonHint")}</p>
              <p>{t("import.projectHint")}</p>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto gap-1.5 px-0 text-[12.5px]"
                onClick={handleDownloadTemplate}
              >
                <Download size={13} />
                {t("import.downloadTemplate")}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`billing-import-status-${kind}`}>{t("import.defaultStatus")}</Label>
              <Select
                value={defaultStatus}
                onValueChange={(v) => setDefaultStatus(v as ImportBillingDocumentStatus)}
                disabled={running}
              >
                <SelectTrigger id={`billing-import-status-${kind}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`${kind}.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                {t("import.statusHint", { statuses: statusChoices() })}
              </p>
            </div>

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

            {parsed?.ok && !running && (
              <div className="space-y-2" data-testid="billing-import-preview">
                <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                  {documents.length > 0
                    ? t("import.preview", { count: documents.length })
                    : t("import.nothingToImport")}
                </p>
                <ImportIssueList
                  title={leftOutTitle()}
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
                {t("import.cancel")}
              </Button>
              <Button type="button" onClick={handleImport} disabled={!canStart}>
                {t("import.start", { count: documents.length })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
