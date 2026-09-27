"use client";

/**
 * CompanyLaborRolesCard — Settings › Company › Labor roles.
 *
 * Lists the selected company's labor roles (the ones workers carry on its
 * projects) and lets the caller create, rename, recolor and delete them — the
 * web counterpart of the mobile app's Settings › Labor roles screen.
 *
 * The backend accepts these writes from platform ops or an admin OR MANAGER of
 * the company that owns the roles, so the parent mounts this card for either
 * role (unlike the admin-only cards next to it). Everything is scoped with
 * `company_id`, so a caller in several companies edits the one picked above,
 * not their primary one.
 *
 * Deleting a role never fails because workers still hold it: the database
 * clears their role instead. The confirmation says so.
 *
 * The parent keys this card by company id, so a company switch remounts it
 * and no role list is ever shown under another company's name.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LaborRoleForm } from "@/components/labor/labor-role-form";
import {
  buildLaborRoleUpdate,
  laborRoleErrorMessage,
} from "@/components/labor/labor-role-helpers";
import {
  createLaborRoleAction,
  deleteLaborRoleAction,
  fetchLaborRolesAction,
  updateLaborRoleAction,
  type RoleListActionResult,
} from "@/app/[locale]/(app)/projects/[id]/labor/actions";
import { resolveDefaultRoleI18nKey } from "@/lib/utils/default-role-names";
import type { LaborRole } from "@/types/labor-role";

interface CompanyLaborRolesCardProps {
  companyId: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; roles: LaborRole[]; palette: string[] };

/** Which inline form is open: none, the create form, or one role's editor. */
type Editing = null | "new" | string;

function toLoadState(result: RoleListActionResult): LoadState {
  return result.success
    ? { status: "ready", roles: result.data.roles, palette: result.data.palette }
    : { status: "error" };
}

export function CompanyLaborRolesCard({ companyId }: CompanyLaborRolesCardProps) {
  const t = useTranslations("labor.role");
  const tDefaults = useTranslations("labor.role.defaults");

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [editing, setEditing] = useState<Editing>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const [deleting, setDeleting] = useState<LaborRole | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const roleName = useCallback(
    (role: LaborRole) => {
      const key = resolveDefaultRoleI18nKey(role);
      return key ? tDefaults(key) : role.name;
    },
    [tDefaults]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchLaborRolesAction(companyId).then((result) => {
      if (!cancelled) setState(toLoadState(result));
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function retryLoad() {
    setState({ status: "loading" });
    setState(toLoadState(await fetchLaborRolesAction(companyId)));
  }

  function openForm(next: Editing) {
    setFormError(null);
    setEditing(next);
  }

  function replaceRoles(update: (roles: LaborRole[]) => LaborRole[]) {
    setState((prev) => (prev.status === "ready" ? { ...prev, roles: update(prev.roles) } : prev));
  }

  /** One write at a time: a double click must not create the role twice. */
  async function runSave(work: () => Promise<void>) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      await work();
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  function handleCreate(values: { name: string; color: string }) {
    void runSave(async () => {
      try {
        const result = await createLaborRoleAction(values, companyId);
        if (!result.success) {
          setFormError(laborRoleErrorMessage(t, result, "create"));
          return;
        }
        replaceRoles((roles) => [...roles, result.role]);
        setEditing(null);
        toast.success(t("created"));
      } catch {
        setFormError(t("createFailed"));
      }
    });
  }

  function handleUpdate(role: LaborRole, values: { name: string; color: string }) {
    const payload = buildLaborRoleUpdate(role, roleName(role), values);
    if (!payload) {
      setEditing(null);
      return;
    }
    void runSave(async () => {
      try {
        const result = await updateLaborRoleAction(role.id, payload);
        if (!result.success) {
          setFormError(laborRoleErrorMessage(t, result, "update"));
          return;
        }
        replaceRoles((roles) => roles.map((r) => (r.id === result.role.id ? result.role : r)));
        setEditing(null);
        toast.success(t("updated"));
      } catch {
        setFormError(t("updateFailed"));
      }
    });
  }

  function askDelete(role: LaborRole) {
    setDeleteError(null);
    setDeleting(role);
  }

  async function handleDeleteConfirm() {
    if (!deleting || isDeleting) return;
    const role = deleting;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteLaborRoleAction(role.id);
      if (!result.success) {
        // Keep the dialog open: the reason belongs next to the button that
        // failed, not in a toast that vanishes.
        setDeleteError(laborRoleErrorMessage(t, result, "delete"));
        return;
      }
      replaceRoles((roles) => roles.filter((r) => r.id !== role.id));
      if (editing === role.id) setEditing(null);
      setDeleting(null);
      toast.success(t("deleted"));
    } catch {
      setDeleteError(t("deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  const busy = saving || isDeleting;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-[16px]">{t("manageTitle")}</CardTitle>
          <CardDescription className="text-[13px]">{t("manageDescription")}</CardDescription>
          {state.status === "ready" && (
            <CardAction>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openForm("new")}
                disabled={busy || editing === "new"}
              >
                <Plus size={14} />
                {t("createRole")}
              </Button>
            </CardAction>
          )}
        </CardHeader>

        <CardContent>
          {state.status === "loading" && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
            </div>
          )}

          {state.status === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-[13px]" style={{ color: "var(--muted)" }}>
                {t("loadFailed")}
              </p>
              <Button size="sm" variant="outline" onClick={() => void retryLoad()}>
                <RefreshCw size={13} />
                {t("retry")}
              </Button>
            </div>
          )}

          {state.status === "ready" && (
            <div className="space-y-3">
              {editing === "new" && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--line)" }}>
                  <LaborRoleForm
                    key="new"
                    palette={state.palette}
                    submitLabel={t("create")}
                    submitting={saving}
                    error={formError}
                    onSubmit={handleCreate}
                    onCancel={() => openForm(null)}
                  />
                </div>
              )}

              {state.roles.length === 0 && editing !== "new" ? (
                <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>
                  {t("noRolesYet")}
                </p>
              ) : (
                <ul className="space-y-1" aria-label={t("manageTitle")}>
                  {state.roles.map((role) =>
                    editing === role.id ? (
                      <li
                        key={role.id}
                        className="rounded-lg border p-3"
                        style={{ borderColor: "var(--line)" }}
                      >
                        <LaborRoleForm
                          key={`edit-${role.id}`}
                          palette={state.palette}
                          initialName={roleName(role)}
                          initialColor={role.color}
                          submitLabel={t("save")}
                          submitting={saving}
                          error={formError}
                          onSubmit={(values) => handleUpdate(role, values)}
                          onCancel={() => openForm(null)}
                        />
                      </li>
                    ) : (
                      <li key={role.id} className="flex items-center gap-3 py-1.5">
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: role.color }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          {roleName(role)}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openForm(role.id)}
                            disabled={busy}
                            aria-label={t("editNamed", { name: roleName(role) })}
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => askDelete(role)}
                            disabled={busy}
                            aria-label={t("deleteNamed", { name: roleName(role) })}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("confirmDeleteTitle", { name: deleting ? roleName(deleting) : "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-destructive text-[13px]">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Stay open until the request settles, so a failure can be
                // shown here instead of the dialog vanishing on click.
                e.preventDefault();
                void handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
            >
              {isDeleting && <Loader2 size={12} className="mr-1.5 animate-spin" />}
              {t("deleteRole")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
