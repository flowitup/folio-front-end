"use client";

/**
 * MemberPickerDropdown — compact multi-select for a table cell: a trigger
 * button summarising the current selection, opening a checklist on click.
 * Shared by CompanyMembersTable's Company and Projects columns.
 *
 * `onSelect` is prevented on every checkbox item so the menu stays open
 * across several toggles (Radix's default is to close on select, which
 * would force re-opening the menu between each pick). The component itself
 * is presentational only — the caller decides what a toggle means (attach
 * immediately, or open a confirm dialog first for a destructive uncheck) and
 * owns the `selectedIds` it is given, so an in-flight mutation just passes
 * `isMutating` rather than the dropdown guessing at optimistic state.
 */

import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MemberPickerOption {
  id: string;
  label: string;
}

interface MemberPickerDropdownProps {
  options: MemberPickerOption[];
  selectedIds: string[];
  /** Fully disables the trigger — used for pending (no-account) rows. */
  disabled?: boolean;
  /** True while a toggle for this row is in flight — disables items, not the trigger, so the current selection stays visible. */
  isMutating?: boolean;
  placeholder: string;
  emptyText: string;
  onToggle: (option: MemberPickerOption, checked: boolean) => void;
}

export function MemberPickerDropdown({
  options,
  selectedIds,
  disabled = false,
  isMutating = false,
  placeholder,
  emptyText,
  onToggle,
}: MemberPickerDropdownProps) {
  const selectedSet = new Set(selectedIds);
  const selectedLabels = options.filter((o) => selectedSet.has(o.id)).map((o) => o.label);
  const summary = selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          title={summary}
          className="h-7 max-w-[220px] justify-between gap-1.5 text-[12px] font-normal"
        >
          <span className="truncate">{summary}</span>
          {isMutating ? (
            <Loader2 size={12} className="shrink-0 animate-spin opacity-60" aria-hidden="true" />
          ) : (
            <ChevronDown size={12} className="shrink-0 opacity-50" aria-hidden="true" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-[12px]" style={{ color: "var(--muted)" }}>
            {emptyText}
          </p>
        ) : (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.id}
              checked={selectedSet.has(option.id)}
              disabled={isMutating}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(checked) => onToggle(option, checked)}
              className="text-[12px]"
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
