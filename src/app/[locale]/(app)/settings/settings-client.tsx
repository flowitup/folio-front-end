"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Check, Globe, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { UsersSection } from "./users/users-section";
import type { Role } from "@/lib/api/roles";
import type { ProjectSummary } from "@/lib/api/projects-server";

const SECTION_KEYS = [
  "profile",
  "project",
  "team",
  "billing",
  "notifications",
  "preferences",
  "users",
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  vi: "🇻🇳",
  fr: "🇫🇷",
};

const LOCALE_TAGLINES: Record<Locale, string> = {
  en: "English (UK / US)",
  vi: "Tiếng Việt",
  fr: "Français",
};

interface Props {
  roles: Role[];
  projects: ProjectSummary[];
}

export function SettingsClient({ roles, projects }: Props) {
  const t = useTranslations("settings");
  const { user } = useAuth();
  const [active, setActive] = useState<SectionKey>("profile");
  const currentLocale = useLocale() as Locale;
  const intlRouter = useRouter();
  const intlPathname = usePathname();
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  const [isPending, startTransition] = useTransition();

  const initials = user?.email?.charAt(0).toUpperCase() ?? "·";

  const handleLocaleChange = (next: Locale) => {
    if (next === currentLocale || isPending) return;
    setPendingLocale(next);
    startTransition(() => {
      // next-intl preserves pathname & query, only swaps the locale prefix.
      intlRouter.replace(intlPathname, { locale: next });
    });
  };

  return (
    <div className="fade-up grid grid-cols-12 gap-8 px-8 pb-12">
      {/* Anchor nav */}
      <aside className="col-span-12 lg:col-span-3">
        <nav className="space-y-0.5 sticky top-4">
          {SECTION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={`nav-link w-full ${active === key ? "active" : ""}`}
              style={{ textAlign: "left" }}
            >
              <span className="font-medium">
                {key === "users" ? t("users.title") : t(key)}
              </span>
            </button>
          ))}
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

        {active === "project" && (
          <section className="folio-card p-7">
            <h3 className="font-display text-[22px] font-medium tracking-tight">
              {t("projectDetails")}
            </h3>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              {t("projectDetailsTagline")}
            </p>
            <div className="ink-divider my-5" />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="label-cap">{t("projectName")}</label>
                <input className="folio-input mt-1.5" defaultValue="Maison Lavandou" />
              </div>
              <div>
                <label className="label-cap">{t("address")}</label>
                <input
                  className="folio-input mt-1.5"
                  defaultValue="14 Chemin des Oliviers, Le Lavandou"
                />
              </div>
              <div>
                <label className="label-cap">{t("startDate")}</label>
                <input className="folio-input num mt-1.5" defaultValue="2025-09-08" />
              </div>
              <div>
                <label className="label-cap">{t("targetCompletion")}</label>
                <input className="folio-input num mt-1.5" defaultValue="2026-08-30" />
              </div>
            </div>
          </section>
        )}

        {active === "preferences" && (
          <section className="folio-card p-7">
            <div className="flex items-start gap-3">
              <Globe size={18} style={{ color: "var(--accent)", marginTop: 2 }} />
              <div className="flex-1">
                <h3 className="font-display text-[22px] font-medium tracking-tight">
                  {t("language")}
                </h3>
                <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                  {t("languageDesc")}
                </p>
              </div>
            </div>

            <div className="ink-divider my-5" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {locales.map((loc) => {
                const isActive = loc === currentLocale;
                const isLoading = pendingLocale === loc && isPending;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleLocaleChange(loc)}
                    disabled={isPending}
                    className="card-paper-surface relative flex items-start gap-3 p-4 text-left transition-all"
                    style={{
                      borderColor: isActive ? "var(--accent)" : "var(--line)",
                      borderWidth: isActive ? 2 : 1,
                      cursor: isPending ? "wait" : "pointer",
                      opacity: isPending && !isActive && !isLoading ? 0.6 : 1,
                    }}
                  >
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-[20px]"
                      style={{ background: "var(--paper)" }}
                    >
                      {LOCALE_FLAGS[loc]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium">{localeNames[loc]}</div>
                      <div
                        className="num mt-0.5 text-[11px]"
                        style={{ color: "var(--muted)" }}
                      >
                        {loc.toUpperCase()} · {LOCALE_TAGLINES[loc]}
                      </div>
                    </div>
                    {isActive && !isLoading && (
                      <span
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: "var(--accent)", color: "white" }}
                      >
                        <Check size={12} />
                      </span>
                    )}
                    {isLoading && (
                      <Loader2
                        size={14}
                        className="animate-spin flex-shrink-0"
                        style={{ color: "var(--muted)", marginTop: 4 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <p
              className="num mt-5 text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              {t("currentlySetTo", { lang: localeNames[currentLocale] })}
            </p>
          </section>
        )}

        {active === "users" && (
          <section className="folio-card p-7">
            <UsersSection roles={roles} projects={projects} />
          </section>
        )}

        {active !== "profile" &&
          active !== "project" &&
          active !== "preferences" &&
          active !== "users" && (
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
