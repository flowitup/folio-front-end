/**
 * CompanyProfileSection — Settings section wrapper for the company profile form.
 *
 * Renders: section heading + explainer + CompanyProfileForm.
 * Embedded in the Settings page with id="company-profile" so that
 * /settings#company-profile anchor links (from missing-profile callouts) scroll here.
 */

import { CompanyProfileForm } from "@/components/billing/company-profile-form";
import type { CompanyProfile } from "@/types/billing";

interface Props {
  initialProfile: CompanyProfile | null;
}

export function CompanyProfileSection({ initialProfile }: Props) {
  return (
    <section id="company-profile" className="folio-card p-7">
      <h3 className="font-display text-[22px] font-medium tracking-tight">
        Company profile
      </h3>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
        Used as issuer info on every devis &amp; facture. Snapshotted at document creation.
      </p>

      <div className="ink-divider my-5" />

      <CompanyProfileForm initialProfile={initialProfile} />
    </section>
  );
}
