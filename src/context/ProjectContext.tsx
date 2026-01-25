"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Project } from "@/types/project";
import { fetchProjects } from "@/lib/api/projects";

const STORAGE_KEY = "selectedProjectId";

interface ProjectContextType {
  projects: Project[];
  selectedProjectId: string | null;
  selectedProject: Project | null;
  selectProject: (projectId: string) => void;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setSelectedProjectId(stored);
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (isHydrated) {
      if (selectedProjectId) {
        localStorage.setItem(STORAGE_KEY, selectedProjectId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [selectedProjectId, isHydrated]);

  // Fetch projects
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchProjects();
      setProjects(data);

      // Use functional update to get latest selectedProjectId
      setSelectedProjectId((prevId) => {
        // If stored ID is invalid, clear it
        if (prevId && !data.find((p) => p.id === prevId)) {
          return data.length > 0 ? data[0].id : null;
        }
        // Auto-select first project if none selected
        if (!prevId && data.length > 0) {
          return data[0].id;
        }
        return prevId;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and when hydrated
  useEffect(() => {
    if (isHydrated) {
      loadProjects();
    }
  }, [isHydrated, loadProjects]);

  const selectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
  }, []);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProjectId,
        selectedProject,
        selectProject,
        isLoading: isLoading || !isHydrated,
        error,
        refetch: loadProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return context;
}
