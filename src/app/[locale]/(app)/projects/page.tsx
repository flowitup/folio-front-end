"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import { projectDisplayName, projectMatchesSearch } from "@/lib/projects/project-display-name";
import { useAuth } from "@/context/AuthContext";
import {
  Plus,
  Building2,
  Loader2,
  MoreHorizontal,
  Search,
  ArrowRight,
  UserPlus,
  Trash2,
  Pencil,
  Images,
  ChevronDown,
  Clock,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchProjectUsers } from "@/lib/api/projects";
import { removeMemberAction } from "@/app/[locale]/(app)/projects/[id]/members/actions";
import { can, canCreateProject, isCompanyAdmin } from "@/lib/auth/permissions";
import { ProjectCoverPhotos } from "@/components/project/project-cover-photos";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";
import { EditProjectDialog } from "@/components/project/edit-project-dialog";
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog";
import type { Project, ProjectUser } from "@/types/project";
import { fmtEUR, computeBudgetMeta, personalSpendRows } from "@/lib/projects/budget-display";
import { userContact, userInitial } from "@/lib/auth/user-display";
import { toast } from "sonner";

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #d8b896 0%, #b8845f 60%, #8a5836 100%)",
  "linear-gradient(135deg, #e8d5b7 0%, #c9a878 60%, #8d6f4a 100%)",
  "linear-gradient(135deg, #cfd9c5 0%, #9aa988 60%, #5a6b4a 100%)",
  "linear-gradient(135deg, #e7d2c4 0%, #b89485 60%, #714c3e 100%)",
];

const AVATAR_TONES = ["#1a1a1a", "#5a7a4a", "#c9a961", "#e8843c", "#8a8479", "#b3543d"];

/**
 * Grid placement of the n-th figure on a card's money grid. Labels and figures
 * are direct grid items: the labels share a row and the figures the next one,
 * so a label that wraps further in one locale (fr "Dépensé sur crédit") never
 * moves its figure out of line. While the grid is two columns wide, the third
 * and fourth figures take rows 3-4. Literal class names, so Tailwind emits them.
 */
const MONEY_CELL_ROWS = [
  { label: "row-start-1", value: "row-start-2" },
  { label: "row-start-1", value: "row-start-2" },
  { label: "row-start-3 mt-3.5 @lg:row-start-1 @lg:mt-0", value: "row-start-4 @lg:row-start-2" },
  { label: "row-start-3 mt-3.5 @lg:row-start-1 @lg:mt-0", value: "row-start-4 @lg:row-start-2" },
];

function coverFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}


