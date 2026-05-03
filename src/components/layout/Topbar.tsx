"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Sun, Moon, Plus, Globe, LogOut } from "lucide-react";
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
type PageKey = "dashboard" | "projects" | "settings" | "planning" | "labor" | "invoices" | "notes" | "members";

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
  const { selectedProject } = useProject();
  const { resolvedTheme, setTheme } = useTheme();

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
    <header className="flex items-start justify-between gap-6 px-8 pb-4 pt-6">
      <div className="min-w-0 flex-1">
        <div
          className="mb-1 flex items-center gap-2 text-[12px]"
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
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-1.5 text-[13.5px]"
            style={{ color: "var(--muted)", maxWidth: 540 }}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <NotificationsBell />
        <button
          type="button"
          className="btn btn-quiet"
          aria-label={tTopbar("topbar.theme")}
          onClick={toggleTheme}
        >
          {resolvedTheme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <div className="mx-1 h-6 w-px" style={{ background: "var(--line-2)" }} />

        {actionLabel && (
          <button type="button" className="btn btn-primary" onClick={handleAction}>
            <Plus size={14} /> {actionLabel}
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
