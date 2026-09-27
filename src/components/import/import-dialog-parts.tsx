"use client";

/**
 * Presentational building blocks shared by the file import dialogs (billing
 * documents, library purchases). They hold no copy of their own: every label
 * arrives already translated from the dialog's namespace.
 */

import { useState } from "react";
import { FileUp } from "lucide-react";

/** Server messages can be long (a whole validation report); keep the first part. */
export function clipDetail(detail: string, max = 200): string {
  return detail.length > max ? `${detail.slice(0, max)}…` : detail;
}

// ---------------------------------------------------------------------------
// File picker (click or drop)
// ---------------------------------------------------------------------------

interface ImportFileDropzoneProps {
  id: string;
  accept: string;
  prompt: string;
  fileName: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
}

export function ImportFileDropzone({
  id,
  accept,
  prompt,
  fileName,
  disabled = false,
  onFile,
}: ImportFileDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) pick(e.dataTransfer.files);
      }}
      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      aria-disabled={disabled}
      style={{
        borderColor: dragging ? "var(--accent)" : "var(--line-2)",
        background: dragging ? "var(--accent-tint)" : "var(--paper-2)",
      }}
    >
      <FileUp size={20} style={{ color: "var(--muted)" }} aria-hidden />
      <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
        {fileName ?? prompt}
      </span>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files);
          // Allow picking the same file again after fixing it on disk.
          e.target.value = "";
        }}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

interface ImportProgressProps {
  value: number;
  max: number;
  label: string;
  note?: string | null;
}

export function ImportProgress({ value, max, label, note }: ImportProgressProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--paper-2)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%`, background: "var(--accent)" }}
        />
      </div>
      <p className="num text-[12.5px]" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      {note && (
        <p role="status" className="text-[12.5px]" style={{ color: "var(--warning)" }}>
          {note}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary counters
// ---------------------------------------------------------------------------

export type ImportStatTone = "positive" | "neutral" | "negative";

const TONE_COLOR: Record<ImportStatTone, string> = {
  positive: "var(--positive)",
  neutral: "var(--ink)",
  negative: "var(--negative)",
};

export function ImportStats({
  stats,
}: {
  stats: { label: string; value: number; tone: ImportStatTone }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg px-3 py-2"
          style={{ background: "var(--paper-2)" }}
        >
          <dt className="text-[11.5px]" style={{ color: "var(--muted)" }}>
            {stat.label}
          </dt>
          <dd
            className="num text-lg font-medium"
            style={{ color: stat.value > 0 ? TONE_COLOR[stat.tone] : "var(--ink)" }}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Capped list of issues
// ---------------------------------------------------------------------------

const MAX_LISTED = 8;

export function ImportIssueList({
  title,
  lines,
  moreLabel,
  tone = "negative",
}: {
  title: string;
  lines: string[];
  /** Receives the number of hidden lines. */
  moreLabel: (hidden: number) => string;
  tone?: "negative" | "neutral";
}) {
  if (lines.length === 0) return null;
  const shown = lines.slice(0, MAX_LISTED);
  const hidden = lines.length - shown.length;
  return (
    <div className="space-y-1">
      <p className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
        {title}
      </p>
      <ul
        className="max-h-40 space-y-0.5 overflow-y-auto text-[12.5px]"
        style={{ color: tone === "negative" ? "var(--negative)" : "var(--muted)" }}
      >
        {shown.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
        {hidden > 0 && <li style={{ color: "var(--muted)" }}>{moreLabel(hidden)}</li>}
      </ul>
    </div>
  );
}
