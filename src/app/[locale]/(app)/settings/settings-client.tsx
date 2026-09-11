"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { UsersSection } from "./users/users-section";
import { InvoicePrefixSection } from "./invoice-prefix-section";
import { AdminCompaniesSection } from "@/components/companies/admin-companies-section";
import { CompanySettingsSection } from "@/components/companies/company-settings-section";
import { PaymentMethodsSettingsSection } from "@/components/payment-methods/payment-methods-settings-section";
import { NotificationPreferencesSection } from "@/components/notifications/notification-preferences-section";
import { ProfileForm } from "@/components/settings/profile-form";
import { isPlatformOps } from "@/lib/auth/permissions";
import type { ProjectSummary } from "@/lib/api/projects-server";
import pkg from "../../../../../package.json";

/**
 * Every entry here renders a working surface. "Team" and "Billing" used to sit
 * in this list as permanent "coming soon" cards — Team never had a backing
 * feature and Billing already owns a top-level nav entry — so both are gone,
 * and with them the placeholder branch they were the only reason for. "About"
 * held a single line (the app version), which now sits in the page footer
 * instead of behind a tab of its own.
 */
const BASE_SECTION_KEYS = [
  "profile",
  "company",
  "payment-methods",
  "notifications",
  "users",
] as const;
type SectionKey = (typeof BASE_SECTION_KEYS)[number] | "project";

interface Props {
  projects: ProjectSummary[];
}

const ALL_VALID_KEYS: readonly string[] = [...BASE_SECTION_KEYS, "project"];

/**
 * Derive the initial active tab from the URL hash (if valid).
 * Using a lazy initializer avoids the cascading setState-in-effect pattern.
 * Falls back to "profile" when no hash or hash doesn't match a known section —
 * which is also what retired hashes (#team, #billing, #about) now do.
 */
function initialActiveFromHash(isOps: boolean): SectionKey {
  if (typeof window === "undefined") return "profile";
  const hash = window.location.hash.replace("#", "");
  // "my-companies" was the attachments tab before it was folded into
  // "company"; keep old links and bookmarks landing on the merged section.
  if (hash === "my-companies") return "company";
  // "users" is platform-ops only. For anyone else the nav no longer offers it,
  // so a stale #users link lands on Profile rather than on an orphan tab.
  if (hash === "users" && !isOps) return "profile";
  return ALL_VALID_KEYS.includes(hash) ? (hash as SectionKey) : "profile";
}

export function SettingsClient({ projects }: Props) {
  const t = useTranslations("settings");
  const { user } = useAuth();
  const { selectedProject } = useProject();

  // The session user is server-seeded into AuthProvider, so this is settled on
  // the first render — the Users tab never flickers in and out.
  const isSuperadmin = isPlatformOps(user?.permissions);

  // Lazy initializer reads window.location.hash once at mount — no effect needed.
  const [active, setActive] = useState<SectionKey>(() =>
    initialActiveFromHash(isSuperadmin)
  );

  const sectionKeys: SectionKey[] = [
    "profile",
    ...(selectedProject ? ["project" as const] : []),
    // One Company tab for everyone: it carries the caller's own attachments
    // (identity card, primary, detach, attach-by-token) and, for a company
    // admin only, that company's self-service tools.
    "company",
    "payment-methods",
    "notifications",
    // Platform ops only: for everyone else this tab's entire content was a
    // permission-denied panel, so it is no longer offered at all.
    ...(isSuperadmin ? ["users" as const] : []),
  ];

  return (
    <div className="fade-up grid grid-cols-12 gap-5 px-4 pb-12 lg:gap-8 lg:px-8">
      {/* Anchor nav */}
      <aside className="col-span-12 lg:col-span-3">
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 lg:mx-0 lg:flex-col lg:gap-0 lg:space-y-0.5 lg:overflow-visible lg:px-0 lg:pb-0 lg:sticky lg:top-4">
          {sectionKeys.map((key) => {
            const label =
              key === "users"
                ? t("users.title")
                : key === "payment-methods"
                  ? t("paymentMethods")
                  : key === "company"
                    ? t("company.title")
                    : t(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors lg:w-full lg:rounded-lg lg:border-transparent lg:text-left ${
                  active === key
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] lg:border-transparent lg:bg-[var(--paper-2)] lg:text-[var(--ink)]"
                    : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] lg:border-transparent"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="col-span-12 space-y-5 lg:col-span-9">
        {active === "profile" && <ProfileForm />}

        {active === "project" && selectedProject && <InvoicePrefixSection />}

        {active === "company" && (
          <div className="space-y-5">
            <CompanySettingsSection />
            {isSuperadmin && <AdminCompaniesSection />}
          </div>
        )}

        {active === "payment-methods" && (
          <section className="folio-card p-7">
            <PaymentMethodsSettingsSection />
          </section>
        )}

        {active === "notifications" && (
          <section className="folio-card p-7">
            <NotificationPreferencesSection />
          </section>
        )}

        {active === "users" && (
          <section className="folio-card p-7">
            <UsersSection projects={projects} />
          </section>
        )}

        <p className="pt-1 text-[11px]" style={{ color: "var(--muted)" }}>
          Folio v{pkg.version}
        </p>
      </div>
    </div>
  );
}
