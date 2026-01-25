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
      <div
        className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <span
          className="h-4 w-4 animate-spin rounded-full border-2"
          style={{
            borderColor: 'var(--border-default)',
            borderTopColor: 'var(--accent-primary)',
          }}
        />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="text-sm"
        title={error}
        style={{ color: 'var(--status-negative)' }}
      >
        Failed to load projects
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div
        className="text-sm"
        style={{ color: 'var(--text-tertiary)' }}
      >
        No projects available
      </div>
    );
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
        className="block w-52 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer appearance-none pr-10"
        style={{
          background: 'var(--bg-muted)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-primary-light)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>

      {/* Custom dropdown arrow */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
