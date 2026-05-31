"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import {
  Home,
  FolderOpen,
  KanbanSquare,
  HardHat,
  Receipt,
  Settings,
  ChevronDown,
  Thermometer,
  Check,
  Plus,
  Users,
  StickyNote,
  Files,
  Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/ProjectContext";
import { FolioLogo } from "@/components/folio-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarBillingGroup } from "@/components/layout/sidebar-billing-group";

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #d8b896 0%, #b8845f 60%, #8a5836 100%)",
  "linear-gradient(135deg, #e8d5b7 0%, #c9a878 60%, #8d6f4a 100%)",
  "linear-gradient(135deg, #cfd9c5 0%, #9aa988 60%, #5a6b4a 100%)",
  "linear-gradient(135deg, #e7d2c4 0%, #b89485 60%, #714c3e 100%)",
];

function coverFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("navigation");
  const tSidebar = useTranslations("sidebar");
  const tProjects = useTranslations("projects");
  const {
    projects,
    selectedProjectId,
    selectedProject,
    selectProject,
  } = useProject();
  const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const projectNav = [
    { key: "dashboard", href: "/dashboard", icon: Home },
    { key: "projects", href: "/projects", icon: FolderOpen },
    { key: "bibliotheque", href: "/bibliotheque", icon: Library },
    ...(selectedProjectId
      ? [
          { key: "planning", href: `/projects/${selectedProjectId}/planning`, icon: KanbanSquare },
          { key: "labor", href: `/projects/${selectedProjectId}/labor`, icon: HardHat },
          { key: "invoices", href: `/projects/${selectedProjectId}/invoices`, icon: Receipt },
          { key: "members", href: `/projects/${selectedProjectId}/members`, icon: Users },
          { key: "notes", href: `/projects/${selectedProjectId}/notes`, icon: StickyNote },
          { key: "documents", href: `/projects/${selectedProjectId}/documents`, icon: Files },
        ]
      : []),
  ];

  const settingsItem = { key: "settings", href: "/settings", icon: Settings };

  const selectedCover =
    (selectedProject as { cover?: string })?.cover ??
    (selectedProject ? coverFor(selectedProject.id) : COVER_GRADIENTS[0]);
  const selectedPhase = (selectedProject as { phase?: string })?.phase ?? "";
  const selectedProgress =
    typeof (selectedProject as { progress?: number })?.progress === "number"
      ? (selectedProject as { progress?: number }).progress!
      : 0;

  // Switching the active project. If we're currently on a project-scoped
  // route (planning/labor/invoices), keep the same sub-page but swap the id —
  // otherwise just update context and stay where we are.
  const handleSwitchProject = (projectId: string) => {
    selectProject(projectId);
    const projectSubrouteMatch = pathWithoutLocale.match(/^\/projects\/[^/]+\/(.+)$/);
    if (projectSubrouteMatch) {
      router.push(`/projects/${projectId}/${projectSubrouteMatch[1]}`);
    }
  };

  return (
    <aside
      className="hidden w-[248px] border-r lg:flex lg:flex-col"
      style={{ background: "var(--paper)", borderColor: "var(--line)" }}
    >
      {/* Brand — links back to the dashboard (home) */}
      <Link
        href="/dashboard"
        aria-label="Folio — home"
        className="flex items-center gap-3 px-5 py-5 transition-opacity hover:opacity-70"
      >
        <FolioLogo />
        <div className="leading-tight">
          <div className="font-display text-[18px] font-semibold tracking-tight">Folio</div>
        </div>
      </Link>

      <div className="px-3">
        <div className="ink-divider mb-3" />
      </div>

      {/* Project switcher pill */}
      {projects.length > 0 && (
        <div className="mb-3 px-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={tProjects("selectProject")}
                className="card-paper-surface flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:border-[#c9bfa9] focus:outline-none"
                style={{ borderRadius: 12, cursor: "pointer" }}
              >
                <div
                  className="h-8 w-8 flex-shrink-0 rounded-md"
                  style={{ background: selectedCover }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {selectedProject?.name ?? tProjects("selectProject")}
                  </div>
                  {selectedProject && (selectedPhase || selectedProgress > 0) && (
                    <div className="num text-[11px]" style={{ color: "var(--muted)" }}>
                      {selectedPhase || "—"}
                      {selectedProgress > 0 ? ` · ${Math.round(selectedProgress * 100)}%` : ""}
                    </div>
                  )}
                </div>
                <ChevronDown size={14} style={{ color: "var(--muted)" }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[260px]">
              <div className="label-cap px-2 pb-1 pt-2">{tProjects("title")}</div>
              {projects.map((p) => {
                const isActive = p.id === selectedProjectId;
                const cover = (p as { cover?: string }).cover ?? coverFor(p.id);
                return (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => handleSwitchProject(p.id)}
                    className="flex items-center gap-3"
                  >
                    <div
                      className="h-7 w-7 flex-shrink-0 rounded-md"
                      style={{ background: cover }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{p.name}</div>
                      {p.address && (
                        <div
                          className="truncate text-[11px]"
                          style={{ color: "var(--muted)" }}
                        >
                          {p.address}
                        </div>
                      )}
                    </div>
                    {isActive && (
                      <Check
                        size={14}
                        className="flex-shrink-0"
                        style={{ color: "var(--accent)" }}
                      />
                    )}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/projects")}>
                <FolderOpen size={14} />
                {tProjects("title")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/projects?new=1")}>
                <Plus size={14} />
                {tProjects("newProject")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 scroll-area">
        {projectNav.map((item) => {
          const isActive =
            item.key === "projects"
              ? pathWithoutLocale === item.href ||
                /^\/projects\/[^/]+$/.test(pathWithoutLocale)
              : pathWithoutLocale === item.href ||
                pathWithoutLocale.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn("nav-link", isActive && "active")}
            >
              <span className="nav-icon flex w-5 items-center justify-center">
                <Icon size={16} />
              </span>
              <span className="font-medium">{t(item.key)}</span>
            </Link>
          );
        })}

        {/* Billing group — after project-scoped nav, before Settings */}
        <SidebarBillingGroup pathWithoutLocale={pathWithoutLocale} />

        {/* Settings — always last */}
        {(() => {
          const item = settingsItem;
          const isActive =
            pathWithoutLocale === item.href ||
            pathWithoutLocale.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn("nav-link", isActive && "active")}
            >
              <span className="nav-icon flex w-5 items-center justify-center">
                <Icon size={16} />
              </span>
              <span className="font-medium">{t(item.key)}</span>
            </Link>
          );
        })()}
      </nav>

      {/* Footer card — Today on site */}
      <div className="px-4 pb-4 pt-3">
        <div className="card-paper-surface p-3" style={{ borderRadius: 12 }}>
          <div className="mb-1.5 flex items-center gap-2">
            <Thermometer size={14} style={{ color: "var(--accent)" }} />
            <span className="label-cap">{tSidebar("todayOnSite")}</span>
          </div>
          <div className="font-display num text-[20px] leading-none">
            22°<span className="text-[12px]" style={{ color: "var(--muted)" }}> / clear</span>
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
            {tSidebar("todayLocation", { place: "Le Lavandou", workers: 4 })}
          </div>
        </div>
      </div>
    </aside>
  );
}
