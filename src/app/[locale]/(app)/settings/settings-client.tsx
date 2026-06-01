"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { UsersSection } from "./users/users-section";
import { InvoicePrefixSection } from "./invoice-prefix-section";
import { MyCompaniesSection } from "@/components/companies/my-companies-section";
import { AdminCompaniesSection } from "@/components/companies/admin-companies-section";
import type { Role } from "@/lib/api/roles";
import type { ProjectSummary } from "@/lib/api/projects-server";
import pkg from "../../../../../package.json";

const BASE_SECTION_KEYS = [
  "profile",
  "team",
  "billing",
  "my-companies",
  "notifications",
  "users",
  "about",
] as const;
type SectionKey = (typeof BASE_SECTION_KEYS)[number] | "project";

interface Props {
  roles: Role[];
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
  return ALL_VALID_KEYS.includes(hash) ? (hash as SectionKey) : "profile";
}

export function SettingsClient({ roles, projects }: Props) {
  const t = useTranslations("settings");
  const { user } = useAuth();
  const { selectedProject } = useProject();
  // Lazy initializer reads window.location.hash once at mount — no effect needed.
  const [active, setActive] = useState<SectionKey>(initialActiveFromHash);

  const isSuperadmin = (user?.permissions ?? []).includes("*:*");
  const initials = user?.email?.charAt(0).toUpperCase() ?? "·";

  const sectionKeys: SectionKey[] = [
    "profile",
    ...(selectedProject ? ["project" as const] : []),
    "team",
    "billing",
    "my-companies",
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
                : key === "my-companies"
                  ? t("myCompanies.title")
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
        {active === "profile" && (
          <section className="folio-card p-7">
            <div className="mb-5 flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full font-display text-[24px] font-medium text-white"
                style={{ background: "var(--accent)" }}
              >
                {initials}
              </div>
              <div>
                <h2 className="font-display text-[22px] font-medium tracking-tight">
                  {user?.email ?? "Camille Roux"}
                </h2>
                <p className="text-[13px]" style={{ color: "var(--muted)" }}>
                  {t("ownerLine", { project: "Maison Lavandou" })}
                </p>
              </div>
            </div>

            <div className="ink-divider my-5" />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="label-cap">{t("email")}</label>
                <input
                  className="folio-input mt-1.5"
                  type="email"
                  defaultValue={user?.email ?? ""}
                />
              </div>
              <div>
                <label className="label-cap">{t("phone")}</label>
                <input className="folio-input mt-1.5" type="tel" defaultValue="+33 6 12 34 56 78" />
              </div>
            </div>
          </section>
        )}

        {active === "project" && selectedProject && <InvoicePrefixSection />}

        {active === "users" && (
          <section className="folio-card p-7">
            <UsersSection roles={roles} projects={projects} />
          </section>
        )}

        {active === "my-companies" && (
          <div className="space-y-5">
            <MyCompaniesSection />
            {isSuperadmin && <AdminCompaniesSection />}
          </div>
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
          active !== "users" &&
          active !== "my-companies" &&
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
