"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Sun, Moon, Plus, Globe, LogOut, ChevronDown, Check } from "lucide-react";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { useTheme } from "@/context/ThemeContext";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { useRouter as useIntlRouter, usePathname as useIntlPathname } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Page meta keys reference message keys in `topbar.*` (title/subtitle) and
// `projects/planning/labor/invoices.newProject|newTask|logDay|newInvoice` for actions.
type PageKey = "dashboard" | "projects" | "settings" | "planning" | "labor" | "invoices" | "notes" | "members" | "documents";

const TOPBAR_KEYS: Record<PageKey, { titleKey: string; subtitleKey: string; actionKey?: string }> = {
  dashboard: {
    titleKey: "topbar.overviewTitle",
    subtitleKey: "topbar.overviewSubtitle",
    // Overview is read-only; no topbar action target exists.
  },
  projects: {
    titleKey: "topbar.projectsTitle",
    subtitleKey: "topbar.projectsSubtitle",
    actionKey: "projects.newProject",
  },
  settings: { titleKey: "topbar.settingsTitle", subtitleKey: "topbar.settingsSubtitle" },
  planning: {
    titleKey: "topbar.planningTitle",
    subtitleKey: "topbar.planningSubtitle",
    actionKey: "planning.newTask",
  },
  labor: {
    titleKey: "topbar.laborTitle",
    subtitleKey: "topbar.laborSubtitle",
    actionKey: "labor.logDay",
  },
  invoices: {
    titleKey: "topbar.invoicesTitle",
    subtitleKey: "topbar.invoicesSubtitle",
    actionKey: "invoices.newInvoice",
  },
  notes: {
    titleKey: "topbar.notesTitle",
    subtitleKey: "topbar.notesSubtitle",
    // No topbar action — Add Note lives inline in the notes agenda
  },
  members: {
    titleKey: "topbar.membersTitle",
    subtitleKey: "topbar.membersSubtitle",
    // No topbar action — Invite Member lives inline in the members table
  },
  documents: {
    // Reuse the documents namespace (already translated en/fr/vi) so the topbar
    // and page share one source of truth.
    titleKey: "documents.title",
    subtitleKey: "documents.subtitle",
    // No topbar action — upload lives inline in the documents panel dropzone.
  },
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const intlRouter = useIntlRouter();
  const intlPathname = useIntlPathname();
  const tCommon = useTranslations("common");
  const tTopbar = useTranslations();
  const { user, logout, isLoading } = useAuth();
  const { projects, selectedProjectId, selectedProject, selectProject } = useProject();
  const { resolvedTheme, setTheme } = useTheme();
  const tProjects = useTranslations("projects");

  const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), "") || "/";

  // Resolve page key from path
  let pageKey: PageKey = "dashboard";
  if (pathWithoutLocale === "/projects") pageKey = "projects";
  else if (pathWithoutLocale === "/settings") pageKey = "settings";
  else if (pathWithoutLocale === "/dashboard") pageKey = "dashboard";
  else {
    const projectMatch = pathWithoutLocale.match(/^\/projects\/[^/]+\/([^/]+)/);
    if (projectMatch && (projectMatch[1] in TOPBAR_KEYS)) {
      pageKey = projectMatch[1] as PageKey;
    }
  }

  const cfg = TOPBAR_KEYS[pageKey];
  const title = tTopbar(cfg.titleKey);
  const subtitle = tTopbar(cfg.subtitleKey);
  const actionLabel = cfg.actionKey ? tTopbar(cfg.actionKey) : null;

  const projectName = selectedProject?.name;
  const initials = user?.email?.charAt(0).toUpperCase() ?? "·";

  const handleSwitchProject = (projectId: string) => {
    selectProject(projectId);
    const projectSubrouteMatch = pathWithoutLocale.match(/^\/projects\/[^/]+\/(.+)$/);
    if (projectSubrouteMatch) {
      router.push(`/${locale}/projects/${projectId}/${projectSubrouteMatch[1]}`);
    }
  };

  // Each topbar action button hands off to the page that owns the create flow,
  // signalling intent via a query param the page consumes (mirrors the
  // /projects?new=1 pattern from the create-project fix).
  const handleAction = () => {
    if (pageKey === "projects") {
      router.push(`/${locale}/projects?new=1`);
      return;
    }
    if (!selectedProject) return;
    if (pageKey === "planning") {
      router.push(`/${locale}/projects/${selectedProject.id}/planning?new=1`);
      return;
    }
    if (pageKey === "labor") {
      router.push(`/${locale}/projects/${selectedProject.id}/labor?logDay=1`);
      return;
    }
    if (pathWithoutLocale.endsWith("/invoices")) {
      router.push(`/${locale}/projects/${selectedProject.id}/invoices/new`);
    }
  };

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <header className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 lg:gap-6 lg:px-8 lg:pb-4 lg:pt-6">
      <div className="min-w-0 flex-1">
        <div
          className="mb-1 hidden items-center gap-2 text-[12px] lg:flex"
          style={{ color: "var(--muted)" }}
        >
          {projectName && (
            <>
              <span>{projectName}</span>
              <span style={{ color: "var(--line-2)" }}>›</span>
            </>
          )}
          <span style={{ color: "var(--ink-2)" }}>{title}</span>
        </div>
        <h1 className="font-display text-2xl font-medium leading-[1.05] tracking-tight lg:text-[34px]">
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-1 hidden text-[13.5px] lg:block"
            style={{ color: "var(--muted)", maxWidth: 540 }}
          >
            {subtitle}
          </p>
        )}
        {projects.length > 0 && (
          <div className="mt-2 lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-semibold shadow-sm"
                  style={{ background: "var(--surface-2)", color: "var(--ink)", borderColor: "var(--line)" }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    {(projectName ?? "P").charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[140px] truncate">
                    {projectName ?? tProjects("selectProject")}
                  </span>
                  <ChevronDown size={14} style={{ color: "var(--muted)" }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[240px]">
                {projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => handleSwitchProject(p.id)}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                      style={{ background: p.id === selectedProjectId ? "var(--accent)" : "var(--muted)" }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{p.name}</span>
                    {p.id === selectedProjectId && (
                      <Check size={14} className="flex-shrink-0" style={{ color: "var(--accent)" }} />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-1 lg:gap-2">
        <NotificationsBell />
        <button
          type="button"
          className="btn btn-quiet"
          aria-label={tTopbar("topbar.theme")}
          onClick={toggleTheme}
        >
          {resolvedTheme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <div className="mx-1 hidden h-6 w-px lg:block" style={{ background: "var(--line-2)" }} />

        {actionLabel && (
          <button type="button" className="btn btn-primary" onClick={handleAction}>
            <Plus size={14} /> <span className="hidden lg:inline">{actionLabel}</span>
          </button>
        )}

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="avatar ml-1"
                title={user.email}
                style={{ background: "var(--accent)", color: "white", cursor: "pointer" }}
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-[12px]" style={{ color: "var(--muted)" }}>
                {user.email}
              </div>
              <DropdownMenuSeparator />
              <div className="label-cap px-2 pb-1 pt-2">{tCommon("language")}</div>
              {locales.map((loc) => (
                <DropdownMenuItem
                  key={loc}
                  onClick={() => intlRouter.replace(intlPathname, { locale: loc })}
                >
                  <Globe size={14} />
                  <span className="font-medium">{loc.toUpperCase()}</span>
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {localeNames[loc]}
                  </span>
                  {locale === loc && (
                    <span className="ml-auto text-[11px]" style={{ color: "var(--accent-ink)" }}>
                      ✓
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                disabled={isLoading}
                style={{ color: "var(--negative)" }}
              >
                <LogOut size={14} />
                {tCommon("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
