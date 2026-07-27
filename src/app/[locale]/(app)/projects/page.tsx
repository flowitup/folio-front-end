"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
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
import { fetchProjectUsers, removeUserFromProject } from "@/lib/api/projects";
import { AddMemberDialog } from "@/components/project/add-member-dialog";
import { ProjectCoverPhotos } from "@/components/project/project-cover-photos";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";
import { EditProjectDialog } from "@/components/project/edit-project-dialog";
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog";
import type { Project, ProjectUser } from "@/types/project";
import { fmtEUR, computeBudgetMeta, personalSpendRows } from "@/lib/projects/budget-display";

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #d8b896 0%, #b8845f 60%, #8a5836 100%)",
  "linear-gradient(135deg, #e8d5b7 0%, #c9a878 60%, #8d6f4a 100%)",
  "linear-gradient(135deg, #cfd9c5 0%, #9aa988 60%, #5a6b4a 100%)",
  "linear-gradient(135deg, #e7d2c4 0%, #b89485 60%, #714c3e 100%)",
];

const AVATAR_TONES = ["#1a1a1a", "#5a7a4a", "#c9a961", "#e8843c", "#8a8479", "#b3543d"];

function coverFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}

type FilterTab = "all" | "active";

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { projects, isLoading, error, selectedProjectId, selectProject, refetch } =
    useProject();
  const { user } = useAuth();
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  // Which card has its personal-spend breakdown open. Collapsed by default so the
  // four-column row stays scannable on a long list.
  const [openBreakdownId, setOpenBreakdownId] = useState<string | null>(null);
  const [projectUsers, setProjectUsers] = useState<Record<string, ProjectUser[]>>({});
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null);
  const [addMemberProject, setAddMemberProject] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [removeMember, setRemoveMember] = useState<{
    projectId: string;
    userId: string;
    email: string;
  } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProjectState, setDeleteProjectState] = useState<Project | null>(null);

  // Mirror BE rule in app/api/v1/projects/decorators.py::can_mutate_project:
  //   admin (project:create) OR owner. Wildcards expand via the BE's
  //   _has_permission helper; we mirror them here for the same UX gating.
  const canMutateProject = (project: Project) =>
    !!user &&
    (project.owner_id === user.id ||
      user.permissions.includes("project:create") ||
      user.permissions.includes("project:*") ||
      user.permissions.includes("*:*"));

  // Open dialog when external triggers (Topbar/Sidebar) navigate with ?new=1.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreateDialog(true);
      router.replace(pathname);
    }
  }, [searchParams, router, pathname]);

  const handleProjectCreated = async (project: Project) => {
    await refetch();
    selectProject(project.id);
  };

  const canManageUsers =
    user?.permissions?.some((p) => p === "project:manage_users" || p === "*:*" || p === "project:*") ??
    false;

  const filteredProjects = projects.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
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

  const handleMemberAdded = async () => {
    if (addMemberProject) {
      setProjectUsers((prev) => {

        const { [addMemberProject.id]: _, ...rest } = prev;
        return rest;
      });
      await loadProjectUsers(addMemberProject.id);
      refetch();
    }
  };

  const handleRemoveUser = async () => {
    if (!removeMember) return;
    try {
      await removeUserFromProject(removeMember.projectId, removeMember.userId);
      setProjectUsers((prev) => {

        const { [removeMember.projectId]: _, ...rest } = prev;
        return rest;
      });
      await loadProjectUsers(removeMember.projectId);
      refetch();
    } catch (err) {
      console.error(
        "Failed to remove user:",
        err instanceof Error ? err.message : "unknown"
      );
    } finally {
      setRemoveMember(null);
    }
  };

  const openProject = (projectId: string) => {
    selectProject(projectId);
    router.push(`/${locale}/dashboard`);
  };

  // Open the project's photo gallery (all images + its own upload control).
  const openProjectPhotos = (projectId: string) => {
    selectProject(projectId);
    router.push(`/${locale}/projects/${projectId}/photos`);
  };

  const counts = {
    all: projects.length,
    active: projects.length,
  };

  return (
    <div className="fade-up px-4 pb-12 lg:px-8">
      {/* Filter row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="seg">
          {(["all", "active"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={filterTab === tab ? "on" : ""}
            >
              {tab === "all" ? t("allProjects") : t("active")} ·{" "}
              <span className="num">{counts[tab]}</span>
            </button>
          ))}
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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && filteredProjects.length > 0 && (
        <div className="grid grid-cols-12 items-start gap-5">
          {filteredProjects.map((project, idx) => {
            const isFeatured = idx === 0;
            const isExpanded = expandedProjectId === project.id;
            const canMutate = canMutateProject(project);
            const users = projectUsers[project.id] || [];
            const isLoadingThisProject = loadingUsers === project.id;
            const cover = (project as { cover?: string }).cover ?? coverFor(project.id);
            const phase = (project as { phase?: string }).phase ?? "Planning";
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
            const breakdownRows = personalSpendRows(project.personal_by_type);
            const laborUnpaid = project.labor_unpaid ?? 0;
            const hasBreakdown = breakdownRows.length > 0 || laborUnpaid > 0;
            const isBreakdownOpen = openBreakdownId === project.id;
            const isSelected = selectedProjectId === project.id;
            const userCount = project.user_count ?? 0;
            const visibleAvatars = Math.min(userCount, 4);

            return (
              <article
                key={project.id}
                className={`folio-card overflow-hidden ${
                  isFeatured ? "col-span-12" : "col-span-12 md:col-span-6"
                }`}
              >
                <div
                  className={`grid grid-cols-1 ${
                    isFeatured
                      ? "sm:grid-cols-[1.2fr_2fr]"
                      : "sm:grid-cols-[1fr_1.4fr]"
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
                        0{idx + 1}
                      </div>
                      <div className="font-display text-[22px] leading-tight">{phase}</div>
                    </div>
                  </button>

                  {/* Body */}
                  <div className="flex flex-col p-6">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-[26px] font-medium leading-tight tracking-tight">
                          {project.name}
                        </h3>
                        {project.address && (
                          <p
                            className="mt-0.5 truncate text-[13px]"
                            style={{ color: "var(--muted)" }}
                          >
                            {project.address}
                          </p>
                        )}
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
                          {canMutate && (
                            <DropdownMenuItem onSelect={() => setEditProject(project)}>
                              <Pencil size={14} /> {t("editProject")}
                            </DropdownMenuItem>
                          )}
                          {canMutate && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleteProjectState(project)}
                            >
                              <Trash2 size={14} /> {t("deleteProject")}
                            </DropdownMenuItem>
                          )}
                          {canMutate && <DropdownMenuSeparator />}
                          <DropdownMenuItem onSelect={() => toggleExpand(project.id)}>
                            {expandedProjectId === project.id ? t("hideTeam") : t("showTeam")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Progress */}
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

                    {/* Meta row */}
                    <div className="hairline mt-auto border-t pt-4">
                      {/* Credit total / Spent by credit / Spent personal / Remaining.
                          Two columns on narrow screens so the figures stay readable. */}
                      <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                          {/* min-h reserves two label lines so a label that wraps in one
                              locale (fr "Dépensé sur crédit") does not push its figure
                              out of line with the other three. */}
                          <div className="label-cap min-h-[3em]">{t("creditTotal")}</div>
                          <div className="font-display num mt-0.5 text-[15px]">
                            {creditTotal ? fmtEUR(creditTotal) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="label-cap min-h-[3em]">{t("spentByCredits")}</div>
                          <div className="font-display num mt-0.5 text-[15px]">
                            {spentByCredits ? fmtEUR(spentByCredits) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="label-cap min-h-[3em]">{t("spentPersonal")}</div>
                          {hasBreakdown ? (
                            <button
                              type="button"
                              onClick={() =>
                                setOpenBreakdownId(isBreakdownOpen ? null : project.id)
                              }
                              aria-expanded={isBreakdownOpen}
                              aria-controls={`breakdown-${project.id}`}
                              className="font-display num mt-0.5 flex items-center gap-1 text-[15px] hover:underline"
                            >
                              {spentPersonal ? fmtEUR(spentPersonal) : "—"}
                              <ChevronDown
                                size={13}
                                style={{
                                  color: "var(--muted)",
                                  transform: isBreakdownOpen ? "rotate(180deg)" : undefined,
                                }}
                              />
                            </button>
                          ) : (
                            <div className="font-display num mt-0.5 text-[15px]">
                              {spentPersonal ? fmtEUR(spentPersonal) : "—"}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="label-cap min-h-[3em]">{t("remaining")}</div>
                          <div
                            className="font-display num mt-0.5 text-[15px]"
                            style={isOverBudget ? { color: "var(--negative)" } : undefined}
                          >
                            {creditTotal
                              ? isOverBudget
                                ? `${t("overBudget")} ${fmtEUR(Math.abs(remaining))}`
                                : fmtEUR(remaining)
                              : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Personal spend breakdown — collapsed by default. Unpaid labor is
                          separated by a rule because it is owed, not spent, and is deliberately
                          NOT part of the personal total above. */}
                      {hasBreakdown && isBreakdownOpen && (
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
                        <div className="mt-1 flex -space-x-1.5">
                          {Array.from({ length: visibleAvatars }).map((_, i) => (
                            <div
                              key={i}
                              className="avatar"
                              style={{
                                background: AVATAR_TONES[i % AVATAR_TONES.length],
                                width: 24,
                                height: 24,
                                fontSize: 10,
                                border: "2px solid white",
                              }}
                            >
                              ·
                            </div>
                          ))}
                          {userCount > 4 && (
                            <div
                              className="avatar"
                              style={{
                                background: "var(--paper-2)",
                                color: "var(--ink-2)",
                                width: 24,
                                height: 24,
                                fontSize: 10,
                                border: "2px solid white",
                              }}
                            >
                              +{userCount - 4}
                            </div>
                          )}
                          {userCount === 0 && (
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
                      {canManageUsers && (
                        <button
                          type="button"
                          onClick={() =>
                            setAddMemberProject({ id: project.id, name: project.name })
                          }
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
                              {member.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium">
                                {member.email}
                              </div>
                              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                                {t("memberRole")}
                              </div>
                            </div>
                            {canManageUsers && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRemoveMember({
                                    projectId: project.id,
                                    userId: member.id,
                                    email: member.email,
                                  })
                                }
                                className="btn btn-quiet shrink-0"
                                aria-label="Remove"
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

      {!isLoading && !error && projects.length === 0 && (
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

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleProjectCreated}
      />

      <EditProjectDialog
        project={editProject}
        open={!!editProject}
        onOpenChange={(o) => !o && setEditProject(null)}
        onUpdated={refetch}
      />

      <DeleteProjectDialog
        project={deleteProjectState}
        open={!!deleteProjectState}
        onOpenChange={(o) => !o && setDeleteProjectState(null)}
        // ProjectContext.loadProjects auto-clears selectedProjectId when the
        // previously-selected id is no longer in the list, so we just refetch.
        onDeleted={refetch}
      />

      {addMemberProject && (
        <AddMemberDialog
          projectId={addMemberProject.id}
          projectName={addMemberProject.name}
          open={!!addMemberProject}
          onOpenChange={(open) => !open && setAddMemberProject(null)}
          onMemberAdded={handleMemberAdded}
        />
      )}

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
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {removeMember?.email}
              </p>
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