export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tMembers = useTranslations("members");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { projects, isLoading, error, selectedProjectId, selectProject, refetch } =
    useProject();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  // Which card has its personal-spend breakdown open. Collapsed by default so the
  // four-column row stays scannable on a long list.
  const [openBreakdownId, setOpenBreakdownId] = useState<string | null>(null);
  const [projectUsers, setProjectUsers] = useState<Record<string, ProjectUser[]>>({});
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null);
  const [removeMember, setRemoveMember] = useState<{
    projectId: string;
    userId: string;
    email: string;
  } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProjectState, setDeleteProjectState] = useState<Project | null>(null);

  // No owner_id bypass (D6, removed) — edit/delete are gated on the project's
  // resolver-computed my_permissions (admin implicit rights, assigned
  // manager role, or a D8 grant already folded in by the backend).
  const canEditProject = (project: Project) =>
    can("project:update", user?.permissions, project.my_permissions);
  // project:delete is admin-only (never granted to manager/member, D2/D8) —
  // matches the matrix, so gating on my_permissions alone is correct here.
  const canDeleteProject = (project: Project) =>
    can("project:delete", user?.permissions, project.my_permissions);

  const canCreate = canCreateProject(user?.permissions, user?.companies);
  // No company at all (e.g. they just left their only one): nobody can assign
  // them, so point to onboarding rather than "waiting to be assigned".
  const hasNoCompany = !canCreate && Array.isArray(user?.companies) && user.companies.length === 0;

  // Open dialog when external triggers (Topbar/Sidebar) navigate with ?new=1 —
  // only for someone who may create a project (the API refuses anyone else).
  // Waits for the user to load so an admin's rights are known first.
  useEffect(() => {
    if (!user || searchParams.get("new") !== "1") return;
    if (canCreate) setShowCreateDialog(true);
    router.replace(pathname);
  }, [user, canCreate, searchParams, router, pathname]);

  const handleProjectCreated = async (project: Project) => {
    await refetch();
    selectProject(project.id);
    toast.success(t("projectCreated"));
    // The new project lands at the end of a possibly long list: bring it in view.
    requestAnimationFrame(() =>
      document.getElementById(`project-${project.id}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" })
    );
  };

  const handleProjectDeleted = async () => {
    await refetch();
    toast.success(t("projectDeleted"));
  };

  const handleProjectUpdated = async () => {
    await refetch();
    toast.success(t("projectUpdated"));
  };

  const canManageUsers = (project: Project) =>
    can("project:manage_users", user?.permissions, project.my_permissions);
  // Same rule as the API (DELETE /assignments) and the members page: a company
  // admin may remove anyone, a manager only a company `member`, nobody themselves.
  const canRemoveFromTeam = (project: Project, member: ProjectUser) =>
    member.id !== user?.id &&
    (isCompanyAdmin(user?.companies, project.company_id ?? null, user?.permissions) ||
      member.role_name === "member");
  // Adding people happens on the project's members page, which holds both
  // flows: e-mail invitation (project:invite) and assigning an existing company
  // member (project:update, PUT /assignments — company-scoped search).
  const canAddMembers = (project: Project) =>
    can("project:invite", user?.permissions, project.my_permissions) ||
    can("project:update", user?.permissions, project.my_permissions);

  const adminCompanies = (user?.companies ?? []).filter((c) => c.role === "admin");

  const filteredProjects = projects.filter((p) => {
    if (!projectMatchesSearch(p, search)) return false;
    return true;
  });

  const toggleExpand = async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }
    setExpandedProjectId(projectId);
    await loadProjectUsers(projectId);
  };

  const loadProjectUsers = async (projectId: string) => {
    if (projectUsers[projectId]) return;
    setLoadingUsers(projectId);
    try {
      const response = await fetchProjectUsers(projectId);
      setProjectUsers((prev) => ({ ...prev, [projectId]: response.users }));
    } catch {
      setProjectUsers((prev) => ({ ...prev, [projectId]: [] }));
    } finally {
      setLoadingUsers(null);
    }
  };

  const handleRemoveUser = async () => {
    if (!removeMember) return;
    try {
      const result = await removeMemberAction(removeMember.projectId, removeMember.userId);
      if (!result.ok) {
        toast.error(
          result.status === 403
            ? tMembers("edit.toast.forbidden")
            : tMembers("edit.toast.removeFailed")
        );
        return;
      }
      setProjectUsers((prev) => {

        const { [removeMember.projectId]: _, ...rest } = prev;
        return rest;
      });
      await loadProjectUsers(removeMember.projectId);
      refetch();
    } catch {
      toast.error(tMembers("edit.toast.removeFailed"));
    } finally {
      setRemoveMember(null);
    }
  };

  const openProject = (projectId: string) => {
    selectProject(projectId);
    router.push(`/${locale}/dashboard`);
  };

  const openProjectMembers = (projectId: string) => {
    selectProject(projectId);
    router.push(`/${locale}/projects/${projectId}/members`);
  };

  // Open the project's photo gallery (all images + its own upload control).
  const openProjectPhotos = (projectId: string) => {
    selectProject(projectId);
    router.push(`/${locale}/projects/${projectId}/photos`);
  };

  return (
    <div className="fade-up px-4 pb-12 lg:px-8">
      {/* Filter row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* No project status exists yet, so there is nothing to filter by:
            an "Active" tab listed the same projects as "All". */}
        <div className="text-[12.5px] font-medium" style={{ color: "var(--ink-2)" }} data-testid="projects-count">
          {t("allProjects")} ·{" "}
          {/* While a search hides some, say how many of them are shown. */}
          <span className="num">
            {filteredProjects.length === projects.length
              ? projects.length
              : `${filteredProjects.length} / ${projects.length}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }}
            />
            <input
              className="folio-input num w-full sm:w-60"
              placeholder={t("searchProjects")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30 }}
            />
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="folio-card flex items-center justify-center p-12">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive" data-testid="projects-load-error">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("loadError")}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && filteredProjects.length > 0 && (
        <div className="grid grid-cols-12 items-start gap-5">
          {filteredProjects.map((project, idx) => {
            const isFeatured = idx === 0;
            const isExpanded = expandedProjectId === project.id;
            const canEdit = canEditProject(project);
            const canDelete = canDeleteProject(project);
            const canManageThisProjectUsers = canManageUsers(project);
            const users = projectUsers[project.id] || [];
            const isLoadingThisProject = loadingUsers === project.id;
            const cover = (project as { cover?: string }).cover ?? coverFor(project.id);
            const {
              creditTotal,
              spentByCredits,
              spentPersonal,
              remaining,
              isOverBudget,
              progress,
            } = computeBudgetMeta(
              project.budget ?? 0,
              project.spent_personal ?? 0,
              project.spent_by_credits ?? 0,
            );
            // Financing side of this project: the backend nulls `budget` without
            // `project:view_budget`, so the credit/remaining columns and the
            // drawdown bar are hidden rather than shown as "—" and a flat 0%.
            const canViewBudget = can(
              "project:view_budget",
              user?.permissions,
              project.my_permissions
            );
            // The backend zeroes spend for anyone without labor or pay rights
            // (_spend_visible); shown, those zeros read as "nothing spent".
            const canViewSpend =
              can("project:manage_labor", user?.permissions, project.my_permissions) ||
              can("project:view_pay", user?.permissions, project.my_permissions);
            const moneyColumns = (canViewBudget ? 2 : 0) + (canViewSpend ? 2 : 0);
            // Grid rows of each shown figure (see MONEY_CELL_ROWS), by its position.
            const creditCell = MONEY_CELL_ROWS[0];
            const byCreditsCell = MONEY_CELL_ROWS[canViewBudget ? 1 : 0];
            const personalCell = MONEY_CELL_ROWS[canViewBudget ? 2 : 1];
            const remainingCell = MONEY_CELL_ROWS[canViewSpend ? 3 : 1];
            const breakdownRows = personalSpendRows(project.personal_by_type);
            const laborUnpaid = project.labor_unpaid ?? 0;
            const hasBreakdown = breakdownRows.length > 0 || laborUnpaid > 0;
            const isBreakdownOpen = openBreakdownId === project.id;
            const isSelected = selectedProjectId === project.id;
            const userCount = project.user_count ?? 0;

            return (
              <article
                key={project.id}
                id={`project-${project.id}`}
                className={`folio-card overflow-hidden ${
                  isFeatured ? "col-span-12" : "col-span-12 md:col-span-6"
                }`}
              >
                <div
                  className={`grid grid-cols-1 ${
                    isFeatured
                      ? "sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]"
                      : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
                  }`}
                >
                  {/* Cover */}
                  <button
                    type="button"
                    onClick={() => openProject(project.id)}
                    className="relative cursor-pointer text-left"
                    style={{ background: cover, minHeight: isFeatured ? 280 : 220 }}
                  >
                    <div className="blueprint-grid absolute inset-0 opacity-25" />
                    <div className="paper-noise absolute inset-0" />
                    {/* Latest photos montage; renders nothing when the project has none. */}
                    <ProjectCoverPhotos projectId={project.id} />
                    <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                      <span
                        className="stamp"
                        style={{ background: "rgba(255,255,255,0.85)", borderColor: "transparent" }}
                      >
                        <Building2 size={11} /> {t("projectStamp")}
                      </span>
                      {isSelected && <span className="stamp accent">{t("selected")}</span>}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <div className="num mb-1 text-[10px] uppercase tracking-[0.2em] opacity-80">
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                    </div>
                  </button>

                  {/* Body */}
                  {/* minmax(0,…) tracks + overflow-wrap: an unbroken address as
                      the title used to widen the body and squeeze the cover to 0. */}
                  <div className="flex min-w-0 flex-col p-6">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3
                          className="font-display text-[26px] font-medium leading-tight tracking-tight [overflow-wrap:anywhere]"
                          data-testid="project-card-title"
                        >
                          {projectDisplayName(project)}
                        </h3>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="btn btn-quiet"
                            aria-label={t("projectActionsLabel")}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {canEdit && (
                            <DropdownMenuItem onSelect={() => setEditProject(project)}>
                              <Pencil size={14} /> {t("editProject")}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleteProjectState(project)}
                            >
                              <Trash2 size={14} /> {t("deleteProject")}
                            </DropdownMenuItem>
                          )}
                          {(canEdit || canDelete) && <DropdownMenuSeparator />}
                          <DropdownMenuItem onSelect={() => toggleExpand(project.id)}>
                            {expandedProjectId === project.id ? t("hideTeam") : t("showTeam")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Progress — drawdown of the credit, so budget-gated. */}
                    {canViewBudget && (
                      <div className="mb-4">
                        <div className="mb-1.5 flex items-center justify-between text-[12px]">
                          <span style={{ color: "var(--muted)" }}>{t("progress")}</span>
                          <span className="num font-medium">{Math.round(progress * 100)}%</span>
                        </div>
                        <div className="progress-track">
                          <div
                            className={`progress-fill ${isOverBudget ? "" : "accent"}`}
                            style={{
                              width: `${progress * 100}%`,
                              ...(isOverBudget && { background: "var(--negative)" }),
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="hairline @container mt-auto border-t pt-4">
                      {/* Credit total / Spent by credit / Spent personal / Remaining.
                          Four columns only when the card itself is wide enough for
                          "125 000,75 €" in each (a half-width card on a laptop left
                          ~50-80px per figure), else two, so the figures stay readable
                          and never run into the next column. */}
                      {moneyColumns > 0 && (
                        <div
                          className={`mb-3 grid grid-cols-2 items-start gap-x-4 gap-y-0.5 ${
                            moneyColumns === 4 ? "@lg:grid-cols-4" : ""
                          }`}
                          data-testid="project-money-grid"
                        >
                          {/* Labels and figures sit straight on the grid (MONEY_CELL_ROWS):
                              every figure starts on the same line whatever its label's
                              length, and wraps rather than overflowing into the next one. */}
                          {canViewBudget && (
                            <>
                              <div className={`label-cap min-w-0 ${creditCell.label}`}>{t("creditTotal")}</div>
                              <div
                                className={`font-display num min-w-0 text-[15px] [overflow-wrap:anywhere] ${creditCell.value}`}
                              >
                                {creditTotal ? fmtEUR(creditTotal) : "—"}
                              </div>
                            </>
                          )}
                          {canViewSpend && (
                            <>
                              <div className={`label-cap min-w-0 ${byCreditsCell.label}`}>{t("spentByCredits")}</div>
                              <div
                                className={`font-display num min-w-0 text-[15px] [overflow-wrap:anywhere] ${byCreditsCell.value}`}
                              >
                                {spentByCredits ? fmtEUR(spentByCredits) : "—"}
                              </div>
                              <div className={`label-cap min-w-0 ${personalCell.label}`}>{t("spentPersonal")}</div>
                              {hasBreakdown ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenBreakdownId(isBreakdownOpen ? null : project.id)
                                  }
                                  aria-expanded={isBreakdownOpen}
                                  aria-controls={`breakdown-${project.id}`}
                                  className={`font-display num min-w-0 text-left text-[15px] [overflow-wrap:anywhere] hover:underline ${personalCell.value}`}
                                >
                                  {spentPersonal ? fmtEUR(spentPersonal) : "—"}
                                  {/* Inline, so it drops under the figure when the column is narrow. */}
                                  <ChevronDown
                                    size={13}
                                    className="ml-1 inline-block align-middle"
                                    style={{
                                      color: "var(--muted)",
                                      transform: isBreakdownOpen ? "rotate(180deg)" : undefined,
                                    }}
                                  />
                                </button>
                              ) : (
                                <div
                                  className={`font-display num min-w-0 text-[15px] [overflow-wrap:anywhere] ${personalCell.value}`}
                                >
                                  {spentPersonal ? fmtEUR(spentPersonal) : "—"}
                                </div>
                              )}
                            </>
                          )}
                          {canViewBudget && (
                            <>
                              <div className={`label-cap min-w-0 ${remainingCell.label}`}>{t("remaining")}</div>
                              <div
                                className={`font-display num min-w-0 text-[15px] [overflow-wrap:anywhere] ${remainingCell.value}`}
                                style={isOverBudget ? { color: "var(--negative)" } : undefined}
                              >
                                {creditTotal
                                  ? isOverBudget
                                    ? `${t("overBudget")} ${fmtEUR(Math.abs(remaining))}`
                                    : fmtEUR(remaining)
                                  : "—"}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Personal spend breakdown — collapsed by default. Unpaid labor is
                          separated by a rule because it is owed, not spent, and is deliberately
                          NOT part of the personal total above. */}
                      {canViewSpend && hasBreakdown && isBreakdownOpen && (
                        <div
                          id={`breakdown-${project.id}`}
                          className="hairline mb-3 rounded-md border p-3"
                          style={{ background: "var(--surface-2, rgba(0,0,0,.02))" }}
                        >
                          <div className="label-cap mb-2">{t("breakdownTitle")}</div>
                          {breakdownRows.map((row) => (
                            <div
                              key={row.type}
                              className="flex items-baseline justify-between gap-3 py-0.5 text-[13px]"
                            >
                              <span style={{ color: "var(--muted)" }}>
                                {row.type === "labor" ? t("laborPaid") : t(`type.${row.type}`)}
                              </span>
                              <span className="num">{fmtEUR(row.amount)}</span>
                            </div>
                          ))}
                          {laborUnpaid > 0 && (
                            <div className="hairline mt-2 border-t pt-2">
                              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                                <span style={{ color: "var(--muted)" }}>{t("laborUnpaid")}</span>
                                <span className="num" style={{ color: "var(--negative)" }}>
                                  {fmtEUR(laborUnpaid)}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                                {t("laborUnpaidHint")}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Team */}
                      <div>
                        <div className="label-cap">{t("team")}</div>
                        {/* The list carries a head count, not the people: say how
                            many rather than draw blank avatars. */}
                        <div className="mt-1 text-[12.5px]" data-testid="project-team-size">
                          {userCount > 0 ? (
                            <span className="num">{t("teamSize", { n: userCount })}</span>
                          ) : (
                            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                              {t("noneTeam")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary mt-4 w-full"
                          onClick={() => openProject(project.id)}
                        >
                          {t("openDashboard")} <ArrowRight size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost mt-2 w-full"
                          onClick={() => openProjectPhotos(project.id)}
                        >
                          <Images size={14} /> {t("photos")}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded team */}
                {isExpanded && (
                  <div
                    className="border-t p-5 fade-up"
                    style={{ background: "var(--paper-2)", borderColor: "var(--line)" }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="label-cap">{t("teamMembers")}</div>
                      {canAddMembers(project) && (
                        <button
                          type="button"
                          onClick={() => openProjectMembers(project.id)}
                          className="btn btn-ghost"
                          style={{ padding: "5px 10px", fontSize: 12 }}
                        >
                          <UserPlus size={12} /> {t("invite")}
                        </button>
                      )}
                    </div>
                    {isLoadingThisProject ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2
                          size={14}
                          className="animate-spin"
                          style={{ color: "var(--muted)" }}
                        />
                      </div>
                    ) : users.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {users.map((member, i) => (
                          <div key={member.id} className="flex items-center gap-2.5">
                            <div
                              className="avatar"
                              style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }}
                            >
                              {userInitial(member)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium">
                                {userContact(member)}
                              </div>
                              {member.role_name && (
                                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                                  {tMembers(`roles.${member.role_name}`)}
                                </div>
                              )}
                            </div>
                            {canManageThisProjectUsers && canRemoveFromTeam(project, member) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRemoveMember({
                                    projectId: project.id,
                                    userId: member.id,
                                    email: userContact(member),
                                  })
                                }
                                className="btn btn-quiet shrink-0"
                                aria-label={tMembers("edit.removeAria", { name: userContact(member) })}
                              >
                                <Trash2 size={14} style={{ color: "var(--negative)" }} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                        {t("noMembers")}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* A search that matches nothing: say so, with a way back to the full list. */}
      {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 && (
        <div
          className="folio-card flex flex-col items-center justify-center py-16 text-center"
          data-testid="projects-no-search-results"
        >
          <div className="mb-4 rounded-xl p-4" style={{ background: "var(--paper-2)" }}>
            <Search size={36} style={{ color: "var(--muted)" }} />
          </div>
          <h3 className="font-display max-w-full text-[20px] font-medium tracking-tight [overflow-wrap:anywhere]">
            {t("noSearchResults.title", { query: search.trim() })}
          </h3>
          <button type="button" className="btn btn-ghost mt-4" onClick={() => setSearch("")}>
            {t("noSearchResults.clear")}
          </button>
        </div>
      )}

      {/* Empty state: two personas. A company admin (or legacy global
          project:create holder) sees the "create your first project" CTA.
          A manager/member with no assigned project sees a passive waiting
          state instead — there is no control they could use here that
          wouldn't 403 on the backend. */}
      {!isLoading && !error && projects.length === 0 && canCreate && (
        <div className="folio-card flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-xl p-4" style={{ background: "var(--paper-2)" }}>
            <Building2 size={36} style={{ color: "var(--muted)" }} />
          </div>
          <h3 className="font-display text-[20px] font-medium tracking-tight">
            {t("noProjectsYet")}
          </h3>
          <p className="mt-1 max-w-sm text-[13px]" style={{ color: "var(--muted)" }}>
            {t("getStarted")}
          </p>
          <button
            type="button"
            className="btn btn-primary mt-4"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus size={14} />
            {t("createFirst")}
          </button>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && hasNoCompany && (
        <div className="folio-card flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-xl p-4" style={{ background: "var(--paper-2)" }}>
            <Building2 size={36} style={{ color: "var(--muted)" }} />
          </div>
          <h3 className="font-display text-[20px] font-medium tracking-tight">
            {t("noCompany.title")}
          </h3>
          <p className="mt-1 max-w-sm text-[13px]" style={{ color: "var(--muted)" }}>
            {t("noCompany.description")}
          </p>
          <Link href={`/${locale}/onboarding`} className="btn btn-primary mt-4">
            {t("noCompany.cta")}
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && !canCreate && !hasNoCompany && (
        <div className="folio-card flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-xl p-4" style={{ background: "var(--paper-2)" }}>
            <Clock size={36} style={{ color: "var(--muted)" }} />
          </div>
          <h3 className="font-display text-[20px] font-medium tracking-tight">
            {t("waitingForAssignment.title")}
          </h3>
          <p className="mt-1 max-w-sm text-[13px]" style={{ color: "var(--muted)" }}>
            {t("waitingForAssignment.description")}
          </p>
        </div>
      )}

      <CreateProjectDialog
        open={showCreateDialog && canCreate}
        onOpenChange={setShowCreateDialog}
        onCreated={handleProjectCreated}
        adminCompanies={adminCompanies}
      />

      <EditProjectDialog
        project={editProject}
        open={!!editProject}
        onOpenChange={(o) => !o && setEditProject(null)}
        onUpdated={handleProjectUpdated}
      />

      <DeleteProjectDialog
        project={deleteProjectState}
        open={!!deleteProjectState}
        onOpenChange={(o) => !o && setDeleteProjectState(null)}
        // ProjectContext.loadProjects auto-clears selectedProjectId when the
        // previously-selected id is no longer in the list, so we just refetch.
        onDeleted={handleProjectDeleted}
      />

      <AlertDialog open={!!removeMember} onOpenChange={(open) => !open && setRemoveMember(null)}>
        <AlertDialogContent className="max-w-sm sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-2">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--negative-tint)" }}
            >
              <Trash2 size={20} style={{ color: "var(--negative)" }} />
            </div>
            <div className="space-y-1 text-center">
              <AlertDialogTitle className="font-display text-center">
                {t("removeMemberTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription style={{ color: "var(--muted)" }}>
                {removeMember?.email}
              </AlertDialogDescription>
            </div>
          </div>
          <AlertDialogFooter className="gap-2 sm:justify-center">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              style={{ background: "var(--negative)", color: "white" }}
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
