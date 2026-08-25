"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Landmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatEURWhole } from "@/lib/utils/formatters";
import { updateBankCredit } from "./actions";
import type { Project } from "@/types/project";

/**
 * Project settings card for the bank credit (crédit immobilier): the initial
 * amount the bank granted, plus a free-text funding source. Everything the
 * project releases from that credit (`released_funds` invoices) is deducted
 * from it on the Overview and Expense "Bank credit release" charts.
 *
 * The API field is still named `budget` for backwards compatibility; the UI
 * labels it as the bank credit.
 */
interface Props {
  project: Project;
}

// Amount input accepts digits with an optional decimal part, "." or "," as
// separator — the server action normalizes before sending.
const AMOUNT_RE = /^\d*([.,]\d{0,2})?$/;

export function BankCreditCard({ project }: Props) {
  const t = useTranslations("projects");
  const [amount, setAmount] = useState(
    project.budget != null ? String(project.budget) : ""
  );
  const [source, setSource] = useState(project.budget_source ?? "");
  const [saving, setSaving] = useState(false);

  const initialAmount = project.budget != null ? String(project.budget) : "";
  const isDirty = amount !== initialAmount || source !== (project.budget_source ?? "");
  const parsed = amount.trim() === "" ? null : Number(amount.replace(",", "."));
  const preview = parsed != null && Number.isFinite(parsed) ? formatEURWhole(parsed) : null;

  const handleAmountChange = (value: string) => {
    if (AMOUNT_RE.test(value)) setAmount(value);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateBankCredit(project.id, amount, source);
    setSaving(false);
    if (result.ok) {
      toast.success(t("settingsSaved"));
    } else if (result.error === "validation") {
      toast.error(t("budgetInvalid"));
    } else {
      toast.error(t("settingsSaveError"));
    }
  };

  return (
    <div className="folio-card p-7" data-testid="bank-credit-card">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Landmark size={16} style={{ color: "var(--accent)" }} aria-hidden="true" />
          <h3 className="text-[13px] font-semibold">
            {t("bankRelease.settingsCardTitle")}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bank-credit-amount" className="label-cap">
              {t("budgetLabel")}
            </Label>
            <Input
              id="bank-credit-amount"
              className="folio-input num mt-1.5"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
            />
            {preview && (
              <p className="num mt-1.5 text-[12px]" style={{ color: "var(--muted)" }}>
                {preview}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="bank-credit-source" className="label-cap">
              {t("budgetSourceLabelOptional")}
            </Label>
            <Input
              id="bank-credit-source"
              className="folio-input mt-1.5"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={t("budgetSourcePlaceholder")}
              maxLength={120}
            />
          </div>
        </div>

        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          {t("bankRelease.settingsCardHint")}
        </p>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!isDirty || saving} size="sm">
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
