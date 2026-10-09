"use client";

/**
 * CompanyProfileForm — edit a company's identity: legal name, address, SIRET,
 * TVA, IBAN, BIC, logo, payment terms and invoice prefix.
 *
 * Shared by the platform-ops manage page and the company admin's own
 * Settings › Company section (PUT /companies/<id> is gated on
 * require_company_role("admin"), so both may save).
 *
 * The API may return SIRET / TVA / IBAN / BIC masked ("····7890189"). A masked
 * value is never put in an input nor sent back — saving it would overwrite the
 * real IBAN/BIC with the mask. Those four fields are sent only when the user
 * actually changed them; a masked one starts empty with the mask as its
 * placeholder, typing a value replaces what is stored, and its Remove button
 * sends null so the save clears it. An emptied plain field is sent as null,
 * which clears it too.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isMaskedValue } from "@/components/companies/mask-display";
import { updateCompanyAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { Company } from "@/types/companies";
import type { UpdateCompanyPayload } from "@/lib/api/companies/companies";

const SENSITIVE_FIELDS = ["siret", "tva_number", "iban", "bic"] as const;
type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

type PlainField =
  | "legal_name"
  | "address"
  | "logo_url"
  | "default_payment_terms"
  | "prefix_override";

export type CompanyProfileValues = Record<PlainField | SensitiveField, string>;

/** Inline message for a field the API rejected (422 `details[].loc`). */
const SERVER_FIELD_ERRORS: Partial<Record<keyof CompanyProfileValues, string>> = {
  siret: "form.errors.siretInvalid",
  tva_number: "form.errors.tvaInvalid",
  iban: "form.errors.ibanInvalid",
  bic: "form.errors.bicInvalid",
  logo_url: "form.errors.logoUrlInvalidUrl",
};

/** What the inputs start with: masked sensitive values start empty. */
export function initialProfileValues(company: Company): CompanyProfileValues {
  const sensitive = (v: string | null) => (v == null || isMaskedValue(v) ? "" : v);
  return {
    legal_name: company.legal_name ?? "",
    address: company.address ?? "",
    logo_url: company.logo_url ?? "",
    default_payment_terms: company.default_payment_terms ?? "",
    prefix_override: company.prefix_override ?? "",
    siret: sensitive(company.siret),
    tva_number: sensitive(company.tva_number),
    iban: sensitive(company.iban),
    bic: sensitive(company.bic),
  };
}

/**
 * PUT body: the plain fields as typed (empty → null), plus each sensitive
 * field only when it differs from what the input started with, or as null
 * when the admin removed its stored (masked) value.
 */
export function buildCompanyUpdatePayload(
  company: Company,
  values: CompanyProfileValues,
  removed: ReadonlySet<SensitiveField> = new Set()
): UpdateCompanyPayload {
  const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
  const payload: UpdateCompanyPayload = {
    legal_name: values.legal_name.trim(),
    address: values.address.trim(),
    logo_url: orNull(values.logo_url),
    default_payment_terms: orNull(values.default_payment_terms),
    prefix_override: orNull(values.prefix_override),
  };
  const initial = initialProfileValues(company);
  for (const field of SENSITIVE_FIELDS) {
    if (removed.has(field) && values[field].trim() === "") payload[field] = null;
    else if (values[field].trim() !== initial[field].trim()) payload[field] = orNull(values[field]);
  }
  return payload;
}

interface CompanyProfileFormProps {
  company: Company;
  onSaved?: (updated: Company) => void;
}

