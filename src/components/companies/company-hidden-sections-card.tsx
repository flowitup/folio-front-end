"use client";

/**
 * CompanyHiddenSectionsCard — company admins switch off the sections their
 * company does not use (stored in `companies.hidden_sections`, shared with the
 * mobile app). Each switch saves at once; the session is then refreshed so the
 * navigation follows without a reload.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateCompanyAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import {
  COMPANY_AREAS,
  HIDEABLE_SECTIONS,
  type HideableSection,
} from "@/lib/companies/hidden-sections";

interface CompanyHiddenSectionsCardProps {
  companyId: string;
  companyName: string;
  initialHidden: string[];
  /** Called after a successful save (refresh the session and the company list). */
  onSaved?: () => void;
}

const PROJECT_SECTIONS = HIDEABLE_SECTIONS.filter((s) => !COMPANY_AREAS.includes(s));

export function CompanyHiddenSectionsCard({
  companyId,
  companyName,
  initialHidden,
  onSaved,
}: CompanyHiddenSectionsCardProps) {
  const t = useTranslations("companies.hiddenSections");
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [saving, setSaving] = useState<HideableSection | null>(null);
  const busyRef = useRef(false);

  async function toggle(section: HideableSection) {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(section);
    const next = hidden.includes(section)
      ? hidden.filter((s) => s !== section)
      : [...hidden, section];
    const ordered = HIDEABLE_SECTIONS.filter((s) => next.includes(s));
    try {
      const result = await updateCompanyAction(companyId, { hidden_sections: ordered });
      if (!result.ok) {
        toast.error(result.error.message || t("error"));
        return;
      }
      setHidden(result.data.hidden_sections ?? ordered);
      toast.success(t("saved"));
      onSaved?.();
    } catch {
      toast.error(t("error"));
    } finally {
      setSaving(null);
      busyRef.current = false;
    }
  }

  const renderGroup = (title: string, sections: readonly HideableSection[]) => (
    <fieldset className="mt-4">
      <legend className="label-cap mb-2">{title}</legend>
      <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
        {sections.map((section) => {
          const visible = !hidden.includes(section);
          const id = `hidden-section-${companyId}-${section}`;
          return (
            <li key={section} className="flex items-center justify-between gap-3 py-2.5">
              <label htmlFor={id} className="text-[14px]">
                {t(`sections.${section}`)}
                {section === "salaries" && (
                  <span className="ml-1 text-[12px]" style={{ color: "var(--muted)" }}>
                    ({t("mobileOnly")})
                  </span>
                )}
              </label>
              <span className="flex items-center gap-2">
                {saving === section && <Loader2 size={14} className="animate-spin" aria-hidden />}
                <input
                  id={id}
                  type="checkbox"
                  role="switch"
                  aria-checked={visible}
                  checked={visible}
                  disabled={saving !== null}
                  onChange={() => void toggle(section)}
                  className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                  data-testid={`hidden-section-toggle-${section}`}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );

  return (
    <section className="folio-card p-7" data-testid="company-hidden-sections-card">
      <h3 className="font-display text-[18px] font-medium tracking-tight">{t("title")}</h3>
      <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
        {t("description", { company: companyName })}
      </p>
      {renderGroup(t("companyAreas"), COMPANY_AREAS)}
      {renderGroup(t("projectSections"), PROJECT_SECTIONS)}
    </section>
  );
}
