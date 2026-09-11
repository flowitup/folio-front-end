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

const BASE_SECTION_KEYS = [
  "profile",
  "team",
  "company",
  "billing",
  "payment-methods",
  "notifications",
  "users",
  "about",
] as const;
type SectionKey = (typeof BASE_SECTION_KEYS)[number] | "project";

interface Props {
  projects: ProjectSummary[];
}

/**
 * Derive the initial active tab from the URL hash (if valid).
 * Using a lazy initializer avoids the cascading setState-in-effect pattern.
 * Falls back to "profile" when no hash or hash doesn't match a known section.
 */
const ALL_VALID_KEYS: readonly string[] = [...BASE_SECTION_KEYS, "project"];

function initialActiveFromHash(): SectionKey {
  if (typeof window === "undefined") return "profile";
  const hash = window.location.hash.replace("#", "");
  // "my-companies" was the attachments tab before it was folded into
  // "company"; keep old links and bookmarks landing on the merged section.
  if (hash === "my-companies") return "company";
  return ALL_VALID_KEYS.includes(hash) ? (hash as SectionKey) : "profile";
}

export function SettingsClient({ projects }: Props) {
  const t = useTranslations("settings");
  const { user } = useAuth();
  const { selectedProject } = useProject();
  // Lazy initializer reads window.location.hash once at mount — no effect needed.
  const [active, setActive] = useState<SectionKey>(initialActiveFromHash);

  const isSuperadmin = isPlatformOps(user?.permissions);

  const sectionKeys: SectionKey[] = [
    "profile",
    ...(selectedProject ? ["project" as const] : []),
    "team",
    // One Company tab for everyone: it carries the caller's own attachments
    // (identity card, primary, detach, attach-by-token) and, for a company
    // admin only, that company's self-service tools.
    "company",
    "billing",
    "payment-methods",
    "notifications",
    "users",
    "about",
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

        {active === "users" && (
          <section className="folio-card p-7">
            <UsersSection projects={projects} />
          </section>
        )}

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

        {active === "about" && (
          <section className="folio-card p-7">
            <h3 className="font-display text-[22px] font-medium tracking-tight">
              {t("about")}
            </h3>
            <div className="ink-divider my-5" />
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-[13px]">
              <dt className="label-cap" style={{ color: "var(--muted)" }}>
                {t("version")}
              </dt>
              <dd className="num">v{pkg.version}</dd>
            </dl>
          </section>
        )}

        {active !== "profile" &&
          active !== "project" &&
          active !== "company" &&
          active !== "users" &&
          active !== "payment-methods" &&
          active !== "notifications" &&
          active !== "about" && (
            <section className="folio-card p-12 text-center">
              <p className="font-display text-[20px] font-medium tracking-tight">{t(active)}</p>
              <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
                {t("comingSoon")}
              </p>
            </section>
          )}
      </div>
    </div>
  );
}
