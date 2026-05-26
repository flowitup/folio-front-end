"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useProject } from "@/context/ProjectContext";
import { updateInvoicePrefix } from "./_actions/invoice-prefix-actions";

const PREFIX_RE = /^[A-Z0-9]{0,8}$/;

export function InvoicePrefixSection() {
  const t = useTranslations("projects");
  const { selectedProject, refetch } = useProject();
  const [prefix, setPrefix] = useState(selectedProject?.invoice_prefix ?? "");
  const [saving, setSaving] = useState(false);
  const currentYear = new Date().getFullYear();
  const preview = prefix || "INV";

  if (!selectedProject) return null;

  const handlePrefixChange = (value: string) => {
    const upper = value.toUpperCase();
    if (PREFIX_RE.test(upper)) {
      setPrefix(upper);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateInvoicePrefix(selectedProject.id, prefix);
    setSaving(false);
    if (result.ok) {
      toast.success(t("settingsSaved"));
      await refetch();
    } else if (result.error === "validation") {
      toast.error(t("invoicePrefixInvalid"));
    } else {
      toast.error(t("settingsSaveError"));
    }
  };

  const isDirty = prefix !== (selectedProject.invoice_prefix ?? "");

  return (
    <section className="folio-card p-7">
      <div className="flex items-center gap-3">
        <Settings size={18} style={{ color: "var(--accent)" }} />
        <div>
          <h3 className="font-display text-[22px] font-medium tracking-tight">
            {t("settingsTitle")}
          </h3>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {selectedProject.name}
          </p>
        </div>
      </div>

      <div className="ink-divider my-5" />

      <div className="space-y-4">
        <div>
          <Label htmlFor="invoice-prefix" className="label-cap">
            {t("invoicePrefix")}
          </Label>
          <Input
            id="invoice-prefix"
            className="folio-input mt-1.5 max-w-[200px] font-mono uppercase"
            value={prefix}
            onChange={(e) => handlePrefixChange(e.target.value)}
            placeholder={t("invoicePrefixPlaceholder")}
            maxLength={8}
          />
          <p
            className="mt-2 text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            {t("invoicePrefixHint")}
          </p>
        </div>

        <div
          className="rounded-lg border px-4 py-3"
          style={{
            borderColor: "var(--line)",
            background: "var(--paper-2)",
          }}
        >
          <span
            className="text-[11px] uppercase tracking-wide"
            style={{ color: "var(--muted)" }}
          >
            {t("invoicePrefixExample", {
              prefix: preview,
              year: String(currentYear),
            }).split(":")[0]}:
          </span>
          <span className="ml-2 font-mono text-[14px] font-medium">
            {preview}-{currentYear}-0001
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving}
            size="sm"
          >
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
