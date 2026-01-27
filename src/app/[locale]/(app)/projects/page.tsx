"use client";

import { useTranslations } from "next-intl";
import { useProject } from "@/context/ProjectContext";
import { Plus, Building2, Users, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const { projects, isLoading, error, selectedProjectId, selectProject } = useProject();

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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              onClick={() => selectProject(project.id)}
              className={cn(
                "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md",
                selectedProjectId === project.id && "ring-2 ring-primary"
              )}
            >
              <CardContent className="p-5">
                {/* Project Icon */}
                <div className="mb-3 w-fit rounded-lg bg-muted p-2.5">
                  <Building2 className="h-5 w-5 text-primary" />
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
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}
