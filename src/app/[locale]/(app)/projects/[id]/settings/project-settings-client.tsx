"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateInvoicePrefix } from "./actions";
import { BankCreditCard } from "./bank-credit-card";
import type { Project } from "@/types/project";

const PREFIX_RE = /^[A-Z0-9]{0,8}$/;

interface Props {
  project: Project;
}

export function ProjectSettingsClient({ project }: Props) {
  const t = useTranslations("projects");
  const [prefix, setPrefix] = useState(project.invoice_prefix ?? "");
  const [saving, setSaving] = useState(false);
  const currentYear = new Date().getFullYear();
  const preview = prefix || "INV";

  const handlePrefixChange = (value: string) => {
    const upper = value.toUpperCase();
    if (PREFIX_RE.test(upper)) {
      setPrefix(upper);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateInvoicePrefix(project.id, prefix);
    setSaving(false);
    if (result.ok) {
      toast.success(t("settingsSaved"));
    } else if (result.error === "validation") {
      toast.error(t("invoicePrefixInvalid"));
    } else {
      toast.error(t("settingsSaveError"));
    }
  };

  const isDirty = prefix !== (project.invoice_prefix ?? "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings size={20} style={{ color: "var(--accent)" }} />
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {t("settingsTitle")}
        </h2>
      </div>

      {/* Bank credit card — initial credit granted by the bank; funds
          releases are deducted from it on the Overview/Expense charts. */}
      <BankCreditCard project={project} />

      {/* Invoice prefix card */}
      <div className="folio-card p-7">
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

          {/* Live preview */}
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

          {/* Save button */}
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
      </div>
    </div>
  );
}