export function CompanyProfileForm({ company, onSaved }: CompanyProfileFormProps) {
  const t = useTranslations("companies");

  const [values, setValues] = useState<CompanyProfileValues>(() => initialProfileValues(company));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Masked fields whose stored value the admin chose to remove on save.
  const [removed, setRemoved] = useState<ReadonlySet<SensitiveField>>(() => new Set());
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  function update(field: keyof CompanyProfileValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
  }

  function setField(field: keyof CompanyProfileValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update(field, e.target.value);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!values.legal_name.trim()) errors.legal_name = t("form.errors.legalNameRequired");
    if (!values.address.trim()) errors.address = t("form.errors.addressRequired");
    if (values.logo_url.trim()) {
      try {
        const u = new URL(values.logo_url.trim());
        if (!/^https?:$/.test(u.protocol)) {
          errors.logo_url = t("form.errors.logoUrlInvalidScheme");
        }
      } catch {
        errors.logo_url = t("form.errors.logoUrlInvalidUrl");
      }
    }
    if (values.prefix_override) {
      if (values.prefix_override.length > 8) errors.prefix_override = t("form.errors.prefixTooLong");
      else if (!/^[A-Z0-9]+$/.test(values.prefix_override))
        errors.prefix_override = t("form.errors.prefixInvalidChars");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const result = await updateCompanyAction(company.id, buildCompanyUpdatePayload(company, values, removed));
      if (!result.ok) {
        const errors: Record<string, string> = {};
        for (const field of result.error.fields ?? []) {
          const key = SERVER_FIELD_ERRORS[field as keyof CompanyProfileValues];
          if (key) errors[field] = t(key);
        }
        if (Object.keys(errors).length > 0) setFieldErrors(errors);
        toast.error(result.error.message);
        return;
      }
      toast.success(t("admin.manage.edit.savedToast"));
      onSaved?.(result.data);
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  }

  function toggleRemoved(field: SensitiveField, on: boolean) {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (on) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  const sensitiveInput = (field: SensitiveField, id: string, labelKey: string) => {
    const stored = company[field];
    const masked = stored != null && isMaskedValue(stored);
    const isRemoved = removed.has(field);
    const error = fieldErrors[field];
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{t(`form.fields.${labelKey}.label`)}</Label>
        <Input
          id={id}
          value={values[field]}
          onChange={(e) => {
            update(field, e.target.value);
            // Typing a new value replaces the stored one instead of removing it.
            if (isRemoved) toggleRemoved(field, false);
          }}
          placeholder={masked && !isRemoved ? stored : undefined}
          autoComplete="off"
          disabled={isSaving}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error ? (
          <p id={`${id}-error`} className="text-[12px] text-destructive">
            {error}
          </p>
        ) : (
          masked && (
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {isRemoved ? t("form.removedFieldHint") : t("form.maskedFieldHint")}
              </p>
              <button
                type="button"
                onClick={() => toggleRemoved(field, !isRemoved)}
                disabled={isSaving}
                className="shrink-0 text-[11px] font-medium underline-offset-2 hover:underline"
                style={{ color: isRemoved ? "var(--ink)" : "var(--negative)" }}
                aria-label={
                  isRemoved
                    ? undefined
                    : t("form.removeStoredValueLabel", { field: t(`form.fields.${labelKey}.label`) })
                }
              >
                {isRemoved ? t("form.undoRemove") : t("form.removeStoredValue")}
              </button>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mp-legal-name">
            {t("form.fields.legalName.label")}
            <span className="ml-1 text-destructive">*</span>
          </Label>
          <Input
            id="mp-legal-name"
            value={values.legal_name}
            onChange={setField("legal_name")}
            disabled={isSaving}
          />
          {fieldErrors.legal_name && (
            <p className="text-[12px] text-destructive">{fieldErrors.legal_name}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mp-address">
            {t("form.fields.address.label")}
            <span className="ml-1 text-destructive">*</span>
          </Label>
          <Textarea
            id="mp-address"
            value={values.address}
            onChange={setField("address")}
            disabled={isSaving}
            rows={2}
          />
          {fieldErrors.address && (
            <p className="text-[12px] text-destructive">{fieldErrors.address}</p>
          )}
        </div>

        {sensitiveInput("siret", "mp-siret", "siret")}
        {sensitiveInput("tva_number", "mp-tva", "tvaNumber")}
        {sensitiveInput("iban", "mp-iban", "iban")}
        {sensitiveInput("bic", "mp-bic", "bic")}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mp-logo">{t("form.fields.logoUrl.label")}</Label>
          <Input id="mp-logo" type="url" value={values.logo_url} onChange={setField("logo_url")} disabled={isSaving} />
          {fieldErrors.logo_url && (
            <p className="text-[12px] text-destructive">{fieldErrors.logo_url}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mp-terms">{t("form.fields.defaultPaymentTerms.label")}</Label>
          <Textarea
            id="mp-terms"
            value={values.default_payment_terms}
            onChange={setField("default_payment_terms")}
            disabled={isSaving}
            rows={2}
          />
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            {t("form.fields.defaultPaymentTerms.help")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mp-prefix">{t("form.fields.prefixOverride.label")}</Label>
          <Input
            id="mp-prefix"
            value={values.prefix_override}
            onChange={(e) => update("prefix_override", e.target.value.toUpperCase())}
            disabled={isSaving}
            maxLength={8}
          />
          {fieldErrors.prefix_override ? (
            <p className="text-[12px] text-destructive">{fieldErrors.prefix_override}</p>
          ) : (
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              {t("form.fields.prefixOverride.help")}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : (
            <Save size={14} className="mr-2" />
          )}
          {t("admin.manage.edit.save")}
        </Button>
      </div>
    </form>
  );
}
