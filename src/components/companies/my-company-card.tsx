"use client";

/**
 * MyCompanyCard — displays a single attached company in the "My companies" list.
 *
 * Shows: legal_name, address (truncated), masked sensitive fields (SIRET / TVA /
 * IBAN / BIC), primary badge, "Set as primary" toggle, "Detach" button with an
 * AlertDialog confirm.
 *
 * Submit guards: useRef prevents double-submit on setPrimary and detach.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Star, Loader2, Unlink } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { MaskDisplay } from "@/components/companies/mask-display";
import {
  setPrimaryCompanyAction,
  detachCompanyAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { MyCompany } from "@/types/companies";

interface MyCompanyCardProps {
  company: MyCompany;
  onMutated: () => void;
}

export function MyCompanyCard({ company, onMutated }: MyCompanyCardProps) {
  const t = useTranslations("companies");

  const [detachOpen, setDetachOpen] = useState(false);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);
  const [isDetaching, setIsDetaching] = useState(false);

  const settingPrimaryRef = useRef(false);
  const detachingRef = useRef(false);

  async function handleSetPrimary() {
    if (company.is_primary || settingPrimaryRef.current) return;
    settingPrimaryRef.current = true;
    setIsSettingPrimary(true);
    try {
      const result = await setPrimaryCompanyAction(company.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      onMutated();
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setIsSettingPrimary(false);
      settingPrimaryRef.current = false;
    }
  }

  async function handleDetach() {
    if (detachingRef.current) return;
    detachingRef.current = true;
    setIsDetaching(true);
    try {
      const result = await detachCompanyAction(company.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setDetachOpen(false);
      onMutated();
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setIsDetaching(false);
      detachingRef.current = false;
    }
  }

  return (
    <>
      <div
        className="folio-card p-5"
        style={{
          borderColor: company.is_primary ? "var(--accent)" : undefined,
          borderWidth: company.is_primary ? 2 : undefined,
        }}
      >
        {/* Header row: name + primary badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-display text-[16px] font-medium tracking-tight truncate">
                {company.legal_name}
              </h4>
              {company.is_primary && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: "var(--accent)",
                    color: "white",
                  }}
                >
                  <Star size={9} aria-hidden="true" />
                  {t("my.card.primaryBadge")}
                </span>
              )}
            </div>
            <p
              className="mt-0.5 text-[13px] truncate"
              style={{ color: "var(--muted)" }}
              title={company.address}
            >
              {company.address}
            </p>
          </div>
        </div>

        {/* Sensitive fields (always masked for non-admin callers) */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          {[
            { label: t("form.fields.siret.label"), value: company.siret },
            { label: t("form.fields.tvaNumber.label"), value: company.tva_number },
            { label: t("form.fields.iban.label"), value: company.iban },
            { label: t("form.fields.bic.label"), value: company.bic },
          ].map(({ label, value }) => (
            <div key={label}>
              <span
                className="label-cap block"
                style={{ color: "var(--muted)" }}
              >
                {label}
              </span>
              <MaskDisplay
                value={value}
                isMasked={
                  value !== null &&
                  value !== undefined &&
                  value.startsWith("····")
                }
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSetPrimary}
            disabled={company.is_primary || isSettingPrimary}
          >
            {isSettingPrimary ? (
              <Loader2 size={12} className="mr-1.5 animate-spin" />
            ) : (
              <Star size={12} className="mr-1.5" />
            )}
            {t("my.card.setPrimary")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetachOpen(true)}
            disabled={isDetaching}
            className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50"
          >
            <Unlink size={12} className="mr-1.5" />
            {t("my.card.detach")}
          </Button>
        </div>
      </div>

      {/* Detach confirm dialog */}
      <AlertDialog open={detachOpen} onOpenChange={setDetachOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("my.card.detach")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("my.card.detachConfirm", { name: company.legal_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDetaching}>
              {t("form.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDetach}
              disabled={isDetaching}
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
            >
              {isDetaching && (
                <Loader2 size={12} className="mr-1.5 animate-spin" />
              )}
              {t("my.card.detach")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
