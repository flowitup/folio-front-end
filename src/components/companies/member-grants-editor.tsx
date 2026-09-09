"use client";

/**
 * MemberGrantsEditor — D8 grant/deny editor for one manager/member.
 *
 * Lists existing rows as chips (permission + effect + scope), lets the admin
 * add a new grant/deny picked from the backend's whitelist (`customisable`,
 * scoped company-wide or to one of the caller's projects — reuses
 * `useProject()` since `GET /projects` is already company-scoped), and
 * removes rows. Resolution order (backend): company-wide grant → project
 * grant → company-wide deny → project deny (deny always wins).
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/context/ProjectContext";
import {
  listMemberGrantsAction,
  setMemberGrantAction,
  removeMemberGrantAction,
} from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";
import type { GrantEffect, MemberGrantRow } from "@/lib/api/member-grants";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import type { AttachedUser } from "@/types/companies";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  target: AttachedUser;
}

const COMPANY_WIDE = "__company_wide__";

// Mirrors app/domain/authz/matrix.py::CUSTOMISABLE_PERMISSIONS exactly — the
// backend is the authority on which permissions are D8-customisable; this
// list only decides whether a localized label exists for one. An unlisted
// permission (whitelist grew server-side before i18n caught up) falls back
// to the raw permission string rather than crashing on a missing message key.
const LABELED_PERMISSIONS = new Set([
  "project:update",
  "project:invite",
  "project:manage_users",
  "project:manage_labor",
  "project:manage_invoices",
  "project:log_own_attendance",
  "bibliotheque:manage",
  "project:view_pay",
]);

export function MemberGrantsEditor({ open, onOpenChange, companyId, target }: Props) {
  const t = useTranslations("companySettings.grants");
  const { projects: allProjects } = useProject();
  // Project-scoped grants must only offer projects belonging to THIS
  // company — useProject() returns every project visible to the caller
  // (all their companies). `company_id` on the list payload is optional
  // (parallel BE rollout, D2/D3 phase) — filter by it once it's present;
  // until then fall back to showing every visible project rather than an
  // empty picker (temporary, matches the pre-rollout behavior).
  const projectsHaveCompanyId = allProjects.some((p) => p.company_id !== undefined);
  const projects = projectsHaveCompanyId
    ? allProjects.filter((p) => p.company_id === companyId)
    : allProjects;

  const [grants, setGrants] = useState<MemberGrantRow[]>([]);
  const [customisable, setCustomisable] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const [newPermission, setNewPermission] = useState("");
  const [newEffect, setNewEffect] = useState<GrantEffect>("grant");
  const [newScope, setNewScope] = useState<string>(COMPANY_WIDE);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listMemberGrantsAction(companyId, target.user_id);
      if (result.ok) {
        setGrants(result.data.grants);
        setCustomisable(result.data.customisable);
        setNewPermission((prev) => prev || result.data.customisable[0] || "");
      } else {
        toast.error(result.error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [companyId, target.user_id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function projectName(id: string | null): string {
    if (!id) return t("scopeCompanyWide");
    const project = projects.find((p) => p.id === id);
    return project ? projectDisplayName(project) : id;
  }

  function permissionLabel(permission: string): string {
    const key = permission.replace(":", "_");
    return LABELED_PERMISSIONS.has(permission) ? t(`permission.${key}`) : permission;
  }

  async function handleAdd() {
    if (!newPermission || isMutating) return;
    setIsMutating(true);
    try {
      const projectId = newScope === COMPANY_WIDE ? null : newScope;
      const result = await setMemberGrantAction(companyId, target.user_id, newPermission, newEffect, projectId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("savedToast"));
      await load();
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemove(row: MemberGrantRow) {
    setIsMutating(true);
    try {
      const result = await removeMemberGrantAction(companyId, target.user_id, row.permission, row.project_id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      await load();
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle", { name: target.display_name ?? target.email })}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted)" }} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Existing rows as removable chips */}
            <div className="flex flex-wrap gap-2">
              {grants.length === 0 && (
                <p className="text-[13px]" style={{ color: "var(--muted)" }}>
                  {t("empty")}
                </p>
              )}
              {grants.map((row) => (
                <span
                  key={`${row.permission}-${row.project_id ?? "company"}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]"
                  style={{
                    borderColor: row.effect === "deny" ? "var(--negative)" : "var(--line)",
                    color: row.effect === "deny" ? "var(--negative)" : "var(--ink)",
                  }}
                >
                  {row.effect === "deny" ? t("effectDeny") : t("effectGrant")}: {permissionLabel(row.permission)}
                  <span style={{ color: "var(--muted)" }}>· {projectName(row.project_id)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(row)}
                    disabled={isMutating}
                    aria-label={t("remove")}
                    className="ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            {/* Add a new grant/deny */}
            <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_1fr_auto]" style={{ borderColor: "var(--line)" }}>
              <Select value={newPermission} onValueChange={setNewPermission} disabled={isMutating || customisable.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={t("permissionPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {customisable.map((p) => (
                    <SelectItem key={p} value={p}>
                      {permissionLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newEffect} onValueChange={(v) => setNewEffect(v as GrantEffect)} disabled={isMutating}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grant">{t("effectGrant")}</SelectItem>
                  <SelectItem value="deny">{t("effectDeny")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newScope} onValueChange={setNewScope} disabled={isMutating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COMPANY_WIDE}>{t("scopeCompanyWide")}</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {projectDisplayName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAdd} disabled={isMutating || !newPermission} className="gap-1">
                {isMutating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {t("add")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
