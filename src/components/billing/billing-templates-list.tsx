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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a relative date using the current locale (M-3 fix: was hard-coded "en"). */
function formatRelativeDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    "day"
  );
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
  const [isDeleting, setIsDeleting] = useState(false);
  // Double-submit guard
  const deletingRef = useRef(false);

  const editPath = `/${locale}/billing/templates/${template.id}`;
  const usePath = `/${locale}/billing/${kindToSegment(template.kind)}/new?template=${template.id}`;

  async function handleConfirmDelete() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      const result = await deleteBillingTemplateAction(template.id);
      if (!result.ok) {
        toast.error(tList("actions.delete") + " failed. Please try again.");
        return;
      }
      toast.success("Template deleted.");
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
    ? tList("card.vatRate", { rate: template.default_vat_rate })
    : tList("card.vatRateNone");
  const lastUpdatedLabel = tList("card.lastUpdated", {
    date: formatRelativeDate(template.updated_at, locale),
  });

  return (
    <div className="folio-card flex flex-col gap-3 p-5">
      {/* Top row: name + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <span className="truncate font-medium text-sm">{template.name}</span>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
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
        <span>·</span>
        <span>{lastUpdatedLabel}</span>
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
  if (templates.length === 0) {
    return (
      <div>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {label}
        </h3>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>No templates in this group yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
}

export function BillingTemplatesList({ initialTemplates }: BillingTemplatesListProps) {
  const router = useRouter();
  const locale = useLocale();
  const tList = useTranslations("billing.templates.list");
  const [templates, setTemplates] = useState<BillingDocumentTemplate[]>(initialTemplates);

  const devisTemplates = templates.filter((t) => t.kind === "devis");
  const factureTemplates = templates.filter((t) => t.kind === "facture");
  const isEmpty = templates.length === 0;

  function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="fade-up space-y-6 px-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium">{tList("title")}</h2>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {tList("empty.description")}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/${locale}/billing/templates/new`)}
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
            onClick={() => router.push(`/${locale}/billing/templates/new`)}
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
