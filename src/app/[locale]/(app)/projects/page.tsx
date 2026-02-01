"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useProject } from "@/context/ProjectContext";
import { useAuth } from "@/context/AuthContext";
import { Plus, Building2, Users, Check, Loader2, ChevronDown, ChevronUp, UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { fetchProjectUsers, removeUserFromProject } from "@/lib/api/projects";
import { AddMemberDialog } from "@/components/project/add-member-dialog";
import type { ProjectUser } from "@/types/project";

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const { projects, isLoading, error, selectedProjectId, selectProject, refetch } = useProject();
  const { user } = useAuth();
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectUsers, setProjectUsers] = useState<Record<string, ProjectUser[]>>({});
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null);
  const [addMemberProject, setAddMemberProject] = useState<{ id: string; name: string } | null>(null);
  const [removeMember, setRemoveMember] = useState<{ projectId: string; userId: string; email: string } | null>(null);

  // Check if user can manage project members (includes wildcard *:* for admins)
  const canManageUsers = user?.permissions?.some(
    (p) => p === "project:manage_users" || p === "*:*" || p === "project:*"
  ) ?? false;

  const handleProjectClick = async (projectId: string) => {
    // Toggle expansion
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }

    // Set expanded first, then select
    setExpandedProjectId(projectId);
    selectProject(projectId);

    // Fetch users if not already loaded
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
      // Clear cached users to force reload
      setProjectUsers((prev) => {
        const { [addMemberProject.id]: _, ...rest } = prev;
        return rest;
      });
      await loadProjectUsers(addMemberProject.id);
      refetch(); // Refresh project list to update user_count
    }
  };

  const handleRemoveUser = async () => {
    if (!removeMember) return;

    try {
      await removeUserFromProject(removeMember.projectId, removeMember.userId);
      // Clear cache and reload
      setProjectUsers((prev) => {
        const { [removeMember.projectId]: _, ...rest } = prev;
        return rest;
      });
      await loadProjectUsers(removeMember.projectId);
      refetch();
    } catch (error) {
      console.error("Failed to remove user:", error);
    } finally {
      setRemoveMember(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <Button>
          <Plus className="h-4 w-4" />
          {t("newProject")}
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Projects Grid */}
      {!isLoading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 items-start">
          {projects.map((project) => {
            const isExpanded = expandedProjectId !== null && expandedProjectId === project.id;
            const users = projectUsers[project.id] || [];
            const isLoadingThisProject = loadingUsers === project.id;

            return (
              <Card
                key={project.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedProjectId === project.id && "ring-2 ring-primary",
                  isExpanded && "ring-1 ring-border"
                )}
              >
                <CardContent className="p-5">
                  {/* Card Header - Clickable */}
                  <div onClick={() => handleProjectClick(project.id)}>
                    {/* Project Icon */}
                    <div className="mb-3 flex items-start justify-between">
                      <div className="w-fit rounded-lg bg-muted p-2.5">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Project Name */}
                    <h3 className="truncate text-base font-medium text-foreground">
                      {project.name}
                    </h3>

                    {/* Project Address */}
                    {project.address && (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {project.address}
                      </p>
                    )}

                    {/* Project Meta */}
                    <div className="mt-3 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {project.user_count} {project.user_count === 1 ? t("member") : t("members")}
                      </span>
                    </div>

                    {/* Selected Badge */}
                    {selectedProjectId === project.id && (
                      <Badge className="mt-3">
                        <Check className="mr-1 h-3 w-3" />
                        {t("selected")}
                      </Badge>
                    )}
                  </div>

                  {/* Expanded User List */}
                  {isExpanded && (
                    <div className="mt-4 border-t pt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-medium text-foreground">
                          {t("teamMembers")}
                        </h4>
                        {canManageUsers && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddMemberProject({ id: project.id, name: project.name });
                            }}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            {t("addMember")}
                          </Button>
                        )}
                      </div>

                      {isLoadingThisProject ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : users.length > 0 ? (
                        <ul className="space-y-2">
                          {users.map((member) => (
                            <li
                              key={member.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                  {member.email.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate text-muted-foreground">
                                  {member.email}
                                </span>
                              </div>
                              {canManageUsers && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemoveMember({ projectId: project.id, userId: member.id, email: member.email });
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t("noMembers")}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && projects.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 rounded-xl bg-muted p-4">
              <Building2 className="h-12 w-12 text-muted-foreground" />
            </div>

            <h3 className="text-base font-medium text-foreground">
              {t("noProjectsYet")}
            </h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              {t("getStarted")}
            </p>

            <Button variant="outline" className="mt-4">
              <Plus className="h-4 w-4" />
              {t("createFirst")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Member Dialog */}
      {addMemberProject && (
        <AddMemberDialog
          projectId={addMemberProject.id}
          projectName={addMemberProject.name}
          open={!!addMemberProject}
          onOpenChange={(open) => !open && setAddMemberProject(null)}
          onMemberAdded={handleMemberAdded}
        />
      )}

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!removeMember} onOpenChange={(open) => !open && setRemoveMember(null)}>
        <AlertDialogContent className="max-w-sm sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-center space-y-1">
              <AlertDialogTitle className="text-center">{t("removeMemberTitle")}</AlertDialogTitle>
              <p className="text-sm text-muted-foreground">{removeMember?.email}</p>
            </div>
          </div>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
