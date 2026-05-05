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

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    "day"
  );
}

function formatItemCount(n: number): string {
  if (n === 0) return "no items";
  if (n === 1) return "1 item";
  return `${n} items`;
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
  const [isDeleting, setIsDeleting] = useState(false);

  const editPath = `/${locale}/billing/templates/${template.id}`;
  const usePath = `/${locale}/billing/${template.kind}/new?template=${template.id}`;

  async function handleConfirmDelete() {
    setIsDeleting(true);
    const result = await deleteBillingTemplateAction(template.id);
    setIsDeleting(false);
    if (!result.ok) {
      toast.error("Failed to delete template. Please try again.");
      return;
    }
    toast.success("Template deleted.");
    onDelete(template.id);
  }

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
            Edit
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[12px]"
            onClick={() => router.push(usePath)}
          >
            Use
            <ArrowRight size={12} className="ml-1" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[12px] text-red-500 hover:text-red-600"
                disabled={isDeleting}
              >
                <Trash2 size={12} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete template</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete &ldquo;{template.name}&rdquo;? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-[12px]" style={{ color: "var(--muted)" }}>
        <span>{formatItemCount(template.items.length)}</span>
        <span>·</span>
        <span>
          {template.default_vat_rate
            ? `Default VAT ${template.default_vat_rate}%`
            : "No default VAT"}
        </span>
        <span>·</span>
        <span>Updated {formatRelativeDate(template.updated_at)}</span>
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
          <h2 className="font-display text-xl font-medium">Templates</h2>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            Reusable document skeletons to speed up creation.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/${locale}/billing/templates/new`)}
        >
          <Plus size={13} className="mr-1" />
          New template
        </Button>
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="folio-card flex flex-col items-center gap-4 py-16 text-center">
          <FileText size={32} style={{ color: "var(--muted)" }} />
          <div>
            <p className="font-medium text-sm">No templates yet</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              Create your first template to speed up doc creation.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push(`/${locale}/billing/templates/new`)}
          >
            <Plus size={13} className="mr-1" />
            Create your first template
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          <TemplateSection
            label="Devis templates"
            kind="devis"
            templates={devisTemplates}
            onDelete={handleDelete}
          />
          <TemplateSection
            label="Facture templates"
            kind="facture"
            templates={factureTemplates}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}
