"use client";

import * as React from "react";
import { ChevronsUpDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { LaborRoleForm } from "@/components/labor/labor-role-form";
import {
  buildLaborRoleUpdate,
  laborRoleErrorMessage,
} from "@/components/labor/labor-role-helpers";
import {
  createLaborRoleAction,
  deleteLaborRoleAction,
  updateLaborRoleAction,
} from "./labor-role-actions";
import { resolveDefaultRoleI18nKey } from "@/lib/utils/default-role-names";
import type { LaborRole } from "@/types/labor-role";

interface RoleSelectWithCreateProps {
  roles: LaborRole[];
  palette: string[];
  value: string | null;
  onChange: (roleId: string | null) => void;
  onRoleCreated: (role: LaborRole) => void;
  /**
   * Whether the caller may create, rename, recolor or delete roles (company
   * admin or manager — see `canManageLaborRoles`). Without it the picker only
   * selects: no "Create" option and no edit control, since the backend would
   * answer every one of those writes with 403.
   */
  canManage?: boolean;
  onRoleUpdated?: (role: LaborRole) => void;
  onRoleDeleted?: (roleId: string) => void;
}

/**
 * What the panel under the list is showing: nothing, the create form, or the
 * edit form for one role — with, while `confirmingDelete`, the delete
 * confirmation in its place. The form stays mounted (hidden) behind the
 * confirmation, so Cancel returns to it with whatever was already typed.
 */
type Panel =
  | { kind: "none" }
  | { kind: "create"; seedName: string }
  | { kind: "edit"; role: LaborRole; confirmingDelete: boolean };

/**
 * The panels and the pencil buttons sit inside cmdk's <Command>, whose root
 * handles Enter and the arrow keys as list navigation: it cancels Enter's
 * default and selects the highlighted role (by default "No role") instead of
 * pressing the focused button. Keep those keys on the focused control; Escape
 * still bubbles so the popover can close.
 */
function keepKeysInPanel(e: React.KeyboardEvent) {
  if (e.key !== "Escape") e.stopPropagation();
}

/**
 * RoleSelectWithCreate — Popover+Command picker for labor roles; for a
 * company admin or manager (`canManage`) also inline create, rename, recolor
 * and delete. Follows the same pattern as PersonTypeahead.
 *
 * - "No role" option at the top clears the selection.
 * - Existing roles shown with a colored dot and name; with `canManage`, a
 *   pencil beside each one opens the edit form (name, color, delete).
 * - With `canManage`, when the search term is non-empty and has no exact
 *   match, a "Create role..." option appears at the bottom.
 * - Delete asks for confirmation inside the popover first. The backend then
 *   clears the role from every worker who had it, so the parent reloads them.
 * - A role someone else already deleted (404) is dropped from the list the
 *   same way, instead of leaving a row that can no longer be saved.
 */
export function RoleSelectWithCreate({
  roles,
  palette,
  value,
  onChange,
  onRoleCreated,
  canManage = false,
  onRoleUpdated,
  onRoleDeleted,
}: RoleSelectWithCreateProps) {
  const tRole = useTranslations("labor.role.defaults");
  const t = useTranslations("labor.role");
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [panel, setPanel] = React.useState<Panel>({ kind: "none" });
  const [busy, setBusy] = React.useState(false);
  // Synchronous twin of `busy`: a double Enter lands before the re-render
  // that disables the buttons, and must not send the request twice.
  const busyRef = React.useRef(false);
  const [panelError, setPanelError] = React.useState<string | null>(null);
  // Cancel on the delete confirmation hands focus back to the trash button
  // that opened it (the confirmation's own buttons disappear).
  const trashRef = React.useRef<HTMLButtonElement>(null);
  const refocusTrashRef = React.useRef(false);

  const selectedRole = value ? roles.find((r) => r.id === value) : null;
  const roleName = React.useCallback(
    (role: LaborRole) => {
      const key = resolveDefaultRoleI18nKey(role);
      return key ? tRole(key) : role.name;
    },
    [tRole],
  );

  const trimmed = query.trim();

  // Filter roles by search query (client-side — list is small).
  const filteredRoles = React.useMemo(() => {
    if (!trimmed) return roles;
    const lower = trimmed.toLowerCase();
    return roles.filter((r) => roleName(r).toLowerCase().includes(lower));
  }, [roles, trimmed, roleName]);

  const exactMatch =
    trimmed.length > 0 &&
    roles.some((r) => roleName(r).trim().toLowerCase() === trimmed.toLowerCase());

  const showCreateOption =
    canManage && trimmed.length > 0 && !exactMatch && panel.kind === "none";

  function showPanel(next: Panel) {
    setPanelError(null);
    setPanel(next);
  }

  React.useEffect(() => {
    if (!refocusTrashRef.current) return;
    if (panel.kind === "edit" && !panel.confirmingDelete) {
      refocusTrashRef.current = false;
      trashRef.current?.focus();
    }
  }, [panel]);

  function cancelDelete(role: LaborRole) {
    refocusTrashRef.current = true;
    showPanel({ kind: "edit", role, confirmingDelete: false });
  }

  /**
   * The role was deleted elsewhere (the backend answered 404): drop it here
   * too, as a delete would, and say so. The panel closes, so the message goes
   * to a toast rather than under a form that is no longer shown.
   */
  function dropMissingRole(role: LaborRole) {
    if (value === role.id) onChange(null);
    onRoleDeleted?.(role.id);
    toast.error(t("errors.notFound"));
    setPanel({ kind: "none" });
  }

  function handleOpenChange(next: boolean) {
    // Never drop a request in flight: its result still has to land.
    if (!next && busy) return;
    setOpen(next);
    if (!next) {
      // Reset create/edit state on close.
      setQuery("");
      showPanel({ kind: "none" });
    }
  }

  function handleSelect(roleId: string | null) {
    onChange(roleId);
    setOpen(false);
    setQuery("");
  }

  /** Run one request at a time; `failedKey` is shown if it throws. */
  async function runRequest(failedKey: string, work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPanelError(null);
    try {
      await work();
    } catch {
      setPanelError(t(failedKey));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function handleCreate(values: { name: string; color: string }) {
    void runRequest("createFailed", async () => {
      const result = await createLaborRoleAction(values);
      if (!result.success) {
        setPanelError(laborRoleErrorMessage(t, result, "create"));
        return;
      }
      onRoleCreated(result.role);
      onChange(result.role.id);
      setOpen(false);
      setQuery("");
      setPanel({ kind: "none" });
    });
  }

  function handleUpdate(role: LaborRole, values: { name: string; color: string }) {
    const payload = buildLaborRoleUpdate(role, roleName(role), values);
    if (!payload) {
      showPanel({ kind: "none" });
      return;
    }
    void runRequest("updateFailed", async () => {
      const result = await updateLaborRoleAction(role.id, payload);
      if (!result.success) {
        if (result.error === "notFound") {
          dropMissingRole(role);
          return;
        }
        setPanelError(laborRoleErrorMessage(t, result, "update"));
        return;
      }
      onRoleUpdated?.(result.role);
      toast.success(t("updated"));
      setPanel({ kind: "none" });
    });
  }

  function handleDelete(role: LaborRole) {
    void runRequest("deleteFailed", async () => {
      const result = await deleteLaborRoleAction(role.id);
      if (!result.success) {
        if (result.error === "notFound") {
          dropMissingRole(role);
          return;
        }
        setPanelError(laborRoleErrorMessage(t, result, "delete"));
        return;
      }
      if (value === role.id) onChange(null);
      onRoleDeleted?.(role.id);
      toast.success(t("deleted"));
      setPanel({ kind: "none" });
    });
  }

  const displayLabel = selectedRole ? roleName(selectedRole) : "";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-left text-sm shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring",
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedRole && (
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: selectedRole.color }}
                aria-hidden="true"
              />
            )}
            <span className={cn("truncate", !displayLabel && "text-muted-foreground")}>
              {displayLabel || t("selectRole")}
            </span>
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("searchRoles")}
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              if (panel.kind !== "none" && !busy) showPanel({ kind: "none" });
            }}
          />
          <CommandList id={listId}>
            {filteredRoles.length === 0 && !showCreateOption && panel.kind === "none" && (
              <CommandEmpty>
                {trimmed ? t("noMatchingRoles") : t("noRolesYet")}
              </CommandEmpty>
            )}

            {/* No role option */}
            <CommandGroup>
              <CommandItem
                value="__no_role__"
                onSelect={() => handleSelect(null)}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-muted-foreground/40" aria-hidden="true" />
                {t("noRole")}
              </CommandItem>
            </CommandGroup>

            {filteredRoles.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  {filteredRoles.map((role) => (
                    <div key={role.id} className="flex items-center gap-1">
                      <CommandItem
                        value={role.id}
                        onSelect={() => handleSelect(role.id)}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: role.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{roleName(role)}</span>
                      </CommandItem>
                      {/* Outside the option on purpose: a button nested in a
                          cmdk item would also select the role. Its keys stay
                          off cmdk's root too, or Enter would pick "No role". */}
                      {canManage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="mr-1 shrink-0 text-muted-foreground"
                          aria-label={t("editNamed", { name: roleName(role) })}
                          title={t("editRole")}
                          disabled={busy}
                          onKeyDown={keepKeysInPanel}
                          onClick={() => showPanel({ kind: "edit", role, confirmingDelete: false })}
                        >
                          <Pencil />
                        </Button>
                      )}
                    </div>
                  ))}
                </CommandGroup>
              </>
            )}

            {showCreateOption && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => showPanel({ kind: "create", seedName: trimmed })}
                    className="text-primary flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("createNamed", { name: trimmed })}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>

          {/* Inline create form — shown below the list */}
          {panel.kind === "create" && (
            <div className="border-t p-3" onKeyDown={keepKeysInPanel}>
              <LaborRoleForm
                key="create"
                palette={palette}
                initialName={panel.seedName}
                submitLabel={t("create")}
                submitting={busy}
                error={panelError}
                onSubmit={handleCreate}
                onCancel={() => showPanel({ kind: "none" })}
              />
            </div>
          )}

          {/* Inline edit form — rename / recolor, with delete behind a confirm.
              Hidden, not unmounted, while the confirmation shows. */}
          {panel.kind === "edit" && (
            <div
              className="border-t p-3"
              hidden={panel.confirmingDelete}
              onKeyDown={keepKeysInPanel}
            >
              <p className="mb-2 text-xs font-medium">{t("editRole")}</p>
              <LaborRoleForm
                key={`edit-${panel.role.id}`}
                palette={palette}
                initialName={roleName(panel.role)}
                initialColor={panel.role.color}
                submitLabel={t("save")}
                submitting={busy}
                error={panel.confirmingDelete ? null : panelError}
                onSubmit={(values) => handleUpdate(panel.role, values)}
                onCancel={() => showPanel({ kind: "none" })}
                extraAction={
                  <Button
                    ref={trashRef}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={t("deleteNamed", { name: roleName(panel.role) })}
                    title={t("deleteRole")}
                    disabled={busy}
                    onClick={() =>
                      showPanel({ kind: "edit", role: panel.role, confirmingDelete: true })
                    }
                  >
                    <Trash2 />
                  </Button>
                }
              />
            </div>
          )}

          {panel.kind === "edit" && panel.confirmingDelete && (
            <div className="border-t p-3 space-y-3" onKeyDown={keepKeysInPanel}>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t("confirmDeleteTitle", { name: roleName(panel.role) })}
                </p>
                <p className="text-muted-foreground text-xs">{t("confirmDelete")}</p>
              </div>
              {panelError && (
                <p role="alert" className="text-destructive text-xs">
                  {panelError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => handleDelete(panel.role)}
                >
                  {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {t("deleteRole")}
                </Button>
                {/* Focus lands on the safe choice: the trash button that
                    opened this panel is gone, and Enter must not delete. */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  autoFocus
                  onClick={() => cancelDelete(panel.role)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
