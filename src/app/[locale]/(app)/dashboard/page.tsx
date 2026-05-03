"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Plus,
  Camera,
  ScrollText,
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  HardHat,
  Receipt,
  Check,
  Trees,
  Building2,
  Hammer,
  Cloud,
  Zap,
  Paintbrush,
  Flag,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";

// Currency formatter — locale-aware (uses page locale for formatting; currency stays EUR per design).
const fmtEURForLocale = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale === "fr" ? "fr-FR" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

type PhaseEntry = {
  key: string;
  icon: typeof Trees;
  done: boolean;
  current?: boolean;
};

const PHASES: PhaseEntry[] = [
  { key: "site", icon: Trees, done: true },
  { key: "foundation", icon: Building2, done: true },
  { key: "framing", icon: Hammer, done: false, current: true },
  { key: "roof", icon: Cloud, done: false },
  { key: "mep", icon: Zap, done: false },
  { key: "finish", icon: Paintbrush, done: false },
  { key: "handover", icon: Flag, done: false },
];

const BUDGET_BREAKDOWN: { key: string; budget: number; spent: number; color: string }[] = [
  { key: "foundation", budget: 58000, spent: 56400, color: "#5a7a4a" },
  { key: "framing", budget: 92000, spent: 64800, color: "#1a1a1a" },
  { key: "envelope", budget: 71000, spent: 12000, color: "#c9a961" },
  { key: "mep", budget: 58000, spent: 21000, color: "#e8843c" },
  { key: "finish", budget: 78000, spent: 6200, color: "#8a8479" },
  { key: "reserve", budget: 23000, spent: 2000, color: "#b8b1a4" },
];

const PHOTOS = [
  { id: "ph1", date: "Apr 24", label: "North wall — day 3", tone: "linear-gradient(135deg,#a08763,#5b4a36)" },
  { id: "ph2", date: "Apr 22", label: "Joists delivered", tone: "linear-gradient(135deg,#c0a886,#7e6845)" },
  { id: "ph3", date: "Apr 20", label: "Concrete pour east footing", tone: "linear-gradient(135deg,#8a8a86,#4a4a47)" },
  { id: "ph4", date: "Apr 18", label: "Sill plates set", tone: "linear-gradient(135deg,#b59a7a,#6c5538)" },
  { id: "ph5", date: "Apr 15", label: "Backfill complete", tone: "linear-gradient(135deg,#9d8763,#5b4a2e)" },
];

const ACTIVITY = [
  { id: "ac1", who: "Élise Dubois", what: "logged 8h attendance for 3 workers", when: "2h ago", icon: HardHat },
  { id: "ac2", who: "Julien Marchand", what: "uploaded 4 photos to Framing — North wall", when: "4h ago", icon: Camera },
  { id: "ac3", who: "Camille Roux", what: "approved invoice INV-2026-018 from Béton Provence", when: "yesterday", icon: Receipt },
  { id: "ac4", who: "Antoine Vidal", what: "completed 'Set sill plates ground floor'", when: "yesterday", icon: Check },
  { id: "ac5", who: "Julien Marchand", what: "commented on 'Frame north wall — bedroom 2 & 3'", when: "2d ago", icon: ScrollText },
];

