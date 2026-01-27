"use client";

import { Loader2 } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProjectSelector() {
  const {
    projects,
    selectedProjectId,
    selectProject,
    isLoading,
    error,
  } = useProject();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive" title={error}>
        Failed to load projects
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No projects available
      </div>
    );
  }

  return (
    <Select value={selectedProjectId || ""} onValueChange={selectProject}>
      <SelectTrigger className="w-48" size="sm">
        <SelectValue placeholder="Select project" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
