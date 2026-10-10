"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Project } from "@/types/project";
import { fetchProjectById, fetchProjects } from "@/lib/api/projects";

const STORAGE_KEY = "selectedProjectId";

/**
 * The project id carried by a /projects/<id>/... URL (with or without the
 * locale prefix), or null on any other route.
 */
export function projectIdFromPath(pathname: string | null | undefined): string | null {
  return pathname?.match(/^(?:\/[a-z]{2})?\/projects\/([^/?#]+)\//)?.[1] ?? null;
}

interface ProjectContextType {
  projects: Project[];
  selectedProjectId: string | null;
  selectedProject: Project | null;
  selectProject: (projectId: string) => void;
  isLoading: boolean;
  /** Set when the project list failed to load; pages show a translated message. */
  error: "load_failed" | null;
  refetch: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<"load_failed" | null>(null);

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
    } catch {
      // A code, not err.message: ApiError's message is "HTTP 500: ..." in English.
      setError("load_failed");
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

  // On a /projects/<id>/... page the URL names the project being viewed, so it
  // wins over the stored selection: a deep link, bookmark or notification must
  // not leave the breadcrumb, nav links and topbar actions on another project.
  // The effective id is derived during render (no frame shows the stale one),
  // and the effect persists it so the choice sticks after leaving the page.
  const routeProjectId = projectIdFromPath(pathname);
  const routeProjectKnown =
    routeProjectId !== null && projects.some((p) => p.id === routeProjectId);
  const effectiveProjectId = routeProjectKnown ? routeProjectId : selectedProjectId;

  useEffect(() => {
    if (routeProjectKnown) setSelectedProjectId(routeProjectId);
  }, [routeProjectKnown, routeProjectId]);

  // The URL project is missing from the loaded list (the list failed to load,
  // or it came back without it): fetch that one project so the switcher and
  // the project nav still show the project being viewed. A project the user
  // cannot open is refused by the API and simply stays out.
  useEffect(() => {
    if (!isHydrated || isLoading || !routeProjectId || routeProjectKnown) return;
    let cancelled = false;
    fetchProjectById(routeProjectId)
      .then((project) => {
        if (cancelled || project.id !== routeProjectId) return;
        setProjects((prev) => (prev.some((p) => p.id === project.id) ? prev : [...prev, project]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isHydrated, isLoading, routeProjectId, routeProjectKnown]);

  const selectedProject =
    projects.find((p) => p.id === effectiveProjectId) ?? null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProjectId: effectiveProjectId,
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

/** Like useProject, but returns undefined outside a ProjectProvider instead of throwing. */
export function useOptionalProject(): ProjectContextType | undefined {
  return useContext(ProjectContext);
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return context;
}
