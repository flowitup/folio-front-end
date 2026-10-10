"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Plus, LogOut, ChevronDown, Check } from "lucide-react";
import { HelpSheet } from "@/components/help/help-sheet";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuth } from "@/context/AuthContext";
import { projectIdFromPath, useProject } from "@/context/ProjectContext";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import { projectSwitchPath } from "@/lib/projects/project-switch-path";
import { can, canCreateProject } from "@/lib/auth/permissions";
import { type Locale } from "@/i18n/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { userContact, userDisplayName, userInitial } from "@/lib/auth/user-display";

// Page meta keys reference message keys in `topbar.*` (title/subtitle) and
// `projects/planning/labor/invoices.newProject|newTask|logDay|newInvoice` for actions.
type PageKey = "dashboard" | "projects" | "settings" | "planning" | "labor" | "invoices" | "notes" | "members" | "documents" | "analyses" | "billing";

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
  analyses: {
    // Reuse the analyses namespace so the topbar and page share one source of
    // truth (same convention as documents above).
    titleKey: "analyses.title",
    subtitleKey: "analyses.subtitle",
    // No topbar action — Upload analysis lives inline in the analyses panel.
  },
  billing: {
    // /projects/[id]/billing — the project's quotes & invoices, read-only;
    // new documents are created from the Billing section.
    titleKey: "billing.project.title",
    subtitleKey: "billing.project.subtitle",
  },
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const tCommon = useTranslations("common");
  const tTopbar = useTranslations();
  const { user, logout, isLoading } = useAuth();
  const { projects, selectedProjectId, selectedProject, selectProject } = useProject();
  const tProjects = useTranslations("projects");

  const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), "") || "/";

  // Resolve page key from path. Routes that render their own in-page header
  // (billing/*, settings sub-pages, persons-*, invoice detail/new) intentionally
  // stay null so the topbar suppresses its title block instead of falling back
  // to a misleading "Overview" default.
  let pageKey: PageKey | null = null;
  if (pathWithoutLocale === "/" || pathWithoutLocale === "/dashboard") pageKey = "dashboard";
  else if (pathWithoutLocale === "/projects") pageKey = "projects";
  else if (pathWithoutLocale === "/settings") pageKey = "settings";
  else {
    // Only the section root (/projects/<id>/invoices), not its sub-pages
    // (/invoices/new, /invoices/<id>), which render their own header.
    const projectMatch = pathWithoutLocale.match(/^\/projects\/[^/]+\/([^/]+)\/?$/);
    if (projectMatch && (projectMatch[1] in TOPBAR_KEYS)) {
      pageKey = projectMatch[1] as PageKey;
    }
  }

  // The project the page shows. On a /projects/<id>/... route that is the URL's
  // project, never a different stored selection, so the breadcrumb, the action
  // gate and the action target can only ever name the project being viewed.
  const routeProjectId = projectIdFromPath(pathWithoutLocale);
  const pageProject =
    routeProjectId && selectedProject?.id !== routeProjectId ? null : selectedProject;
  const pageProjectId = routeProjectId ?? selectedProject?.id ?? null;

  const cfg = pageKey ? TOPBAR_KEYS[pageKey] : null;
  const title = cfg ? tTopbar(cfg.titleKey) : null;
  const subtitle = cfg ? tTopbar(cfg.subtitleKey) : null;
  // "New project" is admin-only (project:create, global or any admin company);
  // "Log day" opens the manager bulk-log dialog, not the member day roster;
  // "New invoice" writes an invoice; "New task" needs only read access, as
  // the board's own "+" buttons and the API do (any member can create tasks)
  // — hide every action for a caller who lacks the matching permission so no
  // control ever renders that would 403. A project tab's action waits for the
  // URL project to load with the caller's rights on it: one the caller cannot
  // open never loads, so its 404 page offers no "New task" or "New expense".
  const canShowAction =
    pageKey === "projects"
      ? canCreateProject(user?.permissions, user?.companies)
      : pageKey === "labor"
        ? !!pageProject && can("project:manage_labor", user?.permissions, pageProject.my_permissions)
        : pageKey === "invoices"
          ? !!pageProject && can("project:manage_invoices", user?.permissions, pageProject.my_permissions)
          : pageKey === "planning"
            ? !!pageProject && can("project:read", user?.permissions, pageProject.my_permissions)
            : true;
  const actionLabel = cfg?.actionKey && canShowAction ? tTopbar(cfg.actionKey) : null;

  const projectName = pageProject ? projectDisplayName(pageProject) : undefined;
  const initials = userInitial(user);

  const handleSwitchProject = (projectId: string) => {
    selectProject(projectId);
    const switchPath = projectSwitchPath(pathWithoutLocale, projectId);
    if (switchPath) {
      router.push(`/${locale}${switchPath}`);
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
    if (!pageProjectId) return;
    if (pageKey === "planning") {
      router.push(`/${locale}/projects/${pageProjectId}/planning?new=1`);
      return;
    }
    if (pageKey === "labor") {
      router.push(`/${locale}/projects/${pageProjectId}/labor?logDay=1`);
      return;
    }
    if (pathWithoutLocale.endsWith("/invoices")) {
      router.push(`/${locale}/projects/${pageProjectId}/invoices/new`);
    }
  };

  return (
    // Below lg the page title gets a row of its own under the project switcher and the icons:
    // sharing a row with five icons left it ~93px at 375, so "Planification" read "Planific…".
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 lg:flex-nowrap lg:items-start lg:gap-6 lg:px-8 lg:pb-4 lg:pt-6">
      {title && (
        <div className="order-last min-w-0 basis-full lg:order-none lg:flex-1 lg:basis-auto">
          <div
            className="mb-1 hidden items-center gap-2 text-[12px] lg:flex"
            style={{ color: "var(--muted)" }}
          >
            {/* A long project name truncates (the project switcher shows it in full);
                the page title never splits ("Main- / d'œuvre"). */}
            {projectName && (
              <>
                <span className="min-w-0 truncate">{projectName}</span>
                <span className="shrink-0" style={{ color: "var(--line-2)" }}>›</span>
              </>
            )}
            <span className="shrink-0 whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
              {title}
            </span>
          </div>
          {/* One line: a wrapped "Main-/d'œuvre" pushed the page down. */}
          <h1
            className="font-display truncate text-xl font-medium leading-[1.05] tracking-tight sm:text-2xl lg:text-[34px]"
            title={title ?? undefined}
          >
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
        </div>
      )}
      {projects.length > 0 && (
        // Shares the icons' row while it keeps 8rem; next to the "+" action that would leave the
        // project name a few letters ("789 C…"), so it takes a row of its own there instead.
        <div className="min-w-[8rem] flex-1 lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex max-w-full items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-semibold shadow-sm"
                style={{ background: "var(--surface-2)", color: "var(--ink)", borderColor: "var(--line)" }}
              >
                <span
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  {(projectName ?? "P").charAt(0).toUpperCase()}
                </span>
                <span
                  className="line-clamp-2 min-w-0 max-w-[220px] text-left leading-snug"
                  title={projectName ?? undefined}
                >
                  {projectName ?? tProjects("selectProject")}
                </span>
                <ChevronDown size={14} className="flex-shrink-0" style={{ color: "var(--muted)" }} />
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
                    {projectDisplayName(p).charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{projectDisplayName(p)}</span>
                  {p.id === selectedProjectId && (
                    <Check size={14} className="flex-shrink-0" style={{ color: "var(--accent)" }} />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="ml-auto flex flex-shrink-0 items-center gap-1 lg:gap-2">
        <HelpSheet />
        <NotificationsBell />
        <LanguageSwitcher />

        <div className="mx-1 hidden h-6 w-px lg:block" style={{ background: "var(--line-2)" }} />

        {actionLabel && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAction}
            aria-label={actionLabel}
          >
            <Plus size={14} /> <span className="hidden lg:inline">{actionLabel}</span>
          </button>
        )}

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="avatar ml-1"
                title={userDisplayName(user)}
                style={{ background: "var(--accent)", color: "white", cursor: "pointer" }}
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-[12px]" style={{ color: "var(--muted)" }}>
                {userContact(user) || userDisplayName(user)}
              </div>
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