export default function DashboardPage() {
  const { selectedProject } = useProject();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("dashboard");
  const fmtEUR = (n: number) => fmtEURForLocale(n, locale);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const project = {
    name: selectedProject?.name ?? "Maison Lavandou",
    address:
      (selectedProject as { address?: string })?.address ?? "14 Chemin des Oliviers, Le Lavandou",
    cover:
      (selectedProject as { cover?: string })?.cover ??
      "linear-gradient(135deg, #d8b896 0%, #b8845f 60%, #8a5836 100%)",
    progress: 0.42,
  };

  // Each CTA hands off to the page that owns the real flow. Disabled when
  // there's no selected project (Overview is also reachable in that empty
  // state, so the buttons must be safe-no-op rather than navigating to /undefined).
  const projectId = selectedProject?.id;
  const goLabor = () => {
    if (projectId) router.push(`/${locale}/projects/${projectId}/labor`);
  };
  const goNotes = () => {
    if (projectId) router.push(`/${locale}/projects/${projectId}/notes`);
  };
  const goPlanning = () => {
    if (projectId) router.push(`/${locale}/projects/${projectId}/planning`);
  };
  const noProject = !projectId;

  const totalBudget = BUDGET_BREAKDOWN.reduce((s, b) => s + b.budget, 0);
  const totalSpent = BUDGET_BREAKDOWN.reduce((s, b) => s + b.spent, 0);
  const pctSpent = totalSpent / totalBudget;

  return (
    <div className="fade-up space-y-6 px-8 pb-12">
      {/* Hero panel */}
      <section className="folio-card relative overflow-hidden">
        <div className="grid grid-cols-12">
          {/* Left — name, address, progress */}
          <div className="relative col-span-12 p-7 pr-6 lg:col-span-7">
            <div className="mb-3 flex items-center gap-2">
              <span className="stamp accent">{t("inProgress")}</span>
              <span className="stamp">
                {t("phaseLabel", { n: "03", name: t("phases.framing") })}
              </span>
            </div>
            <h2 className="font-display text-[44px] font-medium leading-[1.02] tracking-tight">
              {project.name}
            </h2>
            <p className="mt-1 text-[14px]" style={{ color: "var(--muted)" }}>
              {project.address}
            </p>

            <div className="mt-7">
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <div className="label-cap">{t("started")}</div>
                  <div className="font-display num text-[18px]">
                    {new Date("2025-09-08").toLocaleDateString(locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="label-cap">{t("targetHandover")}</div>
                  <div className="font-display num text-[18px]">
                    {new Date("2026-08-30").toLocaleDateString(locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="measure" />
                <div
                  className="absolute left-0 top-0 h-px"
                  style={{ background: "var(--ink)", width: `${project.progress * 100}%` }}
                />
                <div
                  className="absolute -top-1 h-3 w-3 rounded-full"
                  style={{
                    left: `calc(${project.progress * 100}% - 6px)`,
                    background: "var(--accent)",
                    border: "2px solid var(--card-paper)",
                  }}
                />
              </div>
              <div
                className="mt-3 flex items-center justify-between text-[12px]"
                style={{ color: "var(--muted)" }}
              >
                <span>{t("dayOf", { day: 230, total: 540 })}</span>
                <span>
                  <span className="num font-medium" style={{ color: "var(--ink)" }}>
                    {Math.round(project.progress * 100)}%
                  </span>{" "}
                  · {t("onTrack")}
                </span>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={goLabor}
                disabled={noProject}
              >
                <Plus size={14} /> {t("logEntry")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={goNotes}
                disabled={noProject}
              >
                <ScrollText size={14} /> {t("dailyReport")}
              </button>
            </div>
          </div>

          {/* Right — cover panel */}
          <div
            className="relative col-span-12 lg:col-span-5"
            style={{ background: project.cover, minHeight: 360 }}
          >
            <div className="blueprint-grid absolute inset-0 opacity-30" />
            <div className="paper-noise absolute inset-0" />
            <div
              className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full border-2"
              style={{ borderColor: "rgba(255,255,255,0.6)" }}
            >
              <div className="font-display text-[10px] text-white">N</div>
              <svg className="absolute" width="48" height="48" viewBox="0 0 48 48">
                <path d="M24 8 L20 24 L24 22 L28 24 Z" fill="white" stroke="white" strokeWidth="0.5" />
              </svg>
            </div>
            <div className="absolute bottom-5 left-5 right-5 text-white">
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] opacity-80">
                {t("plot")}
              </div>
              <div className="font-display text-[24px] leading-tight">820 m² · 2 floors · 4 bed</div>
              <div className="num mt-1 text-[12px] opacity-80">43.1383° N · 6.3686° E</div>
            </div>
          </div>
        </div>
      </section>

      {/* Phase ribbon */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h3 className="font-display text-[20px] font-medium tracking-tight">
            {t("buildPhases")}
          </h3>
          <button
            type="button"
            className="flex items-center gap-1 text-[12.5px]"
            style={{ color: "var(--muted)" }}
            onClick={goPlanning}
            disabled={noProject}
          >
            {t("viewGantt")} <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
          {PHASES.map((p, i) => {
            const Ic = p.icon;
            return (
              <div
                key={p.key}
                className={`phase-step !flex-col !items-start ${p.done ? "done" : ""} ${
                  p.current ? "current" : ""
                }`}
                style={{ minHeight: 92 }}
              >
                <div className="flex w-full items-center gap-2">
                  <Ic size={15} />
                  <span className="num text-[10.5px]" style={{ opacity: 0.7 }}>
                    0{i + 1}
                  </span>
                </div>
                <div className="mt-2 text-[13px] font-medium">{t(`phases.${p.key}`)}</div>
                {p.current && (
                  <div className="num mt-auto text-[11px]" style={{ color: "var(--accent-ink)" }}>
                    {t("phaseInProgress")}
                  </div>
                )}
                {p.done && (
                  <div className="mt-auto text-[11px]" style={{ opacity: 0.6 }}>
                    {t("phaseDone")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Budget + Today */}
      <section className="grid grid-cols-12 gap-5">
        <div className="folio-card col-span-12 p-6 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="label-cap">{t("budgetVsActual")}</div>
              <h3 className="font-display mt-1 text-[22px] font-medium tracking-tight">
                {fmtEUR(totalSpent)}{" "}
                <span className="text-[14px] font-normal" style={{ color: "var(--muted)" }}>
                  {t("budgetOf", { total: fmtEUR(totalBudget) })}
                </span>
              </h3>
            </div>
            <div className="text-right">
              <div
                className="font-display num text-[28px] font-medium"
                style={{ color: pctSpent > 0.9 ? "var(--negative)" : "var(--ink)" }}
              >
                {Math.round(pctSpent * 100)}%
              </div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                {t("spentSoFar")}
              </div>
            </div>
          </div>

          <div
            className="flex h-3 overflow-hidden rounded-full"
            style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
          >
            {BUDGET_BREAKDOWN.map((b) => (
              <div
                key={b.key}
                style={{ width: `${(b.spent / totalBudget) * 100}%`, background: b.color }}
                title={`${t(`budget.${b.key}`)}: ${fmtEUR(b.spent)}`}
              />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {BUDGET_BREAKDOWN.map((b) => {
              const pct = b.spent / b.budget;
              return (
                <div key={b.key} className="flex items-center gap-3">
                  <div className="h-8 w-2 rounded-full" style={{ background: b.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[13px] font-medium">
                        {t(`budget.${b.key}`)}
                      </span>
                      <span
                        className="num text-[12px]"
                        style={{ color: pct > 0.95 ? "var(--negative)" : "var(--muted)" }}
                      >
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                    <div className="num text-[11.5px]" style={{ color: "var(--muted)" }}>
                      {fmtEUR(b.spent)} / {fmtEUR(b.budget)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-12 space-y-5 lg:col-span-5">
          <div className="folio-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="label-cap">{t("todayOnSite")}</div>
              <span className="stamp">
                {new Date().toLocaleDateString(locale, { day: "numeric", month: "short" })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="font-display num text-[28px] font-medium leading-none">4</div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                  {t("workersLabel")}
                </div>
              </div>
              <div>
                <div className="font-display num text-[28px] font-medium leading-none">31.5h</div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                  {t("hoursSoFar")}
                </div>
              </div>
              <div>
                <div
                  className="font-display num text-[28px] font-medium leading-none"
                  style={{ color: "var(--accent)" }}
                >
                  {fmtEUR(976)}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                  {t("laborToday")}
                </div>
              </div>
            </div>
            <div className="hairline mt-5 border-t pt-4">
              <div className="mb-2 flex -space-x-1.5">
                <div className="avatar" style={{ background: "#1a1a1a" }}>AV</div>
                <div className="avatar" style={{ background: "#5a7a4a" }}>ED</div>
                <div className="avatar" style={{ background: "#c9a961" }}>KF</div>
                <div className="avatar" style={{ background: "#e8843c" }}>TB</div>
              </div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                Antoine, Élise, Karim, Thomas
              </div>
            </div>
          </div>

          {!alertDismissed && (
            <div className="card-paper-surface p-5" data-testid="rebar-alert">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{t("rebarInspectionTitle")}</div>
                  <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
                    {t("rebarInspectionBody")}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-quiet"
                      style={{ fontSize: 12 }}
                      onClick={() => setAlertDismissed(true)}
                    >
                      {t("dismiss")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Photos + Activity */}
      <section className="grid grid-cols-12 gap-5">
        <div className="folio-card col-span-12 p-6 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="label-cap">{t("siteProgress")}</div>
              <h3 className="font-display mt-1 text-[20px] font-medium tracking-tight">
                {t("recentPhotos")}
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PHOTOS.slice(0, 3).map((p) => (
              <div key={p.id} className="photo-card" style={{ background: p.tone }}>
                <div className="blueprint-grid absolute inset-0 opacity-20" />
                <div
                  className="absolute bottom-0 left-0 right-0 p-3 text-white"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }}
                >
                  <div className="num text-[10px] opacity-80">{p.date}</div>
                  <div className="text-[12.5px] font-medium leading-tight">{p.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PHOTOS.slice(3).map((p) => (
              <div
                key={p.id}
                className="photo-card"
                style={{ background: p.tone, aspectRatio: "4 / 2.5" }}
              >
                <div className="num absolute bottom-2 left-2.5 text-[11px] text-white opacity-90">
                  {p.date}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="folio-card col-span-12 p-6 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="label-cap">{t("journal")}</div>
              <h3 className="font-display mt-1 text-[20px] font-medium tracking-tight">
                {t("recentActivity")}
              </h3>
            </div>
          </div>
          <ul className="space-y-4">
            {ACTIVITY.map((a) => {
              const Ic = a.icon;
              return (
                <li key={a.id} className="flex gap-3">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
                  >
                    <Ic size={14} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="text-[13px] leading-snug">
                      <span className="font-medium">{a.who}</span>{" "}
                      <span style={{ color: "var(--ink-2)" }}>{a.what}</span>
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                      {a.when}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="mt-5 flex items-center gap-1 text-[12.5px]"
            style={{ color: "var(--accent-ink)" }}
            onClick={goNotes}
            disabled={noProject}
          >
            {t("seeFullJournal")} <ArrowRight size={12} />
          </button>
        </div>
      </section>
    </div>
  );
}
