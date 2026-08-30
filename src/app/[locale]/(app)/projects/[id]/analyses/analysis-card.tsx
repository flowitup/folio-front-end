"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProjectAnalysis } from "@/lib/api/project-analyses";

// ---- Helpers ----

/** Coarse-grained relative time (minute/hour/day/month/year), locale-aware. */
function relativeDate(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffMs = new Date(iso).getTime() - Date.now();

  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");

  const diffDays = Math.round(diffMs / 86_400_000);
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day");

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, "month");

  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, "year");
}

/** Uppercase initials from a display name ("Former member" → "FM"). */
export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    // Spread to code points so a non-BMP first character (emoji, astral-plane
    // letters) doesn't get split into a lone surrogate.
    .map((p) => ([...p][0] ?? "").toUpperCase())
    .join("");
}

// The miniature "document" in the preview band. Bar widths are fixed but
// varied per line so the sheet reads as text without carrying any content;
// one line takes the accent so the band ties into the palette.
const PREVIEW_LINES: Array<{ width: string; tone: "title" | "line" | "accent" | "faint" }> = [
  { width: "70%", tone: "title" },
  { width: "92%", tone: "line" },
  { width: "84%", tone: "line" },
  { width: "60%", tone: "accent" },
  { width: "88%", tone: "faint" },
];

const PREVIEW_TONE_CLASS: Record<string, string> = {
  title: "h-[5px] bg-[var(--ink-2)]",
  line: "h-[3px] bg-[var(--line-2)]",
  accent: "h-[3px] bg-[var(--accent)]",
  faint: "h-[3px] bg-[var(--line)]",
};

// ---- Props ----

type Props = {
  analysis: ProjectAnalysis;
  projectId: string;
  uploaderName: string;
};

// ---- Component ----

export function AnalysisCard({ analysis, projectId, uploaderName }: Props) {
  const t = useTranslations("analyses");
  const locale = useLocale();

  return (
    <Link
      prefetch={false}
      href={`/projects/${projectId}/analyses/${analysis.id}`}
      className="group block h-full rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full gap-0 overflow-hidden rounded-[var(--radius)] py-0 transition-colors hover:border-[var(--accent)]">
        {/* Document-preview band */}
        <div className="flex h-[88px] items-end justify-center bg-[var(--paper-2)] px-6 pt-4">
          <div className="flex w-32 flex-col gap-[5px] rounded-t-md border border-b-0 bg-white px-3.5 pt-3">
            {PREVIEW_LINES.map((line, i) => (
              <div
                key={i}
                className={`rounded-sm ${PREVIEW_TONE_CLASS[line.tone]}`}
                style={{ width: line.width }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2.5 px-4 pb-3.5 pt-4">
          <h3 className="line-clamp-2 font-display text-[17px] font-medium leading-tight">
            {analysis.title}
          </h3>

          {analysis.summary && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {analysis.summary}
            </p>
          )}

          {analysis.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {analysis.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Footer: uploader + relative time */}
          <div className="mt-auto flex items-center gap-2 border-t border-[var(--paper-2)] pt-2.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--paper-2)] text-[10px] font-semibold"
            >
              {nameInitials(uploaderName)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {t("card.uploadedBy", { name: uploaderName })} ·{" "}
              {relativeDate(analysis.created_at, locale)}
            </span>
            <ChevronRight
              className="size-3.5 shrink-0 text-[var(--muted-2)] transition-colors group-hover:text-[var(--accent)]"
              aria-hidden
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}
