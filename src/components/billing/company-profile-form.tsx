"use client";

/**
 * CompanyProfileForm — edit / create the user's company profile.
 *
 * - Empty on first visit (profile is null) → Save creates it (PUT upsert).
 * - Pre-filled on subsequent visits → Save upserts.
 * - Toast on success (sonner).
 * - Inline field-level 422 errors shown beneath each field.
 * - prefix_override: uppercase + ASCII client-side, trim on submit.
 * - logo_url: shows <img> thumbnail with referrerPolicy="no-referrer" + fallback on error.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertCompanyProfileAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import type { CompanyProfile } from "@/types/billing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanyProfileFormProps {
  initialProfile: CompanyProfile | null;
}

interface FieldErrors {
  legal_name?: string;
  address?: string;
  siret?: string;
  tva_number?: string;
  iban?: string;
  bic?: string;
  logo_url?: string;
  default_payment_terms?: string;
  prefix_override?: string;
  general?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PREFIX_RE = /^[A-Z0-9]*$/;

function validatePrefixOverride(val: string): string | undefined {
  const trimmed = val.trim().toUpperCase();
  if (trimmed.length > 8) return "Prefix must be 8 characters or fewer.";
  if (trimmed.length > 0 && !PREFIX_RE.test(trimmed))
    return "Prefix must contain only uppercase ASCII letters and digits (A-Z, 0-9).";
  return undefined;
}

function validateLegalName(val: string): string | undefined {
  const trimmed = val.trim();
  if (!trimmed) return "Legal name is required.";
  if (trimmed.length > 255) return "Legal name must be 255 characters or fewer.";
  return undefined;
}

function validateAddress(val: string): string | undefined {
  if (!val.trim()) return "Address is required.";
  return undefined;
}

// ---------------------------------------------------------------------------
// Logo thumbnail
// ---------------------------------------------------------------------------

function LogoThumbnail({ url }: { url: string }) {
  const [errored, setErrored] = useState(false);

  if (!url.trim() || errored) {
    return (
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded border text-[10px]"
        style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--muted)" }}
      >
        No image
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Logo preview"
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className="h-12 w-12 flex-shrink-0 rounded border object-contain"
      style={{ borderColor: "var(--line)" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompanyProfileForm({ initialProfile }: CompanyProfileFormProps) {
  const p = initialProfile;

  // Form state — seeded from existing profile
  const [legalName, setLegalName] = useState(p?.legal_name ?? "");
  const [address, setAddress] = useState(p?.address ?? "");
  const [siret, setSiret] = useState(p?.siret ?? "");
  const [tvaNumber, setTvaNumber] = useState(p?.tva_number ?? "");
  const [iban, setIban] = useState(p?.iban ?? "");
  const [bic, setBic] = useState(p?.bic ?? "");
  const [logoUrl, setLogoUrl] = useState(p?.logo_url ?? "");
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(p?.default_payment_terms ?? "");
  const [prefixOverride, setPrefixOverride] = useState(p?.prefix_override ?? "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validateAll(): FieldErrors {
    const errs: FieldErrors = {};
    const legalErr = validateLegalName(legalName);
    if (legalErr) errs.legal_name = legalErr;
    const addrErr = validateAddress(address);
    if (addrErr) errs.address = addrErr;
    const pfxErr = validatePrefixOverride(prefixOverride);
    if (pfxErr) errs.prefix_override = pfxErr;
    return errs;
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handlePrefixChange(val: string) {
    // Force uppercase ASCII on input
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setPrefixOverride(upper);
  }

  async function handleSave() {
    const errs = validateAll();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        legal_name: legalName.trim(),
        address: address.trim(),
        siret: siret.trim() || null,
        tva_number: tvaNumber.trim() || null,
        iban: iban.trim() || null,
        bic: bic.trim() || null,
        logo_url: logoUrl.trim() || null,
        default_payment_terms: defaultPaymentTerms.trim() || null,
        prefix_override: prefixOverride.trim().toUpperCase() || null,
      };

      const result = await upsertCompanyProfileAction(payload);

      if (!result.ok) {
        // Surface 422-style field errors if the backend echoes field info.
        // For now, show generic under general.
        setFieldErrors({ general: result.error.message });
        return;
      }

      toast.success("Company profile saved.");
    } catch {
      setFieldErrors({ general: "An unexpected error occurred. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Legal name */}
      <div className="space-y-1">
        <Label htmlFor="cp-legal-name" className="text-[12px]">
          Legal name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="cp-legal-name"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="e.g. Maison Lavandou SAS"
          maxLength={255}
          aria-invalid={!!fieldErrors.legal_name}
        />
        {fieldErrors.legal_name && (
          <p className="text-[12px] text-red-600">{fieldErrors.legal_name}</p>
        )}
      </div>

      {/* Address */}
      <div className="space-y-1">
        <Label htmlFor="cp-address" className="text-[12px]">
          Address <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="cp-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, city, postal code, country"
          rows={3}
          className="resize-none"
          aria-invalid={!!fieldErrors.address}
        />
        {fieldErrors.address && (
          <p className="text-[12px] text-red-600">{fieldErrors.address}</p>
        )}
      </div>

      {/* SIRET + TVA number — two-column row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cp-siret" className="text-[12px]">SIRET</Label>
          <Input
            id="cp-siret"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            placeholder="e.g. 12345678900012"
            maxLength={14}
          />
          {fieldErrors.siret && (
            <p className="text-[12px] text-red-600">{fieldErrors.siret}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="cp-tva" className="text-[12px]">TVA number</Label>
          <Input
            id="cp-tva"
            value={tvaNumber}
            onChange={(e) => setTvaNumber(e.target.value)}
            placeholder="e.g. FR12345678901"
          />
          {fieldErrors.tva_number && (
            <p className="text-[12px] text-red-600">{fieldErrors.tva_number}</p>
          )}
        </div>
      </div>

      {/* IBAN + BIC — two-column row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cp-iban" className="text-[12px]">IBAN</Label>
          <Input
            id="cp-iban"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="e.g. FR76 3000 6000 0112 3456 7890 189"
          />
          {fieldErrors.iban && (
            <p className="text-[12px] text-red-600">{fieldErrors.iban}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="cp-bic" className="text-[12px]">BIC / SWIFT</Label>
          <Input
            id="cp-bic"
            value={bic}
            onChange={(e) => setBic(e.target.value)}
            placeholder="e.g. BNPAFRPPXXX"
          />
          {fieldErrors.bic && (
            <p className="text-[12px] text-red-600">{fieldErrors.bic}</p>
          )}
        </div>
      </div>

      {/* Logo URL with thumbnail preview */}
      <div className="space-y-1">
        <Label htmlFor="cp-logo-url" className="text-[12px]">Logo URL</Label>
        <div className="flex items-center gap-3">
          <Input
            id="cp-logo-url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="flex-1"
          />
          <LogoThumbnail url={logoUrl} />
        </div>
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          A publicly accessible image URL. Displayed on PDF headers.
        </p>
        {fieldErrors.logo_url && (
          <p className="text-[12px] text-red-600">{fieldErrors.logo_url}</p>
        )}
      </div>

      {/* Default payment terms */}
      <div className="space-y-1">
        <Label htmlFor="cp-payment-terms" className="text-[12px]">Default payment terms</Label>
        <Textarea
          id="cp-payment-terms"
          value={defaultPaymentTerms}
          onChange={(e) => setDefaultPaymentTerms(e.target.value)}
          placeholder="e.g. Payment due 30 days from invoice date. Virement bancaire."
          rows={2}
          className="resize-none"
        />
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Pre-filled on new factures. Editable per document.
        </p>
        {fieldErrors.default_payment_terms && (
          <p className="text-[12px] text-red-600">{fieldErrors.default_payment_terms}</p>
        )}
      </div>

      {/* Prefix override */}
      <div className="space-y-1">
        <Label htmlFor="cp-prefix" className="text-[12px]">Document number prefix</Label>
        <Input
          id="cp-prefix"
          value={prefixOverride}
          onChange={(e) => handlePrefixChange(e.target.value)}
          placeholder="e.g. FLW (up to 8 chars)"
          maxLength={8}
          className="uppercase"
        />
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Optional. Uppercase letters and digits only (A-Z, 0-9). Max 8 characters.
          Example: &quot;FLW&quot; → FLW-DEV-2026-001.
        </p>
        {fieldErrors.prefix_override && (
          <p className="text-[12px] text-red-600">{fieldErrors.prefix_override}</p>
        )}
      </div>

      {/* General error */}
      {fieldErrors.general && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {fieldErrors.general}
        </p>
      )}

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="button" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting && <Loader2 size={13} className="mr-2 animate-spin" />}
          Save
        </Button>
        {isSubmitting && (
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>Saving…</span>
        )}
      </div>
    </div>
  );
}
