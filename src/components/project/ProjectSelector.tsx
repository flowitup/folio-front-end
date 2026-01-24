"use client";

import { useProject } from "@/context/ProjectContext";

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
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500" title={error}>
        Failed to load projects
      </div>
    );
  }

  if (projects.length === 0) {
    return <div className="text-sm text-gray-500">No projects available</div>;
  }

  return (
    <div className="relative">
      <label htmlFor="project-selector" className="sr-only">
        Select project
      </label>
      <select
        id="project-selector"
        value={selectedProjectId || ""}
        onChange={(e) => selectProject(e.target.value)}
        className="block w-48 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}
