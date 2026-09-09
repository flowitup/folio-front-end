"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { UserSearch } from "./user-search";
import { bulkAddMembershipsAction } from "./actions";
import { renderBulkAddResultsToasts } from "./results-toast-renderer";
import { projectDisplayName, projectMatchesSearch } from "@/lib/projects/project-display-name";
import type { ProjectSummary } from "@/lib/api/projects-server";
import type { UserSearchItem } from "@/lib/api/admin";

const MAX_PROJECTS = 50;

interface BulkAddFormProps {
  projects: ProjectSummary[];
}

/**
 * Platform-ops tool: attach an existing user to one or more projects.
 * Project access carries no role — permissions come from the company role
 * and per-project grants — so the form is user + projects only.
 */
export function BulkAddForm({ projects }: BulkAddFormProps) {
  const t = useTranslations("admin.bulkAdd");
  const tToast = useTranslations("admin.bulkAdd.toast");

  const [selectedUser, setSelectedUser] = useState<UserSearchItem | null>(null);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("");

  const filteredProjects = projects.filter((p) => projectMatchesSearch(p, projectFilter));

  function toggleProject(id: string) {
    setProjectIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PROJECTS) return prev; // cap enforced via disabled too
      return [...prev, id];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedUser) {
      setError(t("errors.userRequired"));
      return;
    }
    if (projectIds.length < 1) {
      setError(t("errors.projectsRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await bulkAddMembershipsAction(selectedUser.id, projectIds);

      if (!result.success) {
        const key = result.error ?? "generic";
        toast.error(t(`errors.${key}`));
        return;
      }

      if (result.results) {
        renderBulkAddResultsToasts(result.results, tToast);
      }

      // Reset project selection on success; keep the user for repeated use
      setProjectIds([]);
      setProjectFilter("");
    } finally {
      setIsSubmitting(false);
    }
  }

  const atCap = projectIds.length >= MAX_PROJECTS;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* User search */}
      <UserSearch
        onSelect={(u) => {
          setSelectedUser(u);
          setError(null);
        }}
      />
      {selectedUser && (
        <p className="text-sm -mt-2" style={{ color: "var(--muted-foreground)" }}>
          {t("userSearch.selected", { email: selectedUser.email })}
        </p>
      )}

      {/* Project multi-select */}
      <div className="space-y-1.5">
        <Label aria-required="true">
          {t("projects.label")}{" "}
          <span
            className="ml-1 text-xs font-normal"
            style={{ color: "var(--muted-foreground)" }}
          >
            ({projectIds.length}/{MAX_PROJECTS})
          </span>
        </Label>

        {/* Client-side filter */}
        <Input
          type="text"
          placeholder={t("projects.placeholder")}
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          disabled={isSubmitting}
          className="mb-1"
        />

        {atCap && (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("projects.maxReached")}
          </p>
        )}

        <Card className="overflow-auto max-h-56 p-3 space-y-1">
          {filteredProjects.length === 0 ? (
            <p
              className="text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("projects.empty")}
            </p>
          ) : (
            filteredProjects.map((project) => {
              const checked = projectIds.includes(project.id);
              const disabled = isSubmitting || (!checked && atCap);
              return (
                <label
                  key={project.id}
                  className="flex items-center gap-2 text-sm cursor-pointer select-none"
                  style={disabled && !checked ? { opacity: 0.5 } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleProject(project.id)}
                    className="h-4 w-4 rounded border accent-primary"
                    aria-label={projectDisplayName(project)}
                  />
                  {projectDisplayName(project)}
                </label>
              );
            })
          )}
        </Card>
      </div>

      {/* Error banner */}
      {error && (
        <p
          className="text-sm font-medium"
          style={{ color: "var(--destructive)" }}
          role="alert"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || !selectedUser || projectIds.length < 1}
      >
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
