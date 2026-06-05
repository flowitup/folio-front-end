"use client";

/**
 * CompanyCreateDialog — admin-only dialog to create a new company.
 *
 * All Company fields are exposed; legal_name + address are required.
 * Submit guard: useRef prevents double-submit.
 * On success: toast + close + calls onCreated() so parent refreshes list.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { createCompanyAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { Company } from "@/types/companies";
import type { CreateCompanyPayload } from "@/lib/api/companies/companies";

interface CompanyCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (company: Company) => void;
}

function emptyForm(): CreateCompanyPayload {
  return {
    legal_name: "",
    address: "",
    siret: null,
    tva_number: null,
    iban: null,
    bic: null,
    logo_url: null,
    default_payment_terms: null,
    prefix_override: null,
  };
}

export function CompanyCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: CompanyCreateDialogProps) {
  const t = useTranslations("companies");

  const [form, setForm] = useState<CreateCompanyPayload>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submittingRef = useRef(false);

  function handleOpenChange(next: boolean) {
    if (isSubmitting) return;
    if (!next) {
      setForm(emptyForm());
      setFieldErrors({});
    }
    onOpenChange(next);
  }

  function set(field: keyof CreateCompanyPayload) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const val = e.target.value;
      setForm((prev) => ({ ...prev, [field]: val === "" ? null : val }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.legal_name?.trim()) {
      errors.legal_name = t("form.errors.legalNameRequired");
    }
    if (!form.address?.trim()) {
      errors.address = t("form.errors.addressRequired");
    }
    if (form.logo_url) {
      try {
        const u = new URL(form.logo_url);
        if (!/^https?:$/.test(u.protocol)) {
          errors.logo_url = t("form.errors.logoUrlInvalidScheme");
        }
      } catch {
        errors.logo_url = t("form.errors.logoUrlInvalidUrl");
      }
    }
    if (form.prefix_override) {
      if (form.prefix_override.length > 8) {
        errors.prefix_override = t("form.errors.prefixTooLong");
      } else if (!/^[A-Z0-9]+$/.test(form.prefix_override)) {
        errors.prefix_override = t("form.errors.prefixInvalidChars");
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await createCompanyAction(form);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("admin.createSuccessToast"));
      setForm(emptyForm());
      setFieldErrors({});
      onOpenChange(false);
      onCreated(result.data);
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }

  const str = (v: string | null | undefined) => v ?? "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.newCompany")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Required fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cc-legal-name">
                {t("form.fields.legalName.label")}
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Input
                id="cc-legal-name"
                value={str(form.legal_name)}
                onChange={set("legal_name")}
                placeholder={t("form.fields.legalName.placeholder")}
                disabled={isSubmitting}
                autoFocus
              />
              {fieldErrors.legal_name && (
                <p className="text-[12px] text-destructive">
                  {fieldErrors.legal_name}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cc-address">
                {t("form.fields.address.label")}
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Textarea
                id="cc-address"
                value={str(form.address)}
                onChange={set("address")}
                placeholder={t("form.fields.address.placeholder")}
                disabled={isSubmitting}
                rows={2}
              />
              {fieldErrors.address && (
                <p className="text-[12px] text-destructive">
                  {fieldErrors.address}
                </p>
              )}
            </div>

            {/* Sensitive fields */}
            <div className="space-y-1.5">
              <Label htmlFor="cc-siret">{t("form.fields.siret.label")}</Label>
              <Input
                id="cc-siret"
                value={str(form.siret)}
                onChange={set("siret")}
                placeholder={t("form.fields.siret.placeholder")}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cc-tva">{t("form.fields.tvaNumber.label")}</Label>
              <Input
                id="cc-tva"
                value={str(form.tva_number)}
                onChange={set("tva_number")}
                placeholder={t("form.fields.tvaNumber.placeholder")}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cc-iban">{t("form.fields.iban.label")}</Label>
              <Input
                id="cc-iban"
                value={str(form.iban)}
                onChange={set("iban")}
                placeholder={t("form.fields.iban.placeholder")}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cc-bic">{t("form.fields.bic.label")}</Label>
              <Input
                id="cc-bic"
                value={str(form.bic)}
                onChange={set("bic")}
                placeholder={t("form.fields.bic.placeholder")}
                disabled={isSubmitting}
              />
            </div>

            {/* Non-sensitive optional fields */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cc-logo">{t("form.fields.logoUrl.label")}</Label>
              <Input
                id="cc-logo"
                type="url"
                value={str(form.logo_url)}
                onChange={set("logo_url")}
                placeholder={t("form.fields.logoUrl.placeholder")}
                disabled={isSubmitting}
              />
              {fieldErrors.logo_url && (
                <p className="text-[12px] text-destructive">
                  {fieldErrors.logo_url}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cc-terms">
                {t("form.fields.defaultPaymentTerms.label")}
              </Label>
              <Textarea
                id="cc-terms"
                value={str(form.default_payment_terms)}
                onChange={set("default_payment_terms")}
                placeholder={t("form.fields.defaultPaymentTerms.placeholder")}
                disabled={isSubmitting}
                rows={2}
              />
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {t("form.fields.defaultPaymentTerms.help")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cc-prefix">
                {t("form.fields.prefixOverride.label")}
              </Label>
              <Input
                id="cc-prefix"
                value={str(form.prefix_override)}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setForm((prev) => ({
                    ...prev,
                    prefix_override: val === "" ? null : val,
                  }));
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    delete n.prefix_override;
                    return n;
                  });
                }}
                placeholder={t("form.fields.prefixOverride.placeholder")}
                disabled={isSubmitting}
                maxLength={8}
              />
              {fieldErrors.prefix_override ? (
                <p className="text-[12px] text-destructive">
                  {fieldErrors.prefix_override}
                </p>
              ) : (
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {t("form.fields.prefixOverride.help")}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
              >
                {t("form.actions.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 size={14} className="mr-2 animate-spin" />
              )}
              {t("admin.newCompany")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
