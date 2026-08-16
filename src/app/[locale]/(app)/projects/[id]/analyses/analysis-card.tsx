"use client";

import { useLocale, useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full py-4 transition-colors hover:border-[var(--accent)]">
        <CardHeader className="gap-1.5 px-4">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{analysis.title}</h3>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4">
          {analysis.summary && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{analysis.summary}</p>
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

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{t("card.uploadedBy", { name: uploaderName })}</span>
            <span className="shrink-0">{relativeDate(analysis.created_at, locale)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
