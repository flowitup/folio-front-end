"use client";

/**
 * BillingTemplatesList — grouped display for Devis templates + Facture templates.
 *
 * Groups templates by kind and renders cards with:
 *   - name, items count, default VAT rate, last updated
 *   - actions: Edit | Delete (AlertDialog) | Use (→ /billing/<kind>/new?template=<id>)
 *
 * Props: initialTemplates from server-side fetch.
 * State: optimistic delete (removes from local list immediately).
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, FileText, Pencil, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteBillingTemplateAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import type { BillingDocumentTemplate, BillingDocumentKind } from "@/types/billing";
import { kindToSegment } from "@/lib/billing/url-helpers";
import { formatBillingVatRate } from "@/lib/billing/vat-rate";
import { calendarDaysFromToday } from "@/lib/utils/local-day";
import { useHydrated } from "@/hooks/use-hydrated";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a relative date using the current locale (M-3 fix: was hard-coded "en").
 * Counts the viewer's calendar days, not 24 h periods: saved yesterday at 19:00
 * is "yesterday" at 05:00 today. */
function formatRelativeDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(calendarDaysFromToday(date), "day");
}

// ---------------------------------------------------------------------------
// Template card
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: BillingDocumentTemplate;
  onDelete: (id: string) => void;
}

function TemplateCard({ template, onDelete }: TemplateCardProps) {
  const router = useRouter();
  const locale = useLocale();
  const tList = useTranslations("billing.templates.list");
  const tToast = useTranslations("billing.templates.form.toast");
  const [isDeleting, setIsDeleting] = useState(false);
  // Double-submit guard
  const deletingRef = useRef(false);
  // "Updated today" depends on the browser's time zone, which the server lacks.
  const hydrated = useHydrated();

  const editPath = `/${locale}/billing/templates/${template.id}`;
  const usePath = `/${locale}/billing/${kindToSegment(template.kind)}/new?template=${template.id}`;

  async function handleConfirmDelete() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      const result = await deleteBillingTemplateAction(template.id);
      if (!result.ok) {
        toast.error(tList("deleteFailed"));
        return;
      }
      toast.success(tToast("deleted"));
      onDelete(template.id);
    } finally {
      setIsDeleting(false);
      deletingRef.current = false;
    }
  }

  const itemCount = template.items.length;
  // Use ICU plural key from billing.templates.list.card.items
  const itemCountLabel = tList("card.items", { n: itemCount });
  const vatLabel = template.default_vat_rate
    ? tList("card.vatRate", { rate: formatBillingVatRate(template.default_vat_rate, locale) })
    : tList("card.vatRateNone");
  const lastUpdatedLabel = tList("card.lastUpdated", {
    date: formatRelativeDate(template.updated_at, locale),
  });

  return (
    <div className="folio-card flex min-w-0 flex-col gap-3 p-5">
      {/* Top row: name + actions — the actions wrap under a long name on narrow cards */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-2 sm:basis-24">
          <FileText size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <span className="truncate font-medium text-sm">{template.name}</span>
        </div>

        {/* Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[12px]"
            onClick={() => router.push(editPath)}
          >
            <Pencil size={12} className="mr-1" />
            {tList("actions.edit")}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[12px]"
            onClick={() => router.push(usePath)}
          >
            {tList("actions.use")}
            <ArrowRight size={12} className="ml-1" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[12px] text-destructive hover:text-destructive"
                disabled={isDeleting}
                aria-label={tList("actions.deleteAriaLabel", { name: template.name })}
              >
                <Trash2 size={12} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tList("actions.deleteConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tList("actions.deleteConfirmDescription", { name: template.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tList("actions.deleteCancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {tList("actions.deleteConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-[12px]" style={{ color: "var(--muted)" }}>
        <span>{itemCountLabel}</span>
        <span>·</span>
        <span>{vatLabel}</span>
        {hydrated && (
          <>
            <span>·</span>
            <span>{lastUpdatedLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group section
// ---------------------------------------------------------------------------

interface TemplateSectionProps {
  label: string;
  kind: BillingDocumentKind;
  templates: BillingDocumentTemplate[];
  onDelete: (id: string) => void;
}

function TemplateSection({ label, templates, onDelete }: TemplateSectionProps) {
  const tList = useTranslations("billing.templates.list");
  if (templates.length === 0) {
    return (
      <div>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {label}
        </h3>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>{tList("emptyGroup")}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <TemplateCard key={t.id} template={t} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface BillingTemplatesListProps {
  initialTemplates: BillingDocumentTemplate[];
  /** Company currently scoping this list (from BillingTemplatesCompanyScope's picker) — carried onto the "New template" link so the created template lands in the company the admin is viewing, not always their primary one. */
  companyId?: string | null;
}

export function BillingTemplatesList({ initialTemplates, companyId }: BillingTemplatesListProps) {
  const router = useRouter();
  const locale = useLocale();
  const tList = useTranslations("billing.templates.list");
  const [templates, setTemplates] = useState<BillingDocumentTemplate[]>(initialTemplates);

  const devisTemplates = templates.filter((t) => t.kind === "devis");
  const factureTemplates = templates.filter((t) => t.kind === "facture");
  const isEmpty = templates.length === 0;
  const newTemplatePath = `/${locale}/billing/templates/new${companyId ? `?company_id=${companyId}` : ""}`;

  function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="fade-up space-y-6 px-4 pb-16 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-medium">{tList("title")}</h2>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {tList("subtitle")}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => router.push(newTemplatePath)}
        >
          <Plus size={13} className="mr-1" />
          {tList("new")}
        </Button>
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="folio-card flex flex-col items-center gap-4 py-16 text-center">
          <FileText size={32} style={{ color: "var(--muted)" }} />
          <div>
            <p className="font-medium text-sm">{tList("empty.title")}</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              {tList("empty.description")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push(newTemplatePath)}
          >
            <Plus size={13} className="mr-1" />
            {tList("empty.cta")}
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          <TemplateSection
            label={tList("devisGroup")}
            kind="devis"
            templates={devisTemplates}
            onDelete={handleDelete}
          />
          <TemplateSection
            label={tList("factureGroup")}
            kind="facture"
            templates={factureTemplates}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}
