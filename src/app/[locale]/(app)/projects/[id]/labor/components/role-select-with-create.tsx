"use client";

import * as React from "react";
import { ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleColorPicker } from "./role-color-picker";
import { createLaborRoleAction } from "../actions";
import { DEFAULT_ROLE_I18N_KEYS } from "@/lib/utils/default-role-names";
import type { LaborRole } from "@/types/labor-role";

interface RoleSelectWithCreateProps {
  roles: LaborRole[];
  palette: string[];
  value: string | null;
  onChange: (roleId: string | null) => void;
  onRoleCreated: (role: LaborRole) => void;
}

/**
 * RoleSelectWithCreate — Popover+Command picker for labor roles with
 * inline create capability. Follows the same pattern as PersonTypeahead.
 *
 * - "No role" option at the top clears the selection.
 * - Existing roles shown with a colored dot and name.
 * - When the search term is non-empty and has no exact match, a
 *   "Create role..." option appears at the bottom.
 * - Clicking "Create role..." reveals an inline form (name + color picker).
 */
export function RoleSelectWithCreate({
  roles,
  palette,
  value,
  onChange,
  onRoleCreated,
}: RoleSelectWithCreateProps) {
  const tRole = useTranslations("labor.role.defaults");
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createColor, setCreateColor] = React.useState(palette[0] ?? "#7C3AED");
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const selectedRole = value ? roles.find((r) => r.id === value) : null;
  const roleName = React.useCallback(
    (role: LaborRole) =>
      DEFAULT_ROLE_I18N_KEYS[role.id] ? tRole(DEFAULT_ROLE_I18N_KEYS[role.id]) : role.name,
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

  const showCreateOption = trimmed.length > 0 && !exactMatch && !showCreateForm;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset create form state on close.
      setQuery("");
      setShowCreateForm(false);
      setCreateName("");
      setCreateColor(palette[0] ?? "#7C3AED");
      setCreateError(null);
    }
  }

  function handleSelect(roleId: string | null) {
    onChange(roleId);
    setOpen(false);
    setQuery("");
  }

  function handleShowCreate() {
    setCreateName(trimmed);
    setCreateColor(palette[0] ?? "#7C3AED");
    setCreateError(null);
    setShowCreateForm(true);
  }

  async function handleCreate() {
    if (!createName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createLaborRoleAction({
        name: createName.trim(),
        color: createColor,
      });
      if (!result.success) {
        setCreateError(result.error === "duplicate" ? "Name already exists" : "Failed to create role");
        return;
      }
      onRoleCreated(result.role);
      onChange(result.role.id);
      setOpen(false);
      setQuery("");
      setShowCreateForm(false);
    } catch {
      setCreateError("Failed to create role");
    } finally {
      setCreating(false);
    }
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
              {displayLabel || "Select role"}
            </span>
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search roles…"
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              if (showCreateForm) setShowCreateForm(false);
            }}
          />
          <CommandList id={listId}>
            {filteredRoles.length === 0 && !showCreateOption && !showCreateForm && (
              <CommandEmpty>
                {trimmed ? "No matching roles" : "No roles yet"}
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
                No role
              </CommandItem>
            </CommandGroup>

            {filteredRoles.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  {filteredRoles.map((role) => (
                    <CommandItem
                      key={role.id}
                      value={role.id}
                      onSelect={() => handleSelect(role.id)}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: role.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{roleName(role)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {showCreateOption && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={handleShowCreate}
                    className="text-primary flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create &quot;{trimmed}&quot;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>

          {/* Inline create form — shown below the list */}
          {showCreateForm && (
            <div className="border-t p-3 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Role name</Label>
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Role name"
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <RoleColorPicker
                  palette={palette.length > 0 ? palette : ["#7C3AED"]}
                  value={createColor}
                  onChange={setCreateColor}
                />
              </div>
              {createError && (
                <p className="text-destructive text-xs">{createError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreate}
                  disabled={creating || !createName.trim()}
                  className="flex-1"
                >
                  {creating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Create
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
